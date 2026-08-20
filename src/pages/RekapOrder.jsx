import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'

const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
const STATUS_FLOW = ['Baru', 'Diproses', 'Dikemas', 'Dikirim', 'Selesai']
const STATUS_COLOR = {
  Baru: '#0077B6', Diproses: '#C8881A', Dikemas: '#6B2FD9',
  Dikirim: '#2D5016', Selesai: '#28A745', Batal: '#C0392B'
}

// Info Kedai
const KEDAI_INFO = {
  nama: 'Kedai Mang Leman',
  alamat: 'Perum BDB 3 Karadenan - Cibinong - Kab. Bogor',
  wa: '085353292224',
  rekening: [
    { bank: 'BCA', no: '1234567890', atas_nama: 'Mang Leman' },
    { bank: 'BRI', no: '0987654321', atas_nama: 'Mang Leman' },
  ]
}

const todayStr = () => {
  const now = new Date()
  const wib = new Date(now.getTime() + (7 * 60 * 60 * 1000))
  return wib.toISOString().split('T')[0]
}

const generateInvoiceNumber = (order) => {
  const date = new Date(order.created_at)
  const wib = new Date(date.getTime() + 7 * 60 * 60 * 1000)
  const dd = String(wib.getDate()).padStart(2, '0')
  const mm = String(wib.getMonth() + 1).padStart(2, '0')
  const yy = String(wib.getFullYear()).slice(2)
  const num = order.order_number?.slice(-4) || order.id.slice(0, 4).toUpperCase()
  return `INV/${yy}${mm}${dd}/${num}`
}

