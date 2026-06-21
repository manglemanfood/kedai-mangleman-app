import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')

// ==================== RESEP ====================
export default function Resep() {
  const [products, setProducts] = useState([])
  const [materials, setMaterials] = useState([])
  const [recipes, setRecipes] = useState({})
  const [selected, setSelected] = useState(null)
  const [newIngredient, setNewIngredient] = useState({ raw_material_id: '', qty_used: '', unit: 'gram' })
  const [loading, setLoading] = useState(true)

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

  const addIngredient = async () => {
    if (!selected || !newIngredient.raw_material_id || !newIngredient.qty_used) return
    const mat = materials.find(m => m.id === newIngredient.raw_material_id)
    await supabase.from('recipes').insert({
      product_id: selected.id,
      raw_material_id: newIngredient.raw_material_id,
      material_name: mat.name,
      qty_used: parseFloat(newIngredient.qty_used),
      unit: newIngredient.unit,
    })
    const { data } = await supabase.from('recipes').select('*').eq('product_id', selected.id)
    setRecipes(r => ({ ...r, [selected.id]: data }))
    setNewIngredient({ raw_material_id: '', qty_used: '', unit: 'gram' })
  }

  const removeIngredient = async (recipeId, productId, materialName) => {
    if (!window.confirm(`Hapus bahan "${materialName}" dari resep?`)) return
    await supabase.from('recipes').delete().eq('id', recipeId)
    const { data } = await supabase.from('recipes').select('*').eq('product_id', productId)
    setRecipes(r => ({ ...r, [productId]: data }))
  }

  return (
    <div>
      
      <div className="page-header"><h1>Manajemen Resep 📖</h1><p>Atur bahan-bahan untuk setiap menu</p></div>
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '1rem' }}>
        <div className="card" style={{ padding: 0, height: 'fit-content' }}>
          {loading ? <div className="loading"><div className="spinner" /></div> : products.map(p => (
            <button key={p.id} onClick={() => setSelected(p)} style={{ width: '100%', padding: '12px 16px', background: selected?.id === p.id ? 'var(--primary-light)' : 'transparent', border: 'none', borderBottom: '1px solid var(--border)', textAlign: 'left', cursor: 'pointer', fontSize: 13, fontWeight: selected?.id === p.id ? 700 : 400, color: selected?.id === p.id ? 'var(--primary-dark)' : 'var(--text)' }}>
              {p.name}
              {recipes[p.id]?.length > 0 && <span style={{ float: 'right', fontSize: 11, color: 'var(--text-muted)' }}>{recipes[p.id].length} bahan</span>}
            </button>
          ))}
        </div>
        <div>
          {!selected ? (
            <div className="card empty-state"><p>Pilih menu untuk melihat resepnya</p></div>
          ) : (
            <div className="card">
              <h3 style={{ marginBottom: 16, fontWeight: 700 }}>{selected.name}</h3>
              {(recipes[selected.id] || []).length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>Belum ada bahan. Tambahkan di bawah.</p>
              ) : (
                <table className="table" style={{ marginBottom: 16 }}>
                  <thead><tr><th>Bahan</th><th>Jumlah</th><th>Satuan</th><th></th></tr></thead>
                  <tbody>
                    {recipes[selected.id].map(r => (
                      <tr key={r.id}>
                        <td>{r.material_name}</td>
                        <td>{r.qty_used}</td>
                        <td>{r.unit}</td>
                        <td><button className="btn btn-sm btn-danger" onClick={() => removeIngredient(r.id, selected.id, r.material_name)}>🗑</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ margin: 0, flex: 2, minWidth: 140 }}>
                  <label className="form-label">Bahan</label>
                  <select className="form-control" value={newIngredient.raw_material_id} onChange={e => setNewIngredient(i => ({ ...i, raw_material_id: e.target.value }))}>
                    <option value="">Pilih bahan...</option>
                    {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 80 }}>
                  <label className="form-label">Jumlah</label>
                  <input className="form-control" type="number" step="0.001" value={newIngredient.qty_used} onChange={e => setNewIngredient(i => ({ ...i, qty_used: e.target.value }))} />
                </div>
                <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 80 }}>
                  <label className="form-label">Satuan</label>
                  <select className="form-control" value={newIngredient.unit} onChange={e => setNewIngredient(i => ({ ...i, unit: e.target.value }))}>
                    {['gram', 'kg', 'ml', 'liter', 'pcs', 'sdm', 'sdt', 'sachet', 'buah', 'siung'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <button className="btn btn-primary" onClick={addIngredient} style={{ marginBottom: 16 }}>+ Tambah</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
