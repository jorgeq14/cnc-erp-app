import { useState, useEffect } from 'react';
import './Customers.css';
import { Settings, Building2, CreditCard, Palette, Save, CheckCircle, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';

const THEMES = [
  { id: 'orange', label: 'Naranja Industrial', primary: '#ff8000', bg: '#0a0a0a', surface: '#171717' },
  { id: 'blue',   label: 'Azul Tecnológico',  primary: '#3b82f6', bg: '#0a0f1e', surface: '#111827' },
  { id: 'green',  label: 'Verde Neón',         primary: '#22c55e', bg: '#051a0a', surface: '#0f2d18' },
  { id: 'purple', label: 'Morado Premium',     primary: '#a855f7', bg: '#0d0a1e', surface: '#1a1030' },
  { id: 'red',    label: 'Rojo Acero',         primary: '#ef4444', bg: '#0f0a0a', surface: '#1f1010' },
  { id: 'cyan',   label: 'Cian Futurista',     primary: '#06b6d4', bg: '#020d12', surface: '#0c1f26' },
  { id: 'light',  label: 'Modo Claro',         primary: '#ff8000', bg: '#f5f5f5', surface: '#ffffff' },
];

const DEFAULT_CONFIG = {
  company_name: 'ZIGMA Láser CNC & Soluciones',
  ruc: '10480834594',
  address: 'Misti 1148, La Victoria',
  phone: '970 275 281',
  bcp_soles_account: '191-33375921-0-50',
  bcp_soles_cci: '002-191-133375921050-57',
  bcp_usd_account: '193-00179350-1-60',
  bcp_usd_cci: '002-193-100179350160-19',
  bank_holder: 'Isamar Silvestre',
  yape: '907 174 716',
  sunat_api_url: 'https://api.migo.pe/v1/test',
  sunat_api_token: '',
  nombre_comercial: 'ZIGMA LASER CNC',
};

const applyTheme = (theme: typeof THEMES[0]) => {
  const root = document.documentElement;
  root.style.setProperty('--color-primary', theme.primary);
  root.style.setProperty('--color-primary-hover', theme.primary + 'cc');
  root.style.setProperty('--color-background', theme.bg);
  root.style.setProperty('--color-surface', theme.surface);
  // For light mode, use dark text
  const isLight = theme.id === 'light';
  root.style.setProperty('--color-text', isLight ? '#111111' : '#ffffff');
  root.style.setProperty('--color-text-muted', isLight ? '#555555' : '#a3a3a3');
  root.style.setProperty('--color-border', isLight ? '#dddddd' : '#333333');
  root.style.setProperty('--color-surface-hover', isLight ? '#eeeeee' : '#262626');
};

const Config = () => {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [activeTheme, setActiveTheme] = useState('orange');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    const { data } = await supabase.from('settings').select('*').eq('id', 1).single();
    if (data) {
      setConfig(data);
      if (data.theme) {
        setActiveTheme(data.theme);
        const theme = THEMES.find(t => t.id === data.theme);
        if (theme) applyTheme(theme);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    const { error } = await supabase.from('settings').upsert({ id: 1, ...config, theme: activeTheme });
    if (!error) {
      localStorage.setItem('zigma_config', JSON.stringify({ ...config, theme: activeTheme }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  const handleThemeChange = async (theme: typeof THEMES[0]) => {
    setActiveTheme(theme.id);
    applyTheme(theme);
    const newConfig = { ...config, theme: theme.id };
    localStorage.setItem('zigma_config', JSON.stringify(newConfig));
    await supabase.from('settings').upsert({ id: 1, ...newConfig });
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Configuración del Sistema</h2>
          <p>Personaliza los datos de tu empresa, cuentas bancarias y apariencia.</p>
        </div>
        <button className="btn-primary" onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {saved ? <CheckCircle size={18} /> : <Save size={18} />}
          {saved ? '¡Guardado!' : 'Guardar Cambios'}
        </button>
      </div>

      {/* Tema de colores */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
          <Palette size={20} color="var(--color-primary)" />
          <h3>Tema de Color</h3>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          {THEMES.map(theme => (
            <button
              key={theme.id}
              onClick={() => handleThemeChange(theme)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 16px',
                borderRadius: '8px',
                border: activeTheme === theme.id
                  ? `2px solid ${theme.primary}`
                  : '2px solid var(--color-border)',
                background: activeTheme === theme.id
                  ? `${theme.primary}22`
                  : 'var(--color-surface)',
                cursor: 'pointer',
                color: 'var(--color-text)',
                fontWeight: activeTheme === theme.id ? '600' : '400',
                transition: 'all 0.2s',
              }}
            >
              <span style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: theme.primary,
                display: 'inline-block',
                flexShrink: 0,
                boxShadow: `0 0 8px ${theme.primary}88`
              }} />
              {theme.label}
              {activeTheme === theme.id && (
                <CheckCircle size={16} color={theme.primary} />
              )}
            </button>
          ))}
        </div>
        <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          * El tema seleccionado se aplica inmediatamente y se recuerda al reabrir la app.
        </p>
      </div>

      {/* Datos de la empresa */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
          <Building2 size={20} color="var(--color-primary)" />
          <h3>Datos de la Empresa</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label>Razón Social / Nombre</label>
            <input type="text" name="company_name" className="form-control" value={config.company_name} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>RUC</label>
            <input type="text" name="ruc" className="form-control" value={config.ruc} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Dirección</label>
            <input type="text" name="address" className="form-control" value={config.address} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Teléfono</label>
            <input type="text" name="phone" className="form-control" value={config.phone} onChange={handleChange} />
          </div>
        </div>
        <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          * Estos datos se reflejan automáticamente en todas las proformas generadas.
        </p>
      </div>

      {/* Cuentas bancarias */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
          <CreditCard size={20} color="var(--color-primary)" />
          <h3>Cuentas Bancarias</h3>
        </div>
        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label>Nombre del Titular</label>
          <input type="text" name="bank_holder" className="form-control" value={config.bank_holder} onChange={handleChange} style={{ maxWidth: '400px' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          <div style={{ padding: '1.25rem', border: '1px solid var(--color-border)', borderRadius: '8px', borderLeft: '3px solid var(--color-primary)' }}>
            <p style={{ fontWeight: '600', marginBottom: '1rem' }}>🇵🇪 BCP — Soles (S/)</p>
            <div className="form-group">
              <label>Número de Cuenta</label>
              <input type="text" name="bcp_soles_account" className="form-control" value={config.bcp_soles_account} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Número Interbancario (CCI)</label>
              <input type="text" name="bcp_soles_cci" className="form-control" value={config.bcp_soles_cci} onChange={handleChange} />
            </div>
          </div>
          <div style={{ padding: '1.25rem', border: '1px solid var(--color-border)', borderRadius: '8px', borderLeft: '3px solid #22c55e' }}>
            <p style={{ fontWeight: '600', marginBottom: '1rem' }}>🇺🇸 BCP — Dólares ($)</p>
            <div className="form-group">
              <label>Número de Cuenta</label>
              <input type="text" name="bcp_usd_account" className="form-control" value={config.bcp_usd_account} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Número Interbancario (CCI)</label>
              <input type="text" name="bcp_usd_cci" className="form-control" value={config.bcp_usd_cci} onChange={handleChange} />
            </div>
          </div>
        </div>
        <div style={{ marginTop: '1.5rem', padding: '1.25rem', border: '1px solid var(--color-border)', borderRadius: '8px', borderLeft: '3px solid #f7d834', backgroundColor: 'rgba(247, 216, 52, 0.05)', maxWidth: '400px' }}>
          <p style={{ fontWeight: '600', marginBottom: '1rem', color: '#f7d834' }}>📱 Yape / Plin</p>
          <div className="form-group">
            <label>Número de Teléfono</label>
            <input type="text" name="yape" className="form-control" value={config.yape} onChange={handleChange} />
          </div>
        </div>
      </div>

      {/* Facturación Electrónica */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
          <FileText size={20} color="var(--color-primary)" />
          <h3>Facturación Electrónica (SUNAT)</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label>API URL (Migo/Nubefact)</label>
            <input type="text" name="sunat_api_url" className="form-control" value={config.sunat_api_url} onChange={handleChange} placeholder="https://api.migo.pe/v1/..." />
          </div>
          <div className="form-group">
            <label>API Token (Llave Secreta)</label>
            <input type="password" name="sunat_api_token" className="form-control" value={config.sunat_api_token} onChange={handleChange} placeholder="Tu token aquí..." />
          </div>
          <div className="form-group">
            <label>Nombre Comercial</label>
            <input type="text" name="nombre_comercial" className="form-control" value={config.nombre_comercial} onChange={handleChange} />
          </div>
        </div>
        <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          * El modo Demo está activo por defecto. Usa la URL de pruebas para no generar facturas reales.
        </p>
      </div>

      {/* Info sistema */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
          <Settings size={20} color="var(--color-primary)" />
          <h3>Información del Sistema</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          <div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>VERSIÓN</p>
            <p style={{ fontWeight: '600' }}>ZIGMA ERP v1.0</p>
          </div>
          <div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>BASE DE DATOS</p>
            <p style={{ fontWeight: '600', color: 'var(--color-success)' }}>● Supabase Conectado</p>
          </div>
          <div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>TEMA ACTIVO</p>
            <p style={{ fontWeight: '600' }}>{THEMES.find(t => t.id === activeTheme)?.label}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Config;
