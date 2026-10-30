import { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, ArrowRight, TreePine, ShieldCheck, Check, ShoppingCart, RefreshCw, Eye } from 'lucide-react';
import { Product } from '../types';

interface HeroProps {
  onNavigate: (section: string) => void;
  products?: Product[];
  onSelectProduct?: (product: Product) => void;
}

export default function Hero({ onNavigate, products = [], onSelectProduct }: HeroProps) {
  // Select a featured product strictly from in-stock items (preferably a Tree or the first item)
  const inStockProducts = products.filter((p) => (p.stock ?? 0) >= 1);
  const featuredProduct = 
    inStockProducts.find((p) => 
      (p.category || '').toLowerCase().includes('árbol') || 
      (p.category || '').toLowerCase().includes('arbol') ||
      p.name.toLowerCase().includes('árbol')
    ) || inStockProducts[0] || products[0];

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(val);
  };

  // Calculations for featured product
  const activePrice = featuredProduct ? (featuredProduct.discountPrice || featuredProduct.price) : 393333;
  const isTree = featuredProduct ? (
    (featuredProduct.category || '').toLowerCase().includes('árbol') ||
    (featuredProduct.category || '').toLowerCase().includes('arbol') ||
    featuredProduct.name.toLowerCase().includes('árbol')
  ) : true;
  const depositPercentage = isTree ? 30 : 100;
  const depositFee = (activePrice * depositPercentage) / 100;

  return (
    <div className="relative overflow-hidden bg-stone-950 text-white py-20 md:py-28 border-b border-stone-800">
      
      {/* Background Christmas Imagery with Overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1543589077-47d81606c1bf?auto=format&fit=crop&q=80&w=1920"
          alt="Navidad Impormax Fondo"
          className="w-full h-full object-cover object-center scale-105 filter brightness-75"
          referrerPolicy="no-referrer"
        />
        {/* Multi-layer gradient overlays for readability and luxury feel */}
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950/95 via-stone-950/85 to-emerald-950/75" />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-transparent to-stone-950/60" />
      </div>

      {/* Dynamic Animated Particles / Festive Glow Sparks */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.6, 0.3]
        }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/4 left-1/10 w-72 h-72 bg-amber-500/20 rounded-full blur-3xl pointer-events-none z-0"
      />
      <motion.div
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.2, 0.5, 0.2]
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        className="absolute bottom-1/4 right-1/10 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none z-0"
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Text Column */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">

            {/* Main Title */}
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.1]"
            >
              Asegura tu Árbol Navideño con el{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-200 to-emerald-400 block mt-1">
                Plan Separe IMPORMAX
              </span>
            </motion.h1>

            {/* Description */}
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-base sm:text-lg text-stone-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal"
            >
              Transforma tu hogar esta Navidad. Congela el precio especial separando tu árbol con el{' '}
              <strong className="text-amber-300 font-extrabold">30%</strong> y{' '}
              <span className="block font-semibold text-emerald-300 mt-0.5">
                paga a tu ritmo, sin intereses, hasta el 16 de Noviembre.
              </span>
            </motion.p>

            {/* Value Props Pills */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-left max-w-lg mx-auto lg:mx-0"
            >
              <div className="flex items-center gap-2.5 bg-stone-900/80 backdrop-blur-md p-2.5 rounded-xl border border-stone-800">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  ✓
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">0% Intereses</h4>
                  <p className="text-[10px] text-stone-400 font-mono">Sin recargos</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 bg-stone-900/80 backdrop-blur-md p-2.5 rounded-xl border border-stone-800">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  ✓
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Precio Congelado</h4>
                  <p className="text-[10px] text-stone-400 font-mono">Navidad soñada</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 bg-stone-900/80 backdrop-blur-md p-2.5 rounded-xl border border-stone-800 col-span-2 sm:col-span-1">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  ✓
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Distribución Directa</h4>
                  <p className="text-[10px] text-stone-400 font-mono">Garantía total</p>
                </div>
              </div>
            </motion.div>

            {/* CTAs */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start pt-4"
            >
              <button
                onClick={() => onNavigate('categorias')}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl font-extrabold text-xs uppercase tracking-wider bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer transform hover:-translate-y-0.5"
              >
                <TreePine className="w-4 h-4" />
                Explora Catálogo
                <ArrowRight className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => onNavigate('portal')}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl font-extrabold text-xs uppercase tracking-wider bg-stone-900/90 hover:bg-stone-800 text-stone-200 border border-stone-700/80 shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer backdrop-blur-md"
              >
                Consulta de Saldos
              </button>
            </motion.div>

          </div>

          {/* Right Product Spotlight Column */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-5 relative mt-6 lg:mt-0"
          >
            {/* Glowing Backdrop halo */}
            <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/30 to-emerald-500/30 rounded-3xl blur-xl opacity-70" />

            {/* Product Card Container */}
            <div className="relative rounded-3xl overflow-hidden border border-stone-800 shadow-2xl bg-stone-900/90 backdrop-blur-md flex flex-col justify-between">
              
              {/* Product Header Badge */}
              <div className="flex items-center justify-between px-5 py-3.5 bg-stone-950/80 border-b border-stone-800">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase font-mono tracking-wider text-amber-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  Producto Destacado de Temporada
                </span>
                {featuredProduct && (
                  <span className="text-[10px] text-stone-300 font-mono font-semibold">
                    Ref: {featuredProduct.reference || featuredProduct.id}
                  </span>
                )}
              </div>

              {/* Product Image Stage */}
              <div className="relative h-[280px] sm:h-[320px] w-full overflow-hidden bg-stone-950 group p-3 flex items-center justify-center">
                {featuredProduct ? (
                  <img
                    src={featuredProduct.imageUrl}
                    alt={featuredProduct.name}
                    className="w-full h-full object-contain group-hover:scale-102 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const fallback = featuredProduct.fallbackImageUrl || 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=800';
                      if (e.currentTarget.src !== fallback) {
                        e.currentTarget.src = fallback;
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-500">
                    <RefreshCw className="w-8 h-8 animate-spin" />
                  </div>
                )}

                {/* Floating Separe Tag */}
                <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-stone-950/90 border border-stone-700 text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 backdrop-blur-md shadow-lg">
                  {isTree ? `★ Separa con 30% (${formatCOP(depositFee)})` : '✓ Pago Completo (100%)'}
                </div>
              </div>

              {/* Product Specs & CTAs */}
              {featuredProduct && (
                <div className="p-5 space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono font-bold text-stone-400 uppercase tracking-wider mb-1">
                      <span className="text-amber-400">{featuredProduct.category || 'Decoración'}</span>
                      {featuredProduct.stock < 5 && featuredProduct.stock > 0 && (
                        <span className="text-amber-400 font-extrabold">¡Pocas Unidades! ({featuredProduct.stock})</span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-white leading-snug line-clamp-1">
                      {featuredProduct.name}
                    </h3>
                  </div>

                  {/* Price Row */}
                  <div className="flex items-baseline justify-between bg-stone-950/90 p-3.5 rounded-2xl border border-stone-800 font-mono">
                    <div>
                      <span className="text-[10px] text-stone-500 uppercase block font-bold">Precio Total</span>
                      <span className="text-lg font-extrabold text-white">
                        {formatCOP(activePrice)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-amber-400 uppercase block font-bold">Abono Inicial (30%)</span>
                      <span className="text-xl font-extrabold text-emerald-400">
                        {formatCOP(depositFee)}
                      </span>
                    </div>
                  </div>

                  {/* Direct Action */}
                  <button
                    onClick={() => {
                      if (onSelectProduct) {
                        onSelectProduct(featuredProduct);
                      } else {
                        onNavigate('catalogo');
                      }
                    }}
                    className="w-full py-3.5 px-4 rounded-xl font-extrabold text-xs uppercase tracking-wider bg-brand-green hover:bg-brand-green-dark text-white transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <ShoppingCart className="w-4 h-4 text-white" />
                    <span>Agregar al Carrito</span>
                  </button>
                </div>
              )}

            </div>

          </motion.div>

        </div>
      </div>

      {/* Seamless blend to next dark section */}
      <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-b from-transparent to-stone-900 pointer-events-none z-20" />
    </div>
  );
}
