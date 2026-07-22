import { forwardRef } from 'react';
import './InvoiceTemplate.css';

interface InvoiceProps {
  venta: any;
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

export const InvoiceTemplate = forwardRef<HTMLDivElement, InvoiceProps>(({ venta, config }, ref) => {
  if (!venta) return null;

  const symbol = venta.currency === 'USD' ? '$' : 'S/';
  const cfg = config || DEFAULT_CONFIG;

  const isFactura = venta.customers?.ruc && venta.customers.ruc.length === 11;
  const docTypeLabel = isFactura ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA';
  const docTypeCode = isFactura ? '01' : '03';

  // Format invoice number e.g. F001-000042
  const prefix = isFactura ? 'F001' : 'B001';
  const invoiceNumber = `${prefix}-${(venta.id || 0).toString().padStart(6, '0')}`;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const dateOnly = dateStr.split('T')[0];
    const [year, month, day] = dateOnly.split('-');
    return `${day}/${month}/${year}`;
  };

  // Re-calculate math based on include IGV (Peruvian standard)
  const total = Number(venta.total || 0);
  const subtotal = total / 1.18;
  const igv = total - subtotal;

  // Generate QR data following SUNAT standards:
  // RUC Emisor | Tipo Comprobante | Serie | Número | IGV | Total | Fecha Emisión | Tipo Doc Adquiriente | Nro Doc Adquiriente | Hash
  const customerDocType = isFactura ? '6' : (venta.customers?.dni ? '1' : '0');
  const customerDocNumber = venta.customers?.ruc || venta.customers?.dni || '00000000';
  const qrData = `${cfg.ruc}|${docTypeCode}|${prefix}|${(venta.id || 0).toString().padStart(6, '0')}|${igv.toFixed(2)}|${total.toFixed(2)}|${formatDate(venta.date)}|${customerDocType}|${customerDocNumber}|`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=0&data=${encodeURIComponent(qrData)}`;

  // Parse items. Some structures have items from quotes, or we might need to fallback.
  // We can fetch from venta.ventas_items or venta.quotes?.items.
  const rawItems = venta.ventas_items || venta.quotes?.items || [];
  
  return (
    <div style={{ display: 'none' }}>
      <div ref={ref} className="pdf-invoice-container">
        {/* Header Section */}
        <div className="pdf-invoice-header">
          <div className="pdf-invoice-logo-side">
            <img src="/zlogo.png" alt="ZIGMA Logo" style={{ height: '80px', objectFit: 'contain' }} />
            <div className="pdf-invoice-company-details">
              <h1>{cfg.company_name}</h1>
              <p>{cfg.address}</p>
              <p>Teléfono: {cfg.phone}</p>
              <p>Email: contacto@zigma.pe</p>
            </div>
          </div>
          <div className="pdf-invoice-ruc-box">
            <h3>R.U.C. {cfg.ruc}</h3>
            <div className="pdf-invoice-doc-title">{docTypeLabel}</div>
            <h2>{invoiceNumber}</h2>
          </div>
        </div>

        {/* Client Section */}
        <div className="pdf-invoice-client-section">
          <table className="pdf-invoice-client-table">
            <tbody>
              <tr>
                <td><strong>Adquiriente:</strong></td>
                <td>{venta.customers?.name || 'Cliente Desconocido'}</td>
                <td><strong>Fecha de Emisión:</strong></td>
                <td>{formatDate(venta.date)}</td>
              </tr>
              <tr>
                <td><strong>Dirección:</strong></td>
                <td>{venta.customers?.address || 'Lima, Perú'}</td>
                <td><strong>Moneda:</strong></td>
                <td>{venta.currency || 'PEN'} ({venta.currency === 'USD' ? 'Dólares' : 'Soles'})</td>
              </tr>
              <tr>
                <td><strong>{isFactura ? 'R.U.C.:' : 'Documento (DNI):'}</strong></td>
                <td>{customerDocNumber}</td>
                <td><strong>Forma de Pago:</strong></td>
                <td>Al Contado - {venta.metodo_pago || 'Transferencia'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Items Table */}
        <table className="pdf-invoice-items-table">
          <thead>
            <tr>
              <th>Ítem</th>
              <th>Descripción</th>
              <th style={{ textAlign: 'center' }}>Cant.</th>
              <th style={{ textAlign: 'right' }}>Valor Unit.</th>
              <th style={{ textAlign: 'right' }}>Importe</th>
            </tr>
          </thead>
          <tbody>
            {rawItems.length > 0 ? (
              rawItems.map((item: any, index: number) => {
                const qty = Number(item.quantity || 1);
                const price = Number(item.price || 0);
                const itemTotal = price * qty;
                const itemSubtotal = itemTotal / 1.18;
                const itemValUnit = price / 1.18;
                return (
                  <tr key={index}>
                    <td>{(index + 1).toString().padStart(2, '0')}</td>
                    <td>
                      <strong>{item.name}</strong>
                      {item.description && <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>{item.description}</div>}
                    </td>
                    <td style={{ textAlign: 'center' }}>{qty}</td>
                    <td style={{ textAlign: 'right' }}>{symbol} {itemValUnit.toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>{symbol} {itemSubtotal.toFixed(2)}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td>01</td>
                <td>
                  <strong>Por venta de productos/servicios según proforma {venta.quotes?.quote_number || ''}</strong>
                </td>
                <td style={{ textAlign: 'center' }}>1</td>
                <td style={{ textAlign: 'right' }}>{symbol} {subtotal.toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>{symbol} {subtotal.toFixed(2)}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totals & QR Section */}
        <div className="pdf-invoice-totals-area">
          <div className="pdf-invoice-qr-legal">
            <img src={qrCodeUrl} alt="SUNAT QR" className="pdf-invoice-qr" />
            <div className="pdf-invoice-legal-text">
              <p>Representación impresa de la {docTypeLabel.toLowerCase()}</p>
              <p>Autorizado mediante resolución SUNAT.</p>
              <p>El emisor electrónico puede verificar el comprobante ingresando a la web de SUNAT.</p>
            </div>
          </div>
          <div className="pdf-invoice-totals-box">
            <div className="pdf-invoice-total-row">
              <span>Op. Gravadas:</span>
              <span>{symbol} {subtotal.toFixed(2)}</span>
            </div>
            <div className="pdf-invoice-total-row">
              <span>IGV (18%):</span>
              <span>{symbol} {igv.toFixed(2)}</span>
            </div>
            <div className="pdf-invoice-total-row final-total">
              <span>Importe Total:</span>
              <span>{symbol} {total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div className="pdf-invoice-bank-details">
          <h4>Datos de Pago de la Empresa</h4>
          <div className="pdf-invoice-bank-grid">
            <div>
              <p><strong>Titular:</strong> {cfg.bank_holder}</p>
              <p><strong>Yape:</strong> {cfg.yape}</p>
            </div>
            <div>
              <p><strong>BCP Soles:</strong> {cfg.bcp_soles_account}</p>
              <p><strong>CCI Soles:</strong> {cfg.bcp_soles_cci}</p>
            </div>
            <div>
              <p><strong>BCP Dólares:</strong> {cfg.bcp_usd_account}</p>
              <p><strong>CCI Dólares:</strong> {cfg.bcp_usd_cci}</p>
            </div>
          </div>
        </div>

        {/* Legal Disclaimer */}
        <div className="pdf-invoice-footer">
          <p>Esta es una copia de prueba legal de facturación electrónica. Desarrollado por ZIGMA.</p>
        </div>
      </div>
    </div>
  );
});
