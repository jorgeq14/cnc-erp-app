import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Customers.css';
import { Search, Plus, Filter, Copy, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/ui/Modal';
import { logActivity } from '../lib/logger';

import type { Customer } from '../types';

const Customers = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [customerQuotes, setCustomerQuotes] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 1800);
    });
  };

  const getWhatsAppUrl = (phone: string) => {
    if (!phone) return '#';
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('51') && cleanPhone.length > 9) {
      cleanPhone = cleanPhone.substring(2);
    }
    return `https://wa.me/51${cleanPhone}`;
  };

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    phone: '',
    ruc: '',
    address: '',
    location: '',
    location_link: '',
    notes: '',
    status: 'Al Día'
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name', { ascending: true });
        
      if (error) throw error;
      if (data) setCustomers(data);

      // Detectar deudas automáticamente desde las proformas
      const { data: qData } = await supabase.from('quotes').select('customer_id, status');
      if (qData) {
        const statusMap: Record<string, string> = {};
        qData.forEach(q => {
          if (q.status === 'Aprobada') {
            statusMap[q.customer_id] = 'DEUDA';
          }
        });
        setCustomerQuotes(statusMap);
      }
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return alert('El nombre de la empresa es requerido');

    try {
      setIsSubmitting(true);
      
      const payload = { 
        name: formData.name, 
        contact: formData.contact, 
        phone: formData.phone,
        ruc: formData.ruc,
        address: formData.address,
        location: formData.location,
        location_link: formData.location_link,
        notes: formData.notes,
        status: formData.status
      };

      let query;
      if (editingId) {
        query = supabase.from('customers').update(payload).eq('id', editingId).select();
      } else {
        query = supabase.from('customers').insert([payload]).select();
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        if (editingId) {
          setCustomers(customers.map(c => c.id === editingId ? data[0] : c));
          await logActivity('CLIENTE_EDITADO', `Cliente editado: ${formData.name}`);
        } else {
          setCustomers([...customers, data[0]]);
          await logActivity('CLIENTE_CREADO', `Nuevo cliente registrado: ${formData.name} (RUC: ${formData.ruc || 'N/A'})`);
        }
        closeModal();
      }
    } catch (error: any) {
      console.error("Error saving customer:", error);
      alert('Detalle del error: ' + (error.message || JSON.stringify(error)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ 
      name: '', contact: '', phone: '', ruc: '', 
      address: '', location: '', location_link: '', notes: '', status: 'Al Día'
    });
  };

  const openEditModal = (customer: Customer) => {
    setFormData({
      name: customer.name || '',
      contact: customer.contact || '',
      phone: customer.phone || '',
      ruc: customer.ruc || '',
      address: customer.address || '',
      location: customer.location || '',
      location_link: customer.location_link || '',
      notes: customer.notes || '',
      status: customer.status || 'Al Día'
    });
    setEditingId(customer.id);
    setIsModalOpen(true);
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '-';
    // Limpiar signos no numéricos
    let clean = phone.replace(/\D/g, '');
    // Si empieza por 51, se lo quitamos para la vista
    if (clean.startsWith('51') && clean.length > 9) {
      clean = clean.substring(2);
    }
    if (clean.length === 9) {
      return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
    }
    // Si tiene otro formato, lo mostramos limpio de símbolos extraños
    return phone.replace('+51', '').trim();
  };

  const filteredCustomers = customers.filter(customer => {
    const matchesFilter = filter === 'Todos' || customer.status === filter;
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      (customer.name && customer.name.toLowerCase().includes(term)) || 
      (customer.contact && customer.contact.toLowerCase().includes(term)) ||
      (customer.ruc && customer.ruc.includes(term)) ||
      (customer.phone && customer.phone.includes(term)) ||
      (customer.address && customer.address.toLowerCase().includes(term)) ||
      (customer.location && customer.location.toLowerCase().includes(term));
      
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Directorio de Clientes</h2>
          <p>Gestiona tu base de datos y su estado de pagos.</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditingId(null); setFormData({ name: '', contact: '', phone: '', ruc: '', address: '', location: '', location_link: '', notes: '', status: 'Al Día' }); setIsModalOpen(true); }}>
          <Plus size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Nuevo Cliente
        </button>
      </div>

      <div className="glass-panel">
        <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: '280px', maxWidth: '400px' }}>
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Buscar por empresa, contacto, teléfono o RUC..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Filter size={18} style={{ color: 'var(--color-text-muted)' }} className="desktop-only" />
            <select 
              className="form-control" 
              style={{ padding: '0.5rem', width: 'auto', fontSize: '0.9rem' }}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="Todos">Filtrar: Todos</option>
              <option value="Al Día">Solo: Al Día</option>
              <option value="Con Deuda">Solo: Deudores</option>
              <option value="Inactivo">Solo: Inactivos</option>
            </select>
          </div>
        </div>

        {/* VISTA DE ESCRITORIO (TABLA) */}
        <div className="desktop-only">
          <table className="data-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Contacto</th>
                <th>Teléfono</th>
                <th>RUC</th>
                <th>Estado Financiero</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{textAlign: 'center', padding: '2rem'}}>Cargando clientes...</td></tr>
              ) : filteredCustomers.length === 0 ? (
                <tr><td colSpan={6} style={{textAlign: 'center', padding: '2rem'}}>No hay clientes que coincidan con la búsqueda.</td></tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="font-medium" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={customer.name}>
                      {customer.name}
                    </td>
                    <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={customer.contact || '-'}>
                      {customer.contact || '-'}
                    </td>
                    <td className="whatsapp-text">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{formatPhone(customer.phone)}</span>
                        {customer.phone && (
                          <button
                            onClick={() => copyToClipboard(customer.phone, `phone-${customer.id}`)}
                            className="btn-icon"
                            title="Copiar teléfono"
                            style={{ padding: '3px' }}
                          >
                            {copiedId === `phone-${customer.id}`
                              ? <Check size={13} color="#22c55e" />
                              : <Copy size={13} />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td>{customer.ruc || '-'}</td>
                    <td>
                      <span className={`badge ${
                        customerQuotes[customer.id] === 'DEUDA' || customer.status === 'Con Deuda' ? 'badge-danger' : 
                        (customer.status === 'Al Día' || customer.status === 'Activo') ? 'badge-success' : 'badge-neutral'
                      }`} style={{ animation: customerQuotes[customer.id] === 'DEUDA' ? 'pulse 2s infinite' : 'none' }}>
                        {customerQuotes[customer.id] === 'DEUDA' ? '🔴 DEUDA PENDIENTE' : (customer.status === 'Activo' ? 'Al Día' : customer.status)}
                      </span>
                    </td>
                    <td style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn-secondary" onClick={() => openEditModal(customer)} style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}>
                        Editar
                      </button>
                      <button className="btn-secondary" onClick={() => navigate(`/clientes/${customer.id}`)} style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}>
                        Ver Perfil
                      </button>
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
            <p style={{ textAlign: 'center', padding: '2rem' }}>Cargando clientes...</p>
          ) : filteredCustomers.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '2rem' }}>No hay clientes que coincidan.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filteredCustomers.map((customer) => {
                const hasDeuda = customerQuotes[customer.id] === 'DEUDA' || customer.status === 'Con Deuda';
                return (
                  <div key={customer.id} className="glass-panel" style={{ 
                    padding: '1.25rem', 
                    borderLeft: `4px solid ${hasDeuda ? 'var(--color-danger)' : 'var(--color-success)'}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <h4 style={{ fontSize: '1.1rem', margin: 0, flex: 1 }}>{customer.name}</h4>
                      <span className={`badge ${hasDeuda ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.65rem' }}>
                        {hasDeuda ? 'CON DEUDA' : 'AL DÍA'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                      <div>
                        <p style={{ color: 'var(--color-text-muted)', marginBottom: '2px' }}>Contacto:</p>
                        <p style={{ fontWeight: '500' }}>{customer.contact || '-'}</p>
                      </div>
                      <div>
                        <p style={{ color: 'var(--color-text-muted)', marginBottom: '2px' }}>RUC:</p>
                        <p style={{ fontWeight: '500' }}>{customer.ruc || '-'}</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn-secondary" onClick={() => navigate(`/clientes/${customer.id}`)} style={{ flex: 1, padding: '0.6rem', fontSize: '0.8rem' }}>
                        Ver Perfil
                      </button>
                      <button className="btn-secondary" onClick={() => openEditModal(customer)} style={{ flex: 1, padding: '0.6rem', fontSize: '0.8rem' }}>
                        Editar
                      </button>
                      {customer.phone && (
                        <a 
                          href={getWhatsAppUrl(customer.phone)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="btn-primary"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '42px', padding: 0 }}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.94 3.659 1.437 5.63 1.438h.004c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingId ? "Editar Cliente" : "Registrar Nuevo Cliente"}>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label>Nombre de la Empresa o Cliente *</label>
                <input type="text" name="name" className="form-control" value={formData.name} onChange={handleInputChange} required placeholder="Ej. Cubi Maker Perú" />
              </div>
              <div className="form-group">
                <label>Estado Financiero</label>
                <select name="status" className="form-control" value={formData.status} onChange={handleInputChange}>
                  <option value="Al Día">🟢 Al Día (Sin deudas)</option>
                  <option value="Con Deuda">🔴 Con Deuda (Pago pendiente)</option>
                  <option value="Inactivo">⚪ Inactivo</option>
                </select>
                {editingId && customerQuotes[editingId] === 'DEUDA' && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginTop: '6px', fontWeight: '600' }}>
                    ⚠️ Sistema detectó Proformas Aprobadas. Se mostrará como "Deuda" en la lista.
                  </p>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label>Nombre del Contacto</label>
                <input type="text" name="contact" className="form-control" value={formData.contact} onChange={handleInputChange} placeholder="Ej. Jorge Luis" />
              </div>
              <div className="form-group">
                <label>Teléfono / WhatsApp</label>
                <input type="text" name="phone" className="form-control" value={formData.phone} onChange={handleInputChange} placeholder="+51 970 275 281" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label>Dirección Física</label>
                <input type="text" name="address" className="form-control" value={formData.address} onChange={handleInputChange} placeholder="Ej. Av. Los Industriales 123" />
              </div>
              <div className="form-group">
                <label>Ubicación (Ciudad/Distrito)</label>
                <input type="text" name="location" className="form-control" value={formData.location} onChange={handleInputChange} placeholder="Ej. Huancayo, Junín" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label>RUC</label>
                <input type="text" name="ruc" className="form-control" value={formData.ruc} onChange={handleInputChange} placeholder="Ej. 20123456789" />
              </div>
              <div className="form-group">
                <label>Link de Ubicación (Maps)</label>
                <input type="text" name="location_link" className="form-control" value={formData.location_link} onChange={handleInputChange} placeholder="https://maps.google.com/..." />
              </div>
            </div>

            <div className="form-group">
              <label>Comentarios Adicionales</label>
              <textarea name="notes" className="form-control" value={formData.notes} onChange={handleInputChange} placeholder="Notas sobre el cliente..." rows={3} style={{ resize: 'vertical' }}></textarea>
            </div>
            
            <p style={{ fontSize: '0.875rem', color: 'var(--color-warning)' }}>
              Nota: Podrás registrar las máquinas que posee el cliente desde su <strong>Perfil</strong> una vez creado.
            </p>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : (editingId ? 'Actualizar Cliente' : 'Guardar Cliente')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Customers;
