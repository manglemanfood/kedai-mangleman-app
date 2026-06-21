import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')

// ==================== MANAJEMEN MENU ====================
export default function ManajemenMenu() {
  const [products, setProducts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ name: '', category: 'ricebowl', price: '', hpp: '', is_available: true })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const categories = ['ricebowl','mie','dimsum','minuman','snack']
  const catLabel = { ricebowl:'🍚 Rice Bowl', mie:'🍜 Mie', dimsum:'🥟 Dimsum', minuman:'🥤 Minuman', snack:'🍿 Snack' }

  const fetchProducts = async () => {
    setLoading(true)
    const { data } = await supabase.from('products').select('*').order('category').order('name')
    setProducts(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchProducts() }, [])

  const openAdd = () => { setEditItem(null); setForm({ name: '', category: 'ricebowl', price: '', hpp: '', is_available: true }); setShowForm(true) }
  const openEdit = (p) => { setEditItem(p); setForm({ name: p.name, category: p.category, price: p.price, hpp: p.hpp || '', is_available: p.is_available }); setShowForm(true) }

  const save = async () => {
    if (!form.name || !form.price) return alert('Nama dan harga wajib diisi!')
    setSaving(true)
    const data = { name: form.name, category: form.category, price: parseInt(form.price), hpp: parseInt(form.hpp) || 0, is_available: form.is_available }
    if (editItem) await supabase.from('products').update(data).eq('id', editItem.id)
    else await supabase.from('products').insert(data)
    setShowForm(false)
    fetchProducts()
    setSaving(false)
  }

  const remove = async (id) => {
    if (!window.confirm('Hapus menu ini?')) return
    await supabase.from('products').delete().eq('id', id)
    fetchProducts()
  }

  const grouped = categories.reduce((acc, cat) => {
    acc[cat] = products.filter(p => p.category === cat)
    return acc
  }, {})

  return (
    <div>
      <div className="page-header flex-between">
        <div><h1>Manajemen Menu 🍱</h1><p>Kelola daftar menu yang tampil di form order customer</p></div>
        <button className="btn btn-primary" onClick={openAdd}>+ Tambah Menu</button>
      </div>
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: 420 }}>
            <div className="flex-between mb-2">
              <h3 style={{ fontWeight: 700 }}>{editItem ? 'Edit' : 'Tambah'} Menu</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Nama Menu *</label>
              <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Cth: Ricebowl Lele Goreng" />
            </div>
            <div className="form-group">
              <label className="form-label">Kategori</label>
              <select className="form-control" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {categories.map(c => <option key={c} value={c}>{catLabel[c]}</option>)}
              </select>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Harga Jual (Rp) *</label>
                <input className="form-control" type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">HPP (Rp)</label>
                <input className="form-control" type="number" value={form.hpp} onChange={e => setForm(f => ({ ...f, hpp: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_available} onChange={e => setForm(f => ({ ...f, is_available: e.target.checked }))} />
                <span style={{ fontSize: 13 }}>Tampil di form order customer</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Batal</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : '💾 Simpan'}</button>
            </div>
          </div>
        </div>
      )}
      {loading ? <div className="loading"><div className="spinner" /></div> : (
        Object.entries(grouped).map(([cat, items]) => items.length === 0 ? null : (
          <div key={cat} className="card mb-2" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>{catLabel[cat]}</div>
            <table className="table">
              <thead><tr><th>Nama Menu</th><th>Harga Jual</th><th>HPP</th><th>Margin</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {items.map(p => {
                  const margin = p.price - (p.hpp || 0)
                  const marginPct = p.price > 0 && p.hpp > 0 ? ((margin / p.price) * 100).toFixed(0) : '-'
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td style={{ fontWeight: 600 }}>{formatRp(p.price)}</td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{p.hpp ? formatRp(p.hpp) : '-'}</td>
                      <td style={{ fontSize: 13 }}>{marginPct !== '-' ? <span style={{ color: parseFloat(marginPct) >= 20 ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>{marginPct}%</span> : '-'}</td>
                      <td><span className={`badge ${p.is_available ? 'badge-success' : 'badge-gray'}`}>{p.is_available ? '✅ Aktif' : '❌ Nonaktif'}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-sm btn-outline" onClick={() => openEdit(p)}>✏️</button>
                          <button className="btn btn-sm btn-danger" onClick={() => remove(p.id)}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  )
}
