import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const formatRp = (n) => 'Rp ' + Number(Math.abs(n || 0)).toLocaleString('id-ID')
const pct = (a, b) => b > 0 ? Math.min(999, Math.round((a / b) * 100)) : 0

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

// Selalu gunakan WIB (UTC+7) untuk konsistensi dengan timezone Indonesia
const toWIBDate = (isoStr) => {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000)
  return wib.toISOString().split('T')[0]
}
const todayWIB = toWIBDate(new Date().toISOString())
const today = new Date(todayWIB + 'T00:00:00')

// Motivasi berdasarkan progress
const getMotivasi = (pctRevenue, hariTersisa, hariTotal) => {
  const hariJalan = hariTotal - hariTersisa
  const expectedPct = hariTotal > 0 ? Math.round((hariJalan / hariTotal) * 100) : 0

  if (pctRevenue >= 100) return { emoji: '🏆', msg: 'LUAR BIASA! Target bulan ini sudah tercapai!', color: '#16A34A', bg: '#F0FDF4' }
  if (pctRevenue >= 80) return { emoji: '🔥', msg: 'Hampir sampai! Tinggal sedikit lagi untuk capai target!', color: '#D97706', bg: '#FFFBEB' }
  if (pctRevenue >= expectedPct) return { emoji: '✅', msg: 'On track! Kamu berjalan sesuai target. Pertahankan!', color: '#2563EB', bg: '#EFF6FF' }
  if (pctRevenue >= expectedPct - 15) return { emoji: '⚡', msg: 'Sedikit tertinggal. Tambah effort di hari-hari ini!', color: '#D97706', bg: '#FFFBEB' }
  return { emoji: '💪', msg: 'Masih jauh dari target. Perlu strategi extra untuk kejar ketertinggalan!', color: '#DC2626', bg: '#FEF2F2' }
}

// Hitung hari dalam bulan
const getDaysInMonth = (year, month) => new Date(year, month, 0).getDate()