const downloadInvoicePDF = (order) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 18
  const contentW = pageW - margin * 2
  const isLunas = order.status === 'Selesai'
  const invNo = generateInvoiceNumber(order)

  // ── HEADER BACKGROUND ──
  doc.setFillColor(26, 46, 10)
  doc.rect(0, 0, pageW, 42, 'F')

  // Nama Kedai
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(232, 168, 56)
  doc.text(KEDAI_INFO.nama.toUpperCase(), margin, 16)

  // Tagline / alamat di header
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(200, 220, 180)
  doc.text(KEDAI_INFO.alamat, margin, 23)
  doc.text(`WA: ${KEDAI_INFO.wa}`, margin, 29)

  // Label INVOICE
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(255, 255, 255)
  const invLabel = 'INVOICE'
  doc.text(invLabel, pageW - margin - doc.getTextWidth(invLabel), 18)

  // Nomor invoice
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(200, 220, 180)
  doc.text(invNo, pageW - margin - doc.getTextWidth(invNo), 25)

  // ── INFO INVOICE & CUSTOMER ──
  let y = 52

  // Box kiri - Tagihan Kepada
  doc.setFillColor(247, 247, 242)
  doc.setDrawColor(220, 220, 210)
  doc.setLineWidth(0.3)
  doc.roundedRect(margin, y, contentW * 0.52, 38, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text('TAGIHAN KEPADA', margin + 5, y + 7)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(26, 46, 10)
  doc.text(order.customer_name, margin + 5, y + 15)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(60, 60, 60)
  doc.text(`${order.gedung} - Lantai ${order.lantai}`, margin + 5, y + 22)
  if (order.phone) {
    doc.text(`WA/HP: ${order.phone}`, margin + 5, y + 29)
  }

  // Box kanan - Detail Invoice
  const rightX = margin + contentW * 0.56
  const rightW = contentW * 0.44
  doc.setFillColor(247, 247, 242)
  doc.roundedRect(rightX, y, rightW, 38, 2, 2, 'FD')

  const rows = [
    ['No. Invoice', invNo],
    ['Tanggal', new Date(order.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })],
    ['Metode Bayar', order.payment_method || 'Transfer'],
    ['Status', isLunas ? 'LUNAS' : 'BELUM LUNAS'],
  ]
  rows.forEach(([label, val], i) => {
    const ry = y + 8 + i * 7.5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(100, 100, 100)
    doc.text(label, rightX + 5, ry)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    if (label === 'Status') {
      if (isLunas) { doc.setTextColor(39, 174, 96) } else { doc.setTextColor(192, 57, 43) }
    } else {
      doc.setTextColor(30, 30, 30)
    }
    const valText = String(val)
    doc.text(valText, rightX + rightW - 5 - doc.getTextWidth(valText), ry)
  })

  y += 46

  // ── TABEL ITEM ──
  // Header tabel
  doc.setFillColor(26, 46, 10)
  doc.rect(margin, y, contentW, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text('No', margin + 3, y + 5.5)
  doc.text('Nama Produk', margin + 12, y + 5.5)
  doc.text('Qty', margin + contentW * 0.55, y + 5.5)
  doc.text('Harga Satuan', margin + contentW * 0.65, y + 5.5)
  doc.text('Subtotal', pageW - margin - doc.getTextWidth('Subtotal') - 3, y + 5.5)
  y += 8

  // Baris item
  const items = order.order_items || []
  items.forEach((item, idx) => {
    const rowH = 8
    const bg = idx % 2 === 0 ? [255, 255, 255] : [248, 248, 244]
    doc.setFillColor(...bg)
    doc.rect(margin, y, contentW, rowH, 'F')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(50, 50, 50)
    doc.text(String(idx + 1), margin + 3, y + 5.5)
    doc.text(item.product_name, margin + 12, y + 5.5)

    const qty = String(item.quantity)
    doc.text(qty, margin + contentW * 0.55 + 5, y + 5.5)

    const hargaSatuan = item.quantity > 0
      ? 'Rp ' + Number((item.subtotal || 0) / item.quantity).toLocaleString('id-ID')
      : '-'
    doc.text(hargaSatuan, margin + contentW * 0.65, y + 5.5)

    const sub = 'Rp ' + Number(item.subtotal || 0).toLocaleString('id-ID')
    doc.text(sub, pageW - margin - doc.getTextWidth(sub) - 3, y + 5.5)
    y += rowH
  })

  // Garis bawah tabel
  doc.setDrawColor(26, 46, 10)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageW - margin, y)
  y += 6

  // ── TOTAL ──
  const totalBoxX = margin + contentW * 0.55
  const totalBoxW = contentW * 0.45

  // Subtotal row
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(70, 70, 70)
  doc.text('Subtotal', totalBoxX, y + 5)
  const subtotalText = formatRp(order.total_amount)
  doc.text(subtotalText, pageW - margin - doc.getTextWidth(subtotalText) - 3, y + 5)
  y += 8

  // Garis tipis
  doc.setDrawColor(200, 200, 195)
  doc.setLineWidth(0.2)
  doc.line(totalBoxX, y, pageW - margin, y)
  y += 5

  // Total besar
  doc.setFillColor(26, 46, 10)
  doc.roundedRect(totalBoxX - 2, y, totalBoxW + 2, 12, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text('TOTAL', totalBoxX + 4, y + 8)
  const totalText = formatRp(order.total_amount)
  doc.setTextColor(232, 168, 56)
  doc.setFontSize(12)
  doc.text(totalText, pageW - margin - doc.getTextWidth(totalText) - 3, y + 8)
  y += 18

  // ── STEMPEL LUNAS (jika lunas) ──
  if (isLunas) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(32)
    doc.setTextColor(39, 174, 96)
    doc.setLineWidth(2.5)
    doc.setDrawColor(39, 174, 96)
    // Rotasi stempel
    doc.saveGraphicsState()
    const cx = margin + contentW * 0.25
    doc.text('✓ LUNAS', cx, y - 6, { angle: 10 })
    doc.restoreGraphicsState()
    doc.setLineWidth(0.3)
  }

  // ── INFO PEMBAYARAN ──
  y = isLunas ? y + 2 : y
  doc.setFillColor(235, 245, 228)
  doc.setDrawColor(180, 220, 160)
  doc.setLineWidth(0.3)
  const payBoxH = isLunas ? 24 : 36
  doc.roundedRect(margin, y, contentW * 0.52, payBoxH, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(26, 46, 10)
  doc.text(isLunas ? '✅ Pembayaran Telah Diterima' : '💳 Informasi Pembayaran', margin + 5, y + 8)

  if (isLunas) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(60, 60, 60)
    doc.text(`Terima kasih! Pembayaran sebesar ${formatRp(order.total_amount)}`, margin + 5, y + 15)
    doc.text(`telah kami terima dengan baik.`, margin + 5, y + 21)
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(60, 60, 60)
    doc.text('Transfer ke salah satu rekening berikut:', margin + 5, y + 15)
    KEDAI_INFO.rekening.forEach((rek, i) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(26, 46, 10)
      doc.text(`${rek.bank}  ${rek.no}`, margin + 5, y + 22 + i * 7)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(90, 90, 90)
      doc.text(`a.n. ${rek.atas_nama}`, margin + 5, y + 27 + i * 7)
    })
  }

  // ── CATATAN ──
  if (order.catatan) {
    const noteY = y + payBoxH + 6
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8.5)
    doc.setTextColor(100, 100, 100)
    doc.text(`Catatan: ${order.catatan}`, margin, noteY)
    y = noteY
  }

  // ── FOOTER ──
  const footerY = pageH - 18
  doc.setDrawColor(26, 46, 10)
  doc.setLineWidth(0.5)
  doc.line(margin, footerY - 4, pageW - margin, footerY - 4)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text(`${KEDAI_INFO.nama}  ·  ${KEDAI_INFO.alamat}  ·  WA: ${KEDAI_INFO.wa}`, pageW / 2, footerY, { align: 'center' })
  doc.text('Terima kasih atas kepercayaan Anda! 🙏', pageW / 2, footerY + 5, { align: 'center' })

  doc.save(`Invoice-${invNo.replace(/\//g, '-')}-${order.customer_name}.pdf`)
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
      fetchOrders(filterMode, dateFrom, dateTo, filterStatus)
    }
    autoFix()
  }, [])

  useEffect(() => {
    fetchOrders(filterMode, dateFrom, dateTo, filterStatus)
  }, [filterMode, dateFrom, dateTo, filterStatus])

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

  const tglPacking = filterMode === 'custom' && dateFrom ? dateFrom : todayStr()

  const ordersHariIni = orders.filter(o => {
    if (o.status === 'Batal') return false
    if (o.delivery_date) return o.delivery_date === tglPacking
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
      const estHeight = 16 + (o.order_items?.length || 0) * 5.5 + 10
      if (y + estHeight > 280) { doc.addPage(); y = 16 }

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
      if (o.phone) { doc.text(`No. HP  : ${o.phone}`, margin + 3.5, y); y += 5 }
      y += 1

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

      y += 1
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      const totalText = 'Total : Rp ' + Number(o.total_amount || 0).toLocaleString('id-ID')
      doc.text(totalText, pageWidth - margin - doc.getTextWidth(totalText) - 3.5, y)
      y += 6

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
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: '1rem' }}>
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
                          <div style={{ fontWeight: 600, color: '#1A2E0A' }}>
                            🚚 {o.delivery_date
                              ? new Date(o.delivery_date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' })
                              : new Date(o.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' })
                            }
                          </div>
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

            {/* Status badge lunas */}
            {selected.status === 'Selesai' && (
              <div style={{ margin: '10px 0 4px', background: '#E8F5E0', border: '1.5px solid #28A745', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>✅</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#28A745', fontSize: 13 }}>LUNAS</div>
                  <div style={{ fontSize: 11, color: '#555' }}>Pembayaran telah diterima</div>
                </div>
              </div>
            )}

            {/* Tombol Invoice */}
            <button
              onClick={() => downloadInvoicePDF(selected)}
              style={{
                width: '100%', marginTop: 12, padding: '10px 0',
                background: 'linear-gradient(135deg, #1A2E0A 0%, #2D5016 100%)',
                color: '#fff', border: 'none', borderRadius: 10,
                fontWeight: 700, fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 3px 10px rgba(26,46,10,0.3)'
              }}>
              🧾 Download Invoice PDF
            </button>

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
