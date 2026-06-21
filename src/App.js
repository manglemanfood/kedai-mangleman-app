import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import OrderForm from './pages/OrderForm'
import Dashboard from './pages/Dashboard'
import RekapOrder from './pages/RekapOrder'
import CRM from './pages/CRM'
import Pengeluaran from './pages/Pengeluaran'
import Stok from './pages/Stok'
import Resep from './pages/Resep'
import KalkulatorHPP from './pages/KalkulatorHPP'
import LaporanLabaRugi from './pages/LaporanLabaRugi'
import Target from './pages/Target'
import AnalisaBisnis from './pages/AnalisaBisnis'
import ManajemenMenu from './pages/ManajemenMenu'
import ImportCSV from './pages/ImportCSV'
import Bundling from './pages/Bundling'
import Login from './pages/Login'
import Layout from './components/Layout'
import './App.css'

function PrivateRoute({ children }) {
  const [session, setSession] = useState(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => listener.subscription.unsubscribe()
  }, [])
  if (session === undefined) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1A2E0A' }}>
      <div style={{ color: '#E8A838', fontSize: 18, fontWeight: 700 }}>🍱 Memuat...</div>
    </div>
  )
  return session ? children : <Navigate to="/login" replace />
}

function LoginRedirect() {
  const [session, setSession] = useState(undefined)
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setSession(data.session)) }, [])
  if (session === undefined) return null
  return session ? <Navigate to="/dashboard" replace /> : <Login />
}

export default function App() {
  return (
    <BrowserRouter>
        <Routes>
          <Route path="/order" element={<OrderForm />} />
          <Route path="/login" element={<LoginRedirect />} />
          <Route path="/" element={<Navigate to="/order" replace />} />
          <Route path="/dashboard" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
          <Route path="/rekap-order" element={<PrivateRoute><Layout><RekapOrder /></Layout></PrivateRoute>} />
          <Route path="/crm" element={<PrivateRoute><Layout><CRM /></Layout></PrivateRoute>} />
          <Route path="/pengeluaran" element={<PrivateRoute><Layout><Pengeluaran /></Layout></PrivateRoute>} />
          <Route path="/stok" element={<PrivateRoute><Layout><Stok /></Layout></PrivateRoute>} />
          <Route path="/resep" element={<PrivateRoute><Layout><Resep /></Layout></PrivateRoute>} />
          <Route path="/hpp" element={<PrivateRoute><Layout><KalkulatorHPP /></Layout></PrivateRoute>} />
          <Route path="/laporan" element={<PrivateRoute><Layout><LaporanLabaRugi /></Layout></PrivateRoute>} />
          <Route path="/target" element={<PrivateRoute><Layout><Target /></Layout></PrivateRoute>} />
          <Route path="/analisa" element={<PrivateRoute><Layout><AnalisaBisnis /></Layout></PrivateRoute>} />
          <Route path="/menu" element={<PrivateRoute><Layout><ManajemenMenu /></Layout></PrivateRoute>} />
          <Route path="/import" element={<PrivateRoute><Layout><ImportCSV /></Layout></PrivateRoute>} />
        <Route path="/bundling" element={<PrivateRoute><Layout><Bundling /></Layout></PrivateRoute>} />
        </Routes>
    </BrowserRouter>
  )
}
import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import OrderForm from './pages/OrderForm'
import Dashboard from './pages/Dashboard'
import RekapOrder from './pages/RekapOrder'
import CRM from './pages/CRM'
import Pengeluaran from './pages/Pengeluaran'
import Stok from './pages/Stok'
import Resep from './pages/Resep'
import KalkulatorHPP from './pages/KalkulatorHPP'
import LaporanLabaRugi from './pages/LaporanLabaRugi'
import Target from './pages/Target'
import AnalisaBisnis from './pages/AnalisaBisnis'
import ManajemenMenu from './pages/ManajemenMenu'
import ImportCSV from './pages/ImportCSV'
import Login from './pages/Login'
import Layout from './components/Layout'
import './App.css'

function PrivateRoute({ children }) {
  const [session, setSession] = useState(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => listener.subscription.unsubscribe()
  }, [])
  if (session === undefined) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1A2E0A' }}>
      <div style={{ color: '#E8A838', fontSize: 18, fontWeight: 700 }}>🍱 Memuat...</div>
    </div>
  )
  return session ? children : <Navigate to="/login" replace />
}

function LoginRedirect() {
  const [session, setSession] = useState(undefined)
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setSession(data.session)) }, [])
  if (session === undefined) return null
  return session ? <Navigate to="/dashboard" replace /> : <Login />
}

export default function App() {
  return (
    <BrowserRouter>
        <Routes>
          <Route path="/order" element={<OrderForm />} />
          <Route path="/login" element={<LoginRedirect />} />
          <Route path="/" element={<Navigate to="/order" replace />} />
          <Route path="/dashboard" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
          <Route path="/rekap-order" element={<PrivateRoute><Layout><RekapOrder /></Layout></PrivateRoute>} />
          <Route path="/crm" element={<PrivateRoute><Layout><CRM /></Layout></PrivateRoute>} />
          <Route path="/pengeluaran" element={<PrivateRoute><Layout><Pengeluaran /></Layout></PrivateRoute>} />
          <Route path="/stok" element={<PrivateRoute><Layout><Stok /></Layout></PrivateRoute>} />
          <Route path="/resep" element={<PrivateRoute><Layout><Resep /></Layout></PrivateRoute>} />
          <Route path="/hpp" element={<PrivateRoute><Layout><KalkulatorHPP /></Layout></PrivateRoute>} />
          <Route path="/laporan" element={<PrivateRoute><Layout><LaporanLabaRugi /></Layout></PrivateRoute>} />
          <Route path="/target" element={<PrivateRoute><Layout><Target /></Layout></PrivateRoute>} />
          <Route path="/analisa" element={<PrivateRoute><Layout><AnalisaBisnis /></Layout></PrivateRoute>} />
          <Route path="/menu" element={<PrivateRoute><Layout><ManajemenMenu /></Layout></PrivateRoute>} />
          <Route path="/import" element={<PrivateRoute><Layout><ImportCSV /></Layout></PrivateRoute>} />
        </Routes>
    </BrowserRouter>
  )
}
