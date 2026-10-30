import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Product, Order } from '../types';
import { getApiUrl, apiService } from '../services/api';
import {
  ShoppingCart,
  Check,
  Calculator,
  ShieldCheck,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  ChevronRight,
  AlertCircle,
  ShoppingBag,
  ArrowUp,
  Landmark,
  Key,
  MessageCircle,
  Send,
  Gift,
  Sparkles,
  Percent,
} from 'lucide-react';

interface CartItem {
  product: Product;
  quantity: number;
}

interface CheckoutProps {
  cart: CartItem[];
  onSubmitOrder: (
    orderData: Omit<Order, 'id' | 'paid_amount' | 'balance_pending' | 'status' | 'created_at'> & {
      items?: Array<{ product_id: string; product_name: string; quantity: number; price: number }>;
      subtotal_amount?: number;
      discount_amount?: number;
      is_first_order?: boolean;
    },
    initialPaymentMethod: string,
    initialPaymentReference: string
  ) => Promise<Order>;
  onClearCart: () => void;
}

const MAIN_CITIES_LIST = [
  'bogota', 'bogotá', 'medellin', 'medellín', 'cali', 'barranquilla', 'cartagena',
  'bucaramanga', 'pereira', 'manizales', 'armenia', 'cucuta', 'cúcuta', 'ibague', 'ibagué',
  'santa marta', 'valledupar', 'villavicencio', 'monteria', 'montería', 'pasto', 'neiva',
  'popayan', 'popayán', 'sincelejo', 'tunja', 'riohacha', 'florencia', 'yopal', 'quibdo', 'quibdó',
  'bello', 'itagui', 'itagüí', 'envigado', 'sabaneta', 'rionegro', 'soacha', 'chia', 'chía',
  'floridablanca', 'giron', 'girón', 'piedecuesta', 'dosquebradas', 'palmira', 'yumbo', 'tulua', 'tuluá',
  'cartago', 'facatativa', 'facatativá', 'zipaquira', 'zipaquirá', 'madrid', 'mosquera', 'funza', 'cajica', 'cajicá'
];

function isMainCity(cityInput: string): boolean {
  if (!cityInput || cityInput.trim().length === 0) return true;
  const norm = cityInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  return MAIN_CITIES_LIST.some(main => norm.includes(main));
}

