import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const formatRp = (n) => {
  const num = Math.abs(Number(n || 0))
  return 'Rp ' + num.toLocaleString('id-ID')
}
const fmtDate = (d) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
const fmtShort = (d) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })

const today = () => new Date().toISOString().split('T')[0]
const thisMonth = () => {
  const n = new Date()
  return {
    from: `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`,
    to: today()
  }
}

// Warna status
const profitColor = (n) => n >= 0 ? '#16A34A' : '#DC2626'
const profitBg   = (n) => n >= 0 ? '#F0FDF4' : '#FEF2F2'
const profitIcon = (n) => n >= 0 ? '📈' : '📉'

const TAB_LABELS = {
  labarugi: 'Laporan Laba Rugi',
  neraca: 'Neraca Sederhana',
  aruskas: 'Laporan Arus Kas',
  catatan: 'Catatan atas Laporan Keuangan (CaLK)',
}

export default function LaporanLabaRugi() {
  const [activeTab, setActiveTab] = useState('labarugi')
  const [periodMode, setPeriodMode] = useState('bulan')
  const [dateFrom, setDateFrom] = useState(thisMonth().from)
  const [dateTo, setDateTo] = useState(thisMonth().to)
  const [selectedMonth, setSelectedMonth] = useState(today().slice(0,7))
  const [loading, setLoading] = useState(false)
  const printRef = useRef(null)

  // Data
  const [revenue, setRevenue] = useState(0)
  const [hpp, setHpp] = useState(0)
  const [expenses, setExpenses] = useState([])
  const [orders, setOrders] = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [cashIn, setCashIn] = useState([])
  const [cashOut, setCashOut] = useState([])

  const getRange = useCallback(() => {
    if (periodMode === 'bulan') {
      const [y, m] = selectedMonth.split('-')
      const lastDay = new Date(y, m, 0).getDate()
      return { from: `${selectedMonth}-01`, to: `${selectedMonth}-${lastDay}` }
    }
    return { from: dateFrom, to: dateTo }
  }, [periodMode, selectedMonth, dateFrom, dateTo])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { from, to } = getRange()
    const fromDt = from + 'T00:00:00+07:00'
    const toDt   = to   + 'T23:59:59+07:00'

    const [ordersRes, itemsRes, expRes, productsRes] = await Promise.all([
      supabase.from('orders').select('*').gte('created_at', fromDt).lte('created_at', toDt),
      supabase.from('order_items').select('*, orders!inner(created_at, status)').gte('orders.created_at', fromDt).lte('orders.created_at', toDt),
      supabase.from('expenses').select('*').gte('expense_date', from).lte('expense_date', to),
      supabase.from('products').select('id, name, hpp, price'),
    ])

    const validOrders = (ordersRes.data || []).filter(o => o.status !== 'Batal')
    const totalRevenue = validOrders.reduce((s, o) => s + (o.total_amount || 0), 0)

    // HPP = sum(qty * hpp per produk)
    const prodMap = {}
    ;(productsRes.data || []).forEach(p => { prodMap[p.id] = p })
    const totalHPP = (itemsRes.data || [])
      .filter(i => i.orders?.status !== 'Batal')
      .reduce((s, i) => {
        const prod = prodMap[i.product_id]
        return s + (prod?.hpp || 0) * (i.quantity || 0)
      }, 0)

    // Top produk
    const pm = {}
    ;(itemsRes.data || []).filter(i => i.orders?.status !== 'Batal').forEach(i => {
      if (!pm[i.product_name]) pm[i.product_name] = { qty: 0, revenue: 0 }
      pm[i.product_name].qty += i.quantity || 0
      pm[i.product_name].revenue += i.subtotal || 0
    })
    const top = Object.entries(pm).map(([name, d]) => ({ name, ...d })).sort((a,b) => b.revenue - a.revenue).slice(0,8)

    // Expenses by category
    const expData = expRes.data || []

    // Arus kas
    const dailyCashIn = {}
    validOrders.forEach(o => {
      const day = o.created_at?.slice(0,10)
      if (day) dailyCashIn[day] = (dailyCashIn[day] || 0) + o.total_amount
    })
    const dailyCashOut = {}
    expData.forEach(e => {
      dailyCashOut[e.expense_date] = (dailyCashOut[e.expense_date] || 0) + e.amount
    })

    setRevenue(totalRevenue)
    setHpp(totalHPP)
    setExpenses(expData)
    setOrders(validOrders)
    setTopProducts(top)
    setCashIn(Object.entries(dailyCashIn).sort())
    setCashOut(Object.entries(dailyCashOut).sort())
    setLoading(false)
  }, [getRange])

  useEffect(() => { fetchData() }, [fetchData])

  // Kalkulasi
  const labaKotor   = revenue - hpp
  const totalBeban  = expenses.reduce((s,e) => s + e.amount, 0)
  const labaBersih  = labaKotor - totalBeban
  const marginKotor = revenue > 0 ? ((labaKotor / revenue) * 100).toFixed(1) : 0
  const marginBersih= revenue > 0 ? ((labaBersih / revenue) * 100).toFixed(1) : 0

  // Beban per kategori
  const bebanByKat = {}
  expenses.forEach(e => { bebanByKat[e.category] = (bebanByKat[e.category] || 0) + e.amount })

  // Arus kas
  const totalCashIn  = cashIn.reduce((s,[,v]) => s+v, 0)
  const totalCashOut = cashOut.reduce((s,[,v]) => s+v, 0)
  const netCash      = totalCashIn - totalCashOut

  const { from, to } = getRange()
  const periodLabel = periodMode === 'bulan'
    ? new Date(selectedMonth+'-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
    : `${fmtDate(from)} — ${fmtDate(to)}`

  const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  const years = [2025, 2026, 2027]

  // ── UI ──────────────────────────────────────────────────────
  const handlePrint = () => {
    const el = printRef.current
    if (!el) return
    const tabLabel = TAB_LABELS[activeTab] || 'Laporan Keuangan'
    const win = window.open('', '_blank')
    win.document.write(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>${tabLabel} - Kedai MangLeman - ${periodLabel}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 13px; color: #1A1A1A; padding: 20px; }
          .print-header { text-align: center; border-bottom: 2px solid #1A2E0A; padding-bottom: 12px; margin-bottom: 20px; }
          .print-header h1 { font-size: 20px; color: #1A2E0A; margin-bottom: 4px; }
          .print-header h2 { font-size: 15px; color: #555; font-weight: normal; margin-bottom: 2px; }
          .print-header p { font-size: 12px; color: #888; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
          .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
          .card { border: 1px solid #E5E5E5; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
          .kpi { background: #F8F8F8; border-radius: 8px; padding: 10px; text-align: center; }
          .kpi-label { font-size: 10px; color: #888; text-transform: uppercase; margin-bottom: 4px; }
          .kpi-value { font-size: 16px; font-weight: bold; }
          .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; margin-top: 12px; }
          .row { display: flex; justify-content: space-between; padding: 4px 8px; font-size: 13px; }
          .row.total { font-weight: bold; border-top: 1px solid #E5E5E5; margin-top: 4px; padding-top: 6px; }
          .row.highlight { background: #F0FDF4; border-radius: 6px; font-size: 15px; font-weight: bold; padding: 8px; margin: 8px 0; }
          .row.highlight.loss { background: #FEF2F2; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
          th { background: #F0F0F0; padding: 6px 8px; text-align: left; font-size: 11px; }
          td { padding: 5px 8px; border-bottom: 1px solid #F0F0F0; }
          .footer { margin-top: 30px; border-top: 1px solid #E5E5E5; padding-top: 10px; font-size: 11px; color: #888; text-align: center; }
          @media print {
            body { padding: 10px; }
            @page { margin: 1cm; }
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <h1>🍱 Kedai MangLeman</h1>
          <h2>${tabLabel}</h2>
          <p>Periode: ${periodLabel}</p>
          <p>Dicetak: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        ${el.innerHTML}
        <div class="footer">
          Laporan ini digenerate otomatis oleh Sistem Kedai MangLeman &bull; Rahasia &amp; Konfidensial
        </div>
      </body>
      </html>
    `)
    win.document.close()
    setTimeout(() => { win.print() }, 500)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A1A', marginBottom: 2 }}>
            📊 Laporan Keuangan
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Kedai MangLeman · {periodLabel}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handlePrint}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#1A2E0A', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            🖨️ Print / Download PDF
          </button>
        </div>
      </div>

      {/* Period picker */}
      <div className="card mb-2" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: 8, padding: 3, gap: 3 }}>
            {[['bulan','📅 Per Bulan'],['custom','🗓 Custom']].map(([k,l]) => (
              <button key={k} onClick={() => setPeriodMode(k)}
                style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: periodMode===k ? '#1A2E0A' : 'transparent', color: periodMode===k ? '#fff' : 'var(--text)', transition: 'all 0.15s' }}>
                {l}
              </button>
            ))}
          </div>

          {periodMode === 'bulan' && (
            <div style={{ display: 'flex', gap: 6 }}>
              {MONTHS.map((m, i) => {
                const val = `${selectedMonth.slice(0,4)}-${String(i+1).padStart(2,'0')}`
                const active = selectedMonth === val
                return (
                  <button key={m} onClick={() => setSelectedMonth(val)}
                    style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, fontWeight: active ? 700 : 400, background: active ? '#E8A838' : '#fff', color: active ? '#fff' : 'var(--text)' }}>
                    {m}
                  </button>
                )
              })}
              <select value={selectedMonth.slice(0,4)} onChange={e => setSelectedMonth(e.target.value+selectedMonth.slice(4))}
                style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 13 }}>
                {years.map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
          )}

          {periodMode === 'custom' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="form-control" style={{ width: 'auto' }} />
              <span style={{ color: 'var(--text-muted)' }}>s/d</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="form-control" style={{ width: 'auto' }} />
            </div>
          )}

          <button onClick={fetchData} className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }}>🔄 Refresh</button>
        </div>
      </div>

      {/* Print area */}
      <div ref={printRef}>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg)', padding: 4, borderRadius: 10, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {[
          ['labarugi', '📋 Laba Rugi'],
          ['neraca', '⚖️ Neraca'],
          ['aruskas', '💵 Arus Kas'],
          ['catatan', '📝 CaLK'],
        ].map(([k,l]) => (
          <button key={k} onClick={() => setActiveTab(k)}
            style={{ flex: 1, minWidth: 100, padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeTab===k ? 700 : 400, background: activeTab===k ? '#fff' : 'transparent', color: activeTab===k ? '#1A1A1A' : 'var(--text-muted)', boxShadow: activeTab===k ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
            {l}
          </button>
        ))}
      </div>

      {loading ? <div className="loading"><div className="spinner" /><span>Memuat laporan...</span></div> : (
        <>
          {/* ═══════════════════════════════════════════════════
              TAB 1: LABA RUGI
          ═══════════════════════════════════════════════════ */}
          {activeTab === 'labarugi' && (
            <div>
              {/* KPI cards */}
              <div className="grid-4 mb-2">
                {[
                  { label: 'Total Pendapatan', value: formatRp(revenue), icon: '💰', color: '#16A34A', bg: '#F0FDF4', sub: `${orders.length} transaksi` },
                  { label: 'HPP', value: formatRp(hpp), icon: '🏭', color: '#D97706', bg: '#FFFBEB', sub: `${marginKotor}% dari revenue` },
                  { label: 'Laba Kotor', value: formatRp(labaKotor), icon: '📊', color: profitColor(labaKotor), bg: profitBg(labaKotor), sub: `Margin ${marginKotor}%` },
                  { label: 'Laba Bersih', value: formatRp(labaBersih), icon: profitIcon(labaBersih), color: profitColor(labaBersih), bg: profitBg(labaBersih), sub: `Margin ${marginBersih}%` },
                ].map((s, i) => (
                  <div key={i} style={{ background: s.bg, borderRadius: 12, padding: '1.25rem', border: `1px solid ${s.color}22` }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>{s.icon}</div>
                    <div style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: s.color, marginBottom: 2 }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              <div className="grid-2">
                {/* Laporan Laba Rugi Formal */}
                <div className="card">
                  <div style={{ borderBottom: '2px solid #1A2E0A', paddingBottom: 12, marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Laporan</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: '#1A2E0A' }}>Laba Rugi</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{periodLabel}</div>
                  </div>

                  {/* Pendapatan */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>I. PENDAPATAN</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 8px', background: '#F8FFF8', borderRadius: 4 }}>
                      <span>Penjualan Produk</span>
                      <span style={{ fontWeight: 600 }}>{formatRp(revenue)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, padding: '6px 8px', borderTop: '1px solid #E5E5E5', marginTop: 4 }}>
                      <span>Total Pendapatan</span>
                      <span style={{ color: '#16A34A' }}>{formatRp(revenue)}</span>
                    </div>
                  </div>

                  {/* HPP */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>II. HARGA POKOK PENJUALAN</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 8px', background: '#FFFBEB', borderRadius: 4 }}>
                      <span>HPP Produk Terjual</span>
                      <span style={{ fontWeight: 600, color: '#D97706' }}>({formatRp(hpp)})</span>
                    </div>
                  </div>

                  {/* Laba Kotor */}
                  <div style={{ background: labaKotor >= 0 ? '#F0FDF4' : '#FEF2F2', borderRadius: 8, padding: '10px 12px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15 }}>
                    <span>LABA KOTOR</span>
                    <span style={{ color: profitColor(labaKotor) }}>{labaKotor < 0 ? '(' : ''}{formatRp(labaKotor)}{labaKotor < 0 ? ')' : ''}</span>
                  </div>

                  {/* Beban Operasional */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>III. BEBAN OPERASIONAL</div>
                    {Object.entries(bebanByKat).map(([kat, total]) => (
                      <div key={kat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 8px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{kat}</span>
                        <span style={{ color: '#DC2626' }}>({formatRp(total)})</span>
                      </div>
                    ))}
                    {Object.keys(bebanByKat).length === 0 && (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '3px 8px' }}>Belum ada beban operasional</div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, padding: '6px 8px', borderTop: '1px solid #E5E5E5', marginTop: 4 }}>
                      <span>Total Beban</span>
                      <span style={{ color: '#DC2626' }}>({formatRp(totalBeban)})</span>
                    </div>
                  </div>

                  {/* Laba Bersih */}
                  <div style={{ background: profitBg(labaBersih), border: `2px solid ${profitColor(labaBersih)}44`, borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 17 }}>
                    <span style={{ color: profitColor(labaBersih) }}>LABA BERSIH</span>
                    <span style={{ color: profitColor(labaBersih) }}>{labaBersih < 0 ? '(' : ''}{formatRp(labaBersih)}{labaBersih < 0 ? ')' : ''}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', marginTop: 6 }}>
                    Margin Bersih: {marginBersih}%
                  </div>
                </div>

                {/* Top Produk */}
                <div>
                  <div className="card mb-2">
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>🏆 Produk Terlaris</div>
                    {topProducts.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Belum ada data</p>
                    ) : topProducts.map((p, i) => (
                      <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < topProducts.length-1 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: i < 3 ? '#E8A838' : '#F0F0F0', color: i < 3 ? '#fff' : '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {i+1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.qty} terjual</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#16A34A' }}>{formatRp(p.revenue)}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{revenue > 0 ? ((p.revenue/revenue)*100).toFixed(0) : 0}% revenue</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Beban chart */}
                  <div className="card">
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>💸 Komposisi Beban</div>
                    {Object.entries(bebanByKat).length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Belum ada beban</p>
                    ) : Object.entries(bebanByKat).sort((a,b) => b[1]-a[1]).map(([kat, total]) => (
                      <div key={kat} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                          <span>{kat}</span>
                          <span style={{ fontWeight: 600 }}>{formatRp(total)} ({totalBeban > 0 ? ((total/totalBeban)*100).toFixed(0) : 0}%)</span>
                        </div>
                        <div style={{ background: '#F0F0F0', borderRadius: 20, height: 8, overflow: 'hidden' }}>
                          <div style={{ width: `${totalBeban > 0 ? (total/totalBeban)*100 : 0}%`, background: '#DC2626', height: '100%', borderRadius: 20, transition: 'width 0.5s' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════
              TAB 2: NERACA
          ═══════════════════════════════════════════════════ */}
          {activeTab === 'neraca' && (
            <div className="grid-2">
              {/* Aset */}
              <div className="card">
                <div style={{ borderBottom: '2px solid #1A2E0A', paddingBottom: 10, marginBottom: 14 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#1A2E0A' }}>⚖️ Neraca Sederhana</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{periodLabel}</div>
                </div>

                <div style={{ fontSize: 12, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>ASET (Harta)</div>

                <div style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Aset Lancar</div>
                  {[
                    { label: 'Kas & Pendapatan (periode ini)', val: revenue },
                    { label: 'Piutang Usaha', val: 0, note: 'Cash basis' },
                  ].map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 8px', background: '#F8FFF8', borderRadius: 4, marginBottom: 2 }}>
                      <span>{r.label}{r.note && <span style={{ color: '#aaa', fontSize: 10 }}> ({r.note})</span>}</span>
                      <span style={{ fontWeight: 600 }}>{formatRp(r.val)}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15, padding: '8px', background: '#F0FDF4', borderRadius: 8, marginTop: 8 }}>
                  <span style={{ color: '#16A34A' }}>TOTAL ASET</span>
                  <span style={{ color: '#16A34A' }}>{formatRp(revenue)}</span>
                </div>
              </div>

              {/* Kewajiban & Modal */}
              <div className="card">
                <div style={{ height: 50 }} />
                <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>KEWAJIBAN & MODAL</div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Kewajiban (Hutang)</div>
                  {[
                    { label: 'HPP / Modal Produksi', val: hpp },
                    { label: 'Beban Operasional', val: totalBeban },
                  ].map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 8px', background: '#FEF2F2', borderRadius: 4, marginBottom: 2 }}>
                      <span>{r.label}</span>
                      <span style={{ fontWeight: 600, color: '#DC2626' }}>({formatRp(r.val)})</span>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Modal / Ekuitas</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 8px', background: '#F0FDF4', borderRadius: 4 }}>
                    <span>Laba Bersih Periode Ini</span>
                    <span style={{ fontWeight: 600, color: profitColor(labaBersih) }}>{formatRp(labaBersih)}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15, padding: '8px', background: '#F0FDF4', borderRadius: 8, marginTop: 8 }}>
                  <span style={{ color: '#16A34A' }}>TOTAL K+M</span>
                  <span style={{ color: '#16A34A' }}>{formatRp(revenue)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════
              TAB 3: ARUS KAS
          ═══════════════════════════════════════════════════ */}
          {activeTab === 'aruskas' && (
            <div>
              {/* Summary */}
              <div className="grid-3 mb-2">
                {[
                  { label: 'Kas Masuk', value: formatRp(totalCashIn), color: '#16A34A', bg: '#F0FDF4', icon: '⬆️' },
                  { label: 'Kas Keluar', value: formatRp(totalCashOut), color: '#DC2626', bg: '#FEF2F2', icon: '⬇️' },
                  { label: 'Net Cash Flow', value: formatRp(netCash), color: profitColor(netCash), bg: profitBg(netCash), icon: profitIcon(netCash) },
                ].map((s, i) => (
                  <div key={i} style={{ background: s.bg, borderRadius: 12, padding: '1.25rem', border: `1px solid ${s.color}22`, textAlign: 'center' }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>{s.icon}</div>
                    <div style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              <div className="grid-2">
                {/* Kas Masuk */}
                <div className="card">
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#16A34A', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                    <span>⬆️ Arus Kas Masuk</span>
                    <span>{formatRp(totalCashIn)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>Dari Kegiatan Operasi (Penjualan)</div>
                  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    {cashIn.map(([date, val]) => (
                      <div key={date} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{fmtShort(date)}</span>
                        <span style={{ fontWeight: 600, color: '#16A34A' }}>{formatRp(val)}</span>
                      </div>
                    ))}
                    {cashIn.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Tidak ada data</p>}
                  </div>
                </div>

                {/* Kas Keluar */}
                <div className="card">
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#DC2626', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                    <span>⬇️ Arus Kas Keluar</span>
                    <span>{formatRp(totalCashOut)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>Dari Kegiatan Operasi (Pengeluaran)</div>
                  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    {cashOut.map(([date, val]) => (
                      <div key={date} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{fmtShort(date)}</span>
                        <span style={{ fontWeight: 600, color: '#DC2626' }}>({formatRp(val)})</span>
                      </div>
                    ))}
                    {cashOut.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Tidak ada pengeluaran</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════
              TAB 4: CaLK
          ═══════════════════════════════════════════════════ */}
          {activeTab === 'catatan' && (
            <div>
              <div className="grid-2">
                <div className="card">
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: '#1A2E0A' }}>📝 Catatan atas Laporan Keuangan</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{periodLabel}</div>

                  {[
                    {
                      no: '1',
                      title: 'Dasar Penyusunan',
                      content: 'Laporan keuangan ini disusun berdasarkan basis kas (cash basis) sesuai dengan praktik akuntansi UMKM yang berlaku. Periode pelaporan sesuai dengan filter tanggal yang dipilih.'
                    },
                    {
                      no: '2',
                      title: 'Pendapatan',
                      content: `Total pendapatan periode ini sebesar ${formatRp(revenue)} berasal dari ${orders.length} transaksi penjualan produk Kedai MangLeman. Seluruh pendapatan merupakan penjualan tunai.`
                    },
                    {
                      no: '3',
                      title: 'Harga Pokok Penjualan (HPP)',
                      content: `HPP sebesar ${formatRp(hpp)} dihitung berdasarkan HPP per produk yang telah ditetapkan di Manajemen Menu dikalikan dengan jumlah unit terjual. HPP mencakup biaya bahan baku dan kemasan.`
                    },
                    {
                      no: '4',
                      title: 'Beban Operasional',
                      content: `Total beban operasional sebesar ${formatRp(totalBeban)} terdiri dari: ${Object.entries(bebanByKat).map(([k,v]) => `${k} (${formatRp(v)})`).join(', ') || 'tidak ada beban tercatat'}.`
                    },
                    {
                      no: '5',
                      title: 'Laba/Rugi Bersih',
                      content: `${labaBersih >= 0 ? 'Laba' : 'Rugi'} bersih periode ini sebesar ${formatRp(Math.abs(labaBersih))} atau ${Math.abs(parseFloat(marginBersih)).toFixed(1)}% dari total pendapatan. ${labaBersih >= 0 ? 'Usaha dalam kondisi profitable.' : 'Perlu evaluasi efisiensi biaya.'}`
                    },
                    {
                      no: '6',
                      title: 'Asumsi & Keterbatasan',
                      content: 'Laporan ini tidak mencakup penyusutan aset tetap, pajak penghasilan, dan hutang jangka panjang. Neraca yang disajikan bersifat sederhana sesuai kebutuhan UMKM.'
                    },
                  ].map(item => (
                    <div key={item.no} style={{ marginBottom: 16, padding: '12px', background: 'var(--bg)', borderRadius: 8, borderLeft: '3px solid #E8A838' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: '#1A2E0A' }}>
                        {item.no}. {item.title}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{item.content}</div>
                    </div>
                  ))}
                </div>

                {/* Ringkasan eksekutif */}
                <div>
                  <div className="card mb-2">
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>📊 Ringkasan Eksekutif</div>
                    {[
                      { label: 'Total Transaksi', value: orders.length + ' order' },
                      { label: 'Rata-rata per Transaksi', value: formatRp(orders.length > 0 ? revenue / orders.length : 0) },
                      { label: 'Revenue per Hari', value: formatRp(Math.round(revenue / Math.max(1, Math.ceil((new Date(to) - new Date(from)) / 86400000) + 1))) },
                      { label: 'Margin Kotor', value: marginKotor + '%' },
                      { label: 'Margin Bersih', value: marginBersih + '%' },
                      { label: 'Total Beban', value: formatRp(totalBeban) },
                      { label: 'Rasio Beban/Revenue', value: revenue > 0 ? ((totalBeban/revenue)*100).toFixed(1) + '%' : '0%' },
                    ].map((s, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                        <span style={{ fontWeight: 700 }}>{s.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Rekomendasi */}
                  <div className="card">
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>💡 Rekomendasi</div>
                    {[
                      labaBersih < 0 && { type: 'danger', msg: '🔴 Usaha sedang rugi. Prioritas: tekan beban operasional atau naikkan harga jual.' },
                      parseFloat(marginBersih) < 10 && labaBersih >= 0 && { type: 'warning', msg: '🟡 Margin bersih rendah (<10%). Evaluasi HPP dan efisiensi operasional.' },
                      parseFloat(marginBersih) >= 20 && { type: 'success', msg: '🟢 Margin bersih sehat (≥20%). Pertahankan efisiensi ini.' },
                      totalBeban === 0 && { type: 'info', msg: '📝 Belum ada beban operasional tercatat. Catat pengeluaran untuk laporan yang akurat.' },
                      hpp === 0 && { type: 'info', msg: '⚙️ HPP belum diisi di Manajemen Menu. Isi HPP agar laporan lebih akurat.' },
                    ].filter(Boolean).map((r, i) => r && (
                      <div key={i} className={`alert alert-${r.type}`} style={{ fontSize: 13, marginBottom: 8 }}>{r.msg}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      </div>{/* end printRef */}
    </div>
  )
}
