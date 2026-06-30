import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')

const BAHAN_KATEGORI = [
  { key: 'utama', label: '🥩 Produk Utama', color: '#2D5016', bg: '#E8F5E0' },
  { key: 'bumbu', label: '🧄 Bumbu & Rempah', color: '#C8881A', bg: '#FFF3D6' },
  { key: 'kemasan', label: '📦 Kemasan', color: '#0077B6', bg: '#E0F4FF' },
  { key: 'lainnya', label: '📝 Lainnya', color: '#555', bg: '#F0F0F0' },
]

const SATUAN = ['gram', 'kg', 'ml', 'liter', 'pcs', 'sdm', 'sdt', 'sachet', 'buah', 'siung', 'lembar', 'bungkus']

// Harga efektif per satuan SETELAH disesuaikan susut masak (yield rate)
// Misal beli 1000gr @ Rp45.000, yield 50% (jadi 500gr matang) -> harga efektif = Rp90/gr (bukan Rp45/gr)
function calcHargaEfektif(hargaDasar, yieldRate) {
  const yr = parseFloat(yieldRate) || 100
  if (yr >= 100 || yr <= 0) return hargaDasar
  return hargaDasar / (yr / 100)
}

export default function KalkulatorHPP() {
  const [products, setProducts] = useState([])
  const [materials, setMaterials] = useState({})
  const [recipes, setRecipes] = useState({})
  const [overhead, setOverhead] = useState(20)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('hpp')
  const [konversiList, setKonversiList] = useState([])
  const [konversiLoading, setKonversiLoading] = useState(false)
  const [konversiForm, setKonversiForm] = useState({
    nama_bahan: '', satuan_beli: 'kg', qty_beli: '', harga_beli: '',
    satuan_resep: 'gram', qty_resep: '', pax: '', notes: ''
  })
  const [showKonversiForm, setShowKonversiForm] = useState(false)
  const [editKonversiIdx, setEditKonversiIdx] = useState(null)
  const [searchHPP, setSearchHPP] = useState('')
  const [searchKonversi, setSearchKonversi] = useState('')

  const fetchKonversi = async () => {
    setKonversiLoading(true)
    const { data } = await supabase.from('konversi_bahan').select('*').order('created_at')
    setKonversiList(data || [])
    setKonversiLoading(false)
  }

  useEffect(() => {
    fetchKonversi()
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

  // Deteksi kategori otomatis dari nama bahan
  const getKat = (name) => {
    const n = (name || '').toLowerCase()
    if (['bowl','sendok','kresek','stiker','label','plastik','kertas','box','cup','sedotan','tissue'].some(k => n.includes(k))) return 'kemasan'
    if (['bawang','lada','garam','gula','kecap','saos','saus','minyak','totole','kaldu','merica','kunyit','jahe','serai','daun','cabe','cabai','kemiri','ketumbar'].some(k => n.includes(k))) return 'bumbu'
    return 'utama'
  }

  const KAT_ORDER = { utama: 0, bumbu: 1, kemasan: 2 }
  const KAT_STYLE = {
    utama:   { color: '#2D5016', bg: '#E8F5E0', label: '🥩 Produk Utama' },
    bumbu:   { color: '#C8881A', bg: '#FFF3D6', label: '🧄 Bumbu & Rempah' },
    kemasan: { color: '#0077B6', bg: '#E0F4FF', label: '📦 Kemasan' },
  }

  const sortRecipes = (recs) => {
    return [...recs].sort((a, b) => (KAT_ORDER[getKat(a.material_name)] ?? 2) - (KAT_ORDER[getKat(b.material_name)] ?? 2))
  }

  const calcHPP = (productId) => {
    const recs = sortRecipes(recipes[productId] || [])
    let total = 0
    const details = recs.map(r => {
      const mat = materials[r.raw_material_id]
      if (!mat) return { name: r.material_name, cost: 0, qty: r.qty_used, unit: r.unit }
      // Konversi satuan resep → satuan beli dengan tabel konversi lengkap
      const KONVERSI_HPP = {
        'sdt->gram': 5, 'sdm->gram': 15, 'cup->gram': 120, 'siung->gram': 5,
        'sdt->ml': 5, 'sdm->ml': 15, 'cup->ml': 240,
        'gram->kg': 0.001, 'kg->gram': 1000,
        'ml->liter': 0.001, 'liter->ml': 1000,
      }
      const CAIR_KW = ['saos','saus','kecap','minyak','oil','air','cuka','susu','santan','kaldu']
      const matCair = CAIR_KW.some(k => (mat.name||'').toLowerCase().includes(k))
      const baseUnit = matCair ? 'ml' : 'gram'

      let qty = r.qty_used
      if (r.unit !== mat.unit) {
        const directKey = `${r.unit}->${mat.unit}`
        if (KONVERSI_HPP[directKey]) {
          qty = r.qty_used * KONVERSI_HPP[directKey]
        } else {
          // via base unit
          const toBase = KONVERSI_HPP[`${r.unit}->${baseUnit}`]
          const fromBase = KONVERSI_HPP[`${baseUnit}->${mat.unit}`]
          if (toBase && fromBase) qty = r.qty_used * toBase * fromBase
        }
      }
      const hargaDasar = mat.hpp_fifo > 0 ? mat.hpp_fifo : mat.last_price
      const hargaEfektif = calcHargaEfektif(hargaDasar, mat.yield_rate)
      const cost = qty * hargaEfektif
      total += cost
      return { name: r.material_name, cost, qty: r.qty_used, unit: r.unit, yieldRate: mat.yield_rate, hargaEfektif }
    })
    const overheadCost = total * (overhead / 100)
    const hpp = total + overheadCost
    return { details, bahanCost: total, overheadCost, hpp }
  }

  // Auto-update HPP ke tabel products
  const syncHPPToMenu = async (productId, hpp) => {
    await supabase.from('products').update({ hpp: Math.round(hpp) }).eq('id', productId)
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
    const hargaPerResep = hargaPerSatuanBeli * qtyResepNorm
    const hargaPerPax = pax > 0 ? hargaPerResep / pax : 0
    const totalPax = qtyResepNorm > 0 ? Math.floor(qtyBeli / qtyResepNorm) * pax : 0
    return { hargaPerSatuanBeli, hargaPerResep, hargaPerPax, totalPax }
  }

  const saveKonversi = async () => {
    if (!konversiForm.nama_bahan || !konversiForm.qty_beli || !konversiForm.harga_beli) return alert('Nama bahan, qty beli, dan harga wajib diisi!')
    const data = {
      nama_bahan: konversiForm.nama_bahan,
      satuan_beli: konversiForm.satuan_beli,
      qty_beli: parseFloat(konversiForm.qty_beli) || 0,
      harga_beli: parseInt(konversiForm.harga_beli) || 0,
      satuan_resep: konversiForm.satuan_resep,
      qty_resep: parseFloat(konversiForm.qty_resep) || 0,
      pax: parseFloat(konversiForm.pax) || 1,
      notes: konversiForm.notes || '',
    }
    if (editKonversiIdx !== null) {
      const item = konversiList[editKonversiIdx]
      await supabase.from('konversi_bahan').update(data).eq('id', item.id)
    } else {
      await supabase.from('konversi_bahan').insert(data)
    }
    await fetchKonversi()
    setKonversiForm({ nama_bahan: '', satuan_beli: 'kg', qty_beli: '', harga_beli: '', satuan_resep: 'gram', qty_resep: '', pax: '', notes: '' })
    setShowKonversiForm(false)
    setEditKonversiIdx(null)
  }

  const deleteKonversi = async (idx) => {
    if (!window.confirm('Hapus catatan ini?')) return
    await supabase.from('konversi_bahan').delete().eq('id', konversiList[idx].id)
    await fetchKonversi()
  }

  const filteredProducts = products.filter(p => !searchHPP || p.name.toLowerCase().includes(searchHPP.toLowerCase()))
  const filteredKonversi = konversiList.filter(k => !searchKonversi || k.nama_bahan.toLowerCase().includes(searchKonversi.toLowerCase()))

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

      {/* TAB HPP */}
      {tab === 'hpp' && (
        <div>
          <div className="card mb-2" style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>Overhead:</label>
              <input type="range" min="0" max="50" value={overhead} onChange={e => setOverhead(parseInt(e.target.value))} style={{ flex: 1 }} />
              <span style={{ fontWeight: 700, minWidth: 40 }}>{overhead}%</span>
            </div>
            <input className="form-control" placeholder="🔍 Cari nama menu..." value={searchHPP} onChange={e => setSearchHPP(e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {loading ? <div className="loading"><div className="spinner" /></div> : filteredProducts.map(p => {
              const { details, bahanCost, overheadCost, hpp } = calcHPP(p.id)
              const margin = p.price - hpp
              const marginPct = p.price > 0 ? ((margin / p.price) * 100).toFixed(1) : 0

              // Auto sync HPP ke products table jika ada resep
              if (details.length > 0 && Math.round(hpp) !== p.hpp) {
                syncHPPToMenu(p.id, hpp)
              }

              // Group ditangani di rendering

              return (
                <div key={p.id} className="card">
                  <div className="flex-between mb-1">
                    <h4 style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</h4>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Jual: {formatRp(p.price)}</span>
                  </div>
                  {details.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Belum ada resep.</p>
                  ) : (
                    <div>
                      {/* Tampilkan per kategori */}
                      {Object.entries(KAT_STYLE).map(([katKey, kat]) => {
                        const items = details.filter(d => getKat(d.name) === katKey)
                        if (items.length === 0) return null
                        return (
                          <div key={katKey} style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: kat.color, background: kat.bg, padding: '2px 8px', borderRadius: 4, display: 'inline-block', marginBottom: 4 }}>
                              {kat.label}
                            </div>
                            {items.map((d, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0', color: 'var(--text-muted)' }}>
                                <span style={{ color: kat.color, fontWeight: 600, marginRight: 4 }}>{i+1}.</span>
                                <span style={{ flex: 1 }}>
                                  {d.name} ({d.qty} {d.unit})
                                  {d.yieldRate > 0 && d.yieldRate < 100 && (
                                    <span style={{ fontSize: 10, color: '#C8881A', marginLeft: 6, fontWeight: 600 }}>⚖️ susut {d.yieldRate}%</span>
                                  )}
                                </span>
                                <span>{formatRp(d.cost)}</span>
                              </div>
                            ))}
                          </div>
                        )
                      })}
                      <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                          <span>Bahan baku</span><span>{formatRp(bahanCost)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>
                          <span>Overhead ({overhead}%)</span><span>{formatRp(overheadCost)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
                          <span>HPP</span><span style={{ color: '#C0392B' }}>{formatRp(hpp)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 13 }}>
                          <span>Margin</span>
                          <span style={{ color: margin >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {formatRp(margin)} ({marginPct}%)
                          </span>
                        </div>
                        <div style={{ marginTop: 6, fontSize: 11, color: '#2D5016', background: '#E8F5E0', borderRadius: 4, padding: '3px 8px' }}>
                          ✅ HPP otomatis tersinkron ke Manajemen Menu
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

      {/* TAB KONVERSI */}
      {tab === 'konversi' && (
        <div>
          <div className="flex-between mb-2">
            <div className="card" style={{ flex: 1, padding: '0.75rem 1rem', marginRight: 8 }}>
              <input className="form-control" placeholder="🔍 Cari nama bahan..." value={searchKonversi} onChange={e => setSearchKonversi(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={() => { setEditKonversiIdx(null); setKonversiForm({ nama_bahan: '', satuan_beli: 'kg', qty_beli: '', harga_beli: '', satuan_resep: 'gram', qty_resep: '', pax: '', notes: '' }); setShowKonversiForm(true) }}>
              + Tambah
            </button>
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
                  <input className="form-control" placeholder="Cth: Beras, Ayam fillet" value={konversiForm.nama_bahan} onChange={e => setKonversiForm(f => ({ ...f, nama_bahan: e.target.value }))} />
                </div>
                <div style={{ background: '#E8F5E0', borderRadius: 10, padding: '12px', marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#2D5016', marginBottom: 8 }}>📦 SATUAN BELI</div>
                  <div className="grid-2">
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Qty Beli *</label>
                      <input className="form-control" type="number" step="0.001" value={konversiForm.qty_beli} onChange={e => setKonversiForm(f => ({ ...f, qty_beli: e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Satuan</label>
                      <select className="form-control" value={konversiForm.satuan_beli} onChange={e => setKonversiForm(f => ({ ...f, satuan_beli: e.target.value }))}>
                        {SATUAN.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: 8, marginBottom: 0 }}>
                    <label className="form-label">Harga Beli (Rp) *</label>
                    <input className="form-control" type="number" value={konversiForm.harga_beli} onChange={e => setKonversiForm(f => ({ ...f, harga_beli: e.target.value }))} />
                  </div>
                </div>
                <div style={{ background: '#E0F4FF', borderRadius: 10, padding: '12px', marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#0077B6', marginBottom: 8 }}>🍳 PEMAKAIAN PER RESEP</div>
                  <div className="grid-2">
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Qty Pakai</label>
                      <input className="form-control" type="number" step="0.001" value={konversiForm.qty_resep} onChange={e => setKonversiForm(f => ({ ...f, qty_resep: e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Satuan</label>
                      <select className="form-control" value={konversiForm.satuan_resep} onChange={e => setKonversiForm(f => ({ ...f, satuan_resep: e.target.value }))}>
                        {SATUAN.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: 8, marginBottom: 0 }}>
                    <label className="form-label">Hasil berapa pax?</label>
                    <input className="form-control" type="number" value={konversiForm.pax} onChange={e => setKonversiForm(f => ({ ...f, pax: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-control" rows={2} value={konversiForm.notes} onChange={e => setKonversiForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                {konversiForm.qty_beli && konversiForm.harga_beli && konversiForm.qty_resep && (
                  <div style={{ background: '#FFF3D6', borderRadius: 10, padding: '12px', marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#C8881A', marginBottom: 8 }}>🧮 PREVIEW</div>
                    {(() => {
                      const k = calcKonversi(konversiForm)
                      return (
                        <div style={{ fontSize: 13 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span>HPP per resep</span><span style={{ fontWeight: 600 }}>{formatRp(k.hargaPerResep)}</span>
                          </div>
                          {konversiForm.pax && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span>HPP per pax</span><span style={{ fontWeight: 700, color: '#C0392B' }}>{formatRp(k.hargaPerPax)}</span>
                          </div>}
                          {k.totalPax > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Total pax dari {konversiForm.qty_beli} {konversiForm.satuan_beli}</span>
                            <span style={{ fontWeight: 700, color: '#2D5016' }}>{k.totalPax} pax</span>
                          </div>}
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

          {filteredKonversi.length === 0 ? (
            <div className="card empty-state"><p>Belum ada catatan konversi.</p></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {filteredKonversi.map((k, idx) => {
                const calc = calcKonversi(k)
                return (
                  <div key={idx} className="card">
                    <div className="flex-between mb-1">
                      <h4 style={{ fontWeight: 700, fontSize: 15 }}>{k.nama_bahan}</h4>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm btn-outline" onClick={() => { setKonversiForm({ nama_bahan: k.nama_bahan, satuan_beli: k.satuan_beli, qty_beli: String(k.qty_beli), harga_beli: String(k.harga_beli), satuan_resep: k.satuan_resep, qty_resep: String(k.qty_resep), pax: String(k.pax), notes: k.notes || '' }); setEditKonversiIdx(idx); setShowKonversiForm(true) }}>✏️</button>
                        <button className="btn btn-sm btn-danger" onClick={() => deleteKonversi(idx)}>🗑</button>
                      </div>
                    </div>
                    <div style={{ background: '#E8F5E0', borderRadius: 8, padding: '8px 10px', marginBottom: 6, fontSize: 13 }}>
                      <span style={{ fontWeight: 600, color: '#2D5016' }}>📦 Beli:</span> {k.qty_beli} {k.satuan_beli} = {formatRp(k.harga_beli)}
                    </div>
                    {k.qty_resep && <div style={{ background: '#E0F4FF', borderRadius: 8, padding: '8px 10px', marginBottom: 6, fontSize: 13 }}>
                      <span style={{ fontWeight: 600, color: '#0077B6' }}>🍳 Pakai:</span> {k.qty_resep} {k.satuan_resep} → {k.pax} pax
                    </div>}
                    <div style={{ background: '#FFF3D6', borderRadius: 8, padding: '8px 10px', marginBottom: 6 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#C0392B' }}>{formatRp(calc.hargaPerPax)}</div>
                          <div style={{ fontSize: 10, color: '#888' }}>per pax</div>
                        </div>
                        {calc.totalPax > 0 && <div style={{ textAlign: 'center' }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#2D5016' }}>{calc.totalPax} pax</div>
                          <div style={{ fontSize: 10, color: '#888' }}>dari {k.qty_beli} {k.satuan_beli}</div>
                        </div>}
                      </div>
                    </div>
                    {k.notes && <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: 6 }}>📝 {k.notes}</div>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
