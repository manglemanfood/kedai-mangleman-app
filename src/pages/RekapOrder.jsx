import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'

const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
const STATUS_FLOW = ['Baru', 'Diproses', 'Dikemas', 'Dikirim', 'Selesai']
const STATUS_COLOR = {
  Baru: '#0077B6', Diproses: '#C8881A', Dikemas: '#6B2FD9',
  Dikirim: '#2D5016', Selesai: '#28A745', Batal: '#C0392B'
}

const todayStr = () => {
  const now = new Date()
  // Gunakan timezone WIB (UTC+7) bukan UTC, supaya tidak salah tanggal
  const wib = new Date(now.getTime() + (7 * 60 * 60 * 1000))
  return wib.toISOString().split('T')[0]
}

export default function RekapOrder() {
  const [orders, setOrders] = useState([])
  const [selected, setSelected] = useState(null)
  const [filterStatus, setFilterStatus] = useState('Semua')
  const [filterMode, setFilterMode] = useState('semua')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)
  const [editOrder, setEditOrder] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [savingDelivery, setSavingDelivery] = useState(null)
  const [saving, setSaving] = useState(false)
  const autoFixRef = useRef(false)

  const fetchOrders = async (mode, from, to, status) => {
    setLoading(true)
    try {
      let q = supabase
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false })

      const td = todayStr()

      // Filter berdasarkan delivery_date jika ada, fallback ke created_at
      if (mode === 'hari-ini') {
        q = q.or(
          `delivery_date.eq.${td},` +
          `and(delivery_date.is.null,created_at.gte.${td}T00:00:00+07:00,created_at.lte.${td}T23:59:59+07:00)`
        )
      } else if (mode === 'custom') {
        if (from && to) {
          q = q.or(
            `and(delivery_date.gte.${from},delivery_date.lte.${to}),` +
            `and(delivery_date.is.null,created_at.gte.${from}T00:00:00+07:00,created_at.lte.${to}T23:59:59+07:00)`
          )
        } else if (from) {
          q = q.or(`delivery_date.gte.${from},and(delivery_date.is.null,created_at.gte.${from}T00:00:00+07:00)`)
        } else if (to) {
          q = q.or(`delivery_date.lte.${to},and(delivery_date.is.null,created_at.lte.${to}T23:59:59+07:00)`)
        }
      }
      // mode === 'semua' → no date filter

      if (status !== 'Semua') q = q.eq('status', status)

      const { data, error } = await q
      if (error) throw error
      setOrders(data || [])
    } catch (e) {
      console.error('Fetch error:', e)
      setOrders([])
    }
    setLoading(false)
  }

  // Auto-fix past orders sekali saja
  useEffect(() => {
    const autoFix = async () => {
      if (autoFixRef.current) return
      autoFixRef.current = true
      const td = todayStr()
      const { data: past } = await supabase
        .from('orders')
        .select('id')
        .lt('created_at', td + 'T00:00:00+07:00')
        .in('status', ['Baru', 'Diproses', 'Dikemas', 'Dikirim'])
      if (past && past.length > 0) {
        await supabase.from('orders')
          .update({ status: 'Selesai', updated_at: new Date().toISOString() })
          .in('id', past.map(o => o.id))
      }
      // Fetch after fix
      fetchOrders(filterMode, dateFrom, dateTo, filterStatus)
    }
    autoFix()
  }, []) // hanya sekali saat mount

  // Re-fetch saat filter berubah
  useEffect(() => {
    fetchOrders(filterMode, dateFrom, dateTo, filterStatus)
  }, [filterMode, dateFrom, dateTo, filterStatus])

  // Realtime
  useEffect(() => {
    const ch = supabase.channel('orders-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders(filterMode, dateFrom, dateTo, filterStatus)
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [filterMode, dateFrom, dateTo, filterStatus])

  const updateStatus = async (id, status) => {
    setUpdating(id)
    await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setUpdating(null)
    fetchOrders(filterMode, dateFrom, dateTo, filterStatus)
    if (selected?.id === id) setSelected(s => ({ ...s, status }))
  }

  const openEdit = (o) => {
    setEditOrder(o)
    setEditForm({
      customer_name: o.customer_name,
      gedung: o.gedung,
      lantai: o.lantai,
      phone: o.phone || '',
      catatan: o.catatan || '',
      total_amount: o.total_amount,
      status: o.status,
      delivery_date: o.delivery_date || ''
    })
  }

  const saveEdit = async () => {
    setSaving(true)
    const updateData = { ...editForm, updated_at: new Date().toISOString() }
    if (!updateData.delivery_date) delete updateData.delivery_date
    await supabase.from('orders').update(updateData).eq('id', editOrder.id)
    setEditOrder(null)
    setSaving(false)
    fetchOrders(filterMode, dateFrom, dateTo, filterStatus)
  }

  const deleteOrder = async (o) => {
    if (!window.confirm(`Hapus order ${o.order_number || o.id.slice(0,6)} - ${o.customer_name}?`)) return
    await supabase.from('order_items').delete().eq('order_id', o.id)
    await supabase.from('orders').delete().eq('id', o.id)
    if (selected?.id === o.id) setSelected(null)
    fetchOrders(filterMode, dateFrom, dateTo, filterStatus)
  }

  const setMode = (m) => {
    setFilterMode(m)
    if (m !== 'custom') { setDateFrom(''); setDateTo('') }
  }

  const stats = {
    total: orders.length,
    revenue: orders.filter(o => o.status !== 'Batal').reduce((s, o) => s + o.total_amount, 0),
    pending: orders.filter(o => ['Baru','Diproses','Dikemas'].includes(o.status)).length,
    selesai: orders.filter(o => o.status === 'Selesai').length,
  }

  const isToday = (dt) => dt && dt.startsWith(todayStr())
  const isPast  = (dt) => dt && dt < todayStr() + 'T00:00:00'

  // Order yang masuk ke PDF Packing: gunakan delivery_date sebagai acuan utama.
  // Jika filter aktif "Hari Ini" -> pakai tanggal hari ini.
  // Jika filter "Pilih Tanggal" -> pakai dateFrom (tanggal kirim yang dipilih).
  // Jika filter "Semua Tanggal" -> fallback ke hari ini.
  const tglPacking = filterMode === 'custom' && dateFrom ? dateFrom : todayStr()

  const ordersHariIni = orders.filter(o => {
    if (o.status === 'Batal') return false
    if (o.delivery_date) return o.delivery_date === tglPacking
    // Tanpa delivery_date: anggap dikirim di hari yang sama dengan order dibuat
    return o.created_at && o.created_at.startsWith(tglPacking)
  })

  const downloadPackingPDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 12
    let y = 16

    const tglLabel = new Date(tglPacking + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(17)
    doc.text('KEDAI MANGLEMAN', margin, y)
    y += 6.5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    doc.setTextColor(60, 60, 60)
    doc.text('Rekap Order Packing & Delivery', margin, y)
    y += 7
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)
    doc.text(`Tanggal Kirim : ${tglLabel}`, margin, y)
    y += 5
    doc.text(`Total Order   : ${ordersHariIni.length}`, margin, y)
    y += 6
    doc.setLineWidth(0.5)
    doc.setDrawColor(45, 80, 22)
    doc.line(margin, y, pageWidth - margin, y)
    y += 7

    if (ordersHariIni.length === 0) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(10)
      doc.setTextColor(110, 110, 110)
      doc.text('Tidak ada order untuk dikirim pada tanggal ini.', margin, y)
      doc.setTextColor(0, 0, 0)
    }

    ordersHariIni.forEach((o, idx) => {
      // Page break check
      const estHeight = 16 + (o.order_items?.length || 0) * 5.5 + 10
      if (y + estHeight > 280) {
        doc.addPage()
        y = 16
      }

      // Box header per order
      doc.setFillColor(243, 243, 237)
      doc.setDrawColor(210, 210, 200)
      doc.setLineWidth(0.3)
      doc.roundedRect(margin, y, pageWidth - margin * 2, 9, 1.2, 1.2, 'FD')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(26, 46, 10)
      doc.text(`${idx + 1}. ${o.customer_name}`, margin + 3.5, y + 6)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(45, 80, 22)
      const statusText = o.status.toUpperCase()
      doc.text(statusText, pageWidth - margin - doc.getTextWidth(statusText) - 3.5, y + 6)
      doc.setTextColor(0, 0, 0)
      y += 13

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Lokasi  : ${o.gedung} - Lantai ${o.lantai}`, margin + 3.5, y)
      y += 5
      if (o.phone) {
        doc.text(`No. HP  : ${o.phone}`, margin + 3.5, y)
        y += 5
      }
      y += 1

      // Items
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.text('Item Order', margin + 3.5, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      ;(o.order_items || []).forEach(item => {
        doc.text(`-  ${item.product_name}  x${item.quantity}`, margin + 6, y)
        const itemTotal = 'Rp ' + Number(item.subtotal || 0).toLocaleString('id-ID')
        doc.text(itemTotal, pageWidth - margin - doc.getTextWidth(itemTotal) - 3.5, y)
        y += 5
      })

      if (o.catatan) {
        y += 0.5
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(9)
        doc.setTextColor(90, 90, 90)
        doc.text(`Catatan : ${o.catatan}`, margin + 3.5, y)
        doc.setTextColor(0, 0, 0)
        y += 5
        doc.setFont('helvetica', 'normal')
      }

      // Total
      y += 1
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      const totalText = 'Total : Rp ' + Number(o.total_amount || 0).toLocaleString('id-ID')
      doc.text(totalText, pageWidth - margin - doc.getTextWidth(totalText) - 3.5, y)
      y += 6

      // Checkbox packing
      doc.setDrawColor(60, 60, 60)
      doc.setLineWidth(0.35)
      doc.rect(margin + 3.5, y - 3.2, 4, 4)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.text('Sudah dipacking', margin + 10, y)
      doc.rect(margin + 55, y - 3.2, 4, 4)
      doc.text('Sudah dikirim', margin + 61.5, y)
      y += 7

      doc.setDrawColor(225, 225, 218)
      doc.setLineWidth(0.2)
      doc.line(margin, y, pageWidth - margin, y)
      y += 6
    })

    // Footer summary
    if (ordersHariIni.length > 0) {
      if (y + 20 > 280) { doc.addPage(); y = 16 }
      y += 2
      doc.setDrawColor(45, 80, 22)
      doc.setLineWidth(0.5)
      doc.line(margin, y, pageWidth - margin, y)
      y += 7
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(26, 46, 10)
      const totalRevenue = ordersHariIni.reduce((s, o) => s + (o.total_amount || 0), 0)
      doc.text(`Total Omset : Rp ${totalRevenue.toLocaleString('id-ID')}`, margin, y)
      doc.setTextColor(0, 0, 0)
    }

    doc.save(`Packing-Delivery-${tglPacking}.pdf`)
  }

  return (
    <div>
      <div className="page-header flex-between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1>Rekap Order 📋</h1>
          <p>Semua pesanan — historis & hari ini</p>
        </div>
        <button onClick={downloadPackingPDF} className="btn btn-primary" style={{ background: '#2D5016' }}>
          🖨️ Download PDF Packing ({ordersHariIni.length}) — {new Date(tglPacking + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
        </button>
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

      {/* Filter */}
      <div className="card mb-2" style={{ padding: '1rem' }}>
        {/* Mode buttons */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
          {[
            { key: 'hari-ini', label: '📅 Hari Ini' },
            { key: 'semua',    label: '📂 Semua Tanggal' },
            { key: 'custom',   label: '🗓 Pilih Tanggal' },
          ].map(m => (
            <button key={m.key} onClick={() => setMode(m.key)} className="btn btn-sm"
              style={{ background: filterMode === m.key ? '#1A2E0A' : 'transparent', color: filterMode === m.key ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}>
              {m.label}
            </button>
          ))}

          {filterMode === 'custom' && (
            <>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="form-control" style={{ width: 'auto' }} />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>s/d</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="form-control" style={{ width: 'auto' }} />
            </>
          )}

          <button onClick={() => fetchOrders(filterMode, dateFrom, dateTo, filterStatus)}
            className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }}>
            🔄 Refresh
          </button>
        </div>

        {/* Status filter */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['Semua','Baru','Diproses','Dikemas','Dikirim','Selesai','Batal'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className="btn btn-sm"
              style={{ background: filterStatus === s ? (STATUS_COLOR[s] || '#1A2E0A') : 'transparent', color: filterStatus === s ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}>
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
              <label className="form-label">🚚 Tanggal Pengiriman</label>
              <input className="form-control" type="date" value={editForm.delivery_date || ''}
                onChange={e => setEditForm(f => ({ ...f, delivery_date: e.target.value }))} />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                Kosongkan jika dikirim hari yang sama dengan tanggal order
              </p>
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

      {/* Table + Detail */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: '1rem' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div className="loading"><div className="spinner" /><span>Memuat order...</span></div>
          ) : orders.length === 0 ? (
            <div className="empty-state">
              <p>Tidak ada order ditemukan</p>
              <p style={{ fontSize: 12, marginTop: 8, color: 'var(--text-muted)' }}>
                {filterMode === 'hari-ini' ? 'Coba pilih "Semua Tanggal" untuk melihat data historis' : 'Coba ubah filter atau klik Refresh'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Tgl Order / Kirim</th>
                    <th>Customer</th>
                    <th>Lokasi</th>
                    <th>Total</th>
                    <th>Bayar</th>
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
                        style={{ cursor: 'pointer', background: selected?.id === o.id ? 'var(--primary-light)' : '' }}
                        onClick={() => setSelected(o)}>
                        <td style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-muted)' }}>
                          {o.order_number?.slice(-8) || o.id.slice(0,6)}
                        </td>
                        <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                          {/* Tanggal pengiriman */}
                          <div style={{ fontWeight: 600, color: '#1A2E0A' }}>
                            🚚 {o.delivery_date
                              ? new Date(o.delivery_date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' })
                              : new Date(o.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' })
                            }
                          </div>
                          {/* Tanggal order jika berbeda */}
                          {o.delivery_date && o.delivery_date !== o.created_at?.slice(0,10) && (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                              Order: {new Date(o.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                            </div>
                          )}
                          {!o.delivery_date && isToday(o.created_at) && (
                            <span style={{ display: 'block', fontSize: 9, background: '#E8F5E0', color: '#2D5016', borderRadius: 4, padding: '1px 4px', fontWeight: 700, marginTop: 2 }}>HARI INI</span>
                          )}
                          {o.delivery_date === todayStr() && (
                            <span style={{ display: 'block', fontSize: 9, background: '#E8F5E0', color: '#2D5016', borderRadius: 4, padding: '1px 4px', fontWeight: 700, marginTop: 2 }}>KIRIM HARI INI</span>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{o.customer_name}</div>
                          {o.phone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.phone}</div>}
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {o.gedung}<br />
                          <span style={{ color: 'var(--text-muted)' }}>Lt. {o.lantai}</span>
                        </td>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{formatRp(o.total_amount)}</td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                            {['Cash', 'QRIS', 'Transfer'].map(m => (
                              <button key={m} onClick={() => supabase.from('orders').update({ payment_method: m }).eq('id', o.id).then(fetchOrders)}
                                style={{
                                  fontSize: 10, padding: '3px 6px', borderRadius: 6, border: '1.5px solid',
                                  borderColor: (o.payment_method || 'Cash') === m ? '#2D5016' : '#ddd',
                                  background: (o.payment_method || 'Cash') === m ? '#E8F5E0' : '#fff',
                                  color: (o.payment_method || 'Cash') === m ? '#2D5016' : '#999',
                                  cursor: 'pointer', fontWeight: (o.payment_method || 'Cash') === m ? 700 : 400,
                                }}>
                                {m}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td>
                          <span className="badge" style={{ background: STATUS_COLOR[o.status] + '22', color: STATUS_COLOR[o.status], fontSize: 11 }}>
                            {o.status}
                          </span>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {nextStatus && o.status !== 'Batal' && !past && (
                              <button className="btn btn-sm btn-primary"
                                onClick={() => updateStatus(o.id, nextStatus)}
                                disabled={updating === o.id}
                                style={{ fontSize: 11, padding: '4px 8px', whiteSpace: 'nowrap' }}>
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
