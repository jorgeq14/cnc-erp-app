import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { logActivity } from '../lib/logger';
import { sunatService } from '../lib/sunat';
import { Modal } from '../components/ui/Modal';
import { InvoiceTemplate } from '../components/pdf/InvoiceTemplate';
import html2pdf from 'html2pdf.js';
import { 
  Search, Calendar, FileText, 
  MessageCircle, Loader2, Plus
} from 'lucide-react';
import './Customers.css';

interface InvoiceVenta {
  id: number;
  quote_id: number | null;
  customer_id: number;
  total: number;
  date: string;
  estado_seguimiento: string;
  metodo_pago: string | null;
  fecha_pago: string | null;
  monto_pagado: number | null;
  factura_url: string | null;
  seller_name: string | null;
  customers: {
    name: string;
    ruc: string | null;
    dni: string | null;
    address: string | null;
    phone: string | null;
  } | null;
  quotes: {
    quote_number: string;
    items: any[];
  } | null;
  currency?: string;
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<InvoiceVenta[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<InvoiceVenta[]>([]);
  const [approvedQuotes, setApprovedQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'factura' | 'boleta'>('all');
  
  // Modal State
  const [isNewInvoiceOpen, setIsNewInvoiceOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Transferencia');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // PDF Generation State
  const [pdfVenta, setPdfVenta] = useState<any>(null);
  const [appConfig, setAppConfig] = useState<any>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch sales that have a invoice (or are paid/invoiced)
      const { data: salesData, error: salesError } = await supabase
        .from('ventas_realizadas')
        .select('*, customers(*), quotes(*)')
        .order('id', { ascending: false });

      if (salesError) throw salesError;

      // Filter local state to only show invoiced ones (estado_seguimiento === 'pagado_facturado' or has factura_url)
      const invoicedSales = (salesData || []).filter(
        (s: any) => s.estado_seguimiento === 'pagado_facturado' || s.factura_url
      ) as InvoiceVenta[];

      setInvoices(invoicedSales);
      setFilteredInvoices(invoicedSales);

      // 2. Fetch approved quotes that haven't been billed yet
      const { data: quotesData } = await supabase
        .from('quotes')
        .select('*, customers(*)')
        .eq('status', 'Aprobada')
        .order('id', { ascending: false });

      setApprovedQuotes(quotesData || []);

      // 3. Fetch app config
      const { data: configData } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .single();
      if (configData) setAppConfig(configData);

    } catch (err: any) {
      console.error('Error fetching invoices:', err);
      alert('Error al cargar comprobantes: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter logic
  useEffect(() => {
    let result = invoices;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(inv => {
        const isFactura = inv.customers?.ruc && inv.customers.ruc.length === 11;
        const prefix = isFactura ? 'F001' : 'B001';
        const docNum = `${prefix}-${inv.id.toString().padStart(6, '0')}`;
        return (
          inv.customers?.name?.toLowerCase().includes(term) ||
          inv.customers?.ruc?.includes(term) ||
          inv.customers?.dni?.includes(term) ||
          docNum.toLowerCase().includes(term) ||
          inv.quotes?.quote_number?.toLowerCase().includes(term)
        );
      });
    }

    // Date filter
    if (filterDate) {
      result = result.filter(inv => inv.date?.startsWith(filterDate));
    }

    // Type filter
    if (filterType !== 'all') {
      result = result.filter(inv => {
        const isFactura = inv.customers?.ruc && inv.customers.ruc.length === 11;
        return filterType === 'factura' ? isFactura : !isFactura;
      });
    }

    setFilteredInvoices(result);
  }, [searchTerm, filterDate, filterType, invoices]);

  // Generate PDF Invoice
  const handleDownloadPDF = (venta: InvoiceVenta) => {
    if (venta.factura_url) {
      // If we already have the URL, just open it
      window.open(venta.factura_url, '_blank');
      return;
    }

    setPdfVenta(venta);
    
    setTimeout(() => {
      if (pdfRef.current) {
        const isFact = venta.customers?.ruc && venta.customers.ruc.length === 11;
        const prefix = isFact ? 'F001' : 'B001';
        const docNum = `${prefix}-${venta.id.toString().padStart(6, '0')}`;
        const fileName = `factura_${docNum}_${venta.customers?.name.replace(/[^a-z0-9]/gi, '_')}.pdf`;

        const opt = {
          margin:       0,
          filename:     fileName,
          image:        { type: 'jpeg' as const, quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
          pagebreak:    { mode: 'avoid-all' }
        };

        html2pdf().set(opt).from(pdfRef.current).save().then(async () => {
          await logActivity('PDF_GENERADO', `PDF de factura ${docNum} descargado.`);
          setPdfVenta(null);
        });
      }
    }, 500);
  };

  // WhatsApp share
  const handleWhatsApp = (venta: InvoiceVenta) => {
    const phone = venta.customers?.phone?.replace(/\D/g, '');
    if (!phone) {
      alert("El cliente no tiene un teléfono registrado.");
      return;
    }

    const isFact = venta.customers?.ruc && venta.customers.ruc.length === 11;
    const prefix = isFact ? 'F001' : 'B001';
    const docNum = `${prefix}-${venta.id.toString().padStart(6, '0')}`;
    const symbol = venta.currency === 'USD' ? '$' : 'S/';

    const company = appConfig?.company_name || 'ZIGMA Láser CNC & Soluciones';

    const message = `Hola ${venta.customers?.name}! Le saludamos de *${company}*.\n\nLe adjuntamos el link de su comprobante electrónico *${docNum}* por un total de *${symbol} ${Number(venta.total).toFixed(2)}*.\n\n📄 Ver PDF: ${venta.factura_url || '(Generándose)'}\n\n¡Muchas gracias por su preferencia!`;

    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('51') && cleanPhone.length > 9) {
      cleanPhone = cleanPhone.substring(2);
    }

    const url = `https://wa.me/51${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    logActivity('WHATSAPP_ENVIADO', `Factura ${docNum} enviada por WhatsApp.`);
  };

  // Submit billing from approved quote
  const handleIssueInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuoteId) return alert('Seleccione una proforma.');
    
    setIsSubmitting(true);
    try {
      const quote = approvedQuotes.find(q => q.id.toString() === selectedQuoteId);
      if (!quote) throw new Error('Proforma no encontrada.');

      // 1. Create sale record in `ventas_realizadas`
      const { data: saleData, error: saleError } = await supabase
        .from('ventas_realizadas')
        .insert([{
          total: quote.total,
          date: new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' })).toISOString().split('T')[0],
          customer_id: quote.customer_id,
          quote_id: quote.id,
          estado_seguimiento: 'pagado_facturado',
          monto_pagado: quote.total,
          fecha_pago: new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' })).toISOString().split('T')[0],
          metodo_pago: paymentMethod,
          seller_name: getCurrentUser()?.name || 'Administrador'
        }])
        .select('*, customers(*), quotes(*)')
        .single();

      if (saleError) throw saleError;

      // 2. Discount Stock and register movements
      for (const item of quote.items || []) {
        const { data: invData } = await supabase
          .from('inventory')
          .select('id, stock, name')
          .eq('name', item.name)
          .limit(1);

        if (invData && invData.length > 0) {
          const invItem = invData[0];
          await supabase
            .from('inventory')
            .update({ stock: Math.max(0, invItem.stock - item.quantity) })
            .eq('id', invItem.id);

          await supabase.from('inventory_movements').insert([{
            inventory_id: invItem.id,
            product_name: invItem.name,
            type: 'salida',
            quantity: item.quantity,
            reference: `Facturación Proforma ${quote.quote_number}`,
            created_at: new Date().toISOString()
          }]);
        }
      }

      // 3. Send to SUNAT (API)
      const resSunat: any = await sunatService.enviarComprobante(saleData, quote.items);
      
      if (!resSunat.success) {
        throw new Error('SUNAT Error: ' + resSunat.mensaje);
      }

      // 4. Generate local PDF and upload to Supabase Storage
      const docRef = document.createElement('div');
      document.body.appendChild(docRef);
      
      // Temporary setup to render HTML and upload
      setPdfVenta(saleData);
      
      setTimeout(async () => {
        if (pdfRef.current) {
          const isFact = quote.customers?.ruc && quote.customers.ruc.length === 11;
          const prefix = isFact ? 'F001' : 'B001';
          const docNum = `${prefix}-${saleData.id.toString().padStart(6, '0')}`;
          const fileName = `factura_${docNum}_${Date.now()}.pdf`;

          const opt = {
            margin:       0,
            filename:     fileName,
            image:        { type: 'jpeg' as const, quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
            pagebreak:    { mode: 'avoid-all' }
          };

          // Generate blob and upload
          const worker = html2pdf().set(opt).from(pdfRef.current);
          const pdfBlob = await worker.output('blob');
          
          const { error: uploadError } = await supabase.storage
            .from('facturas')
            .upload(fileName, pdfBlob);

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('facturas')
              .getPublicUrl(fileName);

            // 5. Update sale with factura_url and quote status to Facturada
            await supabase
              .from('ventas_realizadas')
              .update({ factura_url: urlData.publicUrl })
              .eq('id', saleData.id);

            await supabase
              .from('quotes')
              .update({ status: 'Facturada' })
              .eq('id', quote.id);

            await logActivity('PROFORMA_EDITADA', `Comprobante ${docNum} emitido correctamente.`);
            alert(`Comprobante ${docNum} emitido con éxito y enviado a SUNAT.`);
          } else {
            console.error('Error al subir PDF a Storage:', uploadError);
            alert('El comprobante se firmó pero hubo un error guardando el PDF.');
          }

          setPdfVenta(null);
          setIsNewInvoiceOpen(false);
          setSelectedQuoteId('');
          fetchData();
        }
      }, 1000);

    } catch (err: any) {
      console.error(err);
      alert('Error en facturación: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const dateOnly = dateStr.split('T')[0];
    const [year, month, day] = dateOnly.split('-');
    return `${day}/${month}/${year}`;
  };

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: currency || 'PEN',
    }).format(price);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Facturación Electrónica</h2>
          <p>Consulta, descarga y emite facturas y boletas electrónicas SUNAT.</p>
        </div>
        <button className="btn-primary" onClick={() => setIsNewInvoiceOpen(true)}>
          <Plus size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Emitir Factura
        </button>
      </div>

      <div className="glass-panel">
        {/* Filters and Search */}
        <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="search-bar" style={{ flex: '1 1 300px' }}>
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Buscar por comprobante, cliente o RUC..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {/* Filter Date */}
            <div style={{ position: 'relative' }}>
              <Calendar size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-primary)' }} />
              <input 
                type="date" 
                className="form-control" 
                style={{ paddingLeft: '32px', fontSize: '0.85rem', width: '150px' }} 
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
              />
            </div>

            {/* Filter Type */}
            <select 
              className="form-control" 
              style={{ fontSize: '0.85rem', width: '130px' }}
              value={filterType}
              onChange={e => setFilterType(e.target.value as any)}
            >
              <option value="all">Todos</option>
              <option value="factura">Facturas</option>
              <option value="boleta">Boletas</option>
            </select>
          </div>
        </div>

        {/* Table of Invoices */}
        <div className="desktop-only">
          <table className="data-table">
            <thead>
              <tr>
                <th>Comprobante</th>
                <th>Fecha Emisión</th>
                <th>Cliente</th>
                <th>RUC / DNI</th>
                <th>Método de Pago</th>
                <th>Total</th>
                <th>Estado SUNAT</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{textAlign: 'center', padding: '2rem'}}>Cargando comprobantes...</td></tr>
              ) : filteredInvoices.length === 0 ? (
                <tr><td colSpan={8} style={{textAlign: 'center', padding: '2rem'}}>No se encontraron facturas o boletas emitidas.</td></tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const isFact = inv.customers?.ruc && inv.customers.ruc.length === 11;
                  const prefix = isFact ? 'F001' : 'B001';
                  const docNum = `${prefix}-${inv.id.toString().padStart(6, '0')}`;
                  return (
                    <tr key={inv.id}>
                      <td className="font-medium" style={{ color: 'var(--color-primary)' }}>{docNum}</td>
                      <td>{formatDate(inv.date)}</td>
                      <td className="font-medium">{inv.customers?.name || 'Cliente Varios'}</td>
                      <td>{inv.customers?.ruc || inv.customers?.dni || '-'}</td>
                      <td>{inv.metodo_pago || 'Transferencia'}</td>
                      <td style={{ fontWeight: 'bold' }}>{formatPrice(inv.total, inv.currency || 'PEN')}</td>
                      <td>
                        <span className="status-badge status-aprobada" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                          ✓ Aceptado
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                          <button className="btn-icon" title="Ver PDF / Descargar" onClick={() => handleDownloadPDF(inv)}>
                            <FileText size={20} color="var(--color-text)" />
                          </button>
                          <button className="btn-icon" title="Enviar por WhatsApp" onClick={() => handleWhatsApp(inv)}>
                            <MessageCircle size={20} color="#25D366" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Layout */}
        <div className="mobile-only" style={{ padding: '0.5rem' }}>
          {loading ? (
            <p style={{ textAlign: 'center', padding: '2rem' }}>Cargando comprobantes...</p>
          ) : filteredInvoices.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '2rem' }}>No se encontraron comprobantes.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filteredInvoices.map((inv) => {
                const isFact = inv.customers?.ruc && inv.customers.ruc.length === 11;
                const prefix = isFact ? 'F001' : 'B001';
                const docNum = `${prefix}-${inv.id.toString().padStart(6, '0')}`;
                return (
                  <div key={inv.id} className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #22c55e' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>{docNum}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{formatDate(inv.date)}</span>
                    </div>
                    <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{inv.customers?.name || 'Cliente Varios'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                      Pago: {inv.metodo_pago || 'Transferencia'} | Doc: {inv.customers?.ruc || inv.customers?.dni || 'Varios'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{formatPrice(inv.total, inv.currency || 'PEN')}</span>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="btn-icon" onClick={() => handleDownloadPDF(inv)}>
                          <FileText size={20} />
                        </button>
                        <button className="btn-icon" onClick={() => handleWhatsApp(inv)}>
                          <MessageCircle size={20} color="#25D366" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Hidden Invoice PDF Template */}
      <InvoiceTemplate ref={pdfRef} venta={pdfVenta} config={appConfig} />

      {/* Modal Emitir Factura desde Proforma */}
      <Modal isOpen={isNewInvoiceOpen} onClose={() => setIsNewInvoiceOpen(false)} title="Emitir Factura Electrónica (SUNAT)">
        <form onSubmit={handleIssueInvoice}>
          <div className="modal-body">
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
              Para ahorrar tiempo, selecciona una proforma aprobada por tu cliente. El sistema convertirá todo el contenido en una factura o boleta de venta electrónica SUNAT de forma automática.
            </p>

            <div className="form-group">
              <label>Seleccionar Proforma Aprobada *</label>
              <select 
                className="form-control" 
                value={selectedQuoteId}
                onChange={e => setSelectedQuoteId(e.target.value)}
                required
              >
                <option value="">-- Selecciona una Proforma Aprobada --</option>
                {approvedQuotes.map(q => (
                  <option key={q.id} value={q.id}>
                    {q.quote_number} - {q.customers?.name} ({q.currency === 'USD' ? '$' : 'S/'} {Number(q.total).toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            {selectedQuoteId && (() => {
              const quote = approvedQuotes.find(q => q.id.toString() === selectedQuoteId);
              if (!quote) return null;
              const isFact = quote.customers?.ruc && quote.customers.ruc.length === 11;
              return (
                <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                  <h4 style={{ color: 'var(--color-primary)', marginBottom: '0.75rem', fontSize: '0.9rem' }}>Resumen del Comprobante</h4>
                  <p style={{ margin: '4px 0', fontSize: '0.85rem' }}><strong>Cliente:</strong> {quote.customers?.name}</p>
                  <p style={{ margin: '4px 0', fontSize: '0.85rem' }}><strong>{isFact ? 'R.U.C.:' : 'D.N.I.:'}</strong> {quote.customers?.ruc || quote.customers?.dni || 'No Registrado'}</p>
                  <p style={{ margin: '4px 0', fontSize: '0.85rem' }}><strong>Tipo a Emitir:</strong> <span style={{ color: '#22c55e', fontWeight: 'bold' }}>{isFact ? 'FACTURA ELECTRÓNICA (F001)' : 'BOLETA ELECTRÓNICA (B001)'}</span></p>
                  
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                    <span>Total a Facturar:</span>
                    <span style={{ color: 'var(--color-primary)' }}>{quote.currency === 'USD' ? '$' : 'S/'} {Number(quote.total).toFixed(2)}</span>
                  </div>
                </div>
              );
            })()}

            <div className="form-group" style={{ marginTop: '1.5rem' }}>
              <label>Método de Pago</label>
              <select 
                className="form-control" 
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
              >
                <option value="Transferencia">Transferencia Bancaria</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Yape/Plin">Yape / Plin</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={() => setIsNewInvoiceOpen(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting || !selectedQuoteId}>
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" style={{ marginRight: '8px', verticalAlign: 'middle', display: 'inline' }} />
                  Firmando y Enviando...
                </>
              ) : 'Emitir y Enviar a SUNAT'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
