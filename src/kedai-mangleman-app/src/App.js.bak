import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import Layout from './components/Layout'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* PUBLIC: Form order customer */}
        <Route path="/order" element={<OrderForm />} />
        <Route path="/" element={<Navigate to="/order" replace />} />

        {/* INTERNAL: Dashboard */}
        <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
        <Route path="/rekap-order" element={<Layout><RekapOrder /></Layout>} />
        <Route path="/crm" element={<Layout><CRM /></Layout>} />
        <Route path="/pengeluaran" element={<Layout><Pengeluaran /></Layout>} />
        <Route path="/stok" element={<Layout><Stok /></Layout>} />
        <Route path="/resep" element={<Layout><Resep /></Layout>} />
        <Route path="/hpp" element={<Layout><KalkulatorHPP /></Layout>} />
        <Route path="/laporan" element={<Layout><LaporanLabaRugi /></Layout>} />
        <Route path="/target" element={<Layout><Target /></Layout>} />
        <Route path="/analisa" element={<Layout><AnalisaBisnis /></Layout>} />
        <Route path="/menu" element={<Layout><ManajemenMenu /></Layout>} />
      </Routes>
    </BrowserRouter>
  )
}
