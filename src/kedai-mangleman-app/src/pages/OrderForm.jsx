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

// ⚠️ GANTI dengan nomor WA admin (format: 628xxxxxxxxxx)
const ADMIN_WA = '6281234567890'

function buildWAMessage(info, cartItems, cart, total, orderNum) {
  const items = cartItems.map(p => `  • ${p.name} x${cart[p.id]} = ${formatRp(p.price * cart[p.id])}`).join('\n')
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
💰 *TOTAL: ${formatRp(total)}*
━━━━━━━━━━━━━━━━━━
Mohon konfirmasi pesanan saya ya kak 🙏`)
}

export default function OrderForm() {
  const [step, setStep] = useState(1)
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState({})
  const [info, setInfo] = useState({ name: '', gedung: '', lantai: '', phone: '', catatan: '' })
  const [loading, setLoading] = useState(false)
  const [orderNum, setOrderNum] = useState('')
  const [error, setError] = useState('')
  const [waUrl, setWaUrl] = useState('')

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

      const items = cartItems.map(p => ({
        order_id: order.id,
        product_id: p.id,
        product_name: p.name,
        quantity: cart[p.id],
        price: p.price,
        subtotal: p.price * cart[p.id],
      }))
      await supabase.from('order_items').insert(items)

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

      // Build WA URL
      const msg = buildWAMessage(info, cartItems, cart, total, num)
      setWaUrl(`https://wa.me/${ADMIN_WA}?text=${msg}`)

      setStep(4)
    } catch (e) {
      setError('Gagal mengirim pesanan. Coba lagi ya!')
      console.error(e)
    }
    setLoading(false)
  }

  // ─── STEP 4: Sukses + WA ───────────────────────────────────
  if (step === 4) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1A2E0A 0%, #2D5016 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '2rem', textAlign: 'center', maxWidth: 400, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize: 60, marginBottom: 12 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Pesanan Masuk!</h2>
        <p style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>Terima kasih <strong>{info.name}</strong>! Pesananmu sudah kami terima.</p>

        {/* Order number */}
        <div style={{ background: '#F7F5F0', borderRadius: 12, padding: '12px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Nomor Order</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#E8A838', letterSpacing: 2 }}>{orderNum}</div>
        </div>

        {/* Lokasi */}
        <div style={{ background: '#E8F5E0', borderRadius: 10, padding: '10px', marginBottom: 16, fontSize: 13, color: '#2D5016' }}>
          📍 Dikirim ke <strong>{info.gedung}</strong>, Lantai <strong>{info.lantai}</strong>
        </div>

        {/* Ringkasan order */}
        <div style={{ background: '#F7F5F0', borderRadius: 10, padding: '12px', marginBottom: 20, textAlign: 'left' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ringkasan Pesanan</div>
          {cartItems.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span>{p.name} <span style={{ color: '#888' }}>x{cart[p.id]}</span></span>
              <span style={{ fontWeight: 600 }}>{formatRp(p.price * cart[p.id])}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #E5E0D8', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, color: '#E8A838' }}>
            <span>Total</span>
            <span>{formatRp(total)}</span>
          </div>
        </div>

        {/* TOMBOL WA — CTA utama */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            width: '100%', padding: '14px',
            background: '#25D366', color: '#fff',
            borderRadius: 12, fontWeight: 700, fontSize: 15,
            textDecoration: 'none', marginBottom: 10,
            boxShadow: '0 4px 15px rgba(37,211,102,0.4)',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Konfirmasi via WhatsApp
        </a>

        <p style={{ fontSize: 11, color: '#aaa', marginBottom: 16 }}>
          Klik tombol di atas untuk mengirim detail pesanan ke admin kami via WhatsApp
        </p>

        <button
          onClick={() => {
            setStep(1); setCart({})
            setInfo({ name: '', gedung: '', lantai: '', phone: '', catatan: '' })
            setOrderNum(''); setWaUrl('')
          }}
          style={{ width: '100%', padding: '10px', background: '#F0EDE8', color: '#666', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
        >
          Pesan Lagi
        </button>
      </div>
    </div>
  )

  // ─── STEP 1: Info diri ────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1A2E0A 0%, #2D5016 100%)' }}>
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
            <span style={{ fontSize: 11, color: step === i + 1 ? '#fff' : 'rgba(255,255,255,0.5)' }}>{label}</span>
            {i < 2 && <div style={{ width: 20, height: 1, background: 'rgba(255,255,255,0.2)', marginLeft: 4 }} />}
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 1rem 2rem' }}>

        {/* STEP 1 */}
        {step === 1 && (
          <div style={{ background: '#fff', borderRadius: 20, padding: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginBottom: 20, fontWeight: 700, fontSize: 16 }}>📝 Info Pemesanan</h3>
            {['name', 'gedung', 'lantai', 'phone'].map(field => (
              <div key={field} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {field === 'name' ? 'Nama Lengkap *' : field === 'gedung' ? 'Nama Gedung *' : field === 'lantai' ? 'Lantai *' : 'No. HP (untuk konfirmasi WA)'}
                </label>
                <input
                  type={field === 'phone' ? 'tel' : 'text'}
                  placeholder={field === 'name' ? 'Contoh: Budi Santoso' : field === 'gedung' ? 'Contoh: Gedung A / Tower 1' : field === 'lantai' ? 'Contoh: 5' : '08xxxxxxxxxx'}
                  value={info[field]}
                  onChange={e => setInfo(i => ({ ...i, [field]: e.target.value }))}
                  style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #E5E0D8', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = '#E8A838'}
                  onBlur={e => e.target.style.borderColor = '#E5E0D8'}
                />
              </div>
            ))}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Catatan (opsional)</label>
              <textarea placeholder="Contoh: Tidak pakai sambal, tambah nasi" value={info.catatan} onChange={e => setInfo(i => ({ ...i, catatan: e.target.value }))} rows={2}
                style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #E5E0D8', borderRadius: 10, fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
            </div>
            <button onClick={() => { if (!info.name || !info.gedung || !info.lantai) { alert('Nama, Gedung, dan Lantai wajib diisi!'); return; } setStep(2) }}
              style={{ width: '100%', padding: 14, background: '#E8A838', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
              Pilih Menu →
            </button>
          </div>
        )}

        {/* STEP 2: Menu */}
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
                <span>Total</span><span>{formatRp(total)}</span>
              </div>
            </div>

            {/* Info WA */}
            <div style={{ background: '#E8F5E0', borderRadius: 10, padding: '10px 12px', marginBottom: 16, fontSize: 13, color: '#2D5016', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18 }}>💬</span>
              <span>Setelah pesan, kamu akan diarahkan untuk <strong>konfirmasi via WhatsApp</strong> ke admin kami.</span>
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
