import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'


const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')

// ==================== RESEP ====================
export function Resep() {
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

// ==================== KALKULATOR HPP ====================
export function KalkulatorHPP() {
  const [products, setProducts] = useState([])
  const [materials, setMaterials] = useState([])
  const [recipes, setRecipes] = useState({})
  const [overhead, setOverhead] = useState(20)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('hpp') // 'hpp' | 'konversi'

  // Konversi bahan state
  const [konversiList, setKonversiList] = useState([])
  const [konversiForm, setKonversiForm] = useState({
    nama_bahan: '', satuan_beli: 'kg', qty_beli: '', harga_beli: '',
    satuan_resep: 'gram', qty_resep: '', pax: '', notes: ''
  })
  const [showKonversiForm, setShowKonversiForm] = useState(false)
  const [editKonversiIdx, setEditKonversiIdx] = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('raw_materials').select('*'),
      supabase.from('recipes').select('*'),
    ]).then(([p, m, r]) => {
      setProducts(p.data || [])
      const matMap = {}
      ;(m.data || []).forEach(mat => matMap[mat.id] = mat)
      setMaterials(matMap)
      const grouped = {}
      ;(r.data || []).forEach(rec => {
        if (!grouped[rec.product_id]) grouped[rec.product_id] = []
        grouped[rec.product_id].push(rec)
      })
      setRecipes(grouped)
      setLoading(false)
    })
  }, [])

  const saveKonversi = () => {
    if (!konversiForm.nama_bahan || !konversiForm.qty_beli || !konversiForm.harga_beli) return alert('Nama bahan, qty beli, dan harga wajib diisi!')
    const list = [...konversiList]
    if (editKonversiIdx !== null) list[editKonversiIdx] = konversiForm
    else list.push(konversiForm)
    setKonversiList(list)
    setKonversiForm({ nama_bahan: '', satuan_beli: 'kg', qty_beli: '', harga_beli: '', satuan_resep: 'gram', qty_resep: '', pax: '', notes: '' })
    setShowKonversiForm(false)
    setEditKonversiIdx(null)
  }

  const deleteKonversi = (idx) => {
    if (!window.confirm('Hapus catatan ini?')) return
    const list = konversiList.filter((_, i) => i !== idx)
    setKonversiList(list)
  }

  const editKonversi = (idx) => {
    setKonversiForm(konversiList[idx])
    setEditKonversiIdx(idx)
    setShowKonversiForm(true)
  }

  // Kalkulasi otomatis konversi
  const calcKonversi = (k) => {
    const harga = parseFloat(k.harga_beli) || 0
    const qtyBeli = parseFloat(k.qty_beli) || 1
    const qtyResep = parseFloat(k.qty_resep) || 0
    const pax = parseFloat(k.pax) || 1
    const hargaPerSatuanBeli = harga / qtyBeli
    // Convert jika perlu (kg→gram, liter→ml)
    let qtyResepNorm = qtyResep
    if (k.satuan_beli === 'kg' && k.satuan_resep === 'gram') qtyResepNorm = qtyResep / 1000
    if (k.satuan_beli === 'liter' && k.satuan_resep === 'ml') qtyResepNorm = qtyResep / 1000
    if (k.satuan_beli === 'gram' && k.satuan_resep === 'kg') qtyResepNorm = qtyResep * 1000
    const hargaPerResep = hargaPerSatuanBeli * qtyResepNorm
    const hargaPerPax = pax > 0 ? hargaPerResep / pax : 0
    const totalPax = qtyResep > 0 ? Math.floor(qtyBeli / qtyResepNorm) * pax : 0
    return { hargaPerSatuanBeli, hargaPerResep, hargaPerPax, totalPax }
  }

  const calcHPP = (productId) => {
    const recs = recipes[productId] || []
    let total = 0
    const details = recs.map(r => {
      const mat = materials[r.raw_material_id]
      if (!mat) return { name: r.material_name, cost: 0, qty: r.qty_used, unit: r.unit }
      let qty = r.qty_used
      if (r.unit === 'gram' && mat.unit === 'kg') qty = r.qty_used / 1000
      else if (r.unit === 'ml' && mat.unit === 'liter') qty = r.qty_used / 1000
      const cost = qty * mat.last_price
      total += cost
      return { name: r.material_name, cost, qty: r.qty_used, unit: r.unit }
    })
    const overheadCost = total * (overhead / 100)
    const hpp = total + overheadCost
    return { details, bahanCost: total, overheadCost, hpp }
  }

  const SATUAN = ['gram', 'kg', 'ml', 'liter', 'pcs', 'sachet', 'bungkus', 'botol', 'buah', 'sdm', 'sdt']

  return (
    <div>
      <div className="page-header"><h1>Kalkulator HPP 🧮</h1><p>HPP real-time dari resep + konversi satuan bahan</p></div>

      <div className="tabs">
        <button className={`tab ${tab === 'hpp' ? 'active' : ''}`} onClick={() => setTab('hpp')}>🧮 HPP per Menu</button>
        <button className={`tab ${tab === 'konversi' ? 'active' : ''}`} onClick={() => setTab('konversi')}>📐 Konversi Bahan ({konversiList.length})</button>
      </div>

      {/* TAB KONVERSI */}
      {tab === 'konversi' && (
        <div>
          <div className="flex-between mb-2">
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Catat konversi satuan beli → satuan resep → jumlah pax</p>
            <button className="btn btn-primary" onClick={() => { setEditKonversiIdx(null); setKonversiForm({ nama_bahan: '', satuan_beli: 'kg', qty_beli: '', harga_beli: '', satuan_resep: 'gram', qty_resep: '', pax: '', notes: '' }); setShowKonversiForm(true) }}>+ Tambah Catatan</button>
          </div>

          {/* Contoh referensi */}
          <div className="alert alert-info mb-2" style={{ fontSize: 12 }}>
            💡 <strong>Contoh:</strong> Beras 1 kg = Rp 13.000 → pakai 80 gram/porsi → 1 kg untuk 12 pax → HPP beras/pax = Rp 1.083
          </div>

          {/* Form tambah/edit */}
          {showKonversiForm && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div className="card" style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="flex-between mb-2">
                  <h3 style={{ fontWeight: 700 }}>{editKonversiIdx !== null ? '✏️ Edit' : '+ Tambah'} Konversi Bahan</h3>
                  <button onClick={() => setShowKonversiForm(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
                </div>

                <div className="form-group">
                  <label className="form-label">Nama Bahan *</label>
                  <input className="form-control" placeholder="Contoh: Beras, Ayam fillet, Juice jeruk" value={konversiForm.nama_bahan} onChange={e => setKonversiForm(f => ({ ...f, nama_bahan: e.target.value }))} />
                </div>

                {/* Satuan beli */}
                <div style={{ background: '#E8F5E0', borderRadius: 10, padding: '12px', marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#2D5016', marginBottom: 8 }}>📦 SATUAN BELI (dari supplier)</div>
                  <div className="grid-2">
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Qty Beli *</label>
                      <input className="form-control" type="number" step="0.001" placeholder="1" value={konversiForm.qty_beli} onChange={e => setKonversiForm(f => ({ ...f, qty_beli: e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Satuan Beli</label>
                      <select className="form-control" value={konversiForm.satuan_beli} onChange={e => setKonversiForm(f => ({ ...f, satuan_beli: e.target.value }))}>
                        {SATUAN.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: 8, marginBottom: 0 }}>
                    <label className="form-label">Harga Beli (Rp) *</label>
                    <input className="form-control" type="number" placeholder="13000" value={konversiForm.harga_beli} onChange={e => setKonversiForm(f => ({ ...f, harga_beli: e.target.value }))} />
                  </div>
                </div>

                {/* Satuan resep */}
                <div style={{ background: '#E0F4FF', borderRadius: 10, padding: '12px', marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#0077B6', marginBottom: 8 }}>🍳 PEMAKAIAN PER RESEP</div>
                  <div className="grid-2">
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Qty Pakai per Resep</label>
                      <input className="form-control" type="number" step="0.001" placeholder="80" value={konversiForm.qty_resep} onChange={e => setKonversiForm(f => ({ ...f, qty_resep: e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Satuan Resep</label>
                      <select className="form-control" value={konversiForm.satuan_resep} onChange={e => setKonversiForm(f => ({ ...f, satuan_resep: e.target.value }))}>
                        {SATUAN.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: 8, marginBottom: 0 }}>
                    <label className="form-label">Hasil: berapa pax/porsi per resep?</label>
                    <input className="form-control" type="number" placeholder="1" value={konversiForm.pax} onChange={e => setKonversiForm(f => ({ ...f, pax: e.target.value }))} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Notes / Keterangan</label>
                  <textarea className="form-control" rows={2} placeholder="Contoh: Ayam fillet → marinasi 2 jam → dipotong 5 pcs per resep" value={konversiForm.notes} onChange={e => setKonversiForm(f => ({ ...f, notes: e.target.value }))} />
                </div>

                {/* Preview kalkulasi */}
                {konversiForm.qty_beli && konversiForm.harga_beli && konversiForm.qty_resep && (
                  <div style={{ background: '#FFF3D6', borderRadius: 10, padding: '12px', marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#C8881A', marginBottom: 8 }}>🧮 PREVIEW KALKULASI</div>
                    {(() => {
                      const k = calcKonversi(konversiForm)
                      return (
                        <div style={{ fontSize: 13 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span>Harga per {konversiForm.satuan_beli}</span>
                            <span style={{ fontWeight: 600 }}>{formatRp(k.hargaPerSatuanBeli)}</span>
                          </div>
                          {konversiForm.qty_resep && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span>Biaya {konversiForm.qty_resep} {konversiForm.satuan_resep}</span>
                              <span style={{ fontWeight: 600 }}>{formatRp(k.hargaPerResep)}</span>
                            </div>
                          )}
                          {konversiForm.pax && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span>HPP per pax</span>
                              <span style={{ fontWeight: 700, color: '#C0392B' }}>{formatRp(k.hargaPerPax)}</span>
                            </div>
                          )}
                          {k.totalPax > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>Total pax dari {konversiForm.qty_beli} {konversiForm.satuan_beli}</span>
                              <span style={{ fontWeight: 700, color: '#2D5016' }}>{k.totalPax} pax</span>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowKonversiForm(false)}>Batal</button>
                  <button className="btn btn-primary" style={{ flex: 2 }} onClick={saveKonversi}>💾 Simpan</button>
                </div>
              </div>
            </div>
          )}

          {/* List konversi */}
          {konversiList.length === 0 ? (
            <div className="card empty-state">
              <p>Belum ada catatan konversi.</p>
              <p style={{ fontSize: 12, marginTop: 8 }}>Tambahkan konversi bahan seperti: Beras 1kg = 13 pax ricebowl</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
              {konversiList.map((k, idx) => {
                const calc = calcKonversi(k)
                return (
                  <div key={idx} className="card">
                    <div className="flex-between mb-1">
                      <h4 style={{ fontWeight: 700, fontSize: 15 }}>{k.nama_bahan}</h4>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm btn-outline" onClick={() => editKonversi(idx)}>✏️</button>
                        <button className="btn btn-sm btn-danger" onClick={() => deleteKonversi(idx)}>🗑</button>
                      </div>
                    </div>

                    {/* Beli */}
                    <div style={{ background: '#E8F5E0', borderRadius: 8, padding: '8px 10px', marginBottom: 8, fontSize: 13 }}>
                      <span style={{ fontWeight: 600, color: '#2D5016' }}>📦 Beli:</span> {k.qty_beli} {k.satuan_beli} = {formatRp(k.harga_beli)}
                    </div>

                    {/* Resep */}
                    {k.qty_resep && (
                      <div style={{ background: '#E0F4FF', borderRadius: 8, padding: '8px 10px', marginBottom: 8, fontSize: 13 }}>
                        <span style={{ fontWeight: 600, color: '#0077B6' }}>🍳 Pakai:</span> {k.qty_resep} {k.satuan_resep} per resep
                        {k.pax && <span style={{ color: '#0077B6' }}> → {k.pax} pax</span>}
                      </div>
                    )}

                    {/* Hasil kalkulasi */}
                    <div style={{ background: '#FFF3D6', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {k.qty_resep && (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: '#C0392B' }}>{formatRp(calc.hargaPerResep)}</div>
                            <div style={{ fontSize: 10, color: '#888' }}>per resep</div>
                          </div>
                        )}
                        {k.pax && (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: '#C0392B' }}>{formatRp(calc.hargaPerPax)}</div>
                            <div style={{ fontSize: 10, color: '#888' }}>per pax</div>
                          </div>
                        )}
                        {calc.totalPax > 0 && (
                          <div style={{ textAlign: 'center', gridColumn: '1/-1' }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: '#2D5016' }}>{calc.totalPax} pax</div>
                            <div style={{ fontSize: 10, color: '#888' }}>dari {k.qty_beli} {k.satuan_beli}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Notes */}
                    {k.notes && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                        📝 {k.notes}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB HPP */}
      {tab === 'hpp' && (
        <div>
          <div className="card mb-2" style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>Overhead / Biaya Operasional:</label>
              <input type="range" min="0" max="50" value={overhead} onChange={e => setOverhead(parseInt(e.target.value))} style={{ flex: 1 }} />
              <span style={{ fontWeight: 700, minWidth: 40 }}>{overhead}%</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Overhead meliputi gas, listrik, kemasan, dan biaya operasional lainnya</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {loading ? <div className="loading"><div className="spinner" /></div> : products.map(p => {
              const { details, bahanCost, overheadCost, hpp } = calcHPP(p.id)
              const margin = p.price - hpp
              const marginPct = p.price > 0 ? ((margin / p.price) * 100).toFixed(1) : 0
              return (
                <div key={p.id} className="card">
                  <div className="flex-between mb-1">
                    <h4 style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</h4>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Jual: {formatRp(p.price)}</span>
                  </div>
                  {details.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Belum ada resep. Tambahkan di menu Resep.</p>
                  ) : (
                    <>
                      {details.map((d, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', color: 'var(--text-muted)' }}>
                          <span>{d.name} ({d.qty} {d.unit})</span>
                          <span>{formatRp(d.cost)}</span>
                        </div>
                      ))}
                      <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                          <span>Bahan baku</span><span>{formatRp(bahanCost)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>
                          <span>Overhead ({overhead}%)</span><span>{formatRp(overheadCost)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
                          <span>HPP</span><span style={{ color: '#C0392B' }}>{formatRp(hpp)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 13, marginTop: 4 }}>
                          <span>Margin</span>
                          <span style={{ color: margin >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {formatRp(margin)} ({marginPct}%)
                          </span>
                        </div>
                      </div>
                    </>
                  )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ==================== LAPORAN LABA RUGI ====================
export function LaporanLabaRugi() {
  const [period, setPeriod] = useState('today')
  const [data, setData] = useState({ revenue: 0, expense: 0, orders: 0, avgOrder: 0 })
  const [loading, setLoading] = useState(true)
  const [byCategory, setByCategory] = useState([])
  const [topProducts, setTopProducts] = useState([])

  useEffect(() => { fetchReport() }, [period])

  const getDateRange = () => {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    if (period === 'today') return { from: today, to: today }
    if (period === 'week') {
      const d = new Date(now); d.setDate(d.getDate() - 7)
      return { from: d.toISOString().split('T')[0], to: today }
    }
    if (period === 'month') {
      return { from: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, to: today }
    }
    return { from: today, to: today }
  }

  const fetchReport = async () => {
    setLoading(true)
    const { from, to } = getDateRange()
    const [ordersRes, expensesRes, itemsRes] = await Promise.all([
      supabase.from('orders').select('total_amount,status').gte('created_at', from).lte('created_at', to + 'T23:59:59'),
      supabase.from('expenses').select('amount,category').gte('expense_date', from).lte('expense_date', to),
      supabase.from('order_items').select('product_name,quantity,subtotal,orders!inner(created_at,status)').gte('orders.created_at', from).lte('orders.created_at', to + 'T23:59:59'),
    ])
    const validOrders = (ordersRes.data || []).filter(o => o.status !== 'Batal')
    const revenue = validOrders.reduce((s, o) => s + o.total_amount, 0)
    const expense = (expensesRes.data || []).reduce((s, e) => s + e.amount, 0)
    const catMap = {}
    ;(expensesRes.data || []).forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + e.amount })
    setByCategory(Object.entries(catMap).map(([cat, total]) => ({ cat, total })).sort((a,b) => b.total - a.total))
    const prodMap = {}
    ;(itemsRes.data || []).filter(i => i.orders?.status !== 'Batal').forEach(i => {
      if (!prodMap[i.product_name]) prodMap[i.product_name] = { qty: 0, revenue: 0 }
      prodMap[i.product_name].qty += i.quantity
      prodMap[i.product_name].revenue += i.subtotal
    })
    setTopProducts(Object.entries(prodMap).map(([name, d]) => ({ name, ...d })).sort((a,b) => b.revenue - a.revenue).slice(0,5))
    setData({ revenue, expense, orders: validOrders.length, avgOrder: validOrders.length > 0 ? Math.round(revenue / validOrders.length) : 0 })
    setLoading(false)
  }

  const profit = data.revenue - data.expense
  const marginPct = data.revenue > 0 ? ((profit / data.revenue) * 100).toFixed(1) : 0

  return (
    <div>
      <div className="page-header flex-between">
        <div><h1>Laporan Laba Rugi 📊</h1><p>Real-time profit & loss Kedai MangLeman</p></div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['today','Hari Ini'],['week','7 Hari'],['month','Bulan Ini']].map(([val,label]) => (
            <button key={val} onClick={() => setPeriod(val)} className="btn btn-sm" style={{ background: period === val ? '#1A2E0A' : 'transparent', color: period === val ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}>{label}</button>
          ))}
          <button onClick={fetchReport} className="btn btn-sm btn-outline">🔄</button>
        </div>
      </div>
      {loading ? <div className="loading"><div className="spinner" /></div> : (
        <>
          <div className="grid-4 mb-2">
            {[
              { label: 'Pendapatan', value: formatRp(data.revenue), color: '#2D5016', icon: '💰' },
              { label: 'Pengeluaran', value: formatRp(data.expense), color: '#C0392B', icon: '💸' },
              { label: profit >= 0 ? '✅ Laba' : '❌ Rugi', value: formatRp(Math.abs(profit)), color: profit >= 0 ? '#28A745' : '#C0392B', icon: profit >= 0 ? '📈' : '📉' },
              { label: 'Margin', value: marginPct + '%', color: parseFloat(marginPct) >= 20 ? '#28A745' : '#C8881A', icon: '🎯' },
            ].map((s, i) => (
              <div key={i} className="card stat-card">
                <div style={{ fontSize: 28, marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="grid-2">
            <div className="card">
              <h4 style={{ marginBottom: 12, fontWeight: 700, fontSize: 14 }}>💸 Pengeluaran per Kategori</h4>
              {byCategory.length === 0 ? <p className="text-muted" style={{ fontSize: 13 }}>Belum ada data pengeluaran</p> : byCategory.map(c => (
                <div key={c.cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <span>{c.cat}</span><span style={{ fontWeight: 600, color: 'var(--danger)' }}>{formatRp(c.total)}</span>
                </div>
              ))}
            </div>
            <div className="card">
              <h4 style={{ marginBottom: 12, fontWeight: 700, fontSize: 14 }}>🏆 Menu Terlaris</h4>
              {topProducts.length === 0 ? <p className="text-muted" style={{ fontSize: 13 }}>Belum ada data penjualan</p> : topProducts.map((p, i) => (
                <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>#{i+1}</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.qty} terjual</div>
                    </div>
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--secondary)' }}>{formatRp(p.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card mt-2">
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              {[
                { label: 'Total Order', value: data.orders + ' order' },
                { label: 'Rata-rata per Order', value: formatRp(data.avgOrder) },
                { label: 'Revenue per Hari', value: formatRp(period === 'week' ? Math.round(data.revenue/7) : period === 'month' ? Math.round(data.revenue/30) : data.revenue) },
              ].map((s, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center', minWidth: 120 }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ==================== TARGET ====================
export function Target() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [target, setTarget] = useState({ target_revenue: '', target_orders: '', target_profit: '', notes: '' })
  const [actual, setActual] = useState({ revenue: 0, orders: 0, expense: 0 })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [month, year])

  const fetchData = async () => {
    setLoading(true)
    const from = `${year}-${String(month).padStart(2,'0')}-01`
    const to = `${year}-${String(month).padStart(2,'0')}-31`
    const [targetRes, ordersRes, expRes] = await Promise.all([
      supabase.from('monthly_targets').select('*').eq('month', month).eq('year', year).maybeSingle(),
      supabase.from('orders').select('total_amount,status').gte('created_at', from).lte('created_at', to + 'T23:59:59'),
      supabase.from('expenses').select('amount').gte('expense_date', from).lte('expense_date', to),
    ])
    if (targetRes.data) setTarget({ target_revenue: targetRes.data.target_revenue, target_orders: targetRes.data.target_orders, target_profit: targetRes.data.target_profit, notes: targetRes.data.notes || '' })
    else setTarget({ target_revenue: '', target_orders: '', target_profit: '', notes: '' })
    const validOrders = (ordersRes.data || []).filter(o => o.status !== 'Batal')
    setActual({
      revenue: validOrders.reduce((s, o) => s + o.total_amount, 0),
      orders: validOrders.length,
      expense: (expRes.data || []).reduce((s, e) => s + e.amount, 0),
    })
    setLoading(false)
  }

  const save = async () => {
    setSaving(true)
    await supabase.from('monthly_targets').upsert({ month, year, target_revenue: parseInt(target.target_revenue) || 0, target_orders: parseInt(target.target_orders) || 0, target_profit: parseInt(target.target_profit) || 0, notes: target.notes }, { onConflict: 'month,year' })
    setSaving(false)
    alert('Target disimpan!')
  }

  const pct = (actual, target) => target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0

  const ProgressBar = ({ value, color = '#E8A838' }) => (
    <div style={{ background: 'var(--border)', borderRadius: 20, height: 10, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ width: value + '%', background: color, height: '100%', borderRadius: 20, transition: 'width 0.5s' }} />
    </div>
  )

  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

  return (
    <div>
      <div className="page-header"><h1>Target Bulanan 🎯</h1><p>Set dan monitor target bisnis bulanan</p></div>
      <div style={{ display: 'flex', gap: 10, marginBottom: '1.5rem', alignItems: 'center' }}>
        <select className="form-control" style={{ width: 'auto' }} value={month} onChange={e => setMonth(parseInt(e.target.value))}>
          {months.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <select className="form-control" style={{ width: 'auto' }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
          {[2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
        </select>
      </div>
      {loading ? <div className="loading"><div className="spinner" /></div> : (
        <div className="grid-2">
          <div className="card">
            <h3 style={{ marginBottom: 16, fontWeight: 700, fontSize: 15 }}>📝 Set Target {months[month-1]} {year}</h3>
            {[
              { key: 'target_revenue', label: 'Target Pendapatan (Rp)' },
              { key: 'target_orders', label: 'Target Jumlah Order' },
              { key: 'target_profit', label: 'Target Laba (Rp)' },
            ].map(f => (
              <div key={f.key} className="form-group">
                <label className="form-label">{f.label}</label>
                <input className="form-control" type="number" value={target[f.key]} onChange={e => setTarget(t => ({ ...t, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div className="form-group">
              <label className="form-label">Catatan / Strategi</label>
              <textarea className="form-control" rows={3} value={target.notes} onChange={e => setTarget(t => ({ ...t, notes: e.target.value }))} />
            </div>
            <button className="btn btn-primary btn-block" onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : '💾 Simpan Target'}</button>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 16, fontWeight: 700, fontSize: 15 }}>📊 Progress {months[month-1]} {year}</h3>
            {[
              { label: 'Pendapatan', actual: actual.revenue, target: parseInt(target.target_revenue) || 0, color: '#2D5016' },
              { label: 'Jumlah Order', actual: actual.orders, target: parseInt(target.target_orders) || 0, color: '#0077B6', isCnt: true },
              { label: 'Laba', actual: actual.revenue - actual.expense, target: parseInt(target.target_profit) || 0, color: '#28A745' },
            ].map(m => {
              const p = pct(m.actual, m.target)
              return (
                <div key={m.label} style={{ marginBottom: 20 }}>
                  <div className="flex-between" style={{ marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: m.color }}>{p}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    <span>{m.isCnt ? m.actual + ' order' : formatRp(m.actual)}</span>
                    <span>Target: {m.isCnt ? m.target + ' order' : formatRp(m.target)}</span>
                  </div>
                  <ProgressBar value={p} color={p >= 100 ? '#28A745' : p >= 70 ? m.color : '#E8A838'} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== ANALISA BISNIS ====================
export function AnalisaBisnis() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      const now = new Date()
      const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
      const [orders, items, expenses, customers] = await Promise.all([
        supabase.from('orders').select('total_amount,status,created_at').gte('created_at', month + '-01'),
        supabase.from('order_items').select('product_name,quantity,subtotal,orders!inner(created_at,status)').gte('orders.created_at', month + '-01'),
        supabase.from('expenses').select('amount,category').gte('expense_date', month + '-01'),
        supabase.from('customers').select('segment,total_spent,total_orders'),
      ])
      const validOrders = (orders.data || []).filter(o => o.status !== 'Batal')
      const revenue = validOrders.reduce((s,o) => s+o.total_amount, 0)
      const expense = (expenses.data || []).reduce((s,e) => s+e.amount, 0)
      const prodMap = {}
      ;(items.data||[]).filter(i=>i.orders?.status!=='Batal').forEach(i => {
        if(!prodMap[i.product_name]) prodMap[i.product_name]={qty:0,revenue:0}
        prodMap[i.product_name].qty+=i.quantity
        prodMap[i.product_name].revenue+=i.subtotal
      })
      const topProds = Object.entries(prodMap).sort((a,b)=>b[1].revenue-a[1].revenue)
      const segs = { VIP:0, Loyal:0, Regular:0, Baru:0 }
      ;(customers.data||[]).forEach(c => segs[c.segment]=(segs[c.segment]||0)+1)
      setData({ revenue, expense, profit: revenue-expense, orders: validOrders.length, topProds, segs, totalCustomers: (customers.data||[]).length })
      setLoading(false)
    }
    fetchAll()
  }, [])

  if (loading) return <div className="loading"><div className="spinner" /></div>

  const insights = []
  if (data.profit < 0) insights.push({ type: 'danger', msg: '⚠️ Bulan ini masih rugi! Cek pengeluaran terbesar dan pertimbangkan efisiensi.' })
  if (data.profit > 0 && data.revenue > 0) {
    const margin = (data.profit / data.revenue * 100).toFixed(1)
    if (parseFloat(margin) < 20) insights.push({ type: 'warning', msg: `📉 Margin laba ${margin}% masih rendah. Target ideal FnB minimal 20-30%.` })
    else insights.push({ type: 'success', msg: `✅ Margin ${margin}% — bagus! Pertahankan efisiensi biaya.` })
  }
  if (data.segs.VIP > 0) insights.push({ type: 'success', msg: `👑 Ada ${data.segs.VIP} pelanggan VIP. Pertimbangkan program loyalitas eksklusif untuk mereka.` })
  if (data.segs.Baru > data.segs.Loyal) insights.push({ type: 'info', msg: `👋 Banyak pelanggan baru (${data.segs.Baru}). Fokus pada follow-up agar mereka jadi pelanggan loyal.` })
  if (data.topProds[0]) insights.push({ type: 'info', msg: `🏆 Menu terlaris: ${data.topProds[0][0]} (${data.topProds[0][1].qty} terjual). Pastikan stok selalu ready.` })

  return (
    <div>
      <div className="page-header"><h1>Analisa Bisnis 💡</h1><p>Insight dan rekomendasi untuk perkembangan Kedai MangLeman</p></div>
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: '1rem' }}>
        {insights.map((ins, i) => <div key={i} className={`alert alert-${ins.type}`}>{ins.msg}</div>)}
      </div>
      <div className="grid-2 mt-2">
        <div className="card">
          <h4 style={{ marginBottom: 12, fontWeight: 700, fontSize: 14 }}>📦 Distribusi Pelanggan</h4>
          {Object.entries(data.segs).map(([seg, cnt]) => (
            <div key={seg} style={{ marginBottom: 10 }}>
              <div className="flex-between" style={{ fontSize: 13, marginBottom: 3 }}>
                <span>{seg}</span><span style={{ fontWeight: 700 }}>{cnt} orang</span>
              </div>
              <div style={{ background: 'var(--border)', borderRadius: 10, height: 8 }}>
                <div style={{ width: (data.totalCustomers > 0 ? cnt/data.totalCustomers*100 : 0) + '%', background: '#E8A838', height: '100%', borderRadius: 10 }} />
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <h4 style={{ marginBottom: 12, fontWeight: 700, fontSize: 14 }}>🍱 Top Menu Bulan Ini</h4>
          {data.topProds.slice(0,6).map(([name, d], i) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13, alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', minWidth: 20 }}>#{i+1}</span>
                <div>
                  <div style={{ fontWeight: 600 }}>{name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.qty} terjual</div>
                </div>
              </div>
              <span style={{ fontWeight: 700, color: '#2D5016' }}>{formatRp(d.revenue)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ==================== MANAJEMEN MENU ====================
export function ManajemenMenu() {
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
