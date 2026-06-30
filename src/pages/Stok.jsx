import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
const UNITS = ['kg', 'gram', 'liter', 'ml', 'pcs', 'sachet', 'bungkus', 'buah', 'siung', 'lembar']

function convertToBase(qtyUsed, unitResep, unitBeli) {
  if (unitResep === unitBeli) return qtyUsed
  if (unitResep === 'gram' && unitBeli === 'kg') return qtyUsed / 1000
  if (unitResep === 'ml' && unitBeli === 'liter') return qtyUsed / 1000
  if (unitResep === 'kg' && unitBeli === 'gram') return qtyUsed * 1000
  if (unitResep === 'liter' && unitBeli === 'ml') return qtyUsed * 1000
  return qtyUsed
}

// Hitung yield rate (%) dari berat mentah vs berat matang
function calcYieldRate(beratMentah, beratMatang) {
  const m = parseFloat(beratMentah) || 0
  const j = parseFloat(beratMatang) || 0
  if (m <= 0) return 100
  return Math.round((j / m) * 1000) / 10 // 1 desimal
}

// Harga efektif per satuan SETELAH disesuaikan susut masak
// Misal beli 1000gr @ Rp45.000, yield 50% -> harga efektif = Rp45.000 / 500gr = Rp90/gr (bukan Rp45/gr)
function calcHargaEfektif(lastPrice, yieldRate) {
  const yr = parseFloat(yieldRate) || 100
  if (yr >= 100 || yr <= 0) return lastPrice
  return lastPrice / (yr / 100)
}

