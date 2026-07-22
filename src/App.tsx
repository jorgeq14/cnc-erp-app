import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import { isAuthenticated } from './lib/auth';

// Lazy loading de páginas para optimizar la velocidad de carga (Code Splitting)
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Customers = lazy(() => import('./pages/Customers'));
const CustomerProfile = lazy(() => import('./pages/CustomerProfile'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Agenda = lazy(() => import('./pages/Agenda'));
const Quotes = lazy(() => import('./pages/Quotes'));
const Services = lazy(() => import('./pages/Services'));
const Config = lazy(() => import('./pages/Config'));
const WorkOrders = lazy(() => import('./pages/WorkOrders'));
const Sales = lazy(() => import('./pages/Sales'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Reports = lazy(() => import('./pages/Reports'));

// Pantalla de carga mientras se descargan los módulos
const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%' }}>
    <div className="spinner"></div>
  </div>
);

function App() {
 
  const [authed, setAuthed] = useState(isAuthenticated());

  useEffect(() => {
    // Sync auth state across tabs
    const handleStorage = () => setAuthed(isAuthenticated());
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  if (!authed) {
    return (
      <Suspense fallback={<div className="page-container" style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh'}}>Cargando ZIGMA...</div>}>
        <Login onLoginSuccess={() => setAuthed(true)} />
      </Suspense>
    );
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<MainLayout onLogout={() => setAuthed(false)} />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"     element={<Dashboard />} />
            <Route path="proformas"     element={<Quotes />} />
            <Route path="agenda"        element={<Agenda />} />
            <Route path="servicios"     element={<Services />} />
            <Route path="inventario"    element={<Inventory />} />
            <Route path="clientes"      element={<Customers />} />
            <Route path="clientes/:id"  element={<CustomerProfile />} />
            <Route path="reportes"      element={<Reports />} />
            <Route path="ventas"        element={<Sales />} />
            <Route path="facturas"      element={<Invoices />} />
            <Route path="ordenes-trabajo" element={<WorkOrders />} />
            <Route path="configuracion" element={<Config />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
