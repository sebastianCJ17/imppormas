import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  Printer, 
  Share2, 
  X, 
  Building2, 
  Calendar, 
  CreditCard, 
  FileText, 
  User, 
  Phone, 
  MapPin, 
  Mail, 
  ShoppingBag, 
  Clock, 
  ArrowRight,
  ShieldCheck,
  Download
} from 'lucide-react';

export interface OrderReceiptData {
  orderId?: string | null;
  documentId: string;
  reference: string;
  transactionId?: string;
  authorizationCode?: string | null;
  status: string;
  statusMessage?: string;
  date: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    document?: string;
    address?: string;
    city?: string;
  };
  items: Array<{
    id?: string;
    name: string;
    quantity: number;
    price: number;
    total?: number;
  }>;
  financial: {
    totalOrder: number;
    amountPaid: number;
    totalAbonado?: number;
    balancePending: number;
    isPlanSepare?: boolean;
    depositPercentage?: number;
  };
  paymentMethod: {
    type: string;
    label?: string;
    brand?: string;
    lastFour?: string | null;
    details?: string;
  };
}

interface OrderReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: OrderReceiptData | null;
}

export default function OrderReceiptModal({ isOpen, onClose, receipt }: OrderReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !receipt) return null;

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('es-CO', {
        dateStyle: 'full',
        timeStyle: 'medium',
        timeZone: 'America/Bogota'
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const text = `🎄 *COMPROBANTE DE PAGO IMPORMAX* 🎄\n\n` +
      `📄 *Doc. Yeminus:* ${receipt.documentId}\n` +
      `🔖 *Ref. Wompi:* ${receipt.reference}\n` +
      `👤 *Cliente:* ${receipt.customer.name}\n` +
      `💰 *Monto Pagado:* ${formatCOP(receipt.financial.amountPaid)}\n` +
      (receipt.financial.balancePending > 0 
        ? `⏳ *Saldo Pendiente:* ${formatCOP(receipt.financial.balancePending)} (Plan Separe)\n` 
        : `✅ *Estado:* Totalmente Pagado\n`) +
      `📅 *Fecha:* ${formatDate(receipt.date)}\n\n` +
      `¡Gracias por tu compra en Impormax!`;

    const encoded = encodeURIComponent(text);
    const phone = receipt.customer.phone?.replace(/[^0-9]/g, '') || '';
    const targetUrl = phone ? `https://wa.me/57${phone.slice(-10)}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    try {
      const link = document.createElement('a');
      link.href = targetUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      window.location.href = targetUrl;
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white print:static print:inset-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25 }}
          className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-4 print:border-none print:shadow-none print:my-0 print:max-w-none print:rounded-none"
        >
          {/* Barra superior de herramientas (Oculta al imprimir) */}
          <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 px-6 py-4 flex items-center justify-between text-white print:hidden border-b border-stone-700">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                <CheckCircle2 className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-serif font-bold text-sm tracking-wide text-amber-300">IMPORMAX NAVIDAD</h3>
                <p className="text-[11px] text-stone-400">Comprobante Oficial de Transacción</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-700 hover:bg-stone-600 text-stone-100 rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm hover:scale-105 active:scale-95"
                title="Imprimir comprobante o guardar en PDF"
              >
                <Printer className="w-4 h-4 text-amber-300" />
                <span>Imprimir / PDF</span>
              </button>

              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm hover:scale-105 active:scale-95"
                title="Compartir por WhatsApp"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-700/80 rounded-xl transition cursor-pointer ml-1"
                title="Cerrar recibo"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* CUERPO DEL RECIBO (Imprimible) */}
          <div ref={receiptRef} id="printable-receipt" className="p-6 sm:p-8 bg-white text-stone-900 space-y-6">
            {/* Encabezado de Marca y Estado */}
            <div className="text-center border-b border-stone-200 pb-5">
              <div className="inline-flex items-center justify-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold font-serif text-xl shadow-md">
                  IX
                </div>
                <div className="text-left">
                  <h1 className="font-serif font-extrabold text-xl text-stone-900 tracking-tight">IMPORMAX</h1>
                  <p className="text-[10px] tracking-widest text-amber-800 font-bold uppercase">Tienda Navideña & Decoración</p>
                </div>
              </div>

              {/* Badge de Aprobado */}
              <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-300 rounded-full text-emerald-800 font-bold text-xs uppercase tracking-wider shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{receipt.statusMessage || 'Transacción Aprobada Exitosamente'}</span>
              </div>

              <p className="text-xs text-stone-500 mt-2">
                Procesado de forma segura con pasarela Wompi Bancolombia y registrado en Yeminus ERP
              </p>
            </div>

            {/* Fila de Resumen Clave: Referencia, Yeminus Doc y Fecha */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-stone-50 p-4 rounded-2xl border border-stone-200 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block">Doc. Yeminus ERP</span>
                <span className="font-mono font-bold text-stone-900 text-sm text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 inline-block mt-0.5">
                  {receipt.documentId}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block">Referencia Wompi</span>
                <span className="font-mono font-bold text-stone-800 break-all mt-0.5 inline-block text-[11px]">
                  {receipt.reference}
                </span>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block">Fecha y Hora</span>
                <span className="font-medium text-stone-700 mt-0.5 block text-[11px]">
                  {formatDate(receipt.date)}
                </span>
              </div>
            </div>

            {/* Datos del Cliente */}
            <div className="border border-stone-200 rounded-2xl p-4 bg-white space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5 border-b border-stone-100 pb-2">
                <User className="w-3.5 h-3.5 text-amber-700" />
                Información del Cliente
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-xs pt-1">
                <div>
                  <span className="text-stone-400 block text-[11px]">Nombre Completo:</span>
                  <span className="font-bold text-stone-900">{receipt.customer.name}</span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[11px]">Documento / Cédula:</span>
                  <span className="font-mono font-semibold text-stone-800">{receipt.customer.document || 'No especificado'}</span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[11px]">Teléfono / WhatsApp:</span>
                  <span className="font-medium text-stone-800">{receipt.customer.phone || 'No especificado'}</span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[11px]">Correo Electrónico:</span>
                  <span className="font-medium text-stone-800">{receipt.customer.email || 'No especificado'}</span>
                </div>
                {receipt.customer.address && (
                  <div className="sm:col-span-2">
                    <span className="text-stone-400 block text-[11px]">Dirección y Ciudad de Entrega:</span>
                    <span className="font-medium text-stone-800">{receipt.customer.address} - {receipt.customer.city || 'Pereira'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Detalle de Productos */}
            <div className="border border-stone-200 rounded-2xl overflow-hidden bg-white">
              <div className="bg-stone-100 px-4 py-2 border-b border-stone-200 flex items-center justify-between text-xs font-bold text-stone-700 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-amber-700" />
                  Artículos Adquiridos
                </span>
                <span>Subtotal</span>
              </div>
              <div className="divide-y divide-stone-100 text-xs">
                {receipt.items && receipt.items.length > 0 ? (
                  receipt.items.map((item, idx) => (
                    <div key={idx} className="p-3.5 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-stone-900 text-xs">
                          {item.id && item.id !== 'ONLINE' ? <span className="font-mono text-stone-600 font-semibold mr-1">[{item.id}]</span> : null}
                          {item.name}
                        </p>
                        <p className="text-[11px] text-stone-500 font-mono">
                          {item.quantity} unidad(es) {item.price ? `× ${formatCOP(item.price)}` : ''}
                        </p>
                      </div>
                      <span className="font-bold text-stone-900 text-xs whitespace-nowrap">
                        {formatCOP(item.total || (item.price * (item.quantity || 1)))}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-3.5 text-stone-500 text-center text-xs">
                    Pedido Navideño Impormax
                  </div>
                )}
              </div>
            </div>

            {/* Cuadro Financiero: Total, Pagado, Saldo */}
            <div className="bg-amber-50/50 border-2 border-amber-200 rounded-2xl p-5 space-y-3">
              <div className="flex justify-between items-center text-sm font-semibold text-stone-700">
                <span>Valor Total del Pedido:</span>
                <span className="font-mono text-base font-extrabold text-stone-900">
                  {formatCOP(receipt.financial.totalOrder)}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm font-bold text-emerald-800 bg-emerald-100/70 p-3 rounded-xl border border-emerald-300">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Valor Pagado / Abonado Hoy:
                </span>
                <span className="font-mono text-lg font-black text-emerald-800">
                  {formatCOP(receipt.financial.amountPaid)}
                </span>
              </div>

              {receipt.financial.balancePending > 0 ? (
                <div className="border-t border-amber-200/80 pt-3 space-y-2">
                  <div className="flex justify-between items-center text-sm font-bold text-red-800">
                    <span className="flex items-center gap-1">
                      <span>Saldo Pendiente (Plan Separe):</span>
                    </span>
                    <span className="font-mono text-base font-black text-red-700">
                      {formatCOP(receipt.financial.balancePending)}
                    </span>
                  </div>
                  <div className="p-2.5 bg-amber-100/60 rounded-xl text-[11px] text-amber-900 border border-amber-300/60 space-y-1">
                    <p className="font-bold">✨ Recuerda tu beneficio de Plan Separe:</p>
                    <p>
                      Has asegurado tu pedido con el 30%. Tienes plazo hasta el <strong>20 de Diciembre de 2026</strong> para liquidar el saldo pendiente. Puedes hacer abonos parciales o liquidar el saldo total en cualquier momento desde nuestra web ingresando tu número de documento.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="border-t border-emerald-200 pt-2 text-center text-emerald-800 font-bold text-xs">
                  🎉 ¡Felicidades! Este pedido está 100% PAGADO. Tu mercancía está reservada y lista para despacho.
                </div>
              )}

              {/* Método de Pago y Autorización */}
              <div className="pt-2 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
                <div className="flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-stone-400" />
                  <span>Método de Pago: <strong>{receipt.paymentMethod.label || receipt.paymentMethod.type}</strong></span>
                </div>
                {receipt.authorizationCode && (
                  <span className="font-mono text-[11px]">
                    Cód. Autorización: <strong>{receipt.authorizationCode}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Pie de Recibo / Datos de Contacto */}
            <div className="text-center pt-2 border-t border-stone-100 text-stone-400 text-[11px] space-y-1">
              <p className="font-bold text-stone-600">IMPORMAX COLOMBIA - NIT 901.234.567-8</p>
              <p>Pereira, Risaralda | Atención al cliente: WhatsApp 310 000 0000 | info@impormax.net</p>
              <p className="text-[10px] text-stone-400 italic">
                Conserva este comprobante como respaldo de tu compra y número de reserva en bodega.
              </p>
            </div>
          </div>

          {/* Botones de Pie (Ocultos al imprimir) */}
          <div className="bg-stone-50 p-4 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
            <button
              type="button"
              onClick={handlePrint}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-amber-300 font-bold text-xs rounded-xl shadow-md transition cursor-pointer hover:scale-102 active:scale-98"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>Imprimir o Guardar Comprobante (PDF)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer text-center"
            >
              Continuar en la Tienda
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
