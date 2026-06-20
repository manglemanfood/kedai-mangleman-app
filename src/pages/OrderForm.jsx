import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const formatRp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID')

const categoryLabel = {
  ricebowl: '🍚 Rice Bowl',
  mie: '🍜 Mie',
  dimsum: '🥟 Dimsum',
  minuman: '🥤 Minuman',
  snack: '🍿 Snack',
}

export default function OrderForm() {
  const [step, setStep] = useState(1) // 1=info, 2=menu, 3=konfirmasi, 4=sukses
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState({})
  const [info, setInfo] = useState({ name: '', gedung: '', lantai: '', phone: '', catatan: '' })
  const [loading, setLoading] = useState(false)
  const [orderNum, setOrderNum] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('products').select('*').eq('is_available', true).order('category').then(({ data }) => {
      if (data) setProducts(data)
    })
  }, [])

  const grouped = products.reduce((acc, p) => {
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

  const cartItems = products.filter(p => cart[p.id])
  const total = cartItems.reduce((sum, p) => sum + p.price * (cart[p.id] || 0), 0)
  const totalQty = Object.values(cart).reduce((a, b) => a + b, 0)

  const submitOrder = async () => {
    setLoading(true)
    setError('')
    try {
      // Check/create customer
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

      // Insert order
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

      // Insert order items
      const items = cartItems.map(p => ({
        order_id: order.id,
        product_id: p.id,
        product_name: p.name,
        quantity: cart[p.id],
        price: p.price,
        subtotal: p.price * cart[p.id],
      }))
      await supabase.from('order_items').insert(items)

      // Update customer stats
      if (customerId) {
        const { data: cust } = await supabase.from('customers').select('total_orders,total_spent').eq('id', customerId).single()
        const newTotal = (cust?.total_orders || 0) + 1
        const newSpent = (cust?.total_spent || 0) + total
        let segment = 'Baru'
        if (newTotal >= 20 || newSpent >= 500000) segment = 'VIP'
        else if (newTotal >= 10 || newSpent >= 200000) segment = 'Loyal'
        else if (newTotal >= 3) segment = 'Regular'
        await supabase.from('customers').update({
          total_orders: newTotal, total_spent: newSpent, segment, last_order_at: new Date().toISOString(), gedung: info.gedung, lantai: info.lantai
        }).eq('id', customerId)
      }

      setOrderNum(order.order_number || order.id.slice(0, 8).toUpperCase())
      setStep(4)
    } catch (e) {
      setError('Gagal mengirim pesanan. Coba lagi ya!')
      console.error(e)
    }
    setLoading(false)
  }

  if (step === 4) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1A2E0A 0%, #2D5016 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '2.5rem', textAlign: 'center', maxWidth: 400, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#1A1A1A' }}>Pesanan Terkirim!</h2>
        <p style={{ color: '#666', marginBottom: 20, fontSize: 14 }}>Terima kasih {info.name}! Pesananmu sedang diproses.</p>
        <div style={{ background: '#F7F5F0', borderRadius: 12, padding: '1rem', marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Nomor Order</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#E8A838', letterSpacing: 2 }}>{orderNum}</div>
        </div>
        <div style={{ background: '#E8F5E0', borderRadius: 10, padding: '12px', marginBottom: 20, fontSize: 13, color: '#2D5016' }}>
          📍 Akan diantar ke <strong>{info.gedung}</strong>, Lantai <strong>{info.lantai}</strong>
        </div>
        <p style={{ fontSize: 12, color: '#aaa' }}>Simpan nomor order di atas untuk tracking pesananmu</p>
        <button
          onClick={() => { setStep(1); setCart({}); setInfo({ name: '', gedung: '', lantai: '', phone: '', catatan: '' }) }}
          style={{ marginTop: 20, padding: '10px 24px', background: '#E8A838', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
        >
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
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: step > i + 1 ? '#E8A838' : step === i + 1 ? '#fff' : 'rgba(255,255,255,0.2)',
              color: step === i + 1 ? '#1A2E0A' : step > i + 1 ? '#fff' : 'rgba(255,255,255,0.5)',
              fontSize: 12, fontWeight: 700,
            }}>{step > i + 1 ? '✓' : i + 1}</div>
            <span style={{ fontSize: 11, color: step === i + 1 ? '#fff' : 'rgba(255,255,255,0.5)', display: window.innerWidth < 400 ? 'none' : 'block' }}>{label}</span>
            {i < 2 && <div style={{ width: 20, height: 1, background: 'rgba(255,255,255,0.2)', marginLeft: 4 }} />}
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 1rem 2rem' }}>

        {/* STEP 1: Info diri */}
        {step === 1 && (
          <div style={{ background: '#fff', borderRadius: 20, padding: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginBottom: 20, fontWeight: 700, fontSize: 16 }}>📝 Info Pemesanan</h3>
            {['name', 'gedung', 'lantai', 'phone'].map(field => (
              <div key={field} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {field === 'name' ? 'Nama Lengkap *' : field === 'gedung' ? 'Nama Gedung *' : field === 'lantai' ? 'Lantai *' : 'No. HP (opsional)'}
                </label>
                <input
                  type={field === 'phone' ? 'tel' : 'text'}
                  placeholder={field === 'name' ? 'Contoh: Budi Santoso' : field === 'gedung' ? 'Contoh: Gedung A / Tower 1' : field === 'lantai' ? 'Contoh: 5' : '08xxxxxxxxxx'}
                  value={info[field]}
                  onChange={e => setInfo(i => ({ ...i, [field]: e.target.value }))}
                  style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #E5E0D8', borderRadius: 10, fontSize: 14, outline: 'none' }}
                  onFocus={e => e.target.style.borderColor = '#E8A838'}
                  onBlur={e => e.target.style.borderColor = '#E5E0D8'}
                />
              </div>
            ))}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Catatan (opsional)</label>
              <textarea
                placeholder="Contoh: Tidak pakai sambal, tambah nasi"
                value={info.catatan}
                onChange={e => setInfo(i => ({ ...i, catatan: e.target.value }))}
                rows={2}
                style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #E5E0D8', borderRadius: 10, fontSize: 14, outline: 'none', resize: 'none' }}
              />
            </div>
            <button
              onClick={() => { if (!info.name || !info.gedung || !info.lantai) { alert('Nama, Gedung, dan Lantai wajib diisi!'); return; } setStep(2) }}
              style={{ width: '100%', padding: 14, background: '#E8A838', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
            >
              Pilih Menu →
            </button>
          </div>
        )}

        {/* STEP 2: Pilih menu */}
        {step === 2 && (
          <div>
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat} style={{ background: '#fff', borderRadius: 16, padding: '1.25rem', marginBottom: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#2D5016', marginBottom: 12 }}>{categoryLabel[cat] || cat}</h4>
                {items.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F0EDE8' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</div>
                      <div style={{ fontSize: 13, color: '#E8A838', fontWeight: 600 }}>{formatRp(p.price)}</div>
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
                ))}
              </div>
            ))}

            {/* Cart sticky footer */}
            {totalQty > 0 && (
              <div style={{ position: 'sticky', bottom: 16, background: '#1A2E0A', borderRadius: 16, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{totalQty} item</div>
                  <div style={{ color: '#E8A838', fontWeight: 700, fontSize: 16 }}>{formatRp(total)}</div>
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
              {cartItems.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F0EDE8', fontSize: 14 }}>
                  <span>{p.name} <span style={{ color: '#888' }}>x{cart[p.id]}</span></span>
                  <span style={{ fontWeight: 600 }}>{formatRp(p.price * cart[p.id])}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', fontWeight: 700, fontSize: 16, color: '#E8A838' }}>
                <span>Total</span>
                <span>{formatRp(total)}</span>
              </div>
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
