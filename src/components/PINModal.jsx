import React, { useState, useEffect, useRef, useCallback } from 'react'

export const MODULE_PINS = {
  'rekap-order': '1234',
  'crm': '1234',
  'pengeluaran': '1234',
  'stok': '1234',
  'resep': '1234',
  'hpp': '1234',
}

export const MODULE_NAMES = {
  'rekap-order': 'Rekap Order',
  'crm': 'CRM Pelanggan',
  'pengeluaran': 'Pengeluaran',
  'stok': 'Stok & Inventory',
  'resep': 'Resep',
  'hpp': 'Kalkulator HPP',
}

// ✅ FIX: Gunakan useRef untuk menyimpan resolve, bukan useState
export function usePINConfirm(module) {
  const [isOpen, setIsOpen] = useState(false)
  const [label, setLabel] = useState('')
  const resolveRef = useRef(null)

  const requestPIN = useCallback((labelText = 'data ini') => {
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setLabel(labelText)
      setIsOpen(true)
    })
  }, [])

  const handleSuccess = useCallback(() => {
    setIsOpen(false)
    resolveRef.current?.(true)
    resolveRef.current = null
  }, [])

  const handleCancel = useCallback(() => {
    setIsOpen(false)
    resolveRef.current?.(false)
    resolveRef.current = null
  }, [])

  const PINGate = useCallback(() => {
    if (!isOpen) return null
    return (
      <PINModal
        module={module}
        label={label}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    )
  }, [isOpen, module, label, handleSuccess, handleCancel])

  return { requestPIN, PINGate }
}

