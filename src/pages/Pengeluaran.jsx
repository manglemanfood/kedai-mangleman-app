import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { usePINConfirm } from '../components/PINModal'

const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
const CATEGORIES = ['Bahan Baku', 'Kemasan', 'Ongkir Supplier', 'Operasional', 'Gaji', 'Lainnya']
const CAT_ICON = { 'Bahan Baku': '🥩', 'Kemasan': '📦', 'Ongkir Supplier': '🚚', 'Operasional': '⚡', 'Gaji': '👤', 'Lainnya': '📝' }

const emptyForm = { category: 'Bahan Baku', description: '', amount: '', supplier: '', expense_date: new Date().toISOString().split('T')[0] }

export default function Pengeluaran() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [filterCat, setFilterCat] = useState('Semua')
  const [filterDate, setFilterDate] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const { requestPIN, PINGate } = usePINConfirm('pengeluaran')

  const fetchExpenses = async () => {
    setLoading(true)
    let q = supabase.from('expenses').select('*').order('expense_date', { ascending: false }).order('created_at', { ascending: false })
    if (filterCat !== 'Semua') q = q.eq('category', filterCat)
    if (filterDate) q = q.eq('expense_date', filterDate)
    const { data } = await q
    setExpenses(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchExpenses() }, [filterCat, filterDate])

  const openAdd = () => { setEditItem(null); setForm(emptyForm); setShowForm(true) }
  const openEdit = (e) => { setEditItem(e); setForm({ category: e.category, description: e.description, amount: e.amount, supplier: e.supplier || '', expense_date: e.expense_date }); setShowForm(true) }

  const save = async () => {
    if (!form.description || !form.amount) return alert('Deskripsi dan jumlah wajib diisi!')
    setSaving(true)
    const data = { ...form, amount: parseInt(form.amount) }
    if (editItem) await supabase.from('expenses').update(data).eq('id', editItem.id)
    else await supabase.from('expenses').insert(data)
    setShowForm(false); setEditItem(null)
    fetchExpenses(); setSaving(false)
  }

  const remove = async (e) => {
    const ok = await requestPIN(`pengeluaran "${e.description}"`)
    if (!ok) return
    await supabase.from('expenses').delete().eq('id', e.id)
    fetchExpenses()
  }

  const totalAll = expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div>
      <PINGate />
      <div className="page-header flex-between">
        <div><h1>Pengeluaran Toko 💸</h1><p>Catat semua pengeluaran operasional</p></div>
        <button className="btn btn-primary" onClick={openAdd}>+ Input Pengeluaran</button>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex-between mb-2">
              <h3 style={{ fontWeight: 700 }}>{editItem ? '✏️ Edit' : 'Input'} Pengeluaran</h3>
              <button onClick={() => { setShowForm(false); setEditItem(null) }} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Kategori</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setForm(f => ({ ...f, category: cat }))} className="btn btn-sm" style={{ background: form.category === cat ? '#1A2E0A' : 'transparent', color: form.category === cat ? '#fff' : 'var(--text)', border: '1px solid var(--border)', justifyContent: 'flex-start' }}>
                    {CAT_ICON[cat]} {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group"><label className="form-label">Deskripsi *</label><input className="form-control" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Jumlah (Rp) *</label><input className="form-control" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Tanggal</label><input className="form-control" type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} /></div>
            </div>
            <div className="form-group"><label className="form-label">Supplier</label><input className="form-control" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} /></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setShowForm(false); setEditItem(null) }}>Batal</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : '💾 Simpan'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="card mb-2" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="form-control" style={{ width: 'auto' }} />
          {filterDate && <button className="btn btn-sm btn-outline" onClick={() => setFilterDate('')}>✕ Reset</button>}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['Semua', ...CATEGORIES].map(c => (
              <button key={c} onClick={() => setFilterCat(c)} className="btn btn-sm" style={{ background: filterCat === c ? '#1A2E0A' : 'transparent', color: filterCat === c ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}>{c}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div className="loading"><div className="spinner" /></div> : expenses.length === 0 ? <div className="empty-state"><p>Belum ada pengeluaran</p></div> : (
          <table className="table">
            <thead><tr><th>Tanggal</th><th>Kategori</th><th>Deskripsi</th><th>Supplier</th><th>Jumlah</th><th>Aksi</th></tr></thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id}>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(e.expense_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                  <td style={{ fontSize: 13 }}>{CAT_ICON[e.category]} {e.category}</td>
                  <td style={{ fontSize: 13 }}>{e.description}</td>
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
