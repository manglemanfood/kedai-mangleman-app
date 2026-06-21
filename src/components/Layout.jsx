import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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

  const logout = async () => {
    if (!window.confirm('Yakin mau keluar?')) return
    await supabase.auth.signOut()
    navigate('/login')
  }

  const goTo = (path) => {
    navigate(path)
    setSidebarOpen(false)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 998,
          }}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        width: 240,
        background: '#1A2E0A',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0, bottom: 0, left: 0,
        zIndex: 999,
        overflowY: 'auto',
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s ease',
      }}
        className="sidebar-desktop"
      >
        {/* Logo */}
        <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>🍱</span>
            <div>
              <div style={{ color: '#E8A838', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>Kedai</div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>MangLeman</div>
            </div>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Internal Dashboard</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0.5rem 0', overflowY: 'auto' }}>
          {navItems.map((item, idx) => {
            if (item.divider) return (
              <div key={idx} style={{ margin: '6px 1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }} />
            )
            const active = location.pathname === item.path
            return (
              <button key={item.path}
                onClick={() => goTo(item.path)}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 1.25rem',
                  background: active ? 'rgba(232,168,56,0.2)' : item.highlight ? 'rgba(255,255,255,0.04)' : 'transparent',
                  border: 'none',
                  borderLeft: active ? '3px solid #E8A838' : item.highlight ? '3px solid rgba(232,168,56,0.3)' : '3px solid transparent',
                  color: active ? '#E8A838' : item.highlight ? '#E8C878' : 'rgba(255,255,255,0.75)',
                  fontSize: 14,
                  fontWeight: active ? 700 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                <span>{item.label}</span>
                {item.highlight && !active && (
                  <span style={{ marginLeft: 'auto', fontSize: 9, background: '#E8A838', color: '#1A2E0A', borderRadius: 4, padding: '2px 5px', fontWeight: 700 }}>
                    NEW
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid rgba(255,255,255,0.1)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={() => { window.open('/order', '_blank'); setSidebarOpen(false) }}
            style={{ width: '100%', padding: '8px', background: '#E8A838', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            🔗 Buka Form Order Customer
          </button>
          <button onClick={logout}
            style={{ width: '100%', padding: '7px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
            🚪 Keluar
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
        className="main-wrapper">

        {/* Top bar — selalu tampil */}
        <header style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 1rem',
          height: 56,
          background: '#1A2E0A',
          position: 'sticky', top: 0, zIndex: 100,
          flexShrink: 0,
        }}>
          {/* Hamburger */}
          <button
            onClick={() => setSidebarOpen(s => !s)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#fff', fontSize: 22, padding: '4px 6px',
              lineHeight: 1, flexShrink: 0,
            }}>
            {sidebarOpen ? '✕' : '☰'}
          </button>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <span style={{ fontSize: 20 }}>🍱</span>
            <span style={{ color: '#E8A838', fontWeight: 700, fontSize: 15 }}>Kedai MangLeman</span>
          </div>

          {/* Halaman aktif label */}
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            {navItems.find(n => n.path === location.pathname)?.label || ''}
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: '1.25rem', overflowX: 'hidden' }}>
          {children}
        </main>
      </div>

      <style>{`
        /* Desktop: sidebar selalu tampil, push content */
        @media (min-width: 769px) {
          .sidebar-desktop {
            transform: translateX(0) !important;
          }
          .main-wrapper {
            margin-left: 240px;
          }
        }

        /* Mobile: sidebar slide dari kiri */
        @media (max-width: 768px) {
          .main-wrapper {
            margin-left: 0 !important;
          }
          main {
            padding: 1rem !important;
          }
        }

        /* Smooth scrollbar sidebar */
        .sidebar-desktop::-webkit-scrollbar { width: 4px; }
        .sidebar-desktop::-webkit-scrollbar-track { background: transparent; }
        .sidebar-desktop::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
      `}</style>
    </div>
  )
}
