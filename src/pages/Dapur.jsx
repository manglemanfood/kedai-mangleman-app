import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const formatNum = (n, unit) => {
  const num = parseFloat(n || 0)
  if (unit === 'kg' || unit === 'liter') return num.toFixed(2).replace(/\.?0+$/, '') || '0'
  return Math.ceil(num)
}

const today = () => new Date().toISOString().split('T')[0]

// Konversi satuan resep ke satuan beli
const convertUnit = (qty, fromUnit, toUnit) => {
  if (fromUnit === toUnit) return qty
  if (fromUnit === 'gram' && toUnit === 'kg') return qty / 1000
  if (fromUnit === 'kg' && toUnit === 'gram') return qty * 1000
  if (fromUnit === 'ml' && toUnit === 'liter') return qty / 1000
  if (fromUnit === 'liter' && toUnit === 'ml') return qty * 1000
  return qty
}

const FOOD_CATEGORIES = ['ricebowl', 'mie', 'dimsum', 'snack']

export default function Dapur() {
  const [orders, setOrders] = useState([])
  const [recipes, setRecipes] = useState([])
  const [materials, setMaterials] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(today())
  const [tab, setTab] = useState('kebutuhan')
  const [checklist, setChecklist] = useState({}) // bahan yang sudah disiapkan

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [ordersRes, recipesRes, matsRes, prodsRes] = await Promise.all([
      supabase.from('orders')
        .select('*, order_items(*)')
        .or(`delivery_date.eq.${date},and(delivery_date.is.null,created_at.gte.${date}T00:00:00+07:00,created_at.lte.${date}T23:59:59+07:00)`)
        .neq('status', 'Batal'),
      supabase.from('recipes').select('*'),
      supabase.from('raw_materials').select('*'),
      supabase.from('products').select('*'),
    ])
    setOrders(ordersRes.data || [])
    setRecipes(recipesRes.data || [])
    setMaterials(matsRes.data || [])
    setProducts(prodsRes.data || [])
    setLoading(false)
  }, [date])

  useEffect(() => { fetchData() }, [fetchData])

  // Realtime update saat ada order baru
  useEffect(() => {
    const ch = supabase.channel('dapur-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchData)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [fetchData])

  // ── KALKULASI UTAMA ──────────────────────────────────────
  // 1. Hitung qty per produk dari semua order hari ini
  const productQty = {}
  orders.forEach(order => {
    ;(order.order_items || []).forEach(item => {
      if (!item.product_id) return
      const prod = products.find(p => p.id === item.product_id)
      if (!prod) return
      // Hanya produk makanan
      if (!FOOD_CATEGORIES.includes(prod.category)) return
      productQty[item.product_id] = (productQty[item.product_id] || 0) + item.quantity
    })
  })

  // 2. Hitung kebutuhan bahan baku dari resep
  const bahanKebutuhan = {}
  Object.entries(productQty).forEach(([productId, qty]) => {
    const prodRecipes = recipes.filter(r => r.product_id === productId)
    prodRecipes.forEach(r => {
      const mat = materials.find(m => m.id === r.raw_material_id)
      if (!mat) return
      // Skip kemasan dan minuman
      const n = mat.name.toLowerCase()
      const isKemasan = ['bowl','sendok','kresek','stiker','plastik','box','cup','tissue'].some(k => n.includes(k))
      if (isKemasan) return

      const key = mat.id
      const totalQty = convertUnit(r.qty_used * qty, r.unit, mat.unit)

      if (!bahanKebutuhan[key]) {
        bahanKebutuhan[key] = {
          id: mat.id,
          name: mat.name,
          unit: mat.unit,
          stokAda: mat.stock_qty || 0,
          totalNeeded: 0,
          products: [],
        }
      }
      bahanKebutuhan[key].totalNeeded += totalQty
      bahanKebutuhan[key].products.push({
        name: products.find(p => p.id === productId)?.name || productId,
        qty,
        perPorsi: r.qty_used,
        unit: r.unit,
        total: totalQty,
      })
    })
  })

  const bahanList = Object.values(bahanKebutuhan).sort((a, b) => a.name.localeCompare(b.name))

  // 3. Rekap menu per produk
  const menuList = Object.entries(productQty).map(([productId, qty]) => {
    const prod = products.find(p => p.id === productId)
    return { id: productId, name: prod?.name || productId, category: prod?.category, qty }
  }).sort((a, b) => {
    const catOrder = ['ricebowl','mie','dimsum','snack']
    return catOrder.indexOf(a.category) - catOrder.indexOf(b.category)
  })

  // 4. Status per order (untuk tab pesanan)
  const totalOrders = orders.length
  const totalItems = Object.values(productQty).reduce((s, q) => s + q, 0)
  const totalMenuTypes = Object.keys(productQty).length

  const catIcon = { ricebowl:'🍚', mie:'🍜', dimsum:'🥟', snack:'🍿', minuman:'🥤' }
  const catLabel = { ricebowl:'Rice Bowl', mie:'Mie', dimsum:'Dimsum', snack:'Snack' }

  const selectedDate = new Date(date)
  const isToday = date === today()

  return (
    <div>
      {/* Header */}
      <div className="page-header flex-between" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>👨‍🍳 Dashboard Dapur</h1>
          <p>Kebutuhan bahan & rekap masakan harian</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="form-control" style={{ width: 'auto', fontWeight: 600 }} />
          {!isToday && (
            <button onClick={() => setDate(today())} className="btn btn-outline btn-sm">
              Hari Ini
            </button>
          )}
          <button onClick={fetchData} className="btn btn-outline btn-sm">🔄</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid-4 mb-2">
        {[
          { label: 'Total Order', value: totalOrders, icon: '📋', color: '#1A2E0A' },
          { label: 'Total Porsi', value: totalItems, icon: '🍽️', color: '#D97706' },
          { label: 'Jenis Menu', value: totalMenuTypes, icon: '📝', color: '#2563EB' },
          { label: 'Jenis Bahan', value: bahanList.length, icon: '🥩', color: '#16A34A' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: 24 }}>{s.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Realtime badge */}
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
        📅 Menampilkan pesanan dengan <strong>tanggal pengiriman {new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
        <span style={{ color: '#2563EB', marginLeft: 6 }}>(termasuk order tanpa tanggal kirim yang dibuat hari ini)</span>
      </div>

      {isToday && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 14px', background: '#E8F5E0', borderRadius: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', animation: 'pulse 2s infinite', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: '#2D5016', fontWeight: 600 }}>
            Update realtime — data berubah otomatis saat ada pesanan baru masuk
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'kebutuhan' ? 'active' : ''}`} onClick={() => setTab('kebutuhan')}>
          🥩 Kebutuhan Bahan ({bahanList.length})
        </button>
        <button className={`tab ${tab === 'menu' ? 'active' : ''}`} onClick={() => setTab('menu')}>
          🍽️ Rekap Menu ({menuList.length})
        </button>
        <button className={`tab ${tab === 'order' ? 'active' : ''}`} onClick={() => setTab('order')}>
          📋 Daftar Order ({totalOrders})
        </button>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><span>Memuat data dapur...</span></div>
      ) : (
        <>
          {/* ═══ TAB KEBUTUHAN BAHAN ═══ */}
          {tab === 'kebutuhan' && (
            <div>
              {bahanList.length === 0 ? (
                <div className="card empty-state">
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🍳</div>
                  <p style={{ fontWeight: 600 }}>Belum ada pesanan makanan hari ini</p>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
                    {totalOrders > 0 ? 'Pesanan ada tapi resep belum diisi di menu Resep' : 'Pesanan akan muncul di sini saat order masuk'}
                  </p>
                </div>
              ) : (
                <div>
                  <div className="alert alert-info mb-2" style={{ fontSize: 13 }}>
                    💡 Semua kebutuhan bahan dihitung dari <strong>resep</strong> × <strong>jumlah porsi dipesan</strong>. Pastikan resep sudah diisi lengkap.
                  </div>

                  {/* Print button */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                    <button onClick={() => window.print()} className="btn btn-outline btn-sm">
                      🖨️ Print Kebutuhan Bahan
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {bahanList.map(bahan => {
                      const isChecked = checklist[bahan.id]
                      const stokCukup = bahan.stokAda >= bahan.totalNeeded
                      const stokKurang = bahan.stokAda < bahan.totalNeeded
                      const kekurangan = Math.max(0, bahan.totalNeeded - bahan.stokAda)

                      return (
                        <div key={bahan.id} className="card"
                          style={{ borderLeft: `4px solid ${isChecked ? '#16A34A' : stokKurang ? '#DC2626' : '#E8A838'}`, opacity: isChecked ? 0.7 : 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>

                            {/* Nama + checklist */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <input type="checkbox" checked={!!isChecked}
                                onChange={() => setChecklist(c => ({ ...c, [bahan.id]: !c[bahan.id] }))}
                                style={{ width: 20, height: 20, cursor: 'pointer', accentColor: '#16A34A' }} />
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 16, textDecoration: isChecked ? 'line-through' : 'none', color: isChecked ? '#888' : 'var(--text)' }}>
                                  {bahan.name}
                                </div>
                                {isChecked && <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>✅ Sudah disiapkan</span>}
                              </div>
                            </div>

                            {/* Qty kebutuhan */}
                            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                              <div style={{ textAlign: 'center', background: '#1A2E0A', borderRadius: 10, padding: '8px 16px' }}>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>SIAPKAN</div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: '#E8A838' }}>
                                  {formatNum(bahan.totalNeeded, bahan.unit)}
                                </div>
                                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{bahan.unit}</div>
                              </div>

                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>STOK ADA</div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: stokCukup ? '#16A34A' : '#DC2626' }}>
                                  {formatNum(bahan.stokAda, bahan.unit)}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{bahan.unit}</div>
                              </div>

                              {stokKurang && (
                                <div style={{ textAlign: 'center', background: '#FEF2F2', borderRadius: 8, padding: '6px 12px' }}>
                                  <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 700, marginBottom: 2 }}>KURANG</div>
                                  <div style={{ fontSize: 16, fontWeight: 800, color: '#DC2626' }}>
                                    {formatNum(kekurangan, bahan.unit)}
                                  </div>
                                  <div style={{ fontSize: 11, color: '#DC2626' }}>{bahan.unit}</div>
                                </div>
                              )}
                              {stokCukup && (
                                <span style={{ fontSize: 12, color: '#16A34A', fontWeight: 700 }}>✅ Cukup</span>
                              )}
                            </div>
                          </div>

                          {/* Detail per produk */}
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {bahan.products.map((p, i) => (
                              <div key={i} style={{ background: 'var(--bg)', borderRadius: 8, padding: '5px 10px', fontSize: 12 }}>
                                <span style={{ fontWeight: 600 }}>{p.name}</span>
                                <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
                                  {p.qty} porsi × {p.perPorsi}{p.unit} = <strong>{formatNum(p.total, bahan.unit)} {bahan.unit}</strong>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Progress checklist */}
                  {bahanList.length > 0 && (
                    <div className="card" style={{ marginTop: 12, padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                        <span>Progress Persiapan Bahan</span>
                        <span>{Object.values(checklist).filter(Boolean).length}/{bahanList.length} bahan</span>
                      </div>
                      <div style={{ background: '#F0F0F0', borderRadius: 20, height: 12, overflow: 'hidden' }}>
                        <div style={{
                          width: `${bahanList.length > 0 ? (Object.values(checklist).filter(Boolean).length / bahanList.length) * 100 : 0}%`,
                          background: 'linear-gradient(90deg, #E8A838, #16A34A)',
                          height: '100%', borderRadius: 20, transition: 'width 0.5s'
                        }} />
                      </div>
                      {Object.values(checklist).filter(Boolean).length === bahanList.length && bahanList.length > 0 && (
                        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 16, fontWeight: 700, color: '#16A34A' }}>
                          🎉 Semua bahan sudah disiapkan! Siap masak!
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══ TAB REKAP MENU ═══ */}
          {tab === 'menu' && (
            <div>
              {menuList.length === 0 ? (
                <div className="card empty-state"><p>Belum ada pesanan makanan</p></div>
              ) : (
                <div>
                  {/* Group by category */}
                  {['ricebowl','mie','dimsum','snack'].map(cat => {
                    const items = menuList.filter(m => m.category === cat)
                    if (items.length === 0) return null
                    const totalCat = items.reduce((s, m) => s + m.qty, 0)
                    return (
                      <div key={cat} className="card mb-2">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <h3 style={{ fontWeight: 700, fontSize: 16 }}>
                            {catIcon[cat]} {catLabel[cat]}
                          </h3>
                          <div style={{ background: '#1A2E0A', color: '#E8A838', borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 700 }}>
                            Total: {totalCat} porsi
                          </div>
                        </div>

                        {items.map((m, i) => {
                          const pct = (m.qty / totalCat) * 100
                          return (
                            <div key={m.id} style={{ marginBottom: 10 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: i < 3 ? '#E8A838' : '#F0F0F0', color: i < 3 ? '#fff' : '#555', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                                    {i+1}
                                  </span>
                                  <span style={{ fontWeight: 500, fontSize: 14 }}>{m.name}</span>
                                </div>
                                <span style={{ fontWeight: 800, fontSize: 18, color: '#1A2E0A' }}>{m.qty} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>porsi</span></span>
                              </div>
                              <div style={{ background: '#F0F0F0', borderRadius: 20, height: 8, overflow: 'hidden' }}>
                                <div style={{ width: `${pct}%`, background: '#E8A838', height: '100%', borderRadius: 20 }} />
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, textAlign: 'right' }}>{pct.toFixed(0)}% dari {catLabel[cat]}</div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══ TAB DAFTAR ORDER ═══ */}
          {tab === 'order' && (
            <div>
              {orders.length === 0 ? (
                <div className="card empty-state"><p>Belum ada order hari ini</p></div>
              ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <table className="table">
                    <thead>
                      <tr><th>#</th><th>Customer</th><th>Lokasi</th><th>Pesanan Makanan</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {orders.map((order, i) => {
                        const foodItems = (order.order_items || []).filter(item => {
                          const prod = products.find(p => p.id === item.product_id)
                          return prod && FOOD_CATEGORIES.includes(prod.category)
                        })
                        if (foodItems.length === 0) return null
                        return (
                          <tr key={order.id}>
                            <td style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 12 }}>{i+1}</td>
                            <td style={{ fontWeight: 600 }}>{order.customer_name}</td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{order.gedung} Lt.{order.lantai}</td>
                            <td>
                              {foodItems.map((item, j) => (
                                <div key={j} style={{ fontSize: 13 }}>
                                  <span style={{ fontWeight: 600, color: '#E8A838' }}>×{item.quantity}</span> {item.product_name}
                                </div>
                              ))}
                            </td>
                            <td>
                              <span className={`badge ${order.status === 'Selesai' ? 'badge-success' : order.status === 'Batal' ? 'badge-danger' : 'badge-warning'}`}>
                                {order.status}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @media print {
          .tabs, button, .page-header { display: none !important; }
          .card { break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}
