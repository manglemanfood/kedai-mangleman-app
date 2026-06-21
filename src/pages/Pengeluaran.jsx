import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const formatRp = (n) => 'Rp ' + Number(Math.abs(n || 0)).toLocaleString('id-ID')

const CATEGORIES = ['Bahan Baku', 'Kemasan', 'Ongkir Supplier', 'Operasional', 'Gaji', 'Lainnya']
const CAT_ICON = { 'Bahan Baku':'🥩','Kemasan':'📦','Ongkir Supplier':'🚚','Operasional':'⚡','Gaji':'👤','Lainnya':'📝' }
const SATUAN = ['gram','kg','ml','liter','pcs','pack','lusin','box','karton','lembar','buah','sachet','bungkus']

// Deteksi apakah bahan ini bahan baku atau kemasan
const detectMaterialType = (description) => {
  const d = description.toLowerCase()
  const kemasan = ['bowl','paperbowl','sendok','kresek','stiker','label','plastik','kertas','box','cup','sedotan','tissue','tisu','kantong','bungkus']
  const bahanBaku = ['ayam','lele','ikan','beras','tepung','minyak','bawang','telur','saos','kecap','gula','garam','susu','keju','mentega','juice','buah','sayur']
  if (kemasan.some(k => d.includes(k))) return 'kemasan'
  if (bahanBaku.some(k => d.includes(k))) return 'bahan_baku'
  return null
}

const emptyForm = {
  category: 'Bahan Baku',
  description: '',
  amount: '',
  supplier: '',
  expense_date: new Date().toISOString().split('T')[0],
  // Berat/qty yang dibeli
  qty_beli: '',
  satuan_beli: 'gram',
  sync_stok: false,
}

