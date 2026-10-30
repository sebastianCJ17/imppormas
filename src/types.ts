/**
 * Types and Interfaces for the Plan Separe Impormax Platform.
 */

export interface Product {
  id: string;
  code?: string;            // Código numérico interno del producto en ERP (ej: 8020156)
  reference?: string;       // Referencia comercial del producto en ERP (ej: BHK01263R)
  name: string;
  description: string;
  observations?: string;    // Observaciones generales del producto en ERP (observacionesGenerales)
  price: number;
  discountPrice?: number;
  discountPercentage?: number;
  imageUrl: string;
  images?: string[];
  fallbackImageUrl?: string;
  stock: number;
  separePercentage: number; // minimum down payment percentage (e.g. 20 for 20%)
  features: string[];
  dimensions?: string; // e.g. "Altura 2.20m, Diámetro 1.30m"
  category?: string;
  subCategory?: string;
  color?: string;
  height?: string;
  similarCodes?: string[];
  publicationDate?: string; // Fecha de publicación en tienda / ERP (ISO string)
  createdAt?: string;       // Fecha de creación inicial
  isNew?: boolean;          // Indicador de producto nuevo (<= 15 días desde publicación)
  videoUrl?: string;        // URL o path del video demostrativo del producto (ej: /video-8050930.mp4)
}

export type OrderStatus = 'pending' | 'pendiente' | 'abonando' | 'pagado' | 'cancelado';

export interface OrderItem {
  id?: string;
  order_id?: string;
  product_id: string;
  product_reference?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  price?: number; // compatibilidad
  discount_percentage?: number;
  discount_amount?: number;
  subtotal?: number;
  tax?: number;
  total?: number;
  warehouse_origin?: string;
  warehouse_destination?: string;
}

export interface Order {
  id: string; // e.g. IMP-2026-XXXX o UUID
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_document: string; // Cédula/NIT
  product_id: string;
  product_name: string;
  subtotal_amount?: number; // Total antes de descuento
  discount_amount?: number; // Descuento primera orden u otros
  is_first_order?: boolean;
  total_amount: number;
  deposit_amount: number; // initial pay
  paid_amount: number; // sum of approved payments
  balance_pending: number; // total_amount - paid_amount
  status: OrderStatus;
  shipping_address: string;
  shipping_city: string;
  notes?: string;
  observaciones?: string;
  payment_method?: string;
  wompi_reference?: string;
  wompi_transaction_id?: string;
  yeminus_document_id?: string;
  yeminus_sync_status?: 'PENDING' | 'SYNCED' | 'ERP_SYNC_FAILED' | 'MANUAL_REQUIRED';
  yeminus_last_error?: string;
  items?: OrderItem[];
  created_at: string;
  updated_at?: string;
}

export type PaymentMethod = 'wompi' | 'transferencia' | 'bre-b' | 'pse' | 'nequi' | 'daviplata';
export type PaymentStatus = 'pending' | 'approved' | 'rejected';

export interface Payment {
  id: string;
  order_id: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_reference: string;
  status: PaymentStatus;
  created_at: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}
