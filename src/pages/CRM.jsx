import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { usePINConfirm } from '../components/PINModal'

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
  const [editItem, setEditItem] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const { requestPIN, PINGate } = usePINConfirm('crm')

  const fetchCustomers = () => {
    supabase.from('customers').select('*').order('total_spent', { ascending: false }).then(({ data }) => {
      setCustomers(data || []); setLoading(false)
    })
  }

  useEffect(() => { fetchCustomers() }, [])

  const loadHistory = async (id) => {
    const { data } = await supabase.from('orders').select('*, order_items(*)').eq('customer_id', id).order('created_at', { ascending: false }).limit(10)
    setHistory(data || [])
  }

  const selectCustomer = (c) => { setSelected(c); loadHistory(c.id) }

  const openEdit = (c) => {
    setEditItem(c)
    setEditForm({ name: c.name, phone: c.phone || '', gedung: c.gedung || '', lantai: c.lantai || '', segment: c.segment, total_orders: c.total_orders, total_spent: c.total_spent })
  }

  const saveEdit = async () => {
    setSaving(true)
    await supabase.from('customers').update(editForm).eq('id', editItem.id)
    setEditItem(null); fetchCustomers(); setSaving(false)
  }

  const deleteCustomer = async (c) => {
    const ok = await requestPIN(`pelanggan "${c.name}"`)
    if (!ok) return
    await supabase.from('customers').delete().eq('id', c.id)
    if (selected?.id === c.id) setSelected(null)
    fetchCustomers()
  }

  const filtered = customers.filter(c => {
    const matchSeg = filter === 'Semua' || c.segment === filter
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search)
    return matchSeg && matchSearch
  })

  const summary = { total: customers.length, vip: customers.filter(c => c.segment === 'VIP').length, loyal: customers.filter(c => c.segment === 'Loyal').length, baru: customers.filter(c => c.segment === 'Baru').length }

  return (
    <div>
      <PINGate />
      <div className="page-header"><h1>CRM Pelanggan 👥</h1><p>Kelola hubungan dan segmentasi pelanggan</p></div>

      <div className="grid-4 mb-2">
        {[{ label: 'Total Pelanggan', value: summary.total }, { label: 'VIP 👑', value: summary.vip, color: '#C8881A' }, { label: 'Loyal ⭐', value: summary.loyal, color: '#2D5016' }, { label: 'Pelanggan Baru', value: summary.baru }].map((s, i) => (
          <div key={i} className="card" style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color || 'var(--text)' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: 420 }}>
            <div className="flex-between mb-2"><h3 style={{ fontWeight: 700 }}>✏️ Edit Pelanggan</h3><button onClick={() => setEditItem(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button></div>
            {[['name','Nama'],['phone','No. HP'],['gedung','Gedung'],['lantai','Lantai']].map(([key, label]) => (
              <div key={key} className="form-group"><label className="form-label">{label}</label><input className="form-control" value={editForm[key] || ''} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))} /></div>
            ))}
            <div className="form-group">
              <label className="form-label">Segment</label>
              <select className="form-control" value={editForm.segment} onChange={e => setEditForm(f => ({ ...f, segment: e.target.value }))}>
                {['VIP','Loyal','Regular','Baru'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Total Order</label><input className="form-control" type="number" value={editForm.total_orders || 0} onChange={e => setEditForm(f => ({ ...f, total_orders: parseInt(e.target.value) }))} /></div>
              <div className="form-group"><label className="form-label">Total Belanja (Rp)</label><input className="form-control" type="number" value={editForm.total_spent || 0} onChange={e => setEditForm(f => ({ ...f, total_spent: parseInt(e.target.value) }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setEditItem(null)}>Batal</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={saveEdit} disabled={saving}>{saving ? 'Menyimpan...' : '💾 Simpan'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="card mb-2" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="form-control" placeholder="🔍 Cari nama atau HP..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
          <div style={{ display: 'flex', gap: 4 }}>
            {['Semua','VIP','Loyal','Regular','Baru'].map(s => (
              <button key={s} onClick={() => setFilter(s)} className="btn btn-sm" style={{ background: filter === s ? '#1A2E0A' : 'transparent', color: filter === s ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}>{s}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 350px' : '1fr', gap: '1rem' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? <div className="loading"><div className="spinner" /></div> : (
            <table className="table">
              <thead><tr><th>Pelanggan</th><th>Lokasi</th><th>Total Order</th><th>Total Belanja</th><th>Segment</th><th>Aksi</th></tr></thead>
              <tbody>
                {filtered.map(c => {
                  const cfg = SEGMENT_CONFIG[c.segment] || SEGMENT_CONFIG.Baru
                  return (
                    <tr key={c.id} style={{ cursor: 'pointer', background: selected?.id === c.id ? '#FFF3D6' : '' }} onClick={() => selectCustomer(c)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{cfg.icon}</div>
                          <div><div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>{c.phone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.phone}</div>}</div>
                        </div>
                      </td>
                      <td style={{ fontSize: 12 }}>{c.gedung || '-'}{c.lantai ? ' · Lt ' + c.lantai : ''}</td>
                      <td style={{ fontWeight: 600 }}>{c.total_orders}x</td>
                      <td style={{ fontWeight: 600 }}>{formatRp(c.total_spent)}</td>
                      <td><span className="badge" style={{ background: cfg.bg, color: cfg.color }}>{c.segment}</span></td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-sm btn-outline" onClick={() => openEdit(c)}>✏️</button>
                          <button className="btn btn-sm btn-danger" onClick={() => deleteCustomer(c)}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {selected && (
          <div className="card" style={{ height: 'fit-content', position: 'sticky', top: 20 }}>
            <div className="flex-between mb-2"><h3 style={{ fontSize: 15, fontWeight: 700 }}>Profil Pelanggan</h3><button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button></div>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>{SEGMENT_CONFIG[selected.segment]?.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>{selected.name}</div>
              {selected.phone && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{selected.phone}</div>}
              <span className="badge mt-1" style={{ background: SEGMENT_CONFIG[selected.segment]?.bg, color: SEGMENT_CONFIG[selected.segment]?.color, display: 'inline-block' }}>{selected.segment}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[{ label: 'Total Order', value: selected.total_orders + 'x' }, { label: 'Total Belanja', value: formatRp(selected.total_spent) }, { label: 'Gedung', value: selected.gedung || '-' }, { label: 'Lantai', value: selected.lantai || '-' }].map((s, i) => (
                <div key={i} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.label}</div>
                </div>
              ))}
            </div>
            <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-muted)' }}>RIWAYAT ORDER</h4>
            {history.map(o => (
              <div key={o.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>{formatRp(o.total_amount)}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{new Date(o.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                </div>
                <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{o.order_items?.map(i => i.product_name).join(', ')}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
