import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')

// ==================== ANALISA BISNIS ====================
export default function AnalisaBisnis() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      const now = new Date()
      const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0] // last day before current month starts... actually use current month-1's last day
      const prevEnd = `${prevMonth}-${String(new Date(prevDate.getFullYear(), prevDate.getMonth()+1, 0).getDate()).padStart(2,'0')}`

      const [orders, items, expenses, customers, prevOrders, prevItems] = await Promise.all([
        supabase.from('orders').select('total_amount,status,created_at').gte('created_at', month + '-01'),
        supabase.from('order_items').select('product_name,quantity,subtotal,orders!inner(created_at,status)').gte('orders.created_at', month + '-01'),
        supabase.from('expenses').select('amount,category').gte('expense_date', month + '-01'),
        supabase.from('customers').select('segment,total_spent,total_orders'),
        supabase.from('orders').select('total_amount,status,created_at').gte('created_at', prevMonth + '-01').lte('created_at', prevEnd + 'T23:59:59'),
        supabase.from('order_items').select('product_name,quantity,subtotal,orders!inner(created_at,status)').gte('orders.created_at', prevMonth + '-01').lte('orders.created_at', prevEnd + 'T23:59:59'),
      ])
      const validOrders = (orders.data || []).filter(o => o.status !== 'Batal')
      const revenue = validOrders.reduce((s,o) => s+o.total_amount, 0)
      const expense = (expenses.data || []).reduce((s,e) => s+e.amount, 0)
      const prodMap = {}
      ;(items.data||[]).filter(i=>i.orders?.status!=='Batal').forEach(i => {
        if(!prodMap[i.product_name]) prodMap[i.product_name]={qty:0,revenue:0}
        prodMap[i.product_name].qty+=i.quantity
        prodMap[i.product_name].revenue+=i.subtotal
      })
      const topProds = Object.entries(prodMap).sort((a,b)=>b[1].revenue-a[1].revenue)

      // Previous month data for comparison
      const prevValidOrders = (prevOrders.data || []).filter(o => o.status !== 'Batal')
      const prevRevenue = prevValidOrders.reduce((s,o) => s+o.total_amount, 0)
      const prevProdMap = {}
      ;(prevItems.data||[]).filter(i=>i.orders?.status!=='Batal').forEach(i => {
        if(!prevProdMap[i.product_name]) prevProdMap[i.product_name]={qty:0,revenue:0}
        prevProdMap[i.product_name].qty+=i.quantity
        prevProdMap[i.product_name].revenue+=i.subtotal
      })

      // Compute per-product delta (revenue contribution to the change)
      const allProductNames = new Set([...Object.keys(prodMap), ...Object.keys(prevProdMap)])
      const productDeltas = Array.from(allProductNames).map(name => {
        const curr = prodMap[name]?.revenue || 0
        const prev = prevProdMap[name]?.revenue || 0
        const currQty = prodMap[name]?.qty || 0
        const prevQty = prevProdMap[name]?.qty || 0
        return {
          name,
          delta: curr - prev,
          curr, prev, currQty, prevQty,
          isNew: prev === 0 && curr > 0,
          isGone: curr === 0 && prev > 0,
        }
      }).sort((a, b) => b.delta - a.delta)

      const revenueGrowth = revenue - prevRevenue
      const revenueGrowthPct = prevRevenue > 0 ? Math.round((revenueGrowth / prevRevenue) * 100) : (revenue > 0 ? 100 : 0)

      const segs = { VIP:0, Loyal:0, Regular:0, Baru:0 }
      ;(customers.data||[]).forEach(c => segs[c.segment]=(segs[c.segment]||0)+1)
      setData({
        revenue, expense, profit: revenue-expense, orders: validOrders.length, topProds, segs,
        totalCustomers: (customers.data||[]).length,
        prevRevenue, revenueGrowth, revenueGrowthPct,
        productDeltas, prevOrdersCount: prevValidOrders.length,
        monthLabel: now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
        prevMonthLabel: prevDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
      })
      setLoading(false)
    }
    fetchAll()
  }, [])

  if (loading) return <div className="loading"><div className="spinner" /></div>

  const insights = []
  if (data.profit < 0) insights.push({ type: 'danger', msg: '⚠️ Bulan ini masih rugi! Cek pengeluaran terbesar dan pertimbangkan efisiensi.' })
  if (data.profit > 0 && data.revenue > 0) {
    const margin = (data.profit / data.revenue * 100).toFixed(1)
    if (parseFloat(margin) < 20) insights.push({ type: 'warning', msg: `📉 Margin laba ${margin}% masih rendah. Target ideal FnB minimal 20-30%.` })
    else insights.push({ type: 'success', msg: `✅ Margin ${margin}% — bagus! Pertahankan efisiensi biaya.` })
  }
  if (data.segs.VIP > 0) insights.push({ type: 'success', msg: `👑 Ada ${data.segs.VIP} pelanggan VIP. Pertimbangkan program loyalitas eksklusif untuk mereka.` })
  if (data.segs.Baru > data.segs.Loyal) insights.push({ type: 'info', msg: `👋 Banyak pelanggan baru (${data.segs.Baru}). Fokus pada follow-up agar mereka jadi pelanggan loyal.` })
  if (data.topProds[0]) insights.push({ type: 'info', msg: `🏆 Menu terlaris: ${data.topProds[0][0]} (${data.topProds[0][1].qty} terjual). Pastikan stok selalu ready.` })

  // Insight: kenapa omset naik/turun
  if (data.prevRevenue > 0 || data.revenue > 0) {
    const topDrivers = data.productDeltas.filter(p => p.delta > 0).slice(0, 3)
    const topDrags = data.productDeltas.filter(p => p.delta < 0).slice(-3).reverse()

    if (data.revenueGrowth > 0) {
      const driverNames = topDrivers.map(p => p.name).join(', ')
      insights.push({
        type: 'success',
        msg: `📈 Omset naik ${formatRp(data.revenueGrowth)} (${data.revenueGrowthPct}%) dibanding ${data.prevMonthLabel}. Pendorong utama: ${driverNames || '-'}.`
      })
      if (topDrivers.some(p => p.isNew)) {
        const newProds = topDrivers.filter(p => p.isNew).map(p => p.name).join(', ')
        insights.push({ type: 'info', msg: `🆕 Menu baru yang langsung laris: ${newProds}. Pertimbangkan untuk dijadikan menu andalan.` })
      }
    } else if (data.revenueGrowth < 0) {
      const dragNames = topDrags.map(p => p.name).join(', ')
      insights.push({
        type: 'danger',
        msg: `📉 Omset turun ${formatRp(Math.abs(data.revenueGrowth))} (${Math.abs(data.revenueGrowthPct)}%) dibanding ${data.prevMonthLabel}. Penyebab utama: ${dragNames || '-'}.`
      })
      if (topDrags.some(p => p.isGone)) {
        const goneProds = topDrags.filter(p => p.isGone).map(p => p.name).join(', ')
        insights.push({ type: 'warning', msg: `⚠️ Menu yang tidak laku bulan ini: ${goneProds}. Cek apakah stok habis atau peminatnya turun.` })
      }
    }
  }

  return (
    <div>
      <div className="page-header"><h1>Analisa Bisnis 💡</h1><p>Insight dan rekomendasi untuk perkembangan Kedai MangLeman</p></div>
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: '1rem' }}>
        {insights.map((ins, i) => <div key={i} className={`alert alert-${ins.type}`}>{ins.msg}</div>)}
      </div>
      {/* Revenue Comparison Card */}
      <div className="card mt-2" style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #1A2E0A 0%, #2D5016 100%)', border: 'none' }}>
        <h4 style={{ fontWeight: 700, fontSize: 14, color: '#fff', marginBottom: 14 }}>📊 {data.monthLabel} vs {data.prevMonthLabel}</h4>
        <div className="grid-2" style={{ gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{data.prevMonthLabel}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{formatRp(data.prevRevenue)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{data.monthLabel}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#E8A838' }}>{formatRp(data.revenue)}</div>
          </div>
        </div>
        <div style={{
          marginTop: 12, padding: '8px 12px', borderRadius: 8,
          background: data.revenueGrowth >= 0 ? 'rgba(124,219,107,0.15)' : 'rgba(255,138,128,0.15)',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: data.revenueGrowth >= 0 ? '#7CDB6B' : '#FF8A80' }}>
            {data.revenueGrowth >= 0 ? '▲' : '▼'} {formatRp(Math.abs(data.revenueGrowth))} ({Math.abs(data.revenueGrowthPct)}%)
          </span>
        </div>
      </div>

      {/* Product Drivers - what made revenue go up or down */}
      <div className="grid-2 mt-2">
        <div className="card">
          <h4 style={{ marginBottom: 12, fontWeight: 700, fontSize: 14, color: '#2D5016' }}>🚀 Pendorong Kenaikan</h4>
          {data.productDeltas.filter(p => p.delta > 0).length === 0 ? (
            <div className="empty-state"><p>Tidak ada produk yang naik bulan ini</p></div>
          ) : data.productDeltas.filter(p => p.delta > 0).slice(0, 5).map((p, i) => (
            <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', minWidth: 18 }}>#{i + 1}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {p.name} {p.isNew && <span style={{ fontSize: 10, background: '#E8F5E0', color: '#2D5016', borderRadius: 8, padding: '1px 6px', marginLeft: 4 }}>BARU</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.prevQty} → {p.currQty} terjual</div>
                </div>
              </div>
              <span style={{ fontWeight: 700, color: '#2D5016', fontSize: 13 }}>+{formatRp(p.delta)}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <h4 style={{ marginBottom: 12, fontWeight: 700, fontSize: 14, color: '#C0392B' }}>📉 Penyebab Penurunan</h4>
          {data.productDeltas.filter(p => p.delta < 0).length === 0 ? (
            <div className="empty-state"><p>Tidak ada produk yang turun bulan ini</p></div>
          ) : data.productDeltas.filter(p => p.delta < 0).slice(-5).reverse().map((p, i) => (
            <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', minWidth: 18 }}>#{i + 1}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {p.name} {p.isGone && <span style={{ fontSize: 10, background: '#FDECEA', color: '#C0392B', borderRadius: 8, padding: '1px 6px', marginLeft: 4 }}>HILANG</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.prevQty} → {p.currQty} terjual</div>
                </div>
              </div>
              <span style={{ fontWeight: 700, color: '#C0392B', fontSize: 13 }}>{formatRp(p.delta)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-2 mt-2">
        <div className="card">
          <h4 style={{ marginBottom: 12, fontWeight: 700, fontSize: 14 }}>📦 Distribusi Pelanggan</h4>
          {Object.entries(data.segs).map(([seg, cnt]) => (
            <div key={seg} style={{ marginBottom: 10 }}>
              <div className="flex-between" style={{ fontSize: 13, marginBottom: 3 }}>
                <span>{seg}</span><span style={{ fontWeight: 700 }}>{cnt} orang</span>
              </div>
              <div style={{ background: 'var(--border)', borderRadius: 10, height: 8 }}>
                <div style={{ width: (data.totalCustomers > 0 ? cnt/data.totalCustomers*100 : 0) + '%', background: '#E8A838', height: '100%', borderRadius: 10 }} />
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <h4 style={{ marginBottom: 12, fontWeight: 700, fontSize: 14 }}>🍱 Top Menu Bulan Ini</h4>
          {data.topProds.slice(0,6).map(([name, d], i) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13, alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', minWidth: 20 }}>#{i+1}</span>
                <div>
                  <div style={{ fontWeight: 600 }}>{name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.qty} terjual</div>
                </div>
              </div>
              <span style={{ fontWeight: 700, color: '#2D5016' }}>{formatRp(d.revenue)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
