import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { usePINConfirm } from '../components/PINModal'

const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
const UNITS = ['kg', 'gram', 'liter', 'ml', 'pcs', 'sachet', 'bungkus', 'buah', 'siung', 'lembar']

export default function Stok() {
  const [materials, setMaterials] = useState([])
  const [products, setProducts] = useState([])
  const [tab, setTab] = useState('bahan')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ name: '', unit: 'kg', stock_qty: '', min_stock: '', last_price: '' })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const { requestPIN, PINGate } = usePINConfirm('stok')

  const fetchAll = async () => {
    setLoading(true)
    const [mat, prod] = await Promise.all([
      supabase.from('raw_materials').select('*').order('name'),
      supabase.from('products').select('*').order('category'),
    ])
    setMaterials(mat.data || [])
    setProducts(prod.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const openAdd = () => { setEditItem(null); setForm({ name: '', unit: 'kg', stock_qty: '', min_stock: '', last_price: '' }); setShowForm(true) }
  const openEdit = (item) => { setEditItem(item); setForm({ name: item.name, unit: item.unit, stock_qty: item.stock_qty, min_stock: item.min_stock, last_price: item.last_price }); setShowForm(true) }

  const save = async () => {
    if (!form.name) return alert('Nama bahan wajib diisi!')
    setSaving(true)
    const data = { name: form.name, unit: form.unit, stock_qty: parseFloat(form.stock_qty) || 0, min_stock: parseFloat(form.min_stock) || 0, last_price: parseInt(form.last_price) || 0 }
    if (editItem) await supabase.from('raw_materials').update(data).eq('id', editItem.id)
    else await supabase.from('raw_materials').insert(data)
    setShowForm(false); fetchAll(); setSaving(false)
  }

  const deleteMaterial = async (m) => {
    const ok = await requestPIN(`bahan "${m.name}"`)
    if (!ok) return
    await supabase.from('raw_materials').delete().eq('id', m.id)
    fetchAll()
  }

  const deleteProduct = async (p) => {
    const ok = await requestPIN(`menu "${p.name}"`)
    if (!ok) return
    await supabase.from('products').delete().eq('id', p.id)
    fetchAll()
  }

  const updateStock = async (id, delta) => {
    const item = materials.find(m => m.id === id)
    const newQty = Math.max(0, (item.stock_qty || 0) + delta)
    await supabase.from('raw_materials').update({ stock_qty: newQty }).eq('id', id)
    fetchAll()
  }

  const toggleProduct = async (id, val) => {
    await supabase.from('products').update({ is_available: val }).eq('id', id)
    fetchAll()
  }

  const updateProductStock = async (id, qty) => {
    await supabase.from('products').update({ stock_ready: qty }).eq('id', id)
    fetchAll()
  }

  const lowStock = materials.filter(m => m.stock_qty <= m.min_stock && m.min_stock > 0)

  return (
    <div>
      <PINGate />
      <div className="page-header flex-between">
        <div><h1>Stok & Inventory 📦</h1><p>Monitor bahan baku dan ketersediaan menu</p></div>
        {tab === 'bahan' && <button className="btn btn-primary" onClick={openAdd}>+ Tambah Bahan</button>}
      </div>

      {lowStock.length > 0 && <div className="alert alert-warning">⚠️ <strong>{lowStock.length} bahan</strong> hampir habis: {lowStock.map(m => m.name).join(', ')}</div>}

      <div className="tabs">
        <button className={`tab ${tab === 'bahan' ? 'active' : ''}`} onClick={() => setTab('bahan')}>🥩 Bahan Baku ({materials.length})</button>
        <button className={`tab ${tab === 'menu' ? 'active' : ''}`} onClick={() => setTab('menu')}>🍱 Stok Menu ({products.length})</button>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: 420 }}>
            <div className="flex-between mb-2"><h3 style={{ fontWeight: 700 }}>{editItem ? '✏️ Edit' : 'Tambah'} Bahan Baku</h3><button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button></div>
            <div className="form-group"><label className="form-label">Nama Bahan *</label><input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Stok Sekarang</label><input className="form-control" type="number" step="0.001" value={form.stock_qty} onChange={e => setForm(f => ({ ...f, stock_qty: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Satuan</label><select className="form-control" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>{UNITS.map(u => <option key={u}>{u}</option>)}</select></div>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Stok Minimal</label><input className="form-control" type="number" step="0.001" value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Harga Terakhir (Rp)</label><input className="form-control" type="number" value={form.last_price} onChange={e => setForm(f => ({ ...f, last_price: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Batal</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : '💾 Simpan'}</button>
            </div>
          </div>
        </div>
      )}

      {loading ? <div className="loading"><div className="spinner" /></div> : (
        <>
          {tab === 'bahan' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {materials.length === 0 ? <div className="empty-state"><p>Belum ada bahan baku</p></div> : (
                <table className="table">
                  <thead><tr><th>Nama Bahan</th><th>Stok</th><th>Stok Min</th><th>Harga</th><th>Status</th><th>Aksi</th></tr></thead>
                  <tbody>
                    {materials.map(m => {
                      const isLow = m.stock_qty <= m.min_stock && m.min_stock > 0
                      return (
                        <tr key={m.id}>
                          <td style={{ fontWeight: 600 }}>{m.name}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button onClick={() => updateStock(m.id, -1)} style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid var(--border)', background: '#fff', cursor: 'pointer' }}>−</button>
                              <span style={{ fontWeight: 700, minWidth: 60, textAlign: 'center' }}>{m.stock_qty} {m.unit}</span>
                              <button onClick={() => updateStock(m.id, 1)} style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer' }}>+</button>
                            </div>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.min_stock} {m.unit}</td>
                          <td style={{ fontSize: 13 }}>{formatRp(m.last_price)}</td>
                          <td><span className={`badge ${isLow ? 'badge-danger' : 'badge-success'}`}>{isLow ? '⚠️ Hampir Habis' : '✅ Aman'}</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn btn-sm btn-outline" onClick={() => openEdit(m)}>✏️</button>
                              <button className="btn btn-sm btn-danger" onClick={() => deleteMaterial(m)}>🗑</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === 'menu' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="table">
                <thead><tr><th>Menu</th><th>Harga</th><th>Stok Ready</th><th>Tersedia</th><th>Aksi</th></tr></thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td style={{ fontWeight: 600 }}>{formatRp(p.price)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button onClick={() => updateProductStock(p.id, Math.max(0, (p.stock_ready || 0) - 1))} style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid var(--border)', background: '#fff', cursor: 'pointer' }}>−</button>
                          <span style={{ fontWeight: 700, minWidth: 30, textAlign: 'center' }}>{p.stock_ready || 0}</span>
                          <button onClick={() => updateProductStock(p.id, (p.stock_ready || 0) + 1)} style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer' }}>+</button>
                        </div>
                      </td>
                      <td><button onClick={() => toggleProduct(p.id, !p.is_available)} className={`btn btn-sm ${p.is_available ? 'btn-secondary' : 'btn-outline'}`}>{p.is_available ? '✅ Aktif' : '❌ Nonaktif'}</button></td>
                      <td><button className="btn btn-sm btn-danger" onClick={() => deleteProduct(p)}>🗑</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
