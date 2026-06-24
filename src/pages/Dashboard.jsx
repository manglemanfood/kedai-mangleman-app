import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')

const today = () => new Date().toISOString().split('T')[0]

const getDateRange = (mode, customFrom, customTo) => {
  const now = new Date()
  const todayStr = today()
  if (mode === 'hari-ini') return { from: todayStr, to: todayStr }
  if (mode === '7-hari') {
    const d = new Date(now); d.setDate(d.getDate() - 6)
    return { from: d.toISOString().split('T')[0], to: todayStr }
  }
  if (mode === '1-bulan') {
    return { from: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, to: todayStr }
  }
  if (mode === 'custom') return { from: customFrom || todayStr, to: customTo || todayStr }
  return { from: todayStr, to: todayStr }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('hari-ini')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [stats, setStats] = useState({ orders: 0, revenue: 0, expense: 0, pending: 0 })
  const [recentOrders, setRecentOrders] = useState([])
  const [chartData, setChartData] = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { from, to } = getDateRange(mode, customFrom, customTo)
    const fromDt = from + 'T00:00:00'
    const toDt = to + 'T23:59:59'

    const [ordersRes, expensesRes, itemsRes, recentRes] = await Promise.all([
      supabase.from('orders').select('total_amount,status,created_at').gte('created_at', fromDt).lte('created_at', toDt),
      supabase.from('expenses').select('amount').gte('expense_date', from).lte('expense_date', to),
      supabase.from('order_items').select('product_name,quantity,subtotal,orders!inner(created_at,status,delivery_date)'),
      supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(6),
    ])

    const validOrders = (ordersRes.data || []).filter(o => o.status !== 'Batal')
    const revenue = validOrders.reduce((s, o) => s + o.total_amount, 0)
    const expense = (expensesRes.data || []).reduce((s, e) => s + e.amount, 0)
    const pending = (ordersRes.data || []).filter(o => ['Baru','Diproses','Dikemas'].includes(o.status)).length

    setStats({ orders: validOrders.length, revenue, expense, pending })

    // Top products
    const prodMap = {}
    ;(itemsRes.data || []).filter(i => i.orders?.status !== 'Batal').forEach(i => {
      if (!prodMap[i.product_name]) prodMap[i.product_name] = { qty: 0, revenue: 0 }
      prodMap[i.product_name].qty += i.quantity
      prodMap[i.product_name].revenue += i.subtotal
    })
    setTopProducts(Object.entries(prodMap).map(([name, d]) => ({ name, ...d })).sort((a,b) => b.revenue - a.revenue).slice(0,5))
    setRecentOrders(recentRes.data || [])

    // Chart: daily revenue for range
    const days = []
    const start = new Date(from)
    const end = new Date(to)
    const diff = Math.ceil((end - start) / (1000*60*60*24)) + 1
    const showDays = Math.min(diff, 30)
    for (let i = showDays - 1; i >= 0; i--) {
      const d = new Date(end); d.setDate(d.getDate() - i)
      days.push(d.toISOString().split('T')[0])
    }
    const chartRows = days.map(day => {
      const dayOrders = validOrders.filter(o => o.created_at?.startsWith(day))
      return {
        day: new Date(day).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        revenue: dayOrders.reduce((s, o) => s + o.total_amount, 0),
        orders: dayOrders.length,
      }
    })
    setChartData(chartRows)
    setLoading(false)
  }, [mode, customFrom, customTo])

  useEffect(() => { fetchData() }, [fetchData])

  const profit = stats.revenue - stats.expense
  const modeLabels = { 'hari-ini': 'Hari Ini', '7-hari': '7 Hari Terakhir', '1-bulan': 'Bulan Ini', 'custom': 'Custom' }

  return (
    <div>
      <div className="page-header flex-between" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Dashboard 🏠</h1>
          <p>{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/rekap-order')}>📋 Rekap Order</button>
      </div>

      {/* Period filter */}
      <div className="card mb-2" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { key: 'hari-ini', label: '📅 Hari Ini' },
            { key: '7-hari', label: '📆 7 Hari' },
            { key: '1-bulan', label: '🗓 1 Bulan' },
            { key: 'custom', label: '✏️ Custom' },
          ].map(m => (
            <button key={m.key} onClick={() => setMode(m.key)} className="btn btn-sm"
              style={{ background: mode === m.key ? '#1A2E0A' : 'transparent', color: mode === m.key ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}>
              {m.label}
            </button>
          ))}

          {mode === 'custom' && (
            <>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="form-control" style={{ width: 'auto' }} />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>s/d</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="form-control" style={{ width: 'auto' }} />
            </>
          )}

          <button onClick={fetchData} className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }}>🔄</button>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          Menampilkan data: <strong>{modeLabels[mode]}</strong>
          {mode === 'custom' && customFrom && ` (${customFrom} s/d ${customTo || customFrom})`}
        </div>
      </div>

      {/* Stats */}
      <div className="grid-4 mb-2">
        {[
          { label: 'Total Order', value: stats.orders + ' order', icon: '📦', color: '#0077B6' },
          { label: 'Pendapatan', value: formatRp(stats.revenue), icon: '💰', color: '#2D5016' },
          { label: 'Pengeluaran', value: formatRp(stats.expense), icon: '💸', color: '#C0392B' },
          { label: profit >= 0 ? 'Laba' : 'Rugi', value: formatRp(Math.abs(profit)), icon: profit >= 0 ? '📈' : '📉', color: profit >= 0 ? '#28A745' : '#C0392B' },
        ].map((s, i) => (
          <div key={i} className="card stat-card">
            <div style={{ fontSize: 28, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Alert pending */}
      {stats.pending > 0 && (
        <div className="alert alert-warning flex-between" style={{ cursor: 'pointer' }} onClick={() => navigate('/rekap-order')}>
          <span>⚡ Ada <strong>{stats.pending} order</strong> yang perlu diproses sekarang!</span>
          <span>Lihat →</span>
        </div>
      )}

      <div className="grid-2 mb-2">
        {/* Chart */}
        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 700 }}>📊 Revenue {modeLabels[mode]}</h3>
          {loading ? <div className="loading"><div className="spinner" /></div> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={v => v >= 1000 ? (v/1000)+'k' : v} tick={{ fontSize: 10 }} />
                <Tooltip formatter={v => formatRp(v)} />
                <Bar dataKey="revenue" fill="#E8A838" radius={[4,4,0,0]} name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top products */}
        <div className="card">
          <h3 style={{ marginBottom: 12, fontSize: 15, fontWeight: 700 }}>🏆 Menu Terlaris</h3>
          {topProducts.length === 0 ? (
            <div className="empty-state"><p>Belum ada data penjualan</p></div>
          ) : topProducts.map((p, i) => (
            <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, minWidth: 20 }}>#{i+1}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.qty} terjual</div>
                </div>
              </div>
              <span style={{ fontWeight: 700, color: '#2D5016' }}>{formatRp(p.revenue)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent orders */}
      <div className="card mb-2">
        <div className="flex-between mb-1">
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>🕐 Order Terbaru</h3>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/rekap-order')}>Lihat Semua</button>
        </div>
        {recentOrders.length === 0 ? (
          <div className="empty-state"><p>Belum ada order</p></div>
        ) : recentOrders.map(o => (
          <div key={o.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{o.customer_name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {o.gedung} · Lt {o.lantai} · {new Date(o.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{formatRp(o.total_amount)}</div>
              <span className="badge" style={{ fontSize: 10, background: '#E8F5E0', color: '#2D5016' }}>{o.status}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="card">
        <h3 style={{ marginBottom: 12, fontSize: 15, fontWeight: 700 }}>⚡ Aksi Cepat</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[
            { label: '📋 Rekap Order', path: '/rekap-order' },
            { label: '💸 Input Pengeluaran', path: '/pengeluaran' },
            { label: '📦 Cek Stok', path: '/stok' },
            { label: '📊 Laporan L/R', path: '/laporan' },
            { label: '👥 CRM', path: '/crm' },
            { label: '📥 Import CSV', path: '/import' },
          ].map(a => (
            <button key={a.path} className="btn btn-outline" onClick={() => navigate(a.path)} style={{ fontSize: 13 }}>{a.label}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
