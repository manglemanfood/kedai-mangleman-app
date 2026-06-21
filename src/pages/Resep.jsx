import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Kategori urutan bahan
const BAHAN_KATEGORI = [
  { key: 'utama', label: '🥩 Produk Utama', color: '#2D5016', bg: '#E8F5E0' },
  { key: 'bumbu', label: '🧄 Bumbu & Rempah', color: '#C8881A', bg: '#FFF3D6' },
  { key: 'kemasan', label: '📦 Kemasan', color: '#0077B6', bg: '#E0F4FF' },
  { key: 'lainnya', label: '📝 Lainnya', color: '#555', bg: '#F0F0F0' },
]

const SATUAN = ['gram', 'kg', 'ml', 'liter', 'pcs', 'sdm', 'sdt', 'sachet', 'buah', 'siung', 'lembar', 'bungkus']

export default function Resep() {
  const [products, setProducts] = useState([])
  const [materials, setMaterials] = useState([])
  const [recipes, setRecipes] = useState({})
  const [selected, setSelected] = useState(null)
  const [newIngredient, setNewIngredient] = useState({
    raw_material_id: '', qty_used: '', unit: 'gram', bahan_kategori: 'utama'
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('raw_materials').select('*').order('name'),
      supabase.from('recipes').select('*'),
    ]).then(([p, m, r]) => {
      setProducts(p.data || [])
      setMaterials(m.data || [])
      const grouped = {}
      ;(r.data || []).forEach(rec => {
        if (!grouped[rec.product_id]) grouped[rec.product_id] = []
        grouped[rec.product_id].push(rec)
      })
      setRecipes(grouped)
      setLoading(false)
    })
  }, [])

  const reloadRecipes = async (productId) => {
    const { data } = await supabase.from('recipes').select('*').eq('product_id', productId)
    setRecipes(r => ({ ...r, [productId]: data || [] }))
  }

  const addIngredient = async () => {
    if (!selected || !newIngredient.raw_material_id || !newIngredient.qty_used) return
    const mat = materials.find(m => m.id === newIngredient.raw_material_id)
    await supabase.from('recipes').insert({
      product_id: selected.id,
      raw_material_id: newIngredient.raw_material_id,
      material_name: mat.name,
      qty_used: parseFloat(newIngredient.qty_used),
      unit: newIngredient.unit,
      bahan_kategori: newIngredient.bahan_kategori || 'utama',
    })
    await reloadRecipes(selected.id)
    setNewIngredient({ raw_material_id: '', qty_used: '', unit: 'gram', bahan_kategori: 'utama' })
  }

  const removeIngredient = async (recipeId, productId, materialName) => {
    if (!window.confirm(`Hapus bahan "${materialName}" dari resep?`)) return
    await supabase.from('recipes').delete().eq('id', recipeId)
    await reloadRecipes(productId)
  }

  // Sort bahan: utama → bumbu → kemasan → lainnya
  const sortedRecipes = (productId) => {
    const recs = recipes[productId] || []
    const order = { utama: 0, bumbu: 1, kemasan: 2, lainnya: 3 }
    return [...recs].sort((a, b) => {
      const ka = order[a.bahan_kategori || 'lainnya'] ?? 3
      const kb = order[b.bahan_kategori || 'lainnya'] ?? 3
      return ka - kb
    })
  }

  const filteredProducts = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="page-header">
        <h1>Manajemen Resep 📖</h1>
        <p>Atur bahan per menu — urutan: Produk Utama → Bumbu → Kemasan</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1rem' }}>
        {/* Sidebar */}
        <div>
          <div className="card mb-1" style={{ padding: '0.75rem' }}>
            <input className="form-control" placeholder="🔍 Cari menu..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="card" style={{ padding: 0, maxHeight: '70vh', overflowY: 'auto' }}>
            {loading ? <div className="loading"><div className="spinner" /></div> :
              filteredProducts.length === 0 ? (
                <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>Tidak ditemukan</div>
              ) : filteredProducts.map(p => (
                <button key={p.id} onClick={() => setSelected(p)}
                  style={{ width: '100%', padding: '12px 16px', background: selected?.id === p.id ? 'var(--primary-light)' : 'transparent', border: 'none', borderBottom: '1px solid var(--border)', textAlign: 'left', cursor: 'pointer', fontSize: 13, fontWeight: selected?.id === p.id ? 700 : 400, color: selected?.id === p.id ? 'var(--primary-dark)' : 'var(--text)' }}>
                  {p.name}
                  {recipes[p.id]?.length > 0 && <span style={{ float: 'right', fontSize: 11, color: 'var(--text-muted)' }}>{recipes[p.id].length} bahan</span>}
                </button>
              ))
            }
          </div>
        </div>

        {/* Detail */}
        <div>
          {!selected ? (
            <div className="card empty-state"><p>Pilih menu di kiri untuk mengatur resepnya</p></div>
          ) : (
            <div className="card">
              <h3 style={{ marginBottom: 16, fontWeight: 700, fontSize: 16 }}>{selected.name}</h3>

              {/* Grouped by kategori */}
              {(recipes[selected.id] || []).length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>Belum ada bahan. Tambahkan di bawah.</p>
              ) : (
                <div style={{ marginBottom: 16 }}>
                  {BAHAN_KATEGORI.map(kat => {
                    const items = sortedRecipes(selected.id).filter(r => (r.bahan_kategori || 'lainnya') === kat.key)
                    if (items.length === 0) return null
                    return (
                      <div key={kat.key} style={{ marginBottom: 12 }}>
                        <div style={{ background: kat.bg, color: kat.color, fontWeight: 700, fontSize: 12, padding: '5px 10px', borderRadius: 6, marginBottom: 6, display: 'inline-block' }}>
                          {kat.label}
                        </div>
                        <table className="table">
                          <thead><tr><th>Bahan</th><th>Jumlah</th><th>Satuan</th><th></th></tr></thead>
                          <tbody>
                            {items.map(r => (
                              <tr key={r.id}>
                                <td style={{ fontWeight: 500 }}>{r.material_name}</td>
                                <td>{r.qty_used}</td>
                                <td>{r.unit}</td>
                                <td>
                                  <button className="btn btn-sm btn-danger" onClick={() => removeIngredient(r.id, selected.id, r.material_name)}>🗑</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Add ingredient */}
              <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '1rem' }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: 'var(--text-muted)' }}>+ TAMBAH BAHAN</div>
                <div className="form-group">
                  <label className="form-label">Kategori Bahan</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {BAHAN_KATEGORI.map(kat => (
                      <button key={kat.key} onClick={() => setNewIngredient(i => ({ ...i, bahan_kategori: kat.key }))}
                        className="btn btn-sm"
                        style={{ background: newIngredient.bahan_kategori === kat.key ? kat.color : 'transparent', color: newIngredient.bahan_kategori === kat.key ? '#fff' : kat.color, border: `1.5px solid ${kat.color}` }}>
                        {kat.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ margin: 0, flex: 2, minWidth: 160 }}>
                    <label className="form-label">Bahan</label>
                    <select className="form-control" value={newIngredient.raw_material_id} onChange={e => setNewIngredient(i => ({ ...i, raw_material_id: e.target.value }))}>
                      <option value="">Pilih bahan...</option>
                      {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 80 }}>
                    <label className="form-label">Jumlah</label>
                    <input className="form-control" type="number" step="0.001" placeholder="0" value={newIngredient.qty_used} onChange={e => setNewIngredient(i => ({ ...i, qty_used: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 80 }}>
                    <label className="form-label">Satuan</label>
                    <select className="form-control" value={newIngredient.unit} onChange={e => setNewIngredient(i => ({ ...i, unit: e.target.value }))}>
                      {SATUAN.map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                  <button className="btn btn-primary" onClick={addIngredient} style={{ marginBottom: 16 }}>+ Tambah</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