export default function Pengeluaran() {
  const [expenses, setExpenses] = useState([])
  const [materials, setMaterials] = useState([]) // untuk sync stok
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [filterCat, setFilterCat] = useState('Semua')
  const [filterDate, setFilterDate] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  const fetchExpenses = async () => {
    setLoading(true)
    let q = supabase.from('expenses').select('*')
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (filterCat !== 'Semua') q = q.eq('category', filterCat)
    if (filterDate) q = q.eq('expense_date', filterDate)
    const { data } = await q
    setExpenses(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchExpenses()
    // Load raw_materials untuk dropdown sync
    supabase.from('raw_materials').select('*').order('name').then(({ data }) => {
      setMaterials(data || [])
    })
  }, [filterCat, filterDate])

  const openAdd = () => {
    setEditItem(null)
    setForm(emptyForm)
    setSyncMsg('')
    setShowForm(true)
  }

  const openEdit = (e) => {
    setEditItem(e)
    setForm({
      category: e.category,
      description: e.description,
      amount: e.amount,
      supplier: e.supplier || '',
      expense_date: e.expense_date,
      qty_beli: e.qty_beli || '',
      satuan_beli: e.satuan_beli || 'gram',
      sync_stok: false,
    })
    setSyncMsg('')
    setShowForm(true)
  }

  const save = async () => {
    if (!form.description || !form.amount) return alert('Deskripsi dan jumlah wajib diisi!')
    setSaving(true)
    setSyncMsg('')

    const data = {
      category: form.category,
      description: form.description,
      amount: parseInt(form.amount),
      supplier: form.supplier,
      expense_date: form.expense_date,
      qty_beli: form.qty_beli ? parseFloat(form.qty_beli) : null,
      satuan_beli: form.satuan_beli,
    }

    if (editItem) {
      await supabase.from('expenses').update(data).eq('id', editItem.id)
    } else {
      await supabase.from('expenses').insert(data)
    }

    // Sync stok otomatis jika ada qty_beli
    if (form.qty_beli && parseFloat(form.qty_beli) > 0 && form.sync_stok) {
      const qty = parseFloat(form.qty_beli)
      const desc = form.description.toLowerCase()

      // Cari bahan baku yang cocok berdasarkan nama
      const matchMat = materials.find(m => {
        const mName = m.name.toLowerCase()
        return desc.includes(mName) || mName.includes(desc.split(' ')[0])
      })

      if (matchMat) {
        // Konversi satuan jika perlu
        let addQty = qty
        if (form.satuan_beli === 'gram' && matchMat.unit === 'kg') addQty = qty / 1000
        else if (form.satuan_beli === 'kg' && matchMat.unit === 'gram') addQty = qty * 1000
        else if (form.satuan_beli === 'ml' && matchMat.unit === 'liter') addQty = qty / 1000
        else if (form.satuan_beli === 'liter' && matchMat.unit === 'ml') addQty = qty * 1000
        else if (form.satuan_beli === matchMat.unit) addQty = qty

        const newStock = (matchMat.stock_qty || 0) + addQty
        await supabase.from('raw_materials').update({
          stock_qty: newStock,
          last_price: Math.round(parseInt(form.amount) / qty),
        }).eq('id', matchMat.id)

        setSyncMsg(`✅ Stok "${matchMat.name}" bertambah ${addQty} ${matchMat.unit} → total ${newStock.toFixed(2)} ${matchMat.unit}`)
      } else {
        setSyncMsg(`⚠️ Bahan "${form.description}" tidak ditemukan di Stok. Tambahkan manual di menu Stok.`)
      }
    }

    await fetchExpenses()
    setSaving(false)

    if (form.sync_stok && form.qty_beli) {
      // Tetap buka form untuk tampilkan pesan sync
      setTimeout(() => {
        setShowForm(false)
        setEditItem(null)
        setSyncMsg('')
      }, 3000)
    } else {
      setShowForm(false)
      setEditItem(null)
    }
  }

  const remove = async (e) => {
    if (!window.confirm(`Hapus pengeluaran "${e.description}"?`)) return
    await supabase.from('expenses').delete().eq('id', e.id)
    fetchExpenses()
  }

  const filtered = expenses.filter(e => {
    if (!search) return true
    return e.description.toLowerCase().includes(search.toLowerCase()) ||
      (e.supplier || '').toLowerCase().includes(search.toLowerCase())
  })

  const totalAll = filtered.reduce((s, e) => s + e.amount, 0)
  const byCategory = CATEGORIES.map(cat => ({
    cat, total: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
    count: expenses.filter(e => e.category === cat).length,
  })).filter(c => c.count > 0)

  // Deteksi tipe sync berdasarkan deskripsi
  const syncType = form.description ? detectMaterialType(form.description) : null

  return (
    <div>
      <div className="page-header flex-between">
        <div>
          <h1>Pengeluaran Toko 💸</h1>
          <p>Catat pengeluaran + sync stok otomatis</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Input Pengeluaran</button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: '1rem' }}>
        {byCategory.map(c => (
          <div key={c.cat} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 150px' }}>
            <span style={{ fontSize: 22 }}>{CAT_ICON[c.cat]}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{formatRp(c.total)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.cat} ({c.count})</div>
            </div>
          </div>
        ))}
        {byCategory.length > 0 && (
          <div className="card" style={{ padding: '12px 16px', flex: '1 1 150px', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--primary-light)' }}>
            <span style={{ fontSize: 22 }}>💰</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary-dark)' }}>{formatRp(totalAll)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total</div>
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: 500, maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="flex-between mb-2">
              <h3 style={{ fontWeight: 700 }}>{editItem ? '✏️ Edit' : 'Input'} Pengeluaran</h3>
              <button onClick={() => { setShowForm(false); setEditItem(null); setSyncMsg('') }} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            {/* Sync message */}
            {syncMsg && (
              <div style={{ padding: '10px 12px', borderRadius: 8, marginBottom: 12, fontSize: 13, background: syncMsg.startsWith('✅') ? '#E8F5E0' : '#FFF3D6', color: syncMsg.startsWith('✅') ? '#2D5016' : '#C8881A', fontWeight: 500 }}>
                {syncMsg}
              </div>
            )}

            {/* Kategori */}
            <div className="form-group">
              <label className="form-label">Kategori</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setForm(f => ({ ...f, category: cat }))}
                    className="btn btn-sm"
                    style={{ background: form.category === cat ? '#1A2E0A' : 'transparent', color: form.category === cat ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}>
                    {CAT_ICON[cat]} {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Deskripsi *</label>
              <input className="form-control" placeholder="Cth: Ayam Paha Fillet, Paperbowl, Gas 3kg"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              {syncType && (
                <p style={{ fontSize: 11, marginTop: 3, color: syncType === 'kemasan' ? '#0077B6' : '#2D5016' }}>
                  {syncType === 'kemasan' ? '📦 Terdeteksi: Kemasan' : '🥩 Terdeteksi: Bahan Baku'}
                  {' '}— aktifkan Sync Stok di bawah
                </p>
              )}
            </div>

            {/* Qty yang dibeli - FIFO */}
            <div style={{ background: '#E8F5E0', borderRadius: 10, padding: '12px', marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#2D5016', marginBottom: 8 }}>
                📦 Jumlah / Berat yang Dibeli
              </div>
              <div className="grid-2" style={{ gap: 8 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Jumlah</label>
                  <input className="form-control" type="number" step="0.001"
                    placeholder="Cth: 543 atau 500"
                    value={form.qty_beli}
                    onChange={e => setForm(f => ({ ...f, qty_beli: e.target.value }))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Satuan</label>
                  <select className="form-control" value={form.satuan_beli}
                    onChange={e => setForm(f => ({ ...f, satuan_beli: e.target.value }))}>
                    {SATUAN.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Preview: harga per satuan */}
              {form.qty_beli && form.amount && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#2D5016', background: '#fff', borderRadius: 6, padding: '6px 10px' }}>
                  💡 Harga per {form.satuan_beli}: <strong>{formatRp(Math.round(parseInt(form.amount || 0) / parseFloat(form.qty_beli || 1)))}</strong>
                </div>
              )}

              {/* Toggle sync stok */}
              {form.qty_beli && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.sync_stok}
                    onChange={e => setForm(f => ({ ...f, sync_stok: e.target.checked }))} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#2D5016' }}>
                    🔄 Sync otomatis ke Stok Bahan Baku
                  </span>
                </label>
              )}

              {form.sync_stok && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#2D5016', fontStyle: 'italic' }}>
                  Sistem akan mencocokkan nama deskripsi dengan nama bahan di menu Stok dan menambah stoknya otomatis.
                </div>
              )}
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Jumlah (Rp) *</label>
                <input className="form-control" type="number" placeholder="0"
                  value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Tanggal</label>
                <input className="form-control" type="date" value={form.expense_date}
                  onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Supplier / Keterangan</label>
              <input className="form-control" placeholder="Cth: Pak Budi, Tokopedia, Pasar"
                value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setShowForm(false); setEditItem(null); setSyncMsg('') }}>Batal</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={save} disabled={saving}>
                {saving ? 'Menyimpan...' : '💾 Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="card mb-2" style={{ padding: '1rem' }}>
        <div style={{ marginBottom: 10 }}>
          <input className="form-control" placeholder="🔍 Cari deskripsi atau supplier..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            className="form-control" style={{ width: 'auto' }} />
          {filterDate && <button className="btn btn-sm btn-outline" onClick={() => setFilterDate('')}>✕ Reset</button>}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['Semua', ...CATEGORIES].map(c => (
              <button key={c} onClick={() => setFilterCat(c)} className="btn btn-sm"
                style={{ background: filterCat === c ? '#1A2E0A' : 'transparent', color: filterCat === c ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><p>Belum ada pengeluaran</p></div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Kategori</th>
                <th>Deskripsi</th>
                <th>Qty Beli</th>
                <th>Supplier</th>
                <th>Jumlah</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id}>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(e.expense_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </td>
                  <td style={{ fontSize: 13 }}>{CAT_ICON[e.category]} {e.category}</td>
                  <td style={{ fontSize: 13 }}>{e.description}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {e.qty_beli ? `${e.qty_beli} ${e.satuan_beli}` : '-'}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.supplier || '-'}</td>
                  <td style={{ fontWeight: 700, color: 'var(--danger)' }}>{formatRp(e.amount)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-sm btn-outline" onClick={() => openEdit(e)}>✏️</button>
                      <button className="btn btn-sm btn-danger" onClick={() => remove(e)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
