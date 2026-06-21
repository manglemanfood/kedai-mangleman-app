import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const formatRp = (n) => 'Rp ' + Number(Math.abs(n || 0)).toLocaleString('id-ID')

// Template bundling otomatis berdasarkan kategori menu
const generateBundlingSuggestions = (products) => {
  const byCategory = {}
  products.forEach(p => {
    if (!byCategory[p.category]) byCategory[p.category] = []
    byCategory[p.category].push(p)
  })

  const suggestions = []

  // Ricebowl + Minuman
  const ricebowls = byCategory['ricebowl'] || []
  const minuman = byCategory['minuman'] || []
  const snacks = byCategory['snack'] || []
  const dimsum = byCategory['dimsum'] || []

  ricebowls.forEach(rb => {
    minuman.slice(0, 2).forEach(mn => {
      const normalPrice = rb.price + mn.price
      const diskon = Math.round(normalPrice * 0.1)
      suggestions.push({
        id: `${rb.id}-${mn.id}`,
        name: `Paket ${rb.name.replace('Ricebowl ', '')} + ${mn.name}`,
        type: 'Makan + Minum',
        items: [{ ...rb, qty: 1 }, { ...mn, qty: 1 }],
        normalPrice,
        diskon,
        bundlePrice: normalPrice - diskon,
        tag: '🍱+🥤',
        strategy: 'Paket hemat paling laris — tingkatkan average order value',
      })
    })
  })

  // Ricebowl + Dimsum
  ricebowls.slice(0, 2).forEach(rb => {
    dimsum.slice(0, 1).forEach(ds => {
      const normalPrice = rb.price + ds.price
      const diskon = Math.round(normalPrice * 0.08)
      suggestions.push({
        id: `${rb.id}-${ds.id}`,
        name: `Paket ${rb.name.replace('Ricebowl ', '')} + ${ds.name}`,
        type: 'Makan + Snack',
        items: [{ ...rb, qty: 1 }, { ...ds, qty: 1 }],
        normalPrice,
        diskon,
        bundlePrice: normalPrice - diskon,
        tag: '🍱+🥟',
        strategy: 'Kombinasi mengenyangkan — cocok untuk makan siang kantoran',
      })
    })
  })

  // Triple combo
  if (ricebowls.length > 0 && minuman.length > 0 && (snacks.length > 0 || dimsum.length > 0)) {
    const rb = ricebowls[0]
    const mn = minuman[0]
    const sn = snacks[0] || dimsum[0]
    const normalPrice = rb.price + mn.price + sn.price
    const diskon = Math.round(normalPrice * 0.12)
    suggestions.push({
      id: `triple-${rb.id}`,
      name: `Paket Hemat Lengkap`,
      type: 'Triple Combo',
      items: [{ ...rb, qty: 1 }, { ...mn, qty: 1 }, { ...sn, qty: 1 }],
      normalPrice,
      diskon,
      bundlePrice: normalPrice - diskon,
      tag: '🍱+🥤+🍿',
      strategy: 'Bundle premium — dorong customer spend lebih tinggi',
    })
  }

  // Buy 2 get discount
  ricebowls.slice(0, 3).forEach(rb => {
    const normalPrice = rb.price * 2
    const diskon = Math.round(rb.price * 0.15)
    suggestions.push({
      id: `2x-${rb.id}`,
      name: `2x ${rb.name}`,
      type: 'Buy More Save More',
      items: [{ ...rb, qty: 2 }],
      normalPrice,
      diskon,
      bundlePrice: normalPrice - diskon,
      tag: '2️⃣',
      strategy: 'Cocok untuk order bareng teman — tingkatkan volume per transaksi',
    })
  })

  return suggestions.slice(0, 12)
}

const PERIODE_OPTIONS = [
  { key: 'harian', label: '📅 Harian' },
  { key: 'pekanan', label: '📆 Pekanan' },
  { key: 'bulanan', label: '🗓 Bulanan' },
]

const TYPE_COLORS = {
  'Makan + Minum': { bg: '#E8F5E0', color: '#2D5016' },
  'Makan + Snack': { bg: '#FFF3D6', color: '#C8881A' },
  'Triple Combo':  { bg: '#EDE0FF', color: '#6B2FD9' },
  'Buy More Save More': { bg: '#E0F4FF', color: '#0077B6' },
  'Custom':        { bg: '#F0F0F0', color: '#555' },
}

