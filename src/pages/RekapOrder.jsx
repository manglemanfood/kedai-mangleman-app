import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
const STATUS_FLOW = ['Baru', 'Diproses', 'Dikemas', 'Dikirim', 'Selesai']
const STATUS_COLOR = {
  Baru: '#0077B6', Diproses: '#C8881A', Dikemas: '#6B2FD9',
  Dikirim: '#2D5016', Selesai: '#28A745', Batal: '#C0392B'
}

const today = () => new Date().toISOString().split('T')[0]

export default function RekapOrder() {
  const [orders, setOrders] = useState([])
  const [selected, setSelected] = useState(null)
  const [filterStatus, setFilterStatus] = useState('Semua')
  const [filterMode, setFilterMode] = useState('semua') // 'hari-ini','semua','custom'
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)
  const [editOrder, setEditOrder] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [autoFixDone, setAutoFixDone] = useState(false)

  // Auto-set "Selesai" untuk transaksi masa lalu
  const autoFixPastOrders = useCallback(async () => {
    if (autoFixDone) return
    const todayStr = today()
    const { data: pastOrders } = await supabase
      .from('orders')
      .select('id')
      .lt('created_at', todayStr + 'T00:00:00')
      .in('status', ['Baru', 'Diproses', 'Dikemas', 'Dikirim'])
    
    if (pastOrders && pastOrders.length > 0) {
      const ids = pastOrders.map(o => o.id)
      await supabase.from('orders').update({ status: 'Selesai', updated_at: new Date().toISOString() }).in('id', ids)
      console.log(`Auto-fixed ${ids.length} past orders to Selesai`)
    }
    setAutoFixDone(true)
  }, [autoFixDone])

  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false })

    // Apply date filter
    if (filterMode === 'hari-ini') {
      q = q.gte('created_at', today() + 'T00:00:00').lte('created_at', today() + 'T23:59:59')
    } else if (filterMode === 'custom' && dateFrom) {
      q = q.gte('created_at', dateFrom + 'T00:00:00')
      if (dateTo) q = q.lte('created_at', dateTo + 'T23:59:59')
    }
    // filterMode === 'semua' → no date filter, tampilkan semua

    if (filterStatus !== 'Semua') q = q.eq('status', filterStatus)

    const { data } = await q.limit(200)
    setOrders(data || [])
    setLoading(false)
  }, [filterMode, dateFrom, dateTo, filterStatus])

  useEffect(() => {
    autoFixPastOrders().then(() => fetch())
  }, [])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    const channel = supabase.channel('orders-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetch)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetch])

  const updateStatus = async (id, status) => {
    setUpdating(id)
    await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    fetch()
    if (selected?.id === id) setSelected(s => ({ ...s, status }))
    setUpdating(null)
  }

  const openEdit = (o) => {
    setEditOrder(o)
    setEditForm({ customer_name: o.customer_name, gedung: o.gedung, lantai: o.lantai, phone: o.phone || '', catatan: o.catatan || '', total_amount: o.total_amount, status: o.status })
  }

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
    pending: orders.filter(o => ['Baru', 'Diproses', 'Dikemas'].includes(o.status)).length,
    selesai: orders.filter(o => o.status === 'Selesai').length,
  }

  const isToday = (dateStr) => dateStr && dateStr.startsWith(today())
  const isPast = (dateStr) => dateStr && dateStr < today() + 'T00:00:00'

  return (
    <div>
      <div className="page-header">
        <h1>Rekap Order 📋</h1>
        <p>Semua pesanan — historis & hari ini</p>
      </div>

      {/* Stats */}
      <div className="grid-4 mb-2">
        {[
          { label: 'Total Order', value: stats.total },
          { label: 'Perlu Diproses', value: stats.pending, alert: stats.pending > 0 },
          { label: 'Selesai', value: stats.selesai },
          { label: 'Revenue', value: formatRp(stats.revenue) },
        ].map((s, i) => (
          <div key={i} className="card" style={{ padding: '1rem', textAlign: 'center', borderLeft: s.alert ? '3px solid #E8A838' : '' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.alert ? '#E8A838' : 'var(--text)' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="card mb-2" style={{ padding: '1rem' }}>
        {/* Date mode */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {[
            { key: 'hari-ini', label: '📅 Hari Ini' },
            { key: 'semua', label: '📂 Semua Tanggal' },
            { key: 'custom', label: '🗓 Pilih Tanggal' },
          ].map(m => (
            <button key={m.key} onClick={() => setFilterMode(m.key)} className="btn btn-sm"
              style={{ background: filterMode === m.key ? '#1A2E0A' : 'transparent', color: filterMode === m.key ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}>
              {m.label}
            </button>
          ))}

          {/* Custom date range */}
          {filterMode === 'custom' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="form-control" style={{ width: 'auto' }} />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>s/d</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="form-control" style={{ width: 'auto' }} />
            </div>
          )}

          <button onClick={fetch} className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }}>🔄 Refresh</button>
        </div>

        {/* Status filter */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['Semua', 'Baru', 'Diproses', 'Dikemas', 'Dikirim', 'Selesai', 'Batal'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className="btn btn-sm"
              style={{ background: filterStatus === s ? STATUS_COLOR[s] || '#1A2E0A' : 'transparent', color: filterStatus === s ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Edit Modal */}
      {editOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: 440 }}>
            <div className="flex-between mb-2">
              <h3 style={{ fontWeight: 700 }}>✏️ Edit Order</h3>
              <button onClick={() => setEditOrder(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
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
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-control" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                {['Baru','Diproses','Dikemas','Dikirim','Selesai','Batal'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setEditOrder(null)}>Batal</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={saveEdit} disabled={saving}>{saving ? 'Menyimpan...' : '💾 Simpan'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: '1rem' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div className="loading"><div className="spinner" /><span>Memuat order...</span></div>
          ) : orders.length === 0 ? (
            <div className="empty-state"><p>Tidak ada order ditemukan</p></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Tanggal</th>
                    <th>Customer</th>
                    <th>Lokasi</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => {
                    const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(o.status) + 1]
                    const past = isPast(o.created_at)
                    return (
                      <tr key={o.id}
                        style={{ cursor: 'pointer', background: selected?.id === o.id ? 'var(--primary-light)' : past ? '#FAFAF8' : '' }}
                        onClick={() => setSelected(o)}>
                        <td style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-muted)' }}>
                          {o.order_number?.slice(-8) || o.id.slice(0,6)}
                        </td>
                        <td style={{ fontSize: 11, color: past ? 'var(--text-muted)' : 'var(--text)', whiteSpace: 'nowrap' }}>
                          {new Date(o.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' })}
                          {isToday(o.created_at) && <span style={{ marginLeft: 4, fontSize: 9, background: '#E8F5E0', color: '#2D5016', borderRadius: 4, padding: '1px 4px', fontWeight: 700 }}>HARI INI</span>}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{o.customer_name}</div>
                          {o.phone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.phone}</div>}
                        </td>
                        <td style={{ fontSize: 12 }}>{o.gedung}<br /><span style={{ color: 'var(--text-muted)' }}>Lt. {o.lantai}</span></td>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{formatRp(o.total_amount)}</td>
                        <td>
                          <span className="badge" style={{ background: STATUS_COLOR[o.status] + '22', color: STATUS_COLOR[o.status], fontSize: 11 }}>
                            {o.status}
                          </span>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {nextStatus && o.status !== 'Batal' && !past && (
                              <button className="btn btn-sm btn-primary" onClick={() => updateStatus(o.id, nextStatus)} disabled={updating === o.id} style={{ fontSize: 11, padding: '4px 8px', whiteSpace: 'nowrap' }}>
                                {updating === o.id ? '...' : '→ ' + nextStatus}
                              </button>
                            )}
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

        {/* Detail panel */}
        {selected && (
          <div className="card" style={{ height: 'fit-content', position: 'sticky', top: 20 }}>
            <div className="flex-between mb-2">
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Detail Order</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px', marginBottom: 10, fontSize: 12, color: 'var(--text-muted)' }}>
              🗓 {new Date(selected.created_at).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
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
            {!isPast(selected.created_at) && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                {STATUS_FLOW.map(s => (
                  <button key={s} onClick={() => updateStatus(selected.id, s)} className="btn btn-sm"
                    style={{ background: selected.status === s ? STATUS_COLOR[s] : 'transparent', color: selected.status === s ? '#fff' : 'var(--text)', border: '1px solid var(--border)', fontSize: 12 }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
