import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Gift, Calendar, Truck, ArrowRight } from 'lucide-react';

interface FirstOrderPromoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExploreCatalog: () => void;
}

export default function FirstOrderPromoModal({
  isOpen,
  onClose,
  onExploreCatalog,
}: FirstOrderPromoModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-stone-950/70 backdrop-blur-xs transition-opacity cursor-pointer"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="relative w-full max-w-lg bg-[#FDFDFB] rounded-3xl shadow-2xl border border-stone-200/80 overflow-hidden z-10 my-8"
        >
          {/* Top Brand Banner with festive holiday gradient */}
          <div className="relative bg-gradient-to-r from-[#0089D0] via-[#0076B3] to-[#92BF1F] p-6 sm:p-7 text-white text-center overflow-hidden">
            {/* Background Decorative Pattern */}
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white/90 hover:text-white transition-all cursor-pointer z-20"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Impormax & Navidad Logos */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <img
                src="/logonavidad.png"
                alt="Feria Navideña"
                className="h-10 sm:h-12 w-auto object-contain drop-shadow-md brightness-110"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
              <span className="h-7 w-px bg-white/40" />
              <img
                src="/logo_impormax.png"
                alt="Impormax"
                className="h-9 sm:h-11 w-auto object-contain drop-shadow-md brightness-110"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Festive Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white font-mono text-xs uppercase tracking-wider font-bold shadow-xs mb-2">
              <Gift className="w-4 h-4 text-amber-300 animate-bounce" />
              <span>Beneficio Exclusivo Primera Compra</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight uppercase drop-shadow-xs">
              ¡10% DE DESCUENTO <br className="hidden sm:inline" />
              EN TU PRIMER PEDIDO!
            </h2>
          </div>

          {/* Modal Body */}
          <div className="p-6 sm:p-7 space-y-5">
            {/* Key Advantages Grid (3 clean cards without ERP card & without extra redundant text) */}
            <div className="grid grid-cols-1 gap-3">
              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/70 flex gap-3 items-center">
                <div className="w-9 h-9 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center shrink-0">
                  <Sparkles className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-stone-900">10% OFF en Todo el Carrito</h4>
                  <p className="text-[11px] text-stone-500 leading-normal mt-0.5">
                    Aplica automáticamente sobre el total de tu pedido para nuevos clientes.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/70 flex gap-3 items-center">
                <div className="w-9 h-9 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center shrink-0">
                  <Calendar className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-stone-900">Compatible con Plan Separe</h4>
                  <p className="text-[11px] text-stone-500 leading-normal mt-0.5">
                    Separa con solo el 30% del valor total con descuento y paga hasta el 16 de noviembre.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/70 flex gap-3 items-center">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                  <Truck className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-stone-900">Envío Gratis Nacional</h4>
                  <p className="text-[11px] text-stone-500 leading-normal mt-0.5">
                    Por compras superiores a $199.000 COP en ciudades principales.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  onExploreCatalog();
                  onClose();
                }}
                className="w-full py-3.5 px-6 rounded-2xl font-bold text-xs sm:text-sm tracking-wider uppercase text-white bg-brand-green hover:bg-brand-green-dark transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md border border-brand-green hover:shadow-lg active:scale-[0.99]"
              >
                <span>¡Ver Catálogo y Aprovechar 10% OFF!</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={onClose}
                className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer text-center"
              >
                Continuar navegando
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
