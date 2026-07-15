import { supabase } from './supabase';
import { getCurrentUser } from './auth';

type ActionType =
  | 'LOGIN' | 'LOGOUT'
  | 'CLIENTE_CREADO' | 'CLIENTE_EDITADO'
  | 'MAQUINA_AÑADIDA' | 'MAQUINA_EDITADA' | 'MAQUINA_ELIMINADA'
  | 'PROFORMA_CREADA' | 'PROFORMA_EDITADA' | 'PROFORMA_ELIMINADA' | 'PDF_GENERADO' | 'WHATSAPP_ENVIADO'
  | 'CITA_AGENDADA' | 'CITA_EDITADA' | 'CITA_CANCELADA' | 'CITA_ELIMINADA' | 'CITA_REAGENDADA'
  | 'SERVICIO_ACTUALIZADO' | 'SERVICIO_ELIMINADO' | 'SERVICIO_COBRADO'
  | 'PRODUCTO_CREADO' | 'PRODUCTO_EDITADO' | 'PRODUCTO_ELIMINADO' | 'PROFORMA_GENERADA'
  | 'MOVIMIENTO_MANUAL' | 'INVENTARIO_ACTUALIZADO';

export const logActivity = async (action: ActionType, description: string) => {
  try {
    const user = getCurrentUser();
    if (!user) return;
    await supabase.from('activity_logs').insert([{
      user_id: user.id,
      user_name: user.name,
      action,
      description,
    }]);
  } catch (e) {
    // Silently fail — logging should never break the app
    console.warn('Activity log failed:', e);
  }
};

export const handleDelete = async (id: number, quotes: any[], setQuotes: Function) => {
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
