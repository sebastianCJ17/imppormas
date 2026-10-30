import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Product } from '../types';
import { isProductNew, formatPublicationDate, getProductVideoUrl } from '../utils/productUtils';
import {
  X,
  CheckCircle2,
  TreePine,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  Truck,
  Calendar,
  Sparkles,
  Calculator,
  MessageCircle,
  Share2,
  Layers,
  Info,
  Play,
  Video,
  Flame,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2
} from 'lucide-react';

interface ProductDetailModalProps {
  product: Product | null;
  allProducts?: Product[];
  onClose: () => void;
  onAddToCart: (product: Product) => void;
  onBuyNow: (product: Product) => void;
  onSelectRelatedProduct?: (product: Product) => void;
}

export default function ProductDetailModal({
  product,
  allProducts = [],
  onClose,
  onAddToCart,
  onBuyNow,
  onSelectRelatedProduct
}: ProductDetailModalProps) {
  if (!product) return null;

  const bodyRef = useRef<HTMLDivElement>(null);

  // Image Gallery list (only real images)
  const galleryImages = Array.from(
    new Set(
      [
        product.imageUrl,
        ...(product.images || [])
      ].filter((img): img is string => Boolean(img) && typeof img === 'string')
    )
  );

  const productVideoUrl = getProductVideoUrl(product);

  // Unified Media List (Images + Video if available)
  const mediaList: Array<{ type: 'image' | 'video'; url: string; label: string }> = [
    ...galleryImages.map((img, idx) => ({
      type: 'image' as const,
      url: img,
      label: `Foto ${idx + 1}`
    }))
  ];

  if (productVideoUrl) {
    mediaList.push({
      type: 'video' as const,
      url: productVideoUrl,
      label: 'Video Real'
    });
  }

  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [selectedInstallments, setSelectedInstallments] = useState(3);
  const [copiedLink, setCopiedLink] = useState(false);

  // Zoom Lightbox State (para apreciar detalles finos y medidas sin interferencias)
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1.5);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Reset zoom on media index or product change
  useEffect(() => {
    setZoomScale(1.5);
    setZoomPosition({ x: 0, y: 0 });
  }, [activeMediaIndex, product.id]);

  // Teclado para controlar el visor de zoom
  useEffect(() => {
    if (!isZoomOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsZoomOpen(false);
      } else if (e.key === 'ArrowLeft') {
        setActiveMediaIndex((prev) => (prev - 1 + mediaList.length) % mediaList.length);
        setZoomPosition({ x: 0, y: 0 });
      } else if (e.key === 'ArrowRight') {
        setActiveMediaIndex((prev) => (prev + 1) % mediaList.length);
        setZoomPosition({ x: 0, y: 0 });
      } else if (e.key === '+' || e.key === '=') {
        setZoomScale((prev) => Math.min(4, +(prev + 0.5).toFixed(1)));
      } else if (e.key === '-') {
        setZoomScale((prev) => {
          const next = Math.max(1, +(prev - 0.5).toFixed(1));
          if (next === 1) setZoomPosition({ x: 0, y: 0 });
          return next;
        });
      } else if (e.key === '0') {
        setZoomScale(1);
        setZoomPosition({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZoomOpen, mediaList.length]);

  const handleZoomIn = () => {
    setZoomScale((prev) => Math.min(4, +(prev + 0.5).toFixed(1)));
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => {
      const next = Math.max(1, +(prev - 0.5).toFixed(1));
      if (next === 1) setZoomPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoomScale(1);
    setZoomPosition({ x: 0, y: 0 });
  };

  const handleToggleZoom = () => {
    if (zoomScale > 1.2) {
      handleResetZoom();
    } else {
      setZoomScale(2);
      setZoomPosition({ x: 0, y: 0 });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomScale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - zoomPosition.x, y: e.clientY - zoomPosition.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoomScale <= 1) return;
    setZoomPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoomScale((prev) => Math.min(4, +(prev + 0.25).toFixed(2)));
    } else {
      setZoomScale((prev) => {
        const next = Math.max(1, +(prev - 0.25).toFixed(2));
        if (next === 1) setZoomPosition({ x: 0, y: 0 });
        return next;
      });
    }
  };

  // Scroll to top whenever the active product changes
  useEffect(() => {
    setActiveMediaIndex(0);
    if (bodyRef.current) {
      bodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [product.id]);

  const handlePrevMedia = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMediaIndex((prev) => (prev - 1 + mediaList.length) % mediaList.length);
  };

  const handleNextMedia = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMediaIndex((prev) => (prev + 1) % mediaList.length);
  };

  // 1. PRODUCTOS SIMILARES (Direct code matches from API similarCodes or close subcategory/family matches)
  const similarProductsList: Product[] = [];
  if (product.similarCodes && product.similarCodes.length > 0) {
    const codeSet = new Set(product.similarCodes.map((c) => c.toLowerCase().trim()));
    allProducts.forEach((p) => {
      if (p.id !== product.id) {
        const pCode = p.id.toLowerCase().trim();
        const featureCodes = p.features.map((f) => f.toLowerCase());
        const isMatch =
          codeSet.has(pCode) ||
          featureCodes.some((f) => Array.from(codeSet).some((c) => f.includes(c)));
        if (isMatch && !similarProductsList.some((m) => m.id === p.id)) {
          similarProductsList.push(p);
        }
      }
    });
  }

  // If few similar code matches, complete with direct same-subcategory or exact name keyword matches
  if (similarProductsList.length < 4) {
    const sameSub = allProducts.filter(
      (p) =>
        p.id !== product.id &&
        !similarProductsList.some((m) => m.id === p.id) &&
        ((product.subCategory && p.subCategory === product.subCategory) ||
          (product.color && p.color === product.color && p.category === product.category))
    );
    for (const p of sameSub) {
      if (similarProductsList.length >= 4) break;
      similarProductsList.push(p);
    }
  }

  // If still needed, fill similar with same category items
  if (similarProductsList.length < 4) {
    const sameCat = allProducts.filter(
      (p) =>
        p.id !== product.id &&
        !similarProductsList.some((m) => m.id === p.id) &&
        p.category === product.category
    );
    for (const p of sameCat) {
      if (similarProductsList.length >= 4) break;
      similarProductsList.push(p);
    }
  }

  // 2. PRODUCTOS RELACIONADOS (Complementary items from other collections or broader related categories)
  const relatedProductsList = allProducts
    .filter(
      (p) => p.id !== product.id && !similarProductsList.some((m) => m.id === p.id)
    )
    .map((p) => {
      let score = 0;
      // Complementary matching: if this is a Tree, relate to Bolas, Luces, Cintas, Follaje
      const isTreeCurrent = (product.category || '').toLowerCase().includes('árbol') || (product.category || '').toLowerCase().includes('arbol');
      const pCat = (p.category || '').toLowerCase();
      if (isTreeCurrent) {
        if (pCat.includes('bola') || pCat.includes('luz') || pCat.includes('ilumina') || pCat.includes('cinta') || pCat.includes('flor') || pCat.includes('decor')) {
          score += 50;
        }
      } else {
        if (p.category === product.category) score += 25;
        if (pCat.includes('árbol') || pCat.includes('arbol')) score += 30;
      }
      return { p, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.p)
    .slice(0, 4);

  const hasDiscount = Boolean(
    (product.discountPercentage && product.discountPercentage > 0) ||
    (product.discountPrice && product.price && product.discountPrice < product.price)
  );
  const activePrice = hasDiscount && product.discountPrice ? product.discountPrice : product.price;
  const originalPrice = hasDiscount ? product.price : undefined;
  const savings = originalPrice ? originalPrice - activePrice : 0;

  // Plan Separe es POR PEDIDO (pedidos >= $200.000 COP aplican al 30% de abono inicial)
  const isEligibleDirectly = activePrice >= 200000;
  const depositPercentage = 30;
  const depositAmount = (activePrice * 30) / 100;
  const remainingBalance = activePrice - depositAmount;

  // Monthly payment calculation up to Nov 16, 2026
  const monthlyAmount = selectedInstallments > 0 ? remainingBalance / selectedInstallments : remainingBalance;

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(val);
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.origin + window.location.pathname);
      url.searchParams.set('product', product.id);
      const shareUrl = url.toString();
      if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const whatsappMessage = encodeURIComponent(
    `Hola Impormax, estoy interesado en el producto "${product.name}" (Referencia: ${product.reference || product.id}). ¿Tienen disponibilidad e información del Plan Separe?`
  );

  const handleSelectRelated = (rel: Product) => {
    if (onSelectRelatedProduct) {
      onSelectRelatedProduct(rel);
    }
    setActiveMediaIndex(0);
    if (bodyRef.current) {
      bodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-auto max-h-[92vh] flex flex-col"
      >
        {/* Sticky Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-stone-50 border-b border-stone-200 z-10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-brand-blue/10 text-brand-blue text-[11px] font-extrabold uppercase tracking-wider font-mono">
              ★ Detalle de Producto
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-2 rounded-xl text-stone-600 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-200 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="Copiar enlace directo de este producto"
            >
              <Share2 className="w-4 h-4 text-brand-blue" />
              <span>{copiedLink ? '¡Enlace de Producto Copiado!' : 'Compartir Producto'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-900 hover:bg-stone-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body Container */}
        <div
          ref={bodyRef}
          className="overflow-y-auto p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1"
        >
          {/* LEFT COLUMN: Gallery & Main Image (5 Cols) */}
          <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
            <div>
              {/* Main Media Stage (Image or Video) */}
              <div className="relative aspect-square w-full rounded-2xl bg-stone-100 overflow-hidden border border-stone-200 group">
                {/* Discount Badge Overlay in RED */}
                {(() => {
                  const discountPct =
                    product.discountPercentage ||
                    (product.discountPrice && product.price && product.discountPrice < product.price
                      ? Math.round(((product.price - product.discountPrice) / product.price) * 100)
                      : 0);
                  if (!discountPct || discountPct <= 0) return null;
                  return (
                    <div className="absolute top-3 left-3 z-10 px-3.5 py-1.5 rounded-full bg-red-600 text-white shadow-md text-xs font-black uppercase tracking-wider font-mono flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
                      <span>-{discountPct}% DESCUENTO</span>
                    </div>
                  );
                })()}

                {/* Floating badge for NUEVO (Esquina superior derecha) */}
                {isProductNew(product) && (
                  <div className="absolute top-3 right-3 z-10 px-3.5 py-1.5 rounded-full bg-emerald-600 text-white shadow-md text-xs font-black uppercase tracking-wider font-mono flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
                    <span>NUEVO</span>
                  </div>
                )}

                {/* Current Active Media: Image or Video */}
                {mediaList[activeMediaIndex]?.type === 'video' ? (
                  <div className="w-full h-full bg-stone-950 flex items-center justify-center relative">
                    <video
                      key={mediaList[activeMediaIndex].url}
                      src={mediaList[activeMediaIndex].url}
                      controls
                      autoPlay
                      playsInline
                      poster={product.imageUrl}
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute bottom-3 left-3 z-10 px-3 py-1 rounded-full bg-red-600/90 backdrop-blur-xs text-white text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 shadow-md font-mono pointer-events-none">
                      <Video className="w-3.5 h-3.5" />
                      <span>Video Real del Producto</span>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      setZoomScale(1.5);
                      setZoomPosition({ x: 0, y: 0 });
                      setIsZoomOpen(true);
                    }}
                    className="w-full h-full relative flex items-center justify-center cursor-zoom-in group/img"
                    title="Haz clic para hacer zoom y ver medidas detalladas"
                  >
                    <img
                      src={mediaList[activeMediaIndex]?.url || product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-contain p-3 transition-transform duration-300 group-hover/img:scale-102"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const fallback = product.fallbackImageUrl || 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=800';
                        if (e.currentTarget.src !== fallback) {
                          e.currentTarget.src = fallback;
                        }
                      }}
                    />

                    {/* Botón flotante para abrir el visor de zoom */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setZoomScale(1.5);
                        setZoomPosition({ x: 0, y: 0 });
                        setIsZoomOpen(true);
                      }}
                      className="absolute bottom-3 left-3 z-10 px-3 py-1.5 rounded-full bg-stone-900/85 hover:bg-stone-900 text-white text-[11px] font-bold backdrop-blur-md flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer border border-white/20"
                      title="Ampliar y hacer zoom para apreciar detalles y medidas"
                    >
                      <ZoomIn className="w-3.5 h-3.5 text-amber-400" />
                      <span>Zoom / Ver Medidas</span>
                    </button>
                  </div>
                )}

                {/* Gallery Navigation Arrows (translúcidas para no tapar medidas laterales) */}
                {mediaList.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevMedia}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-700 hover:text-stone-950 shadow-sm flex items-center justify-center transition-all opacity-40 hover:opacity-100 active:scale-90 cursor-pointer z-10 backdrop-blur-xs"
                      title="Anterior"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleNextMedia}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/70 hover:bg-white text-stone-700 hover:text-stone-950 shadow-sm flex items-center justify-center transition-all opacity-40 hover:opacity-100 active:scale-90 cursor-pointer z-10 backdrop-blur-xs"
                      title="Siguiente"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}

                {/* Slide indicator pill */}
                {mediaList.length > 1 && (
                  <div className="absolute bottom-3 right-3 bg-stone-900/80 text-white text-[10px] font-mono px-2.5 py-1 rounded-full backdrop-blur-sm font-bold z-10 flex items-center gap-1">
                    {mediaList[activeMediaIndex]?.type === 'video' && (
                      <Video className="w-3 h-3 text-red-400" />
                    )}
                    <span>
                      {activeMediaIndex + 1} / {mediaList.length}
                    </span>
                  </div>
                )}
              </div>

              {/* Gallery Thumbnails Strip (Photos + Video) */}
              {mediaList.length > 1 && (
                <div className="flex gap-2.5 mt-3 overflow-x-auto pb-1 scrollbar-none">
                  {mediaList.map((m, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveMediaIndex(idx)}
                      className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition-all cursor-pointer flex-shrink-0 ${
                        activeMediaIndex === idx
                          ? m.type === 'video'
                            ? 'border-red-500 ring-2 ring-red-500/40 scale-105'
                            : 'border-brand-blue ring-2 ring-brand-blue/30 scale-105'
                          : 'border-stone-200 opacity-70 hover:opacity-100'
                      }`}
                      title={m.label}
                    >
                      {m.type === 'video' ? (
                        <div className="w-full h-full bg-stone-950 flex flex-col items-center justify-center relative">
                          <img
                            src={product.imageUrl}
                            alt="Vista previa del video"
                            className="w-full h-full object-cover opacity-40"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-white">
                            <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center shadow-md">
                              <Play className="w-3 h-3 text-white fill-white ml-0.5" />
                            </div>
                            <span className="text-[8px] font-black tracking-wider uppercase mt-0.5 font-mono text-white">
                              Video
                            </span>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={m.url}
                          alt={`Vista ${idx + 1}`}
                          className="w-full h-full object-contain p-1"
                          referrerPolicy="no-referrer"
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Guarantees Card */}
            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200/80 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-stone-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Garantía de Satisfacción Impormax</span>
              </div>
              <ul className="text-[11px] text-stone-600 space-y-1.5 leading-tight">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span>Calidad y belleza garantizada en cada detalle.</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-brand-blue flex-shrink-0" />
                  <span>Despachos asegurados a nivel nacional.</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Envío GRATIS por compras superiores a $199.000 en ciudades principales.</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-brand-blue flex-shrink-0" />
                  <span>Plazo de pago hasta el 16 de Noviembre 2026.</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Opción de recoger en tienda física disponible sin costo adicional.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* RIGHT COLUMN: Specs, Calculator & Checkout Trigger (7 Cols) */}
          <div className="lg:col-span-7 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Product Header */}
              <div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-wider mb-1">
                  {isProductNew(product) && (
                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-600 animate-pulse" />
                      NUEVO
                    </span>
                  )}
                  <span className="text-brand-blue bg-brand-blue/10 px-2.5 py-0.5 rounded-md">
                    {product.category || 'Decoración'}
                  </span>
                  {product.color && (
                    <span className="text-stone-600 bg-stone-100 px-2.5 py-0.5 rounded-md">
                      Color: {product.color}
                    </span>
                  )}
                  {product.stock <= 5 && product.stock > 0 && (
                    <span className="text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md ml-auto font-bold font-mono text-[11px]">
                      ¡Últimas {product.stock} unidades!
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-950 tracking-tight leading-snug">
                  {product.name}
                </h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-stone-500 mt-1">
                  <span>
                    Referencia: <strong className="text-stone-900 font-bold">{product.reference || product.id}</strong>
                  </span>
                  {product.code && product.code !== (product.reference || product.id) && (
                    <span className="text-stone-400 font-normal">
                      | Código: {product.code}
                    </span>
                  )}
                </div>

                {productVideoUrl && (
                  <div className="mt-3">
                    <button
                      onClick={() => {
                        const vIdx = mediaList.findIndex((m) => m.type === 'video');
                        if (vIdx !== -1) setActiveMediaIndex(vIdx);
                      }}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors text-xs font-bold font-mono cursor-pointer shadow-xs"
                    >
                      <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center shadow-xs">
                        <Play className="w-2.5 h-2.5 text-white fill-white ml-0.5" />
                      </div>
                      <span>Ver Video Real de este Producto</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Price & Savings Highlight Box */}
              <div className="bg-stone-900 text-white p-5 rounded-2xl space-y-3 shadow-sm border border-stone-800">
                <div className="flex items-baseline justify-between">
                  <div>
                    {originalPrice && originalPrice > activePrice && (
                      <span className="text-xs text-stone-400 line-through block font-mono">
                        {formatCOP(originalPrice)}
                      </span>
                    )}
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-extrabold font-mono text-white">
                        {formatCOP(activePrice)}
                      </span>
                      {savings > 0 && (
                        <span className="bg-emerald-500 text-stone-950 font-bold text-[11px] px-2.5 py-1 rounded-full uppercase tracking-wider">
                          Ahorras {formatCOP(savings)}
                        </span>
                      )}
                    </div>
                  </div>

                  {isEligibleDirectly && (
                    <div className="text-right">
                      <span className="text-[10px] text-brand-blue uppercase font-bold tracking-wider font-mono block">
                        Plan Separe 30%
                      </span>
                      <span className="text-2xl font-extrabold font-mono text-brand-blue">
                        {formatCOP(depositAmount)}
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono block">
                        Abono inicial
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Disponibilidad de inventario: Solo visible cuando quedan 5 o menos unidades */}
              {product.stock !== undefined && (product.stock ?? 0) <= 5 && (
                <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-amber-200/80 bg-amber-50/70 text-xs font-mono">
                  <span className="text-amber-900 font-medium">Disponibilidad en bodega:</span>
                  {(product.stock ?? 0) <= 0 ? (
                    <span className="px-2.5 py-0.5 rounded-md bg-red-100 text-red-700 font-extrabold uppercase text-[11px]">
                      Agotado
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 font-extrabold text-[11px] flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                      {product.stock === 1 ? "¡Solo 1 unidad disponible!" : `¡Solo ${product.stock} unidades disponibles!`}
                    </span>
                  )}
                </div>
              )}

              {/* Interactive Plan Separe Calculator & Conditions */}
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 uppercase font-mono tracking-wider">
                    <Calculator className="w-4 h-4 text-emerald-700" />
                    <span>Condiciones Comerciales y Plan Separe</span>
                  </div>
                  <span className="text-[11px] text-emerald-800 font-bold font-mono">
                    Sin Intereses
                  </span>
                </div>

                <div className="space-y-2 text-xs text-emerald-950 leading-relaxed">
                  <p>
                    ✨ <strong>Plan Separe (30% inicial):</strong> Aplica por pedido completo cuando sumes <strong>$200.000 COP o más</strong> en tu carrito. Puedes apartar con el 30% y abonar el 70% restante a tu ritmo hasta el <strong>16 de Noviembre de 2026</strong>.
                  </p>
                  <p className="text-[11px] text-emerald-800 font-medium">
                    🎁 <strong>10% OFF en 1ra Compra:</strong> Si es tu primer pedido en nuestra tienda, recibes un 10% de descuento adicional sobre el total en el checkout.
                  </p>
                </div>

                {isEligibleDirectly && (
                  <div className="space-y-2 pt-2 border-t border-emerald-200/60">
                    <label className="text-[11px] font-bold text-emerald-900 font-mono uppercase tracking-wider block">
                      Simulación de cuotas sugeridas para este producto (30% inicial: {formatCOP(depositAmount)}):
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[2, 3, 4].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setSelectedInstallments(num)}
                          className={`py-2 px-3 rounded-xl text-xs font-extrabold font-mono transition-all border cursor-pointer ${
                            selectedInstallments === num
                              ? 'bg-emerald-700 border-emerald-800 text-white shadow-sm'
                              : 'bg-white border-emerald-200 text-emerald-900 hover:bg-emerald-100'
                          }`}
                        >
                          {num} Abonos
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-emerald-200 text-xs font-mono">
                      <span className="text-stone-600 font-medium">Cuota mensual estimada ({selectedInstallments} pagos):</span>
                      <strong className="text-emerald-900 text-sm font-bold">
                        {formatCOP(monthlyAmount)} / mes
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Observaciones del Producto (desde ERP Yeminus) */}
              {product.observations && product.observations.trim() !== '' && (
                <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 space-y-1.5 shadow-sm">
                  <div className="flex items-center gap-2 text-amber-900 font-bold uppercase tracking-wider font-mono text-[11px]">
                    <Info className="w-4 h-4 text-amber-700 flex-shrink-0" />
                    <span>Observaciones del Producto</span>
                  </div>
                  <p className="text-xs text-amber-950/90 leading-relaxed whitespace-pre-line font-medium">
                    {product.observations}
                  </p>
                </div>
              )}

              {/* Product Description & Features (Excluding dimension/size and internal codes) */}
              <div className="space-y-3">
                <h3 className="text-xs font-extrabold text-stone-900 uppercase font-mono tracking-wider">
                  Descripción y Especificaciones
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-line">
                  {product.description && product.description.trim() !== ''
                    ? product.description
                    : "Pieza decorativa de alta calidad y diseño exclusivo de la colección navideña Impormax, ideal para realzar la ambientación de tus espacios con elegancia, detalle y acabados de primera."}
                </p>

                {(() => {
                  const modalDistinctFeatures = (product.features || []).filter((feat) => {
                    const f = feat.toLowerCase().trim();
                    return (
                      !f.startsWith('referencia') &&
                      !f.startsWith('categoría') &&
                      !f.startsWith('categoria') &&
                      !f.startsWith('subcategoría') &&
                      !f.startsWith('subcategoria') &&
                      !f.includes('código') &&
                      !f.includes('codigo') &&
                      !f.includes('grupo') &&
                      !f.includes('costo') &&
                      !f.includes('bodega') &&
                      !f.includes('dimensión') &&
                      !f.includes('dimension') &&
                      !f.includes('altura') &&
                      !f.includes('tamaño') &&
                      !f.includes('tamano') &&
                      !f.includes('diámetro') &&
                      !f.includes('diametro') &&
                      f !== product.name.toLowerCase().trim() &&
                      f !== (product.reference || '').toLowerCase().trim()
                    );
                  });

                  const featuresToShow = modalDistinctFeatures.length > 0
                    ? modalDistinctFeatures
                    : [
                        "Garantía de satisfacción y autenticidad Impormax",
                        "Embalaje protector para despachos nacionales 100% asegurados",
                        "Materiales duraderos y acabados detallados de alta gama",
                        "Aplica para separar con solo el 30% en pedidos desde $200.000"
                      ];

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                      {featuresToShow.map((feat, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-2.5 rounded-xl bg-stone-50 border border-stone-200/60 text-xs text-stone-700"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span className="truncate font-medium">{feat}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* BAR 1: PRODUCTOS SIMILARES */}
              {similarProductsList.length > 0 && (
                <div className="pt-4 border-t border-stone-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold text-stone-900 uppercase font-mono tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Productos Similares</span>
                    </h3>
                    <span className="text-[10px] text-stone-500 font-medium font-mono">
                      Misma línea / Familia
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {similarProductsList.map((sim) => {
                      const simDiscountPct =
                        sim.discountPercentage ||
                        (sim.discountPrice && sim.price && sim.discountPrice < sim.price
                          ? Math.round(((sim.price - sim.discountPrice) / sim.price) * 100)
                          : 0);
                      const simPrice = simDiscountPct > 0 && sim.discountPrice ? sim.discountPrice : sim.price;
                      return (
                        <div
                          key={sim.id}
                          onClick={() => handleSelectRelated(sim)}
                          className="group bg-stone-50 hover:bg-stone-100 p-2 rounded-xl border border-stone-200 transition-all cursor-pointer flex flex-col justify-between"
                        >
                          <div className="relative aspect-square rounded-lg overflow-hidden bg-white mb-2 border border-stone-100 p-1">
                            <img
                              src={sim.imageUrl}
                              alt={sim.name}
                              className="w-full h-full object-contain group-hover:scale-102 transition-transform duration-300"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                            {simDiscountPct > 0 ? (
                              <span className="absolute top-1 right-1 bg-amber-500 text-stone-950 font-black text-[9px] px-1.5 py-0.5 rounded font-mono">
                                -{simDiscountPct}%
                              </span>
                            ) : null}
                          </div>
                          <div>
                            <div className="text-[9px] font-mono font-bold text-stone-500 uppercase truncate">
                              Ref: {sim.reference || sim.id}
                            </div>
                            <h4 className="text-[11px] font-bold text-stone-800 line-clamp-2 leading-tight group-hover:text-brand-blue transition-colors">
                              {sim.name}
                            </h4>
                            <span className="text-xs font-extrabold font-mono text-stone-900 block mt-1">
                              {formatCOP(simPrice)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* BAR 2: PRODUCTOS RELACIONADOS */}
              {relatedProductsList.length > 0 && (
                <div className="pt-4 border-t border-stone-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold text-stone-900 uppercase font-mono tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-brand-blue" />
                      <span>Productos Relacionados</span>
                    </h3>
                    <span className="text-[10px] text-stone-500 font-medium">
                      Complementa tu decoración
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {relatedProductsList.map((rel) => {
                      const relDiscountPct =
                        rel.discountPercentage ||
                        (rel.discountPrice && rel.price && rel.discountPrice < rel.price
                          ? Math.round(((rel.price - rel.discountPrice) / rel.price) * 100)
                          : 0);
                      const relPrice = relDiscountPct > 0 && rel.discountPrice ? rel.discountPrice : rel.price;
                      return (
                        <div
                          key={rel.id}
                          onClick={() => handleSelectRelated(rel)}
                          className="group bg-stone-50 hover:bg-stone-100 p-2 rounded-xl border border-stone-200 transition-all cursor-pointer flex flex-col justify-between"
                        >
                          <div className="relative aspect-square rounded-lg overflow-hidden bg-white mb-2 border border-stone-100 p-1">
                            <img
                              src={rel.imageUrl}
                              alt={rel.name}
                              className="w-full h-full object-contain group-hover:scale-102 transition-transform duration-300"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                            {relDiscountPct > 0 ? (
                              <span className="absolute top-1 right-1 bg-amber-500 text-stone-950 font-black text-[9px] px-1.5 py-0.5 rounded font-mono">
                                -{relDiscountPct}%
                              </span>
                            ) : null}
                          </div>
                          <div>
                            <div className="text-[9px] font-mono font-bold text-stone-500 uppercase truncate">
                              Ref: {rel.reference || rel.id}
                            </div>
                            <h4 className="text-[11px] font-bold text-stone-800 line-clamp-2 leading-tight group-hover:text-brand-blue transition-colors">
                              {rel.name}
                            </h4>
                            <span className="text-xs font-extrabold font-mono text-stone-900 block mt-1">
                              {formatCOP(relPrice)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Action CTAs */}
            <div className="space-y-3 pt-4 border-t border-stone-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Add to Cart - Primary Green CTA */}
                <button
                  onClick={() => onAddToCart(product)}
                  disabled={(product.stock ?? 0) <= 0}
                  className={`py-3.5 px-5 rounded-2xl font-extrabold text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 ${
                    (product.stock ?? 0) <= 0
                      ? 'bg-stone-200 text-stone-400 cursor-not-allowed border border-stone-300 shadow-none'
                      : 'text-white cursor-pointer bg-brand-green hover:bg-brand-green-dark shadow-brand-green/20'
                  }`}
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>{(product.stock ?? 0) <= 0 ? 'Producto Agotado' : 'Agregar al Carrito'}</span>
                </button>

                {/* Buy / Separe Now */}
                <button
                  onClick={() => onBuyNow(product)}
                  disabled={(product.stock ?? 0) <= 0}
                  className={`py-3.5 px-5 rounded-2xl font-extrabold text-xs uppercase tracking-wider border transition-all flex items-center justify-center gap-2 ${
                    (product.stock ?? 0) <= 0
                      ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed'
                      : 'text-stone-800 bg-stone-100 hover:bg-stone-200 border-stone-300/70 cursor-pointer'
                  }`}
                >
                  <Sparkles className={`w-4 h-4 ${(product.stock ?? 0) <= 0 ? 'text-stone-400' : 'text-amber-600'}`} />
                  <span>
                    {(product.stock ?? 0) <= 0
                      ? 'No disponible'
                      : isEligibleDirectly
                      ? `Comprar / Separar (${formatCOP(depositAmount)})`
                      : 'Comprar / Ir a Pagar'}
                  </span>
                </button>
              </div>

              {/* Direct WhatsApp Consultation button */}
              <a
                href={`https://wa.me/573154618049?text=${whatsappMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>¿Tienes dudas? Consultar disponibilidad por WhatsApp</span>
              </a>

              {/* Payment Methods Banner */}
              <div className="pt-2 flex items-center justify-between text-[10px] text-stone-400 font-mono">
                <span className="flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-stone-500" />
                  Aceptamos Wompi, PSE, Nequi, Daviplata, Tarjetas Débito y Crédito
                </span>
                <span className="text-emerald-600 font-bold">100% Seguro</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Lightbox Modal para Zoom Interactivo de Alta Resolución */}
      <AnimatePresence>
        {isZoomOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-stone-950/95 backdrop-blur-md flex flex-col text-white select-none"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsZoomOpen(false);
            }}
          >
            {/* Header: Controles de Zoom y Cerrar */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-stone-800 bg-stone-900/90 z-20">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-xs text-stone-400 bg-stone-800 px-2.5 py-1 rounded-lg">
                  {activeMediaIndex + 1} / {mediaList.length}
                </span>
                <div className="truncate">
                  <h3 className="text-sm font-bold truncate text-white">{product.name}</h3>
                  <span className="text-[11px] text-stone-400 font-mono">
                    Ref: {product.reference || product.id} • Vista de Medidas y Detalles
                  </span>
                </div>
              </div>

              {/* Toolbar de Zoom */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={zoomScale <= 1}
                  className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                  title="Alejar (-)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleToggleZoom}
                  className="px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-400 font-mono text-xs font-bold transition cursor-pointer"
                  title="Cambiar escala (100% / 200%)"
                >
                  {Math.round(zoomScale * 100)}%
                </button>

                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={zoomScale >= 4}
                  className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                  title="Acercar (+)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition cursor-pointer"
                  title="Restablecer tamaño (0)"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsZoomOpen(false)}
                  className="p-2 ml-2 rounded-xl bg-stone-800 hover:bg-red-600 text-stone-200 hover:text-white transition cursor-pointer"
                  title="Cerrar visor (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Aviso informativo de ayuda */}
            <div className="bg-stone-900/60 py-1.5 px-4 text-center text-[11px] text-stone-400 border-b border-stone-800/60 flex items-center justify-center gap-2">
              <span>🔍 Usa la rueda del ratón o haz doble clic para ampliar.</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">Arrastra con el ratón o el dedo para desplazarte por los laterales y apreciar las medidas.</span>
            </div>

            {/* Stage central del zoom */}
            <div
              className="flex-1 w-full overflow-hidden relative flex items-center justify-center cursor-default"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              onDoubleClick={handleToggleZoom}
            >
              <img
                src={mediaList[activeMediaIndex]?.url || product.imageUrl}
                alt={product.name}
                draggable={false}
                style={{
                  transform: `translate(${zoomPosition.x}px, ${zoomPosition.y}px) scale(${zoomScale})`,
                  cursor: zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
                  transition: isDragging ? 'none' : 'transform 0.12s ease-out',
                  maxWidth: '90%',
                  maxHeight: '90%',
                  objectFit: 'contain'
                }}
                className="select-none pointer-events-auto"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Footer con miniaturas y navegación SIN obstruir la imagen */}
            <div className="p-3 bg-stone-900/90 border-t border-stone-800 flex items-center justify-between gap-4 z-20">
              <button
                type="button"
                onClick={handlePrevMedia}
                disabled={mediaList.length <= 1}
                className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 disabled:opacity-30 disabled:pointer-events-none text-xs font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Anterior</span>
              </button>

              <div className="flex gap-2 overflow-x-auto py-1 max-w-xl scrollbar-none justify-center">
                {mediaList.map((m, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setActiveMediaIndex(idx);
                      setZoomPosition({ x: 0, y: 0 });
                    }}
                    className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 transition-all cursor-pointer flex-shrink-0 ${
                      activeMediaIndex === idx
                        ? 'border-amber-400 ring-2 ring-amber-400/50 scale-105'
                        : 'border-stone-700 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={m.url}
                      alt={m.label}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleNextMedia}
                disabled={mediaList.length <= 1}
                className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 disabled:opacity-30 disabled:pointer-events-none text-xs font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <span className="hidden sm:inline">Siguiente</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
