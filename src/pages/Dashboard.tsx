import { useEffect, useState } from 'react';
import { Users, Calendar, Wrench, FileText, AlertTriangle, Clock, ChevronRight, BarChart2, CheckCircle, AlertCircle, Download } from 'lucide-react';
import './Dashboard.css';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import type { ActivityLog, InventoryItem } from '../types';

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalClients: 0,
    pendingAppointments: 0,
    activeServices: 0,
    totalQuotes: 0,
  });
  const [recentLogs, setRecentLogs] = useState<ActivityLog[]>([]);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);

  // Export to Excel function (lazy loads xlsx)
  const exportToExcel = () => {
    import('xlsx').then(XLSX => {
      // Fetch full inventory
      supabase.from('inventory').select('*').then(res => {
        const inventory = res.data as any[] || [];
        const wb = XLSX.utils.book_new();
        const stockData = inventory.map(item => ({
          SKU: item.sku,
          Nombre: item.name,
          Categoría: item.category,
          Stock: item.stock,
          'Stock Mínimo': item.min_stock,
          Precio: item.price,
          Moneda: item.currency,
        }));
        const wsStock = XLSX.utils.json_to_sheet(stockData);
        XLSX.utils.book_append_sheet(wb, wsStock, 'Stock');

        const lowStockItems = inventory.filter(i => i.stock <= i.min_stock);
        const lowData = lowStockItems.map(item => ({
          SKU: item.sku,
          Nombre: item.name,
          Categoría: item.category,
          Stock: item.stock,
          'Stock Mínimo': item.min_stock,
          Precio: item.price,
          Moneda: item.currency,
        }));
        const wsLow = XLSX.utils.json_to_sheet(lowData);
        // Apply red fill to low stock sheet rows
        const range = XLSX.utils.decode_range(wsLow['!ref'] || 'A1');
        for (let R = range.s.r; R <= range.e.r; ++R) {
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell_address = { c: C, r: R };
            const cell_ref = XLSX.utils.encode_cell(cell_address);
            if (!wsLow[cell_ref]) continue;
            wsLow[cell_ref].s = { fill: { fgColor: { rgb: 'FFCCCC' } } };
          }
        }
        XLSX.utils.book_append_sheet(wb, wsLow, 'Stock_Bajo');
        XLSX.writeFile(wb, 'inventario.xlsx');
      }).catch(err => console.error('Error fetching inventory', err));
    }).catch(err => console.error('Error loading xlsx', err));
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [clients, appointments, services, quotes, logs, inventory, analyticsData] = await Promise.all([
          supabase.from('customers').select('id', { count: 'exact', head: true }),
          supabase.from('service_tickets').select('id', { count: 'exact', head: true }).in('status', ['Pendiente', 'Confirmado']),
          supabase.from('service_tickets').select('id', { count: 'exact', head: true }).eq('status', 'En Progreso'),
          supabase.from('quotes').select('id', { count: 'exact', head: true }),
          supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(5),
          supabase.from('inventory').select('*').lt('stock', 5).limit(3),
          supabase.rpc('get_dashboard_analytics')
        ]);

        if (clients.error || appointments.error || services.error || quotes.error) {
          throw new Error("Error obteniendo estadísticas rápidas");
        }

        setStats({
          totalClients: clients.count || 0,
          pendingAppointments: appointments.count || 0,
          activeServices: services.count || 0,
          totalQuotes: quotes.count || 0,
        });

        setRecentLogs(logs.data as ActivityLog[] || []);
        setLowStockItems(inventory.data as InventoryItem[] || []);
        setAnalytics(analyticsData.data);
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="dashboard">
      <div className="stats-grid">
        <div className="stat-card glass-panel" onClick={() => navigate('/clientes')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' }}>
            <Users size={24} />
          </div>
          <div className="stat-info">
            <h3>Total Clientes</h3>
            <p className="stat-value">{stats.totalClients}</p>
            <span className="stat-trend neutral">Ver directorio</span>
          </div>
        </div>

        <div className="stat-card glass-panel" onClick={() => navigate('/agenda')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon" style={{ background: 'rgba(6, 182, 212, 0.2)', color: '#06b6d4' }}>
            <Calendar size={24} />
          </div>
          <div className="stat-info">
            <h3>Citas Pendientes</h3>
            <p className="stat-value">{stats.pendingAppointments}</p>
            <span className="stat-trend neutral">Gestionar agenda</span>
          </div>
        </div>

        <div className="stat-card glass-panel" onClick={() => navigate('/servicios')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>
            <Wrench size={24} />
          </div>
          <div className="stat-info">
            <h3>Servicios Activos</h3>
            <p className="stat-value">{stats.activeServices}</p>
            <span className={`stat-trend ${stats.activeServices > 0 ? 'negative' : 'positive'}`}>
              {stats.activeServices > 0 ? 'En taller/campo' : 'Todo completado'}
            </span>
          </div>
        </div>

        <div className="stat-card glass-panel" onClick={() => navigate('/proformas')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon" style={{ background: 'rgba(255, 128, 0, 0.2)', color: 'var(--color-primary)' }}>
            <FileText size={24} />
          </div>
          <div className="stat-info">
            <h3>Proformas</h3>
            <p className="stat-value">{stats.totalQuotes}</p>
            <span className="stat-trend neutral">Emitidas este mes</span>
          </div>
        </div>
      </div>

      {/* Exportar Inventario a Excel */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn-secondary" onClick={exportToExcel} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Download size={16} /> Exportar Excel</button>
      </div>
      {/* SECCIÓN ANALÍTICA Y PREDICCIÓN */}
      <div className="dashboard-charts" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        
        {/* Gráfico de Ingresos */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={18} color="var(--color-primary)" /> Tendencia de Ingresos (Productos vs Servicios)
          </h3>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics?.ingresos_mensuales || []}>
                <defs>
                  <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorServ" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="mes" stroke="var(--color-text-muted)" fontSize={12} />
                <YAxis stroke="var(--color-text-muted)" fontSize={12} />
                <Tooltip 
                  contentStyle={{ background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)', borderRadius: '12px' }}
                  itemStyle={{ color: 'white' }}
                />
                <Area type="monotone" dataKey="productos" stroke="#3b82f6" fillOpacity={1} fill="url(#colorProd)" name="Productos" />
                <Area type="monotone" dataKey="servicios" stroke="#10b981" fillOpacity={1} fill="url(#colorServ)" name="Servicios" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Riesgo Financiero y Top Clientes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Card Predictiva de Morosidad */}
          <div className="glass-panel" style={{ 
            padding: '1.5rem', 
            border: (analytics?.tiempo_morosidad_promedio > 15) ? '1px solid #ef444455' : '1px solid var(--color-border)',
            background: (analytics?.tiempo_morosidad_promedio > 15) ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(0,0,0,0) 100%)' : ''
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Salud Financiera</h4>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '4px 0' }}>
                  {analytics?.tiempo_morosidad_promedio?.toFixed(1) || '0'} días
                </p>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Tiempo prom. de cobro</span>
              </div>
              <div style={{ 
                padding: '12px', borderRadius: '12px', 
                background: (analytics?.tiempo_morosidad_promedio > 15) ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                color: (analytics?.tiempo_morosidad_promedio > 15) ? '#ef4444' : '#10b981'
              }}>
                {(analytics?.tiempo_morosidad_promedio > 15) ? <AlertCircle size={24} /> : <CheckCircle size={24} />}
              </div>
            </div>
            {(analytics?.tiempo_morosidad_promedio > 15) && (
              <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '8px' }}>
                ⚠️ <strong>Riesgo de Liquidez:</strong> El tiempo de cobro supera los 15 días.
              </p>
            )}
          </div>

          {/* Gráfico Top Clientes */}
          <div className="glass-panel" style={{ padding: '1.25rem', flex: 1 }}>
            <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>Top 5 Clientes (Fidelidad)</h4>
            <div style={{ height: '180px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.top_clientes || []} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="nombre" type="category" stroke="var(--color-text-muted)" fontSize={10} width={80} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ borderRadius: '8px' }} />
                  <Bar dataKey="total_comprado" radius={[0, 4, 4, 0]}>
                    { (analytics?.top_clientes || []).map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--color-primary)' : '#3b82f6aa'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      </div>

      <div className="dashboard-content">
        {/* Registro de Actividad Reciente */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={20} color="var(--color-primary)" />
              Actividad Reciente de Socios
            </h3>
            <button onClick={() => navigate('/reportes')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '0.875rem' }}>
              Ver todo <ChevronRight size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {recentLogs.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '1rem' }}>No hay actividad registrada aún.</p>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} style={{ display: 'flex', gap: '1rem', padding: '0.75rem', borderRadius: '8px', background: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: log.user_id === 'jorge' ? '#ff800033' : '#3b82f633', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.75rem', color: log.user_id === 'jorge' ? 'var(--color-primary)' : '#3b82f6', flexShrink: 0 }}>
                    {log.user_id === 'jorge' ? 'JQ' : 'IS'}
                  </div>
                  <div>
                    <p style={{ fontSize: '0.9rem', marginBottom: '2px' }}>
                      <strong>{log.user_name}</strong> {log.description}
                    </p>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{new Date(log.created_at).toLocaleString('es-PE')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Alertas de Inventario */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem', color: '#ef4444' }}>
            <AlertTriangle size={20} />
            Stock Bajo / Crítico
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {lowStockItems.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px', color: '#22c55e' }}>
                ✅ Inventario al día
              </div>
            ) : (
              lowStockItems.map(item => (
                <div key={item.id} style={{ padding: '1rem', borderRadius: '8px', border: '1px solid #ef444433', background: '#ef444411' }}>
                  <p style={{ fontWeight: '600', fontSize: '0.875rem' }}>{item.name}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>SKU: {item.sku}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', alignItems: 'center' }}>
                    <span style={{ color: '#ef4444', fontWeight: '700', fontSize: '0.875rem' }}>{item.stock} unidades</span>
                    <button onClick={() => navigate('/inventario')} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}>Reponer</button>
                  </div>
                </div>
              ))
            )}
          </div>
          <button onClick={() => navigate('/inventario')} className="btn-secondary" style={{ width: '100%', marginTop: '1.5rem', fontSize: '0.875rem' }}>
            Ver Inventario Completo
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