// Komponen modal PIN
export default function PINModal({ module, label, onSuccess, onCancel }) {
  const [pin, setPin] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [locked, setLocked] = useState(false)
  const [lockTimer, setLockTimer] = useState(0)
  const inputs = useRef([])
  const attemptsRef = useRef(0)

  useEffect(() => {
    setTimeout(() => inputs.current[0]?.focus(), 100)
  }, [])

  useEffect(() => {
    if (locked && lockTimer > 0) {
      const t = setTimeout(() => setLockTimer(s => s - 1), 1000)
      return () => clearTimeout(t)
    }
    if (locked && lockTimer === 0 && lockTimer !== null) setLocked(false)
  }, [locked, lockTimer])

  const checkPin = useCallback((fullPin) => {
    if (locked) return
    const correct = MODULE_PINS[module]

    console.log('Checking PIN:', fullPin, 'vs correct:', correct, 'module:', module)

    if (fullPin === correct) {
      setError('')
      setPin(['', '', '', ''])
      onSuccess()
    } else {
      attemptsRef.current += 1
      const newAttempts = attemptsRef.current
      setAttempts(newAttempts)
      setShake(true)
      setTimeout(() => setShake(false), 500)
      setPin(['', '', '', ''])
      setTimeout(() => inputs.current[0]?.focus(), 100)

      if (newAttempts >= 3) {
        setLocked(true)
        setLockTimer(30)
        setError('Terlalu banyak percobaan. Tunggu 30 detik.')
      } else {
        setError(`PIN salah. ${3 - newAttempts} percobaan tersisa.`)
      }
    }
  }, [locked, module, onSuccess])

  // Handle input dari keyboard
  const handleInput = (val, idx) => {
    if (!/^\d*$/.test(val)) return
    const digit = val.slice(-1)
    const newPin = [...pin]
    newPin[idx] = digit
    setPin(newPin)
    setError('')

    if (digit && idx < 3) {
      inputs.current[idx + 1]?.focus()
    }

    // Auto submit digit ke-4
    if (idx === 3 && digit) {
      const fullPin = newPin.join('')
      if (fullPin.length === 4) {
        setTimeout(() => checkPin(fullPin), 50)
      }
    }
  }

  const handleKeyDown = (e, idx) => {
    if (e.key === 'Backspace' && !pin[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus()
      const newPin = [...pin]
      newPin[idx - 1] = ''
      setPin(newPin)
    }
    if (e.key === 'Enter') {
      const fullPin = pin.join('')
      if (fullPin.length === 4) checkPin(fullPin)
    }
  }

  // ✅ FIX: Handle numpad click — langsung isi dan cek
  const handleNumpad = (num) => {
    if (locked) return
    if (num === '⌫') {
      // Cari digit terakhir yang terisi
      let lastIdx = -1
      for (let i = 3; i >= 0; i--) {
        if (pin[i] !== '') { lastIdx = i; break }
      }
      if (lastIdx >= 0) {
        const newPin = [...pin]
        newPin[lastIdx] = ''
        setPin(newPin)
        inputs.current[lastIdx]?.focus()
      }
      return
    }

    // Cari slot kosong pertama
    const firstEmpty = pin.findIndex(v => v === '')
    if (firstEmpty === -1) return

    const newPin = [...pin]
    newPin[firstEmpty] = String(num)
    setPin(newPin)

    if (firstEmpty < 3) {
      inputs.current[firstEmpty + 1]?.focus()
    }

    // Auto submit saat slot ke-4 terisi
    if (firstEmpty === 3) {
      const fullPin = newPin.join('')
      setTimeout(() => checkPin(fullPin), 50)
    }
  }

  const moduleName = MODULE_NAMES[module] || module

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.65)',
      zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '2rem',
        width: '100%', maxWidth: 340, textAlign: 'center',
        boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
        animation: shake ? 'pinShake 0.4s ease' : 'none',
      }}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>🔐</div>
        <h3 style={{ fontWeight: 700, fontSize: 17, marginBottom: 4, color: '#1A1A1A' }}>Konfirmasi Manager</h3>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 6 }}>
          Masukkan PIN untuk hapus<br /><strong style={{ color: '#1A1A1A' }}>{label}</strong>
        </p>
        <div style={{ display: 'inline-block', background: '#FFF3D6', borderRadius: 8, padding: '3px 12px', fontSize: 11, color: '#C8881A', fontWeight: 600, marginBottom: 22 }}>
          📋 {moduleName}
        </div>

        {/* PIN dots input */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 18 }}>
          {pin.map((digit, i) => (
            <input
              key={i}
              ref={el => inputs.current[i] = el}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleInput(e.target.value, i)}
              onKeyDown={e => handleKeyDown(e, i)}
              disabled={locked}
              style={{
                width: 54, height: 54,
                textAlign: 'center', fontSize: 22, fontWeight: 700,
                border: `2.5px solid ${error ? '#E74C3C' : digit ? '#E8A838' : '#E5E0D8'}`,
                borderRadius: 12, outline: 'none',
                background: digit ? '#FFF8ED' : '#F7F5F0',
                color: '#1A1A1A',
                transition: 'border-color 0.15s, background 0.15s',
                cursor: locked ? 'not-allowed' : 'text',
              }}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#FFE8E8', color: '#C0392B', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 14 }}>
            ⚠️ {error} {locked && lockTimer > 0 && `(${lockTimer}s)`}
          </div>
        )}

        {/* Numpad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
          {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((num, i) => (
            <button
              key={i}
              disabled={locked || num === ''}
              onClick={() => num !== '' && handleNumpad(num)}
              style={{
                padding: '13px 0',
                fontSize: num === '⌫' ? 20 : 18,
                fontWeight: num === '⌫' ? 400 : 600,
                background: num === '' ? 'transparent' : num === '⌫' ? '#FFE8E8' : '#F7F5F0',
                border: num === '' ? 'none' : `1px solid ${num === '⌫' ? '#FFCCCC' : '#E5E0D8'}`,
                borderRadius: 10,
                cursor: num === '' || locked ? 'default' : 'pointer',
                color: num === '⌫' ? '#C0392B' : '#1A1A1A',
                opacity: locked && num !== '' ? 0.4 : 1,
                transition: 'background 0.1s',
              }}
            >
              {num}
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          style={{ width: '100%', padding: '12px', background: '#F0EDE8', color: '#666', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
        >
          Batal
        </button>
      </div>

      <style>{`
        @keyframes pinShake {
          0%,100% { transform: translateX(0); }
          15% { transform: translateX(-10px); }
          30% { transform: translateX(10px); }
          45% { transform: translateX(-7px); }
          60% { transform: translateX(7px); }
          75% { transform: translateX(-4px); }
          90% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  )
}
