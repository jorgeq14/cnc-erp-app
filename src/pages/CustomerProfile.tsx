import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Settings, Wrench, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/ui/Modal';
import { logActivity } from '../lib/logger';
import './Customers.css';

export default function CustomerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<any>(null);
  const [machines, setMachines] = useState<any[]>([]);
  const [serviceHistory, setServiceHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [machineForm, setMachineForm] = useState({ machine_type: '', serial_number: '', installation_date: '', notes: '' });

  useEffect(() => {
    fetchCustomerData();
  }, [id]);

  const fetchCustomerData = async () => {
    setLoading(true);
    const { data: custData } = await supabase.from('customers').select('*').eq('id', id).single();
    if (custData) setCustomer(custData);
    
    const { data: machData } = await supabase.from('customer_machines').select('*').eq('customer_id', id);
    if (machData) setMachines(machData);

    const { data: histData } = await supabase
      .from('service_tickets')
      .select('*')
      .eq('customer_id', id)
      .order('id', { ascending: false });
    if (histData) setServiceHistory(histData);
    
    setLoading(false);
  };

  const handleAddMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.from('customer_machines').insert([{ 
      ...machineForm, 
      customer_id: id 
    }]).select();
    
    if (!error && data) {
      setMachines([...machines, data[0]]);
      await logActivity('MAQUINA_AÑADIDA', `Máquina ${machineForm.machine_type} (${machineForm.serial_number}) añadida al cliente ${customer.name}.`);
      setIsModalOpen(false);
      setMachineForm({ machine_type: '', serial_number: '', installation_date: '', notes: '' });
    } else {
      alert("Error al guardar la máquina. Asegúrate de haber ejecutado el código SQL.");
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Cargando perfil...</div>;
  if (!customer) return <div style={{ padding: '2rem' }}>Cliente no encontrado</div>;

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button onClick={() => navigate('/clientes')} style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', cursor: 'pointer' }}>
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2>{customer.name}</h2>
          <p>RUC: {customer.ruc || 'No registrado'} | Contacto: {customer.contact}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        {/* Info lateral */}
        <div className="glass-panel" style={{ padding: '1.5rem', alignSelf: 'start' }}>
          <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>Datos de Contacto</h3>
          <p><strong>Teléfono:</strong> {customer.phone}</p>
          <p style={{ marginTop: '0.5rem' }}><strong>Dirección:</strong> {customer.address}</p>
          <p style={{ marginTop: '0.5rem' }}><strong>Ubicación:</strong> {customer.location || '-'}</p>
          {customer.location_link && (
            <p style={{ marginTop: '0.5rem' }}>
              <a href={customer.location_link} target="_blank" rel="noreferrer">Ver en Mapa</a>
            </p>
          )}
          <h3 style={{ marginTop: '2rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>Comentarios</h3>
          <p style={{ color: 'var(--color-text-muted)' }}>{customer.notes || 'Sin comentarios.'}</p>
        </div>

        {/* Maquinas */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3>Equipos Instalados</h3>
            <button className="btn-primary" onClick={() => setIsModalOpen(true)} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
              <Plus size={16} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              Añadir Equipo
            </button>
          </div>

          {machines.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', border: '1px dashed var(--color-border)', borderRadius: '8px' }}>
              Este cliente no tiene máquinas registradas aún.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {machines.map(m => (
                <div key={m.id} style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1rem', display: 'flex', justifyContent: 'space-between', backgroundColor: 'var(--color-surface)' }}>
                  <div>
                    <h4 style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Settings size={18} /> {m.machine_type}
                    </h4>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>Serie: {m.serial_number || 'No especificada'} | Instalado: {m.installation_date || 'No especificada'}</p>
                  </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button className="btn-icon" title="Ver en Agenda/Servicios"><Wrench size={18}/></button>
                    </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Historial de Servicios - ancho completo */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} color="var(--color-primary)" /> Historial de Servicios
          </h3>
        </div>
        {serviceHistory.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)', border: '1px dashed var(--color-border)', borderRadius: '8px' }}>
            Sin servicios registrados aún.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Fecha</th>
                <th>Tipo de Servicio</th>
                <th>Problema</th>
                <th>Costo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {serviceHistory.map(srv => (
                <tr key={srv.id}>
                  <td style={{ color: 'var(--color-primary)', fontWeight: '500' }}>{srv.ticket_number}</td>
                  <td>{new Date(srv.scheduled_date + 'T00:00:00').toLocaleDateString('es-PE')}</td>
                  <td>{srv.service_type}</td>
                  <td style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{srv.issue_description || '-'}</td>
                  <td style={{ fontWeight: 'bold' }}>{srv.cost > 0 ? `${srv.currency === 'USD' ? '$' : 'S/'} ${Number(srv.cost).toFixed(2)}` : '-'}</td>
                  <td>
                    <span className={`badge ${
                      srv.status === 'Completado' ? 'badge-success' :
                      srv.status === 'Cancelado' ? 'badge-danger' : 'badge-neutral'
                    }`}>{srv.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Registrar Equipo">
        <form onSubmit={handleAddMachine}>
          <div className="modal-body">
            <div className="form-group">
              <label>Tipo de Máquina *</label>
              <select className="form-control" value={machineForm.machine_type} onChange={e => setMachineForm({...machineForm, machine_type: e.target.value})} required>
                <option value="">Seleccione...</option>
                <option value="Láser CO2">Láser CO2</option>
                <option value="Fibra Láser">Fibra Láser</option>
                <option value="CNC Router">CNC Router</option>
                <option value="Marcadora Láser">Marcadora Láser</option>
                <option value="Corte Plasma">Corte Plasma</option>
                <option value="CNC Oxicorte">CNC Oxicorte</option>
                <option value="Otra">Otra</option>
              </select>
            </div>
            <div className="form-group">
              <label>Número de Serie</label>
              <input type="text" className="form-control" value={machineForm.serial_number} onChange={e => setMachineForm({...machineForm, serial_number: e.target.value})} placeholder="Ej. SN-2026-XYZ" />
            </div>
            <div className="form-group">
              <label>Fecha de Instalación</label>
              <input type="date" className="form-control" value={machineForm.installation_date} onChange={e => setMachineForm({...machineForm, installation_date: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Notas Adicionales</label>
              <textarea className="form-control" rows={3} value={machineForm.notes} onChange={e => setMachineForm({...machineForm, notes: e.target.value})} placeholder="Detalles de la garantía, potencia del tubo, etc..."></textarea>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">Guardar Equipo</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
