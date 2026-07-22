import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Customers.css';
import { Search, Plus, FileText, Trash2, CheckCircle, AlertCircle, Check, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/ui/Modal';
import { ProformaTemplate } from '../components/pdf/ProformaTemplate';
import { InvoiceTemplate } from '../components/pdf/InvoiceTemplate';
import { sunatService } from '../lib/sunat';
import { getCurrentUser } from '../lib/auth';
import html2pdf from 'html2pdf.js';
import { logActivity } from '../lib/logger';

import type { Quote, Customer, InventoryItem } from '../types';

const Quotes = () => {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [productSearch, setProductSearch] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [currency, setCurrency] = useState('PEN');
  const [items, setItems] = useState<any[]>([]);
  const [newItem, setNewItem] = useState({ name: '', description: '', quantity: 1, price: 0 });
  const [notes, setNotes] = useState('');
  const [includeIgv, setIncludeIgv] = useState(true);
  const [itemType, setItemType] = useState<'producto' | 'servicio'>('producto');
  const [filterType, setFilterType] = useState<'pending' | 'history'>('pending');

  // PDF Generation State
  const [pdfQuote, setPdfQuote] = useState<any>(null);
  const [pdfCustomer, setPdfCustomer] = useState<any>(null);
  const [appConfig, setAppConfig] = useState<any>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  // Invoice Generation State
  const [invoicePdfVenta, setInvoicePdfVenta] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('Transferencia');
  const invoicePdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // Fetch quotes with customer data
    const { data: quotesData } = await supabase
      .from('quotes')
      .select('*, customers(*)')
      .order('id', { ascending: false });
    
    if (quotesData) setQuotes(quotesData);

    // Fetch customers for the dropdown
    const { data: custData } = await supabase.from('customers').select('*').order('name');
    if (custData) setCustomers(custData);

    // Fetch inventory for quick item selection
    const { data: invData } = await supabase.from('inventory').select('*').order('name');
    if (invData) setInventory(invData || []);
    
    // Fetch App Config
    const { data: configData } = await supabase.from('settings').select('*').eq('id', 1).single();
    if (configData) setAppConfig(configData);
    
    setLoading(false);
  };

  // El sistema de voz está deshabilitado por el momento


  const handleAddItem = () => {
    if (!newItem.name || newItem.price <= 0 || newItem.quantity <= 0) return alert('Llene nombre, precio y cantidad.');
    setItems([...items, { ...newItem, type: itemType }]);
    setNewItem({ name: '', description: '', quantity: 1, price: 0 });
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const calculateTotals = () => {
    // El usuario ingresa el precio final (con IGV incluido en la mente)
    const grandTotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    
    let subtotal = 0;
    let tax = 0;
    let total = 0;

    if (includeIgv) {
      subtotal = grandTotal / 1.18; // Calculamos el subtotal real hacia atrás
      tax = grandTotal - subtotal;  // El IGV es la diferencia
      total = grandTotal;           // Cobra el precio ingresado original
    } else {
      // Si el cliente quiere "Sin IGV", se le hace el descuento quitándole el 18% al precio final ingresado
      subtotal = grandTotal / 1.18;
      tax = 0;
      total = subtotal;             // Cobra el precio neto (reducido)
    }

    return { subtotal, tax, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return alert('Seleccione un cliente.');
    if (items.length === 0) return alert('Agregue al menos un producto a la proforma.');

    const { subtotal, tax, total } = calculateTotals();

    // Generate consecutive number PRF-00X
    const lastQuote = quotes[0]; // Assuming ordered descending
    let nextNum = 1;
    if (lastQuote && lastQuote.quote_number) {
      const parts = lastQuote.quote_number.split('-');
      if (parts.length === 2) {
        nextNum = parseInt(parts[1]) + 1;
      }
    }
    const quoteNumber = `PRF-${nextNum.toString().padStart(3, '0')}`;

    try {
      setIsSubmitting(true);
      const { data, error } = await supabase.from('quotes').insert([{
        quote_number: quoteNumber,
        customer_id: selectedCustomerId,
        currency: currency,
        date: new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' })).toISOString().split('T')[0],
        items: items,
        subtotal: subtotal,
        tax: tax,
        total: total,
        notes: notes,
        status: 'Generada'
      }]).select('*, customers(*)');

      if (error) {
        if (error.code === '42703') { // undefined column
           throw new Error("Falta ejecutar el ALTER TABLE en Supabase para la columna 'currency'.");
        }
        throw error;
      }
      
      if (data) {
        setQuotes([data[0], ...quotes]);
        await logActivity('PROFORMA_CREADA', `Proforma ${quoteNumber} creada para ${customers.find(c => c.id.toString() === selectedCustomerId)?.name || 'cliente'}. Total: ${currency === 'USD' ? '$' : 'S/'} ${total.toFixed(2)}`);
        resetModal();
      }
    } catch (error: any) {
      console.error("Error saving quote:", error);
      alert('Error: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Desea eliminar esta proforma definitivamente?')) return;
    try {
      const { error } = await supabase.from('quotes').delete().eq('id', id);
      if (error) throw error;
      setQuotes(quotes.filter(q => q.id !== id));
      await logActivity('PROFORMA_ELIMINADA', `Proforma eliminada.`);
    } catch (error) {
      console.error('Error deleting quote:', error);
      alert('No se pudo eliminar la proforma.');
    }
  };

  // PDF Generation Logic
  const handleGeneratePDF = (quote: any) => {
    setPdfQuote(quote);
    setPdfCustomer(quote.customers); // We joined this in the fetch

    // Wait for state to update the DOM, then render PDF
    setTimeout(() => {
      if (pdfRef.current) {
        const opt = {
          margin:       0,
          filename:     `${quote.quote_number}_${quote.customers?.name.replace(/[^a-z0-9]/gi, '_')}.pdf`,
          image:        { type: 'jpeg' as const, quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
          pagebreak:    { mode: 'avoid-all' }
        };
        html2pdf().set(opt).from(pdfRef.current).save().then(async () => {
          await logActivity('PDF_GENERADO', `PDF generado para proforma ${quote.quote_number} - ${quote.customers?.name}`);
          setPdfQuote(null);
          setPdfCustomer(null);
        });
      }
    }, 500);
  };

  const handleWhatsApp = async (quote: any) => {
    const phone = quote.customers?.phone?.replace(/\D/g, ''); // Remove non-numeric
    if (!phone) {
      alert("El cliente no tiene un teléfono registrado.");
      return;
    }
    const symbol = quote.currency === 'USD' ? '$' : 'S/';
    
    // Obtener datos de configuración reales de Supabase
    const { data: configData } = await supabase.from('settings').select('*').eq('id', 1).single();
    
    // Usar datos de la DB, con fallbacks a los valores por defecto de ZIGMA
    const company = configData?.company_name || 'ZIGMA Láser CNC & Soluciones';
    const bcpSoles = configData?.bcp_soles_account || '191-33375921-0-50';
    const cciSoles = configData?.bcp_soles_cci || '002-191-133375921050-57';
    const bcpUsd = configData?.bcp_usd_account || '193-00179350-1-60';
    const cciUsd = configData?.bcp_usd_cci || '002-193-100179350160-19';
    const yapeNum = configData?.yape || '907 174 716';
    const titular = configData?.bank_holder || 'Isamar Silvestre';

    let bankInfo = '';
    if (quote.currency === 'USD') {
      bankInfo = `🏦 *BCP Dólares:* ${bcpUsd}\n🏦 *CCI Dólares:* ${cciUsd}\n👤 *Titular:* ${titular}`;
    } else {
      bankInfo = `🏦 *BCP Soles:* ${bcpSoles}\n🏦 *CCI:* ${cciSoles}\n📱 *Yape/Plin:* ${yapeNum}\n👤 *Titular:* ${titular}`;
    }

    const message = `Hola ${quote.customers?.name}! Somos *${company}*. 🛠️\n\nTe adjuntamos la *Proforma ${quote.quote_number || ''}* por un total de *${symbol} ${Number(quote.total || 0).toFixed(2)}*.\n\nPara confirmar tu pedido, puedes realizar el depósito en:\n\n${bankInfo}\n\nFavor de enviar el comprobante por este medio. ¡Muchas gracias!`;
    
    // Limpiamos el número de teléfono quitando signos, letras y espacios
    let cleanPhone = phone.replace(/\D/g, '');
    
    // Si el usuario guardó el número con el "51" adelante, se lo quitamos para dejar solo los 9 dígitos
    if (cleanPhone.startsWith('51') && cleanPhone.length > 9) {
      cleanPhone = cleanPhone.substring(2);
    }
    
    // Para que WhatsApp Web/App funcione SIEMPRE, requiere el código de país (51 para Perú).
    // Lo agregamos nosotros de forma segura (51 + los 9 dígitos)
    const url = `https://wa.me/51${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    logActivity('WHATSAPP_ENVIADO', `Mensaje WhatsApp enviado a ${quote.customers?.name} para proforma ${quote.quote_number}`);
  };

  const filteredQuotes = quotes.filter(q => {
    const matchesSearch = (q.quote_number?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
                          (q.customers?.name && q.customers.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;

    if (filterType === 'pending') {
      return !q.status || q.status === 'Generada';
    } else {
      return q.status === 'Aprobada' || q.status === 'Facturada';
    }
  });

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(price);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const dateOnly = dateStr.split('T')[0];
    const [year, month, day] = dateOnly.split('-');
    return `${day}/${month}/${year}`;
  };


  const { subtotal, tax, total } = calculateTotals();
  const currentSymbol = currency === 'USD' ? '$' : 'S/';

  const [confirmModal, setConfirmModal] = useState<{ id: number, num: string, hasProducts: boolean, quote: any } | null>(null);
  const [successModal, setSuccessModal] = useState<{ ventaId: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleApprove = async () => {
    if (!confirmModal) return;
    const { id, quote } = confirmModal;
    setConfirmModal(null);
    setLoading(true);

    try {
      if (!quote) throw new Error("Proforma no encontrada");

      // 1. Crear Venta pagada y facturada directamente
      const { data: saleData, error: ventaError } = await supabase
        .from('ventas_realizadas')
        .insert([{
          total: quote.total,
          date: new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' })).toISOString().split('T')[0],
          customer_id: quote.customer_id || quote.customers?.id,
          quote_id: quote.id,
          estado_seguimiento: 'pagado_facturado',
          monto_pagado: quote.total,
          fecha_pago: new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' })).toISOString().split('T')[0],
          metodo_pago: paymentMethod,
          seller_name: getCurrentUser()?.name || 'Administrador'
        }])
        .select('*, customers(*), quotes(*)')
        .single();

      if (ventaError) throw ventaError;

      // 2. Descontar Inventario y Movimientos
      for (const item of quote.items || []) {
        const { data: invData } = await supabase.from('inventory').select('id, stock, name').eq('name', item.name).limit(1);
        if (invData && invData.length > 0) {
          const invItem = invData[0];
          await supabase.from('inventory').update({ stock: Math.max(0, invItem.stock - item.quantity) }).eq('id', invItem.id);
          await supabase.from('inventory_movements').insert([{
            inventory_id: invItem.id,
            product_name: invItem.name,
            type: 'salida',
            quantity: item.quantity,
            reference: 'Venta Proforma ' + (quote.quote_number || ''),
            created_at: new Date().toISOString()
          }]);
        }
      }

      // 3. Enviar a SUNAT (API Demo/Real)
      const resSunat: any = await sunatService.enviarComprobante(saleData, quote.items);
      if (!resSunat.success) {
        throw new Error('Error SUNAT: ' + resSunat.mensaje);
      }

      // 4. Generar PDF localmente y subirlo a Supabase Storage
      setInvoicePdfVenta(saleData);

      setTimeout(async () => {
        if (invoicePdfRef.current) {
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

          const worker = html2pdf().set(opt).from(invoicePdfRef.current);
          const pdfBlob = await worker.output('blob');

          const { error: uploadError } = await supabase.storage
            .from('facturas')
            .upload(fileName, pdfBlob);

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('facturas')
              .getPublicUrl(fileName);

            // Actualizar venta con factura_url
            await supabase
              .from('ventas_realizadas')
              .update({ factura_url: urlData.publicUrl })
              .eq('id', saleData.id);

            // 5. Actualizar estado de proforma a 'Facturada'
            await supabase.from('quotes').update({ status: 'Facturada' }).eq('id', id);

            await logActivity('PROFORMA_EDITADA', `Proforma ${quote.quote_number} convertida directamente a Factura.`);
            alert(`Comprobante ${docNum} emitido y enviado a SUNAT con éxito.`);
          } else {
            console.error('Error al subir PDF:', uploadError);
            await supabase.from('quotes').update({ status: 'Aprobada' }).eq('id', id);
            alert('Se emitió el comprobante, pero hubo un error guardando el PDF.');
          }

          setInvoicePdfVenta(null);
          setQuotes(quotes.map(q => q.id === id ? { ...q, status: 'Facturada' } : q));
          navigate('/facturas');
        }
      }, 1000);

    } catch (err: any) {
      console.error('Error al facturar proforma:', err);
      setErrorMsg(err?.message || 'No se pudo facturar la proforma.');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: number, newStatus: string) => {
    if (newStatus === 'Aprobada' || newStatus === 'Facturada') {
      const quote = quotes.find(q => q.id === id);
      if (quote?.status === 'Facturada') {
        alert('Esta proforma ya ha sido facturada.');
        return;
      }
      const quoteItems = quote?.items || [];
      const hasProducts = quoteItems.some((it: any) => it.type === 'producto' || it.description?.includes('SKU:'));
      
      setConfirmModal({ id, num: quote?.quote_number || `#${id}`, hasProducts, quote });
      return;
    }

    try {
      const { error } = await supabase.from('quotes').update({ status: newStatus }).eq('id', id);
      if (error) throw error;

      setQuotes(quotes.map(q => q.id === id ? { ...q, status: newStatus } : q));
      await logActivity('PROFORMA_EDITADA', `Estado de proforma ID ${id} cambiado a ${newStatus}.`);
    } catch (error) {
      console.error('Error updating status:', error);
      alert('No se pudo actualizar el estado.');
    }
  };


  const resetModal = () => {
    setSelectedCustomerId('');
    setCurrency('PEN');
    setItems([]);
    setNewItem({ name: '', description: '', quantity: 1, price: 0 });
    setNotes('');
    setIncludeIgv(true);
    setIsModalOpen(false);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Proformas y Cotizaciones</h2>
          <p>Genera PDFs y envíalos por WhatsApp a tus clientes.</p>
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Nueva Proforma
        </button>
      </div>

      <div className="glass-panel">
        <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="search-bar" style={{ flex: '1 1 300px' }}>
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Buscar por N° de proforma o cliente..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', background: 'var(--color-bg-light)', padding: '4px', borderRadius: '8px' }}>
            <button 
              className={filterType === 'pending' ? 'btn-primary' : 'btn-icon'} 
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              onClick={() => setFilterType('pending')}
            >
              Pendientes
            </button>
            <button 
              className={filterType === 'history' ? 'btn-primary' : 'btn-icon'} 
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              onClick={() => setFilterType('history')}
            >
              Historial
            </button>
          </div>
        </div>

        {/* VISTA DE ESCRITORIO (TABLA) */}
        <div className="desktop-only">
          <table className="data-table">
            <thead>
              <tr>
                <th>N° Proforma</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Estado</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{textAlign: 'center', padding: '2rem'}}>Cargando proformas...</td></tr>
              ) : filteredQuotes.length === 0 ? (
                <tr><td colSpan={6} style={{textAlign: 'center', padding: '2rem'}}>No hay proformas registradas.</td></tr>
              ) : (
                filteredQuotes.map((quote) => (
                  <tr key={quote.id}>
                    <td className="font-medium" style={{ color: 'var(--color-primary)' }}>{quote.quote_number}</td>
                    <td>{formatDate(quote.date || quote.created_at || '')}</td>
                    <td className="font-medium">{quote.customers?.name || 'Cliente Eliminado'}</td>
                    <td style={{ fontWeight: 'bold' }}>{formatPrice(quote.total || 0, quote.currency)}</td>
                    <td>
                      <span className={`status-badge status-${quote.status?.toLowerCase().replace(' ', '-') || 'generada'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {quote.status || 'Generada'}
                        {quote.status === 'Aprobada' && <AlertCircle size={14} className="pulse" style={{ color: '#ff9800' }} />}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        {quote.status === 'Generada' && (
                          <button className="btn-icon" onClick={() => updateStatus(quote.id, 'Aprobada')} title="Aprobar (Listo para Facturar)" style={{ color: 'var(--color-warning)' }}>
                            <CheckCircle size={20} />
                          </button>
                        )}
                        {quote.status === 'Aprobada' && (
                          <button className="btn-icon" onClick={() => updateStatus(quote.id, 'Facturada')} title="Marcar como Facturada" style={{ color: 'var(--color-success)' }}>
                            <Check size={20} />
                          </button>
                        )}
                        <button className="btn-icon" title="Descargar PDF" onClick={() => handleGeneratePDF(quote)}>
                          <FileText size={20} color="var(--color-text)" />
                        </button>
                        <button className="btn-icon" title="Enviar por WhatsApp" onClick={() => handleWhatsApp(quote)}>
                          <MessageCircle size={20} color="#25D366" />
                        </button>
                        <button className="btn-icon" title="Eliminar" onClick={() => handleDelete(quote.id)}>
                          <Trash2 size={20} color="var(--color-danger)" />
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
            <p style={{ textAlign: 'center', padding: '2rem' }}>Cargando proformas...</p>
          ) : filteredQuotes.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '2rem' }}>No hay proformas registradas.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filteredQuotes.map((quote) => (
                <div key={quote.id} className="glass-panel" style={{ padding: '1rem', borderLeft: `4px solid ${quote.status === 'Facturada' ? 'var(--color-success)' : quote.status === 'Aprobada' ? 'var(--color-warning)' : 'var(--color-primary)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <span style={{ color: 'var(--color-primary)', fontWeight: 'bold', fontSize: '1rem' }}>{quote.quote_number}</span>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>{formatDate(quote.date || quote.created_at || '')}</p>
                    </div>
                    <span className={`status-badge status-${quote.status?.toLowerCase().replace(' ', '-') || 'generada'}`} style={{ fontSize: '0.7rem' }}>
                      {quote.status || 'Generada'}
                    </span>
                  </div>
                  
                  <h4 style={{ margin: '0.5rem 0', fontSize: '1.1rem' }}>{quote.customers?.name || 'Cliente Eliminado'}</h4>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', padding: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Total:</span>
                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--color-primary)' }}>{formatPrice(quote.total || 0, quote.currency)}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-around', gap: '8px', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
                    {quote.status === 'Generada' && (
                      <button className="btn-icon" onClick={() => updateStatus(quote.id, 'Aprobada')} style={{ color: 'var(--color-warning)' }}>
                        <CheckCircle size={22} />
                      </button>
                    )}
                    {quote.status === 'Aprobada' && (
                      <button className="btn-icon" onClick={() => updateStatus(quote.id, 'Facturada')} style={{ color: 'var(--color-success)' }}>
                        <Check size={22} />
                      </button>
                    )}
                    <button className="btn-icon" onClick={() => handleGeneratePDF(quote)}>
                      <FileText size={22} color="var(--color-text)" />
                    </button>
                    <button className="btn-icon" onClick={() => handleWhatsApp(quote)}>
                      <MessageCircle size={22} color="#25D366" />
                    </button>
                    <button className="btn-icon" onClick={() => handleDelete(quote.id)}>
                      <Trash2 size={22} color="var(--color-danger)" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hidden PDF Template rendered only when needed */}
      <ProformaTemplate 
        ref={pdfRef} 
        quote={pdfQuote} 
        customer={pdfCustomer} 
        config={appConfig}
      />

      <InvoiceTemplate 
        ref={invoicePdfRef} 
        venta={invoicePdfVenta} 
        config={appConfig}
      />

      {/* Modal for New Proforma */}
      <Modal isOpen={isModalOpen} onClose={resetModal} title="Crear Nueva Proforma">
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ overflowX: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
              <div className="form-group" style={{ position: 'relative' }}>
                <label>Seleccionar Cliente *</label>
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
                    <span>✓ Cliente seleccionado correctamente</span>
                    <button type="button" onClick={() => {setSelectedCustomerId(''); setCustomerSearch('');}} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.8rem' }}>Cambiar</button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '12px', marginTop: '1.5rem', backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <button 
                  type="button" 
                  onClick={() => setItemType('producto')}
                  style={{ 
                    flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--color-primary)',
                    backgroundColor: itemType === 'producto' ? 'var(--color-primary)' : 'transparent',
                    color: itemType === 'producto' ? 'white' : 'var(--color-primary)',
                    fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  📦 Agregar Producto
                </button>
                <button 
                  type="button" 
                  onClick={() => setItemType('servicio')}
                  style={{ 
                    flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--color-primary)',
                    backgroundColor: itemType === 'servicio' ? 'var(--color-primary)' : 'transparent',
                    color: itemType === 'servicio' ? 'white' : 'var(--color-primary)',
                    fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  🛠️ Agregar Servicio
                </button>
              </div>
              
              {itemType === 'producto' ? (
                <div style={{ position: 'relative', marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.5rem', display: 'block' }}>Buscar en Inventario</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Escribe nombre o SKU..." 
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                  {productSearch && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', zIndex: 100, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                      {inventory
                        .filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase()))
                        .slice(0, 5)
                        .map(p => (
                          <div 
                            key={p.id} 
                            style={{ padding: '0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}
                            onClick={() => {
                              setNewItem({ name: p.name, description: `SKU: ${p.sku}`, quantity: 1, price: p.price });
                              setProductSearch('');
                            }}
                          >
                            <div style={{ fontWeight: '600' }}>{p.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>SKU: {p.sku} | Stock: {p.stock}</div>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Descripción del Servicio</label>
                    <input type="text" className="form-control" placeholder="Ej. Instalación de Tubo Láser..." value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Moneda</label>
                      <select className="form-control" value={currency} onChange={e => setCurrency(e.target.value)}>
                        <option value="PEN">Soles (S/)</option>
                        <option value="USD">Dólares ($)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Precio</label>
                      <input type="number" className="form-control" placeholder="0.00" value={newItem.price || ''} onChange={e => setNewItem({...newItem, price: parseFloat(e.target.value) || 0})} />
                    </div>
                  </div>
                </div>
              )}

              {itemType === 'producto' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Producto Seleccionado</label>
                      <input type="text" className="form-control" value={newItem.name} readOnly style={{ backgroundColor: 'var(--color-surface)' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Cantidad</label>
                        <input type="number" className="form-control" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: parseInt(e.target.value) || 1})} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Precio Unitario</label>
                        <input type="number" className="form-control" value={newItem.price} onChange={e => setNewItem({...newItem, price: parseFloat(e.target.value) || 0})} />
                      </div>
                    </div>
                  </div>
                  <button type="button" className="btn-primary" onClick={handleAddItem} style={{ width: '100%', marginTop: '1.5rem', padding: '0.75rem' }}>
                    ✅ Añadir Producto a la Proforma
                  </button>
                </>
              )}
              
              {itemType === 'servicio' && (
                <button type="button" className="btn-primary" onClick={handleAddItem} style={{ width: '100%', marginTop: '0.5rem' }}>Añadir Servicio a la Proforma</button>
              )}
            </div>

              {/* Added Items List */}
              {items.length > 0 && (
                <div style={{ marginTop: '1.5rem' }}>
                  <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-primary)' }}>Ítems en Proforma:</h5>
                  {items.map((it, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'var(--color-background)', borderRadius: '4px', marginBottom: '0.25rem' }}>
                      <div style={{ fontSize: '0.875rem' }}>
                        <strong>{it.quantity}x</strong> {it.name} <span style={{ color: 'var(--color-text-muted)' }}>- {currentSymbol} {Number(it.price).toFixed(2)} c/u</span>
                      </div>
                      <button type="button" className="btn-icon" onClick={() => handleRemoveItem(idx)}><Trash2 size={16} color="var(--color-danger)"/></button>
                    </div>
                  ))}
                </div>
              )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '1rem', background: 'var(--color-surface-hover)', borderRadius: '8px' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={includeIgv} onChange={e => setIncludeIgv(e.target.checked)} />
                  Incluir IGV (18%)
                </label>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>Subtotal: {currentSymbol} {subtotal.toFixed(2)}</p>
                {includeIgv && <p style={{ margin: 0, fontSize: '0.875rem' }}>IGV: {currentSymbol} {tax.toFixed(2)}</p>}
                <h3 style={{ margin: '0.5rem 0 0 0', color: 'var(--color-primary)' }}>Total: {currentSymbol} {total.toFixed(2)}</h3>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>Notas para el Cliente</label>
              <textarea className="form-control" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej. El precio incluye instalación..."></textarea>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting || items.length === 0}>
              {isSubmitting ? 'Guardando...' : 'Guardar Proforma'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={!!confirmModal} 
        onClose={() => setConfirmModal(null)} 
        title="Emitir Comprobante de Pago (SUNAT)"
      >
        <div style={{ padding: '1rem' }}>
          {confirmModal && (() => {
            const isFact = confirmModal.quote?.customers?.ruc && confirmModal.quote.customers.ruc.length === 11;
            return (
              <div>
                <p style={{ marginBottom: '1.25rem', color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  Se procederá a facturar la proforma <strong>{confirmModal.num}</strong>. Se emitirá el comprobante oficial y se registrará la venta.
                </p>

                <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--color-border)', marginBottom: '1.5rem' }}>
                  <p style={{ margin: '4px 0', fontSize: '0.85rem' }}><strong>Cliente:</strong> {confirmModal.quote?.customers?.name}</p>
                  <p style={{ margin: '4px 0', fontSize: '0.85rem' }}><strong>Documento:</strong> {confirmModal.quote?.customers?.ruc || confirmModal.quote?.customers?.dni || 'No Registrado'}</p>
                  <p style={{ margin: '4px 0', fontSize: '0.85rem' }}><strong>Tipo Comprobante:</strong> <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>{isFact ? 'FACTURA ELECTRÓNICA (F001)' : 'BOLETA ELECTRÓNICA (B001)'}</span></p>
                  <p style={{ margin: '4px 0', fontSize: '0.85rem' }}><strong>Monto Total:</strong> <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>{confirmModal.quote?.currency === 'USD' ? '$' : 'S/'} {Number(confirmModal.quote?.total).toFixed(2)}</span></p>
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>Método de Pago</label>
                  <select 
                    className="form-control" 
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    style={{ width: '100%', fontSize: '0.9rem' }}
                  >
                    <option value="Transferencia">Transferencia Bancaria</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Yape/Plin">Yape / Plin</option>
                  </select>
                </div>

                {confirmModal.hasProducts && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '1.5rem' }}>
                    <AlertCircle size={14} /> Nota: Esta proforma contiene productos, se descontará automáticamente el stock del inventario.
                  </p>
                )}
              </div>
            );
          })()}

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button className="btn-secondary" onClick={() => setConfirmModal(null)}>Cancelar</button>
            <button className="btn-primary" onClick={handleApprove}>
              Emitir y Enviar a SUNAT
            </button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={!!successModal} 
        onClose={() => setSuccessModal(null)} 
        title="✅ Venta Procesada"
      >
        <div style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ 
            width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.1)', 
            color: 'var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem', fontSize: '2rem'
          }}>
            ✓
          </div>
          <p style={{ marginBottom: '1.5rem' }}>
            La venta se ha registrado correctamente con el ID <strong>#{successModal?.ventaId}</strong>.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="btn-secondary" onClick={() => setSuccessModal(null)}>Cerrar</button>
            <button className="btn-primary" onClick={() => navigate('/ventas')}>
              Ir a Seguimiento de Ventas
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast de Error */}
      {errorMsg && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999,
          background: 'var(--color-danger)', color: 'white', padding: '12px 20px',
          borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', gap: '12px', animation: 'fadeInUp 0.3s'
        }}>
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>✕</button>
        </div>
      )}
    </div>
  );
};

export default Quotes;
