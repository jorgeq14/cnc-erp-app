import { supabase } from './supabase';

export const sunatService = {
  /**
   * Envía una factura/boleta a la API de Facturación (Demo)
   */
  async enviarComprobante(venta: any) {
    // 1. Obtener configuración (Token y URL)
    const { data: config } = await supabase.from('settings').select('*').single();
    
    if (!config?.sunat_api_token && !config?.sunat_api_url?.includes('test')) {
      throw new Error('Falta configurar el Token de Facturación en Ajustes.');
    }

    // 2. Preparar el JSON para la API (Formato estándar Migo/Nubefact)
    const payload = {
      tipo_operacion: "0101",
      tipo_documento: venta.total > 700 ? "01" : "03", // Factura si es mucho, Boleta si es poco
      serie: venta.total > 700 ? "F001" : "B001",
      numero: venta.id.toString().padStart(6, '0'),
      fecha_emision: new Date().toISOString(),
      cliente_tipo_documento: venta.customers?.ruc ? "6" : "1",
      cliente_numero_documento: venta.customers?.ruc || "00000000",
      cliente_denominacion: venta.customers?.name,
      moneda: "PEN",
      total_gravada: venta.total / 1.18,
      total_igv: venta.total - (venta.total / 1.18),
      total_venta: venta.total,
      items: venta.ventas_items?.map((item: any) => ({
        unidad_medida: "NIU",
        codigo: "P001",
        descripcion: item.product_name,
        cantidad: item.quantity,
        valor_unitario: item.price / 1.18,
        igv: (item.price * item.quantity) - ((item.price * item.quantity) / 1.18),
        precio_unitario: item.price,
        subtotal: item.price * item.quantity,
        total: item.price * item.quantity
      }))
    };

    console.log('Enviando a SUNAT Demo:', payload);

    // 3. Simular llamada a la API (Para el Modo Demo)
    // En producción aquí iría el fetch(config.sunat_api_url, ...)
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          mensaje: "Aceptado por SUNAT (Simulado)",
          pdf_url: "https://demo.migo.pe/invoice/pdf",
          external_id: Math.random().toString(36).substring(7)
        });
      }, 2000);
    });
  }
};
