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

  const fetch = useCallback(async () => {
    setLoading(true)
    const q = supabase.from('orders').select('*, order_items(*)').gte('created_at', filterDate).lt('created_at', filterDate + 'T23:59:59').order('created_at', { ascending: false })
    if (filterStatus !== 'Semua') q.eq('status', filterStatus)
    const { data } = await q
    setOrders(data || [])
    setLoading(false)
  }, [filterDate, filterStatus])

  useEffect(() => { fetch() }, [fetch])

  // Realtime subscription
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

  const stats = {
    total: orders.length,
    revenue: orders.filter(o => o.status !== 'Batal').reduce((s, o) => s + o.total_amount, 0),
    pending: orders.filter(o => ['Baru', 'Diproses'].includes(o.status)).length,
    selesai: orders.filter(o => o.status === 'Selesai').length,
  }

  return (
    <div>
      <div className="page-header">
        <h1>Rekap Order Harian 📋</h1>
        <p>Monitor dan update status semua pesanan</p>
      </div>

      {/* Stats mini */}
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

      {/* Filters */}
      <div className="card mb-2" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="form-control" style={{ width: 'auto' }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['Semua', 'Baru', 'Diproses', 'Dikemas', 'Dikirim', 'Selesai', 'Batal'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)} className="btn btn-sm" style={{ background: filterStatus === s ? '#1A2E0A' : 'transparent', color: filterStatus === s ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}>
                {s}
              </button>
            ))}
          </div>
          <button onClick={fetch} className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }}>🔄 Refresh</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: '1rem' }}>
        {/* Order list */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div className="loading"><div className="spinner" /><span>Memuat order...</span></div>
          ) : orders.length === 0 ? (
            <div className="empty-state"><p>Tidak ada order untuk tanggal dan filter ini</p></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Lokasi</th>
                    <th>Item</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => {
                    const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(o.status) + 1]
                    return (
                      <tr key={o.id} style={{ cursor: 'pointer', background: selected?.id === o.id ? 'var(--primary-light)' : '' }} onClick={() => setSelected(o)}>
                        <td style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-muted)' }}>{o.order_number?.slice(-8) || o.id.slice(0,6)}</td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{o.customer_name}</div>
                          {o.phone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.phone}</div>}
                        </td>
                        <td style={{ fontSize: 12 }}>{o.gedung}<br /><span style={{ color: 'var(--text-muted)' }}>Lt. {o.lantai}</span></td>
                        <td style={{ fontSize: 12 }}>{o.order_items?.length || 0} item</td>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{formatRp(o.total_amount)}</td>
                        <td>
                          <span className="badge" style={{ background: STATUS_COLOR[o.status] + '22', color: STATUS_COLOR[o.status], fontSize: 11 }}>
                            {o.status}
                          </span>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {nextStatus && o.status !== 'Batal' && (
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => updateStatus(o.id, nextStatus)}
                                disabled={updating === o.id}
                                style={{ fontSize: 11, padding: '4px 8px', whiteSpace: 'nowrap' }}
                              >
                                {updating === o.id ? '...' : '→ ' + nextStatus}
                              </button>
                            )}
                            {o.status !== 'Batal' && o.status !== 'Selesai' && (
                              <button className="btn btn-sm btn-danger" onClick={() => { if(window.confirm('Batalkan order ini?')) updateStatus(o.id, 'Batal') }} style={{ fontSize: 11, padding: '4px 8px' }}>
                                ✕
                              </button>
                            )}
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

        {/* Order detail panel */}
        {selected && (
          <div className="card" style={{ height: 'fit-content', position: 'sticky', top: 20 }}>
            <div className="flex-between mb-2">
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Detail Order</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>✕</button>
            </div>
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{selected.customer_name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{selected.gedung} · Lt {selected.lantai}</div>
              {selected.phone && <div style={{ fontSize: 13 }}>📱 {selected.phone}</div>}
              {selected.catatan && <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)', marginTop: 4 }}>"{selected.catatan}"</div>}
            </div>
            <div style={{ marginBottom: 12 }}>
              {selected.order_items?.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <span>{item.product_name} <span style={{ color: 'var(--text-muted)' }}>x{item.quantity}</span></span>
                  <span style={{ fontWeight: 600 }}>{formatRp(item.subtotal)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', fontWeight: 700, fontSize: 15, color: 'var(--primary-dark)' }}>
                <span>Total</span>
                <span>{formatRp(selected.total_amount)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STATUS_FLOW.map(s => (
                <button key={s} onClick={() => updateStatus(selected.id, s)} className="btn btn-sm" style={{ background: selected.status === s ? STATUS_COLOR[s] : 'transparent', color: selected.status === s ? '#fff' : 'var(--text)', border: '1px solid var(--border)', fontSize: 12 }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
