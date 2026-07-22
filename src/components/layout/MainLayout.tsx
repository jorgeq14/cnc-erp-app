import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Package, Settings, Calendar, Wrench, FileText, BarChart2, LogOut, Menu, ClipboardList, Search, DollarSign, Receipt } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getCurrentUser, logout } from '../../lib/auth';
import { logActivity } from '../../lib/logger';
import { GlobalSearch } from '../ui/GlobalSearch';
import { NotificationBell } from '../ui/NotificationBell';
import './MainLayout.css';

const pageTitles: Record<string, string> = {
  '/dashboard':     'Panel de Control',
  '/proformas':     'Proformas y Cotizaciones',
  '/agenda':        'Agenda de Visitas',
  '/servicios':     'Servicios e Historial',
  '/inventario':    'Inventario y Productos',
  '/clientes':      'Directorio de Clientes',
  '/ventas':        'Seguimiento de Ventas',
  '/facturas':      'Facturación Electrónica',
  '/reportes':      'Reportes de Actividad',
  '/ordenes-trabajo': 'Órdenes de Trabajo',
  '/configuracion': 'Configuración',
};

interface MainLayoutProps {
  onLogout: () => void;
}

const MainLayout = ({ onLogout }: MainLayoutProps) => {
  const location = useLocation();
  const user = getCurrentUser();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const pageTitle = Object.entries(pageTitles).find(([path]) => location.pathname.startsWith(path))?.[1] || 'ZIGMA ERP';

  // Atajo Ctrl+K para búsqueda global
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Cerrar menú al cambiar de página en móvil
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const handleLogout = async () => {
    await logActivity('LOGOUT', `${user?.name} cerró sesión.`);
    logout();
    onLogout();
  };

  return (
    <div className={`layout-container ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
      {/* Overlay para cerrar al hacer clic fuera en móvil */}
      {isMobileMenuOpen && <div className="sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)} />}
      
      <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="logo-container">
          <img src="/zigma-logo.png" alt="ZIGMA" style={{ height: '42px', objectFit: 'contain' }} />
          <div className="logo-text">
            <h2>ZIGMA</h2>
            <span>LASER CNC</span>
          </div>
        </div>
        
        <nav className="nav-menu">
          <NavLink to="/dashboard"     className={({isActive}) => isActive ? "nav-item active" : "nav-item"}><LayoutDashboard size={20} /> Dashboard</NavLink>
          <NavLink to="/proformas"     className={({isActive}) => isActive ? "nav-item active" : "nav-item"}><FileText size={20} /> Proformas</NavLink>
          <NavLink to="/agenda"        className={({isActive}) => isActive ? "nav-item active" : "nav-item"}><Calendar size={20} /> Agenda</NavLink>
          <NavLink to="/servicios"     className={({isActive}) => isActive ? "nav-item active" : "nav-item"}><Wrench size={20} /> Servicios</NavLink>
          <NavLink to="/inventario"    className={({isActive}) => isActive ? "nav-item active" : "nav-item"}><Package size={20} /> Inventario</NavLink>
          <NavLink to="/ventas"        className={({isActive}) => isActive ? "nav-item active" : "nav-item"}><DollarSign size={20} /> Ventas</NavLink>
          <NavLink to="/facturas"      className={({isActive}) => isActive ? "nav-item active" : "nav-item"}><Receipt size={20} /> Facturas</NavLink>
          <NavLink to="/clientes"      className={({isActive}) => isActive ? "nav-item active" : "nav-item"}><Users size={20} /> Clientes</NavLink>
          <NavLink to="/reportes"      className={({isActive}) => isActive ? "nav-item active" : "nav-item"}><BarChart2 size={20} /> Reportes</NavLink>
          <NavLink to="/ordenes-trabajo" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}><ClipboardList size={20} /> Órdenes</NavLink>
          <NavLink to="/configuracion" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}><Settings size={20} /> Configuración</NavLink>
        </nav>

        {/* User info + Logout */}
        <div style={{ marginTop: 'auto', padding: '1rem', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
              background: user?.id === 'jorge' ? 'rgba(255,128,0,0.25)' : 'rgba(59,130,246,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: '700', fontSize: '0.75rem',
              color: user?.id === 'jorge' ? 'var(--color-primary)' : '#3b82f6',
            }}>
              {user?.avatar}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <p style={{ fontWeight: '600', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</p>
              <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              padding: '0.5rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '8px', color: '#ef4444', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '600',
            }}
          >
            <LogOut size={14} /> Cerrar Sesión
          </button>
        </div>
      </aside>
      
      <main className="main-content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu size={24} />
            </button>
            <h2>{pageTitle}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Botón búsqueda global */}
            <button
              onClick={() => setIsSearchOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 14px', borderRadius: '20px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)', cursor: 'pointer',
                fontSize: '0.82rem', transition: 'all 0.2s',
              }}
              title="Búsqueda global (Ctrl+K)"
            >
              <Search size={15} />
              <span className="desktop-only">Buscar...</span>
              <kbd style={{ padding: '1px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--color-border)', fontSize: '0.7rem' }} className="desktop-only">Ctrl K</kbd>
            </button>
            
            <NotificationBell />

            <div className="user-profile">
              <span style={{ fontSize: '0.875rem' }}>{user?.name}</span>
              <div className="avatar" style={{ background: user?.id === 'jorge' ? 'var(--color-primary)' : '#3b82f6', color: '#fff', fontSize: '0.7rem', fontWeight: '700' }}>
                {user?.avatar}
              </div>
            </div>
          </div>
        </header>
        <div className="content-area">
          <Outlet />
        </div>
      </main>

      {/* Búsqueda Global */}
      <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
};

export default MainLayout;