export default function Stok() {
  const [materials, setMaterials] = useState([])
  const [products, setProducts] = useState([])
  const [recipes, setRecipes] = useState([])
  const [konversi, setKonversi] = useState([])
  const [tab, setTab] = useState('bahan')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ name: '', unit: 'kg', stock_qty: '', min_stock: '', last_price: '', berat_mentah: '', berat_matang: '', catatan_susut: '' })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchBahan, setSearchBahan] = useState('')
  const [searchMenu, setSearchMenu] = useState('')

  const fetchAll = async () => {
    setLoading(true)
    const [mat, prod, rec, kon] = await Promise.all([
      supabase.from('raw_materials').select('*').order('name'),
      supabase.from('products').select('*').order('category'),
      supabase.from('recipes').select('*'),
      supabase.from('konversi_bahan').select('*'),
    ])
    setMaterials(mat.data || [])
    setProducts(prod.data || [])
    setRecipes(rec.data || [])
    setKonversi(kon.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    const ch = supabase.channel('stok-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'raw_materials' }, fetchAll)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  const estimasiPorsi = (material) => {
    const k = konversi.find(k => k.nama_bahan.toLowerCase() === material.name.toLowerCase())
    if (!k || !k.qty_resep || !k.pax) return null
    let stok = material.stock_qty
    if (material.unit === 'kg' && k.satuan_resep === 'gram') stok = stok * 1000
    else if (material.unit === 'liter' && k.satuan_resep === 'ml') stok = stok * 1000
    else if (material.unit === 'gram' && k.satuan_resep === 'kg') stok = stok / 1000
    const totalPorsi = Math.floor(stok / k.qty_resep) * k.pax
    return { totalPorsi: Math.floor(totalPorsi), qtyResep: k.qty_resep, satuanResep: k.satuan_resep, pax: k.pax }
  }

  const estimasiDariResep = (material) => {
    return recipes
      .filter(r => r.raw_material_id === material.id)
      .map(r => {
        const product = products.find(p => p.id === r.product_id)
        if (!product) return null
        const qtyPerPorsi = convertToBase(r.qty_used, r.unit, material.unit)
        const porsi = qtyPerPorsi > 0 ? Math.floor(material.stock_qty / qtyPerPorsi) : 0
        return { productName: product.name, porsi, qtyUsed: r.qty_used, unit: r.unit }
      })
      .filter(Boolean)
  }

  const openAdd = () => {
    setEditItem(null)
    setForm({ name: '', unit: 'kg', stock_qty: '', min_stock: '', last_price: '', berat_mentah: '', berat_matang: '', catatan_susut: '' })
    setShowForm(true)
  }

  const openEdit = (item) => {
    setEditItem(item)
    setForm({
      name: item.name, unit: item.unit, stock_qty: item.stock_qty, min_stock: item.min_stock, last_price: item.last_price,
      berat_mentah: item.berat_mentah || '', berat_matang: item.berat_matang || '', catatan_susut: item.catatan_susut || ''
    })
    setShowForm(true)
  }

  const save = async () => {
    if (!form.name) return alert('Nama bahan wajib diisi!')
    setSaving(true)
    const yieldRate = calcYieldRate(form.berat_mentah, form.berat_matang)
    const data = {
      name: form.name, unit: form.unit, stock_qty: parseFloat(form.stock_qty) || 0, min_stock: parseFloat(form.min_stock) || 0,
      last_price: parseInt(form.last_price) || 0,
      berat_mentah: parseFloat(form.berat_mentah) || 0,
      berat_matang: parseFloat(form.berat_matang) || 0,
      yield_rate: yieldRate,
      catatan_susut: form.catatan_susut || '',
    }
    if (editItem) await supabase.from('raw_materials').update(data).eq('id', editItem.id)
    else await supabase.from('raw_materials').insert(data)
    setShowForm(false)
    fetchAll()
    setSaving(false)
  }

  const deleteMaterial = async (m) => {
    if (!window.confirm(`Hapus bahan "${m.name}"?`)) return
    await supabase.from('raw_materials').delete().eq('id', m.id)
    fetchAll()
  }

  const deleteProduct = async (p) => {
    if (!window.confirm(`Hapus menu "${p.name}"?`)) return
    await supabase.from('products').delete().eq('id', p.id)
    fetchAll()
  }

  const updateStock = async (id, delta) => {
    const item = materials.find(m => m.id === id)
    const newQty = Math.max(0, parseFloat(((item.stock_qty || 0) + delta).toFixed(3)))
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
  const filteredBahan = materials.filter(m => !searchBahan || m.name.toLowerCase().includes(searchBahan.toLowerCase()))
  const filteredMenu = products.filter(p => !searchMenu || p.name.toLowerCase().includes(searchMenu.toLowerCase()))

  return (
    <div>
      <div className="page-header flex-between">
        <div>
          <h1>Stok & Inventory 📦</h1>
          <p>Monitor stok real-time — otomatis berkurang saat order masuk</p>
        </div>
        {tab === 'bahan' && <button className="btn btn-primary" onClick={openAdd}>+ Tambah Bahan</button>}
      </div>

      {lowStock.length > 0 && (
        <div className="alert alert-warning">
          ⚠️ <strong>{lowStock.length} bahan</strong> hampir habis: {lowStock.map(m => m.name).join(', ')}
        </div>
      )}

      <div className="grid-4 mb-2">
        {[
          { label: 'Total Bahan', value: materials.length, color: 'var(--text)' },
          { label: 'Stok Aman', value: materials.filter(m => m.stock_qty > m.min_stock || m.min_stock === 0).length, color: 'var(--success)' },
          { label: 'Hampir Habis', value: lowStock.length, color: 'var(--danger)' },
          { label: 'Menu Aktif', value: products.filter(p => p.is_available).length, color: '#0077B6' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'bahan' ? 'active' : ''}`} onClick={() => setTab('bahan')}>🥩 Bahan Baku ({materials.length})</button>
        <button className={`tab ${tab === 'menu' ? 'active' : ''}`} onClick={() => setTab('menu')}>🍱 Stok Menu ({products.length})</button>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: 420 }}>
            <div className="flex-between mb-2">
              <h3 style={{ fontWeight: 700 }}>{editItem ? '✏️ Edit' : 'Tambah'} Bahan Baku</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Nama Bahan *</label>
              <input className="form-control" placeholder="Cth: Lele segar" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>💡 Nama harus sama persis dengan nama di Konversi Bahan</p>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Stok Sekarang</label>
                <input className="form-control" type="number" step="0.001" value={form.stock_qty} onChange={e => setForm(f => ({ ...f, stock_qty: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Satuan</label>
                <select className="form-control" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Stok Minimal</label>
                <input className="form-control" type="number" step="0.001" value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Harga Terakhir (Rp)</label>
                <input className="form-control" type="number" value={form.last_price} onChange={e => setForm(f => ({ ...f, last_price: e.target.value }))} />
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#C8881A', marginBottom: 6 }}>⚖️ Susut Masak (Opsional)</div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                Isi jika bahan menyusut saat diproses (direbus/digoreng/dibersihkan). Contoh: babat mentah 1000gr setelah direbus jadi 500gr.
              </p>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Berat Mentah (gr)</label>
                  <input className="form-control" type="number" step="0.01" placeholder="cth: 1000" value={form.berat_mentah} onChange={e => setForm(f => ({ ...f, berat_mentah: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Berat Matang (gr)</label>
                  <input className="form-control" type="number" step="0.01" placeholder="cth: 500" value={form.berat_matang} onChange={e => setForm(f => ({ ...f, berat_matang: e.target.value }))} />
                </div>
              </div>
              {form.berat_mentah > 0 && form.berat_matang > 0 && (
                <div style={{ background: '#FFF3D6', borderRadius: 8, padding: 10, marginTop: 4, marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: '#C8881A' }}>
                    Yield rate: <strong>{calcYieldRate(form.berat_mentah, form.berat_matang)}%</strong>
                  </div>
                  {form.last_price > 0 && (
                    <div style={{ fontSize: 12, color: '#C8881A', marginTop: 2 }}>
                      Harga efektif setelah susut: <strong>{formatRp(Math.round(calcHargaEfektif(parseInt(form.last_price) || 0, calcYieldRate(form.berat_mentah, form.berat_matang))))}/{form.unit}</strong>
                      <span style={{ color: '#888', marginLeft: 4 }}>(harga beli {formatRp(form.last_price)}/{form.unit} dibagi yield rate)</span>
                    </div>
                  )}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Catatan Susut</label>
                <input className="form-control" placeholder="cth: direbus 30 menit sampai empuk" value={form.catatan_susut} onChange={e => setForm(f => ({ ...f, catatan_susut: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Batal</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : '💾 Simpan'}</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : (
        <div>
          {tab === 'bahan' && (
            <div>
              <div className="card mb-2" style={{ padding: '0.75rem 1rem' }}>
                <input className="form-control" placeholder="🔍 Cari nama bahan..." value={searchBahan} onChange={e => setSearchBahan(e.target.value)} />
              </div>
              {filteredBahan.length === 0 ? (
                <div className="card empty-state">
                  <p>{searchBahan ? `Bahan "${searchBahan}" tidak ditemukan` : 'Belum ada bahan baku.'}</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {filteredBahan.map(m => {
                    const isLow = m.stock_qty <= m.min_stock && m.min_stock > 0
                    const estKonv = estimasiPorsi(m)
                    const estResep = estimasiDariResep(m)
                    return (
                      <div key={m.id} className="card" style={{ borderLeft: `4px solid ${isLow ? 'var(--danger)' : 'var(--success)'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 160 }}>
                            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{m.name}</div>
                            <span className={`badge ${isLow ? 'badge-danger' : 'badge-success'}`}>{isLow ? '⚠️ Hampir Habis' : '✅ Aman'}</span>
                            {m.last_price > 0 && (
                              <div style={{ marginTop: 4 }}>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                  Harga beli terakhir: {formatRp(m.last_price)}/{m.unit}
                                </span>
                                {m.hpp_fifo > 0 && (
                                  <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#D97706', marginTop: 2 }}>
                                    📊 HPP FIFO: {formatRp(m.hpp_fifo)}/{m.unit}
                                    {m.hpp_fifo !== m.last_price && (
                                      <span style={{ fontSize: 10, color: m.hpp_fifo < m.last_price ? '#16A34A' : '#DC2626', marginLeft: 6 }}>
                                        {m.hpp_fifo < m.last_price ? '↓ harga beli naik, stok lama masih murah' : '↑ harga stok lama lebih mahal'}
                                      </span>
                                    )}
                                  </span>
                                )}
                                {m.yield_rate > 0 && m.yield_rate < 100 && (
                                  <div style={{ marginTop: 4, background: '#FFF3D6', borderRadius: 6, padding: '4px 8px', display: 'inline-block' }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#C8881A' }}>⚖️ Susut {m.yield_rate}%</span>
                                    <span style={{ fontSize: 11, color: '#C8881A', marginLeft: 6 }}>
                                      → Harga efektif: <strong>{formatRp(Math.round(calcHargaEfektif(m.hpp_fifo > 0 ? m.hpp_fifo : m.last_price, m.yield_rate)))}/{m.unit}</strong>
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>STOK</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button onClick={() => updateStock(m.id, -0.1)} style={{ width: 30, height: 30, borderRadius: '50%', border: '1.5px solid var(--border)', background: '#fff', cursor: 'pointer', fontWeight: 700 }}>−</button>
                              <div style={{ textAlign: 'center', minWidth: 80 }}>
                                <div style={{ fontWeight: 700, fontSize: 18 }}>
                  {m.unit === 'kg' || m.unit === 'liter' 
                    ? parseFloat(m.stock_qty).toFixed(2).replace(/\.?0+$/, '') || '0'
                    : Math.floor(m.stock_qty)}
                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.unit}</div>
                              </div>
                              <button onClick={() => updateStock(m.id, 0.1)} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>+</button>
                            </div>
                            {m.min_stock > 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Min: {m.min_stock} {m.unit}</div>}
                          </div>
                          {estKonv && (
                            <div style={{ background: '#FFF3D6', borderRadius: 10, padding: '10px 14px', textAlign: 'center', minWidth: 110 }}>
                              <div style={{ fontSize: 10, color: '#C8881A', fontWeight: 600, marginBottom: 4 }}>ESTIMASI PORSI</div>
                              <div style={{ fontSize: 22, fontWeight: 700, color: '#C8881A' }}>{estKonv.totalPorsi}</div>
                              <div style={{ fontSize: 10, color: '#888' }}>porsi tersisa</div>
                            </div>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <button className="btn btn-sm btn-outline" onClick={() => openEdit(m)}>✏️ Edit</button>
                            <button className="btn btn-sm btn-danger" onClick={() => deleteMaterial(m)}>🗑 Hapus</button>
                          </div>
                        </div>
                        {estResep.length > 0 && (
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>📖 BISA BUAT (dari resep):</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {estResep.map((e, i) => (
                                <div key={i} style={{ background: e.porsi > 0 ? '#E8F5E0' : '#FFE8E8', borderRadius: 8, padding: '5px 10px', fontSize: 12 }}>
                                  <span style={{ fontWeight: 600 }}>{e.productName}</span>
                                  <span style={{ color: e.porsi > 0 ? '#2D5016' : 'var(--danger)', marginLeft: 6, fontWeight: 700 }}>{e.porsi} porsi</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'menu' && (
            <div>
              <div className="card mb-2" style={{ padding: '0.75rem 1rem' }}>
                <input className="form-control" placeholder="🔍 Cari nama menu..." value={searchMenu} onChange={e => setSearchMenu(e.target.value)} />
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="table">
                  <thead>
                    <tr><th>Menu</th><th>Harga</th><th>Stok Ready</th><th>Tersedia di Order</th><th>Aksi</th></tr>
                  </thead>
                  <tbody>
                    {filteredMenu.map(p => {
                      const recsForProd = recipes.filter(r => r.product_id === p.id)
                      const minPorsi = recsForProd.length > 0 ? Math.min(...recsForProd.map(r => {
                        const mat = materials.find(m => m.id === r.raw_material_id)
                        if (!mat) return 999
                        const qtyPerPorsi = convertToBase(r.qty_used, r.unit, mat.unit)
                        return qtyPerPorsi > 0 ? Math.floor(mat.stock_qty / qtyPerPorsi) : 0
                      })) : null
                      return (
                        <tr key={p.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{p.name}</div>
                            {minPorsi !== null && (
                              <div style={{ fontSize: 11, color: minPorsi > 0 ? '#2D5016' : 'var(--danger)', marginTop: 2 }}>
                                {minPorsi > 0 ? `✅ Bisa buat ${minPorsi} porsi` : '❌ Stok tidak cukup'}
                              </div>
                            )}
                          </td>
                          <td style={{ fontWeight: 600 }}>{formatRp(p.price)}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button onClick={() => updateProductStock(p.id, Math.max(0, (p.stock_ready || 0) - 1))} style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid var(--border)', background: '#fff', cursor: 'pointer' }}>−</button>
                              <span style={{ fontWeight: 700, minWidth: 30, textAlign: 'center' }}>{p.stock_ready || 0}</span>
                              <button onClick={() => updateProductStock(p.id, (p.stock_ready || 0) + 1)} style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer' }}>+</button>
                            </div>
                          </td>
                          <td>
                            <button onClick={() => toggleProduct(p.id, !p.is_available)} className={`btn btn-sm ${p.is_available ? 'btn-secondary' : 'btn-outline'}`}>
                              {p.is_available ? '✅ Aktif' : '❌ Nonaktif'}
                            </button>
                          </td>
                          <td><button className="btn btn-sm btn-danger" onClick={() => deleteProduct(p)}>🗑</button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
