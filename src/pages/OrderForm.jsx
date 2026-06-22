import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Format harga: tampilkan desimal hanya jika memang ada
const formatHarga = (n) => {
  const num = Number(n || 0)
  if (num % 1 === 0) return 'Rp ' + num.toLocaleString('id-ID')
  return 'Rp ' + num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

const ADMIN_WA = '6285353292224'

const categoryLabel = {
  ricebowl: '🍚 Rice Bowl',
  mie: '🍜 Mie',
  dimsum: '🥟 Dimsum',
  minuman: '🥤 Minuman',
  snack: '🍿 Snack',
}

// Kategori yang pakai dropdown (pilih varian)
const DROPDOWN_CATEGORIES = ['mie', 'dimsum']

function buildWAMessage(info, cartItems, cart, promoCart, freeItems, total, orderNum) {
  const regularItems = cartItems.map(p =>
    `  • ${p.name} x${cart[p.id]} = ${formatHarga(p.price * cart[p.id])}`
  )
  const promoItems = promoCart.map(pc =>
    `  • 🎁 ${pc.promo.name} x${pc.qty} = ${formatHarga(pc.promo.bundle_price * pc.qty)} (hemat ${formatHarga(pc.promo.diskon * pc.qty)})`
  )
  const freeItemLines = freeItems.map(fi =>
    `  • 🆓 ${fi.product.name} x${fi.qty} = GRATIS! (nilai ${formatHarga(fi.originalPrice * fi.qty)})`
  )
  const items = [...promoItems, ...regularItems, ...freeItemLines].join('\n')
  return encodeURIComponent(
`🍱 *ORDER BARU - Kedai MangLeman*
━━━━━━━━━━━━━━━━━━
📋 *No. Order:* ${orderNum}
👤 *Nama:* ${info.name}
🏢 *Gedung:* ${info.gedung}
🔢 *Lantai:* ${info.lantai}
${info.phone ? `📱 *HP:* ${info.phone}` : ''}
${info.catatan ? `📝 *Catatan:* ${info.catatan}` : ''}

🛒 *Pesanan:*
${items}

━━━━━━━━━━━━━━━━━━
💰 *TOTAL: ${formatHarga(total)}*
━━━━━━━━━━━━━━━━━━
Mohon konfirmasi pesanan saya ya kak 🙏`)
}

export default function OrderForm() {
  const [step, setStep] = useState(1)
  const [products, setProducts] = useState([])
  const [promos, setPromos] = useState([])
  const [cart, setCart] = useState({})
  const [promoCart, setPromoCart] = useState([]) // [{promo, qty}]
  const [freeItems, setFreeItems] = useState([]) // free items dari promo qty
  const [showFreeModal, setShowFreeModal] = useState(false)
  const [pendingFreeRule, setPendingFreeRule] = useState(null)

  // Aturan free item berdasarkan qty ricebowl
  const FREE_RULES = [
    {
      id: 'free5',
      minQty: 5,
      category: 'ricebowl',
      label: '🎁 Beli 5 Ricebowl → Free 1 Juice!',
      freeCategory: 'minuman',
      freeChoices: null, // null = semua minuman bisa dipilih
      maxFreeQty: 1,
      description: 'Pilih 1 juice gratis (Guava atau Mango)',
    },
    {
      id: 'free10',
      minQty: 10,
      category: 'ricebowl',
      label: '🎁🎁 Beli 10 Ricebowl → Free 2 Juice Strawberry!',
      freeCategory: 'minuman',
      freeChoices: ['JUICE Strawberry'], // spesifik produk
      maxFreeQty: 2,
      description: 'Dapat 2 Juice Strawberry gratis!',
    },
  ]
  const [info, setInfo] = useState({ name: '', gedung: '', lantai: '', phone: '', catatan: '' })
  const [loading, setLoading] = useState(false)
  const [orderNum, setOrderNum] = useState('')
  const [error, setError] = useState('')
  const [waUrl, setWaUrl] = useState('')

  useEffect(() => {
    // Load products + recipes + raw materials untuk cek stok
    // Load products dulu - tampilkan semua yang is_available
    supabase.from('products').select('*').eq('is_available', true).order('category')
      .then(({ data: prods }) => {
        if (!prods) return
        // Set products dulu agar langsung tampil
        setProducts(prods.map(p => ({ ...p, stockReady: true })))

        // Lalu cek stok di background (tidak blokir tampilan)
        Promise.all([
          supabase.from('recipes').select('*, raw_materials(id, name, stock_qty, unit)'),
          supabase.from('raw_materials').select('id, name, stock_qty, unit'),
        ]).then(([recipeRes, matRes]) => {
          const recipes = recipeRes.data || []
          const allMaterials = matRes.data || []

          // Kalau tidak ada resep sama sekali, semua produk tetap tampil
          if (recipes.length === 0) return

          const isKemasan = (name) => ['bowl','sendok','kresek','stiker','label','plastik','kertas','box','cup','tissue'].some(k => (name||'').toLowerCase().includes(k))
          const isBumbu = (name) => ['bawang','lada','garam','gula','kecap','saos','saus','minyak','totole','kaldu','merica','cabe','cabai'].some(k => (name||'').toLowerCase().includes(k))

          const prodsWithStock = prods.map(p => {
            const prodRecipes = recipes.filter(r => r.product_id === p.id)

            // Tidak ada resep = selalu tampil
            if (prodRecipes.length === 0) return { ...p, stockReady: true }

            // Cek bahan UTAMA saja
            const utamaRecipes = prodRecipes.filter(r => {
              const matName = r.raw_materials?.name || r.material_name || ''
              return matName && !isKemasan(matName) && !isBumbu(matName)
            })

            // Tidak ada bahan utama di resep = selalu tampil
            if (utamaRecipes.length === 0) return { ...p, stockReady: true }

            // Cek stok masing-masing bahan utama
            const stockReady = utamaRecipes.every(r => {
              // Coba dari join, fallback ke allMaterials
              let mat = r.raw_materials
              if (!mat && r.raw_material_id) {
                mat = allMaterials.find(m => m.id === r.raw_material_id)
              }

              // Kalau bahan tidak ditemukan di stok = anggap tersedia
              // (bahan mungkin belum diinput stoknya)
              if (!mat) return true

              // Konversi satuan
              let qtyNeeded = parseFloat(r.qty_used) || 0
              if (r.unit === 'gram' && mat.unit === 'kg') qtyNeeded = qtyNeeded / 1000
              else if (r.unit === 'kg' && mat.unit === 'gram') qtyNeeded = qtyNeeded * 1000
              else if (r.unit === 'ml' && mat.unit === 'liter') qtyNeeded = qtyNeeded / 1000

              return (parseFloat(mat.stock_qty) || 0) >= qtyNeeded
            })

            const habis = utamaRecipes
              .filter(r => {
                const mat = r.raw_materials || allMaterials.find(m => m.id === r.raw_material_id)
                if (!mat) return false
                let qtyNeeded = parseFloat(r.qty_used) || 0
                if (r.unit === 'gram' && mat.unit === 'kg') qtyNeeded = qtyNeeded / 1000
                return (parseFloat(mat.stock_qty) || 0) < qtyNeeded
              })
              .map(r => r.raw_materials?.name || r.material_name)
              .filter(Boolean)

            return { ...p, stockReady, bahanHabis: habis }
          })

          setProducts(prodsWithStock)
        }).catch(() => {
          // Kalau query stok gagal, biarkan semua produk tampil
          setProducts(prods.map(p => ({ ...p, stockReady: true })))
        })
      })
    // Load promo bundling aktif hari ini
    supabase.from('bundling_packages').select('*').eq('is_active', true).in('periode', ['harian']).then(({ data }) => {
      if (data) {
        const today = new Date().toISOString().split('T')[0]
        const active = data.filter(b => {
          if (b.start_date && b.start_date > today) return false
          if (b.end_date && b.end_date < today) return false
          return true
        })
        setPromos(active)
      }
    })
  }, [])

  // Hanya tampilkan produk yang stoknya ready
  const availableProducts = products.filter(p => p.stockReady !== false)

  // Group by category
  const grouped = availableProducts.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = []
    acc[p.category].push(p)
    return acc
  }, {})

  const addItem = (id) => setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }))
  const removeItem = (id) => setCart(c => {
    const next = { ...c }
    if (next[id] > 1) next[id]--
    else delete next[id]
    return next
  })

  // Hitung qty ricebowl di cart
  const ricebowlQty = availableProducts
    .filter(p => p.category === 'ricebowl')
    .reduce((s, p) => s + (cart[p.id] || 0), 0)

  // Cek aturan free item yang berlaku
  const activeRules = FREE_RULES.filter(r => ricebowlQty >= r.minQty)

  const cartItems = availableProducts.filter(p => cart[p.id])
  const regularTotal = cartItems.reduce((sum, p) => sum + p.price * (cart[p.id] || 0), 0)
  // Nilai free items (untuk laporan HPP promo)
  const freeItemsValue = freeItems.reduce((s, fi) => s + (fi.product?.price || 0) * fi.qty, 0)
  const promoTotal = promoCart.reduce((sum, pc) => sum + pc.promo.bundle_price * pc.qty, 0)
  const total = regularTotal + promoTotal
  const totalQty = Object.values(cart).reduce((a, b) => a + b, 0) + promoCart.reduce((s, pc) => s + pc.qty, 0)

  const addPromoToCart = (promo) => {
    setPromoCart(prev => {
      const ex = prev.find(p => p.promo.id === promo.id)
      if (ex) return prev.map(p => p.promo.id === promo.id ? { ...p, qty: p.qty + 1 } : p)
      return [...prev, { promo, qty: 1 }]
    })
  }

  const removePromoFromCart = (promoId) => {
    setPromoCart(prev => {
      const ex = prev.find(p => p.promo.id === promoId)
      if (!ex) return prev
      if (ex.qty <= 1) return prev.filter(p => p.promo.id !== promoId)
      return prev.map(p => p.promo.id === promoId ? { ...p, qty: p.qty - 1 } : p)
    })
  }

  const submitOrder = async () => {
    setLoading(true)
    setError('')
    try {
      let customerId = null
      if (info.phone) {
        const { data: existing } = await supabase.from('customers').select('id').eq('phone', info.phone).maybeSingle()
        if (existing) {
          customerId = existing.id
        } else {
          const { data: newCust } = await supabase.from('customers').insert({
            name: info.name, phone: info.phone, gedung: info.gedung, lantai: info.lantai, segment: 'Baru'
          }).select().single()
          if (newCust) customerId = newCust.id
        }
      }

      const { data: order, error: orderErr } = await supabase.from('orders').insert({
        customer_id: customerId,
        customer_name: info.name,
        gedung: info.gedung,
        lantai: info.lantai,
        phone: info.phone,
        catatan: info.catatan,
        total_amount: total,
        status: 'Baru',
      }).select().single()

      if (orderErr) throw orderErr

      // Regular items
      const regularOrderItems = cartItems.map(p => ({
        order_id: order.id,
        product_id: p.id,
        product_name: p.name,
        quantity: cart[p.id],
        price: p.price,
        subtotal: p.price * cart[p.id],
      }))
      // Promo bundle items
      const promoOrderItems = promoCart.map(pc => ({
        order_id: order.id,
        product_id: null,
        product_name: `🎁 ${pc.promo.name}`,
        quantity: pc.qty,
        price: pc.promo.bundle_price,
        subtotal: pc.promo.bundle_price * pc.qty,
      }))
      // Free items (harga 0, tapi catat nilai aslinya di notes)
      const freeOrderItems = freeItems.map(fi => ({
        order_id: order.id,
        product_id: fi.product.id,
        product_name: `🆓 ${fi.product.name} (FREE)`,
        quantity: fi.qty,
        price: 0,
        subtotal: 0,
        notes: `Promo free item, nilai: ${fi.originalPrice * fi.qty}`,
      }))
      const allItems = [...regularOrderItems, ...promoOrderItems, ...freeOrderItems]
      if (allItems.length > 0) await supabase.from('order_items').insert(allItems)

      if (customerId) {
        const { data: cust } = await supabase.from('customers').select('total_orders,total_spent').eq('id', customerId).single()
        const newTotal = (cust?.total_orders || 0) + 1
        const newSpent = (cust?.total_spent || 0) + total
        let segment = 'Baru'
        if (newTotal >= 20 || newSpent >= 500000) segment = 'VIP'
        else if (newTotal >= 10 || newSpent >= 200000) segment = 'Loyal'
        else if (newTotal >= 3) segment = 'Regular'
        await supabase.from('customers').update({
          total_orders: newTotal, total_spent: newSpent, segment,
          last_order_at: new Date().toISOString(), gedung: info.gedung, lantai: info.lantai
        }).eq('id', customerId)
      }

      const num = order.order_number || order.id.slice(0, 8).toUpperCase()
      setOrderNum(num)
      setWaUrl(`https://wa.me/${ADMIN_WA}?text=${buildWAMessage(info, cartItems, cart, promoCart, freeItems, total, num)}`)
      setStep(4)
    } catch (e) {
      setError('Gagal mengirim pesanan. Coba lagi ya!')
      console.error(e)
    }
    setLoading(false)
  }

  // Handle free item selection
  const handleAddFreeItem = (product, rule) => {
    const FREE_ITEM_VALUE = 7000 // nilai juice ukuran kecil
    const existing = freeItems.find(fi => fi.ruleId === rule.id)
    if (existing) {
      setFreeItems(prev => prev.map(fi => fi.ruleId === rule.id
        ? { ...fi, product, qty: rule.maxFreeQty }
        : fi
      ))
    } else {
      setFreeItems(prev => [...prev, {
        ruleId: rule.id,
        product,
        qty: rule.maxFreeQty,
        price: 0, // FREE
        originalPrice: FREE_ITEM_VALUE, // nilai beban promo = 7000
      }])
    }
    setShowFreeModal(false)
    setPendingFreeRule(null)
  }

  // ── STEP 4: Sukses ───────────────────────────────
  if (step === 4) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1A2E0A 0%, #2D5016 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '2rem', textAlign: 'center', maxWidth: 400, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize: 60, marginBottom: 12 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Pesanan Masuk!</h2>
        <p style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>Terima kasih <strong>{info.name}</strong>!</p>
        <div style={{ background: '#F7F5F0', borderRadius: 12, padding: '12px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Nomor Order</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#E8A838', letterSpacing: 2 }}>{orderNum}</div>
        </div>
        <div style={{ background: '#E8F5E0', borderRadius: 10, padding: '10px', marginBottom: 16, fontSize: 13, color: '#2D5016' }}>
          📍 Dikirim ke <strong>{info.gedung}</strong>, Lantai <strong>{info.lantai}</strong>
        </div>
        <div style={{ background: '#F7F5F0', borderRadius: 10, padding: '12px', marginBottom: 20, textAlign: 'left' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 8, textTransform: 'uppercase' }}>Ringkasan</div>
          {promoCart.map((pc, i) => (
            <div key={`promo-${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span>🎁 {pc.promo.name} x{pc.qty}</span>
              <span style={{ fontWeight: 600, color: '#16A34A' }}>{formatHarga(pc.promo.bundle_price * pc.qty)}</span>
            </div>
          ))}
          {freeItems.map((fi, i) => (
            <div key={`free-${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span>🆓 {fi.product.name} x{fi.qty}</span>
              <span style={{ fontWeight: 600, color: '#16A34A' }}>GRATIS!</span>
            </div>
          ))}
          {cartItems.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span>{p.name} x{cart[p.id]}</span>
              <span style={{ fontWeight: 600 }}>{formatHarga(p.price * cart[p.id])}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #E5E0D8', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, color: '#E8A838' }}>
            <span>Total</span><span>{formatHarga(total)}</span>
          </div>
        </div>
        <a href={waUrl} target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', padding: '14px', background: '#25D366', color: '#fff', borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: 'none', marginBottom: 10, boxShadow: '0 4px 15px rgba(37,211,102,0.4)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Konfirmasi via WhatsApp
        </a>
        <button onClick={() => { setStep(1); setCart({}); setPromoCart([]); setFreeItems([]); setInfo({ name: '', gedung: '', lantai: '', phone: '', catatan: '' }); setOrderNum(''); setWaUrl('') }}
          style={{ width: '100%', padding: '10px', background: '#F0EDE8', color: '#666', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
          Pesan Lagi
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1A2E0A 0%, #2D5016 100%)' }}>
      {/* Header */}
      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 4 }}>🍱</div>
        <div style={{ color: '#E8A838', fontWeight: 700, fontSize: 20 }}>Kedai MangLeman</div>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Pesan sekarang, diantar langsung!</div>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '1rem 0' }}>
        {['Info Diri', 'Pilih Menu', 'Konfirmasi'].map((label, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: step > i+1 ? '#E8A838' : step === i+1 ? '#fff' : 'rgba(255,255,255,0.2)', color: step === i+1 ? '#1A2E0A' : step > i+1 ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700 }}>
              {step > i+1 ? '✓' : i+1}
            </div>
            <span style={{ fontSize: 11, color: step === i+1 ? '#fff' : 'rgba(255,255,255,0.5)' }}>{label}</span>
            {i < 2 && <div style={{ width: 20, height: 1, background: 'rgba(255,255,255,0.2)', marginLeft: 4 }} />}
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 1rem 2rem' }}>

        {/* STEP 1: Info diri */}
        {step === 1 && (
          <div style={{ background: '#fff', borderRadius: 20, padding: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginBottom: 20, fontWeight: 700, fontSize: 16 }}>📝 Info Pemesanan</h3>
            {[
              { key: 'name', label: 'Nama Lengkap *', placeholder: 'Contoh: Budi Santoso', type: 'text' },
              { key: 'gedung', label: 'Nama Gedung *', placeholder: 'Contoh: Gedung A / Tower 1', type: 'text' },
              { key: 'lantai', label: 'Lantai *', placeholder: 'Contoh: 5', type: 'text' },
              { key: 'phone', label: 'No. HP (untuk konfirmasi WA)', placeholder: '08xxxxxxxxxx', type: 'tel' },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>{field.label}</label>
                <input type={field.type} placeholder={field.placeholder} value={info[field.key]}
                  onChange={e => setInfo(i => ({ ...i, [field.key]: e.target.value }))}
                  style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #E5E0D8', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = '#E8A838'}
                  onBlur={e => e.target.style.borderColor = '#E5E0D8'} />
              </div>
            ))}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Catatan (opsional)</label>
              <textarea placeholder="Contoh: Tidak pakai sambal, tambah nasi" value={info.catatan}
                onChange={e => setInfo(i => ({ ...i, catatan: e.target.value }))} rows={2}
                style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #E5E0D8', borderRadius: 10, fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
            </div>
            <button onClick={() => { if (!info.name || !info.gedung || !info.lantai) { alert('Nama, Gedung, dan Lantai wajib diisi!'); return } setStep(2) }}
              style={{ width: '100%', padding: 14, background: '#E8A838', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
              Pilih Menu →
            </button>
          </div>
        )}

        {/* STEP 2: Menu */}
        {step === 2 && (
          <div>
            {/* Info stok habis */}
            {products.filter(p => p.stockReady === false).length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px', marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
                  <strong style={{ color: '#fff' }}>{products.filter(p => p.stockReady === false).length} menu</strong> tidak tersedia hari ini karena stok bahan habis.
                </div>
              </div>
            )}

            {/* PROMO BANNER - paling atas */}
            {promos.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>🔥</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>Promo Hari Ini!</span>
                </div>
                {promos.map(promo => {
                  const items = typeof promo.items === 'string' ? JSON.parse(promo.items) : promo.items || []
                  const pctDiskon = promo.normal_price > 0 ? Math.round((promo.diskon / promo.normal_price) * 100) : 0
                  return (
                    <div key={promo.id} style={{ background: 'linear-gradient(135deg, #E8A838 0%, #C8881A 100%)', borderRadius: 16, padding: '14px 16px', marginBottom: 10, position: 'relative', overflow: 'hidden', boxShadow: '0 4px 20px rgba(232,168,56,0.4)' }}>
                      <div style={{ position: 'absolute', top: 0, right: 0, background: '#DC2626', color: '#fff', fontSize: 12, fontWeight: 800, padding: '4px 12px', borderRadius: '0 16px 0 10px' }}>
                        -{pctDiskon}%
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: 600, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {promo.tag || '🎁'} Paket Hemat
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: '#fff', marginBottom: 6 }}>{promo.name}</div>
                      {items.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          {items.map((item, i) => (
                            <div key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)' }}>
                              • {item.qty > 1 ? `${item.qty}x ` : ''}{item.name}
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', textDecoration: 'line-through' }}>
                            Rp {Number(promo.normal_price).toLocaleString('id-ID')}
                          </div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>
                            Rp {Number(promo.bundle_price).toLocaleString('id-ID')}
                          </div>
                        </div>
                        <button onClick={() => addPromoToCart(promo)}
                          style={{ background: '#fff', color: '#C8881A', border: 'none', borderRadius: 10, padding: '10px 16px', fontWeight: 800, fontSize: 13, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                          + Pilih Paket
                        </button>
                      </div>
                      {promo.strategy && (
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 6, fontStyle: 'italic' }}>💡 {promo.strategy}</div>
                      )}
                    </div>
                  )
                })}
                <div style={{ height: 1, background: 'rgba(255,255,255,0.15)', marginBottom: 14 }} />
              </div>
            )}

            {/* FREE ITEM NOTIFICATION */}
            {activeRules.map(rule => {
              const alreadyChosen = freeItems.find(fi => fi.ruleId === rule.id)
              return (
                <div key={rule.id} style={{
                  background: alreadyChosen ? '#E8F5E0' : 'linear-gradient(135deg, #16A34A, #15803D)',
                  borderRadius: 14, padding: '12px 16px', marginBottom: 10,
                  border: alreadyChosen ? '2px solid #16A34A' : 'none',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  boxShadow: '0 4px 15px rgba(22,163,74,0.3)'
                }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: alreadyChosen ? '#16A34A' : '#fff' }}>
                      {rule.label}
                    </div>
                    <div style={{ fontSize: 12, color: alreadyChosen ? '#2D5016' : 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                      {alreadyChosen
                        ? `✅ ${alreadyChosen.product.name} x${alreadyChosen.qty} sudah dipilih`
                        : rule.description}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (rule.freeChoices) {
                        // Langsung tambah produk spesifik
                        const prod = availableProducts.find(p =>
                          rule.freeChoices.some(fc => p.name.toLowerCase().includes(fc.toLowerCase()))
                        )
                        if (prod) handleAddFreeItem(prod, rule)
                      } else {
                        // Buka modal pilih
                        setPendingFreeRule(rule)
                        setShowFreeModal(true)
                      }
                    }}
                    style={{
                      background: '#fff', color: '#16A34A', border: 'none',
                      borderRadius: 10, padding: '8px 14px',
                      fontWeight: 800, fontSize: 13, cursor: 'pointer',
                      whiteSpace: 'nowrap', marginLeft: 10
                    }}>
                    {alreadyChosen ? '✏️ Ganti' : '🎁 Pilih'}
                  </button>
                </div>
              )
            })}

            {/* Modal pilih free item */}
            {showFreeModal && pendingFreeRule && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '1.5rem', width: '100%', maxWidth: 480, maxHeight: '70vh', overflowY: 'auto' }}>
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 32 }}>🎁</div>
                    <div style={{ fontWeight: 800, fontSize: 17 }}>Pilih Juice Gratis!</div>
                    <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{pendingFreeRule.description}</div>
                  </div>
                  {availableProducts
                    .filter(p => p.category === pendingFreeRule.freeCategory)
                    .map(p => (
                      <button key={p.id} onClick={() => handleAddFreeItem(p, pendingFreeRule)}
                        style={{ width: '100%', padding: '14px 16px', marginBottom: 8, background: '#F8F8F8', border: '2px solid #E5E5E5', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                          <div style={{ fontSize: 12, color: '#888' }}>Nilai: {formatHarga(p.price)}</div>
                        </div>
                        <div style={{ background: '#16A34A', color: '#fff', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 700 }}>
                          GRATIS ✓
                        </div>
                      </button>
                    ))
                  }
                  <button onClick={() => { setShowFreeModal(false); setPendingFreeRule(null) }}
                    style={{ width: '100%', padding: 12, background: '#F0F0F0', border: 'none', borderRadius: 10, fontWeight: 600, color: '#666', cursor: 'pointer', marginTop: 4 }}>
                    Lewati
                  </button>
                </div>
              </div>
            )}

            {/* Promo yang sudah dipilih */}
            {promoCart.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#16A34A', marginBottom: 8 }}>✅ Paket Dipilih:</div>
                {promoCart.map((pc, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>🎁 {pc.promo.name}</div>
                      <div style={{ fontSize: 12, color: '#16A34A' }}>{formatHarga(pc.promo.bundle_price)} <span style={{ color: '#DC2626', fontSize: 11 }}>hemat {formatHarga(pc.promo.diskon)}</span></div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={() => removePromoFromCart(pc.promo.id)} style={{ width: 26, height: 26, borderRadius: '50%', border: '2px solid #E8A838', background: '#fff', color: '#E8A838', fontWeight: 700, cursor: 'pointer' }}>−</button>
                      <span style={{ fontWeight: 700 }}>{pc.qty}</span>
                      <button onClick={() => addPromoToCart(pc.promo)} style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', background: '#E8A838', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Menu list */}
            {Object.entries(grouped).map(([cat, items]) => {
              const isDropdown = DROPDOWN_CATEGORIES.includes(cat)
              return (
                <div key={cat} style={{ background: '#fff', borderRadius: 16, padding: '1.25rem', marginBottom: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: '#2D5016', marginBottom: 12 }}>
                    {categoryLabel[cat] || cat}
                  </h4>

                  {isDropdown ? (
                    /* Dropdown untuk Mie & Dimsum */
                    <div>
                      <select
                        defaultValue=""
                        onChange={e => {
                          if (e.target.value) addItem(e.target.value)
                          e.target.value = ''
                        }}
                        style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #E5E0D8', borderRadius: 10, fontSize: 14, background: '#fff', cursor: 'pointer', marginBottom: 10 }}>
                        <option value="" disabled>Pilih {categoryLabel[cat]}...</option>
                        {items.map(p => (
                          <option key={p.id} value={p.id}>{p.name} — {formatHarga(p.price)}</option>
                        ))}
                      </select>
                      {/* Tampilkan yang sudah dipilih */}
                      {items.filter(p => cart[p.id]).map(p => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #F0EDE8' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                            <div style={{ fontSize: 12, color: '#E8A838', fontWeight: 600 }}>{formatHarga(p.price)}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button onClick={() => removeItem(p.id)} style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #E8A838', background: '#fff', color: '#E8A838', fontWeight: 700, cursor: 'pointer', fontSize: 16 }}>−</button>
                            <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 700 }}>{cart[p.id]}</span>
                            <button onClick={() => addItem(p.id)} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#E8A838', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 16 }}>+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Normal list untuk kategori lain */
                    items.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F0EDE8' }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</div>
                          <div style={{ fontSize: 13, color: '#E8A838', fontWeight: 600 }}>{formatHarga(p.price)}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {cart[p.id] ? (
                            <>
                              <button onClick={() => removeItem(p.id)} style={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid #E8A838', background: '#fff', color: '#E8A838', fontWeight: 700, cursor: 'pointer', fontSize: 16 }}>−</button>
                              <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 700 }}>{cart[p.id]}</span>
                              <button onClick={() => addItem(p.id)} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: '#E8A838', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 16 }}>+</button>
                            </>
                          ) : (
                            <button onClick={() => addItem(p.id)} style={{ padding: '6px 16px', background: '#E8A838', color: '#fff', border: 'none', borderRadius: 20, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>+ Tambah</button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )
            })}

            {/* Cart sticky footer */}
            {totalQty > 0 && (
              <div style={{ position: 'sticky', bottom: 16, background: '#1A2E0A', borderRadius: 16, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{totalQty} item</div>
                  <div style={{ color: '#E8A838', fontWeight: 700, fontSize: 16 }}>{formatHarga(total)}</div>
                </div>
                <button onClick={() => setStep(3)} style={{ padding: '10px 20px', background: '#E8A838', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                  Lanjut →
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Konfirmasi */}
        {step === 3 && (
          <div style={{ background: '#fff', borderRadius: 20, padding: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginBottom: 16, fontWeight: 700, fontSize: 16 }}>✅ Konfirmasi Pesanan</h3>
            <div style={{ background: '#F7F5F0', borderRadius: 10, padding: '12px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 6, fontWeight: 600 }}>DIKIRIM KE</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{info.name}</div>
              <div style={{ fontSize: 13, color: '#666' }}>{info.gedung} · Lantai {info.lantai}</div>
              {info.phone && <div style={{ fontSize: 13, color: '#666' }}>📱 {info.phone}</div>}
              {info.catatan && <div style={{ fontSize: 13, color: '#888', marginTop: 4, fontStyle: 'italic' }}>"{info.catatan}"</div>}
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 8, fontWeight: 600 }}>PESANAN</div>
              {promoCart.map((pc, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F0EDE8', fontSize: 14 }}>
                  <span>🎁 {pc.promo.name} <span style={{ color: '#888' }}>x{pc.qty}</span>
                    <span style={{ display: 'block', fontSize: 11, color: '#DC2626' }}>hemat {formatHarga(pc.promo.diskon * pc.qty)}</span>
                  </span>
                  <span style={{ fontWeight: 600, color: '#16A34A' }}>{formatHarga(pc.promo.bundle_price * pc.qty)}</span>
                </div>
              ))}
              {freeItems.map((fi, i) => (
                <div key={`free-${i}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F0EDE8', fontSize: 14 }}>
                  <span>🆓 {fi.product.name} <span style={{ color: '#888' }}>x{fi.qty}</span>
                    <span style={{ display: 'block', fontSize: 11, color: '#16A34A' }}>GRATIS! (nilai {formatHarga(fi.originalPrice * fi.qty)})</span>
                  </span>
                  <span style={{ fontWeight: 600, color: '#16A34A' }}>Rp 0</span>
                </div>
              ))}
              {cartItems.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F0EDE8', fontSize: 14 }}>
                  <span>{p.name} <span style={{ color: '#888' }}>x{cart[p.id]}</span></span>
                  <span style={{ fontWeight: 600 }}>{formatHarga(p.price * cart[p.id])}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', fontWeight: 700, fontSize: 16, color: '#E8A838' }}>
                <span>Total</span><span>{formatHarga(total)}</span>
              </div>
            </div>
            <div style={{ background: '#E8F5E0', borderRadius: 10, padding: '10px 12px', marginBottom: 16, fontSize: 13, color: '#2D5016', display: 'flex', gap: 8 }}>
              <span style={{ fontSize: 18 }}>💬</span>
              <span>Setelah pesan, kamu akan diarahkan konfirmasi via <strong>WhatsApp</strong>.</span>
            </div>
            {error && <div style={{ background: '#FFE8E8', color: '#C0392B', padding: '10px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(2)} style={{ flex: 1, padding: 12, background: '#F0EDE8', color: '#666', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer' }}>← Edit</button>
              <button onClick={submitOrder} disabled={loading} style={{ flex: 2, padding: 12, background: '#2D5016', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>
                {loading ? '⏳ Mengirim...' : '🛵 Pesan Sekarang!'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
