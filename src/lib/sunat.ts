import { supabase } from './supabase';

export const sunatService = {
  /**
   * Envía una factura/boleta a la API de Facturación (APISUNAT / Demo)
   */
  async enviarComprobante(venta: any, itemsOverride?: any[]) {
    // 1. Obtener configuración (Token y URL)
    const { data: config } = await supabase.from('settings').select('*').single();
    
    const isFactura = venta.customers?.ruc && venta.customers.ruc.length === 11;
    const docTypeCode = isFactura ? "01" : "03"; // 01 Factura, 03 Boleta
    const prefix = isFactura ? "F001" : "B001";
    const invoiceNumber = (venta.id || 0).toString().padStart(6, '0');

    // Parse items correctly from overrides or database structure
    const rawItems = itemsOverride || venta.ventas_items || venta.quotes?.items || [];
    const items = rawItems.map((item: any, idx: number) => {
      const price = Number(item.price || item.precio_unitario || 0);
      const qty = Number(item.quantity || item.cantidad || 1);
      const totalItem = price * qty;
      const subtotalItem = totalItem / 1.18;
      const igvItem = totalItem - subtotalItem;
      const valUnit = price / 1.18;

      return {
        item: idx + 1,
        unidad_medida: "NIU",
        codigo: item.sku || item.codigo || `P${(idx + 1).toString().padStart(3, '0')}`,
        descripcion: item.product_name || item.name || item.descripcion,
        cantidad: qty,
        valor_unitario: Number(valUnit.toFixed(4)),
        igv: Number(igvItem.toFixed(4)),
        precio_unitario: Number(price.toFixed(4)),
        subtotal: Number(subtotalItem.toFixed(4)),
        total: Number(totalItem.toFixed(4))
      };
    });

    const total = Number(venta.total || 0);
    const subtotal = total / 1.18;
    const igv = total - subtotal;

    // 2. Preparar el JSON para la API (Formato compatible con APISUNAT y Perú CPE)
    const payload = {
      tipo_operacion: "0101",
      tipo_documento: docTypeCode,
      serie: prefix,
      numero: invoiceNumber,
      fecha_emision: new Date().toISOString().split('T')[0],
      moneda: venta.currency || "PEN",
      cliente: {
        tipo_documento: isFactura ? "6" : (venta.customers?.dni ? "1" : "0"), // 6 RUC, 1 DNI, 0 Doc Trib No Domic
        numero_documento: venta.customers?.ruc || venta.customers?.dni || "00000000",
        denominacion: venta.customers?.name || "CLIENTE VARIOS",
        direccion: venta.customers?.address || "Lima, Perú"
      },
      total_gravada: Number(subtotal.toFixed(2)),
      total_igv: Number(igv.toFixed(2)),
      total_venta: Number(total.toFixed(2)),
      items: items
    };

    console.log('JSON de Envío Facturación:', payload);

    // 3. Si no hay token configurado, resolvemos de manera Simulada (Modo DEMO)
    if (!config?.sunat_api_token) {
      console.log('Ejecutando en Modo DEMO (Simulación SUNAT)...');
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            mensaje: `Comprobante ${prefix}-${invoiceNumber} Aceptado por SUNAT (Demo)`,
            pdf_url: null, // Se generará localmente
            external_id: Math.random().toString(36).substring(7)
          });
        }, 1500);
      });
    }

    // 4. Modo real - Petición HTTP a la API configurada (ej. sandbox.apisunat.pe)
    try {
      const url = config.sunat_api_url || 'https://sandbox.apisunat.pe/api/v3/documents';
      console.log('Enviando a API SUNAT Real:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.sunat_api_token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
      }

      const resJson = await response.json();
      return {
        success: true,
        mensaje: resJson.message || `Comprobante ${prefix}-${invoiceNumber} emitido con éxito.`,
        pdf_url: resJson.pdf_url || null,
        external_id: resJson.id || Math.random().toString(36).substring(7)
      };
    } catch (error: any) {
      console.error('Error al conectar con la API SUNAT:', error);
      // Retornar error detallado pero permitir fallback si el usuario desea forzar demo
      throw new Error(`Error en API SUNAT: ${error.message}`);
    }
  }
};
