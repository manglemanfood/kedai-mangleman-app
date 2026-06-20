import React, { useState, useEffect, useRef } from 'react'

// PIN per modul - bisa diubah sesuai keinginan
export const MODULE_PINS = {
  'rekap-order': '8080',
  'crm': '8080',
  'pengeluaran': '8080',
  'stok': '8080',
  'resep': '8080',
  'hpp': '8080',
}

export const MODULE_NAMES = {
  'rekap-order': 'Rekap Order',
  'crm': 'CRM Pelanggan',
  'pengeluaran': 'Pengeluaran',
  'stok': 'Stok & Inventory',
  'resep': 'Resep',
  'hpp': 'Kalkulator HPP',
}

// Hook untuk pakai di halaman manapun
export function usePINConfirm(module) {
  const [pinState, setPinState] = useState({ open: false, resolve: null, label: '' })

  const requestPIN = (label = 'data ini') => {
    return new Promise((resolve) => {
      setPinState({ open: true, resolve, label })
    })
  }

  const handleResult = (success) => {
    pinState.resolve?.(success)
    setPinState({ open: false, resolve: null, label: '' })
  }

  const PINGate = () => pinState.open ? (
    <PINModal
      module={module}
      label={pinState.label}
      onSuccess={() => handleResult(true)}
      onCancel={() => handleResult(false)}
    />
  ) : null

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

  useEffect(() => {
    inputs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (locked && lockTimer > 0) {
      const t = setTimeout(() => setLockTimer(s => s - 1), 1000)
      return () => clearTimeout(t)
    }
    if (locked && lockTimer === 0) setLocked(false)
  }, [locked, lockTimer])

  const handleInput = (val, idx) => {
    if (!/^\d*$/.test(val)) return
    const newPin = [...pin]
    newPin[idx] = val.slice(-1)
    setPin(newPin)
    setError('')
    if (val && idx < 3) inputs.current[idx + 1]?.focus()

    // Auto submit saat digit ke-4 diisi
    if (idx === 3 && val) {
      const fullPin = [...newPin.slice(0, 3), val].join('')
      checkPin(fullPin, newPin)
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
      if (fullPin.length === 4) checkPin(fullPin, pin)
    }
  }

  const checkPin = (fullPin, currentPin) => {
    if (locked) return
    const correct = MODULE_PINS[module]
    if (fullPin === correct) {
      setError('')
      onSuccess()
    } else {
      const newAttempts = attempts + 1
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
  }

  const moduleName = MODULE_NAMES[module] || module

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '2rem',
        width: '100%', maxWidth: 360, textAlign: 'center',
        boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
        animation: shake ? 'shake 0.4s ease' : 'none',
      }}>
        {/* Icon */}
        <div style={{ fontSize: 44, marginBottom: 12 }}>🔐</div>
        <h3 style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Konfirmasi Manager</h3>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 6 }}>
          Masukkan PIN untuk hapus <strong>{label}</strong>
        </p>
        <div style={{ display: 'inline-block', background: '#FFF3D6', borderRadius: 8, padding: '3px 10px', fontSize: 11, color: '#C8881A', fontWeight: 600, marginBottom: 24 }}>
          📋 Modul: {moduleName}
        </div>

        {/* PIN inputs */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
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
                width: 56, height: 56,
                textAlign: 'center', fontSize: 24, fontWeight: 700,
                border: `2px solid ${error ? '#E74C3C' : digit ? '#E8A838' : '#E5E0D8'}`,
                borderRadius: 12, outline: 'none',
                background: digit ? '#FFF3D6' : '#F7F5F0',
                color: '#1A1A1A',
                transition: 'all 0.15s',
              }}
            />
          ))}
        </div>

        {/* Error / lock */}
        {error && (
          <div style={{ background: '#FFE8E8', color: '#C0392B', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 16 }}>
            ⚠️ {error} {locked && lockTimer > 0 && `(${lockTimer}s)`}
          </div>
        )}

        {/* Numpad untuk mobile */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
          {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((num, i) => (
            <button key={i} disabled={locked || num === ''}
              onClick={() => {
                if (num === '⌫') {
                  const lastFilled = [...pin].map((v,i) => v ? i : -1).filter(i => i >= 0).pop()
                  if (lastFilled !== undefined) {
                    const newPin = [...pin]
                    newPin[lastFilled] = ''
                    setPin(newPin)
                    inputs.current[lastFilled]?.focus()
                  }
                } else if (num !== '') {
                  const firstEmpty = pin.findIndex(v => v === '')
                  if (firstEmpty !== -1) handleInput(String(num), firstEmpty)
                }
              }}
              style={{
                padding: '14px', fontSize: num === '⌫' ? 18 : 17, fontWeight: 600,
                background: num === '' ? 'transparent' : num === '⌫' ? '#FFE8E8' : '#F7F5F0',
                border: num === '' ? 'none' : '1px solid #E5E0D8',
                borderRadius: 10, cursor: num === '' ? 'default' : 'pointer',
                color: num === '⌫' ? '#C0392B' : '#1A1A1A',
                opacity: locked ? 0.5 : 1,
              }}>
              {num}
            </button>
          ))}
        </div>

        {/* Cancel */}
        <button onClick={onCancel}
          style={{ width: '100%', padding: '11px', background: '#F0EDE8', color: '#666', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
          Batal
        </button>
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  )
}