export default function Checkout({ cart, onSubmitOrder, onClearCart }: CheckoutProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [documentInput, setDocumentInput] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryType, setDeliveryType] = useState<'domicilio' | 'tienda'>('domicilio');
  const [paymentOption, setPaymentOption] = useState<'deposit' | 'full'>('deposit');
  const [customDepositPercent, setCustomDepositPercent] = useState<number>(30);
  const [paymentMethod, setPaymentMethod] = useState<string>('wompi');
  const [txReference, setTxReference] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);
  const [wompiUrl, setWompiUrl] = useState<string>('');

  // 10% First-Order Discount State
  const [isFirstOrder, setIsFirstOrder] = useState<boolean>(true);
  const [discountChecking, setDiscountChecking] = useState<boolean>(false);
  const [discountMessage, setDiscountMessage] = useState<string>('¡10% de descuento adicional en tu primer pedido!');

  // 1. Subtotal sumando todos los productos del carrito redondeado a enteros
  const cartSubtotal = Math.round(
    cart.reduce(
      (sum, item) => sum + (item.product.discountPrice || item.product.price) * item.quantity,
      0
    )
  );

  // 2. Descuento del 10% aplicado sobre TODO el pedido para clientes nuevos redondeado a enteros
  const firstOrderDiscount = isFirstOrder ? Math.round(cartSubtotal * 0.10) : 0;
  const orderFinalTotal = Math.round(Math.max(0, cartSubtotal - firstOrderDiscount));

  const threshold = 200000;
  const isEligibleForSepare = orderFinalTotal >= threshold;

  // Verificar en tiempo real con el servidor si el cliente ya ha realizado compras anteriores
  useEffect(() => {
    const cleanDoc = documentInput.replace(/\D/g, '').trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.replace(/\D/g, '').trim();

    if (!cleanDoc && !cleanEmail && !cleanPhone) {
      setIsFirstOrder(true);
      setDiscountMessage('¡10% de descuento adicional en tu primer pedido!');
      return;
    }

    const timer = setTimeout(async () => {
      setDiscountChecking(true);
      try {
        const result = await apiService.checkFirstOrder({
          document: cleanDoc,
          email: cleanEmail,
          phone: cleanPhone,
        });
        setIsFirstOrder(result.isFirstOrder);
        setDiscountMessage(result.message);
      } catch (e) {
        setIsFirstOrder(true);
      } finally {
        setDiscountChecking(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [documentInput, email, phone]);

  // Sync payment option based on cart eligibility
  useEffect(() => {
    if (!isEligibleForSepare) {
      setPaymentOption('full');
    } else {
      setPaymentOption('deposit');
    }
  }, [orderFinalTotal, isEligibleForSepare]);

  // Sync transaction reference
  useEffect(() => {
    if (cart.length > 0 && !txReference) {
      const randomRef = `WMP-REF-${Math.floor(100000 + Math.random() * 900000)}`;
      setTxReference(randomRef);
    }
  }, [cart, txReference]);

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  if (cart.length === 0 && !successOrder) {
    return null;
  }

  // Abono calculations basados en el total final con descuento (redondeados a enteros)
  const minDepositPercent = 30; // Minimum 30% downpayment for Plan Separe orders
  const minDepositAmount = Math.round((orderFinalTotal * minDepositPercent) / 100);
  const customDepositAmount = Math.round((orderFinalTotal * customDepositPercent) / 100);

  // Regla oficial de Envío: GRATIS en compras superiores a $199.000 COP y en ciudades principales del país (o retiro en tienda)
  const FREE_SHIPPING_THRESHOLD = 199000;
  const isCityMain = isMainCity(city);
  const qualifiesForFreeShipping = deliveryType === 'tienda' || (orderFinalTotal >= FREE_SHIPPING_THRESHOLD && isCityMain);
  const missingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - orderFinalTotal);

  const currentPayDue = Math.round(paymentOption === 'full' ? orderFinalTotal : customDepositAmount);
  const pendingBalance = Math.round(orderFinalTotal - currentPayDue);

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError(null);

    const cleanName = name.trim();
    const cleanDoc = documentInput.replace(/\D/g, '').trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.replace(/\D/g, '').trim();
    const cleanAddress = address.trim();
    const cleanCity = city.trim();

    const missingFields: string[] = [];
    if (!cleanName || cleanName.length < 3) missingFields.push('Nombre y Apellidos completos');
    if (!cleanDoc || cleanDoc.length < 5) missingFields.push('Cédula de Ciudadanía o NIT (mínimo 5 dígitos)');
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) missingFields.push('Correo Electrónico válido');
    if (!cleanPhone || cleanPhone.length < 7) missingFields.push('Teléfono / WhatsApp (mínimo 7 dígitos)');
    if (!cleanAddress || cleanAddress.length < 4) missingFields.push('Dirección de residencia o entrega');
    if (!cleanCity || cleanCity.length < 3) missingFields.push('Ciudad y departamento');

    if (missingFields.length > 0) {
      const errorMsg = `Todos los campos son obligatorios para crear el pedido: ${missingFields.join(', ')}.`;
      setFormError(errorMsg);
      // Desplazar suavemente hacia el formulario
      window.scrollTo({ top: 300, behavior: 'smooth' });
      return;
    }

    const finalAddress = deliveryType === 'tienda'
      ? `${cleanAddress} [Retiro en Tienda Física Pereira - Cra 7 # 21-42 Centro]`
      : cleanAddress;
    const finalCity = cleanCity;

    // Validar disponibilidad de inventario antes de proceder
    for (const item of cart) {
      const availStock = item.product.stock ?? 0;
      if (availStock <= 0) {
        setFormError(`Lo sentimos, el producto "${item.product.name}" se encuentra agotado. Por favor retíralo de tu carrito para continuar.`);
        return;
      }
      if (item.quantity > availStock) {
        setFormError(`El producto "${item.product.name}" solo tiene ${availStock} unidad(es) disponible(s). Por favor ajusta la cantidad en tu carrito.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Mantener todos los IDs y nombres completos sin truncar para pedidos largos
      const productIds = cart.map((i) => i.product.id).join(', ');
      const productNames = cart
        .map((i) => `${i.quantity}x ${i.product.name}`)
        .join(', ');

      // Build structured array of items with unit price from Lista 8 active feed price
      const itemsPayload = cart.map((item) => {
        const activeFeedPrice = Math.round(item.product.discountPrice || item.product.price);
        const itemDiscountAmount = isFirstOrder ? Math.round(activeFeedPrice * 0.10) : 0;
        const discountedUnitPrice = Math.max(0, activeFeedPrice - itemDiscountAmount);
        const itemTotal = Math.round(discountedUnitPrice * item.quantity);
        return {
          product_id: String(item.product.id).trim(),
          product_reference: String(item.product.reference || item.product.id).trim(),
          product_name: String(item.product.name).trim(),
          quantity: item.quantity,
          unit_price: activeFeedPrice,
          price: discountedUnitPrice,
          discount_percentage: isFirstOrder ? 10 : (item.product.discountPercentage || 0),
          discount_amount: itemDiscountAmount * item.quantity,
          subtotal: Math.round(itemTotal / 1.19),
          tax: itemTotal - Math.round(itemTotal / 1.19),
          total: itemTotal,
        };
      });

      const wompiRef = `WMP-${Date.now()}`;
      const amountInCents = Math.round(currentPayDue) * 100;

      const orderData: any = {
        customer_name: cleanName,
        customer_email: cleanEmail,
        customer_phone: cleanPhone,
        customer_document: cleanDoc,
        product_id: productIds,
        product_name: productNames,
        subtotal_amount: cartSubtotal,
        discount_amount: firstOrderDiscount,
        is_first_order: isFirstOrder,
        total_amount: orderFinalTotal,
        deposit_amount: currentPayDue,
        shipping_address: finalAddress,
        shipping_city: finalCity,
        customer_address: cleanAddress,
        customer_city: cleanCity,
        notes: notes.trim(),
        observaciones: notes.trim(),
        delivery_type: deliveryType,
        items: itemsPayload,
        wompi_reference: wompiRef,
        status: 'pendiente',
      };

      // 1. Guardar anticipadamente en la base de datos (orders, order_items, payments)
      try {
        const preSaved = await apiService.createOrder(orderData);
        if (preSaved && preSaved.id) {
          orderData.id = preSaved.id;
          orderData.order_id = preSaved.id;
        }
      } catch (saveErr) {
        console.warn('Aviso al pre-guardar pedido en /api/orders:', saveErr);
      }

      // Guardar temporalmente en sessionStorage y localStorage para garantizar recuperación al retorno
      const checkoutSnapshot = {
        reference: wompiRef,
        amountInCents,
        orderData,
        timestamp: Date.now(),
      };
      sessionStorage.setItem('pending_wompi_checkout', JSON.stringify(checkoutSnapshot));
      localStorage.setItem('pending_wompi_checkout_last', JSON.stringify(checkoutSnapshot));

      // Preparar sesión en el backend y generar firma de integridad
      const prepRes = await fetch(getApiUrl('/api/wompi/prepare-checkout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: wompiRef,
          amountInCents,
          currency: 'COP',
          orderData,
        }),
      });

      const prepData = await prepRes.json();
      if (!prepData.success) {
        alert(prepData.error || 'Error preparando pasarela Wompi. Por favor verifica la disponibilidad de tus artículos.');
        throw new Error(prepData.error || 'Error preparando pasarela Wompi');
      }

      const redirectBack = encodeURIComponent(
        window.location.origin + window.location.pathname
      );
      const wompiCheckoutUrl = `https://checkout.wompi.co/p/?public-key=${prepData.publicKey}&currency=COP&amount-in-cents=${amountInCents}&reference=${wompiRef}&signature:integrity=${prepData.signature}&redirect-url=${redirectBack}`;

      // Redirigir directamente a la pasarela Wompi oficial
      // El pedido y la reserva en Yeminus se confirmarán formalmente cuando Wompi apruebe la transacción
      window.location.href = wompiCheckoutUrl;
      return;
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="checkout" className="py-20 bg-[#FAF9F6] border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Success Congratulations screen */}
        {successOrder ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto bg-white border border-stone-250 p-8 sm:p-12 rounded-3xl text-center space-y-6 shadow-sm"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto text-3xl font-bold">
              ✔
            </div>

            <div className="space-y-2">
              <span className="text-xs uppercase tracking-widest text-emerald-700 font-bold block">
                ¡Pedido Registrado Exitosamente!
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 leading-tight">
                Plan Separe Reservado para {successOrder.customer_name}
              </h2>
              <div className="inline-block px-4 py-2 bg-stone-100 rounded-xl font-mono text-sm font-bold text-stone-800">
                CÓDIGO DE PEDIDO: {successOrder.id}
              </div>
            </div>

            {/* First order promo highlight on success */}
            {successOrder.discount_amount && successOrder.discount_amount > 0 && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center gap-2 text-emerald-900 text-xs font-bold">
                <Gift className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  ¡Ahorraste {formatCOP(successOrder.discount_amount)} con el 10% de descuento en tu primera compra!
                </span>
              </div>
            )}

            {/* Verification Status Banner */}
            {successOrder.status === 'pending' ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-left space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider font-mono">
                  <span className="animate-pulse">⏳</span>
                  <span>Abono Inicial: Pendiente de Verificación</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Hemos registrado tu reserva. Tu abono inicial de{' '}
                  <strong>{formatCOP(successOrder.deposit_amount)}</strong> quedará en estado{' '}
                  <strong>Pendiente de verificación</strong> hasta que nuestro equipo confirme la
                  transacción en el extracto bancario.
                </p>
              </div>
            ) : (
              <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
                Hemos registrado tu pedido con éxito en nuestro sistema. Tu primer abono de{' '}
                <strong>{formatCOP(successOrder.deposit_amount)}</strong> ha sido cargado como
                aprobado.
              </p>
            )}

            <div className="border border-stone-150 rounded-2xl p-6 text-left space-y-3 bg-stone-50">
              <h3 className="text-xs font-bold uppercase text-stone-400 tracking-wider">
                Resumen de tu cuenta
              </h3>
              <div className="flex justify-between text-xs gap-4">
                <span className="text-stone-600">Productos:</span>
                <span className="font-bold text-stone-900 text-right line-clamp-2">
                  {successOrder.product_name}
                </span>
              </div>

              {successOrder.subtotal_amount &&
                successOrder.subtotal_amount > successOrder.total_amount && (
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-500">Subtotal Original:</span>
                    <span className="font-mono text-stone-500 line-through">
                      {formatCOP(successOrder.subtotal_amount)}
                    </span>
                  </div>
                )}

              {successOrder.discount_amount && successOrder.discount_amount > 0 && (
                <div className="flex justify-between text-xs text-emerald-800 font-semibold">
                  <span className="flex items-center gap-1">
                    <Gift className="w-3.5 h-3.5 text-emerald-600" />
                    Descuento 1ra Compra (10% sobre todo el pedido):
                  </span>
                  <span className="font-mono font-bold">
                    -{formatCOP(successOrder.discount_amount)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-xs font-bold text-stone-900 pt-1 border-t border-stone-200">
                <span>Total Final del Pedido:</span>
                <span className="font-mono text-stone-950">
                  {formatCOP(successOrder.total_amount)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-stone-600">Abono Inicial Registrado:</span>
                <span className="font-bold text-brand-blue">
                  {formatCOP(successOrder.deposit_amount)}
                </span>
              </div>
              <div className="flex justify-between text-xs pt-3 border-t border-stone-150">
                <span className="text-stone-700 font-bold">Saldo Pendiente Restante:</span>
                <span className="font-bold text-red-600 font-mono text-sm">
                  {formatCOP(successOrder.balance_pending)}
                </span>
              </div>
            </div>

            {/* Direct WhatsApp Receipt Sender Button for Direct Transfers */}
            {successOrder.status === 'pending' && (
              <div className="p-5 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-3 text-center shadow-sm">
                <div className="flex items-center justify-center gap-2 text-emerald-900 font-bold text-xs">
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>Envía tu Comprobante de Pago por WhatsApp</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Para agilizar la verificación y aprobación de tu abono de{' '}
                  <strong>{formatCOP(successOrder.deposit_amount)}</strong>, por favor envía la
                  foto o captura del comprobante a nuestra línea oficial de atención.
                </p>
                <a
                  href={`https://wa.me/573154618049?text=${encodeURIComponent(
                    `Hola Impormax, acabo de realizar mi pedido *${successOrder.id}* a nombre de *${
                      successOrder.customer_name
                    }* por un abono de *${formatCOP(
                      successOrder.deposit_amount
                    )}*. Adjunto la captura del comprobante para su verificación.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs tracking-wide transition-all shadow-md cursor-pointer w-full sm:w-auto"
                >
                  <Send className="w-4 h-4" />
                  Enviar Comprobante a WhatsApp
                </a>
              </div>
            )}

            {/* Wompi Checkout Redirection Button */}
            {wompiUrl && (
              <div className="p-5 bg-gradient-to-r from-blue-50 to-emerald-50 border border-blue-200/80 rounded-2xl space-y-3 text-center shadow-sm">
                <div className="flex items-center justify-center gap-2 text-blue-900 font-bold text-xs">
                  <CreditCard className="w-4 h-4 text-brand-blue" />
                  <span>Pasarela de Pago Wompi Bancolombia</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Haz clic abajo para completar tu abono de{' '}
                  <strong>{formatCOP(successOrder.deposit_amount)}</strong> en la plataforma
                  encriptada de Wompi (PSE, Nequi, Tarjetas, Bancolombia).
                </p>
                <a
                  href={wompiUrl}
                  target="_top"
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-brand-blue hover:bg-brand-blue-dark text-white rounded-xl font-extrabold text-xs tracking-wide transition-all shadow-md cursor-pointer w-full sm:w-auto"
                >
                  <CreditCard className="w-4 h-4" />
                  Pagar Ahora {formatCOP(successOrder.deposit_amount)} con Wompi
                </a>
              </div>
            )}

            {/* CTA directly matching dynamic portal lookup */}
            <div className="pt-2 space-y-3">
              <p className="text-[11px] text-stone-500 font-medium">
                Tip: Para comprobar tu saldo en tiempo real, puedes ir a la sección{' '}
                <strong>"Mi Cuenta"</strong> e ingresar tu documento de identidad (
                <strong>{successOrder.customer_document}</strong>).
              </p>
              <button
                onClick={() => {
                  setSuccessOrder(null);
                  const portalEl = document.getElementById('portal');
                  if (portalEl) portalEl.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full sm:w-auto px-8 py-3 bg-brand-green hover:bg-brand-green-dark text-white rounded-xl font-bold text-xs tracking-wide cursor-pointer transition-all shadow-sm"
              >
                Ir a Mi Cuenta e Historial de Abonos
              </button>
            </div>
          </motion.div>
        ) : (
          /* Active Checkout Interface */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Form Column */}
            <form
              onSubmit={handleCheckoutSubmit}
              className="lg:col-span-7 bg-white rounded-3xl border border-stone-200 p-6 sm:p-10 space-y-8 shadow-sm"
            >
              {/* Box Title */}
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
                  <ShoppingCart className="w-6 h-6 text-brand-blue" />
                  Checkout Plan Separe IMPORMAX
                </h2>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Completa tu información de contacto y entrega a continuación para configurar tu
                  cuota de reserva y congelar el stock.
                </p>
              </div>

              {/* Form Validation Error Banner */}
              {formError && (
                <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 flex items-start gap-3 text-rose-900 animate-shake">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <h4 className="font-extrabold text-xs text-rose-800 uppercase tracking-wide">
                      Datos Incompletos para el Pedido
                    </h4>
                    <p className="text-xs text-rose-700 leading-relaxed font-medium">
                      {formError}
                    </p>
                  </div>
                </div>
              )}

              {/* 10% First Order Welcome Banner */}
              {isFirstOrder && (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-brand-blue/10 to-amber-500/10 border-2 border-brand-green/40 relative overflow-hidden">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-green text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Gift className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full bg-brand-green text-white font-mono text-[10px] font-bold uppercase tracking-wider">
                          10% OFF PRIMERA COMPRA
                        </span>
                        <span className="text-xs font-extrabold text-emerald-900">
                          ¡Ahorras {formatCOP(firstOrderDiscount)} en este pedido!
                        </span>
                      </div>
                      <p className="text-xs text-stone-700 leading-relaxed">
                        Este descuento especial se calcula sobre el{' '}
                        <strong>total de tu pedido</strong>. El valor a pagar y las cuotas de tu
                        Plan Separe ya incluyen este beneficio.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Informational warning */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex gap-3 text-stone-800">
                <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div className="text-xs space-y-1">
                  <h4 className="font-bold text-stone-900">Reserva con Garantía de Stock</h4>
                  <p className="text-stone-700 leading-normal">
                    Todos tus pedidos y abonos quedan registrados de forma segura y confirmada en
                    nuestro sistema de inventarios para tu tranquilidad.
                  </p>
                </div>
              </div>

              {/* Contact Information Group */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-brand-blue">
                    1. Datos de Contacto y Cédula (Para tu portal y verificación)
                  </h3>
                  {discountChecking && (
                    <span className="text-[10px] text-brand-blue font-mono animate-pulse">
                      Verificando cliente...
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-600 block">
                      Nombre Completo del Cliente *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Sandra Gómez"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 border border-stone-200 hover:border-stone-400 focus:outline-brand-blue focus:ring-1 focus:ring-brand-blue rounded-xl text-xs text-stone-800 transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-600 block">
                      Número de Cédula de Ciudadanía o NIT *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. 10203040"
                      value={documentInput}
                      onChange={(e) => setDocumentInput(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full px-4 py-3 border border-stone-200 hover:border-stone-400 focus:outline-brand-blue focus:ring-1 focus:ring-brand-blue rounded-xl text-xs text-stone-800 font-mono font-bold transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-600 block">
                      Correo Electrónico *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="sandra.gomez@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 border border-stone-200 hover:border-stone-400 focus:outline-brand-blue focus:ring-1 focus:ring-brand-blue rounded-xl text-xs text-stone-800 transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-600 block">
                      Teléfono / WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="Ej. 3123456789"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-4 py-3 border border-stone-200 hover:border-stone-400 focus:outline-brand-blue focus:ring-1 focus:ring-brand-blue rounded-xl text-xs text-stone-800 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Shipping Address Group */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-blue border-b border-stone-100 pb-2 flex items-center justify-between">
                  <span>2. Modalidad de Entrega</span>
                  <span className="text-[10px] text-stone-500 font-normal lowercase">
                    {deliveryType === 'domicilio' ? 'despacho a domicilio' : 'recogida en tienda'}
                  </span>
                </h3>

                {/* Delivery Type Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDeliveryType('domicilio')}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition flex items-center justify-between ${
                      deliveryType === 'domicilio'
                        ? 'border-brand-blue bg-brand-blue/5 ring-1 ring-brand-blue'
                        : 'border-stone-200 bg-white hover:border-stone-300'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-stone-900 block flex items-center gap-1.5">
                        🚚 Envío a Domicilio (Nacional)
                      </span>
                      <span className="text-[11px] text-stone-500 block mt-0.5">
                        Despacho a tu residencia u oficina
                      </span>
                    </div>
                    <input
                      type="radio"
                      checked={deliveryType === 'domicilio'}
                      readOnly
                      className="accent-brand-blue"
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryType('tienda')}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition flex items-center justify-between ${
                      deliveryType === 'tienda'
                        ? 'border-brand-blue bg-brand-blue/5 ring-1 ring-brand-blue'
                        : 'border-stone-200 bg-white hover:border-stone-300'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-stone-900 block flex items-center gap-1.5">
                        🏬 Recoger en Tienda Física
                      </span>
                      <span className="text-[11px] text-stone-500 block mt-0.5">
                        Impormax Centro Pereira (Sin costo)
                      </span>
                    </div>
                    <input
                      type="radio"
                      checked={deliveryType === 'tienda'}
                      readOnly
                      className="accent-brand-blue"
                    />
                  </button>
                </div>

                {/* Address and City Fields (Always Required) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-stone-700 flex items-center justify-between">
                      <span>
                        {deliveryType === 'domicilio' ? 'Dirección Exacta de Entrega' : 'Dirección de Residencia / Facturación'}{' '}
                        <span className="text-rose-500 font-bold">*</span>
                      </span>
                      <span className="text-[10px] text-stone-400 font-normal">Obligatorio</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={deliveryType === 'domicilio' ? "Ej. Calle 45 # 34-12 Apto 201, Barrio Los Álamos" : "Ej. Carrera 15 # 23-45 Barrio Centro"}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className={`w-full px-4 py-3 border rounded-xl text-xs text-stone-800 transition-colors ${
                        !address.trim() && formError
                          ? 'border-rose-400 bg-rose-50/30 ring-1 ring-rose-400'
                          : 'border-stone-200 hover:border-stone-400 focus:outline-brand-blue focus:ring-1 focus:ring-brand-blue'
                      }`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-700 flex items-center justify-between">
                      <span>
                        {deliveryType === 'domicilio' ? 'Ciudad y Departamento de Destino' : 'Ciudad y Departamento de Residencia'}{' '}
                        <span className="text-rose-500 font-bold">*</span>
                      </span>
                      <span className="text-[10px] text-stone-400 font-normal">Obligatorio</span>
                    </label>
                    <input
                      type="text"
                      required
                      list="ciudades-colombia"
                      placeholder="Ej. Pereira, Bogotá, Medellín, Cali, Manizales"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className={`w-full px-4 py-3 border rounded-xl text-xs text-stone-800 transition-colors ${
                        !city.trim() && formError
                          ? 'border-rose-400 bg-rose-50/30 ring-1 ring-rose-400'
                          : 'border-stone-200 hover:border-stone-400 focus:outline-brand-blue focus:ring-1 focus:ring-brand-blue'
                      }`}
                    />
                    <datalist id="ciudades-colombia">
                      <option value="Pereira, Risaralda" />
                      <option value="Dosquebradas, Risaralda" />
                      <option value="Santa Rosa de Cabal, Risaralda" />
                      <option value="Manizales, Caldas" />
                      <option value="Chinchiná, Caldas" />
                      <option value="Armenia, Quindío" />
                      <option value="Calarcá, Quindío" />
                      <option value="Bogotá D.C." />
                      <option value="Medellín, Antioquia" />
                      <option value="Envigado, Antioquia" />
                      <option value="Itagüí, Antioquia" />
                      <option value="Bello, Antioquia" />
                      <option value="Sabaneta, Antioquia" />
                      <option value="Rionegro, Antioquia" />
                      <option value="Cali, Valle del Cauca" />
                      <option value="Palmira, Valle del Cauca" />
                      <option value="Cartago, Valle del Cauca" />
                      <option value="Buga, Valle del Cauca" />
                      <option value="Tuluá, Valle del Cauca" />
                      <option value="Barranquilla, Atlántico" />
                      <option value="Cartagena, Bolívar" />
                      <option value="Santa Marta, Magdalena" />
                      <option value="Bucaramanga, Santander" />
                      <option value="Floridablanca, Santander" />
                      <option value="Cúcuta, Norte de Santander" />
                      <option value="Ibagué, Tolima" />
                      <option value="Neiva, Huila" />
                      <option value="Villavicencio, Meta" />
                      <option value="Pasto, Nariño" />
                      <option value="Popayán, Cauca" />
                      <option value="Tunja, Boyacá" />
                      <option value="Valledupar, Cesar" />
                      <option value="Montería, Córdoba" />
                      <option value="Sincelejo, Sucre" />
                    </datalist>
                  </div>

                  <div className="flex flex-col justify-center text-xs space-y-1">
                    {deliveryType === 'domicilio' ? (
                      <>
                        {qualifiesForFreeShipping ? (
                          <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl space-y-0.5 text-[11px]">
                            <span className="text-emerald-900 font-bold block">✓ ¡Calificas para Envío GRATIS ($0 COP)!</span>
                            <span className="text-emerald-800 text-[10px] block">
                              Por compras superiores a $199.000 a ciudades principales del país.
                            </span>
                          </div>
                        ) : orderFinalTotal < FREE_SHIPPING_THRESHOLD ? (
                          <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl space-y-0.5 text-[11px]">
                            <span className="text-amber-900 font-bold block">🚚 Envío por Cobrar / Contraentrega</span>
                            <span className="text-amber-800 text-[10px] block">
                              * El envío es <strong>GRATIS</strong> por compras superiores a $199.000 en ciudades principales (te faltan <strong>{formatCOP(missingForFreeShipping)}</strong>).
                            </span>
                          </div>
                        ) : (
                          <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl space-y-0.5 text-[11px]">
                            <span className="text-amber-900 font-bold block">🚚 Flete Contraentrega (Trayecto Especial)</span>
                            <span className="text-amber-800 text-[10px] block">
                              * El envío gratis aplica en ciudades principales. Para municipios y trayectos especiales se despacha con flete contraentrega.
                            </span>
                          </div>
                        )}
                        <span className="text-stone-500 font-normal text-[11px]">
                          Transportadoras aliadas: Servientrega, Envía e Interrapidísimo
                        </span>
                      </>
                    ) : (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-0.5 text-[11px]">
                        <span className="font-bold text-emerald-900 block">✓ Retiro en Tienda Física (GRATIS)</span>
                        <span className="text-emerald-800 block">Cra 7 # 21-42 Pereira Centro, Risaralda</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Observaciones o notas adicionales del cliente (Opcional) */}
                <div className="pt-2 border-t border-stone-150">
                  <label className="text-xs font-semibold text-stone-700 flex items-center justify-between mb-1.5">
                    <span>
                      Observaciones o Indicaciones Especiales{' '}
                      <span className="text-stone-400 font-normal text-[11px]">(Opcional)</span>
                    </span>
                    <span className="text-[10px] text-stone-400 font-normal">Opcional</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ej. Entregar en la tarde después de las 2 PM, color o modelo preferido, timbre no funciona, indicaciones para la transportadora..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-4 py-2.5 border border-stone-200 hover:border-stone-400 focus:outline-brand-blue focus:ring-1 focus:ring-brand-blue rounded-xl text-xs text-stone-800 transition-colors resize-none"
                  />
                  <p className="text-[10px] text-stone-500 mt-0.5">
                    💬 Si necesitas especificar un horario para recibir tu paquete, color o modelo de producto, déjanos tu nota aquí.
                  </p>
                </div>
              </div>

              {/* Downpayment choice Group */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-blue border-b border-stone-100 pb-2">
                  3. Configuración de Pago Inicial (Downpayment)
                </h3>

                {!isEligibleForSepare ? (
                  <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200/85 space-y-2">
                    <div className="flex items-center gap-2 text-amber-800 text-xs font-bold uppercase tracking-wider font-mono">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      Monto Inferior para Plan Separe
                    </div>
                    <p className="text-xs text-amber-700 leading-relaxed font-medium">
                      El <strong>Plan Separe</strong> está habilitado por pedido únicamente para
                      compras superiores a <strong>{formatCOP(threshold)}</strong>. Como tu total es{' '}
                      <strong>{formatCOP(orderFinalTotal)}</strong>, debes pagar tu pedido completo
                      en una sola transacción.
                    </p>
                    <div className="pt-1">
                      <div className="p-3.5 bg-white/60 border border-amber-200/40 rounded-xl flex justify-between items-center text-xs font-bold text-stone-800">
                        <span>Modalidad de Pago:</span>
                        <span className="text-emerald-850 uppercase font-mono">
                          Pago Completo Único (100%)
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setPaymentOption('deposit')}
                        className={`p-4 rounded-xl text-left border text-xs cursor-pointer flex flex-col justify-between transition-colors ${
                          paymentOption === 'deposit'
                            ? 'border-brand-blue bg-brand-blue/5 ring-1 ring-brand-blue shadow-sm'
                            : 'border-stone-200 bg-white hover:border-stone-300'
                        }`}
                      >
                        <div className="flex justify-between items-center w-full mb-1">
                          <span className="font-bold text-stone-900">Separar Pedido</span>
                          <input
                            type="radio"
                            checked={paymentOption === 'deposit'}
                            readOnly
                            className="accent-brand-blue"
                          />
                        </div>
                        <span className="text-stone-500 block leading-normal">
                          Abona desde el <strong>30% ({formatCOP(minDepositAmount)})</strong> y paga
                          el saldo a tu ritmo hasta el <strong>16 de Noviembre</strong>.
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentOption('full')}
                        className={`p-4 rounded-xl text-left border text-xs cursor-pointer flex flex-col justify-between transition-colors ${
                          paymentOption === 'full'
                            ? 'border-brand-blue bg-brand-blue/5 ring-1 ring-brand-blue shadow-sm'
                            : 'border-stone-200 bg-white hover:border-stone-300'
                        }`}
                      >
                        <div className="flex justify-between items-center w-full mb-1">
                          <span className="font-bold text-stone-900">Pagar 100% de Contado</span>
                          <input
                            type="radio"
                            checked={paymentOption === 'full'}
                            readOnly
                            className="accent-brand-blue"
                          />
                        </div>
                        <span className="text-stone-500 block leading-normal">
                          Cancela la totalidad de <strong>{formatCOP(orderFinalTotal)}</strong> y
                          programa tu despacho prioritario inmediatamente.
                        </span>
                      </button>
                    </div>

                    {paymentOption === 'deposit' && (
                      <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-5 space-y-4">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-stone-800">
                            ¿Cuánto deseas abonar hoy? ({customDepositPercent}%)
                          </label>
                          <span className="font-mono font-bold text-xs text-brand-blue">
                            {formatCOP(customDepositAmount)}
                          </span>
                        </div>

                        <input
                          type="range"
                          min="30"
                          max="90"
                          step="5"
                          value={customDepositPercent}
                          onChange={(e) => setCustomDepositPercent(Number(e.target.value))}
                          className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-brand-green"
                        />

                        <div className="flex justify-between text-[10px] text-stone-500 font-mono">
                          <span>Mínimo 30% ({formatCOP(minDepositAmount)})</span>
                          <span>Máximo 90% ({formatCOP((orderFinalTotal * 90) / 100)})</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Payment Methods Group: Solo Wompi Oficial */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-blue border-b border-stone-100 pb-2">
                  4. Pago Seguro en Línea con Wompi Bancolombia
                </h3>

                <div className="p-5 bg-gradient-to-br from-blue-50/80 via-white to-emerald-50/80 rounded-2xl border border-blue-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-950 font-extrabold text-sm">
                      <CreditCard className="w-5 h-5 text-brand-blue" />
                      <span>Pasarela Oficial Wompi Bancolombia</span>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full uppercase tracking-wider">
                      Pago 100% Seguro
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Al confirmar tu pedido, serás dirigido a la pasarela encriptada oficial de <strong>Wompi Bancolombia</strong> para procesar tu pago de forma instantánea. Puedes pagar con <strong>PSE (cualquier entidad bancaria)</strong>, <strong>Nequi</strong>, <strong>Botón Bancolombia</strong> o <strong>Tarjetas de Crédito y Débito</strong> (Visa, Mastercard, Amex).
                  </p>
                  <div className="pt-2.5 border-t border-stone-200/80 flex items-center justify-between text-xs font-semibold text-stone-700">
                    <span>Monto a pagar en pasarela:</span>
                    <span className="text-sm font-extrabold text-brand-blue font-mono">{formatCOP(currentPayDue)}</span>
                  </div>
                  <p className="text-[11px] text-stone-500 italic bg-white/70 p-2 rounded-lg border border-stone-100">
                    ℹ️ Tu pedido y la reserva de inventario en Yeminus se confirmarán de forma automática una vez Wompi apruebe la transacción.
                  </p>
                </div>
              </div>

              {/* Submit CTA button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 rounded-xl font-extrabold text-sm uppercase tracking-wider bg-brand-green text-white hover:bg-brand-green-dark flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md transition-all border border-brand-green"
              >
                {isSubmitting ? (
                  'Registrando Pedido...'
                ) : (
                  <>
                    <span>
                      {paymentMethod === 'wompi'
                        ? `Pagar con Wompi (${formatCOP(currentPayDue)})`
                        : 'Asegurar Pedido y Congelar Precios'}
                    </span>
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            {/* Shopping Cart Sidebar Summary Column */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-stone-200 rounded-3xl p-6 shadow-sm space-y-6 sticky top-24">
                <h3 className="text-xs font-bold uppercase text-stone-400 tracking-wider">
                  Resumen de tu Carrito
                </h3>

                <div className="max-h-64 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                  {cart.map((item) => {
                    const price = item.product.discountPrice || item.product.price;
                    return (
                      <div key={item.product.id} className="flex gap-3 items-center">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0 border border-stone-200">
                          <img
                            src={item.product.imageUrl}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const fallback = item.product.fallbackImageUrl || 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=800';
                              if (e.currentTarget.src !== fallback) {
                                e.currentTarget.src = fallback;
                              }
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-stone-900 leading-tight truncate">
                            {item.product.name}
                          </h4>
                          <span className="text-[10px] text-stone-500 font-mono block">
                            Ref: {item.product.reference || item.product.id} • {item.quantity}x {formatCOP(price)}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-stone-900 font-mono">
                          {formatCOP(price * item.quantity)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Pricing detail breakdown */}
                <div className="space-y-2.5 pt-4 border-t border-stone-150 text-xs">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Subtotal de Productos:</span>
                    <span className="font-mono font-bold text-stone-800">
                      {formatCOP(cartSubtotal)}
                    </span>
                  </div>

                  {isFirstOrder && firstOrderDiscount > 0 && (
                    <div className="flex justify-between items-center text-emerald-800 bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200/70">
                      <span className="font-bold flex items-center gap-1.5">
                        <Gift className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        Descuento 1ra Compra (10% sobre el total):
                      </span>
                      <span className="font-mono font-extrabold text-emerald-700">
                        -{formatCOP(firstOrderDiscount)}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col gap-1 py-1 border-t border-stone-100">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-600 font-medium">
                        {deliveryType === 'tienda' ? 'Retiro en Tienda Física (Pereira):' : 'Envío Asegurado a Nivel Nacional:'}
                      </span>
                      {deliveryType === 'tienda' ? (
                        <span className="font-bold text-emerald-800">GRATIS ($0 COP)</span>
                      ) : qualifiesForFreeShipping ? (
                        <span className="font-bold text-emerald-800">GRATIS ($0 COP)</span>
                      ) : (
                        <span className="font-bold text-amber-800">Flete Contraentrega</span>
                      )}
                    </div>
                    {deliveryType === 'domicilio' && (
                      <div className="text-[11px] text-right">
                        {qualifiesForFreeShipping ? (
                          <span className="text-emerald-700 font-medium">
                            ✓ Envío GRATIS aplicado (Compras &gt; $199.000 en ciudades principales)
                          </span>
                        ) : orderFinalTotal < FREE_SHIPPING_THRESHOLD ? (
                          <span className="text-amber-700">
                            * Envío GRATIS por compras superiores a $199.000 en ciudades principales (te faltan {formatCOP(missingForFreeShipping)})
                          </span>
                        ) : (
                          <span className="text-amber-700">
                            * Envío gratis aplica en ciudades principales. Municipios se despachan con flete contraentrega.
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between text-xs pt-3 border-t border-stone-200">
                    <span className="font-bold text-stone-900">Total Pedido Final:</span>
                    <span className="font-extrabold text-stone-950 font-mono text-sm">
                      {formatCOP(orderFinalTotal)}
                    </span>
                  </div>
                </div>

                {/* Division timeline view depending on Choice */}
                <div className="bg-[#FAF9F6] border border-stone-200 p-4 rounded-2xl space-y-4">
                  <h4 className="text-xs font-bold uppercase text-brand-blue tracking-tight">
                    Resumen de Financiación Plan Separe
                  </h4>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-stone-600 font-semibold">
                        Abono Inicial Hoy (
                        {paymentOption === 'deposit' ? `${customDepositPercent}%` : '100%'}):
                      </span>
                      <span className="font-extrabold text-stone-900 font-mono text-xs">
                        {formatCOP(currentPayDue)}
                      </span>
                    </div>

                    <div className="flex justify-between text-xs">
                      <span className="text-stone-600 font-semibold">Saldo Pendiente:</span>
                      <span className="font-extrabold text-red-600 font-mono text-xs">
                        {formatCOP(pendingBalance)}
                      </span>
                    </div>
                  </div>

                  {paymentOption === 'deposit' && (
                    <div className="text-[10px] text-stone-500 leading-relaxed border-t border-stone-150 pt-3">
                      💡 Puedes abonar a tu ritmo (abonos desde $50.000 COP) sin intereses de ningún
                      tipo. Plazo final de saldo al 16 de Noviembre.
                    </div>
                  )}
                </div>

                {/* Trust symbols */}
                <div className="pt-2 flex items-center justify-center gap-2 text-[10px] text-stone-400 font-mono uppercase font-bold">
                  <span>🔒 Seguridad SSL</span>
                  <span>•</span>
                  <span>🚛 Entrega Garantizada</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
