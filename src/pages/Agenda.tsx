import { useEffect, useState } from 'react';
import './Customers.css';
import { Plus, Calendar as CalendarIcon, Clock, MapPin, CheckCircle, Clock3, Search, X, TrendingUp, AlertCircle, DollarSign, Trash2, PauseCircle, CalendarClock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/ui/Modal';
import { logActivity } from '../lib/logger';

interface Customer {
  id: number;
  name: string;
  address: string;
  location: string;
  ruc?: string;
  contact?: string;
}

interface Machine {
  id: number;
  customer_id: number;
  machine_type: string;
  serial_number: string;
}

interface ServiceTicket {
  id: number;
  ticket_number: string;
  customer_id: number;
  machine_id: number | null;
  scheduled_date: string;
  scheduled_time: string;
  service_type: string;
  issue_description: string;
  status: string;
  customers?: Customer;
  customer_machines?: { machine_type: string; serial_number: string };
}

const Agenda = () => {
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [allTickets, setAllTickets] = useState<ServiceTicket[]>([]); // includes completed
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [salesByDay, setSalesByDay] = useState<Record<string, number>>({});
  const [paymentModal, setPaymentModal] = useState<{ ticket: ServiceTicket } | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'Efectivo', notes: '' });
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    customer_id: '',
    machine_id: '',
    scheduled_date: '',
    scheduled_time: '',
    service_type: 'Mantenimiento Preventivo',
    issue_description: '',
    status: 'Pendiente'
  });

  const resetForm = () => {
    setFormData({
      customer_id: '',
      machine_id: '',
      scheduled_date: '',
      scheduled_time: '',
      service_type: 'Mantenimiento Preventivo',
      issue_description: '',
      status: 'Pendiente'
    });
    setCustomerSearch('');
    setSelectedCustomerId('');
    setIsModalOpen(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Build calendar date range: starts from the Sunday of the week 2 weeks ago
  // so that days align correctly with Dom/Lun/Mar/Mié/Jue/Vie/Sáb headers
  const getCalendarDays = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Go back 14 days
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(today.getDate() - 14);

    // Find the Sunday (day 0) of that week so grid aligns with headers
    const startSunday = new Date(twoWeeksAgo);
    startSunday.setDate(twoWeeksAgo.getDate() - twoWeeksAgo.getDay());

    // Build 5 weeks (35 days) to always cover 2 weeks past + this week + next week
    const days: Date[] = [];
    for (let i = 0; i < 35; i++) {
      const d = new Date(startSunday);
      d.setDate(startSunday.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const toDateStr = (d: Date) => d.toISOString().split('T')[0];

  const fetchData = async () => {
    try {
      setLoading(true);

      const { data: custData } = await supabase
        .from('customers')
        .select('id, name, address, location, ruc, contact')
        .order('name');
      setCustomers(custData || []);

      const { data: machData } = await supabase
        .from('customer_machines')
        .select('id, customer_id, machine_type, serial_number');
      setMachines(machData || []);

      // Fetch ALL tickets (including completed) for calendar display
      const { data: allTicketsData } = await supabase
        .from('service_tickets')
        .select('*, customers(id, name, address, location), customer_machines(id, machine_type, serial_number)')
        .order('scheduled_date', { ascending: true });
      setAllTickets((allTicketsData || []) as unknown as ServiceTicket[]);

      // Pending/confirmed only for the main list
      const pendingTickets = (allTicketsData || []).filter((t: any) =>
        t.status === 'Pendiente' || t.status === 'Confirmado' || t.status === 'En Espera'
      );
      setTickets(pendingTickets as unknown as ServiceTicket[]);

      // Fetch sales grouped by date for the calendar range
      const calDays = getCalendarDays();
      const fromDate = toDateStr(calDays[0]);
      const toDate = toDateStr(calDays[calDays.length - 1]);

      const { data: salesData } = await supabase
        .from('ventas_realizadas')
        .select('created_at, total')
        .gte('created_at', fromDate)
        .lte('created_at', toDate + 'T23:59:59');

      const salesMap: Record<string, number> = {};
      (salesData || []).forEach((s: any) => {
        const day = (s.created_at || '').split('T')[0];
        if (day) salesMap[day] = (salesMap[day] || 0) + Number(s.total || 0);
      });
      setSalesByDay(salesMap);

    } catch (error) {
      console.error("Error general en fetchData:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateTicketNumber = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const year = new Date().getFullYear().toString().slice(-2);
    return `SRV-${year}${randomNum}`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_id || !formData.scheduled_date || !formData.scheduled_time) {
      return alert('Faltan campos obligatorios');
    }

    try {
      setIsSubmitting(true);
      const ticketNumber = generateTicketNumber();
      
      const payload = {
        ticket_number: ticketNumber,
        customer_id: parseInt(formData.customer_id),
        machine_id: formData.machine_id ? parseInt(formData.machine_id) : null,
        scheduled_date: formData.scheduled_date,
        scheduled_time: formData.scheduled_time,
        service_type: formData.service_type,
        issue_description: formData.issue_description,
        status: formData.status
      };

      const { error } = await supabase.from('service_tickets').insert([payload]);
      
      if (error) throw error;
      
      const customerName = customers.find(c => c.id.toString() === formData.customer_id)?.name || 'cliente';
      await logActivity('CITA_AGENDADA', `Nueva cita agendada: ${ticketNumber} para ${customerName} el ${formData.scheduled_date} a las ${formData.scheduled_time}.`);

      await fetchData(); // Refresh list
      resetForm();

    } catch (error: any) {
      console.error("Error saving ticket:", error);
      alert('Error: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const changeStatus = async (id: number, newStatus: string) => {
    try {
      const { error } = await supabase.from('service_tickets').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      
      const ticket = tickets.find(t => t.id === id);
      await logActivity('SERVICIO_ACTUALIZADO', `Estado de ticket ${ticket?.ticket_number} cambiado a "${newStatus}".`);

      await fetchData();
    } catch (error) {
      console.error("Error updating status", error);
    }
  };

  const deleteTicket = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar permanentemente esta cita?')) return;
    try {
      const { error } = await supabase.from('service_tickets').delete().eq('id', id);
      if (error) throw error;
      const ticket = tickets.find(t => t.id === id);
      await logActivity('CITA_ELIMINADA', `Cita eliminada: ${ticket?.ticket_number}.`);
      await fetchData();
    } catch (error) {
      console.error("Error al eliminar", error);
      alert('Error al eliminar la cita.');
    }
  };

  const rescheduleTicket = async (id: number, current_date: string) => {
    const newDate = prompt('Ingresa la nueva fecha para esta cita (YYYY-MM-DD):', current_date);
    if (!newDate) return; // User cancelled
    
    // Validate format simply
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      alert('Formato de fecha inválido. Usa YYYY-MM-DD.');
      return;
    }

    try {
      const { error } = await supabase.from('service_tickets').update({ scheduled_date: newDate, status: 'Pendiente' }).eq('id', id);
      if (error) throw error;
      const ticket = tickets.find(t => t.id === id);
      await logActivity('CITA_REAGENDADA', `Cita ${ticket?.ticket_number} reagendada para el ${newDate}.`);
      await fetchData();
    } catch (error) {
      console.error("Error al reagendar", error);
      alert('Error al reagendar la cita.');
    }
  };

  const handleCompleteAndCharge = async () => {
    if (!paymentModal) return;
    const amount = parseFloat(paymentForm.amount);
    if (!amount || amount <= 0) return alert('Ingresa un monto válido mayor a 0.');

    const { ticket } = paymentModal;
    try {
      setIsPaymentSubmitting(true);

      // 1. Registrar como venta en ventas_realizadas
      const ventaPayload = {
        customer_id: (ticket.customers as any)?.id || null,
        customer_name: ticket.customers?.name || 'Cliente',
        items: JSON.stringify([{
          name: ticket.service_type,
          description: ticket.issue_description || 'Servicio técnico',
          quantity: 1,
          price: amount
        }]),
        subtotal: amount,
        tax: 0,
        total: amount,
        currency: 'PEN',
        quote_number: ticket.ticket_number,
        status: 'Completado',
        created_at: new Date().toISOString()
      };

      const { error: ventaError } = await supabase.from('ventas_realizadas').insert([ventaPayload]);
      if (ventaError) throw ventaError;

      // 2. Marcar ticket como Completado
      await supabase.from('service_tickets').update({ status: 'Completado' }).eq('id', ticket.id);

      await logActivity('SERVICIO_COBRADO', `Servicio ${ticket.ticket_number} completado. Cobro: S/ ${amount.toFixed(2)} via ${paymentForm.method}.`);

      setPaymentModal(null);
      setPaymentForm({ amount: '', method: 'Efectivo', notes: '' });
      await fetchData();
      alert(`✅ ¡Cobro registrado! S/ ${amount.toFixed(2)} guardado en Ventas.`);
    } catch (error: any) {
      console.error('Error registrando cobro:', error);
      alert('Error: ' + error.message);
    } finally {
      setIsPaymentSubmitting(false);
    }
  };

  const filteredTickets = tickets.filter(t => {
    const term = searchTerm.toLowerCase();
    const customerName = (t.customers?.name || '').toLowerCase();
    const address = (t.customers?.address || '').toLowerCase();
    const ticketNum = (t.ticket_number || '').toLowerCase();
    
    return customerName.includes(term) || address.includes(term) || ticketNum.includes(term);
  });

  // Calendar rendering helpers
  const calendarDays = getCalendarDays();
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = toDateStr(today);

  const ticketsByDay: Record<string, ServiceTicket[]> = {};
  allTickets.forEach(t => {
    const day = t.scheduled_date?.split('T')[0];
    if (day) {
      if (!ticketsByDay[day]) ticketsByDay[day] = [];
      ticketsByDay[day].push(t);
    }
  });

  const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  const selectedDayTickets = selectedDay ? (ticketsByDay[selectedDay] || []) : [];
  const selectedDaySales = selectedDay ? (salesByDay[selectedDay] || 0) : 0;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Agenda de Visitas</h2>
          <p>Gestiona y programa tus próximos mantenimientos y reparaciones.</p>
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Agendar Cita
        </button>
      </div>

      {/* ── CALENDARIO VISUAL ── */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', fontSize: '1rem' }}>
          <CalendarIcon size={18} color="var(--color-primary)" />
          Resumen de Actividad — Últimas 2 semanas · Esta semana · Próxima semana
        </h3>

        {/* Grid de semanas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Encabezado días */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
            {DAYS_ES.map(d => (
              <div key={d} style={{ fontSize: '0.72rem', fontWeight: '600', color: 'var(--color-text-muted)', padding: '4px 0' }}>{d}</div>
            ))}
          </div>

          {/* Semanas */}
          {[0, 1, 2, 3, 4].map(weekIdx => {
            const weekDays = calendarDays.slice(weekIdx * 7, weekIdx * 7 + 7);
            return (
              <div key={weekIdx} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                {weekDays.map(day => {
                  const ds = toDateStr(day);
                  const isToday = ds === todayStr;
                  const isPast = day < today;
                  const isFuture = day > today;
                  const dayTickets = ticketsByDay[ds] || [];
                  const daySales = salesByDay[ds] || 0;
                  const hasPending = dayTickets.some(t => t.status === 'Pendiente');
                  const hasConfirmed = dayTickets.some(t => t.status === 'Confirmado');
                  const hasCompleted = dayTickets.some(t => t.status === 'Completado' || t.status === 'En Progreso');
                  const isSelected = ds === selectedDay;
                  const hasActivity = dayTickets.length > 0 || daySales > 0;

                  let bgColor = 'var(--color-surface)';
                  let borderColor = 'var(--color-border)';
                  let opacity = 1;

                  if (isToday) { bgColor = 'rgba(255,128,0,0.15)'; borderColor = 'var(--color-primary)'; }
                  else if (isSelected) { bgColor = 'rgba(255,128,0,0.1)'; borderColor = 'var(--color-primary)'; }
                  else if (isFuture && !hasActivity) { opacity = 0.45; }

                  return (
                    <div
                      key={ds}
                      onClick={() => setSelectedDay(isSelected ? null : ds)}
                      style={{
                        backgroundColor: bgColor,
                        border: `1px solid ${borderColor}`,
                        borderRadius: '8px',
                        padding: '6px 4px',
                        textAlign: 'center',
                        cursor: hasActivity || isToday ? 'pointer' : 'default',
                        transition: 'all 0.2s',
                        opacity,
                        minHeight: '72px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: '3px',
                        transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                        boxShadow: isSelected ? '0 4px 16px rgba(255,128,0,0.3)' : 'none',
                      }}
                    >
                      <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>{MONTHS_ES[day.getMonth()]}</span>
                      <span style={{
                        fontSize: '1.05rem',
                        fontWeight: isToday ? '800' : '600',
                        color: isToday ? 'var(--color-primary)' : 'var(--color-text)',
                        lineHeight: 1
                      }}>{day.getDate()}</span>

                      {/* Dots de actividad */}
                      {dayTickets.length > 0 && (
                        <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', justifyContent: 'center' }}>
                          {hasPending && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-warning)', display: 'block' }} title="Pendiente" />}
                          {hasConfirmed && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-info)', display: 'block' }} title="Confirmado" />}
                          {hasCompleted && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-success)', display: 'block' }} title="Completado" />}
                        </div>
                      )}

                      {/* Dinero del día */}
                      {daySales > 0 && (
                        <span style={{ fontSize: '0.6rem', fontWeight: '700', color: 'var(--color-success)', lineHeight: 1 }}>
                          S/{daySales.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      )}

                      {/* Indicador de deuda/pendiente */}
                      {hasPending && isPast && (
                        <span style={{ fontSize: '0.55rem', color: 'var(--color-danger)', fontWeight: '700' }}>⚠</span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Leyenda */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-warning)', display: 'inline-block' }} /> Pendiente
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-info)', display: 'inline-block' }} /> Confirmado
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-success)', display: 'inline-block' }} /> Completado
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <TrendingUp size={10} color="var(--color-success)" /> Venta del día
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <AlertCircle size={10} color="var(--color-danger)" /> Pendiente vencido
          </span>
        </div>

        {/* Panel de detalle al hacer click en un día */}
        {selectedDay && (
          <div style={{
            marginTop: '1.25rem',
            background: 'rgba(255,128,0,0.05)',
            border: '1px solid rgba(255,128,0,0.2)',
            borderRadius: '12px',
            padding: '1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, color: 'var(--color-primary)' }}>
                📅 {new Date(selectedDay + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </h4>
              <button onClick={() => setSelectedDay(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                <X size={16} />
              </button>
            </div>

            {/* Resumen financiero */}
            {selectedDaySales > 0 && (
              <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <TrendingUp size={20} color="var(--color-success)" />
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Total vendido este día</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--color-success)' }}>S/ {selectedDaySales.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</div>
                </div>
              </div>
            )}

            {/* Tickets del día */}
            {selectedDayTickets.length === 0 && selectedDaySales === 0 && (
              <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '1rem 0' }}>Sin actividad registrada para este día.</p>
            )}

            {selectedDayTickets.map(ticket => (
              <div key={ticket.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                padding: '0.75rem',
                background: 'var(--color-surface)',
                borderRadius: '8px',
                marginBottom: '8px',
                borderLeft: `3px solid ${
                  ticket.status === 'Completado' ? 'var(--color-success)' :
                  ticket.status === 'Confirmado' ? 'var(--color-info)' :
                  ticket.status === 'Pendiente' ? 'var(--color-warning)' : 'var(--color-danger)'
                }`
              }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{ticket.customers?.name || 'Cliente'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)', marginTop: '2px' }}>{ticket.service_type}</div>
                  {ticket.issue_description && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>{ticket.issue_description}</div>
                  )}
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={11} /> {ticket.scheduled_time}
                    {ticket.customers?.address && (<><MapPin size={11} /> {ticket.customers.address}</>)}
                  </div>
                </div>
                <span style={{
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontWeight: '600',
                  backgroundColor:
                    ticket.status === 'Completado' ? 'rgba(34,197,94,0.15)' :
                    ticket.status === 'Confirmado' ? 'rgba(59,130,246,0.15)' :
                    ticket.status === 'Pendiente' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                  color:
                    ticket.status === 'Completado' ? 'var(--color-success)' :
                    ticket.status === 'Confirmado' ? 'var(--color-info)' :
                    ticket.status === 'Pendiente' ? 'var(--color-warning)' : 'var(--color-danger)',
                  whiteSpace: 'nowrap'
                }}>{ticket.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarIcon size={20} color="var(--color-primary)" />
            Próximas Citas (Pendientes y Confirmadas)
          </h3>
          <div className="search-bar" style={{ maxWidth: '300px', margin: 0 }}>
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Buscar por cliente o dirección..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        {loading ? (
          <p style={{ textAlign: 'center', padding: '2rem' }}>Cargando agenda...</p>
        ) : (
          <>
            {/* VISTA DE ESCRITORIO (LISTA ANCHA) */}
            <div className="desktop-only">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {filteredTickets.map(ticket => {
                  const customerInfo = ticket.customers;
                  const machineInfo = ticket.customer_machines;
                  return (
                    <div key={ticket.id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '1.25rem', 
                      backgroundColor: 'var(--color-surface)', 
                      borderRadius: 'var(--border-radius)',
                      borderLeft: `4px solid ${ticket.status === 'Confirmado' ? 'var(--color-success)' : 'var(--color-warning)'}`
                    }}>
                      <div>
                        <h4 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{customerInfo?.name || 'Cliente Desconocido'}</h4>
                        <p style={{ color: 'var(--color-primary)', fontWeight: '500', fontSize: '0.875rem' }}>
                          {ticket.service_type} 
                          {machineInfo ? ` - ${machineInfo.machine_type}${machineInfo.serial_number ? ` (${machineInfo.serial_number})` : ''}` : ''}
                        </p>
                        {ticket.issue_description && (
                          <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px' }}>Nota: {ticket.issue_description}</p>
                        )}
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold', color: 'var(--color-text)' }}>
                            <Clock size={14} /> {new Date(ticket.scheduled_date + 'T00:00:00').toLocaleDateString('es-PE')} | {ticket.scheduled_time}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={14} /> {customerInfo?.address} {customerInfo?.location ? `(${customerInfo.location})` : ''}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                        <span className={`badge ${ticket.status === 'Confirmado' ? 'badge-success' : 'badge-neutral'}`}>{ticket.status}</span>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                          <button className="btn-icon" onClick={() => deleteTicket(ticket.id)} title="Borrar Cita" style={{ color: 'var(--color-danger)' }}><Trash2 size={16} /></button>
                          <button className="btn-icon" onClick={() => rescheduleTicket(ticket.id, ticket.scheduled_date)} title="Reagendar" style={{ color: 'var(--color-info)' }}><CalendarClock size={16} /></button>
                          <button className="btn-icon" onClick={() => changeStatus(ticket.id, 'En Espera')} title="Poner en Espera" style={{ color: 'var(--color-warning)' }}><PauseCircle size={16} /></button>
                          
                          {ticket.status === 'Pendiente' && (
                            <button className="btn-secondary" onClick={() => changeStatus(ticket.id, 'Confirmado')} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle size={12} /> Confirmar
                            </button>
                          )}
                          {(ticket.status === 'Pendiente' || ticket.status === 'Confirmado' || ticket.status === 'En Espera') && (
                            <button className="btn-primary" onClick={() => changeStatus(ticket.id, 'En Progreso')} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock3 size={12} /> Iniciar Trabajo
                            </button>
                          )}
                          {ticket.status === 'En Progreso' && (
                            <button
                              onClick={() => { setPaymentModal({ ticket }); setPaymentForm({ amount: '', method: 'Efectivo', notes: '' }); }}
                              style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-success)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                            >
                              <DollarSign size={12} /> Completar y Cobrar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* VISTA DE CELULAR (TARJETAS VERTICALES) */}
            <div className="mobile-only">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {filteredTickets.map(ticket => {
                  const customerInfo = ticket.customers;
                  const machineInfo = ticket.customer_machines;
                  return (
                    <div key={ticket.id} className="glass-panel" style={{ 
                      padding: '1.25rem', 
                      borderLeft: `4px solid ${ticket.status === 'Confirmado' ? 'var(--color-success)' : 'var(--color-warning)'}`
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span className={`badge ${ticket.status === 'Confirmado' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.7rem' }}>{ticket.status}</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                          {ticket.scheduled_time}
                        </span>
                      </div>

                      <h4 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{customerInfo?.name || 'Cliente Desconocido'}</h4>
                      
                      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={14} /> {customerInfo?.address}
                      </p>

                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem' }}>
                        <p style={{ color: 'var(--color-primary)', fontWeight: '600', fontSize: '0.85rem', marginBottom: '4px' }}>{ticket.service_type}</p>
                        {machineInfo && (
                          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                            {machineInfo.machine_type} {machineInfo.serial_number ? `(${machineInfo.serial_number})` : ''}
                          </p>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn-secondary" onClick={() => changeStatus(ticket.id, 'En Espera')} style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><PauseCircle size={16} /> Espera</button>
                          <button className="btn-secondary" onClick={() => rescheduleTicket(ticket.id, ticket.scheduled_date)} style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><CalendarClock size={16} /> Reagendar</button>
                          <button className="btn-secondary" onClick={() => deleteTicket(ticket.id)} style={{ padding: '0.6rem', color: 'var(--color-danger)' }}><Trash2 size={16} /></button>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {ticket.status === 'Pendiente' && (
                            <button className="btn-secondary" onClick={() => changeStatus(ticket.id, 'Confirmado')} style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              <CheckCircle size={16} /> Confirmar
                            </button>
                          )}
                          {(ticket.status === 'Pendiente' || ticket.status === 'Confirmado' || ticket.status === 'En Espera') && (
                            <button className="btn-primary" onClick={() => changeStatus(ticket.id, 'En Progreso')} style={{ flex: 2, padding: '0.6rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              <Clock3 size={16} /> Iniciar Trabajo
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Agendar Nueva Visita Técnica">
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group" style={{ position: 'relative' }}>
              <label>Cliente *</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="🔍 Escribe nombre o RUC del cliente..." 
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
                {customerSearch && !selectedCustomerId && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', zIndex: 110, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                    {customers
                      .filter(c => 
                        c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
                        (c.ruc && c.ruc.includes(customerSearch)) ||
                        (c.contact && c.contact.toLowerCase().includes(customerSearch.toLowerCase()))
                      )
                      .map(c => (
                        <div 
                          key={c.id} 
                          style={{ padding: '0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}
                          onClick={() => {
                            setSelectedCustomerId(c.id.toString());
                            setCustomerSearch(c.name);
                            setFormData({ ...formData, customer_id: c.id.toString(), machine_id: '' });
                          }}
                        >
                          <div style={{ fontWeight: '600' }}>{c.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {c.contact ? `Contacto: ${c.contact} | ` : ''} RUC: {c.ruc || 'N/A'}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              {selectedCustomerId && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--color-primary)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>✓ Cliente seleccionado</span>
                  <button type="button" onClick={() => {setSelectedCustomerId(''); setCustomerSearch(''); setFormData({...formData, customer_id: ''});}} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.8rem' }}>Cambiar</button>
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Máquina (solo si aplica)</label>
              <select 
                className="form-control" 
                value={formData.machine_id} 
                onChange={e => setFormData({ ...formData, machine_id: e.target.value })}
                disabled={!selectedCustomerId}
              >
                <option value="">-- Seleccionar máquina --</option>
                {machines.filter(m => m.customer_id.toString() === selectedCustomerId).map(m => (
                  <option key={m.id} value={m.id}>{m.machine_type} - {m.serial_number}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Fecha Programada *</label>
                <input type="date" name="scheduled_date" className="form-control" value={formData.scheduled_date} onChange={handleInputChange} required />
              </div>
              <div className="form-group">
                <label>Hora Programada *</label>
                <input type="time" name="scheduled_time" className="form-control" value={formData.scheduled_time} onChange={handleInputChange} required />
              </div>
            </div>

            <div className="form-group">
              <label>Tipo de Servicio</label>
              <select name="service_type" className="form-control" value={formData.service_type} onChange={handleInputChange}>
                <option value="Mantenimiento Preventivo">Mantenimiento Preventivo</option>
                <option value="Reparación Técnica">Reparación Técnica</option>
                <option value="Instalación">Instalación</option>
                <option value="Visita de Diagnóstico">Visita de Diagnóstico</option>
                <option value="Capacitación">Capacitación</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div className="form-group">
              <label>Estado Inicial</label>
              <select name="status" className="form-control" value={formData.status} onChange={handleInputChange}>
                <option value="Pendiente">Pendiente por Confirmar</option>
                <option value="Confirmado">Cita Confirmada</option>
              </select>
            </div>

            <div className="form-group">
              <label>Descripción del Problema o Tarea</label>
              <textarea name="issue_description" className="form-control" value={formData.issue_description} onChange={handleInputChange} placeholder="Detalles de la falla, repuestos que se llevarán, etc." rows={3} style={{ resize: 'vertical' }}></textarea>
            </div>
          </div>
          
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar Cita'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: COMPLETAR Y COBRAR SERVICIO */}
      <Modal isOpen={!!paymentModal} onClose={() => setPaymentModal(null)} title="💰 Completar Servicio y Registrar Cobro">
        {paymentModal && (
          <div className="modal-body">
            {/* Info del servicio */}
            <div style={{ background: 'var(--color-surface)', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', borderLeft: '4px solid var(--color-primary)' }}>
              <div style={{ fontWeight: '700', fontSize: '1rem' }}>{paymentModal.ticket.customers?.name}</div>
              <div style={{ color: 'var(--color-primary)', fontSize: '0.875rem', marginTop: '4px' }}>{paymentModal.ticket.service_type}</div>
              {paymentModal.ticket.issue_description && (
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>{paymentModal.ticket.issue_description}</div>
              )}
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '6px' }}>
                Ticket: <strong>{paymentModal.ticket.ticket_number}</strong>
              </div>
            </div>

            {/* Monto */}
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <DollarSign size={14} /> Monto Cobrado (S/) *
              </label>
              <input
                type="number"
                className="form-control"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={paymentForm.amount}
                onChange={e => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                style={{ fontSize: '1.25rem', fontWeight: '700', textAlign: 'center' }}
                autoFocus
              />
            </div>

            {/* Método de pago */}
            <div className="form-group">
              <label>Método de Pago</label>
              <select
                className="form-control"
                value={paymentForm.method}
                onChange={e => setPaymentForm(prev => ({ ...prev, method: e.target.value }))}
              >
                <option value="Efectivo">💵 Efectivo</option>
                <option value="Transferencia BCP">🏦 Transferencia BCP</option>
                <option value="Yape">📱 Yape</option>
                <option value="Plin">📱 Plin</option>
                <option value="Tarjeta">💳 Tarjeta</option>
                <option value="Por Cobrar">⏳ Pendiente de Cobro</option>
              </select>
            </div>

            {/* Notas */}
            <div className="form-group">
              <label>Notas (opcional)</label>
              <input
                type="text"
                className="form-control"
                placeholder="Observaciones del servicio realizado..."
                value={paymentForm.notes}
                onChange={e => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            {paymentForm.amount && parseFloat(paymentForm.amount) > 0 && (
              <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Total a registrar</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-success)' }}>S/ {parseFloat(paymentForm.amount).toFixed(2)}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>vía {paymentForm.method}</div>
              </div>
            )}
          </div>
        )}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => setPaymentModal(null)}>Cancelar</button>
          <button
            onClick={handleCompleteAndCharge}
            disabled={isPaymentSubmitting || !paymentForm.amount}
            style={{ background: 'var(--color-success)', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.6rem 1.5rem', fontWeight: '700', cursor: 'pointer', opacity: isPaymentSubmitting ? 0.7 : 1 }}
          >
            {isPaymentSubmitting ? 'Registrando...' : '✅ Confirmar Cobro'}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default Agenda;

