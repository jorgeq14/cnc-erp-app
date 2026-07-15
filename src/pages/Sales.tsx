import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { Modal } from '../components/ui/Modal';
import { sunatService } from '../lib/sunat';
import jsPDF from 'jspdf';
import { 
  DndContext, 
  PointerSensor, 
  useSensor, 
  useSensors,
  closestCorners
} from '@dnd-kit/core';
import { 
  SortableContext, 
  verticalListSortingStrategy,
  useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Loader2, 
  Trash2, 
  Search, Filter, Calendar,
  Info,
  Package, CheckCircle, ArrowRight, DollarSign, FileText, Eye
} from 'lucide-react';

// ----- Interfaces -----
type EstadoVenta = 'pendiente_entrega' | 'entregado' | 'pagado_facturado';

interface Venta {
  id: number;
  estado_seguimiento: EstadoVenta;
  total: number;
  date: string;
  customers: { name: string } | null;
  quotes: { quote_number: string } | null;
  monto_pagado?: number;
  fecha_pago?: string;
  metodo_pago?: string;
  factura_url?: string;
  seller_name?: string;
}

interface Historial {
  id: number;
  estado_anterior: string;
  estado_nuevo: string;
  fecha: string;
}

// ----- Tarjeta Blindada -----
function SalesCard({ 
  venta, 
  onAction, 
  isAdmin 
}: { 
  venta: Venta; 
  onAction: (type: string, venta: Venta) => void;
  isAdmin: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: venta.id });

  const daysInStatus = Math.floor((Date.now() - new Date(venta.date).getTime()) / (1000 * 60 * 60 * 24));
  const isDelayed = venta.estado_seguimiento === 'entregado' && daysInStatus > 7;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      {...attributes} 
      {...listeners}
      className="glass-panel"
      style={{
        padding: '1rem',
        marginBottom: '1rem',
        border: isDelayed ? '2px solid var(--color-danger)' : '1px solid var(--color-border)',
        cursor: 'grab',
        position: 'relative',
        ...style
      }}
    >
      {isDelayed && (
        <div style={{ 
          position: 'absolute', top: '-10px', right: '10px', 
          background: 'var(--color-danger)', color: 'white', 
          fontSize: '0.65rem', padding: '2px 8px', borderRadius: '10px',
          fontWeight: 'bold', zIndex: 10
        }}>
          ¡DEMORA!
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>
          {venta.quotes?.quote_number || 'S/N'}
        </span>
        <button 
          onPointerDown={(e) => e.stopPropagation()} 
          onClick={() => onAction('detalles', venta)} 
          style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
        >
          <Info size={14} />
        </button>
      </div>
      
      <div style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
        {venta.customers?.name || 'Cliente Desconocido'}
      </div>
      <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'white' }}>
        S/ {(venta.total || 0).toLocaleString()}
      </div>

      <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--color-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem' }}>
          {(venta.seller_name || 'A').charAt(0)}
        </div>
        <span>{venta.seller_name || 'Sin Asignar'}</span>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginTop: '1rem' }} onPointerDown={(e) => e.stopPropagation()}>
        {venta.estado_seguimiento === 'pendiente_entrega' && (
          <button className="btn-primary" onClick={() => onAction('entregar', venta)} style={{ padding: '4px 8px', fontSize: '0.7rem' }}>
            <Package size={12} /> Entregar
          </button>
        )}
        {venta.estado_seguimiento === 'entregado' && (
          <>
            <button className="btn-secondary" onClick={() => onAction('pagar', venta)} style={{ background: '#10b981', padding: '4px 8px', fontSize: '0.7rem' }}>
              <DollarSign size={12} /> Pagar
            </button>
            <button className="btn-secondary" onClick={() => onAction('facturar', venta)} style={{ padding: '4px 8px', fontSize: '0.7rem' }}>
              <FileText size={12} /> Facturar
            </button>
          </>
        )}
        {venta.estado_seguimiento === 'pagado_facturado' && (
          <>
            {venta.factura_url && (
              <button className="btn-secondary" onClick={() => window.open(venta.factura_url, '_blank')} style={{ background: '#3b82f6', padding: '4px 8px', fontSize: '0.7rem' }}>
                <Eye size={12} /> Ver
              </button>
            )}
            {isAdmin && (
              <button className="btn-icon" onClick={() => onAction('anular', venta)} style={{ color: 'var(--color-danger)' }}>
                <Trash2 size={14} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ----- Componente Principal -----
export default function Sales() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [filteredVentas, setFilteredVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [filterDate, setFilterDate] = useState('');
  
  const user = getCurrentUser();
  const isAdmin = user?.role === 'admin';

  // Estados Modales
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);
  const [historial, setHistorial] = useState<Historial[]>([]);
  const [paymentForm, setPaymentForm] = useState({ monto: 0, fecha: new Date().toISOString().split('T')[0], metodo: 'Transferencia' });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const fetchData = async () => {
    try {
      const { data, error } = await supabase.from('ventas_realizadas').select('*, customers(name), quotes(quote_number)').order('date', { ascending: false });
      if (!error && data) {
        setVentas(data as any);
        setFilteredVentas(data as any);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const filtered = ventas.filter(v => 
      (v.customers?.name || '').toLowerCase().includes(filterText.toLowerCase()) &&
      (!filterDate || v.date.startsWith(filterDate))
    );
    setFilteredVentas(filtered);
  }, [filterText, filterDate, ventas]);

  const handleAction = async (type: string, venta: Venta) => {
    setSelectedVenta(venta);
    if (type === 'entregar') updateStatus(venta.id, 'entregado');
    if (type === 'pagar') { 
      setPaymentForm({ ...paymentForm, monto: venta.total }); 
      setIsPaymentModalOpen(true); 
    }
    if (type === 'facturar') generateInvoice(venta);
    if (type === 'anular') { 
      if (confirm('¿Anular esta venta?')) { 
        await supabase.from('ventas_realizadas').delete().eq('id', venta.id); 
        fetchData(); 
      } 
    }
    if (type === 'detalles') {
      const { data } = await supabase.from('historial_seguimiento').select('*').eq('venta_id', venta.id).order('fecha', { ascending: false });
      setHistorial(data || []);
      setIsDetailsModalOpen(true);
    }
  };

  const updateStatus = async (ventaId: number, nuevoEstado: EstadoVenta) => {
    const venta = ventas.find(v => v.id === ventaId);
    if (!venta) return;

    try {
      // 1. Actualizar el estado de la venta directamente
      const { error: updateError } = await supabase
        .from('ventas_realizadas')
        .update({ estado_seguimiento: nuevoEstado })
        .eq('id', ventaId);

      if (updateError) throw updateError;

      // 2. Registrar en el historial de seguimiento
      await supabase.from('historial_seguimiento').insert([{
        venta_id: ventaId,
        estado_anterior: venta.estado_seguimiento,
        estado_nuevo: nuevoEstado,
        fecha: new Date().toISOString()
      }]);

      fetchData();
    } catch (err: any) {
      console.error("Error al actualizar estado:", err);
      alert("Error al actualizar el estado de la venta: " + err.message);
    }
  };

  const generateInvoice = async (venta: Venta) => {
    setLoading(true);
    try {
      // 1. Enviar a SUNAT (API Demo)
      const respSunat: any = await sunatService.enviarComprobante(venta);
      
      if (!respSunat.success) {
        alert('Error SUNAT: ' + respSunat.mensaje);
        return;
      }

      // 2. Generar PDF visual (Zigma)
      const doc = new jsPDF();
      doc.text(`FACTURA ZIGMA: ${venta.quotes?.quote_number || 'S/N'}`, 20, 20);
      doc.text(`CLIENTE: ${venta.customers?.name || 'Varios'}`, 20, 30);
      doc.text(`TOTAL: S/ ${venta.total}`, 20, 40);
      doc.text(`SUNAT: ${respSunat.mensaje}`, 20, 50);
      
      const pdfBlob = doc.output('blob');
      const fileName = `factura_${venta.id}_${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage.from('facturas').upload(fileName, pdfBlob);
      
      if (!uploadError) {
        const { data } = supabase.storage.from('facturas').getPublicUrl(fileName);
        await supabase.from('ventas_realizadas').update({ 
          factura_url: data.publicUrl,
          estado_seguimiento: 'pagado_facturado' 
        }).eq('id', venta.id);
        
        alert('Factura enviada a SUNAT con éxito.');
        fetchData();
      }
    } catch (err: any) {
      alert('Error en facturación: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const columns: { id: EstadoVenta; title: string; color: string; icon: any }[] = [
    { id: 'pendiente_entrega', title: 'Por Entregar', color: '#3b82f6', icon: <Package size={16} /> },
    { id: 'entregado', title: 'Entregado / P. Pago', color: '#f59e0b', icon: <ArrowRight size={16} /> },
    { id: 'pagado_facturado', title: 'Pagado y Facturado', color: '#10b981', icon: <CheckCircle size={16} /> }
  ];

  if (loading) return <div style={{ textAlign: 'center', padding: '10rem' }}><Loader2 className="animate-spin" size={48} color="var(--color-primary)" /></div>;

  return (
    <div className="page-container" style={{ maxWidth: '100%' }}>
      {/* KPI de Ventas Premium */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid var(--color-success)' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>Ventas Totales (Mes)</p>
          <h3 style={{ fontSize: '1.8rem', margin: '0.5rem 0' }}>S/ {ventas.reduce((acc, v) => acc + v.total, 0).toLocaleString()}</h3>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-success)' }}>↑ 12% vs mes anterior</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid var(--color-warning)' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>Pendiente de Cobro</p>
          <h3 style={{ fontSize: '1.8rem', margin: '0.5rem 0' }}>S/ {ventas.filter(v => v.estado_seguimiento !== 'pagado_facturado').reduce((acc, v) => acc + v.total, 0).toLocaleString()}</h3>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-warning)' }}>{ventas.filter(v => v.estado_seguimiento !== 'pagado_facturado').length} ventas por cobrar</div>
        </div>
      </div>

      {/* Filtros Premium */}
      <div className="glass-panel" style={{ 
        padding: '1.25rem', 
        marginBottom: '2rem', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '1.25rem', 
        flexWrap: 'wrap',
        background: 'rgba(23, 23, 23, 0.4)',
        border: '1px solid rgba(255, 128, 0, 0.15)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
        borderRadius: '16px'
      }}>
        {/* Campo de búsqueda por texto */}
        <div style={{ position: 'relative', flex: 2, minWidth: '280px' }}>
          <Search 
            size={18} 
            style={{ 
              position: 'absolute', 
              left: '14px', 
              top: '50%', 
              transform: 'translateY(-50%)', 
              color: 'var(--color-primary)', 
              opacity: 0.9,
              pointerEvents: 'none'
            }} 
          />
          <input 
            type="text" 
            placeholder="Buscar por cliente o vendedor..." 
            className="form-input" 
            style={{ 
              paddingLeft: '44px', 
              width: '100%',
              fontSize: '0.9rem',
              borderRadius: '12px'
            }}
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
          />
        </div>

        {/* Campo de fecha */}
        <div style={{ position: 'relative', width: '220px', minWidth: '180px' }}>
          <Calendar 
            size={18} 
            style={{ 
              position: 'absolute', 
              left: '14px', 
              top: '50%', 
              transform: 'translateY(-50%)', 
              color: 'var(--color-primary)', 
              opacity: 0.9,
              pointerEvents: 'none',
              zIndex: 10
            }} 
          />
          <input 
            type="date" 
            className="form-input" 
            style={{ 
              width: '100%', 
              paddingLeft: '44px',
              fontSize: '0.9rem',
              borderRadius: '12px'
            }} 
            value={filterDate} 
            onChange={e => setFilterDate(e.target.value)} 
          />
        </div>

        {/* Botón de limpiar filtros */}
        <button 
          className="btn-secondary" 
          onClick={() => { setFilterText(''); setFilterDate(''); }}
          style={{ 
            height: '45px', 
            padding: '0 1.5rem', 
            borderRadius: '12px',
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            background: 'rgba(255, 255, 255, 0.02)',
            transition: 'all 0.25s ease'
          }}
        >
          <Filter size={16} style={{ color: 'var(--color-primary)' }} /> 
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Limpiar</span>
        </button>
      </div>

      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCorners} 
        onDragEnd={e => {
          const vId = Number(e.active.id);
          const tCol = columns.some(c => c.id === e.over?.id) ? e.over?.id as EstadoVenta : (ventas.find(v => v.id === Number(e.over?.id))?.estado_seguimiento);
          if (tCol && tCol !== ventas.find(v => v.id === vId)?.estado_seguimiento) updateStatus(vId, tCol);
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {columns.map(col => (
            <div key={col.id} className="glass-panel" style={{ padding: '1rem', minHeight: '70vh', background: 'rgba(255,255,255,0.01)' }}>
              <div style={{ color: col.color, display: 'flex', gap: '10px', marginBottom: '1.5rem', fontWeight: 'bold', fontSize: '0.85rem' }}>
                {col.icon} {col.title}
              </div>
              <SortableContext items={filteredVentas.filter(v => v.estado_seguimiento === col.id).map(v => v.id)} strategy={verticalListSortingStrategy}>
                <div style={{ minHeight: '100px' }}>
                  {filteredVentas.filter(v => v.estado_seguimiento === col.id).map(venta => (
                    <SalesCard key={venta.id} venta={venta} onAction={handleAction} isAdmin={isAdmin} />
                  ))}
                </div>
              </SortableContext>
            </div>
          ))}
        </div>
      </DndContext>

      {/* Modal Detalles */}
      <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title="Detalles de Venta">
        <div style={{ padding: '1rem' }}>
          <p style={{ marginBottom: '1.5rem' }}><strong>Cliente:</strong> {selectedVenta?.customers?.name}</p>
          <h4 style={{ marginBottom: '1rem', color: 'var(--color-primary)' }}>Línea de Tiempo</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '2px solid var(--color-border)', paddingLeft: '1.5rem' }}>
            {historial.map(h => (
              <div key={h.id}>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{h.estado_anterior} → {h.estado_nuevo}</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{new Date(h.fecha).toLocaleString()}</div>
              </div>
            ))}
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Venta Creada</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{selectedVenta && new Date(selectedVenta.date).toLocaleString()}</div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal Pago */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Registrar Pago">
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!selectedVenta) return;
          const { error } = await supabase.from('ventas_realizadas').update({ 
            monto_pagado: paymentForm.monto, 
            fecha_pago: paymentForm.fecha, 
            metodo_pago: paymentForm.metodo, 
            estado_seguimiento: paymentForm.monto >= selectedVenta.total ? 'pagado_facturado' : 'entregado' 
          }).eq('id', selectedVenta.id);
          if (!error) { setIsPaymentModalOpen(false); fetchData(); }
        }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem' }}>
          <div><label>Monto</label><input type="number" className="form-input" value={paymentForm.monto} onChange={e => setPaymentForm({...paymentForm, monto: Number(e.target.value)})} /></div>
          <div><label>Fecha</label><input type="date" className="form-input" value={paymentForm.fecha} onChange={e => setPaymentForm({...paymentForm, fecha: e.target.value})} /></div>
          <div><label>Método</label><select className="form-input" value={paymentForm.metodo} onChange={e => setPaymentForm({...paymentForm, metodo: e.target.value})}><option>Transferencia</option><option>Efectivo</option><option>Yape/Plin</option></select></div>
          <button type="submit" className="btn-primary">Guardar Pago</button>
        </form>
      </Modal>
    </div>
  );
}
