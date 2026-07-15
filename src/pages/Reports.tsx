import { useEffect, useState } from 'react';
import './Customers.css';
import { supabase } from '../lib/supabase';
import { Search, Clock, FileText, Calendar, Package, Users, LogIn } from 'lucide-react';

import type { LogEntry } from '../types';


const ACTION_ICONS: Record<string, { icon: any; color: string }> = {
  LOGIN:               { icon: LogIn,    color: '#22c55e' },
  LOGOUT:              { icon: LogIn,    color: '#ef4444' },
  CLIENTE_CREADO:      { icon: Users,    color: '#3b82f6' },
  CLIENTE_EDITADO:     { icon: Users,    color: '#f59e0b' },
  PROFORMA_CREADA:     { icon: FileText, color: '#ff8000' },
  PDF_GENERADO:        { icon: FileText, color: '#a855f7' },
  WHATSAPP_ENVIADO:    { icon: FileText, color: '#25D366' },
  CITA_AGENDADA:       { icon: Calendar, color: '#06b6d4' },
  SERVICIO_ACTUALIZADO:{ icon: Clock,    color: '#f59e0b' },
  PRODUCTO_CREADO:     { icon: Package,  color: '#3b82f6' },
  PRODUCTO_EDITADO:    { icon: Package,  color: '#f59e0b' },
};

