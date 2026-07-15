import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  XCircle,
  Loader2,
  FileText,
  User,
  Calendar,
  ChevronDown,
  ChevronUp,
  Edit3,
  Trash2,
  Eye
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { notifyAllAdmins } from '../lib/notifications';
import type { WorkOrder, OrderStatus, Priority } from '../types';

const STATUS_TABS: { label: string; value: OrderStatus | 'Todas'; color: string }[] = [
  { label: '📋 Todas',         value: 'Todas',          color: '#ffffff' },
  { label: '⏳ Pendiente',     value: 'Pendiente',       color: '#f59e0b' },
  { label: '✏️ En Diseño',     value: 'En Diseño',       color: '#3b82f6' },
  { label: '⚙️ En Producción', value: 'En Producción',   color: '#6366f1' },
  { label: '🔩 Corte CNC',     value: 'Corte CNC',       color: '#a855f7' },
  { label: '🔍 Inspección',    value: 'Inspección',      color: '#f97316' },
  { label: '✅ Terminado',     value: 'Terminado',       color: '#22c55e' },
  { label: '🚀 Entregado',     value: 'Entregado',       color: '#6b7280' },
];

export default function WorkOrders() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'Todas'>('Todas');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedMobile, setExpandedMobile] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    ot_number: '',
    customer_id: '',
    customer_name: '',
    priority: 'Media' as Priority,
    status: 'Pendiente' as OrderStatus,
    items: [{ description: '', material: '', quantity: 1 }],
    start_date: new Date().toISOString().split('T')[0],
    deadline: '',
    assigned_to: '',
    notes: '',
    files: []
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const fetchWorkOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('work_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkOrders(data || []);
    } catch (err) {
      console.error('Error fetching work orders:', err);
      setError('Error al cargar las órdenes de trabajo');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);

      // Generar número de OT automáticamente
      const lastOrder = await supabase
        .from('work_orders')
        .select('ot_number')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextNumber = 1;
      if (lastOrder.data?.ot_number) {
        const lastNum = parseInt(lastOrder.data.ot_number.split('-')[1]);
        nextNumber = lastNum + 1;
      }
      const ot_number = `OT-${String(nextNumber).padStart(3, '0')}`;

      const { data, error } = await supabase
        .from('work_orders')
        .insert([{
          ot_number,
          customer_id: formData.customer_id || null,
          customer_name: formData.customer_name,
          priority: formData.priority,
          status: formData.status,
          items: formData.items,
          start_date: formData.start_date,
          deadline: formData.deadline,
          assigned_to: formData.assigned_to,
          notes: formData.notes,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      setWorkOrders(prev => [data, ...prev]);
      
      await notifyAllAdmins(
        '📋 Nueva Orden de Trabajo',
        `Se ha generado la ${ot_number} para ${formData.customer_name}. Prioridad: ${formData.priority}`,
        'info',
        '/ordenes-trabajo'
      );

      setShowCreateModal(false);
      resetForm();
    } catch (err) {
      console.error('Error creating work order:', err);
      setError('Error al crear la orden de trabajo');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      ot_number: '',
      customer_id: '',
      customer_name: '',
      priority: 'Media',
      status: 'Pendiente',
      items: [{ description: '', material: '', quantity: 1 }],
      start_date: new Date().toISOString().split('T')[0],
      deadline: '',
      assigned_to: '',
      notes: '',
      files: []
    });
  };

  const filteredOrders = workOrders.filter(order => {
    const matchesSearch = 
      order.ot_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'Todas' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: OrderStatus) => {
    const colors: Record<OrderStatus, string> = {
      'Pendiente': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'En Diseño': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'En Producción': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      'Corte CNC': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'Inspección': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'Terminado': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'Entregado': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityIcon = (priority: Priority) => {
    switch (priority) {
      case 'Urgente': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'Alta': return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'Media': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'Baja': return <Clock className="w-4 h-4 text-green-500" />;
    }
  };

  const getDaysRemaining = (deadline: string) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '800', letterSpacing: '-0.02em' }}>
            📋 Órdenes de Trabajo
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', marginTop: '4px' }}>
            Gestiona la producción CNC del taller — seguimiento en tiempo real
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowCreateModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.65rem 1.4rem' }}
        >
          <Plus size={18} />
          Nueva OT
        </button>
      </div>

      {/* Filters */}
      <div className="glass-panel mb-6" style={{ padding: '1rem 1.25rem' }}>
        {/* Barra de búsqueda */}
        <div className="search-bar" style={{ maxWidth: '400px', marginBottom: '1rem' }}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por OT o cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {/* Tabs de estado */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {STATUS_TABS.map(tab => {
            const count = tab.value === 'Todas'
              ? workOrders.length
              : workOrders.filter(o => o.status === tab.value).length;
            const isActive = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                style={{
                  padding: '5px 13px',
                  borderRadius: '20px',
                  border: `1.5px solid ${isActive ? tab.color : 'var(--color-border)'}`,
                  background: isActive ? `${tab.color}22` : 'transparent',
                  color: isActive ? tab.color : 'var(--color-text-muted)',
                  fontWeight: isActive ? '700' : '400',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
                <span style={{
                  background: isActive ? tab.color : 'rgba(255,255,255,0.08)',
                  color: isActive ? '#000' : 'var(--color-text-muted)',
                  borderRadius: '10px',
                  padding: '1px 7px',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  minWidth: '20px',
                  textAlign: 'center',
                }}>
                  {count}
                </span>
              </button>
            );
          })}
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            {filteredOrders.length} resultado{filteredOrders.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="glass-panel p-4 mb-6 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <XCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <div className="data-table">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">OT</th>
                    <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">Cliente</th>
                    <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">Prioridad</th>
                    <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">Estado</th>
                    <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">Asignado a</th>
                    <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-300">Vencimiento</th>
                    <th className="text-right p-4 font-semibold text-gray-700 dark:text-gray-300">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="p-4">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {order.ot_number}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700 dark:text-gray-300">{order.customer_name}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          {getPriorityIcon(order.priority)}
                          <span className="text-sm text-gray-600 dark:text-gray-400">{order.priority}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="p-4 text-gray-700 dark:text-gray-300">{order.assigned_to}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className={`text-sm ${
                            getDaysRemaining(order.deadline) < 3 
                              ? 'text-red-500 font-medium' 
                              : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            {new Date(order.deadline).toLocaleDateString()}
                            {getDaysRemaining(order.deadline) < 0 && ' (Vencida)'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {/* Implementar ver detalle */}}
                            className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {/* Implementar edición */}}
                            className="p-2 text-gray-400 hover:text-green-500 transition-colors"
                            title="Editar"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredOrders.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No se encontraron órdenes de trabajo</p>
                  <p className="text-sm mt-2">Crea una nueva orden para comenzar</p>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {filteredOrders.map((order) => (
              <div key={order.id} className="glass-panel p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{order.ot_number}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{order.customer_name}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                    {order.status}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                  <div className="flex items-center gap-1">
                    {getPriorityIcon(order.priority)}
                    <span>{order.priority}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    <span>{order.assigned_to}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-gray-500">
                    <Calendar className="w-4 h-4" />
                    <span>Vence: {new Date(order.deadline).toLocaleDateString()}</span>
                  </div>
                  
                  <button
                    onClick={() => setExpandedMobile(expandedMobile === order.id ? null : order.id)}
                    className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                  >
                    {expandedMobile === order.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>

                {expandedMobile === order.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Items</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {order.items.reduce((acc, item) => acc + item.quantity, 0)} piezas
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Inicio</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {new Date(order.start_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    {order.notes && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        {order.notes}
                      </p>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => {/* Implementar ver detalle */}}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm 
                                 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 
                                 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        Ver detalle
                      </button>
                      <button
                        onClick={() => {/* Implementar edición */}}
                        className="flex items-center justify-center px-3 py-2 text-sm 
                                 bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 
                                 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 50, padding: '1rem'
        }}>
          <div className="glass-panel" style={{
            width: '100%', maxWidth: '680px', maxHeight: '90vh',
            overflowY: 'auto', padding: '0'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.5rem 2rem',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'rgba(255,128,0,0.05)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: 'rgba(255,128,0,0.15)', border: '1px solid rgba(255,128,0,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Plus size={20} color="var(--color-primary)" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0 }}>Nueva Orden de Trabajo</h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>Completa los datos para crear la OT</p>
                </div>
              </div>
              <button className="btn-icon" onClick={() => { setShowCreateModal(false); resetForm(); }}>
                <XCircle size={22} color="var(--color-danger)" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} style={{ padding: '1.75rem 2rem' }}>
              {/* Sección 1: Datos principales */}
              <div style={{
                padding: '1rem', marginBottom: '1.25rem',
                border: '1px solid var(--color-border)', borderRadius: '10px',
                borderLeft: '3px solid var(--color-primary)'
              }}>
                <p style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: 'var(--color-primary)', marginBottom: '1rem' }}>
                  📋 Información General
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Cliente *</label>
                    <input type="text" required className="form-control"
                      value={formData.customer_name}
                      onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                      placeholder="Nombre del cliente o empresa"
                    />
                  </div>
                  <div className="form-group">
                    <label>Prioridad</label>
                    <select className="form-control"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as Priority })}
                    >
                      <option value="Baja">🟢 Baja</option>
                      <option value="Media">🟡 Media</option>
                      <option value="Alta">🟠 Alta</option>
                      <option value="Urgente">🔴 Urgente</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Asignado a</label>
                    <input type="text" className="form-control"
                      value={formData.assigned_to}
                      onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                      placeholder="Nombre del operario"
                    />
                  </div>
                  <div className="form-group">
                    <label>Fecha de inicio</label>
                    <input type="date" className="form-control"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Fecha límite *</label>
                    <input type="date" required className="form-control"
                      value={formData.deadline}
                      onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Piezas */}
              <div style={{
                padding: '1rem', marginBottom: '1.25rem',
                border: '1px solid var(--color-border)', borderRadius: '10px',
                borderLeft: '3px solid #a855f7'
              }}>
                <p style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: '#a855f7', marginBottom: '1rem' }}>
                  🔩 Piezas a Fabricar
                </p>
                {formData.items.map((item, index) => (
                  <div key={index} style={{
                    display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr auto',
                    gap: '8px', marginBottom: '8px', alignItems: 'center'
                  }}>
                    <input type="text" className="form-control" placeholder="Descripción de la pieza"
                      value={item.description}
                      onChange={(e) => {
                        const newItems = [...formData.items];
                        newItems[index].description = e.target.value;
                        setFormData({ ...formData, items: newItems });
                      }}
                    />
                    <input type="text" className="form-control" placeholder="Material"
                      value={item.material}
                      onChange={(e) => {
                        const newItems = [...formData.items];
                        newItems[index].material = e.target.value;
                        setFormData({ ...formData, items: newItems });
                      }}
                    />
                    <input type="number" min="1" className="form-control" placeholder="Cant."
                      value={item.quantity}
                      onChange={(e) => {
                        const newItems = [...formData.items];
                        newItems[index].quantity = parseInt(e.target.value) || 1;
                        setFormData({ ...formData, items: newItems });
                      }}
                    />
                    {formData.items.length > 1 && (
                      <button type="button" className="btn-icon"
                        onClick={() => setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) })}>
                        <Trash2 size={16} color="var(--color-danger)" />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setFormData({
                  ...formData,
                  items: [...formData.items, { description: '', material: '', quantity: 1 }]
                })} style={{
                  background: 'rgba(168,85,247,0.1)', border: '1px dashed #a855f7',
                  color: '#a855f7', borderRadius: '8px', padding: '6px 16px',
                  fontSize: '0.82rem', cursor: 'pointer', marginTop: '4px', width: '100%'
                }}>
                  + Agregar otra pieza
                </button>
              </div>

              {/* Sección 3: Notas */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>📝 Notas e instrucciones especiales</label>
                <textarea className="form-control" rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Instrucciones adicionales, tolerancias, acabados requeridos..."
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Botones */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end',
                paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
                <button type="button" className="btn-secondary"
                  onClick={() => { setShowCreateModal(false); resetForm(); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <XCircle size={16} /> Cancelar
                </button>
                <button type="submit" disabled={submitting} className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '130px', justifyContent: 'center' }}>
                  {submitting ? (
                    <><Loader2 size={16} className="animate-spin" /> Creando...</>
                  ) : (
                    <><CheckCircle2 size={16} /> Crear Orden</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
