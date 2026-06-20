import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'


const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
const STATUS_FLOW = ['Baru', 'Diproses', 'Dikemas', 'Dikirim', 'Selesai']
const STATUS_COLOR = { Baru: '#0077B6', Diproses: '#C8881A', Dikemas: '#6B2FD9', Dikirim: '#2D5016', Selesai: '#28A745', Batal: '#C0392B' }

export default function RekapOrder() {
  const [orders, setOrders] = useState([])
  const [selected, setSelected] = useState(null)
  const [filterStatus, setFilterStatus] = useState('Semua')
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)
  const [editOrder, setEditOrder] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('orders').select('*, order_items(*)').gte('created_at', filterDate).lt('created_at', filterDate + 'T23:59:59').order('created_at', { ascending: false })
    if (filterStatus !== 'Semua') q = q.eq('status', filterStatus)
    const { data } = await q
    setOrders(data || [])
    setLoading(false)
  }, [filterDate, filterStatus])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    const channel = supabase.channel('orders-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetch).subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetch])

  const updateStatus = async (id, status) => {
    setUpdating(id)
    await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    fetch()
    if (selected?.id === id) setSelected(s => ({ ...s, status }))
    setUpdating(null)
  }

  const openEdit = (o) => { setEditOrder(o); setEditForm({ customer_name: o.customer_name, gedung: o.gedung, lantai: o.lantai, phone: o.phone || '', catatan: o.catatan || '', total_amount: o.total_amount, status: o.status }) }

  const saveEdit = async () => {
    setSaving(true)
    await supabase.from('orders').update({ ...editForm, updated_at: new Date().toISOString() }).eq('id', editOrder.id)
    setEditOrder(null)
    fetch()
    setSaving(false)
  }

  const deleteOrder = async (o) => {
    if (!window.confirm(`Hapus order ${o.order_number || o.id.slice(0,6)} - ${o.customer_name}?`)) return
    await supabase.from('order_items').delete().eq('order_id', o.id)
    await supabase.from('orders').delete().eq('id', o.id)
    if (selected?.id === o.id) setSelected(null)
    fetch()
  }

  const stats = {
    total: orders.length,
    revenue: orders.filter(o => o.status !== 'Batal').reduce((s, o) => s + o.total_amount, 0),
    pending: orders.filter(o => ['Baru', 'Diproses'].includes(o.status)).length,
    selesai: orders.filter(o => o.status === 'Selesai').length,
  }

  return (
    <div>
      
      <div className="page-header"><h1>Rekap Order Harian 📋</h1><p>Monitor dan update status semua pesanan</p></div>

      <div className="grid-4 mb-2">
        {[{ label: 'Total Order', value: stats.total }, { label: 'Perlu Diproses', value: stats.pending, alert: stats.pending > 0 }, { label: 'Selesai', value: stats.selesai }, { label: 'Revenue', value: formatRp(stats.revenue) }].map((s, i) => (
          <div key={i} className="card" style={{ padding: '1rem', textAlign: 'center', borderLeft: s.alert ? '3px solid #E8A838' : '' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.alert ? '#E8A838' : 'var(--text)' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card mb-2" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="form-control" style={{ width: 'auto' }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['Semua', 'Baru', 'Diproses', 'Dikemas', 'Dikirim', 'Selesai', 'Batal'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)} className="btn btn-sm" style={{ background: filterStatus === s ? '#1A2E0A' : 'transparent', color: filterStatus === s ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}>{s}</button>
            ))}
          </div>
          <button onClick={fetch} className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }}>🔄 Refresh</button>
        </div>
      </div>

      {/* Edit Modal */}
      {editOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: 440 }}>
            <div className="flex-between mb-2"><h3 style={{ fontWeight: 700 }}>✏️ Edit Order</h3><button onClick={() => setEditOrder(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button></div>
            {[['customer_name','Nama Customer'],['gedung','Gedung'],['lantai','Lantai'],['phone','No. HP'],['catatan','Catatan']].map(([key, label]) => (
              <div key={key} className="form-group">
                <label className="form-label">{label}</label>
                <input className="form-control" value={editForm[key] || ''} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
            <div className="form-group">
              <label className="form-label">Total Amount (Rp)</label>
              <input className="form-control" type="number" value={editForm.total_amount || 0} onChange={e => setEditForm(f => ({ ...f, total_amount: parseInt(e.target.value) }))} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setEditOrder(null)}>Batal</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={saveEdit} disabled={saving}>{saving ? 'Menyimpan...' : '💾 Simpan'}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: '1rem' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? <div className="loading"><div className="spinner" /></div> : orders.length === 0 ? <div className="empty-state"><p>Tidak ada order</p></div> : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead><tr><th>Order #</th><th>Customer</th><th>Lokasi</th><th>Total</th><th>Status</th><th>Aksi</th></tr></thead>
                <tbody>
                  {orders.map(o => {
                    const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(o.status) + 1]
                    return (
                      <tr key={o.id} style={{ cursor: 'pointer', background: selected?.id === o.id ? 'var(--primary-light)' : '' }} onClick={() => setSelected(o)}>
                        <td style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-muted)' }}>{o.order_number?.slice(-8) || o.id.slice(0,6)}</td>
                        <td><div style={{ fontWeight: 600, fontSize: 13 }}>{o.customer_name}</div>{o.phone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.phone}</div>}</td>
                        <td style={{ fontSize: 12 }}>{o.gedung}<br /><span style={{ color: 'var(--text-muted)' }}>Lt. {o.lantai}</span></td>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{formatRp(o.total_amount)}</td>
                        <td><span className="badge" style={{ background: STATUS_COLOR[o.status] + '22', color: STATUS_COLOR[o.status], fontSize: 11 }}>{o.status}</span></td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {nextStatus && o.status !== 'Batal' && <button className="btn btn-sm btn-primary" onClick={() => updateStatus(o.id, nextStatus)} disabled={updating === o.id} style={{ fontSize: 11, padding: '4px 8px' }}>{updating === o.id ? '...' : '→ ' + nextStatus}</button>}
                            <button className="btn btn-sm btn-outline" onClick={() => openEdit(o)} style={{ fontSize: 11 }}>✏️</button>
                            <button className="btn btn-sm btn-danger" onClick={() => deleteOrder(o)} style={{ fontSize: 11 }}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selected && (
          <div className="card" style={{ height: 'fit-content', position: 'sticky', top: 20 }}>
            <div className="flex-between mb-2"><h3 style={{ fontSize: 15, fontWeight: 700 }}>Detail Order</h3><button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button></div>
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{selected.customer_name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{selected.gedung} · Lt {selected.lantai}</div>
              {selected.phone && <div style={{ fontSize: 13 }}>📱 {selected.phone}</div>}
              {selected.catatan && <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)', marginTop: 4 }}>"{selected.catatan}"</div>}
            </div>
            {selected.order_items?.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span>{item.product_name} <span style={{ color: 'var(--text-muted)' }}>x{item.quantity}</span></span>
                <span style={{ fontWeight: 600 }}>{formatRp(item.subtotal)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', fontWeight: 700, fontSize: 15, color: 'var(--primary-dark)' }}>
              <span>Total</span><span>{formatRp(selected.total_amount)}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {STATUS_FLOW.map(s => (
                <button key={s} onClick={() => updateStatus(selected.id, s)} className="btn btn-sm" style={{ background: selected.status === s ? STATUS_COLOR[s] : 'transparent', color: selected.status === s ? '#fff' : 'var(--text)', border: '1px solid var(--border)', fontSize: 12 }}>{s}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
