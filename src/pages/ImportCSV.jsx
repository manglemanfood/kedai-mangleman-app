import React, { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

// ============================================================
// UTILITY
// ============================================================
const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { headers: [], rows: [] }
  // Detect separator: comma or semicolon
  const sep = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
  const rows = lines.slice(1).map(line => {
    const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ''))
    const obj = {}
    headers.forEach((h, i) => { obj[h] = vals[i] || '' })
    return obj
  }).filter(row => Object.values(row).some(v => v !== ''))
  return { headers, rows }
}

function cleanNumber(val) {
  if (!val) return 0
  return parseInt(String(val).replace(/[^0-9]/g, '')) || 0
}

function cleanDate(val) {
  if (!val) return new Date().toISOString().split('T')[0]
  // Handle DD/MM/YYYY or DD-MM-YYYY
  const parts = val.split(/[\/\-\.]/)
  if (parts.length === 3) {
    if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
    if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`
  }
  const d = new Date(val)
  return isNaN(d) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0]
}

// ============================================================
// IMPORT CONFIGS per type
// ============================================================
const IMPORT_TYPES = {
  penjualan: {
    label: '💰 Penjualan / Transaksi',
    desc: 'Data historis order & transaksi',
    color: '#2D5016',
    bg: '#E8F5E0',
    templateHeaders: 'tanggal,nama_customer,gedung,lantai,nama_produk,qty,harga,total,status',
    templateExample: '20/01/2026,Budi Santoso,Gedung A,5,Ricebowl Lele Goreng,2,18000,36000,Selesai',
    mapFn: (rows) => {
      // Group by transaction (same customer+date = 1 order)
      const orders = {}
      rows.forEach((r, i) => {
        const key = `${r.tanggal || r.date || r['tanggal transaksi'] || ''}_${r.nama_customer || r.customer || r.nama || r['nama pelanggan'] || 'Unknown'}_${i}`
        // Try various column name variants
        const tanggal = r.tanggal || r.date || r['tanggal transaksi'] || r['tgl'] || ''
        const nama = r.nama_customer || r.customer || r.nama || r['nama pelanggan'] || r['name'] || 'Pelanggan'
        const gedung = r.gedung || r.building || r['nama gedung'] || ''
        const lantai = r.lantai || r.floor || r['lt'] || ''
        const produk = r.nama_produk || r.produk || r.menu || r['nama menu'] || r['item'] || ''
        const qty = parseInt(r.qty || r.jumlah || r.quantity || 1) || 1
        const harga = cleanNumber(r.harga || r.price || r['harga satuan'] || 0)
        const total = cleanNumber(r.total || r['total harga'] || r['subtotal'] || (harga * qty))
        const status = r.status || 'Selesai'

        if (!orders[key]) {
          orders[key] = {
            customer_name: nama, gedung, lantai,
            total_amount: 0, status,
            created_at: cleanDate(tanggal),
            items: []
          }
        }
        if (produk) {
          orders[key].items.push({ product_name: produk, quantity: qty, price: harga, subtotal: total || harga * qty })
          orders[key].total_amount += total || harga * qty
        }
      })
      return Object.values(orders)
    }
  },
  pelanggan: {
    label: '👥 Pelanggan',
    desc: 'Data customer & riwayat',
    color: '#0077B6',
    bg: '#E0F4FF',
    templateHeaders: 'nama,no_hp,gedung,lantai,total_order,total_belanja,segment',
    templateExample: 'Budi Santoso,08123456789,Gedung A,5,10,250000,Loyal',
    mapFn: (rows) => rows.map(r => ({
      name: r.nama || r.name || r['nama pelanggan'] || '',
      phone: r.no_hp || r.hp || r.phone || r['nomor hp'] || '',
      gedung: r.gedung || r.building || '',
      lantai: r.lantai || r.floor || '',
      total_orders: parseInt(r.total_order || r['jumlah order'] || 0) || 0,
      total_spent: cleanNumber(r.total_belanja || r['total pembelian'] || 0),
      segment: r.segment || 'Baru',
      created_at: new Date().toISOString()
    })).filter(r => r.name)
  },
  pengeluaran: {
    label: '💸 Pengeluaran',
    desc: 'Data historis pengeluaran toko',
    color: '#C0392B',
    bg: '#FFE8E8',
    templateHeaders: 'tanggal,kategori,deskripsi,jumlah,supplier',
    templateExample: '20/01/2026,Bahan Baku,Beli lele 5kg,75000,Pak Budi',
    mapFn: (rows) => rows.map(r => ({
      expense_date: cleanDate(r.tanggal || r.date || r['tgl'] || ''),
      category: r.kategori || r.category || r['jenis'] || 'Lainnya',
      description: r.deskripsi || r.description || r['keterangan'] || '',
      amount: cleanNumber(r.jumlah || r.amount || r['total'] || 0),
      supplier: r.supplier || r.toko || ''
    })).filter(r => r.description && r.amount > 0)
  },
  bahan_baku: {
    label: '🥩 Bahan Baku & HPP',
    desc: 'Daftar bahan + harga terkini',
    color: '#C8881A',
    bg: '#FFF3D6',
    templateHeaders: 'nama_bahan,satuan,stok,stok_minimal,harga_terakhir',
    templateExample: 'Lele segar,kg,10,2,28000',
    mapFn: (rows) => rows.map(r => ({
      name: r.nama_bahan || r.bahan || r.nama || r['nama bahan'] || '',
      unit: r.satuan || r.unit || r['satuan'] || 'kg',
      stock_qty: parseFloat(r.stok || r.stock || r['stok sekarang'] || 0) || 0,
      min_stock: parseFloat(r.stok_minimal || r['stok min'] || r['minimum stok'] || 0) || 0,
      last_price: cleanNumber(r.harga_terakhir || r.harga || r['harga beli'] || 0),
    })).filter(r => r.name)
  },
  resep: {
    label: '📖 Resep',
    desc: 'Bahan-bahan tiap menu',
    color: '#6B2FD9',
    bg: '#EDE0FF',
    templateHeaders: 'nama_menu,nama_bahan,jumlah,satuan',
    templateExample: 'Ricebowl Lele Goreng,Lele segar,150,gram',
    mapFn: (rows) => rows.map(r => ({
      product_name: r.nama_menu || r.menu || r['nama produk'] || '',
      material_name: r.nama_bahan || r.bahan || r['nama bahan'] || '',
      qty_used: parseFloat(r.jumlah || r.qty || r['jumlah pemakaian'] || 0) || 0,
      unit: r.satuan || r.unit || 'gram',
    })).filter(r => r.product_name && r.material_name)
  }
}

// ============================================================
// IMPORT HANDLER
// ============================================================
async function importData(type, mappedData, onProgress) {
  const results = { success: 0, error: 0, errors: [] }

  if (type === 'penjualan') {
    for (let i = 0; i < mappedData.length; i++) {
      const order = mappedData[i]
      onProgress(Math.round((i / mappedData.length) * 100))
      try {
        const { data: orderData, error } = await supabase.from('orders').insert({
          customer_name: order.customer_name,
          gedung: order.gedung || '-',
          lantai: order.lantai || '-',
          total_amount: order.total_amount,
          status: order.status || 'Selesai',
          payment_status: 'Lunas',
          created_at: order.created_at + 'T00:00:00+07:00',
          updated_at: new Date().toISOString()
        }).select().single()
        if (error) throw error
        if (order.items.length > 0) {
          await supabase.from('order_items').insert(order.items.map(item => ({
            order_id: orderData.id,
            product_name: item.product_name,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.subtotal
          })))
        }
        // Upsert customer
        if (order.customer_name) {
          const { data: existing } = await supabase.from('customers').select('id,total_orders,total_spent').eq('name', order.customer_name).maybeSingle()
          if (existing) {
            const newOrders = existing.total_orders + 1
            const newSpent = existing.total_spent + order.total_amount
            let segment = 'Baru'
            if (newOrders >= 20 || newSpent >= 500000) segment = 'VIP'
            else if (newOrders >= 10 || newSpent >= 200000) segment = 'Loyal'
            else if (newOrders >= 3) segment = 'Regular'
            await supabase.from('customers').update({ total_orders: newOrders, total_spent: newSpent, segment, last_order_at: order.created_at }).eq('id', existing.id)
          } else {
            await supabase.from('customers').insert({ name: order.customer_name, gedung: order.gedung, lantai: order.lantai, total_orders: 1, total_spent: order.total_amount, segment: 'Baru', last_order_at: order.created_at })
          }
        }
        results.success++
      } catch (e) {
        results.error++
        results.errors.push(`Row ${i+1}: ${e.message}`)
      }
    }
  } else if (type === 'pelanggan') {
    for (let i = 0; i < mappedData.length; i++) {
      onProgress(Math.round((i / mappedData.length) * 100))
      try {
        const { error } = await supabase.from('customers').upsert(mappedData[i], { onConflict: 'phone', ignoreDuplicates: false })
        if (error) throw error
        results.success++
      } catch (e) {
        results.error++
        results.errors.push(`Row ${i+1} (${mappedData[i].name}): ${e.message}`)
      }
    }
  } else if (type === 'pengeluaran') {
    const chunkSize = 50
    for (let i = 0; i < mappedData.length; i += chunkSize) {
      onProgress(Math.round((i / mappedData.length) * 100))
      const chunk = mappedData.slice(i, i + chunkSize)
      const { error } = await supabase.from('expenses').insert(chunk)
      if (error) { results.error += chunk.length; results.errors.push(error.message) }
      else results.success += chunk.length
    }
  } else if (type === 'bahan_baku') {
    for (let i = 0; i < mappedData.length; i++) {
      onProgress(Math.round((i / mappedData.length) * 100))
      try {
        const { data: existing } = await supabase.from('raw_materials').select('id').eq('name', mappedData[i].name).maybeSingle()
        if (existing) {
          await supabase.from('raw_materials').update(mappedData[i]).eq('id', existing.id)
        } else {
          await supabase.from('raw_materials').insert(mappedData[i])
        }
        results.success++
      } catch (e) {
        results.error++
        results.errors.push(`Row ${i+1}: ${e.message}`)
      }
    }
  } else if (type === 'resep') {
    for (let i = 0; i < mappedData.length; i++) {
      onProgress(Math.round((i / mappedData.length) * 100))
      try {
        const row = mappedData[i]
        // Find product
        let { data: product } = await supabase.from('products').select('id').ilike('name', row.product_name).maybeSingle()
        if (!product) {
          const { data: newProd } = await supabase.from('products').insert({ name: row.product_name, category: 'ricebowl', price: 0 }).select().single()
          product = newProd
        }
        // Find or create material
        let { data: material } = await supabase.from('raw_materials').select('id').ilike('name', row.material_name).maybeSingle()
        if (!material) {
          const { data: newMat } = await supabase.from('raw_materials').insert({ name: row.material_name, unit: row.unit, stock_qty: 0, min_stock: 0, last_price: 0 }).select().single()
          material = newMat
        }
        if (product && material) {
          // Check if recipe already exists
          const { data: existing } = await supabase.from('recipes').select('id').eq('product_id', product.id).eq('raw_material_id', material.id).maybeSingle()
          if (existing) {
            await supabase.from('recipes').update({ qty_used: row.qty_used, unit: row.unit, material_name: row.material_name }).eq('id', existing.id)
          } else {
            await supabase.from('recipes').insert({ product_id: product.id, raw_material_id: material.id, material_name: row.material_name, qty_used: row.qty_used, unit: row.unit })
          }
        }
        results.success++
      } catch (e) {
        results.error++
        results.errors.push(`Row ${i+1}: ${e.message}`)
      }
    }
  }

  onProgress(100)
  return results
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function ImportCSV() {
  const [selectedType, setSelectedType] = useState(null)
  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [mapped, setMapped] = useState(null)
  const [step, setStep] = useState(1) // 1=pilih tipe, 2=upload, 3=preview, 4=importing, 5=done
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const fileRef = useRef()

  const handleFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const { headers, rows } = parseCSV(ev.target.result)
        if (rows.length === 0) { setError('File kosong atau format tidak dikenali.'); return }
        const cfg = IMPORT_TYPES[selectedType]
        const mappedRows = cfg.mapFn(rows)
        setParsed({ headers, rows, total: rows.length })
        setMapped(mappedRows)
        setStep(3)
      } catch (err) {
        setError('Gagal membaca file: ' + err.message)
      }
    }
    reader.readAsText(f, 'UTF-8')
  }

  const startImport = async () => {
    setStep(4)
    setProgress(0)
    const res = await importData(selectedType, mapped, setProgress)
    setResults(res)
    setStep(5)
  }

  const reset = () => {
    setSelectedType(null); setFile(null); setParsed(null); setMapped(null)
    setStep(1); setProgress(0); setResults(null); setError('')
  }

  const downloadTemplate = (type) => {
    const cfg = IMPORT_TYPES[type]
    const content = cfg.templateHeaders + '\n' + cfg.templateExample
    const blob = new Blob([content], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `template_${type}.csv`
    a.click()
  }

  const cfg = selectedType ? IMPORT_TYPES[selectedType] : null

  return (
    <div>
      <div className="page-header">
        <h1>Import Data CSV 📥</h1>
        <p>Upload data historis secara bulk dari file Excel/CSV</p>
      </div>

      {/* STEP 1: Pilih tipe */}
      {step === 1 && (
        <div>
          <p style={{ marginBottom: '1.25rem', color: 'var(--text-muted)', fontSize: 14 }}>
            Pilih jenis data yang ingin kamu import:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
            {Object.entries(IMPORT_TYPES).map(([key, cfg]) => (
              <div key={key} className="card" style={{ cursor: 'pointer', border: `2px solid ${cfg.color}22`, transition: 'all 0.15s' }}
                onClick={() => { setSelectedType(key); setStep(2) }}
                onMouseOver={e => e.currentTarget.style.borderColor = cfg.color}
                onMouseOut={e => e.currentTarget.style.borderColor = cfg.color + '22'}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>{cfg.label.split(' ')[0]}</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{cfg.label.slice(3)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{cfg.desc}</div>
                <div style={{ background: cfg.bg, borderRadius: 6, padding: '6px 10px', fontSize: 11, color: cfg.color, fontFamily: 'monospace' }}>
                  {cfg.templateHeaders.split(',').slice(0,3).join(', ')}...
                </div>
                <button onClick={e => { e.stopPropagation(); downloadTemplate(key) }}
                  style={{ marginTop: 10, fontSize: 11, color: cfg.color, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                  📄 Download template CSV
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 2: Upload file */}
      {step === 2 && cfg && (
        <div style={{ maxWidth: 560 }}>
          <div className="card mb-2" style={{ borderLeft: `4px solid ${cfg.color}`, padding: '1rem 1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{cfg.label}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>Format kolom yang diharapkan:</div>
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, marginBottom: 8 }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Header:</div>
              <div style={{ color: cfg.color, fontWeight: 600 }}>{cfg.templateHeaders}</div>
              <div style={{ color: 'var(--text-muted)', marginTop: 8, marginBottom: 4 }}>Contoh data:</div>
              <div>{cfg.templateExample}</div>
            </div>
            <button onClick={() => downloadTemplate(selectedType)} className="btn btn-outline btn-sm">
              📄 Download Template CSV
            </button>
          </div>

          <div className="card" style={{ padding: '2rem', textAlign: 'center', border: `2px dashed ${cfg.color}44`, cursor: 'pointer' }}
            onClick={() => fileRef.current?.click()}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Klik untuk pilih file CSV</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>atau drag & drop file .csv / .txt di sini</div>
            {file && <div style={{ marginTop: 10, color: cfg.color, fontWeight: 600, fontSize: 13 }}>✅ {file.name}</div>}
            <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" onChange={handleFile} style={{ display: 'none' }} />
          </div>

          {error && <div className="alert alert-danger mt-1">{error}</div>}

          <div className="alert alert-info mt-1" style={{ fontSize: 13 }}>
            💡 <strong>Tips:</strong> Export dari Excel dengan "Save As → CSV UTF-8". Nama kolom bisa berbeda-beda — sistem akan otomatis mendeteksi.
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
            <button className="btn btn-outline" onClick={reset}>← Ganti Tipe</button>
          </div>
        </div>
      )}

      {/* STEP 3: Preview */}
      {step === 3 && parsed && mapped && cfg && (
        <div>
          <div className="alert alert-success">
            ✅ File berhasil dibaca! <strong>{parsed.total} baris</strong> ditemukan → <strong>{mapped.length} data</strong> siap diimport
          </div>

          {/* Summary card */}
          <div className="card mb-2" style={{ padding: '1rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{cfg.label}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>File: {file?.name}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: cfg.color }}>{mapped.length}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Data siap import</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-muted)' }}>{parsed.total - mapped.length}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Baris dilewati (kosong/invalid)</div>
            </div>
          </div>

          {/* Preview table */}
          <div className="card mb-2" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>
              Preview 10 data pertama
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    {Object.keys(mapped[0] || {}).map(k => <th key={k}>{k}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {mapped.slice(0, 10).map((row, i) => (
                    <tr key={i}>
                      {Object.values(row).map((v, j) => (
                        <td key={j} style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {typeof v === 'object' ? JSON.stringify(v).slice(0,40) : String(v || '-').slice(0,40)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {mapped.length > 10 && (
              <div style={{ padding: '8px 16px', background: 'var(--bg)', fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                ... dan {mapped.length - 10} data lainnya
              </div>
            )}
          </div>

          <div className="alert alert-warning" style={{ fontSize: 13 }}>
            ⚠️ <strong>Perhatian:</strong> Pastikan preview sudah benar sebelum import. Data yang sudah diimport tidak bisa di-undo secara otomatis.
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline" onClick={() => { setStep(2); setFile(null); setParsed(null); setMapped(null) }}>← Upload Ulang</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={startImport}>
              🚀 Import {mapped.length} Data Sekarang
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Importing */}
      {step === 4 && (
        <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center', padding: '3rem 1rem' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Sedang mengimport data...</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>Jangan tutup halaman ini</p>
          <div style={{ background: 'var(--border)', borderRadius: 20, height: 12, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ width: progress + '%', background: cfg?.color || 'var(--primary)', height: '100%', borderRadius: 20, transition: 'width 0.3s' }} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 20, color: cfg?.color }}>{progress}%</div>
        </div>
      )}

      {/* STEP 5: Done */}
      {step === 5 && results && (
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>{results.error === 0 ? '🎉' : '⚠️'}</div>
            <h3 style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Import Selesai!</h3>
          </div>
          <div className="grid-2 mb-2">
            <div className="card" style={{ textAlign: 'center', borderLeft: '3px solid var(--success)' }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--success)' }}>{results.success}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Berhasil diimport</div>
            </div>
            <div className="card" style={{ textAlign: 'center', borderLeft: '3px solid var(--danger)' }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: results.error > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{results.error}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Gagal / dilewati</div>
            </div>
          </div>
          {results.errors.length > 0 && (
            <div className="card mb-2" style={{ padding: '1rem', background: '#FFF8F8' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--danger)' }}>Detail error:</div>
              {results.errors.slice(0,5).map((e, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>• {e}</div>
              ))}
              {results.errors.length > 5 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>... dan {results.errors.length - 5} error lainnya</div>}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={reset}>Import Data Lain</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => window.location.href = '/dashboard'}>🏠 Ke Dashboard</button>
          </div>
        </div>
      )}
    </div>
  )
}
