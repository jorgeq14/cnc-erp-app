import { useEffect, useState } from 'react';
import './Customers.css';
import { Search, PenTool, CheckCircle, Receipt, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/ui/Modal';
import { logActivity } from '../lib/logger';

import type { ServiceTicket } from '../types';


const Services = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<ServiceTicket | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    status: '',
    cost: 0,
    currency: 'PEN',
    technical_notes: '',
    scheduled_date: ''
  });

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      setLoading(true);
      // Traemos el historial (En Progreso y Completado)
      const { data, error } = await supabase
        .from('service_tickets')
        .select('*, customers(name, contact), customer_machines(machine_type, serial_number)')
        .in('status', ['En Progreso', 'Completado', 'Cancelado'])
        .order('id', { ascending: false });

      if (error) throw error;
      if (data) setTickets(data as unknown as ServiceTicket[]);
    } catch (error) {
      console.error("Error fetching services:", error);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (ticket: ServiceTicket) => {
    setEditingTicket(ticket);
    setFormData({
      status: ticket.status,
      cost: ticket.cost || 0,
      currency: ticket.currency || 'PEN',
      technical_notes: ticket.technical_notes || '',
      scheduled_date: ticket.scheduled_date || ''
    });
    setIsModalOpen(true);
  };

  const adjustDate = (days: number) => {
    if (!formData.scheduled_date) return;
    const current = new Date(formData.scheduled_date + 'T12:00:00');
    current.setDate(current.getDate() + days);
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    setFormData(prev => ({ ...prev, scheduled_date: `${yyyy}-${mm}-${dd}` }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: name === 'cost' ? parseFloat(value) || 0 : value 
    }));
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Está seguro de eliminar este registro?')) return;
    const { error } = await supabase.from('service_tickets').delete().eq('id', id);
    if (!error) {
      setTickets(tickets.filter(t => t.id !== id));
      await logActivity('SERVICIO_ELIMINADO', `Se eliminó un registro de servicio.`);
    }
  };

  const convertToQuote = async (ticket: ServiceTicket) => {
    try {
      if (!confirm(`¿Convertir el servicio ${ticket.ticket_number} en una nueva Proforma?`)) return;

      const { data: lastQuote } = await supabase.from('quotes').select('quote_number').order('id', { ascending: false }).limit(1);
      let nextNum = 1;
      if (lastQuote?.[0]?.quote_number) {
        const match = lastQuote[0].quote_number.match(/\d+/);
        if (match) nextNum = parseInt(match[0]) + 1;
      }
      const quoteNumber = `PRF-${nextNum.toString().padStart(3, '0')}`;
      
      const includeIgv = confirm("¿Desea que la proforma incluya IGV (18%)?");
      
      let subtotal = 0;
      let tax = 0;
      let total = ticket.cost;

      if (includeIgv) {
        subtotal = ticket.cost / 1.18;
        tax = ticket.cost - subtotal;
      } else {
        subtotal = ticket.cost;
        tax = 0;
      }

      const { error } = await supabase.from('quotes').insert([{
        quote_number: quoteNumber,
        customer_id: ticket.customer_id,
        currency: ticket.currency || 'PEN',
        date: new Date().toISOString(),
        items: [{
          name: `Servicio Técnico: ${ticket.service_type}`,
          description: ticket.technical_notes || ticket.issue_description,
          quantity: 1,
          price: ticket.cost // Mantenemos el precio base aquí para que el PDF haga el cálculo hacia atrás si hay tax
        }],
        subtotal: subtotal,
        tax: tax,
        total: total,
        notes: `Generado desde el Ticket de Servicio ${ticket.ticket_number}`,
        status: 'Generada'
      }]).select();

      if (error) throw error;

      await logActivity('PROFORMA_GENERADA', `Proforma ${quoteNumber} generada automáticamente desde servicio ${ticket.ticket_number}.`);
      alert(`¡Éxito! Proforma ${quoteNumber} generada.`);
      navigate('/proformas');

    } catch (error: any) {
      console.error('Error al convertir:', error);
      alert('Error al generar la proforma.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTicket) return;

    try {
      setIsSubmitting(true);
      const { error } = await supabase
        .from('service_tickets')
        .update({
          status: formData.status,
          cost: formData.cost,
          currency: formData.currency,
          technical_notes: formData.technical_notes,
          scheduled_date: formData.scheduled_date
        })
        .eq('id', editingTicket.id);

      if (error) throw error;

      await logActivity('SERVICIO_ACTUALIZADO', `Ticket ${editingTicket.ticket_number} actualizado (${formData.status}). Costo: ${formData.currency} ${formData.cost.toFixed(2)}.`);

      await fetchServices();
      setIsModalOpen(false);
    } catch (error: any) {
      console.error("Error updating ticket:", error);
      alert('Error: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTickets = tickets.filter(t => 
    t.ticket_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.customers?.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.customers?.contact || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.issue_description || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Servicios e Historial</h2>
          <p>Gestiona los trabajos en curso y el registro histórico de reparaciones.</p>
        </div>
      </div>

      <div className="glass-panel">
        <div className="table-toolbar">
          <div className="search-bar">
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Buscar por número de ticket o cliente..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* VISTA DE ESCRITORIO (TABLA) */}
        <div className="desktop-only">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Máquina / Servicio</th>
                <th>Costo Final</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{textAlign: 'center', padding: '2rem'}}>Cargando servicios...</td></tr>
              ) : filteredTickets.length === 0 ? (
                <tr><td colSpan={7} style={{textAlign: 'center', padding: '2rem'}}>No hay servicios registrados.</td></tr>
              ) : (
                filteredTickets.map((srv) => (
                  <tr key={srv.id}>
                    <td className="font-medium" style={{ color: 'var(--color-primary)' }}>{srv.ticket_number}</td>
                    <td>{new Date(srv.scheduled_date + 'T00:00:00').toLocaleDateString('es-PE')}</td>
                    <td className="font-medium">{srv.customers?.name}</td>
                    <td>
                      <div>{srv.service_type}</div>
                      <div style={{ fontSize: '0.8rem', color: '#666' }}>
                        {srv.customer_machines ? `${srv.customer_machines.machine_type}` : 'General'}
                      </div>
                    </td>
                    <td style={{ fontWeight: 'bold' }}>
                      {srv.cost > 0 
                        ? `${srv.currency === 'USD' ? '$' : 'S/'} ${Number(srv.cost).toFixed(2)}` 
                        : '-'}
                    </td>
                    <td>
                      <span className={`badge ${
                        srv.status === 'Completado' ? 'badge-success' : 
                        srv.status === 'Cancelado' ? 'badge-danger' : 'badge-neutral'
                      }`} style={srv.status === 'En Progreso' ? { backgroundColor: 'rgba(245, 158, 11, 0.2)', color: 'var(--color-warning)' } : {}}>
                        {srv.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons" style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-secondary" onClick={() => openEditModal(srv)} style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <PenTool size={14} /> Gestionar
                        </button>
                        <button className="btn-icon" title="Convertir a Proforma" onClick={() => convertToQuote(srv)} style={{ color: 'var(--color-primary)' }}>
                          <Receipt size={18} />
                        </button>
                        <button className="btn-icon" onClick={() => handleDelete(srv.id)}>
                          <Trash2 size={18} color="var(--color-danger)" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* VISTA DE CELULAR (TARJETAS) */}
        <div className="mobile-only" style={{ padding: '0.5rem' }}>
          {loading ? (
            <p style={{ textAlign: 'center', padding: '2rem' }}>Cargando servicios...</p>
          ) : filteredTickets.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '2rem' }}>No hay servicios registrados.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filteredTickets.map((srv) => (
                <div key={srv.id} className="glass-panel" style={{ 
                  padding: '1.25rem', 
                  borderLeft: `4px solid ${srv.status === 'Completado' ? 'var(--color-success)' : srv.status === 'Cancelado' ? 'var(--color-danger)' : 'var(--color-warning)'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ color: 'var(--color-primary)', fontWeight: 'bold', fontSize: '0.9rem' }}>{srv.ticket_number}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {new Date(srv.scheduled_date + 'T00:00:00').toLocaleDateString('es-PE')}
                    </span>
                  </div>

                  <h4 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{srv.customers?.name}</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                    {srv.service_type} {srv.customer_machines ? ` - ${srv.customer_machines.machine_type}` : ''}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                    <span className={`badge ${srv.status === 'Completado' ? 'badge-success' : srv.status === 'Cancelado' ? 'badge-danger' : 'badge-neutral'}`} style={{ fontSize: '0.7rem' }}>
                      {srv.status}
                    </span>
                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: srv.cost > 0 ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                      {srv.cost > 0 ? `${srv.currency === 'USD' ? '$' : 'S/'} ${srv.cost.toFixed(2)}` : 'S/ 0.00'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn-secondary" onClick={() => openEditModal(srv)} style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <PenTool size={16} /> Gestionar
                    </button>
                    <button className="btn-icon" onClick={() => convertToQuote(srv)} style={{ padding: '0.6rem', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-primary)' }}>
                      <Receipt size={20} />
                    </button>
                    <button className="btn-icon" onClick={() => handleDelete(srv.id)} style={{ padding: '0.6rem', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-danger)' }}>
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Gestionar Ticket: ${editingTicket?.ticket_number}`}>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'var(--color-surface)', borderRadius: '8px', fontSize: '0.9rem' }}>
              <p><strong>Cliente:</strong> {editingTicket?.customers?.name}</p>
              <p><strong>Problema Reportado:</strong> {editingTicket?.issue_description || 'Sin descripción'}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label>Estado del Servicio</label>
                <select name="status" className="form-control" value={formData.status} onChange={handleInputChange}>
                  <option value="En Progreso">En Progreso (Trabajando)</option>
                  <option value="Completado">Completado (Entregado)</option>
                  <option value="Cancelado">Cancelado</option>
                </select>
              </div>
              <div className="form-group">
                <label>Moneda</label>
                <select name="currency" className="form-control" value={formData.currency} onChange={handleInputChange}>
                  <option value="PEN">Soles (S/)</option>
                  <option value="USD">Dólares ($)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Costo Final</label>
                <input type="number" step="0.01" min="0" name="cost" className="form-control" value={formData.cost} onChange={handleInputChange} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem', marginTop: '1rem' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600 }}>Fecha de Trabajo (Planificación)</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-primary)' }}>¿Necesitas más días? Extiende la fecha</span>
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="date" 
                  name="scheduled_date" 
                  className="form-control" 
                  style={{ flex: 1, height: '45px' }}
                  value={formData.scheduled_date} 
                  onChange={handleInputChange} 
                  required
                />
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => adjustDate(1)} 
                  style={{ height: '45px', padding: '0 12px', fontSize: '0.85rem', whiteSpace: 'nowrap', borderRadius: 'var(--border-radius)', borderColor: 'rgba(255, 128, 0, 0.3)', background: 'rgba(255, 128, 0, 0.05)' }}
                  title="Posponer 1 día de trabajo"
                >
                  +1 Día
                </button>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => adjustDate(2)} 
                  style={{ height: '45px', padding: '0 12px', fontSize: '0.85rem', whiteSpace: 'nowrap', borderRadius: 'var(--border-radius)', borderColor: 'rgba(255, 128, 0, 0.3)', background: 'rgba(255, 128, 0, 0.05)' }}
                  title="Posponer 2 días de trabajo"
                >
                  +2 Días
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Informe Técnico (Notas Finales)</label>
              <textarea 
                name="technical_notes" 
                className="form-control" 
                value={formData.technical_notes} 
                onChange={handleInputChange} 
                placeholder="Describe qué piezas se cambiaron, qué diagnóstico final tuvo la máquina..." 
                rows={4} 
                style={{ resize: 'vertical' }}
              ></textarea>
            </div>
            
            {formData.status === 'Completado' && (
              <div style={{ padding: '0.8rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--color-success)', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.9rem' }}>
                <CheckCircle size={18} />
                Al guardar, este ticket se cerrará y quedará en el historial del cliente.
              </div>
            )}
          </div>
          
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Services;
