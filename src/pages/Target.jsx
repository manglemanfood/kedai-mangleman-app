import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')

// ==================== TARGET ====================
export default function Target() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [target, setTarget] = useState({ target_revenue: '', target_orders: '', target_profit: '', notes: '' })
  const [actual, setActual] = useState({ revenue: 0, orders: 0, expense: 0 })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [month, year])

  const fetchData = async () => {
    setLoading(true)
    const from = `${year}-${String(month).padStart(2,'0')}-01`
    const to = `${year}-${String(month).padStart(2,'0')}-31`
    const [targetRes, ordersRes, expRes] = await Promise.all([
      supabase.from('monthly_targets').select('*').eq('month', month).eq('year', year).maybeSingle(),
      supabase.from('orders').select('total_amount,status').gte('created_at', from).lte('created_at', to + 'T23:59:59'),
      supabase.from('expenses').select('amount').gte('expense_date', from).lte('expense_date', to),
    ])
    if (targetRes.data) setTarget({ target_revenue: targetRes.data.target_revenue, target_orders: targetRes.data.target_orders, target_profit: targetRes.data.target_profit, notes: targetRes.data.notes || '' })
    else setTarget({ target_revenue: '', target_orders: '', target_profit: '', notes: '' })
    const validOrders = (ordersRes.data || []).filter(o => o.status !== 'Batal')
    setActual({
      revenue: validOrders.reduce((s, o) => s + o.total_amount, 0),
      orders: validOrders.length,
      expense: (expRes.data || []).reduce((s, e) => s + e.amount, 0),
    })
    setLoading(false)
  }

  const save = async () => {
    setSaving(true)
    await supabase.from('monthly_targets').upsert({ month, year, target_revenue: parseInt(target.target_revenue) || 0, target_orders: parseInt(target.target_orders) || 0, target_profit: parseInt(target.target_profit) || 0, notes: target.notes }, { onConflict: 'month,year' })
    setSaving(false)
    alert('Target disimpan!')
  }

  const pct = (actual, target) => target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0

  const ProgressBar = ({ value, color = '#E8A838' }) => (
    <div style={{ background: 'var(--border)', borderRadius: 20, height: 10, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ width: value + '%', background: color, height: '100%', borderRadius: 20, transition: 'width 0.5s' }} />
    </div>
  )

  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

  return (
    <div>
      <div className="page-header"><h1>Target Bulanan 🎯</h1><p>Set dan monitor target bisnis bulanan</p></div>
      <div style={{ display: 'flex', gap: 10, marginBottom: '1.5rem', alignItems: 'center' }}>
        <select className="form-control" style={{ width: 'auto' }} value={month} onChange={e => setMonth(parseInt(e.target.value))}>
          {months.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <select className="form-control" style={{ width: 'auto' }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
          {[2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
        </select>
      </div>
      {loading ? <div className="loading"><div className="spinner" /></div> : (
        <div className="grid-2">
          <div className="card">
            <h3 style={{ marginBottom: 16, fontWeight: 700, fontSize: 15 }}>📝 Set Target {months[month-1]} {year}</h3>
            {[
              { key: 'target_revenue', label: 'Target Pendapatan (Rp)' },
              { key: 'target_orders', label: 'Target Jumlah Order' },
              { key: 'target_profit', label: 'Target Laba (Rp)' },
            ].map(f => (
              <div key={f.key} className="form-group">
                <label className="form-label">{f.label}</label>
                <input className="form-control" type="number" value={target[f.key]} onChange={e => setTarget(t => ({ ...t, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div className="form-group">
              <label className="form-label">Catatan / Strategi</label>
              <textarea className="form-control" rows={3} value={target.notes} onChange={e => setTarget(t => ({ ...t, notes: e.target.value }))} />
            </div>
            <button className="btn btn-primary btn-block" onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : '💾 Simpan Target'}</button>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 16, fontWeight: 700, fontSize: 15 }}>📊 Progress {months[month-1]} {year}</h3>
            {[
              { label: 'Pendapatan', actual: actual.revenue, target: parseInt(target.target_revenue) || 0, color: '#2D5016' },
              { label: 'Jumlah Order', actual: actual.orders, target: parseInt(target.target_orders) || 0, color: '#0077B6', isCnt: true },
              { label: 'Laba', actual: actual.revenue - actual.expense, target: parseInt(target.target_profit) || 0, color: '#28A745' },
            ].map(m => {
              const p = pct(m.actual, m.target)
              return (
                <div key={m.label} style={{ marginBottom: 20 }}>
                  <div className="flex-between" style={{ marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: m.color }}>{p}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    <span>{m.isCnt ? m.actual + ' order' : formatRp(m.actual)}</span>
                    <span>Target: {m.isCnt ? m.target + ' order' : formatRp(m.target)}</span>
                  </div>
                  <ProgressBar value={p} color={p >= 100 ? '#28A745' : p >= 70 ? m.color : '#E8A838'} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
