import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
const SEGMENT_CONFIG = {
  VIP: { color: '#C8881A', bg: '#FFF3D6', icon: '👑', desc: '20+ order atau Rp 500rb+' },
  Loyal: { color: '#2D5016', bg: '#E8F5E0', icon: '⭐', desc: '10+ order atau Rp 200rb+' },
  Regular: { color: '#3B5BDB', bg: '#E8F0FF', icon: '🔄', desc: '3+ order' },
  Baru: { color: '#555', bg: '#F0F0F0', icon: '👋', desc: '1-2 order' },
}

export default function CRM() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('Semua')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [history, setHistory] = useState([])

  useEffect(() => {
    supabase.from('customers').select('*').order('total_spent', { ascending: false }).then(({ data }) => {
      setCustomers(data || [])
      setLoading(false)
    })
  }, [])

  const loadHistory = async (customerId) => {
    const { data } = await supabase.from('orders').select('*, order_items(*)').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(10)
    setHistory(data || [])
  }

  const selectCustomer = (c) => { setSelected(c); loadHistory(c.id) }

  const filtered = customers.filter(c => {
    const matchSeg = filter === 'Semua' || c.segment === filter
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search)
    return matchSeg && matchSearch
  })

  const summary = {
    total: customers.length,
    vip: customers.filter(c => c.segment === 'VIP').length,
    loyal: customers.filter(c => c.segment === 'Loyal').length,
    baru: customers.filter(c => c.segment === 'Baru').length,
  }

  return (
    <div>
      <div className="page-header">
        <h1>CRM Pelanggan 👥</h1>
        <p>Kelola hubungan dan segmentasi pelanggan Kedai MangLeman</p>
      </div>

      <div className="grid-4 mb-2">
        {[
          { label: 'Total Pelanggan', value: summary.total, icon: '👥' },
          { label: 'VIP 👑', value: summary.vip, color: '#C8881A' },
          { label: 'Loyal ⭐', value: summary.loyal, color: '#2D5016' },
          { label: 'Pelanggan Baru', value: summary.baru, color: '#555' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color || 'var(--text)' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Segment info */}
      <div className="card mb-2" style={{ padding: '1rem' }}>
        <h4 style={{ marginBottom: 10, fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>SEGMENTASI OTOMATIS</h4>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {Object.entries(SEGMENT_CONFIG).map(([seg, cfg]) => (
            <div key={seg} style={{ background: cfg.bg, borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
              <span style={{ color: cfg.color, fontWeight: 700 }}>{cfg.icon} {seg}</span>
              <span style={{ color: '#888', marginLeft: 6 }}>{cfg.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter & Search */}
      <div className="card mb-2" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="form-control" placeholder="🔍 Cari nama atau nomor HP..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
          <div style={{ display: 'flex', gap: 4 }}>
            {['Semua', 'VIP', 'Loyal', 'Regular', 'Baru'].map(s => (
              <button key={s} onClick={() => setFilter(s)} className="btn btn-sm" style={{ background: filter === s ? '#1A2E0A' : 'transparent', color: filter === s ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 350px' : '1fr', gap: '1rem' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? <div className="loading"><div className="spinner" /></div> : (
            <table className="table">
              <thead>
                <tr>
                  <th>Pelanggan</th>
                  <th>Lokasi Biasa</th>
                  <th>Total Order</th>
                  <th>Total Belanja</th>
                  <th>Segment</th>
                  <th>Order Terakhir</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const cfg = SEGMENT_CONFIG[c.segment] || SEGMENT_CONFIG.Baru
                  return (
                    <tr key={c.id} style={{ cursor: 'pointer', background: selected?.id === c.id ? '#FFF3D6' : '' }} onClick={() => selectCustomer(c)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{cfg.icon}</div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                            {c.phone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.phone}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 12 }}>{c.gedung || '-'}{c.lantai ? ' · Lt ' + c.lantai : ''}</td>
                      <td style={{ fontWeight: 600 }}>{c.total_orders}x</td>
                      <td style={{ fontWeight: 600 }}>{formatRp(c.total_spent)}</td>
                      <td><span className="badge" style={{ background: cfg.bg, color: cfg.color }}>{c.segment}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          {filtered.length === 0 && !loading && <div className="empty-state"><p>Tidak ada pelanggan ditemukan</p></div>}
        </div>

        {/* Customer detail */}
        {selected && (
          <div className="card" style={{ height: 'fit-content', position: 'sticky', top: 20 }}>
            <div className="flex-between mb-2">
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Profil Pelanggan</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>{SEGMENT_CONFIG[selected.segment]?.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>{selected.name}</div>
              {selected.phone && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{selected.phone}</div>}
              <span className="badge mt-1" style={{ background: SEGMENT_CONFIG[selected.segment]?.bg, color: SEGMENT_CONFIG[selected.segment]?.color, display: 'inline-block' }}>
                {selected.segment}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'Total Order', value: selected.total_orders + 'x' },
                { label: 'Total Belanja', value: formatRp(selected.total_spent) },
                { label: 'Gedung', value: selected.gedung || '-' },
                { label: 'Lantai', value: selected.lantai || '-' },
              ].map((s, i) => (
                <div key={i} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.label}</div>
                </div>
              ))}
            </div>
            <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-muted)' }}>RIWAYAT ORDER</h4>
            {history.length === 0 ? <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Belum ada riwayat</p> : (
              history.map(o => (
                <div key={o.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>{formatRp(o.total_amount)}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{new Date(o.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{o.order_items?.map(i => i.product_name).join(', ')}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
