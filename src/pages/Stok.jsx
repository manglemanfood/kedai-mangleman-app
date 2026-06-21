import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')

const UNITS = ['kg', 'gram', 'liter', 'ml', 'pcs', 'sachet', 'bungkus', 'buah', 'siung', 'lembar']

// Konversi qty_used resep ke satuan beli bahan
function convertToBase(qtyUsed, unitResep, unitBeli) {
  if (unitResep === unitBeli) return qtyUsed
  if (unitResep === 'gram' && unitBeli === 'kg') return qtyUsed / 1000
  if (unitResep === 'ml' && unitBeli === 'liter') return qtyUsed / 1000
  if (unitResep === 'kg' && unitBeli === 'gram') return qtyUsed * 1000
  if (unitResep === 'liter' && unitBeli === 'ml') return qtyUsed * 1000
  return qtyUsed
}

export default function Stok() {
  const [materials, setMaterials] = useState([])
  const [products, setProducts] = useState([])
  const [recipes, setRecipes] = useState([])
  const [konversi, setKonversi] = useState([])
  const [tab, setTab] = useState('bahan')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ name: '', unit: 'kg', stock_qty: '', min_stock: '', last_price: '' })
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

  // Realtime stok update
  useEffect(() => {
    const ch = supabase.channel('stok-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'raw_materials' }, fetchAll)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  // Hitung estimasi sisa porsi untuk 1 bahan
  const estimasiPorsi = (material) => {
    // Cari konversi bahan yang match nama
    const k = konversi.find(k => k.nama_bahan.toLowerCase() === material.name.toLowerCase())
    if (!k || !k.qty_resep || !k.pax) return null

    // Konversi stok ke satuan resep
    let stokDalamResep = material.stock_qty
    if (material.unit === 'kg' && k.satuan_resep === 'gram') stokDalamResep = material.stock_qty * 1000
    else if (material.unit === 'liter' && k.satuan_resep === 'ml') stokDalamResep = material.stock_qty * 1000
    else if (material.unit === 'gram' && k.satuan_resep === 'kg') stokDalamResep = material.stock_qty / 1000

    const totalPorsi = Math.floor(stokDalamResep / k.qty_resep) * k.pax
    return { totalPorsi: Math.floor(totalPorsi), qtyResep: k.qty_resep, satuanResep: k.satuan_resep, pax: k.pax }
  }

  // Hitung berapa porsi bisa dibuat dari stok (berdasarkan resep)
  const estimasiDariResep = (material) => {
    // Cari semua resep yang pakai bahan ini
    const recsUsingMat = recipes.filter(r => r.raw_material_id === material.id)
    if (recsUsingMat.length === 0) return []

    return recsUsingMat.map(r => {
      const product = products.find(p => p.id === r.product_id)
      if (!product) return null
      const qtyPerPorsiDalamBeli = convertToBase(r.qty_used, r.unit, material.unit)
      const porsiDapatDibuat = qtyPerPorsiDalamBeli > 0 ? Math.floor(material.stock_qty / qtyPerPorsiDalamBeli) : 0
      return { productName: product.name, porsi: porsiDapatDibuat, qtyUsed: r.qty_used, unit: r.unit }
    }).filter(Boolean)
  }

  const openAdd = () => { setEditItem(null); setForm({ name: '', unit: 'kg', stock_qty: '', min_stock: '', last_price: '' }); setShowForm(true) }
  const openEdit = (item) => { setEditItem(item); setForm({ name: item.name, unit: item.unit, stock_qty: item.stock_qty, min_stock: item.min_stock, last_price: item.last_price }); setShowForm(true) }

  const save = async () => {
    if (!form.name) return alert('Nama bahan wajib diisi!')
    setSaving(true)
    const data = { name: form.name, unit: form.unit, stock_qty: parseFloat(form.stock_qty) || 0, min_stock: parseFloat(form.min_stock) || 0, last_price: parseInt(form.last_price) || 0 }
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
    const newQty = Math.max(0, parseFloat((item.stock_qty || 0) + delta).toFixed(3))
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

  // Summary stok bahan
  const totalBahan = materials.length
  const amanCount = materials.filter(m => m.stock_qty > m.min_stock || m.min_stock === 0).length

  return (
    <div>
      <div className="page-header flex-between">
        <div>
          <h1>Stok & Inventory 📦</h1>
          <p>Monitor stok real-time — otomatis berkurang saat order masuk</p>
        </div>
        {tab === 'bahan' && <button className="btn btn-primary" onClick={openAdd}>+ Tambah Bahan</button>}
      </div>

      {/* Alert stok menipis */}
      {lowStock.length > 0 && (
        <div className="alert alert-warning">
          ⚠️ <strong>{lowStock.length} bahan</strong> hampir habis:&nbsp;
          {lowStock.map(m => {
            const est = estimasiDariResep(m)
            const minPorsi = est.length > 0 ? Math.min(...est.map(e => e.porsi)) : null
            return (
              <span key={m.id} style={{ marginRight: 8 }}>
                <strong>{m.name}</strong> ({m.stock_qty} {m.unit}
                {minPorsi !== null && ` ≈ ${minPorsi} porsi`})
              </span>
            )
          })}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid-4 mb-2">
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{totalBahan}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Bahan</div>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>{amanCount}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Stok Aman</div>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>{lowStock.length}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Hampir Habis</div>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0077B6' }}>{products.filter(p => p.is_available).length}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Menu Aktif</div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'bahan' ? 'active' : ''}`} onClick={() => setTab('bahan')}>🥩 Bahan Baku ({materials.length})</button>
        <button className={`tab ${tab === 'menu' ? 'active' : ''}`} onClick={() => setTab('menu')}>🍱 Stok Menu ({products.length})</button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: 420 }}>
            <div className="flex-between mb-2">
              <h3 style={{ fontWeight: 700 }}>{editItem ? '✏️ Edit' : 'Tambah'} Bahan Baku</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Nama Bahan *</label>
              <input className="form-control" placeholder="Cth: Lele segar, Tepung terigu" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>💡 Nama harus sama persis dengan nama di Konversi Bahan agar tersinkron</p>
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
                <label className="form-label">Stok Minimal (alert)</label>
                <input className="form-control" type="number" step="0.001" value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Harga Terakhir (Rp)</label>
                <input className="form-control" type="number" value={form.last_price} onChange={e => setForm(f => ({ ...f, last_price: e.target.value }))} />
              </div>
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
            <div>
              <div className="card mb-2" style={{ padding: '0.75rem 1rem' }}>
            <input className="form-control" placeholder="🔍 Cari nama bahan..." value={searchBahan} onChange={e => setSearchBahan(e.target.value)} />
          </div>
          {materials.filter(m => !searchBahan || m.name.toLowerCase().includes(searchBahan.toLowerCase())).length === 0 ? (
                <div className="card empty-state"><p>{searchBahan ? `Bahan "${searchBahan}" tidak ditemukan` : 'Belum ada bahan baku. Tambahkan sekarang!'}</p></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {materials.filter(m => !searchBahan || m.name.toLowerCase().includes(searchBahan.toLowerCase())).map(m => {
                    const isLow = m.stock_qty <= m.min_stock && m.min_stock > 0
                    const estimasiKonv = estimasiPorsi(m)
                    const estimasiResep = estimasiDariResep(m)

                    return (
                      <div key={m.id} className="card" style={{ borderLeft: isLow ? '4px solid var(--danger)' : '4px solid var(--success)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                          {/* Info bahan */}
                          <div style={{ flex: 1, minWidth: 160 }}>
                            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{m.name}</div>
                            <span className={`badge ${isLow ? 'badge-danger' : 'badge-success'}`}>{isLow ? '⚠️ Hampir Habis' : '✅ Aman'}</span>
                            {m.last_price > 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{formatRp(m.last_price)}/{m.unit}</span>}
                          </div>

                          {/* Stok control */}
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>STOK SEKARANG</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button onClick={() => updateStock(m.id, -0.1)} style={{ width: 30, height: 30, borderRadius: '50%', border: '1.5px solid var(--border)', background: '#fff', cursor: 'pointer', fontWeight: 700 }}>−</button>
                              <div style={{ textAlign: 'center', minWidth: 80 }}>
                                <div style={{ fontWeight: 700, fontSize: 18 }}>{parseFloat(m.stock_qty).toFixed(m.unit === 'kg' || m.unit === 'liter' ? 2 : 0)}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.unit}</div>
                              </div>
                              <button onClick={() => updateStock(m.id, 0.1)} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>+</button>
                            </div>
                            {m.min_stock > 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Min: {m.min_stock} {m.unit}</div>}
                          </div>

                          {/* Estimasi porsi dari konversi */}
                          {estimasiKonv && (
                            <div style={{ background: '#FFF3D6', borderRadius: 10, padding: '10px 14px', textAlign: 'center', minWidth: 110 }}>
                              <div style={{ fontSize: 10, color: '#C8881A', fontWeight: 600, marginBottom: 4 }}>ESTIMASI PORSI</div>
                              <div style={{ fontSize: 22, fontWeight: 700, color: '#C8881A' }}>{estimasiKonv.totalPorsi}</div>
                              <div style={{ fontSize: 10, color: '#888' }}>porsi tersisa</div>
                              <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{estimasiKonv.qtyResep}{estimasiKonv.satuanResep}/{estimasiKonv.pax} pax</div>
                            </div>
                          )}

                          {/* Aksi */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <button className="btn btn-sm btn-outline" onClick={() => openEdit(m)}>✏️ Edit</button>
                            <button className="btn btn-sm btn-danger" onClick={() => deleteMaterial(m)}>🗑 Hapus</button>
                          </div>
                        </div>

                        {/* Estimasi dari resep */}
                        {estimasiResep.length > 0 && (
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>📖 BISA BUAT (dari resep):</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {estimasiResep.map((e, i) => (
                                <div key={i} style={{ background: e.porsi > 0 ? '#E8F5E0' : '#FFE8E8', borderRadius: 8, padding: '5px 10px', fontSize: 12 }}>
                                  <span style={{ fontWeight: 600 }}>{e.productName}</span>
                                  <span style={{ color: e.porsi > 0 ? '#2D5016' : 'var(--danger)', marginLeft: 6, fontWeight: 700 }}>{e.porsi} porsi</span>
                                  <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>({e.qtyUsed}{e.unit}/porsi)</span>
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
            <div className="card mb-2" style={{ padding: '0.75rem 1rem' }}>
            <input className="form-control" placeholder="🔍 Cari nama menu..." value={searchMenu} onChange={e => setSearchMenu(e.target.value)} />
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="table">
                <thead>
                  <tr><th>Menu</th><th>Harga</th><th>Stok Ready</th><th>Tersedia di Order</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                  {products.filter(p => !searchMenu || p.name.toLowerCase().includes(searchMenu.toLowerCase())).map(p => {
                    // Hitung min porsi yang bisa dibuat dari semua bahan
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
                              {minPorsi > 0 ? `✅ Bisa buat ${minPorsi} porsi` : '❌ Stok bahan tidak cukup'}
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
          )}
        </>
      )}
    </div>
  )
}
