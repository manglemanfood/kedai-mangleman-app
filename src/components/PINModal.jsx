import React, { useState, useRef, useCallback, createContext, useContext } from 'react'

export const MASTER_PIN = '1234' // Ganti PIN di sini

const MODULE_NAMES = {
  'rekap-order': 'Rekap Order',
  'crm': 'CRM Pelanggan',
  'pengeluaran': 'Pengeluaran',
  'stok': 'Stok & Inventory',
  'resep': 'Resep',
  'hpp': 'Kalkulator HPP',
}

// ============================================================
// CONTEXT — satu modal untuk seluruh app
// ============================================================
const PINContext = createContext(null)

export function PINProvider({ children }) {
  const [state, setState] = useState({ open: false, label: '', module: '' })
  const resolveRef = useRef(null)

  const askPIN = useCallback((label, module) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setState({ open: true, label, module })
    })
  }, [])

  const confirm = useCallback(() => {
    setState(s => ({ ...s, open: false }))
    // Kecil delay biar modal tutup dulu baru action jalan
    setTimeout(() => {
      resolveRef.current?.(true)
      resolveRef.current = null
    }, 50)
  }, [])

  const cancel = useCallback(() => {
    setState(s => ({ ...s, open: false }))
    setTimeout(() => {
      resolveRef.current?.(false)
      resolveRef.current = null
    }, 50)
  }, [])

  return (
    <PINContext.Provider value={askPIN}>
      {children}
      {state.open && (
        <PINModalUI
          label={state.label}
          module={state.module}
          onSuccess={confirm}
          onCancel={cancel}
        />
      )}
    </PINContext.Provider>
  )
}

// Hook yang dipakai di setiap halaman
export function usePIN(module) {
  const askPIN = useContext(PINContext)
  return useCallback((label) => askPIN(label, module), [askPIN, module])
}

// ============================================================
// UI MODAL PIN
// ============================================================
function PINModalUI({ label, module, onSuccess, onCancel }) {
  const [digits, setDigits] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [tries, setTries] = useState(0)
  const [locked, setLocked] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const inputRefs = useRef([])
  const timerRef = useRef(null)

  React.useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 150)
    return () => clearTimeout(timerRef.current)
  }, [])

  const doShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  const startLockout = () => {
    setLocked(true)
    setCountdown(30)
    const tick = (n) => {
      if (n <= 0) { setLocked(false); setCountdown(0); return }
      timerRef.current = setTimeout(() => { setCountdown(n - 1); tick(n - 1) }, 1000)
    }
    tick(30)
  }

  const verify = useCallback((pinStr) => {
    if (locked) return
    if (pinStr === MASTER_PIN) {
      setError('')
      onSuccess()
    } else {
      doShake()
      setDigits(['', '', '', ''])
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
      const newTries = tries + 1
      setTries(newTries)
      if (newTries >= 3) {
        startLockout()
        setError('Terlalu banyak percobaan. Tunggu 30 detik.')
      } else {
        setError(`PIN salah. ${3 - newTries} kesempatan tersisa.`)
      }
    }
  }, [locked, tries, onSuccess])

  // Isi digit dari keyboard
  const onType = (val, idx) => {
    if (locked || !/^\d?$/.test(val)) return
    const next = [...digits]
    next[idx] = val
    setDigits(next)
    setError('')
    if (val && idx < 3) inputRefs.current[idx + 1]?.focus()
    if (val && idx === 3) {
      const full = next.join('')
      if (full.length === 4) setTimeout(() => verify(full), 30)
    }
  }

  const onKey = (e, idx) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      const next = [...digits]; next[idx - 1] = ''
      setDigits(next)
      inputRefs.current[idx - 1]?.focus()
    }
    if (e.key === 'Enter') {
      const full = digits.join('')
      if (full.length === 4) verify(full)
    }
  }

  // Klik numpad
  const onNumpad = (num) => {
    if (locked) return
    if (num === '⌫') {
      let last = -1
      for (let i = 3; i >= 0; i--) { if (digits[i]) { last = i; break } }
      if (last >= 0) {
        const next = [...digits]; next[last] = ''
        setDigits(next)
        inputRefs.current[last]?.focus()
      }
      return
    }
    const emptyIdx = digits.findIndex(d => d === '')
    if (emptyIdx === -1) return
    const next = [...digits]
    next[emptyIdx] = String(num)
    setDigits(next)
    setError('')
    if (emptyIdx < 3) inputRefs.current[emptyIdx + 1]?.focus()
    if (emptyIdx === 3) {
      const full = next.join('')
      setTimeout(() => verify(full), 30)
    }
  }

  const moduleName = MODULE_NAMES[module] || module

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.7)',
      zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '1.75rem',
        width: '100%', maxWidth: 320, textAlign: 'center',
        boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
        transform: shake ? 'translateX(0)' : undefined,
        animation: shake ? 'pinShake 0.4s ease' : undefined,
      }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
        <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>PIN Manager</h3>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Hapus: <strong style={{ color: '#333' }}>{label}</strong></p>
        <div style={{ fontSize: 11, background: '#FFF3D6', color: '#C8881A', borderRadius: 6, padding: '3px 10px', display: 'inline-block', marginBottom: 18, fontWeight: 600 }}>
          {moduleName}
        </div>

        {/* Input boxes */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => inputRefs.current[i] = el}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => onType(e.target.value, i)}
              onKeyDown={e => onKey(e, i)}
              disabled={locked}
              style={{
                width: 52, height: 52, textAlign: 'center',
                fontSize: 20, fontWeight: 700,
                border: `2px solid ${error ? '#E74C3C' : d ? '#E8A838' : '#DDD'}`,
                borderRadius: 10, outline: 'none',
                background: d ? '#FFFBF0' : '#F8F8F8',
                transition: 'all 0.15s',
              }}
            />
          ))}
        </div>

        {/* Error msg */}
        {(error || locked) && (
          <div style={{ background: '#FFE8E8', color: '#C0392B', borderRadius: 8, padding: '7px 10px', fontSize: 12, marginBottom: 12 }}>
            {locked ? `🔒 Terkunci ${countdown}s` : `⚠️ ${error}`}
          </div>
        )}

        {/* Numpad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 12 }}>
          {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((n, i) => (
            <button key={i} onClick={() => n !== '' && onNumpad(n)} disabled={locked || n === ''}
              style={{
                padding: '12px 0', fontSize: n === '⌫' ? 18 : 17, fontWeight: 600,
                background: n === '' ? 'transparent' : n === '⌫' ? '#FFE8E8' : '#F5F5F5',
                border: n === '' ? 'none' : '1px solid #E8E8E8',
                borderRadius: 8, cursor: n === '' || locked ? 'default' : 'pointer',
                color: n === '⌫' ? '#C0392B' : '#222',
                opacity: locked && n !== '' ? 0.4 : 1,
              }}>
              {n}
            </button>
          ))}
        </div>

        <button onClick={onCancel}
          style={{ width: '100%', padding: '11px', background: '#F0EDE8', color: '#666', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
          Batal
        </button>
      </div>

      <style>{`
        @keyframes pinShake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-5px)}
          80%{transform:translateX(5px)}
        }
      `}</style>
    </div>
  )
}