export default function Target() {
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())
  const [target, setTarget] = useState({ target_revenue: '', target_orders: '', target_profit: '', notes: '' })
  const [savedTarget, setSavedTarget] = useState(null)
  const [actual, setActual] = useState({ revenue: 0, orders: 0, expense: 0, hpp: 0, profit: 0 })
  const [dailyData, setDailyData] = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [historyData, setHistoryData] = useState([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const from = `${year}-${String(month).padStart(2,'0')}-01`
    const lastDay = getDaysInMonth(year, month)
    const to = `${year}-${String(month).padStart(2,'0')}-${lastDay}`

    const [targetRes, ordersRes, expRes, itemsRes, histRes, productsRes] = await Promise.all([
      supabase.from('monthly_targets').select('*').eq('month', month).eq('year', year).maybeSingle(),
      supabase.from('orders').select('*').or(`and(delivery_date.gte.${from},delivery_date.lte.${to}),and(delivery_date.is.null,created_at.gte.${from}T00:00:00+07:00,created_at.lte.${to}T23:59:59+07:00)`),
      supabase.from('expenses').select('*').gte('expense_date', from).lte('expense_date', to),
      supabase.from('order_items').select('*, orders!inner(created_at,delivery_date,status)').or(`and(orders.delivery_date.gte.${from},orders.delivery_date.lte.${to}),and(orders.delivery_date.is.null,orders.created_at.gte.${from}T00:00:00+07:00,orders.created_at.lte.${to}T23:59:59+07:00)`),
      supabase.from('orders').select('created_at, delivery_date, total_amount, status').gte('created_at', `${year}-01-01T00:00:00+07:00`).lte('created_at', to + 'T23:59:59+07:00'),
      supabase.from('products').select('id, hpp'),
    ])

    // Target
    if (targetRes.data) {
      setSavedTarget(targetRes.data)
      setTarget({
        target_revenue: targetRes.data.target_revenue,
        target_orders: targetRes.data.target_orders,
        target_profit: targetRes.data.target_profit,
        notes: targetRes.data.notes || ''
      })
    } else {
      setSavedTarget(null)
      setTarget({ target_revenue: '', target_orders: '', target_profit: '', notes: '' })
    }

    // Actual
    const validOrders = (ordersRes.data || []).filter(o => o.status !== 'Batal')
    const totalRevenue = validOrders.reduce((s, o) => s + o.total_amount, 0)
    const totalExpense = (expRes.data || []).reduce((s, e) => s + e.amount, 0)

    // Hitung HPP dari order items × hpp per produk
    const prodMap = {}
    ;(productsRes.data || []).forEach(p => { prodMap[p.id] = p.hpp || 0 })
    const totalHPP = (itemsRes.data || [])
      .filter(i => i.orders?.status !== 'Batal')
      .reduce((s, i) => s + (prodMap[i.product_id] || 0) * (i.quantity || 0), 0)

    // Laba Bersih = Omset - HPP - Pengeluaran Operasional
    const totalProfit = totalRevenue - totalHPP - totalExpense

    setActual({
      revenue: totalRevenue,
      orders: validOrders.length,
      expense: totalExpense,
      hpp: totalHPP,
      profit: totalProfit,
    })

    // Daily data untuk chart
    const days = []
    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      const dayOrders = validOrders.filter(o => {
        const tgl = o.delivery_date || toWIBDate(o.created_at)
        return tgl === dateStr
      })
      days.push({
        date: dateStr, day: d,
        revenue: dayOrders.reduce((s, o) => s + o.total_amount, 0),
        orders: dayOrders.length,
      })
    }
    setDailyData(days)

    // Top products
    const pm = {}
    ;(itemsRes.data || []).filter(i => i.orders?.status !== 'Batal').forEach(i => {
      if (!pm[i.product_name]) pm[i.product_name] = { qty: 0, revenue: 0 }
      pm[i.product_name].qty += i.quantity || 0
      pm[i.product_name].revenue += i.subtotal || 0
    })
    setTopProducts(Object.entries(pm).map(([name, d]) => ({ name, ...d })).sort((a,b) => b.revenue - a.revenue).slice(0, 5))

    // History per bulan
    const monthlyRevenue = {}
    ;(histRes.data || []).filter(o => o.status !== 'Batal').forEach(o => {
      const tgl = o.delivery_date || toWIBDate(o.created_at)
      const m = tgl?.slice(0, 7)
      if (m) monthlyRevenue[m] = (monthlyRevenue[m] || 0) + o.total_amount
    })
    setHistoryData(Object.entries(monthlyRevenue).sort())

    setLoading(false)
  }, [month, year])

  useEffect(() => { fetchData() }, [fetchData])

  const save = async () => {
    if (!target.target_revenue) return alert('Target pendapatan wajib diisi!')
    setSaving(true)
    await supabase.from('monthly_targets').upsert({
      month, year,
      target_revenue: parseInt(target.target_revenue) || 0,
      target_orders: parseInt(target.target_orders) || 0,
      target_profit: parseInt(target.target_profit) || 0,
      notes: target.notes,
    }, { onConflict: 'month,year' })
    await fetchData()
    setSaving(false)
    setEditMode(false)
  }

  // Kalkulasi
  const tRevenue = parseInt(savedTarget?.target_revenue) || 0
  const tOrders  = parseInt(savedTarget?.target_orders)  || 0
  const tProfit  = parseInt(savedTarget?.target_profit)  || 0

  const pRevenue = pct(actual.revenue, tRevenue)
  const pOrders  = pct(actual.orders,  tOrders)
  const pProfit  = pct(actual.profit,  tProfit)

  const isCurrentMonth = month === today.getMonth() + 1 && year === today.getFullYear()
  const hariTotal    = getDaysInMonth(year, month)
  const todayDateWIB = parseInt(todayWIB.split('-')[2])
  const hariJalan    = isCurrentMonth ? todayDateWIB : hariTotal
  const hariTersisa  = isCurrentMonth ? hariTotal - todayDateWIB : 0
  const motivasi     = getMotivasi(pRevenue, hariTersisa, hariTotal)

  // Proyeksi
  const revenuePerHari = hariJalan > 0 ? actual.revenue / hariJalan : 0
  const proyeksiRevenue = Math.round(revenuePerHari * hariTotal)
  const sisaTarget     = Math.max(0, tRevenue - actual.revenue)
  const targetPerHari  = hariTersisa > 0 ? Math.ceil(sisaTarget / hariTersisa) : 0

  // Rata-rata order per hari
  const avgOrderPerDay = hariJalan > 0 ? (actual.orders / hariJalan).toFixed(1) : 0
  const avgRevenuePerOrder = actual.orders > 0 ? Math.round(actual.revenue / actual.orders) : 0

  // Saran berdasarkan data
  const getSaran = () => {
    const saranList = []
    if (pRevenue < 50 && hariTersisa < 10) saranList.push({ icon: '🚨', text: `Waktu tersisa ${hariTersisa} hari, target masih ${pRevenue}%. Perlu promosi agresif atau tambah jam operasional.`, type: 'danger' })
    if (targetPerHari > revenuePerHari * 1.5 && hariTersisa > 0) saranList.push({ icon: '📢', text: `Perlu tambah Rp ${formatRp(targetPerHari)}/hari untuk kejar target. Coba promosi atau diskon bundle.`, type: 'warning' })
    if ((actual.expense + actual.hpp) > actual.revenue && actual.revenue > 0) saranList.push({ icon: '✂️', text: 'Total biaya (HPP + operasional) lebih besar dari omset. Evaluasi harga jual atau kurangi biaya.', type: 'danger' })
    if (topProducts[0] && topProducts[0].revenue / actual.revenue > 0.5) saranList.push({ icon: '⭐', text: `${topProducts[0].name} menyumbang >50% revenue. Pastikan stoknya selalu ada!`, type: 'info' })
    if (avgRevenuePerOrder < 20000) saranList.push({ icon: '💡', text: 'Rata-rata order masih kecil. Coba tambahkan paket bundling atau up-selling.', type: 'info' })
    if (pRevenue >= 100) saranList.push({ icon: '🎯', text: 'Target tercapai! Pertimbangkan naikkan target bulan depan untuk terus bertumbuh.', type: 'success' })
    if (proyeksiRevenue > tRevenue * 1.2) saranList.push({ icon: '🚀', text: `Proyeksi revenue bulan ini ${formatRp(proyeksiRevenue)} — melebihi target! Momentum bagus untuk expand.`, type: 'success' })
    if (saranList.length === 0) saranList.push({ icon: '👍', text: 'Performa bulan ini berjalan normal. Tetap konsisten dan pantau setiap hari!', type: 'info' })
    return saranList
  }

  const maxRevenue = Math.max(...dailyData.map(d => d.revenue), 1)

  return (
    <div>
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: '1.25rem', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>🎯 Target Bulanan</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Monitor & strategi pencapaian target Kedai MangLeman</p>
        </div>
        {/* Period selector */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
            style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {[2025,2026,2027].map(y => <option key={y}>{y}</option>)}
          </select>
          <button onClick={() => setEditMode(true)} className="btn btn-primary">
            {savedTarget ? '✏️ Edit Target' : '+ Set Target'}
          </button>
        </div>
      </div>

      {loading ? <div className="loading"><div className="spinner" /><span>Memuat data...</span></div> : (
        <>
          {/* Set target modal */}
          {editMode && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div className="card" style={{ width: '100%', maxWidth: 480 }}>
                <div className="flex-between mb-2">
                  <h3 style={{ fontWeight: 700 }}>🎯 Set Target {MONTHS[month-1]} {year}</h3>
                  <button onClick={() => setEditMode(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>✕</button>
                </div>

                <div className="alert alert-info mb-2" style={{ fontSize: 12 }}>
                  💡 Target yang realistis = target bulan lalu × 1.1 sampai 1.2 (naik 10-20%)
                </div>

                {[
                  { key: 'target_revenue', label: '💰 Target Pendapatan (Rp)', placeholder: 'Cth: 5000000', hint: 'Total penjualan yang ingin dicapai' },
                  { key: 'target_orders', label: '📦 Target Jumlah Order', placeholder: 'Cth: 150', hint: 'Berapa order yang ingin masuk' },
                  { key: 'target_profit', label: '📈 Target Laba Bersih (Rp)', placeholder: 'Cth: 3000000', hint: 'Target keuntungan setelah semua biaya' },
                ].map(f => (
                  <div key={f.key} className="form-group">
                    <label className="form-label">{f.label}</label>
                    <input className="form-control" type="number" placeholder={f.placeholder}
                      value={target[f.key]} onChange={e => setTarget(t => ({ ...t, [f.key]: e.target.value }))} />
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{f.hint}</p>
                  </div>
                ))}

                <div className="form-group">
                  <label className="form-label">📝 Strategi / Catatan</label>
                  <textarea className="form-control" rows={3}
                    placeholder="Cth: Tambah menu baru, promo launching, target gedung baru..."
                    value={target.notes} onChange={e => setTarget(t => ({ ...t, notes: e.target.value }))} />
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setEditMode(false)}>Batal</button>
                  <button className="btn btn-primary" style={{ flex: 2 }} onClick={save} disabled={saving}>
                    {saving ? '⏳ Menyimpan...' : '💾 Simpan Target'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* No target state */}
          {!savedTarget ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>🎯</div>
              <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Belum Ada Target {MONTHS[month-1]} {year}</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 14 }}>Set target sekarang untuk mulai memantau performa bisnis kamu!</p>
              <button className="btn btn-primary" onClick={() => setEditMode(true)}>+ Set Target Sekarang</button>
            </div>
          ) : (
            <>
              {/* Motivasi Banner */}
              <div style={{ background: motivasi.bg, border: `1.5px solid ${motivasi.color}33`, borderRadius: 14, padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 36 }}>{motivasi.emoji}</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: motivasi.color }}>{motivasi.msg}</div>
                  {isCurrentMonth && (
                    <div style={{ fontSize: 13, color: motivasi.color, opacity: 0.8, marginTop: 2 }}>
                      Hari ke-{hariJalan} dari {hariTotal} hari · {hariTersisa} hari tersisa
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Cards */}
              <div className="grid-3 mb-2">
                {[
                  {
                    label: 'Pendapatan', icon: '💰',
                    actual: formatRp(actual.revenue), target: formatRp(tRevenue),
                    pct: pRevenue, color: pRevenue >= 100 ? '#16A34A' : pRevenue >= 70 ? '#D97706' : '#DC2626',
                    sub: tRevenue > 0 ? `Sisa ${formatRp(Math.max(0, tRevenue - actual.revenue))}` : '-'
                  },
                  {
                    label: 'Jumlah Order', icon: '📦',
                    actual: actual.orders + ' order', target: tOrders + ' order',
                    pct: pOrders, color: pOrders >= 100 ? '#16A34A' : pOrders >= 70 ? '#D97706' : '#DC2626',
                    sub: tOrders > 0 ? `Sisa ${Math.max(0, tOrders - actual.orders)} order` : '-'
                  },
                  {
                    label: 'Laba Bersih', icon: '📈',
                    actual: formatRp(actual.profit), target: formatRp(tProfit),
                    pct: pProfit, color: pProfit >= 100 ? '#16A34A' : pProfit >= 70 ? '#D97706' : '#DC2626',
                    sub: actual.profit < 0 ? '⚠️ Sedang Rugi' : `Margin ${actual.revenue > 0 ? ((actual.profit/actual.revenue)*100).toFixed(0) : 0}%`
                  },
                ].map((s, i) => (
                  <div key={i} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{s.icon} {s.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.actual}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Target: {s.target}</div>
                      </div>
                      <div style={{ width: 52, height: 52, borderRadius: '50%', background: s.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.pct}%</span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div style={{ background: '#F0F0F0', borderRadius: 20, height: 8, overflow: 'hidden', marginBottom: 6 }}>
                      <div style={{ width: Math.min(100, s.pct) + '%', background: s.color, height: '100%', borderRadius: 20, transition: 'width 0.8s ease' }} />
                    </div>
                    <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              <div className="grid-2 mb-2">
                {/* Proyeksi & KPI */}
                <div className="card">
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>🔮 Proyeksi & Insight</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    {[
                      { label: 'Revenue/Hari', value: formatRp(Math.round(revenuePerHari)), color: '#2563EB' },
                      { label: 'Proyeksi Bulan Ini', value: formatRp(proyeksiRevenue), color: proyeksiRevenue >= tRevenue ? '#16A34A' : '#DC2626' },
                      { label: 'Avg/Order', value: formatRp(avgRevenuePerOrder), color: '#1A1A1A' },
                      { label: 'Order/Hari', value: avgOrderPerDay, color: '#1A1A1A' },
                    ].map((k, i) => (
                      <div key={i} style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: k.color }}>{k.value}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{k.label}</div>
                      </div>
                    ))}
                  </div>

                  {isCurrentMonth && tRevenue > 0 && hariTersisa > 0 && (
                    <div style={{ background: '#EFF6FF', borderRadius: 10, padding: '12px', border: '1px solid #BFDBFE' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#1D4ED8', marginBottom: 6 }}>📌 Target Harian Sisa Bulan</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#1D4ED8' }}>{formatRp(targetPerHari)}/hari</div>
                      <div style={{ fontSize: 12, color: '#1D4ED8', opacity: 0.8, marginTop: 2 }}>
                        Perlu {formatRp(sisaTarget)} lagi dalam {hariTersisa} hari
                      </div>
                    </div>
                  )}

                  {savedTarget?.notes && (
                    <div style={{ marginTop: 12, background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', borderLeft: '3px solid var(--primary)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>📝 STRATEGI BULAN INI</div>
                      <div style={{ fontSize: 13, color: 'var(--text)' }}>{savedTarget.notes}</div>
                    </div>
                  )}
                </div>

                {/* Top produk */}
                <div className="card">
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>🏆 Top Produk Bulan Ini</div>
                  {topProducts.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Belum ada data penjualan</p>
                  ) : topProducts.map((p, i) => (
                    <div key={p.name} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ width: 22, height: 22, borderRadius: '50%', background: i === 0 ? '#F59E0B' : i === 1 ? '#9CA3AF' : i === 2 ? '#D97706' : '#E5E7EB', color: i < 3 ? '#fff' : '#555', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i+1}</span>
                          <span style={{ fontWeight: 600 }}>{p.name}</span>
                        </div>
                        <span style={{ fontWeight: 700, color: '#16A34A' }}>{formatRp(p.revenue)}</span>
                      </div>
                      <div style={{ background: '#F0F0F0', borderRadius: 20, height: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${actual.revenue > 0 ? (p.revenue/actual.revenue)*100 : 0}%`, background: i === 0 ? '#F59E0B' : '#E8A838', height: '100%', borderRadius: 20 }} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.qty} terjual · {actual.revenue > 0 ? ((p.revenue/actual.revenue)*100).toFixed(0) : 0}% dari revenue</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart harian */}
              <div className="card mb-2">
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>📅 Revenue Harian — {MONTHS[month-1]} {year}</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 100, overflowX: 'auto', paddingBottom: 4 }}>
                  {dailyData.map((d, i) => {
                    const h = maxRevenue > 0 ? Math.max(4, (d.revenue / maxRevenue) * 90) : 4
                    const isToday = isCurrentMonth && d.day === todayDateWIB
                    return (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 18 }} title={`${d.date}: ${formatRp(d.revenue)}`}>
                        <div style={{ width: '100%', height: h, background: isToday ? '#E8A838' : d.revenue > 0 ? '#1A2E0A' : '#E5E5E5', borderRadius: '3px 3px 0 0', transition: 'height 0.5s', cursor: 'pointer', position: 'relative' }}>
                          {isToday && <div style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', fontSize: 8, color: '#E8A838', fontWeight: 700, whiteSpace: 'nowrap' }}>HARI INI</div>}
                        </div>
                        {d.day % 5 === 0 || d.day === 1 ? <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{d.day}</div> : <div style={{ height: 13 }} />}
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>⬛ Ada penjualan</span>
                  <span style={{ color: '#E8A838' }}>🟧 Hari ini</span>
                  <span>⬜ Tidak ada penjualan</span>
                  <span style={{ marginLeft: 'auto' }}>Max: {formatRp(maxRevenue)}/hari</span>
                </div>
              </div>

              {/* History bulanan */}
              {historyData.length > 1 && (
                <div className="card mb-2">
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>📊 Tren Revenue {year}</div>
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
                    {historyData.map(([m, rev], i) => {
                      const mNum = parseInt(m.split('-')[1])
                      const maxRev = Math.max(...historyData.map(([,v]) => v), 1)
                      const h = Math.max(20, (rev / maxRev) * 80)
                      const isCurrent = m === `${year}-${String(month).padStart(2,'0')}`
                      return (
                        <div key={m} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 50 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#16A34A', marginBottom: 4 }}>
                            {rev >= 1000000 ? (rev/1000000).toFixed(1)+'jt' : (rev/1000).toFixed(0)+'rb'}
                          </div>
                          <div style={{ width: '100%', height: h, background: isCurrent ? '#E8A838' : '#1A2E0A', borderRadius: '4px 4px 0 0', opacity: isCurrent ? 1 : 0.6 }} />
                          <div style={{ fontSize: 10, color: isCurrent ? '#E8A838' : 'var(--text-muted)', fontWeight: isCurrent ? 700 : 400, marginTop: 3 }}>
                            {MONTHS_SHORT[mNum-1]}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Saran */}
              <div className="card">
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>💡 Saran & Rekomendasi</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {getSaran().map((s, i) => (
                    <div key={i} className={`alert alert-${s.type}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13 }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{s.icon}</span>
                      <span>{s.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
