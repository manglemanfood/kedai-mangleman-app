import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { path: '/rekap-order', label: 'Rekap Order', icon: '📋' },
  { path: '/crm', label: 'CRM Pelanggan', icon: '👥' },
  { path: '/pengeluaran', label: 'Pengeluaran', icon: '💸' },
  { path: '/stok', label: 'Stok & Inventory', icon: '📦' },
  { path: '/resep', label: 'Resep', icon: '📖' },
  { path: '/hpp', label: 'Kalkulator HPP', icon: '🧮' },
  { path: '/laporan', label: 'Laporan L/R', icon: '📊' },
  { path: '/target', label: 'Target Bulanan', icon: '🎯' },
  { path: '/analisa', label: 'Analisa Bisnis', icon: '💡' },
  { path: '/menu', label: 'Manajemen Menu', icon: '🍱' },
  { divider: true },
  { path: '/import', label: 'Import CSV Bulk', icon: '📥', highlight: true },
]

export default function Layout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
      )}
      <aside style={{ width: 240, background: '#1A2E0A', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 50, overflowY: 'auto', transition: 'transform 0.25s' }} className="sidebar">
        <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>🍱</span>
            <div>
              <div style={{ color: '#E8A838', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>Kedai</div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>MangLeman</div>
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Internal Dashboard</div>
        </div>
        <nav style={{ flex: 1, padding: '0.75rem 0' }}>
          {navItems.map((item, idx) => {
            if (item.divider) return <div key={idx} style={{ margin: '8px 1.25rem', borderTop: '1px solid rgba(255,255,255,0.1)' }} />
            const active = location.pathname === item.path
            return (
              <button key={item.path} onClick={() => { navigate(item.path); setSidebarOpen(false) }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 1.25rem', background: active ? 'rgba(232,168,56,0.2)' : item.highlight ? 'rgba(255,255,255,0.05)' : 'transparent', border: 'none', borderLeft: active ? '3px solid #E8A838' : item.highlight ? '3px solid rgba(232,168,56,0.4)' : '3px solid transparent', color: active ? '#E8A838' : item.highlight ? '#E8C878' : 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
                {item.highlight && !active && <span style={{ marginLeft: 'auto', fontSize: 9, background: '#E8A838', color: '#1A2E0A', borderRadius: 4, padding: '2px 5px', fontWeight: 700 }}>NEW</span>}
              </button>
            )
          })}
        </nav>
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={() => window.open('/order', '_blank')} style={{ width: '100%', padding: '8px', background: '#E8A838', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            🔗 Buka Form Order Customer
          </button>
        </div>
      </aside>
      <div style={{ marginLeft: 240, flex: 1, display: 'flex', flexDirection: 'column' }} className="main-content">
        <header style={{ display: 'none', alignItems: 'center', gap: 12, padding: '12px 1rem', background: '#fff', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 30 }} className="mobile-header">
          <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>☰</button>
          <span style={{ fontWeight: 700, color: '#E8A838' }}>🍱 Kedai MangLeman</span>
        </header>
        <main style={{ flex: 1, padding: '1.5rem', maxWidth: 1200, width: '100%' }}>{children}</main>
      </div>
      <style>{`
        @media (max-width: 768px) {
          .sidebar { transform: translateX(-100%); }
          .main-content { margin-left: 0 !important; }
          .mobile-header { display: flex !important; }
          main { padding: 1rem !important; }
        }
      `}</style>
    </div>
  )
}
