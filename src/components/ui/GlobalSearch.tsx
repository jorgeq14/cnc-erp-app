import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, FileText, Users, Package, ClipboardList, Wrench } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SearchResult {
  id: number | string;
  title: string;
  subtitle: string;
  type: 'cliente' | 'proforma' | 'inventario' | 'orden' | 'servicio';
  route: string;
}

const TYPE_CONFIG = {
  cliente:    { icon: Users,         label: 'Cliente',    color: '#22c55e' },
  proforma:   { icon: FileText,      label: 'Proforma',   color: '#f59e0b' },
  inventario: { icon: Package,       label: 'Inventario', color: '#3b82f6' },
  orden:      { icon: ClipboardList, label: 'Orden OT',   color: '#a855f7' },
  servicio:   { icon: Wrench,        label: 'Servicio',   color: '#f97316' },
};

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearch = ({ isOpen, onClose }: GlobalSearchProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const term = `%${q}%`;
      const [customers, quotes, inventory, orders] = await Promise.all([
        supabase.from('customers').select('id, name, phone').ilike('name', term).limit(4),
        supabase.from('quotes').select('id, quote_number, customer_name, total').ilike('quote_number', term).limit(4),
        supabase.from('inventory').select('id, name, sku, stock').ilike('name', term).limit(4),
        supabase.from('work_orders').select('id, ot_number, customer_name, status').ilike('ot_number', term).limit(4),
      ]);

      const mapped: SearchResult[] = [
        ...(customers.data || []).map(c => ({
          id: c.id, title: c.name, subtitle: c.phone || 'Sin teléfono',
          type: 'cliente' as const, route: `/clientes/${c.id}`
        })),
        ...(quotes.data || []).map(q => ({
          id: q.id, title: q.quote_number || `Proforma #${q.id}`,
          subtitle: `${q.customer_name || ''} — S/ ${Number(q.total || 0).toFixed(2)}`,
          type: 'proforma' as const, route: '/proformas'
        })),
        ...(inventory.data || []).map(i => ({
          id: i.id, title: i.name, subtitle: `SKU: ${i.sku} — Stock: ${i.stock}`,
          type: 'inventario' as const, route: '/inventario'
        })),
        ...(orders.data || []).map(o => ({
          id: o.id, title: o.ot_number, subtitle: `${o.customer_name} — ${o.status}`,
          type: 'orden' as const, route: '/ordenes-trabajo'
        })),
      ];
      setResults(mapped);
      setSelected(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  const handleSelect = (result: SearchResult) => {
    navigate(result.route);
    onClose();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === 'Enter' && results[selected]) handleSelect(results[selected]);
    if (e.key === 'Escape') onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex',
        alignItems: 'flex-start', justifyContent: 'center', padding: '6rem 1rem 1rem'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="glass-panel"
        style={{ width: '100%', maxWidth: '600px', padding: 0, overflow: 'hidden' }}
      >
        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)' }}>
          <Search size={20} color="var(--color-primary)" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Buscar clientes, proformas, inventario, órdenes..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: '1rem', color: 'var(--color-text)',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {loading && <div style={{ width: '16px', height: '16px', border: '2px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />}
            <kbd style={{ padding: '2px 7px', borderRadius: '5px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>ESC</kbd>
            <button className="btn-icon" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {results.map((r, i) => {
              const cfg = TYPE_CONFIG[r.type];
              const Icon = cfg.icon;
              return (
                <div
                  key={`${r.type}-${r.id}`}
                  onClick={() => handleSelect(r)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '0.85rem 1.25rem', cursor: 'pointer',
                    background: i === selected ? 'rgba(255,255,255,0.05)' : 'transparent',
                    borderLeft: i === selected ? `3px solid ${cfg.color}` : '3px solid transparent',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={() => setSelected(i)}
                >
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
                    background: `${cfg.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Icon size={18} color={cfg.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: '600', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</p>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.subtitle}</p>
                  </div>
                  <span style={{ padding: '2px 9px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '700', background: `${cfg.color}20`, color: cfg.color, flexShrink: 0 }}>
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : query.length >= 2 && !loading ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <Search size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
            <p style={{ margin: 0 }}>Sin resultados para "<strong>{query}</strong>"</p>
          </div>
        ) : query.length === 0 ? (
          <div style={{ padding: '1.5rem 1.25rem' }}>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>Busca en toda la app</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <span key={key} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '12px', background: `${cfg.color}15`, color: cfg.color, fontSize: '0.78rem', fontWeight: '600' }}>
                    <Icon size={13} /> {cfg.label}s
                  </span>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <div style={{ padding: '0.6rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '1rem', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
          <span>↑↓ Navegar</span>
          <span>↵ Abrir</span>
          <span>ESC Cerrar</span>
        </div>
      </div>
    </div>
  );
};
