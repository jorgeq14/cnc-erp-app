/**
 * Definiciones de tipos maestros para ZIGMA ERP
 */

export interface AppUser {
  id: string;
  name: string;
  role: string;
  avatar: string;
}

export interface Customer {
  id: number;
  name: string;
  contact: string;
  phone: string;
  ruc: string;
  status: 'Al Día' | 'Con Deuda' | 'Inactivo' | 'Activo';
  address?: string;
  location?: string;
  location_link?: string;
  notes?: string;
  created_at?: string;
}

export interface InventoryItem {
  id: number;
  sku: string;
  name: string;
  category: string;
  stock: number;
  min_stock: number;
  price: number;
  currency: string;
  created_at?: string;
}

export interface ServiceTicket {
  id: number;
  ticket_number: string;
  customer_id: number;
  machine_id?: number | null;
  scheduled_date: string;
  service_type?: string;
  issue_description: string;
  status: 'Pendiente' | 'Confirmado' | 'En Progreso' | 'Completado' | 'Cancelado' | string;
  priority?: 'Alta' | 'Media' | 'Baja';
  technician_assigned?: string;
  cost: number;
  currency?: string;
  technical_notes?: string;
  created_at?: string;
  customers?: { name: string, contact?: string };
  customer_machines?: { machine_type: string; serial_number: string };
}

export interface Quote {
  id: number;
  quote_number?: string;
  customer_id: number;
  customer_name?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  total_amount?: number;
  currency: string;
  status: 'Borrador' | 'Enviada' | 'Aprobada' | 'Rechazada' | 'Generada' | 'Facturada' | string;
  items: any[];
  notes?: string;
  date?: string;
  created_at?: string;
  customers?: { name: string, contact?: string, phone?: string };
}

export interface ActivityLog {
  id: number;
  user_id: string;
  user_name: string;
  action: string;
  description: string;
  created_at: string;
}

export interface LogEntry {
  id: number;
  user_name: string;
  user_id: string;
  action: string;
  description: string;
  created_at: string;
}

export type OrderStatus = 'Pendiente' | 'En Diseño' | 'En Producción' | 'Corte CNC' | 'Inspección' | 'Terminado' | 'Entregado';
export type Priority = 'Baja' | 'Media' | 'Alta' | 'Urgente';

export interface WorkOrderItem {
  description: string;
  material: string;
  quantity: number;
}

export interface WorkOrderFile {
  name: string;
  url: string;
  type: 'CAD' | 'DXF' | 'PDF' | 'STL' | 'other';
  uploaded_at?: string;
}

export interface WorkOrder {
  id: number;
  ot_number: string;
  quote_id?: number;
  customer_id: number;
  customer_name: string;
  status: OrderStatus;
  priority: Priority;
  items: WorkOrderItem[];
  start_date: string;
  deadline: string;
  completion_date?: string;
  assigned_to?: string;
  files: WorkOrderFile[];
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

