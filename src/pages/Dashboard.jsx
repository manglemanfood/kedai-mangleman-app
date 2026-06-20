import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ todayOrders: 0, todayRevenue: 0, todayExpense: 0, pendingOrders: 0 })
  const [recentOrders, setRecentOrders] = useState([])
  const [weeklyData, setWeeklyData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const today = new Date().toISOString().split('T')[0]

    const [ordersRes, expensesRes, recentRes] = await Promise.all([
      supabase.from('orders').select('*').gte('created_at', today),
      supabase.from('expenses').select('amount').eq('expense_date', today),
      supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(5),
    ])

    const orders = ordersRes.data || []
    const expenses = expensesRes.data || []
    const todayRevenue = orders.filter(o => o.status !== 'Batal').reduce((s, o) => s + o.total_amount, 0)
    const todayExpense = expenses.reduce((s, e) => s + e.amount, 0)
    const pendingOrders = orders.filter(o => ['Baru', 'Diproses', 'Dikemas'].includes(o.status)).length

    setStats({ todayOrders: orders.length, todayRevenue, todayExpense, pendingOrders })
    setRecentOrders(recentRes.data || [])

    // Weekly revenue
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days.push(d.toISOString().split('T')[0])
    }
    const weekOrders = await supabase.from('orders').select('created_at,total_amount,status').gte('created_at', days[0])
    const grouped = days.map(day => {
      const dayOrders = (weekOrders.data || []).filter(o => o.created_at.startsWith(day) && o.status !== 'Batal')
      return {
        day: new Date(day).toLocaleDateString('id-ID', { weekday: 'short' }),
        revenue: dayOrders.reduce((s, o) => s + o.total_amount, 0),
        orders: dayOrders.length,
      }
    })
    setWeeklyData(grouped)
    setLoading(false)
  }

  const profit = stats.todayRevenue - stats.todayExpense

  const statusColor = {
    'Baru': '#0077B6', 'Diproses': '#C8881A', 'Dikemas': '#6B2FD9',
    'Dikirim': '#2D5016', 'Selesai': '#28A745', 'Batal': '#C0392B'
  }

  return (
    <div>
      <div className="page-header flex-between">
        <div>
          <h1>Dashboard 🏠</h1>
          <p>{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/rekap-order')}>
          📋 Rekap Order
        </button>
      </div>

      {/* Stats */}
      <div className="grid-4 mb-2">
        {[
          { label: 'Order Hari Ini', value: stats.todayOrders, suffix: 'order', icon: '📦', color: '#0077B6' },
          { label: 'Pendapatan', value: formatRp(stats.todayRevenue), icon: '💰', color: '#2D5016' },
          { label: 'Pengeluaran', value: formatRp(stats.todayExpense), icon: '💸', color: '#C8881A' },
          { label: 'Laba Hari Ini', value: formatRp(profit), icon: profit >= 0 ? '📈' : '📉', color: profit >= 0 ? '#28A745' : '#C0392B' },
        ].map((s, i) => (
          <div key={i} className="card stat-card">
            <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
            <div className="stat-value" style={{ fontSize: 20, color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Pending alert */}
      {stats.pendingOrders > 0 && (
        <div className="alert alert-warning flex-between" style={{ cursor: 'pointer' }} onClick={() => navigate('/rekap-order')}>
          <span>⚡ Ada <strong>{stats.pendingOrders} order</strong> yang perlu diproses sekarang!</span>
          <span>Lihat →</span>
        </div>
      )}

      <div className="grid-2">
        {/* Weekly chart */}
        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 700 }}>📊 Revenue 7 Hari Terakhir</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weeklyData}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => v >= 1000 ? (v/1000)+'k' : v} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatRp(v)} />
              <Bar dataKey="revenue" fill="#E8A838" radius={[4,4,0,0]} name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent orders */}
        <div className="card">
          <div className="flex-between mb-1">
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>🕐 Order Terbaru</h3>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/rekap-order')}>Semua</button>
          </div>
          {recentOrders.length === 0 ? (
            <div className="empty-state"><p>Belum ada order hari ini</p></div>
          ) : (
            recentOrders.map(o => (
              <div key={o.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{o.customer_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.gedung} · Lt {o.lantai}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{formatRp(o.total_amount)}</div>
                  <span className={`badge status-${o.status}`} style={{ fontSize: 10 }}>{o.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="card mt-2">
        <h3 style={{ marginBottom: 12, fontSize: 15, fontWeight: 700 }}>⚡ Aksi Cepat</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[
            { label: '📋 Rekap Order', path: '/rekap-order' },
            { label: '💸 Input Pengeluaran', path: '/pengeluaran' },
            { label: '📦 Cek Stok', path: '/stok' },
            { label: '📊 Laporan L/R', path: '/laporan' },
            { label: '👥 Lihat CRM', path: '/crm' },
            { label: '🍱 Kelola Menu', path: '/menu' },
          ].map(a => (
            <button key={a.path} className="btn btn-outline" onClick={() => navigate(a.path)} style={{ fontSize: 13 }}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
