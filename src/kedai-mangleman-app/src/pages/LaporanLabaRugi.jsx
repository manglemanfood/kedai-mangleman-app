import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')

// ==================== LAPORAN LABA RUGI ====================
export default function LaporanLabaRugi() {
  const [period, setPeriod] = useState('today')
  const [data, setData] = useState({ revenue: 0, expense: 0, orders: 0, avgOrder: 0 })
  const [loading, setLoading] = useState(true)
  const [byCategory, setByCategory] = useState([])
  const [topProducts, setTopProducts] = useState([])

  useEffect(() => { fetchReport() }, [period])

  const getDateRange = () => {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    if (period === 'today') return { from: today, to: today }
    if (period === 'week') {
      const d = new Date(now); d.setDate(d.getDate() - 7)
      return { from: d.toISOString().split('T')[0], to: today }
    }
    if (period === 'month') {
      return { from: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, to: today }
    }
    return { from: today, to: today }
  }

  const fetchReport = async () => {
    setLoading(true)
    const { from, to } = getDateRange()
    const [ordersRes, expensesRes, itemsRes] = await Promise.all([
      supabase.from('orders').select('total_amount,status').gte('created_at', from).lte('created_at', to + 'T23:59:59'),
      supabase.from('expenses').select('amount,category').gte('expense_date', from).lte('expense_date', to),
      supabase.from('order_items').select('product_name,quantity,subtotal,orders!inner(created_at,status)').gte('orders.created_at', from).lte('orders.created_at', to + 'T23:59:59'),
    ])
    const validOrders = (ordersRes.data || []).filter(o => o.status !== 'Batal')
    const revenue = validOrders.reduce((s, o) => s + o.total_amount, 0)
    const expense = (expensesRes.data || []).reduce((s, e) => s + e.amount, 0)
    const catMap = {}
    ;(expensesRes.data || []).forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + e.amount })
    setByCategory(Object.entries(catMap).map(([cat, total]) => ({ cat, total })).sort((a,b) => b.total - a.total))
    const prodMap = {}
    ;(itemsRes.data || []).filter(i => i.orders?.status !== 'Batal').forEach(i => {
      if (!prodMap[i.product_name]) prodMap[i.product_name] = { qty: 0, revenue: 0 }
      prodMap[i.product_name].qty += i.quantity
      prodMap[i.product_name].revenue += i.subtotal
    })
    setTopProducts(Object.entries(prodMap).map(([name, d]) => ({ name, ...d })).sort((a,b) => b.revenue - a.revenue).slice(0,5))
    setData({ revenue, expense, orders: validOrders.length, avgOrder: validOrders.length > 0 ? Math.round(revenue / validOrders.length) : 0 })
    setLoading(false)
  }

  const profit = data.revenue - data.expense
  const marginPct = data.revenue > 0 ? ((profit / data.revenue) * 100).toFixed(1) : 0

  return (
    <div>
      <div className="page-header flex-between">
        <div><h1>Laporan Laba Rugi 📊</h1><p>Real-time profit & loss Kedai MangLeman</p></div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['today','Hari Ini'],['week','7 Hari'],['month','Bulan Ini']].map(([val,label]) => (
            <button key={val} onClick={() => setPeriod(val)} className="btn btn-sm" style={{ background: period === val ? '#1A2E0A' : 'transparent', color: period === val ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}>{label}</button>
          ))}
          <button onClick={fetchReport} className="btn btn-sm btn-outline">🔄</button>
        </div>
      </div>
      {loading ? <div className="loading"><div className="spinner" /></div> : (
        <>
          <div className="grid-4 mb-2">
            {[
              { label: 'Pendapatan', value: formatRp(data.revenue), color: '#2D5016', icon: '💰' },
              { label: 'Pengeluaran', value: formatRp(data.expense), color: '#C0392B', icon: '💸' },
              { label: profit >= 0 ? '✅ Laba' : '❌ Rugi', value: formatRp(Math.abs(profit)), color: profit >= 0 ? '#28A745' : '#C0392B', icon: profit >= 0 ? '📈' : '📉' },
              { label: 'Margin', value: marginPct + '%', color: parseFloat(marginPct) >= 20 ? '#28A745' : '#C8881A', icon: '🎯' },
            ].map((s, i) => (
              <div key={i} className="card stat-card">
                <div style={{ fontSize: 28, marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="grid-2">
            <div className="card">
              <h4 style={{ marginBottom: 12, fontWeight: 700, fontSize: 14 }}>💸 Pengeluaran per Kategori</h4>
              {byCategory.length === 0 ? <p className="text-muted" style={{ fontSize: 13 }}>Belum ada data pengeluaran</p> : byCategory.map(c => (
                <div key={c.cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <span>{c.cat}</span><span style={{ fontWeight: 600, color: 'var(--danger)' }}>{formatRp(c.total)}</span>
                </div>
              ))}
            </div>
            <div className="card">
              <h4 style={{ marginBottom: 12, fontWeight: 700, fontSize: 14 }}>🏆 Menu Terlaris</h4>
              {topProducts.length === 0 ? <p className="text-muted" style={{ fontSize: 13 }}>Belum ada data penjualan</p> : topProducts.map((p, i) => (
                <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>#{i+1}</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.qty} terjual</div>
                    </div>
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--secondary)' }}>{formatRp(p.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card mt-2">
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              {[
                { label: 'Total Order', value: data.orders + ' order' },
                { label: 'Rata-rata per Order', value: formatRp(data.avgOrder) },
                { label: 'Revenue per Hari', value: formatRp(period === 'week' ? Math.round(data.revenue/7) : period === 'month' ? Math.round(data.revenue/30) : data.revenue) },
              ].map((s, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center', minWidth: 120 }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
