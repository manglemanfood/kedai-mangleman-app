import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')

// ==================== KALKULATOR HPP ====================
export default function KalkulatorHPP() {
  const [products, setProducts] = useState([])
  const [materials, setMaterials] = useState({})
  const [recipes, setRecipes] = useState({})
  const [overhead, setOverhead] = useState(20)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('hpp')
  const [konversiList, setKonversiList] = useState([])
  const [konversiForm, setKonversiForm] = useState({ nama_bahan: '', satuan_beli: 'kg', qty_beli: '', harga_beli: '', satuan_resep: 'gram', qty_resep: '', pax: '', notes: '' })
  const [showKonversiForm, setShowKonversiForm] = useState(false)
  const [editKonversiIdx, setEditKonversiIdx] = useState(null)

  const SATUAN = ['gram','kg','ml','liter','pcs','sachet','bungkus','botol','buah','sdm','sdt']

  useEffect(() => {
    Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('raw_materials').select('*'),
      supabase.from('recipes').select('*'),
    ]).then(([p, m, r]) => {
      setProducts(p.data || [])
      const matMap = {}
      ;(m.data || []).forEach(mat => { matMap[mat.id] = mat })
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

  const calcKonversi = (k) => {
    const harga = parseFloat(k.harga_beli) || 0
    const qtyBeli = parseFloat(k.qty_beli) || 1
    const qtyResep = parseFloat(k.qty_resep) || 0
    const pax = parseFloat(k.pax) || 1
    const hargaPerSatuanBeli = harga / qtyBeli
    let qtyResepNorm = qtyResep
    if (k.satuan_beli === 'kg' && k.satuan_resep === 'gram') qtyResepNorm = qtyResep / 1000
    else if (k.satuan_beli === 'liter' && k.satuan_resep === 'ml') qtyResepNorm = qtyResep / 1000
    else if (k.satuan_beli === 'gram' && k.satuan_resep === 'kg') qtyResepNorm = qtyResep * 1000
    const hargaPerResep = hargaPerSatuanBeli * qtyResepNorm
    const hargaPerPax = pax > 0 ? hargaPerResep / pax : 0
    const totalPax = qtyResepNorm > 0 ? Math.floor(qtyBeli / qtyResepNorm) * pax : 0
    return { hargaPerSatuanBeli, hargaPerResep, hargaPerPax, totalPax }
  }

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
    setKonversiList(konversiList.filter((_, i) => i !== idx))
  }

  return (
    <div>
      <div className="page-header">
        <h1>Kalkulator HPP 🧮</h1>
        <p>HPP real-time dari resep + konversi satuan bahan</p>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'hpp' ? 'active' : ''}`} onClick={() => setTab('hpp')}>🧮 HPP per Menu</button>
        <button className={`tab ${tab === 'konversi' ? 'active' : ''}`} onClick={() => setTab('konversi')}>📐 Konversi Bahan ({konversiList.length})</button>
      </div>

      {tab === 'konversi' && (
        <div>
          <div className="flex-between mb-2">
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Catat konversi satuan beli → satuan resep → jumlah pax</p>
            <button className="btn btn-primary" onClick={() => { setEditKonversiIdx(null); setKonversiForm({ nama_bahan: '', satuan_beli: 'kg', qty_beli: '', harga_beli: '', satuan_resep: 'gram', qty_resep: '', pax: '', notes: '' }); setShowKonversiForm(true) }}>+ Tambah Catatan</button>
          </div>
          <div className="alert alert-info mb-2" style={{ fontSize: 12 }}>
            💡 <strong>Contoh:</strong> Beras 1 kg = Rp 13.000 → pakai 80 gram/porsi → 1 kg untuk 12 pax → HPP beras/pax = Rp 1.083
          </div>

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
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span>Biaya {konversiForm.qty_resep} {konversiForm.satuan_resep}</span>
                            <span style={{ fontWeight: 600 }}>{formatRp(k.hargaPerResep)}</span>
                          </div>
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

          {konversiList.length === 0 ? (
            <div className="card empty-state">
              <p>Belum ada catatan konversi.</p>
              <p style={{ fontSize: 12, marginTop: 8 }}>Tambahkan konversi bahan seperti: Beras 1kg = 12 pax ricebowl</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {konversiList.map((k, idx) => {
                const calc = calcKonversi(k)
                return (
                  <div key={idx} className="card">
                    <div className="flex-between mb-1">
                      <h4 style={{ fontWeight: 700, fontSize: 15 }}>{k.nama_bahan}</h4>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm btn-outline" onClick={() => { setKonversiForm(k); setEditKonversiIdx(idx); setShowKonversiForm(true) }}>✏️</button>
                        <button className="btn btn-sm btn-danger" onClick={() => deleteKonversi(idx)}>🗑</button>
                      </div>
                    </div>
                    <div style={{ background: '#E8F5E0', borderRadius: 8, padding: '8px 10px', marginBottom: 8, fontSize: 13 }}>
                      <span style={{ fontWeight: 600, color: '#2D5016' }}>📦 Beli:</span> {k.qty_beli} {k.satuan_beli} = {formatRp(k.harga_beli)}
                    </div>
                    {k.qty_resep && (
                      <div style={{ background: '#E0F4FF', borderRadius: 8, padding: '8px 10px', marginBottom: 8, fontSize: 13 }}>
                        <span style={{ fontWeight: 600, color: '#0077B6' }}>🍳 Pakai:</span> {k.qty_resep} {k.satuan_resep} per resep{k.pax ? ` → ${k.pax} pax` : ''}
                      </div>
                    )}
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
                    <div>
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
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
