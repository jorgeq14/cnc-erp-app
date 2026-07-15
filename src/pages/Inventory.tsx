import { useEffect, useState } from 'react';
import './Customers.css';
import { Search, Plus, AlertTriangle, ArrowDownCircle, ArrowUpCircle, History, Package, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/ui/Modal';
import { logActivity } from '../lib/logger';
import { notifyAllAdmins } from '../lib/notifications';

import type { InventoryItem } from '../types';

interface Movement {
  id: number;
  inventory_id: number;
  product_name: string;
  type: 'entrada' | 'salida';
  quantity: number;
  reference: string;
  notes: string;
  created_at: string;
}

const Inventory = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMov, setLoadingMov] = useState(false);
  const [activeTab, setActiveTab] = useState<'stock' | 'historial'>('stock');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  // Manual movement modal
  const [isMovModalOpen, setIsMovModalOpen] = useState(false);
  const [movForm, setMovForm] = useState({ inventory_id: '', type: 'entrada', quantity: 1, reference: '', notes: '' });

  // Form state
  const [formData, setFormData] = useState({
    sku: '', name: '', category: 'Consumibles', stock: 0, min_stock: 3, price: 0, currency: 'PEN', image_url: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [movSearch, setMovSearch] = useState('');

  useEffect(() => {
    fetchInventory();
    fetchMovements();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('inventory').select('*').order('sku', { ascending: true });
      if (error) throw error;
      if (data) setInventory(data);
    } catch (error) {
      console.error("Error fetching inventory:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMovements = async () => {
    try {
      setLoadingMov(true);
      const { data, error } = await supabase
        .from('inventory_movements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      if (data) setMovements(data);
    } catch (error) {
      console.error("Error fetching movements:", error);
    } finally {
      setLoadingMov(false);
    }
  };

  const filteredInventory = inventory.filter(item => {
    const term = searchTerm.toLowerCase();
    return (item.name || '').toLowerCase().includes(term)
        || (item.sku || '').toLowerCase().includes(term)
        || (item.category || '').toLowerCase().includes(term);
  });

  const filteredMovements = movements.filter(m => {
    const term = movSearch.toLowerCase();
    return (m.product_name || '').toLowerCase().includes(term)
        || (m.reference || '').toLowerCase().includes(term)
        || (m.notes || '').toLowerCase().includes(term);
  });

  const formatPrice = (price: number, currency: string) => {
    try {
      return new Intl.NumberFormat('es-PE', { style: 'currency', currency: (currency && currency.length === 3) ? currency : 'USD' }).format(price || 0);
    } catch {
      return `${currency === 'PEN' ? 'S/' : '$'} ${(price || 0).toFixed(2)}`;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: ['stock', 'min_stock', 'price'].includes(name) ? parseFloat(value) || 0 : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.sku) return alert('El SKU y Nombre son obligatorios');
    try {
      setIsSubmitting(true);
      let query;
      if (editingId) {
        query = supabase.from('inventory').update(formData).eq('id', editingId).select();
      } else {
        query = supabase.from('inventory').insert([formData]).select();
      }
      const { data, error } = await query;
      if (error) {
        if (error.code === '23505') throw new Error('El SKU ya existe. Por favor usa un código único.');
        throw error;
      }
      if (data) {
        if (editingId) {
          setInventory(inventory.map(item => item.id === editingId ? data[0] : item));
          await logActivity('PRODUCTO_EDITADO', `Producto editado: ${formData.name} (SKU: ${formData.sku})`);
          
          if (formData.stock <= formData.min_stock) {
            await notifyAllAdmins(
              '⚠️ Stock Bajo',
              `El producto "${formData.name}" ha llegado a un nivel crítico (${formData.stock} unidades).`,
              'warning',
              '/inventario'
            );
          }
        } else {
          setInventory([...inventory, data[0]]);
          // Registrar entrada inicial
          await supabase.from('inventory_movements').insert([{
            inventory_id: data[0].id,
            product_name: data[0].name,
            type: 'entrada',
            quantity: formData.stock,
            reference: 'Stock inicial',
            notes: `Producto registrado (SKU: ${formData.sku})`,
            created_at: new Date().toISOString()
          }]);
          await logActivity('PRODUCTO_CREADO', `Nuevo producto: ${formData.name}, Stock: ${formData.stock}`);
          await fetchMovements();
        }
        closeModal();
      }
    } catch (error: any) {
      alert(error.message || 'Hubo un error al guardar el producto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Registrar movimiento manual (entrada/salida)
  const handleManualMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movForm.inventory_id || movForm.quantity <= 0) return alert('Selecciona un producto y una cantidad válida.');
    try {
      setIsSubmitting(true);
      const item = inventory.find(i => i.id === parseInt(movForm.inventory_id));
      if (!item) return;

      const currentStock = Number(item.stock) || 0;
      const quantity = Number(movForm.quantity) || 0;
      const delta = movForm.type === 'entrada' ? quantity : -quantity;
      const newStock = Math.max(0, currentStock + delta);

      const { error: updateError } = await supabase.from('inventory').update({ stock: newStock }).eq('id', item.id);
      if (updateError) throw updateError;

      const { error: insertError } = await supabase.from('inventory_movements').insert([{
        inventory_id: item.id,
        product_name: item.name,
        type: movForm.type,
        quantity: quantity,
        reference: movForm.reference || 'Manual',
        notes: movForm.notes,
        created_at: new Date().toISOString()
      }]);
      if (insertError) throw insertError;

      await logActivity('MOVIMIENTO_MANUAL', `${movForm.type === 'entrada' ? 'Entrada' : 'Salida'} de ${quantity} uds. de ${item.name}`);
      setInventory(inventory.map(i => i.id === item.id ? { ...i, stock: newStock } : i));
      
      if (newStock <= item.min_stock) {
        await notifyAllAdmins(
          '⚠️ Alerta de Stock',
          `Stock crítico para "${item.name}": quedan ${newStock} unidades.`,
          'error',
          '/inventario'
        );
      }

      await fetchMovements();
      setIsMovModalOpen(false);
      setMovForm({ inventory_id: '', type: 'entrada', quantity: 1, reference: '', notes: '' });
    } catch (error: any) {
      alert(error.message || 'Error al registrar movimiento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export inventory to Excel
  const exportToExcel = () => {
    // Lazy load xlsx to avoid increasing bundle size unless needed
    import('xlsx').then(XLSX => {
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
      // Add red fill to the whole sheet (simple visual cue)
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
    }).catch(err => console.error('Error loading xlsx', err));
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ sku: '', name: '', category: 'Consumibles', stock: 0, min_stock: 3, price: 0, currency: 'PEN', image_url: '' });
  };

  const openEditModal = (item: InventoryItem) => {
    setFormData({ 
      sku: item.sku, 
      name: item.name, 
      category: item.category || '', 
      stock: item.stock, 
      min_stock: item.min_stock, 
      price: item.price, 
      currency: item.currency || 'PEN',
      image_url: (item as any).image_url || ''
    });
    setEditingId(item.id);
    setIsModalOpen(true);
  };

  const lowStockCount = inventory.filter(i => i.stock <= i.min_stock).length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>📦 Inventario y Productos</h2>
          <p>Controla el stock, entradas y salidas de tus productos CNC.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={() => setIsMovModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ArrowUpCircle size={16} /> Registrar Movimiento
          </button>
          <button className="btn-primary" onClick={() => { setEditingId(null); setFormData({ sku: '', name: '', category: 'Consumibles', stock: 0, min_stock: 3, price: 0, currency: 'PEN', image_url: '' }); setIsModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} /> Nuevo Producto
          </button>
          <button className="btn-secondary" onClick={exportToExcel} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}><Download size={16} /> Exportar Excel</button>
        </div>
      </div>

      {/* Panel de Estadísticas Premium */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--color-primary)' }}>
          <div style={{ background: 'rgba(255,128,0,0.1)', padding: '12px', borderRadius: '12px', color: 'var(--color-primary)' }}>
            <Package size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>Total Productos</p>
            <h3 style={{ fontSize: '1.5rem', margin: 0 }}>{inventory.length}</h3>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--color-danger)' }}>
          <div style={{ background: 'rgba(239,68,68,0.1)', padding: '12px', borderRadius: '12px', color: 'var(--color-danger)' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>Stock Bajo</p>
            <h3 style={{ fontSize: '1.5rem', margin: 0 }}>{lowStockCount}</h3>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--color-success)' }}>
          <div style={{ background: 'rgba(34,197,94,0.1)', padding: '12px', borderRadius: '12px', color: 'var(--color-success)' }}>
            <ArrowDownCircle size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>Valor del Inventario</p>
            <h3 style={{ fontSize: '1.5rem', margin: 0 }}>
              S/ {inventory.reduce((acc, item) => acc + (item.price * item.stock), 0).toLocaleString()}
            </h3>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem' }}>
        {[
          { key: 'stock', label: '📦 Stock Actual', icon: Package },
          { key: 'historial', label: '📋 Historial de Movimientos', icon: History },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} style={{
            padding: '8px 20px', borderRadius: '20px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: activeTab === tab.key ? '700' : '400',
            border: `1.5px solid ${activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-border)'}`,
            background: activeTab === tab.key ? 'rgba(255,128,0,0.15)' : 'transparent',
            color: activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-text-muted)',
            transition: 'all 0.2s',
          }}>
            {tab.label}
            {tab.key === 'historial' && (
              <span style={{ marginLeft: '6px', background: 'rgba(255,128,0,0.2)', color: 'var(--color-primary)', borderRadius: '10px', padding: '1px 7px', fontSize: '0.72rem', fontWeight: '700' }}>
                {movements.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ========= TAB: STOCK ========= */}
      {activeTab === 'stock' && (
        <div className="glass-panel">
          <div className="table-toolbar">
            <div className="search-bar">
              <Search size={18} className="search-icon" />
              <input type="text" placeholder="Buscar por SKU, nombre o categoría..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>

          {/* Desktop */}
          <div className="desktop-only">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Imagen</th><th>SKU</th><th>Nombre del Producto</th><th>Categoría</th>
                  <th>Stock Actual</th><th>Stock Mín.</th><th>Precio Venta</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>Cargando inventario...</td></tr>
                ) : filteredInventory.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>No se encontraron productos.</td></tr>
                ) : (
                  filteredInventory.map((item) => {
                    const isLowStock = item.stock <= item.min_stock;
                    return (
                      <tr key={item.id}>
                        <td>
                          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            { (item as any).image_url ? (
                              <img src={(item as any).image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <Package size={20} color="var(--color-text-muted)" />
                            )}
                          </div>
                        </td>
                        <td className="font-medium" style={{ color: 'var(--color-primary)' }}>{item.sku}</td>
                        <td className="font-medium">{item.name}</td>
                        <td>{item.category || '-'}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className={`badge ${isLowStock ? 'badge-neutral' : 'badge-success'}`} style={isLowStock ? { backgroundColor: 'rgba(239,68,68,0.2)', color: 'var(--color-danger)' } : {}}>
                              {item.stock} und.
                            </span>
                            {isLowStock && <AlertTriangle size={14} color="var(--color-danger)" />}
                          </div>
                        </td>
                        <td style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{item.min_stock} und.</td>
                        <td>{formatPrice(item.price, item.currency)}</td>
                        <td><button className="btn-secondary" onClick={() => openEditModal(item)} style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}>Editar</button></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="mobile-only" style={{ padding: '0.5rem' }}>
            {loading ? (
              <p style={{ textAlign: 'center', padding: '2rem' }}>Cargando inventario...</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {filteredInventory.map((item) => {
                  const isLowStock = item.stock <= item.min_stock;
                  return (
                    <div key={item.id} className="glass-panel" style={{ padding: '1.25rem', borderLeft: `4px solid ${isLowStock ? 'var(--color-danger)' : 'var(--color-primary)'}` }}>
                      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                        <div style={{ width: '60px', height: '60px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden', flexShrink: 0 }}>
                          { (item as any).image_url ? (
                            <img src={(item as any).image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Package size={24} color="var(--color-text-muted)" />
                            </div>
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                            <span style={{ color: 'var(--color-primary)', fontWeight: 'bold', fontSize: '0.85rem' }}>{item.sku}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>{item.category || 'Sin categoría'}</span>
                          </div>
                          <h4 style={{ fontSize: '1rem', margin: 0 }}>{item.name}</h4>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Stock:</p>
                          <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: isLowStock ? 'var(--color-danger)' : 'var(--color-success)' }}>
                            {item.stock} <span style={{ fontSize: '0.8rem', fontWeight: 'normal' }}>uds.</span>
                          </span>
                        </div>
                        <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{formatPrice(item.price, item.currency)}</span>
                      </div>
                      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
                        <button className="btn-secondary" onClick={() => openEditModal(item)} style={{ width: '100%', padding: '0.6rem' }}>Editar Producto</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========= TAB: HISTORIAL ========= */}
      {activeTab === 'historial' && (
        <div className="glass-panel">
          <div className="table-toolbar">
            <div className="search-bar">
              <Search size={18} className="search-icon" />
              <input type="text" placeholder="Buscar por producto, referencia o nota..." value={movSearch} onChange={(e) => setMovSearch(e.target.value)} />
            </div>
          </div>

          {loadingMov ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>Cargando historial...</div>
          ) : filteredMovements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <History size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <p style={{ color: 'var(--color-text-muted)' }}>No hay movimientos registrados aún.</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>Los movimientos aparecen aquí cuando facturas una proforma o registras una entrada manual.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th><th>Tipo</th><th>Producto</th>
                  <th>Cantidad</th><th>Referencia</th><th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{formatDate(m.created_at)}</td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '3px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: '700',
                        background: m.type === 'entrada' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                        color: m.type === 'entrada' ? 'var(--color-success)' : 'var(--color-danger)',
                      }}>
                        {m.type === 'entrada'
                          ? <><ArrowDownCircle size={12} /> Entrada</>
                          : <><ArrowUpCircle size={12} /> Salida</>}
                      </span>
                    </td>
                    <td className="font-medium">{m.product_name}</td>
                    <td>
                      <span style={{ fontWeight: '700', color: m.type === 'entrada' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {m.type === 'entrada' ? '+' : '-'}{m.quantity}
                      </span>
                    </td>
                    <td><span style={{ background: 'rgba(255,128,0,0.1)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.8rem' }}>{m.reference || '-'}</span></td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal: Nuevo/Editar Producto */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingId ? "Editar Producto" : "Registrar Nuevo Producto"}>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Código SKU *</label>
              <input type="text" name="sku" className="form-control" value={formData.sku} onChange={handleInputChange} required placeholder="Ej. LSR-001" />
            </div>
            <div className="form-group">
              <label>Nombre del Producto *</label>
              <input type="text" name="name" className="form-control" value={formData.name} onChange={handleInputChange} required placeholder="Ej. Tubo Láser CO2 100W" />
            </div>
            <div className="form-group">
              <label>Categoría</label>
              <select name="category" className="form-control" value={formData.category} onChange={handleInputChange}>
                <option value="">Seleccione...</option>
                <option value="Repuestos">Repuestos</option>
                <option value="Accesorios">Accesorios</option>
                <option value="Consumibles">Consumibles</option>
                <option value="Servicios">Servicios</option>
              </select>
            </div>
            <div className="form-group">
              <label>URL de Imagen del Producto</label>
              <input type="text" name="image_url" className="form-control" value={formData.image_url} onChange={handleInputChange} placeholder="https://ejemplo.com/foto.jpg" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.8rem' }}>Stock {editingId ? 'Actual' : 'Inicial'}</label>
                <input type="number" name="stock" className="form-control" value={formData.stock} onChange={handleInputChange} required min="0" />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '0.8rem' }}>Stock Mínimo</label>
                <input type="number" name="min_stock" className="form-control" value={formData.min_stock} onChange={handleInputChange} min="0" />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '0.8rem' }}>Moneda</label>
                <select name="currency" className="form-control" value={formData.currency} onChange={handleInputChange}>
                  <option value="PEN">Soles (S/)</option>
                  <option value="USD">Dólares ($)</option>
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontSize: '0.8rem' }}>Precio Unitario</label>
                <input type="number" name="price" className="form-control" value={formData.price} onChange={handleInputChange} step="0.01" min="0" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : (editingId ? 'Actualizar Producto' : 'Guardar Producto')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Movimiento Manual */}
      <Modal isOpen={isMovModalOpen} onClose={() => setIsMovModalOpen(false)} title="Registrar Movimiento de Stock">
        <form onSubmit={handleManualMovement}>
          <div className="modal-body">
            <div className="form-group">
              <label>Tipo de Movimiento</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {['entrada', 'salida'].map(t => (
                  <button key={t} type="button" onClick={() => setMovForm({ ...movForm, type: t })} style={{
                    flex: 1, padding: '0.6rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem',
                    border: `1.5px solid ${movForm.type === t ? (t === 'entrada' ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--color-border)'}`,
                    background: movForm.type === t ? (t === 'entrada' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)') : 'transparent',
                    color: movForm.type === t ? (t === 'entrada' ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--color-text-muted)',
                  }}>
                    {t === 'entrada' ? '⬇️ Entrada' : '⬆️ Salida'}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Producto *</label>
              <select className="form-control" value={movForm.inventory_id} onChange={e => setMovForm({ ...movForm, inventory_id: e.target.value })} required>
                <option value="">Selecciona un producto...</option>
                {inventory.map(i => <option key={i.id} value={i.id}>{i.name} (Stock: {i.stock})</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Cantidad *</label>
                <input type="number" className="form-control" min="1" value={movForm.quantity} onChange={e => setMovForm({ ...movForm, quantity: parseInt(e.target.value) || 1 })} required />
              </div>
              <div className="form-group">
                <label>Referencia</label>
                <input type="text" className="form-control" placeholder="Ej. Compra proveedor" value={movForm.reference} onChange={e => setMovForm({ ...movForm, reference: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>Notas</label>
              <input type="text" className="form-control" placeholder="Motivo o descripción del movimiento..." value={movForm.notes} onChange={e => setMovForm({ ...movForm, notes: e.target.value })} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={() => setIsMovModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : 'Registrar Movimiento'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Inventory;
