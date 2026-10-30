import { motion } from 'motion/react';
import { X, Trash2, Plus, Minus, ShoppingBag, Sparkles, HelpCircle, CheckCircle2, Gift } from 'lucide-react';
import { Product } from '../types';

interface CartItem {
  product: Product;
  quantity: number;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onGoToCheckout: () => void;
}

export default function CartDrawer({
  isOpen,
  onClose,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onGoToCheckout,
}: CartDrawerProps) {
  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const total = cart.reduce(
    (sum, item) => sum + (item.product.discountPrice || item.product.price) * item.quantity,
    0
  );

  const threshold = 200000;
  const isEligibleForSepare = total >= threshold;
  const percentageToThreshold = Math.min((total / threshold) * 100, 100);
  const remainingToThreshold = threshold - total;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-55 overflow-hidden">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-stone-900 cursor-pointer"
      />

      {/* Slide-over panel */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-screen max-w-md bg-[#FDFDFB] border-l border-stone-200 flex flex-col justify-between shadow-2xl relative"
        >
          {/* Header */}
          <div className="p-6 border-b border-stone-200/60 flex items-center justify-between bg-stone-50">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wide">
                  Tu Carrito
                </h2>
                <p className="text-[10px] text-stone-500 font-mono">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)} artículos seleccionados
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-900 hover:bg-stone-150 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {cart.length === 0 ? (
              <div className="text-center py-16 space-y-4">
                <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto text-stone-400">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-stone-900 uppercase">El carrito está vacío</h3>
                  <p className="text-xs text-stone-500 max-w-xs mx-auto">
                    Navega por nuestro catálogo de árboles de Navidad premium y decoraciones para añadir artículos.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => {
                  const productPrice = item.product.discountPrice || item.product.price;
                  return (
                    <div
                      key={item.product.id}
                      className="flex gap-4 p-3 rounded-2xl border border-stone-200/70 bg-white shadow-sm"
                    >
                      <img
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        className="w-16 h-16 object-cover rounded-xl bg-stone-100 flex-shrink-0"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const fallback = item.product.fallbackImageUrl || 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=800';
                          if (e.currentTarget.src !== fallback) {
                            e.currentTarget.src = fallback;
                          }
                        }}
                      />
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-1">
                            <h4 className="text-xs font-bold text-stone-900 line-clamp-1">
                              {item.product.name}
                            </h4>
                            <button
                              onClick={() => onRemoveItem(item.product.id)}
                              className="text-stone-400 hover:text-red-600 p-0.5 rounded-lg hover:bg-stone-50 cursor-pointer flex-shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="text-[10px] text-stone-500 block font-mono font-semibold">
                            Ref: {item.product.reference || item.product.id}
                          </span>
                          {item.product.stock !== undefined && item.product.stock <= 5 && (
                            <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded font-mono font-bold inline-block mt-0.5">
                              ¡Últimas {item.product.stock} disponibles!
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          {/* Quantity selector */}
                          <div className="flex items-center border border-stone-200 rounded-lg bg-stone-50 overflow-hidden">
                            <button
                              onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                              className="p-1 px-2 hover:bg-stone-150 text-stone-600 transition-colors cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-2.5 text-xs font-mono font-bold text-stone-800">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                              disabled={item.quantity >= (item.product.stock ?? 999)}
                              className={`p-1 px-2 transition-colors ${
                                item.quantity >= (item.product.stock ?? 999)
                                  ? 'text-stone-300 bg-stone-100 cursor-not-allowed'
                                  : 'hover:bg-stone-150 text-stone-600 cursor-pointer'
                              }`}
                              title={item.quantity >= (item.product.stock ?? 999) ? `Máximo stock disponible (${item.product.stock})` : 'Añadir unidad'}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="text-right">
                            <span className="text-xs font-extrabold text-stone-900 font-mono">
                              {formatCOP(productPrice * item.quantity)}
                            </span>
                            <span className="text-[9px] text-stone-400 block font-mono">
                              {formatCOP(productPrice)} c/u
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer controls & dynamic Separe state */}
          {cart.length > 0 && (
            <div className="p-6 border-t border-stone-200/80 bg-stone-50 space-y-4">
              {/* Threshold Rule widget */}
              <div className="bg-white border border-stone-200 p-4 rounded-2xl space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-brand-blue" />
                    Condición Plan Separe
                  </span>
                  <span className="text-[10px] font-bold font-mono text-stone-500">
                    Mínimo: {formatCOP(threshold)}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="relative w-full h-2.5 bg-stone-100 rounded-full overflow-hidden border border-stone-200/50">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isEligibleForSepare ? 'bg-brand-green' : 'bg-brand-blue'
                    }`}
                    style={{ width: `${percentageToThreshold}%` }}
                  />
                </div>

                {/* Eligibility label feedback */}
                {isEligibleForSepare ? (
                  <div className="flex gap-2 text-[11px] text-emerald-800 leading-normal font-medium bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <p>
                      <strong>¡Calificas para Plan Separe!</strong> Como tu pedido supera los{' '}
                      {formatCOP(threshold)}, puedes reservarlo hoy con abono inicial mínimo (30%) y financiar el saldo con fecha límite de pago hasta el 16 de noviembre 2026.
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-2 text-[11px] text-amber-800 leading-normal font-medium bg-amber-50 p-2.5 rounded-xl border border-amber-100">
                    <HelpCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p>
                      <strong>Pago Completo Requerido.</strong> Te faltan{' '}
                      <span className="font-bold">{formatCOP(remainingToThreshold)}</span> para
                      habilitar la opción de <strong>Plan Separe</strong>. Agrega más árboles o accesorios para calificar.
                    </p>
                  </div>
                )}
              </div>

              {/* Total summary */}
              <div className="space-y-1.5 py-2 border-t border-stone-200/60">
                <div className="flex justify-between items-center text-xs text-stone-500">
                  <span>Subtotal carrito:</span>
                  <span className="font-mono font-semibold text-stone-700">{formatCOP(total)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-emerald-800 bg-emerald-50/70 p-2 rounded-xl border border-emerald-100">
                  <span className="flex items-center gap-1 font-bold">
                    <Gift className="w-3.5 h-3.5 text-emerald-600" />
                    10% OFF 1ra Compra (sobre el total):
                  </span>
                  <span className="font-mono font-extrabold text-emerald-700">
                    -{formatCOP(Math.round(total * 0.10))}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-xs font-bold text-stone-600 uppercase tracking-wider font-mono">
                    Total Estimado:
                  </span>
                  <span className="text-lg font-extrabold text-stone-950 font-mono">
                    {formatCOP(Math.round(total * 0.90))}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <button
                onClick={onGoToCheckout}
                className="w-full py-4 rounded-xl font-bold text-xs tracking-wider uppercase text-white bg-brand-green hover:bg-brand-green-dark transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md border border-brand-green"
              >
                <span>Ir a Registrar Pedido y Pago</span>
                <X className="w-4 h-4 rotate-45" />
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