const Reports = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUser, setFilterUser] = useState('Todos');
  const [filterAction, setFilterAction] = useState('Todos');

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (!error && data) setLogs(data);
    setLoading(false);
  };

  const filtered = logs.filter(log => {
    const matchUser = filterUser === 'Todos' || log.user_id === filterUser;
    const matchAction = filterAction === 'Todos' || log.action.startsWith(filterAction);
    const matchSearch = log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        log.user_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchUser && matchAction && matchSearch;
  });

  // Stats
  const todayStr = new Date().toDateString();
  const todayLogs = logs.filter(l => new Date(l.created_at).toDateString() === todayStr);
  const jorgeCount = todayLogs.filter(l => l.user_id === 'jorge').length;
  const isamarCount = todayLogs.filter(l => l.user_id === 'isamar').length;
  const totalToday = todayLogs.length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Reportes de Actividad</h2>
          <p>Historial completo de acciones realizadas por cada socio en el sistema.</p>
        </div>
        <button className="btn-secondary" onClick={fetchLogs} style={{ padding: '0.5rem 1rem' }}>
          ↻ Actualizar
        </button>
      </div>

      {/* Stats del día */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,128,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: 'var(--color-primary)', flexShrink: 0 }}>JQ</div>
          <div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Jorge Quispe hoy</p>
            <p style={{ fontSize: '1.5rem', fontWeight: '700' }}>{jorgeCount} <span style={{ fontSize: '0.85rem', fontWeight: '400', color: 'var(--color-text-muted)' }}>acciones</span></p>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: '#3b82f6', flexShrink: 0 }}>IS</div>
          <div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Isamar Silvestre hoy</p>
            <p style={{ fontSize: '1.5rem', fontWeight: '700' }}>{isamarCount} <span style={{ fontSize: '0.85rem', fontWeight: '400', color: 'var(--color-text-muted)' }}>acciones</span></p>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Clock size={22} color="var(--color-success)" />
          </div>
          <div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Total de acciones hoy</p>
            <p style={{ fontSize: '1.5rem', fontWeight: '700' }}>{totalToday} <span style={{ fontSize: '0.85rem', fontWeight: '400', color: 'var(--color-text-muted)' }}>registros</span></p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="glass-panel">
        <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: '200px' }}>
            <Search size={18} className="search-icon" />
            <input type="text" placeholder="Buscar en el historial..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <select className="form-control" style={{ padding: '0.5rem', width: 'auto', fontSize: '0.85rem' }} value={filterUser} onChange={e => setFilterUser(e.target.value)}>
              <option value="Todos">👥 Todos</option>
              <option value="jorge">Jorge</option>
              <option value="isamar">Isamar</option>
            </select>
            <select className="form-control" style={{ padding: '0.5rem', width: 'auto', fontSize: '0.85rem' }} value={filterAction} onChange={e => setFilterAction(e.target.value)}>
              <option value="Todos">📋 Acciones</option>
              <option value="LOGIN">Sesiones</option>
              <option value="CLIENTE">Clientes</option>
              <option value="PROFORMA">Proformas</option>
              <option value="CITA">Agenda</option>
              <option value="SERVICIO">Servicios</option>
              <option value="PRODUCTO">Inventario</option>
            </select>
          </div>
        </div>

        {/* VISTA DE ESCRITORIO (TABLA) */}
        <div className="desktop-only">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Socio</th>
                <th>Acción</th>
                <th>Descripción</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>Cargando historial...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>No hay registros que coincidan.</td></tr>
              ) : (
                filtered.map(log => {
                  const meta = ACTION_ICONS[log.action] || { icon: Clock, color: '#666' };
                  const Icon = meta.icon;
                  const dateObj = new Date(log.created_at);
                  return (
                    <tr key={log.id}>
                      <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        <div>{dateObj.toLocaleDateString('es-PE')}</div>
                        <div style={{ fontWeight: '500', color: 'var(--color-text)' }}>{dateObj.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                            background: log.user_id === 'jorge' ? 'rgba(255,128,0,0.2)' : 'rgba(59,130,246,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: '700', fontSize: '0.7rem',
                            color: log.user_id === 'jorge' ? 'var(--color-primary)' : '#3b82f6',
                          }}>
                            {log.user_id === 'jorge' ? 'JQ' : 'IS'}
                          </div>
                          <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>{log.user_name}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600',
                          background: `${meta.color}22`, color: meta.color,
                        }}>
                          <Icon size={12} /> {log.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{log.description}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* VISTA DE CELULAR (TIMELINE) */}
        <div className="mobile-only" style={{ padding: '1rem 0.5rem' }}>
          {loading ? (
            <p style={{ textAlign: 'center', padding: '2rem' }}>Cargando historial...</p>
          ) : filtered.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Sin actividad.</p>
          ) : (
            <div style={{ position: 'relative', paddingLeft: '20px' }}>
              {/* Linea vertical del timeline */}
              <div style={{ position: 'absolute', left: '7px', top: '0', bottom: '0', width: '2px', background: 'var(--color-border)', borderRadius: '1px' }}></div>
              
              {filtered.map((log) => {
                const meta = ACTION_ICONS[log.action] || { icon: Clock, color: '#666' };
                const Icon = meta.icon;
                const dateObj = new Date(log.created_at);
                
                return (
                  <div key={log.id} style={{ position: 'relative', marginBottom: '1.5rem' }}>
                    {/* Punto del timeline */}
                    <div style={{ 
                      position: 'absolute', left: '-18px', top: '4px', width: '12px', height: '12px', 
                      borderRadius: '50%', background: meta.color, border: '3px solid var(--color-surface)',
                      boxShadow: `0 0 10px ${meta.color}55`
                    }}></div>

                    <div className="glass-panel" style={{ padding: '0.875rem', marginLeft: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{
                            width: '24px', height: '24px', borderRadius: '50%',
                            background: log.user_id === 'jorge' ? 'rgba(255,128,0,0.2)' : 'rgba(59,130,246,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: '700', fontSize: '0.6rem',
                            color: log.user_id === 'jorge' ? 'var(--color-primary)' : '#3b82f6',
                          }}>
                            {log.user_id === 'jorge' ? 'JQ' : 'IS'}
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{log.user_name}</span>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                          {dateObj.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      
                      <p style={{ fontSize: '0.85rem', color: 'var(--color-text)', marginBottom: '4px', lineHeight: '1.4' }}>
                        {log.description}
                      </p>
                      
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        fontSize: '0.65rem', fontWeight: 'bold', color: meta.color,
                        textTransform: 'uppercase', letterSpacing: '0.02em'
                      }}>
                        <Icon size={10} /> {log.action.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
