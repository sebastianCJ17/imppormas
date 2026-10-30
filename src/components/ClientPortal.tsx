import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Order, Payment } from '../types';
import { Search, Loader2, Landmark, CheckCircle, RefreshCw, AlertCircle, FileText, ArrowRight, Wallet, CreditCard, Package } from 'lucide-react';
import { apiService, getApiUrl } from '../services/api';

export default function ClientPortal() {
  const [searchDoc, setSearchDoc] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Form states to register a new payment
  const [payAmount, setPayAmount] = useState('');
  const [isRegisteringPay, setIsRegisteringPay] = useState(false);

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(val);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanDoc = searchDoc.trim();
    if (!cleanDoc) return;

    setIsLoading(true);
    setSelectedOrder(null);
    setPayments([]);
    
    try {
      const results = await apiService.searchOrdersByDocument(cleanDoc);
      setOrders(results);
      setHasSearched(true);
      
      // Auto-select first order if exists
      if (results.length > 0) {
        handleSelectOrder(results[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectOrder = async (order: Order) => {
    setSelectedOrder(order);
    if ((order as any).payments && Array.isArray((order as any).payments) && (order as any).payments.length > 0) {
      setPayments((order as any).payments);
    }
    try {
      const payHistory = await apiService.getPaymentsByOrderId(order.id);
      if (payHistory && payHistory.length > 0) {
        setPayments(payHistory);
      }
      setPayAmount(Math.min(150000, order.balance_pending).toString());
    } catch (err) {
      console.error(err);
    }
  };

  // Iniciar abono seguro a través de la pasarela Wompi
  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    const amountVal = Number(payAmount);
    
    const minAllowed = Math.min(50000, selectedOrder.balance_pending);
    if (isNaN(amountVal) || amountVal < minAllowed) {
      alert(`El valor mínimo permitido para abonar es de ${formatCOP(minAllowed)}.`);
      return;
    }
    if (amountVal > selectedOrder.balance_pending) {
      alert(`El abono ingresado supera el saldo pendiente de ${formatCOP(selectedOrder.balance_pending)}.`);
      return;
    }

    setIsRegisteringPay(true);
    try {
      const wompiRef = `WMP-ABONO-${selectedOrder.id.slice(0, 8)}-${Date.now()}`;
      const amountInCents = Math.round(amountVal * 100);

      sessionStorage.setItem('pending_wompi_checkout', JSON.stringify({
        reference: wompiRef,
        amountInCents,
        order_id: selectedOrder.id,
        customer_name: selectedOrder.customer_name,
        customer_email: selectedOrder.customer_email,
        customer_document: selectedOrder.customer_document,
        isAbono: true
      }));

      const prepRes = await fetch(getApiUrl('/api/wompi/prepare-checkout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: wompiRef,
          amountInCents,
          currency: 'COP',
          orderData: {
            order_id: selectedOrder.id,
            customer_name: selectedOrder.customer_name,
            customer_email: selectedOrder.customer_email,
            customer_document: selectedOrder.customer_document
          }
        })
      });

      const prepData = await prepRes.json();
      if (!prepData.success) {
        throw new Error(prepData.error || 'Error preparando pasarela Wompi');
      }

      const redirectBack = encodeURIComponent(window.location.origin + window.location.pathname);
      const wompiCheckoutUrl = `https://checkout.wompi.co/p/?public-key=${prepData.publicKey}&currency=COP&amount-in-cents=${amountInCents}&reference=${wompiRef}&signature:integrity=${prepData.signature}&redirect-url=${redirectBack}`;

      window.location.href = wompiCheckoutUrl;
      return;
    } catch (err: any) {
      console.error('Error registrando abono en Wompi:', err);
      alert(err.message || 'Error al conectar con la pasarela Wompi.');
    } finally {
      setIsRegisteringPay(false);
    }
  };

  // Status color pill resolver
  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'pagado':
        return <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px] uppercase font-mono tracking-wider">★ Pagado (Liberado)</span>;
      case 'abonando':
        return <span className="px-3 py-1 bg-blue-100 text-brand-blue rounded-full font-bold text-[10px] uppercase font-mono tracking-wider">• Abonando (Activo)</span>;
      case 'pending':
        return <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full font-bold text-[10px] uppercase font-mono tracking-wider">▲ Pendiente Primer Abono</span>;
      case 'cancelado':
        return <span className="px-3 py-1 bg-stone-100 text-stone-500 rounded-full font-bold text-[10px] uppercase font-mono tracking-wider">✕ Cancelado</span>;
    }
  };

  return (
    <section id="portal" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
          <h2 className="text-3xl font-extrabold text-stone-900 tracking-tight">
            Consulta tus Saldos e Historial de Abonos
          </h2>
          <p className="text-sm text-stone-500">
            Digita tu número de documento de identidad con el que realizaste tu separación. Desde aquí podrás monitorear tu restante, ver historial de transferencias cargadas y asentar nuevos aportes parciales.
          </p>
        </div>

        {/* Central Card layout split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* Document query left form card */}
          <div className="lg:col-span-4 bg-[#FAF9F6] border border-stone-200/50 p-6 sm:p-8 rounded-3xl space-y-6">
            <h3 className="text-sm font-bold text-stone-900 border-b border-stone-150 pb-3 uppercase tracking-wide flex items-center gap-2">
              <Search className="w-4 h-4 text-brand-blue" />
              Buscar mi Plan Separe
            </h3>

            <form onSubmit={handleSearch} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-600 block">Número de Cédula o NIT *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. 10203040"
                  value={searchDoc}
                  onChange={(e) => setSearchDoc(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-stone-200 hover:border-stone-400 focus:outline-brand-blue focus:ring-1 focus:ring-brand-blue rounded-xl text-xs font-mono font-semibold"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl font-bold text-xs tracking-wider uppercase bg-brand-green hover:bg-brand-green-dark text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm border border-brand-green"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Consultando...
                  </>
                ) : (
                  'Ingresar al Portal'
                )}
              </button>
            </form>

            <div className="pt-2 text-[10px] text-stone-500 italic leading-relaxed">
              💡 ¿Quieres probar rápidamente? Intenta ingresando la cédula demotrativa: <strong className="text-stone-800 font-mono">10203040</strong> (pedido de Juan) o <strong className="text-stone-800 font-mono">52888999</strong> (Sandra).
            </div>

            {/* List of active orders found */}
            {hasSearched && (
              <div className="space-y-4 pt-6 mt-6 border-t border-stone-150">
                <h4 className="text-xs font-bold text-brand-blue uppercase tracking-wide">
                  Tus Pedidos ({orders.length})
                </h4>
                
                {orders.length === 0 ? (
                  <div className="text-center py-6 bg-white border rounded-2xl flex flex-col items-center gap-2 text-stone-500 text-xs">
                    <AlertCircle className="w-8 h-8 text-amber-500" />
                    <span>No tienes planes habilitados</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {orders.map((o) => (
                      <button
                        key={o.id}
                        onClick={() => handleSelectOrder(o)}
                        className={`w-full text-left p-3.5 rounded-xl border text-xs cursor-pointer block transition-colors ${
                          selectedOrder?.id === o.id
                            ? 'border-brand-blue bg-white ring-1 ring-brand-blue'
                            : 'border-stone-200 bg-white hover:border-stone-300'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-stone-900 font-mono">{o.id}</span>
                          <span className="text-[10px] font-bold text-stone-500">{o.shipping_city}</span>
                        </div>
                        <span className="text-stone-500 block leading-tight truncate mb-2">{o.product_name}</span>
                        <div className="flex justify-between items-center bg-stone-50 p-2 rounded-lg">
                          <span className="text-[10px] text-stone-400 font-medium">Falta abonar:</span>
                          <span className="font-bold text-red-600 font-mono">{formatCOP(o.balance_pending)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Details column / No selected order fallback */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              {!selectedOrder ? (
                <div className="border border-stone-200/50 rounded-3xl p-12 text-center space-y-4 bg-stone-50/50">
                  <FileText className="w-16 h-16 text-stone-300 mx-auto" />
                  <h3 className="text-lg font-bold text-stone-800">Ningún Plan Seleccionado</h3>
                  <p className="text-sm text-stone-500 max-w-sm mx-auto">
                    Ingresa tus credenciales a la izquierda para cargar los detalles del Plan Separe, el historial de tus traslados y el formulario de nuevos abonos.
                  </p>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-8"
                >
                  
                  {/* General order information header */}
                  <div className="bg-brand-blue text-white p-6 sm:p-8 rounded-3xl space-y-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-xl font-bold font-mono tracking-wide">{selectedOrder.id}</span>
                          {getStatusBadge(selectedOrder.status)}
                        </div>
                        <span className="text-xs text-stone-300 block mt-1">Nombre: {selectedOrder.customer_name} • CC/NIT: {selectedOrder.customer_document}</span>
                      </div>
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] uppercase font-mono tracking-widest text-[#FDFDFB]/60 block">Dirección de Despacho</span>
                        <span className="text-xs font-bold block">{selectedOrder.shipping_address}</span>
                        <span className="text-[11px] font-mono text-zinc-300 block">{selectedOrder.shipping_city}, Colombia</span>
                      </div>
                    </div>

                    {/* Progress bars of payment */}
                    {(() => {
                      const total = selectedOrder.total_amount;
                      const paid = selectedOrder.paid_amount;
                      const pct = Math.min(100, Math.round((paid / total) * 100)) || 0;
                      return (
                        <div className="space-y-2 pt-4 border-t border-white/10">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-stone-300">Progreso de Pago Navidad:</span>
                            <span className="font-bold font-mono text-white">{pct}% de la meta</span>
                          </div>
                          
                          <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-center pt-2">
                            <div className="text-left">
                              <span className="text-[10px] text-stone-300 font-mono block">Valor Total Pedido</span>
                              <span className="text-xs font-bold text-white">{formatCOP(total)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-stone-300 font-mono block">Total Abonado</span>
                              <span className="text-xs font-bold text-amber-500">{formatCOP(paid)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-stone-300 font-mono block">Restante por Pagar</span>
                              <span className="text-xs font-bold text-red-400 font-mono">{formatCOP(selectedOrder.balance_pending)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Detalle de Artículos Comprados */}
                    <div className="pt-4 border-t border-white/10 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-stone-200">
                        <span className="flex items-center gap-1.5 uppercase font-mono tracking-wider text-[10px]">
                          <Package className="w-3.5 h-3.5 text-amber-400" />
                          Artículos del Pedido ({selectedOrder.items?.length || 1})
                        </span>
                        <span className="text-[10px] font-mono text-stone-300">
                          {selectedOrder.items && selectedOrder.items.length > 1
                            ? `${selectedOrder.items.reduce((s: number, it: any) => s + (it.quantity || 1), 0)} unidades`
                            : ''}
                        </span>
                      </div>

                      {selectedOrder.items && selectedOrder.items.length > 0 ? (
                        <div className="bg-white/10 rounded-2xl overflow-hidden divide-y divide-white/10 text-xs">
                          {selectedOrder.items.map((it: any, iIdx: number) => (
                            <div key={iIdx} className="p-3 flex items-center justify-between gap-3">
                              <div>
                                <span className="font-bold text-white block">{it.product_name}</span>
                                <span className="text-[11px] text-stone-300 font-mono">
                                  {it.product_reference && it.product_reference !== it.product_id ? `Ref: ${it.product_reference} | ` : ''}{it.quantity} und{it.quantity > 1 ? 's' : ''} × {formatCOP(it.unit_price)}
                                </span>
                              </div>
                              <span className="font-mono font-bold text-amber-300 whitespace-nowrap">
                                {formatCOP(it.total || (it.unit_price * it.quantity))}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 bg-white/10 rounded-xl text-xs text-stone-200 font-medium">
                          {selectedOrder.product_name}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payment history listing and new Abono form side-by-side */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                    
                    {/* Approved payments historical listings (left 7 cols) */}
                    <div className="md:col-span-7 bg-white border border-stone-200/50 p-6 sm:p-8 rounded-3xl space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-brand-blue border-b border-stone-100 pb-2">
                        Historial de Abonos Registrados ({payments.length})
                      </h3>

                      {payments.length === 0 ? (
                        <div className="text-center py-10 bg-stone-50 rounded-2xl text-stone-500 text-xs">
                          No tienes abonos asentados actualmente. Por favor procesa tu primer pago de separación.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {payments.map((p) => (
                            <div
                              key={p.id}
                              className="border border-stone-150 p-4 rounded-xl flex items-center justify-between hover:bg-stone-50/50"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-stone-800 uppercase font-mono">{p.payment_method}</span>
                                  {p.status === 'pending' ? (
                                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[9px] font-bold uppercase font-mono tracking-wider flex items-center gap-1">
                                      ⏳ Pendiente
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[9px] font-bold uppercase font-mono tracking-wider">
                                      ✓ Aprobado
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-stone-500 block font-mono">Ref: {p.payment_reference}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-extrabold text-stone-900 block font-mono">+{formatCOP(p.amount)}</span>
                                <span className="text-[9px] text-stone-400 block font-mono">{new Date(p.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* New Register Abono simulator form (right 5 cols) */}
                    <div className="md:col-span-5 bg-[#FAF9F6] border border-stone-200/50 p-6 sm:p-7 rounded-3xl space-y-4">
                      
                      <div className="space-y-1">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-brand-blue flex items-center gap-1.5">
                          <Wallet className="w-4 h-4" />
                          Registrar Nuevo Abono
                        </h3>
                        <p className="text-[10px] text-stone-500 leading-normal">
                          Ingresa la información de tu nuevo abono para actualizar tu saldo.
                        </p>
                      </div>

                      {/* Block form if order is fully paid */}
                      {selectedOrder.balance_pending <= 0 ? (
                        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-center space-y-2">
                          <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto" />
                          <h4 className="text-xs font-extrabold text-emerald-800">¡Pedido Totalmente Liquidado!</h4>
                          <p className="text-[10px] text-emerald-600">
                            Ya no tienes saldos pendientes para este árbol de navidad. Programaremos tu envío gratis.
                          </p>
                        </div>
                      ) : (
                        <form onSubmit={handleRegisterPayment} className="space-y-3 pt-2">
                          
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-stone-600 uppercase">Valor a abonar (COP) *</label>
                            <input
                              type="number"
                              required
                              min={Math.min(50000, selectedOrder.balance_pending)}
                              max={selectedOrder.balance_pending}
                              value={payAmount}
                              onChange={(e) => setPayAmount(e.target.value)}
                              className="w-full px-3 py-2.5 bg-white border border-stone-200 focus:outline-brand-blue focus:ring-1 focus:ring-brand-blue rounded-lg text-xs font-mono font-bold text-stone-800"
                            />
                            <span className="text-[9px] text-stone-400 block font-mono">Límite por abonar: {formatCOP(selectedOrder.balance_pending)}</span>
                          </div>

                          <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200/70 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-blue-900 font-bold text-xs">
                              <CreditCard className="w-4 h-4 text-brand-blue" />
                              <span>Pago en Línea Seguro Wompi</span>
                            </div>
                            <p className="text-[11px] text-stone-600 leading-relaxed">
                              Paga con <strong>PSE (cualquier banco)</strong>, <strong>Nequi</strong>, <strong>Botón Bancolombia</strong> o <strong>Tarjetas</strong>. Tu abono se registrará en el sistema y en Yeminus una vez aprobado por Wompi.
                            </p>
                          </div>

                          <button
                            type="submit"
                            disabled={isRegisteringPay}
                            className="w-full py-3 rounded-lg font-extrabold text-xs uppercase tracking-wider bg-brand-green hover:bg-brand-green-dark text-white flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors border border-brand-green"
                          >
                            {isRegisteringPay ? (
                              'Conectando a Wompi...'
                            ) : (
                              <>
                                <CreditCard className="w-4 h-4" />
                                <span>Pagar Abono con Wompi</span>
                              </>
                            )}
                          </button>

                          <span className="text-[10px] text-stone-400 block leading-tight text-center">
                            Transacción encriptada y procesada directamente por Wompi Bancolombia.
                          </span>
                        </form>
                      )}

                    </div>

                  </div>

                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

      </div>
    </section>
  );
}
