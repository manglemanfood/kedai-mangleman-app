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
      const [orders, items, expenses, customers] = await Promise.all([
        supabase.from('orders').select('total_amount,status,created_at').gte('created_at', month + '-01'),
        supabase.from('order_items').select('product_name,quantity,subtotal,orders!inner(created_at,status)').gte('orders.created_at', month + '-01'),
        supabase.from('expenses').select('amount,category').gte('expense_date', month + '-01'),
        supabase.from('customers').select('segment,total_spent,total_orders'),
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
      const segs = { VIP:0, Loyal:0, Regular:0, Baru:0 }
      ;(customers.data||[]).forEach(c => segs[c.segment]=(segs[c.segment]||0)+1)
      setData({ revenue, expense, profit: revenue-expense, orders: validOrders.length, topProds, segs, totalCustomers: (customers.data||[]).length })
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

  return (
    <div>
      <div className="page-header"><h1>Analisa Bisnis 💡</h1><p>Insight dan rekomendasi untuk perkembangan Kedai MangLeman</p></div>
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: '1rem' }}>
        {insights.map((ins, i) => <div key={i} className={`alert alert-${ins.type}`}>{ins.msg}</div>)}
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
