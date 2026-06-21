import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SATUAN = ['gram', 'kg', 'ml', 'liter', 'pcs', 'sdm', 'sdt', 'sachet', 'buah', 'siung', 'lembar', 'bungkus']

const KATEGORI_OPTIONS = [
  { key: 'utama', label: '🥩 Produk Utama' },
  { key: 'bumbu', label: '🧄 Bumbu & Rempah' },
  { key: 'kemasan', label: '📦 Kemasan' },
  { key: 'lainnya', label: '📝 Lainnya' },
]

const KATEGORI_ORDER = { utama: 1, bumbu: 2, kemasan: 3, lainnya: 4 }
const KATEGORI_STYLE = {
  utama:   { color: '#2D5016', bg: '#E8F5E0' },
  bumbu:   { color: '#C8881A', bg: '#FFF3D6' },
  kemasan: { color: '#0077B6', bg: '#E0F4FF' },
  lainnya: { color: '#555555', bg: '#F0F0F0' },
}

export default function Resep() {
  const [products, setProducts] = useState([])
  const [materials, setMaterials] = useState([])
  const [recipes, setRecipes] = useState({})
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newItem, setNewItem] = useState({
    raw_material_id: '', qty_used: '', unit: 'gram', kategori: 'utama'
  })

  const loadAll = async () => {
    const [p, m, r] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('raw_materials').select('*').order('name'),
      supabase.from('recipes').select('*'),
    ])
    setProducts(p.data || [])
    setMaterials(m.data || [])
    const grouped = {}
    ;(r.data || []).forEach(rec => {
      if (!grouped[rec.product_id]) grouped[rec.product_id] = []
      grouped[rec.product_id].push(rec)
    })
    setRecipes(grouped)
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  const reloadProduct = async (pid) => {
    const { data } = await supabase.from('recipes').select('*').eq('product_id', pid)
    setRecipes(r => ({ ...r, [pid]: data || [] }))
  }

  const addBahan = async () => {
    if (!selected || !newItem.raw_material_id || !newItem.qty_used) {
      alert('Pilih bahan dan isi jumlah!')
      return
    }
    setSaving(true)
    const mat = materials.find(m => m.id === newItem.raw_material_id)

    const payload = {
      product_id: selected.id,
      raw_material_id: newItem.raw_material_id,
      material_name: mat.name,
      qty_used: parseFloat(newItem.qty_used),
      unit: newItem.unit,
    }

    const { error } = await supabase.from('recipes').insert(payload)
    if (error) {
      alert('Gagal menyimpan: ' + error.message)
    } else {
      await reloadProduct(selected.id)
      setNewItem({ raw_material_id: '', qty_used: '', unit: 'gram', kategori: 'utama' })
    }
    setSaving(false)
  }

  const removeBahan = async (recipeId, pid, nama) => {
    if (!window.confirm(`Hapus "${nama}"?`)) return
    await supabase.from('recipes').delete().eq('id', recipeId)
    await reloadProduct(pid)
  }

  // Urutkan: tampilkan dalam urutan yang ditambahkan (by created_at/id)
  // User bisa tandai dengan nama bahan (kemasan biasanya paperbowl, sendok, kresek, stiker)
  const getGrouped = (pid) => {
    const recs = recipes[pid] || []
    const utama = recs.filter(r => !isKemasan(r) && !isBumbu(r))
    const bumbu = recs.filter(r => isBumbu(r))
    const kemasan = recs.filter(r => isKemasan(r))
    return { utama, bumbu, kemasan }
  }

  // Deteksi otomatis kategori berdasarkan nama bahan
  const isKemasan = (r) => {
    const n = r.material_name.toLowerCase()
    return ['bowl','sendok','kresek','stiker','label','plastik','kertas','box','cup','sedotan','tissue'].some(k => n.includes(k))
  }

  const isBumbu = (r) => {
    const n = r.material_name.toLowerCase()
    return ['bawang','lada','garam','gula','kecap','saos','saus','minyak','totole','kaldu','merica','kunyit','jahe','serai','daun','cabe','cabai','kemiri','ketumbar'].some(k => n.includes(k))
  }

  const filteredProducts = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  )

  const renderGroup = (label, style, items, pid) => {
    if (items.length === 0) return null
    return (
      <div key={label} style={{ marginBottom: 14 }}>
        <div style={{ display: 'inline-block', background: style.bg, color: style.color, fontWeight: 700, fontSize: 11, padding: '3px 10px', borderRadius: 6, marginBottom: 6 }}>
          {label}
        </div>
        <table className="table" style={{ marginBottom: 0 }}>
          <thead>
            <tr><th>Bahan</th><th>Jumlah</th><th>Satuan</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((r, i) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 500 }}>
                  <span style={{ color: style.color, fontWeight: 700, marginRight: 6, fontSize: 11 }}>{i+1}.</span>
                  {r.material_name}
                </td>
                <td>{r.qty_used}</td>
                <td style={{ color: 'var(--text-muted)' }}>{r.unit}</td>
                <td>
                  <button className="btn btn-sm btn-danger" onClick={() => removeBahan(r.id, pid, r.material_name)}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1>Manajemen Resep 📖</h1>
        <p>Urutan otomatis: Produk Utama → Bumbu & Rempah → Kemasan</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1rem' }}>
        {/* List produk */}
        <div>
          <div className="card mb-1" style={{ padding: '0.75rem' }}>
            <input className="form-control" placeholder="🔍 Cari menu..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="card" style={{ padding: 0, maxHeight: '70vh', overflowY: 'auto' }}>
            {loading ? <div className="loading"><div className="spinner" /></div>
              : filteredProducts.map(p => (
                <button key={p.id} onClick={() => setSelected(p)}
                  style={{
                    width: '100%', padding: '11px 16px',
                    background: selected?.id === p.id ? 'var(--primary-light)' : 'transparent',
                    border: 'none', borderBottom: '1px solid var(--border)',
                    textAlign: 'left', cursor: 'pointer', fontSize: 13,
                    fontWeight: selected?.id === p.id ? 700 : 400,
                    color: selected?.id === p.id ? 'var(--primary-dark)' : 'var(--text)',
                  }}>
                  {p.name}
                  {(recipes[p.id] || []).length > 0 && (
                    <span style={{ float: 'right', fontSize: 11, color: 'var(--text-muted)' }}>
                      {(recipes[p.id] || []).length} bahan
                    </span>
                  )}
                </button>
              ))
            }
          </div>
        </div>

        {/* Detail resep */}
        <div>
          {!selected ? (
            <div className="card empty-state">
              <p>Pilih menu di kiri untuk melihat resepnya</p>
            </div>
          ) : (
            <div className="card">
              <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{selected.name}</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                Kategori terdeteksi otomatis dari nama bahan 💡
              </p>

              {(recipes[selected.id] || []).length === 0 ? (
                <div className="alert alert-info">Belum ada bahan. Tambahkan di bawah.</div>
              ) : (() => {
                const { utama, bumbu, kemasan } = getGrouped(selected.id)
                const sisa = (recipes[selected.id] || []).filter(r => !isKemasan(r) && !isBumbu(r) && !utama.includes(r))
                return (
                  <div style={{ marginBottom: 16 }}>
                    {renderGroup('🥩 Produk Utama', KATEGORI_STYLE.utama, utama, selected.id)}
                    {renderGroup('🧄 Bumbu & Rempah', KATEGORI_STYLE.bumbu, bumbu, selected.id)}
                    {renderGroup('📦 Kemasan', KATEGORI_STYLE.kemasan, kemasan, selected.id)}
                  </div>
                )
              })()}

              {/* Form tambah bahan */}
              <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '1rem', marginTop: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>+ TAMBAH BAHAN</div>

                <div className="alert alert-info mb-2" style={{ fontSize: 11, padding: '6px 10px' }}>
                  💡 Kategori ditentukan otomatis dari nama bahan. Kemasan: bowl, sendok, kresek, stiker, dll.
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ margin: 0, flex: 3, minWidth: 180 }}>
                    <label className="form-label">Pilih Bahan</label>
                    <select className="form-control" value={newItem.raw_material_id}
                      onChange={e => setNewItem(i => ({ ...i, raw_material_id: e.target.value }))}>
                      <option value="">-- Pilih bahan baku --</option>
                      {materials.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 90 }}>
                    <label className="form-label">Jumlah</label>
                    <input className="form-control" type="number" step="0.001" placeholder="0"
                      value={newItem.qty_used}
                      onChange={e => setNewItem(i => ({ ...i, qty_used: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 90 }}>
                    <label className="form-label">Satuan</label>
                    <select className="form-control" value={newItem.unit}
                      onChange={e => setNewItem(i => ({ ...i, unit: e.target.value }))}>
                      {SATUAN.map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <button className="btn btn-primary" onClick={addBahan} disabled={saving}>
                      {saving ? '⏳' : '+ Tambah'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