export default function Bundling() {
  const [products, setProducts] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [savedBundles, setSavedBundles] = useState([])
  const [tab, setTab] = useState('rekomendasi')
  const [loading, setLoading] = useState(true)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [confirmBundle, setConfirmBundle] = useState(null)
  const [editSaved, setEditSaved] = useState(null)
  const [editSavedForm, setEditSavedForm] = useState({})
  const [editSaved, setEditSaved] = useState(null)
  const [editSavedForm, setEditSavedForm] = useState({}) // bundle yang mau disimpan
  const [confirmForm, setConfirmForm] = useState({ periode: 'harian', diskon: 0, bundlePrice: 0, notes: '' })
  const [editBundle, setEditBundle] = useState(null)
  const [saving, setSaving] = useState(false)
  const [filterPeriode, setFilterPeriode] = useState('Semua')
  const [search, setSearch] = useState('')

  // Custom bundle form
  const [customForm, setCustomForm] = useState({
    name: '', type: 'Custom', strategy: '', periode: 'harian',
    normalPrice: 0, diskon: 0, bundlePrice: 0, items: [], notes: '',
    isActive: true,
  })
  const [selectedItems, setSelectedItems] = useState([])

  useEffect(() => {
    const load = async () => {
      const [prodRes, bundleRes] = await Promise.all([
        supabase.from('products').select('*').eq('is_available', true).order('category'),
        supabase.from('bundling_packages').select('*').order('created_at', { ascending: false }),
      ])
      const prods = prodRes.data || []
      setProducts(prods)
      setSuggestions(generateBundlingSuggestions(prods))
      setSavedBundles(bundleRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const openEditSaved = (b) => {
    const items = typeof b.items === 'string' ? JSON.parse(b.items) : b.items || []
    setEditSaved(b)
    setEditSavedForm({
      name: b.name,
      strategy: b.strategy || '',
      periode: b.periode,
      diskon: b.diskon,
      bundle_price: b.bundle_price,
      normal_price: b.normal_price,
      notes: b.notes || '',
    })
  }

  const saveEditSaved = async () => {
    if (!editSaved) return
    setSaving(true)
    await supabase.from('bundling_packages').update({
      name: editSavedForm.name,
      strategy: editSavedForm.strategy,
      periode: editSavedForm.periode,
      diskon: parseInt(editSavedForm.diskon) || 0,
      bundle_price: parseInt(editSavedForm.bundle_price) || 0,
      notes: editSavedForm.notes,
    }).eq('id', editSaved.id)
    const { data: fresh } = await supabase.from('bundling_packages').select('*').order('created_at', { ascending: false })
    setSavedBundles(fresh || [])
    setSaving(false)
    setEditSaved(null)
  }

  const openEditSaved = (b) => {
    setEditSaved(b)
    const items = typeof b.items === 'string' ? JSON.parse(b.items) : b.items || []
    setEditSavedForm({
      name: b.name,
      strategy: b.strategy || '',
      periode: b.periode,
      diskon: b.diskon,
      bundle_price: b.bundle_price,
      normal_price: b.normal_price,
      notes: b.notes || '',
      start_date: b.start_date || '',
      end_date: b.end_date || '',
      is_active: b.is_active,
      items,
    })
  }

  const saveEditSaved = async () => {
    if (!editSaved) return
    setSaving(true)
    await supabase.from('bundling_packages').update({
      name: editSavedForm.name,
      strategy: editSavedForm.strategy,
      periode: editSavedForm.periode,
      diskon: parseInt(editSavedForm.diskon) || 0,
      bundle_price: parseInt(editSavedForm.bundle_price) || 0,
      notes: editSavedForm.notes,
      start_date: editSavedForm.start_date || null,
      end_date: editSavedForm.end_date || null,
      is_active: editSavedForm.is_active,
    }).eq('id', editSaved.id)
    const { data: fresh } = await supabase.from('bundling_packages').select('*').order('created_at', { ascending: false })
    setSavedBundles(fresh || [])
    setSaving(false)
    setEditSaved(null)
  }

  const openConfirm = (bundle) => {
    setConfirmBundle(bundle)
    setConfirmForm({
      periode: 'harian',
      diskon: bundle.diskon,
      bundlePrice: bundle.bundlePrice,
      notes: '',
    })
  }

  const saveBundle = async (bundle, periode = 'harian') => {
    setSaving(true)
    // Kalau dari popup konfirmasi, pakai confirmForm
    const useConfirm = confirmBundle && bundle.id === confirmBundle.id
    const finalDiskon = useConfirm ? confirmForm.diskon : bundle.diskon
    const finalBundlePrice = useConfirm ? confirmForm.bundlePrice : bundle.bundlePrice
    const finalPeriode = useConfirm ? confirmForm.periode : periode
    const finalNotes = useConfirm ? confirmForm.notes : (bundle.notes || '')

    const data = {
      name: bundle.name,
      type: bundle.type,
      tag: bundle.tag || '📦',
      strategy: bundle.strategy,
      periode: finalPeriode,
      items: JSON.stringify(bundle.items),
      normal_price: bundle.normalPrice,
      diskon: finalDiskon,
      bundle_price: finalBundlePrice,
      notes: finalNotes,
      start_date: null,
      end_date: null,
      is_active: true,
    }
    if (editBundle) {
      await supabase.from('bundling_packages').update(data).eq('id', editBundle.id)
    } else {
      await supabase.from('bundling_packages').insert(data)
    }
    const { data: fresh } = await supabase.from('bundling_packages').select('*').order('created_at', { ascending: false })
    setSavedBundles(fresh || [])
    setSaving(false)
    setShowCustomForm(false)
    setEditBundle(null)
    setConfirmBundle(null)
    setTab('tersimpan')
  }

  const deleteBundle = async (id) => {
    if (!window.confirm('Hapus paket bundling ini?')) return
    await supabase.from('bundling_packages').delete().eq('id', id)
    setSavedBundles(b => b.filter(x => x.id !== id))
  }

  const toggleActive = async (id, val) => {
    await supabase.from('bundling_packages').update({ is_active: val }).eq('id', id)
    setSavedBundles(b => b.map(x => x.id === id ? { ...x, is_active: val } : x))
  }

  // Kalkulasi custom
  useEffect(() => {
    const total = selectedItems.reduce((s, i) => s + (i.price * i.qty), 0)
    const disc = Math.round(total * 0.1)
    setCustomForm(f => ({ ...f, normalPrice: total, diskon: disc, bundlePrice: total - disc, items: selectedItems }))
  }, [selectedItems])

  const addItemToCustom = (product) => {
    setSelectedItems(prev => {
      const ex = prev.find(i => i.id === product.id)
      if (ex) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { ...product, qty: 1 }]
    })
  }

  const removeItemFromCustom = (id) => {
    setSelectedItems(prev => prev.filter(i => i.id !== id))
  }

  const filteredSaved = savedBundles.filter(b => {
    const matchPeriode = filterPeriode === 'Semua' || b.periode === filterPeriode
    const matchSearch = !search || b.name.toLowerCase().includes(search.toLowerCase())
    return matchPeriode && matchSearch
  })

  // Analisa bundle tersimpan
  const totalBundles = savedBundles.length
  const activeBundles = savedBundles.filter(b => b.is_active).length
  const avgDiskon = savedBundles.length > 0
    ? Math.round(savedBundles.reduce((s, b) => s + (b.normal_price > 0 ? (b.diskon / b.normal_price) * 100 : 0), 0) / savedBundles.length)
    : 0
  const totalPotentialRevenue = savedBundles.filter(b => b.is_active).reduce((s, b) => s + b.bundle_price, 0)

  return (
    <div>
      {/* Header */}
      <div className="page-header flex-between" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>🎁 Rekomendasi Paket Bundling</h1>
          <p>Strategi bundling untuk tingkatkan omset & average order value</p>
        </div>
        <button className="btn btn-primary" onClick={() => {
          setEditBundle(null)
          setSelectedItems([])
          setCustomForm({ name: '', type: 'Custom', strategy: '', periode: 'harian', normalPrice: 0, diskon: 0, bundlePrice: 0, items: [], notes: '', isActive: true })
          setShowCustomForm(true)
        }}>
          + Buat Paket Custom
        </button>
      </div>

      {/* Stats */}
      <div className="grid-4 mb-2">
        {[
          { label: 'Total Paket', value: totalBundles, icon: '📦', color: '#1A2E0A' },
          { label: 'Paket Aktif', value: activeBundles, icon: '✅', color: '#16A34A' },
          { label: 'Rata-rata Diskon', value: avgDiskon + '%', icon: '🏷️', color: '#D97706' },
          { label: 'Potensi Revenue/Hari', value: formatRp(totalPotentialRevenue), icon: '💰', color: '#2563EB' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'rekomendasi' ? 'active' : ''}`} onClick={() => setTab('rekomendasi')}>
          🤖 Rekomendasi AI ({suggestions.length})
        </button>
        <button className={`tab ${tab === 'tersimpan' ? 'active' : ''}`} onClick={() => setTab('tersimpan')}>
          💾 Paket Tersimpan ({savedBundles.length})
        </button>
        <button className={`tab ${tab === 'analisa' ? 'active' : ''}`} onClick={() => setTab('analisa')}>
          📊 Analisa & Strategi
        </button>
      </div>

      {loading ? <div className="loading"><div className="spinner" /></div> : (
        <>
          {/* ─── TAB REKOMENDASI ─── */}
          {tab === 'rekomendasi' && (
            <div>
              <div className="alert alert-info mb-2" style={{ fontSize: 13 }}>
                🤖 <strong>Rekomendasi otomatis</strong> berdasarkan menu aktif Kedai MangLeman. Klik "Simpan" untuk tambahkan ke plan bundling kamu.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                {suggestions.map(s => {
                  const style = TYPE_COLORS[s.type] || TYPE_COLORS['Custom']
                  const pctDiskon = s.normalPrice > 0 ? Math.round((s.diskon / s.normalPrice) * 100) : 0
                  return (
                    <div key={s.id} className="card" style={{ border: `1.5px solid ${style.color}33` }}>
                      {/* Header card */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <span style={{ fontSize: 20 }}>{s.tag}</span>
                          <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>{s.name}</div>
                          <span style={{ display: 'inline-block', background: style.bg, color: style.color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, marginTop: 3 }}>
                            {s.type}
                          </span>
                        </div>
                        <div style={{ background: '#DC2626', color: '#fff', borderRadius: 8, padding: '4px 10px', fontSize: 13, fontWeight: 700 }}>
                          -{pctDiskon}%
                        </div>
                      </div>

                      {/* Items */}
                      <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
                        {s.items.map((item, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '2px 0' }}>
                            <span>{item.qty > 1 ? `${item.qty}x ` : ''}{item.name}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{formatRp(item.price * item.qty)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Harga */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'line-through' }}>{formatRp(s.normalPrice)}</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: '#16A34A' }}>{formatRp(s.bundlePrice)}</div>
                          <div style={{ fontSize: 11, color: '#DC2626' }}>Hemat {formatRp(s.diskon)}</div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', maxWidth: 140 }}>
                          {s.strategy}
                        </div>
                      </div>

                      {/* Aksi */}
                      <button onClick={() => openConfirm(s)}
                        className="btn btn-primary btn-block"
                        style={{ marginTop: 4, fontSize: 13, fontWeight: 700 }}>
                        💾 Simpan ke Plan
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ─── TAB TERSIMPAN ─── */}
          {tab === 'tersimpan' && (
            <div>
              {/* Filter */}
              <div className="card mb-2" style={{ padding: '0.75rem 1rem', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <input className="form-control" placeholder="🔍 Cari paket..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
                <div style={{ display: 'flex', gap: 4 }}>
                  {['Semua', 'harian', 'pekanan', 'bulanan'].map(p => (
                    <button key={p} onClick={() => setFilterPeriode(p)} className="btn btn-sm"
                      style={{ background: filterPeriode === p ? '#1A2E0A' : 'transparent', color: filterPeriode === p ? '#fff' : 'var(--text)', border: '1px solid var(--border)', textTransform: 'capitalize' }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {filteredSaved.length === 0 ? (
                <div className="card empty-state">
                  <p>Belum ada paket tersimpan.</p>
                  <p style={{ fontSize: 12, marginTop: 8 }}>Simpan dari tab Rekomendasi atau buat paket custom.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                  {filteredSaved.map(b => {
                    const style = TYPE_COLORS[b.type] || TYPE_COLORS['Custom']
                    const items = typeof b.items === 'string' ? JSON.parse(b.items) : b.items || []
                    const pctDiskon = b.normal_price > 0 ? Math.round((b.diskon / b.normal_price) * 100) : 0
                    return (
                      <div key={b.id} className="card" style={{ border: `1.5px solid ${b.is_active ? style.color + '44' : '#E5E5E5'}`, opacity: b.is_active ? 1 : 0.6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div>
                            <span style={{ fontSize: 18 }}>{b.tag}</span>
                            <div style={{ fontWeight: 700, fontSize: 14, marginTop: 3 }}>{b.name}</div>
                            <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                              <span style={{ background: style.bg, color: style.color, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20 }}>{b.type}</span>
                              <span style={{ background: '#F0F0F0', color: '#555', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, textTransform: 'capitalize' }}>
                                {b.periode === 'harian' ? '📅' : b.periode === 'pekanan' ? '📆' : '🗓'} {b.periode}
                              </span>
                              <span style={{ background: b.is_active ? '#E8F5E0' : '#FFE8E8', color: b.is_active ? '#2D5016' : '#C0392B', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20 }}>
                                {b.is_active ? '✅ Aktif' : '⏸ Nonaktif'}
                              </span>
                            </div>
                          </div>
                          <div style={{ background: '#DC2626', color: '#fff', borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 700 }}>-{pctDiskon}%</div>
                        </div>

                        {items.length > 0 && (
                          <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '6px 10px', marginBottom: 8 }}>
                            {items.map((item, i) => (
                              <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', padding: '1px 0' }}>
                                {item.qty > 1 ? `${item.qty}x ` : ''}{item.name} — {formatRp(item.price * item.qty)}
                              </div>
                            ))}
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'line-through' }}>{formatRp(b.normal_price)}</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: '#16A34A' }}>{formatRp(b.bundle_price)}</div>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', maxWidth: 120 }}>{b.strategy}</div>
                        </div>

                        {b.notes && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 8, padding: '4px 8px', background: 'var(--bg)', borderRadius: 6 }}>
                            📝 {b.notes}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => toggleActive(b.id, !b.is_active)} className="btn btn-sm btn-outline" style={{ flex: 1, fontSize: 11 }}>
                            {b.is_active ? '⏸ Nonaktif' : '▶️ Aktifkan'}
                          </button>
                          <button onClick={() => openEditSaved(b)} className="btn btn-sm btn-outline" style={{ fontSize: 11 }}>✏️</button>
                          <button onClick={() => deleteBundle(b.id)} className="btn btn-sm btn-danger" style={{ fontSize: 11 }}>🗑</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── TAB ANALISA ─── */}
          {tab === 'analisa' && (
            <div>
              <div className="grid-2 mb-2">
                {/* Strategi bundling */}
                <div className="card">
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>📚 Strategi Bundling untuk UMKM FnB</div>
                  {[
                    { icon: '🥇', title: 'Paket Makan + Minum (Paling Efektif)', desc: 'Diskon 8-12%. Customer cenderung tambah minuman jika ada paket hemat. AOV naik 25-40%.', color: '#16A34A' },
                    { icon: '🥈', title: 'Buy 2 Get Discount', desc: 'Diskon 10-15% untuk pembelian 2 item sama. Cocok untuk order grup kantor.', color: '#D97706' },
                    { icon: '🥉', title: 'Triple Combo Premium', desc: 'Makan + Minum + Snack dengan diskon 12%. Untuk customer yang mau experience lengkap.', color: '#2563EB' },
                    { icon: '⚡', title: 'Flash Bundle (Jam Tertentu)', desc: 'Paket spesial jam 11-13 (makan siang) atau jam 15-17 (snack time). Diskon lebih besar 15-20%.', color: '#7C3AED' },
                    { icon: '📅', title: 'Bundle Mingguan (Pre-order)', desc: 'Customer pre-order 5 hari sekaligus. Jaminan pendapatan + efisiensi produksi.', color: '#DC2626' },
                  ].map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{s.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: s.color }}>{s.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{s.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Analisa paket aktif */}
                <div>
                  <div className="card mb-2">
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>📊 Komposisi Paket Aktif</div>
                    {PERIODE_OPTIONS.map(p => {
                      const count = savedBundles.filter(b => b.periode === p.key && b.is_active).length
                      const total = savedBundles.filter(b => b.is_active).length || 1
                      return (
                        <div key={p.key} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
                            <span>{p.label}</span>
                            <span style={{ fontWeight: 600 }}>{count} paket</span>
                          </div>
                          <div style={{ background: 'var(--border)', borderRadius: 20, height: 8 }}>
                            <div style={{ width: `${(count/total)*100}%`, background: '#E8A838', height: '100%', borderRadius: 20 }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="card mb-2">
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>💡 Tips Implementasi</div>
                    {[
                      '📱 Tampilkan paket di form order customer — buat kolom "Pilih Paket Hemat"',
                      '🖨️ Print daftar paket untuk dipajang di lokasi pengiriman',
                      '📢 Share paket harian via status WA/Instagram setiap pagi',
                      '⏰ Paket pekanan diumumkan setiap Senin pagi',
                      '🎯 Evaluasi paket mana yang paling banyak dipesan setiap bulan',
                      '📈 Naikkan harga bundle bertahap 5% jika demand tinggi',
                    ].map((t, i) => (
                      <div key={i} style={{ fontSize: 13, color: 'var(--text-muted)', padding: '5px 0', borderBottom: i < 5 ? '1px solid var(--border)' : 'none' }}>
                        {t}
                      </div>
                    ))}
                  </div>

                  <div className="card">
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>🎯 Target Impact Bundling</div>
                    {[
                      { label: 'Kenaikan AOV (avg order value)', value: '+25-40%', color: '#16A34A' },
                      { label: 'Kenaikan frekuensi order', value: '+10-20%', color: '#2563EB' },
                      { label: 'Pengurangan margin per item', value: '-8-15%', color: '#DC2626' },
                      { label: 'Kenaikan total omset', value: '+15-30%', color: '#16A34A' },
                    ].map((s, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                        <span style={{ fontWeight: 800, color: s.color }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Plan per periode */}
              {['harian','pekanan','bulanan'].map(periode => {
                const bundles = savedBundles.filter(b => b.periode === periode && b.is_active)
                if (bundles.length === 0) return null
                const icon = periode === 'harian' ? '📅' : periode === 'pekanan' ? '📆' : '🗓'
                return (
                  <div key={periode} className="card mb-2">
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
                      {icon} Plan Bundling {periode.charAt(0).toUpperCase() + periode.slice(1)} ({bundles.length} paket)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                      {bundles.map(b => (
                        <div key={b.id} style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{b.tag} {b.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{b.strategy}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, fontSize: 15, color: '#16A34A' }}>{formatRp(b.bundle_price)}</div>
                            <div style={{ fontSize: 10, color: '#DC2626' }}>hemat {formatRp(b.diskon)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Edit Saved Bundle Modal */}
      {editSaved && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex-between mb-2">
              <h3 style={{ fontWeight: 700 }}>✏️ Edit Paket Bundling</h3>
              <button onClick={() => setEditSaved(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>✕</button>
            </div>

            <div className="form-group">
              <label className="form-label">Nama Paket</label>
              <input className="form-control" value={editSavedForm.name || ''} onChange={e => setEditSavedForm(f => ({ ...f, name: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Strategi / Deskripsi</label>
              <input className="form-control" value={editSavedForm.strategy || ''} onChange={e => setEditSavedForm(f => ({ ...f, strategy: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Periode Plan</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {[
                  { key: 'harian', icon: '📅', label: 'Harian' },
                  { key: 'pekanan', icon: '📆', label: 'Pekanan' },
                  { key: 'bulanan', icon: '🗓', label: 'Bulanan' },
                ].map(p => (
                  <button key={p.key} onClick={() => setEditSavedForm(f => ({ ...f, periode: p.key }))}
                    style={{ padding: '10px', borderRadius: 10, border: `2px solid ${editSavedForm.periode === p.key ? '#1A2E0A' : 'var(--border)'}`, background: editSavedForm.periode === p.key ? '#1A2E0A' : '#fff', color: editSavedForm.periode === p.key ? '#fff' : 'var(--text)', cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ fontSize: 18 }}>{p.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{p.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span>Harga Normal</span>
                <span style={{ fontWeight: 600, textDecoration: 'line-through', color: 'var(--text-muted)' }}>{formatRp(editSavedForm.normal_price)}</span>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Diskon (Rp)</label>
                <input className="form-control" type="number"
                  value={editSavedForm.diskon}
                  onChange={e => {
                    const d = parseInt(e.target.value) || 0
                    setEditSavedForm(f => ({ ...f, diskon: d, bundle_price: f.normal_price - d }))
                  }} />
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                  = {editSavedForm.normal_price > 0 ? Math.round((editSavedForm.diskon / editSavedForm.normal_price) * 100) : 0}% diskon
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 18, color: '#16A34A', marginTop: 8, padding: '8px', background: '#F0FDF4', borderRadius: 8 }}>
                <span>Harga Bundle</span>
                <span>{formatRp(editSavedForm.bundle_price)}</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Catatan</label>
              <textarea className="form-control" rows={2} value={editSavedForm.notes || ''} onChange={e => setEditSavedForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setEditSaved(null)}>Batal</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={saveEditSaved} disabled={saving}>
                {saving ? '⏳ Menyimpan...' : '💾 Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Saved Bundle Modal */}
      {editSaved && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex-between mb-2">
              <h3 style={{ fontWeight: 700 }}>✏️ Edit Paket Bundling</h3>
              <button onClick={() => setEditSaved(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>✕</button>
            </div>

            <div className="form-group">
              <label className="form-label">Nama Paket</label>
              <input className="form-control" value={editSavedForm.name || ''} onChange={e => setEditSavedForm(f => ({ ...f, name: e.target.value }))} />
            </div>

            {/* Item list (read only) */}
            {editSavedForm.items?.length > 0 && (
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px', marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>ISI PAKET</div>
                {editSavedForm.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 2 }}>
                    <span>{item.qty > 1 ? `${item.qty}x ` : ''}{item.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{formatRp(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Edit harga */}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Diskon (Rp)</label>
                <input className="form-control" type="number" value={editSavedForm.diskon || 0}
                  onChange={e => {
                    const d = parseInt(e.target.value) || 0
                    setEditSavedForm(f => ({ ...f, diskon: d, bundle_price: (f.normal_price || 0) - d }))
                  }} />
              </div>
              <div className="form-group">
                <label className="form-label">Harga Bundle (Rp)</label>
                <input className="form-control" type="number" value={editSavedForm.bundle_price || 0}
                  onChange={e => {
                    const bp = parseInt(e.target.value) || 0
                    setEditSavedForm(f => ({ ...f, bundle_price: bp, diskon: (f.normal_price || 0) - bp }))
                  }} />
              </div>
            </div>

            {/* Preview harga */}
            <div style={{ background: '#F0FDF4', borderRadius: 8, padding: '10px 12px', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, color: '#888' }}>Normal: <span style={{ textDecoration: 'line-through' }}>{formatRp(editSavedForm.normal_price)}</span></div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#16A34A' }}>{formatRp(editSavedForm.bundle_price)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>Hemat {formatRp(editSavedForm.diskon)}</div>
                <div style={{ fontSize: 11, color: '#888' }}>
                  {editSavedForm.normal_price > 0 ? Math.round((editSavedForm.diskon / editSavedForm.normal_price) * 100) : 0}% diskon
                </div>
              </div>
            </div>

            {/* Periode */}
            <div className="form-group">
              <label className="form-label">📅 Periode Plan</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {[['harian','📅','Harian'],['pekanan','📆','Pekanan'],['bulanan','🗓','Bulanan']].map(([k,icon,label]) => (
                  <button key={k} onClick={() => setEditSavedForm(f => ({ ...f, periode: k }))}
                    style={{ padding: '8px', borderRadius: 8, border: `2px solid ${editSavedForm.periode === k ? '#1A2E0A' : 'var(--border)'}`, background: editSavedForm.periode === k ? '#1A2E0A' : '#fff', color: editSavedForm.periode === k ? '#fff' : 'var(--text)', cursor: 'pointer', fontWeight: editSavedForm.periode === k ? 700 : 400, fontSize: 13 }}>
                    {icon} {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tanggal berlaku */}
            <div style={{ background: '#EFF6FF', borderRadius: 10, padding: '12px', marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#1D4ED8', marginBottom: 10 }}>📅 Tanggal Berlaku Paket</div>
              <div className="grid-2">
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Mulai Tanggal</label>
                  <input className="form-control" type="date" value={editSavedForm.start_date || ''}
                    onChange={e => setEditSavedForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Sampai Tanggal</label>
                  <input className="form-control" type="date" value={editSavedForm.end_date || ''}
                    onChange={e => setEditSavedForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>
              <p style={{ fontSize: 11, color: '#2563EB', marginTop: 6 }}>
                💡 Kosongkan jika paket berlaku terus-menerus tanpa batas waktu
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Strategi / Deskripsi</label>
              <input className="form-control" value={editSavedForm.strategy || ''}
                onChange={e => setEditSavedForm(f => ({ ...f, strategy: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">Catatan Internal</label>
              <textarea className="form-control" rows={2} value={editSavedForm.notes || ''}
                onChange={e => setEditSavedForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setEditSaved(null)}>Batal</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={saveEditSaved} disabled={saving}>
                {saving ? '⏳ Menyimpan...' : '💾 Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Save Modal */}
      {confirmBundle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: 460 }}>
            <div className="flex-between mb-2">
              <h3 style={{ fontWeight: 700 }}>💾 Simpan Paket ke Plan</h3>
              <button onClick={() => setConfirmBundle(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>✕</button>
            </div>

            {/* Preview paket */}
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{confirmBundle.tag} {confirmBundle.name}</div>
              {confirmBundle.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)', marginBottom: 2 }}>
                  <span>{item.qty > 1 ? `${item.qty}x ` : ''}{item.name}</span>
                  <span>{formatRp(item.price * item.qty)}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                <span>Harga Normal</span>
                <span style={{ textDecoration: 'line-through' }}>{formatRp(confirmBundle.normalPrice)}</span>
              </div>
            </div>

            {/* Edit diskon */}
            <div className="form-group">
              <label className="form-label">💰 Diskon (Rp) — bisa disesuaikan</label>
              <input className="form-control" type="number"
                value={confirmForm.diskon}
                onChange={e => {
                  const d = parseInt(e.target.value) || 0
                  setConfirmForm(f => ({ ...f, diskon: d, bundlePrice: confirmBundle.normalPrice - d }))
                }} />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                Diskon saat ini: {confirmBundle.normalPrice > 0 ? Math.round((confirmForm.diskon / confirmBundle.normalPrice) * 100) : 0}% dari harga normal
              </p>
            </div>

            {/* Harga bundle hasil */}
            <div style={{ background: '#F0FDF4', borderRadius: 10, padding: '12px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>Harga Bundle</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#16A34A' }}>{formatRp(confirmForm.bundlePrice)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>Hemat {formatRp(confirmForm.diskon)}</div>
                <div style={{ fontSize: 11, color: '#888' }}>dari {formatRp(confirmBundle.normalPrice)}</div>
              </div>
            </div>

            {/* Periode */}
            <div className="form-group">
              <label className="form-label">📅 Masukkan ke Plan</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  { key: 'harian', icon: '📅', label: 'Harian', desc: 'Promo setiap hari' },
                  { key: 'pekanan', icon: '📆', label: 'Pekanan', desc: 'Promo per minggu' },
                  { key: 'bulanan', icon: '🗓', label: 'Bulanan', desc: 'Promo per bulan' },
                ].map(p => (
                  <button key={p.key} onClick={() => setConfirmForm(f => ({ ...f, periode: p.key }))}
                    style={{ padding: '10px 8px', borderRadius: 10, border: `2px solid ${confirmForm.periode === p.key ? '#1A2E0A' : 'var(--border)'}`, background: confirmForm.periode === p.key ? '#1A2E0A' : '#fff', color: confirmForm.periode === p.key ? '#fff' : 'var(--text)', cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ fontSize: 20 }}>{p.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{p.label}</div>
                    <div style={{ fontSize: 10, opacity: 0.7 }}>{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Catatan */}
            <div className="form-group">
              <label className="form-label">📝 Catatan (opsional)</label>
              <input className="form-control" placeholder="Cth: Berlaku jam 11-14, khusus gedung A..."
                value={confirmForm.notes}
                onChange={e => setConfirmForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setConfirmBundle(null)}>Batal</button>
              <button className="btn btn-primary" style={{ flex: 2 }} disabled={saving}
                onClick={() => saveBundle(confirmBundle, confirmForm.periode)}>
                {saving ? '⏳ Menyimpan...' : `💾 Simpan ke Plan ${confirmForm.periode.charAt(0).toUpperCase() + confirmForm.periode.slice(1)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Bundle Modal */}
      {showCustomForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex-between mb-2">
              <h3 style={{ fontWeight: 700 }}>🎁 Buat Paket Bundling Custom</h3>
              <button onClick={() => setShowCustomForm(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>✕</button>
            </div>

            <div className="form-group">
              <label className="form-label">Nama Paket *</label>
              <input className="form-control" placeholder="Cth: Paket Jumat Spesial" value={customForm.name} onChange={e => setCustomForm(f => ({ ...f, name: e.target.value }))} />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Tipe Paket</label>
                <select className="form-control" value={customForm.type} onChange={e => setCustomForm(f => ({ ...f, type: e.target.value }))}>
                  {Object.keys(TYPE_COLORS).map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Periode Plan</label>
                <select className="form-control" value={customForm.periode} onChange={e => setCustomForm(f => ({ ...f, periode: e.target.value }))}>
                  {PERIODE_OPTIONS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Pilih Item Menu</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 180, overflowY: 'auto', background: 'var(--bg)', borderRadius: 8, padding: '8px' }}>
                {products.map(p => (
                  <button key={p.id} onClick={() => addItemToCustom(p)}
                    style={{ padding: '5px 10px', borderRadius: 20, border: '1px solid var(--border)', background: selectedItems.find(i => i.id === p.id) ? '#1A2E0A' : '#fff', color: selectedItems.find(i => i.id === p.id) ? '#fff' : 'var(--text)', fontSize: 12, cursor: 'pointer' }}>
                    {p.name} ({formatRp(p.price)})
                  </button>
                ))}
              </div>
            </div>

            {selectedItems.length > 0 && (
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Item dipilih:</div>
                {selectedItems.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginBottom: 4 }}>
                    <span>{item.name} x{item.qty} = {formatRp(item.price * item.qty)}</span>
                    <button onClick={() => removeItemFromCustom(item.id)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 16 }}>✕</button>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>Harga Normal</span><span style={{ fontWeight: 600 }}>{formatRp(customForm.normalPrice)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4 }}>
                  <span>Diskon (10%)</span>
                  <input type="number" value={customForm.diskon} onChange={e => setCustomForm(f => ({ ...f, diskon: parseInt(e.target.value)||0, bundlePrice: f.normalPrice - (parseInt(e.target.value)||0) }))}
                    style={{ width: 90, padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 4, textAlign: 'right', fontSize: 12 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, marginTop: 6, color: '#16A34A' }}>
                  <span>Harga Bundle</span><span>{formatRp(customForm.bundlePrice)}</span>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Strategi / Deskripsi</label>
              <input className="form-control" placeholder="Cth: Cocok untuk order siang, dorong coba menu baru" value={customForm.strategy} onChange={e => setCustomForm(f => ({ ...f, strategy: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Catatan Internal</label>
              <textarea className="form-control" rows={2} placeholder="Catatan untuk tim..." value={customForm.notes} onChange={e => setCustomForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowCustomForm(false)}>Batal</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => saveBundle({ ...customForm, tag: '🎁' }, customForm.periode)} disabled={saving || !customForm.name || selectedItems.length === 0}>
                {saving ? '⏳ Menyimpan...' : '💾 Simpan Paket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
