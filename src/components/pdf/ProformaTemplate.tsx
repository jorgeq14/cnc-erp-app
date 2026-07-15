import { forwardRef } from 'react';
import './ProformaTemplate.css';

interface ProformaProps {
  quote: any;
  customer: any;
  config: any;
}

const DEFAULT_CONFIG = {
  company_name: 'ZIGMA Láser CNC & Soluciones',
  ruc: '10480834594',
  address: 'Misti 1148, La Victoria',
  phone: '970 275 281',
  bcp_soles_account: '191-33375921-0-50',
  bcp_soles_cci: '002-191-133375921050-57',
  bcp_usd_account: '193-00179350-1-60',
  bcp_usd_cci: '002-193-100179350160-19',
  bank_holder: 'Isamar Silvestre',
  yape: '907 174 716',
};

export const ProformaTemplate = forwardRef<HTMLDivElement, ProformaProps>(({ quote, customer, config }, ref) => {
  if (!quote || !customer) return null;

  const symbol = quote.currency === 'USD' ? '$' : 'S/';
  const cfg = config || DEFAULT_CONFIG;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const dateOnly = dateStr.split('T')[0];
    const [year, month, day] = dateOnly.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div style={{ display: 'none' }}>
      <div ref={ref} className="pdf-container">
        <div className="pdf-header">
          <div className="pdf-logo-area">
            <img src="/zlogo.png" alt="ZIGMA Logo" style={{ height: '90px', objectFit: 'contain' }} />
          </div>
          <div className="pdf-quote-info">
            <h2>PROFORMA</h2>
            <p>{quote.quote_number}</p>
            <p style={{ fontWeight: 'normal', color: '#666' }}>
              Fecha: {formatDate(quote.date || quote.created_at || '')}
            </p>
          </div>
        </div>

        <div className="pdf-customer-section">
          <h3>Cotizado a:</h3>
          <div className="pdf-customer-grid">
            <p><strong>Empresa:</strong> {customer.name}</p>
            <p><strong>Contacto:</strong> {customer.contact || '-'}</p>
            <p><strong>RUC:</strong> {customer.ruc || '-'}</p>
            <p><strong>Teléfono:</strong> {customer.phone || '-'}</p>
            <p><strong>Dirección:</strong> {customer.address || '-'} {customer.location ? `- ${customer.location}` : ''}</p>
          </div>
        </div>

        <table className="pdf-table">
          <thead>
            <tr>
              <th>Ítem / Descripción</th>
              <th>P. Unitario</th>
              <th>Cant.</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {(quote.items || []).map((item: any, index: number) => {
              const lineTotal = Number(item.price) * Number(item.quantity);
              // Siempre mostramos el valor neto (sin IGV) en la tabla
              const showPrice = Number(item.price) / 1.18;
              const showLineTotal = lineTotal / 1.18;
              return (
                <tr key={index}>
                  <td>
                    <strong>{item.name}</strong>
                    {item.description && <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>{item.description}</div>}
                  </td>
                  <td>{symbol} {showPrice.toFixed(2)}</td>
                  <td>{item.quantity}</td>
                  <td>{symbol} {showLineTotal.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="pdf-totals-section">
          <div className="pdf-terms">
            <h4>Términos y Condiciones</h4>
            <p><strong>1.-</strong> Duración de la Oferta <strong>15 días.</strong></p>
            <p><strong>2.-</strong> Pago al contado.</p>
            <p><strong>3.-</strong> Entregado el producto o ejecutado el servicio <strong>no existen devoluciones.</strong></p>
          </div>
          <div className="pdf-totals-box">
            <div className="pdf-totals-row">
              <span>Subtotal</span>
              <span>{symbol} {Number(quote.subtotal).toFixed(2)}</span>
            </div>
            {Number(quote.tax) > 0 && (
              <div className="pdf-totals-row">
                <span>IGV (18%)</span>
                <span>{symbol} {Number(quote.tax).toFixed(2)}</span>
              </div>
            )}
            <div className="pdf-totals-row total">
              <span>TOTAL</span>
              <span>{symbol} {Number(quote.total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {quote.notes && (
          <div style={{ marginTop: '20px', fontSize: '12px' }}>
            <h4 style={{ margin: '0 0 5px 0' }}>Notas Adicionales:</h4>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#555' }}>{quote.notes}</p>
          </div>
        )}

        <div className="pdf-bank-info">
          <h4>Datos para Depósito / Transferencia</h4>
          <div className="pdf-bank-grid" style={{ marginBottom: '8px', borderBottom: '1px solid #ffe0b2', paddingBottom: '8px' }}>
            <p style={{ margin: 0 }}><strong>Titular:</strong> {cfg.bank_holder}</p>
            <p style={{ margin: 0, color: '#ff8000', fontWeight: 'bold' }}>📱 Yape: {cfg.yape}</p>
          </div>
          <div className="pdf-bank-grid">
            <div className="pdf-bank-item">
              <p><strong>Cta. BCP Soles (S/):</strong></p>
              <p>{cfg.bcp_soles_account}</p>
              <p>CCI: {cfg.bcp_soles_cci}</p>
            </div>
            <div className="pdf-bank-item">
              <p><strong>Cta. BCP Dólares ($):</strong></p>
              <p>{cfg.bcp_usd_account}</p>
              <p>CCI: {cfg.bcp_usd_cci}</p>
            </div>
          </div>
        </div>

        <div className="pdf-footer">
          <p>Gracias por confiar en {cfg.company_name}.</p>
        </div>
      </div>
    </div>
  );
});

