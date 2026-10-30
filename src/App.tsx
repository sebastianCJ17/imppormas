import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Order } from './types';
import { apiService, getApiUrl } from './services/api';

// Component Imports
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import CategoryShowcase from './components/CategoryShowcase';
import Catalog from './components/Catalog';
import Process from './components/Process';
import FAQ from './components/FAQ';
import Checkout from './components/Checkout';
import ClientPortal from './components/ClientPortal';
import AdminPortal from './components/AdminPortal';
import Footer from './components/Footer';
import ApiDiagnostics from './components/ApiDiagnostics';
import CartDrawer from './components/CartDrawer';
import FirstOrderPromoModal from './components/FirstOrderPromoModal';
import OrderReceiptModal, { OrderReceiptData } from './components/OrderReceiptModal';

// Lucide icons & supabase client helpers
import { isSupabaseConfigured } from './supabase/client';

// Registro global para evitar múltiples llamadas de verificación desde el navegador
const processedWompiRedirects = new Set<string>();

export default function App() {
  const [activeSection, setActiveSection] = useState('hero');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cart, setCart] = useState<Array<{ product: Product; quantity: number }>>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<OrderReceiptData | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Manejador para búsquedas por palabras clave con auto-scroll al catálogo
  const handleSearchSubmit = () => {
    const catalogEl = document.getElementById('catalogo');
    if (catalogEl) {
      catalogEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSearchQueryChange = (query: string) => {
    setSearchQuery(query);
    if (query.trim().length > 0) {
      const catalogEl = document.getElementById('catalogo');
      if (catalogEl) {
        const rect = catalogEl.getBoundingClientRect();
        if (rect.top > window.innerHeight || rect.bottom < 100) {
          catalogEl.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  };

  // Mostrar el popup promocional del 10% cada vez que se cargue o recargue la página
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPromoModalOpen(true);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Detector de ruta URL /admin o #admin (Sin ningún botón público visible)
  const [currentRoute, setCurrentRoute] = useState<'landing' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      if (path === '/admin' || path.startsWith('/admin') || hash === '#admin') {
        return 'admin';
      }
    }
    return 'landing';
  });

  useEffect(() => {
    const handleLocationChange = () => {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname.toLowerCase();
        const hash = window.location.hash.toLowerCase();
        if (path === '/admin' || path.startsWith('/admin') || hash === '#admin') {
          setCurrentRoute('admin');
        } else {
          setCurrentRoute('landing');
        }
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // Manejo de confirmación automática de Wompi al retornar (?id=TRANSACTION_ID)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const searchParams = new URLSearchParams(window.location.search);
    let wompiTxId = searchParams.get('id') || searchParams.get('transaction_id') || searchParams.get('transactionId') || searchParams.get('txId') || searchParams.get('reference') || searchParams.get('ref');

    if (!wompiTxId && window.location.hash.includes('?')) {
      const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
      wompiTxId = hashParams.get('id') || hashParams.get('transaction_id') || hashParams.get('transactionId') || hashParams.get('txId') || hashParams.get('reference') || hashParams.get('ref');
    }

    if (!wompiTxId || processedWompiRedirects.has(wompiTxId)) return;
    processedWompiRedirects.add(wompiTxId);

    const verifyWompi = async () => {
      // Limpiar ?id= de la barra de direcciones para evitar dobles llamadas al recargar
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);

      // Recuperar sesión pendiente de sessionStorage o localStorage
      let pendingCheckout: any = null;
      try {
        const raw = sessionStorage.getItem('pending_wompi_checkout') || localStorage.getItem('pending_wompi_checkout_last');
        if (raw) pendingCheckout = JSON.parse(raw);
      } catch (e) {
        console.error('Error parseando pending_wompi_checkout:', e);
      }

      showToast('Verificando estado de tu pago en Wompi...', 'info');

      try {
        const res = await fetch(getApiUrl('/api/wompi/confirm-transaction'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionId: wompiTxId,
            fallbackOrderData: pendingCheckout?.orderData || pendingCheckout,
            pendingCheckout: pendingCheckout?.orderData || pendingCheckout,
          }),
        });
        const data = await res.json();

        if (data.status === 'APPROVED' && data.success) {
          sessionStorage.removeItem('pending_wompi_checkout');
          localStorage.removeItem('pending_wompi_checkout_last');
          handleClearCart();
          fetchCatalog(false);

          if (data.receipt) {
            setReceiptData(data.receipt);
            setIsReceiptOpen(true);
          } else {
            // Consultar recibo enriquecido en el backend por ID de transacción
            apiService.getReceipt(wompiTxId).then((rec) => {
              if (rec) {
                setReceiptData(rec);
                setIsReceiptOpen(true);
              }
            }).catch((err) => console.warn('No se pudo cargar recibo remoto:', err));
          }

          showToast(
            '¡Pago APROBADO por Wompi! Tu pedido y reserva en Yeminus han sido confirmados exitosamente.',
            'success'
          );
        } else if (
          data.status === 'DECLINED' ||
          data.status === 'VOIDED' ||
          data.status === 'ERROR'
        ) {
          sessionStorage.removeItem('pending_wompi_checkout');
          showToast(
            `El pago fue RECHAZADO por Wompi (${data.status}). La orden no ha sido creada ni registrada.`,
            'info'
          );
        } else if (data.status === 'PENDING') {
          showToast('El pago está en proceso de validación en Wompi (PENDIENTE).', 'info');
        }
      } catch (err) {
        console.error('Error confirmando transacción Wompi:', err);
      }
    };

    verifyWompi();
  }, []);

  // Cargar catálogo de productos con sincronización automática cada 5 minutos
  useEffect(() => {
    fetchCatalog(true);
    const interval = setInterval(() => {
      fetchCatalog(false);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchCatalog = async (showLoading = false) => {
    if (showLoading) setIsLoadingCatalog(true);
    try {
      const data = await apiService.getProducts();
      setProducts(data);
    } catch (err) {
      console.error('Error cargando catálogo:', err);
    } finally {
      if (showLoading) setIsLoadingCatalog(false);
    }
  };

  // Callback al seleccionar un árbol/producto del catálogo (Agrega al carrito y abre Drawer)
  const handleSelectProduct = (product: Product) => {
    const availStock = product.stock ?? 0;
    if (availStock <= 0) {
      showToast(`Lo sentimos, "${product.name}" se encuentra agotado.`, 'info');
      return;
    }

    let limitReached = false;
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= availStock) {
          limitReached = true;
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });

    if (limitReached) {
      showToast(`Solo hay ${availStock} unidad(es) disponible(s) de "${product.name}".`, 'info');
      setIsCartOpen(true);
      return;
    }

    setIsCartOpen(true);
    showToast(`"${product.name}" agregado al carrito`, 'success');
  };

  const handleUpdateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => item.product.id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const maxStock = item.product.stock ?? 999;
          if (quantity > maxStock) {
            showToast(`Solo hay ${maxStock} unidad(es) disponible(s) de "${item.product.name}"`, 'info');
            return { ...item, quantity: maxStock };
          }
          return { ...item, quantity };
        }
        return item;
      })
    );
  };

  const handleRemoveCartItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleGoToCheckout = () => {
    setIsCartOpen(false);
    const checkoutEl = document.getElementById('checkout');
    if (checkoutEl) {
      checkoutEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Manejar el envío de un pedido nuevo
  const handleSubmitOrder = async (
    orderData: Omit<Order, 'id' | 'paid_amount' | 'balance_pending' | 'status' | 'created_at'> & {
      items?: Array<{ product_id: string; product_name: string; quantity: number; price: number }>;
    },
    initialPaymentMethod: string,
    initialPaymentReference: string
  ): Promise<Order> => {
    // 1. Crear el pedido adjuntando el método de pago para Yeminus ERP
    const createdOrder = await apiService.createOrder({
      ...orderData,
      payment_method: initialPaymentMethod
    } as any);
    
    // 2. Registrar el depósito inicial (Aprobado para Wompi, Pendiente de Verificación para Transferencia/Bre-B)
    const isDirect = initialPaymentMethod === 'transferencia' || initialPaymentMethod === 'bre-b';
    const initialStatus = isDirect ? 'pending' : 'approved';

    await apiService.registerPayment({
      order_id: createdOrder.id,
      amount: createdOrder.deposit_amount,
      payment_method: initialPaymentMethod as any,
      payment_reference: initialPaymentReference || `REF-${Math.floor(100000 + Math.random() * 900000)}`,
      status: initialStatus
    }, true);

    if (isDirect) {
      showToast('Pedido registrado. Queda pendiente de verificación de transferencia.', 'info');
    } else {
      showToast('Pedido registrado y abono inicial cargado con éxito', 'success');
    }
    
    // Devolvemos el pedido actualizado
    const approvedPaid = isDirect ? 0 : createdOrder.deposit_amount;
    return {
      ...createdOrder,
      paid_amount: approvedPaid,
      balance_pending: createdOrder.total_amount - approvedPaid,
      status: isDirect ? 'pending' : 'abonando'
    };
  };

  // Toast notifier helper
  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleSelectCategory = (category: string) => {
    setSelectedCategory(category);
    const catalogEl = document.getElementById('catalogo');
    if (catalogEl) {
      catalogEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleNavigation = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const hasSupabase = isSupabaseConfigured();

  if (currentRoute === 'admin') {
    return (
      <AdminPortal
        onBackToStore={() => {
          if (typeof window !== 'undefined') {
            window.history.pushState(null, '', '/');
            window.location.hash = '';
          }
          setCurrentRoute('landing');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFB] text-stone-900 font-sans antialiased selection:bg-brand-blue/20 selection:text-brand-blue">
      
      {/* Header Menu (includes sticky blue announcement bar) */}
      <Navbar 
        onNavigate={handleNavigation} 
        activeSection={activeSection} 
        cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
        onCartClick={() => setIsCartOpen(true)}
        onOpenPromo={() => setIsPromoModalOpen(true)}
        searchQuery={searchQuery}
        onSearchQueryChange={handleSearchQueryChange}
        onSearchSubmit={handleSearchSubmit}
      />

      {/* Main Landing compilation */}
      <main className="relative">
        
        {/* Section 1: Hero Banner */}
        <div id="hero">
          <Hero 
            onNavigate={handleNavigation} 
            products={products}
            onSelectProduct={handleSelectProduct}
          />
        </div>

        {/* Section 1.5: High Visibility Category Showcase */}
        <div id="categorias">
          <CategoryShowcase
            products={products}
            onSelectCategory={handleSelectCategory}
          />
        </div>

        {/* Section 2: Product Catalog Grid */}
        <Catalog
          onSelectProduct={handleSelectProduct}
          isLoadingCatalog={isLoadingCatalog}
          products={products}
          onRefresh={fetchCatalog}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
        />

        {/* Section 3: Process Timeline */}
        <Process />

        {/* Section 4: Collapsible Questions Accordions */}
        <FAQ />

        {/* Section 6: Checkout Booking Form */}
        <Checkout
          cart={cart}
          onSubmitOrder={handleSubmitOrder}
          onClearCart={handleClearCart}
        />

        {/* Section 7: Customers Balance Self-service Portal */}
        <div id="portal">
          <ClientPortal />
        </div>

      </main>

      {/* Section 8: Legal and Address Footer */}
      <Footer onNavigate={handleNavigation} />

      {/* Shopping Cart Slider Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <CartDrawer
            isOpen={isCartOpen}
            onClose={() => setIsCartOpen(false)}
            cart={cart}
            onUpdateQuantity={handleUpdateCartQuantity}
            onRemoveItem={handleRemoveCartItem}
            onGoToCheckout={handleGoToCheckout}
          />
        )}
      </AnimatePresence>

      {/* Promotional 10% First Order Modal */}
      <FirstOrderPromoModal
        isOpen={isPromoModalOpen}
        onClose={() => setIsPromoModalOpen(false)}
        onExploreCatalog={() => handleSelectCategory('Todos')}
      />

      {/* Comprobante Oficial de Pago Wompi y Pedido Yeminus */}
      <OrderReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        receipt={receiptData}
      />

      {/* Floating Animated Feedback Toast Messages */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-55 max-w-sm bg-stone-900 border border-stone-800 text-white p-4.5 rounded-2xl shadow-xl flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              ✓
            </div>
            <div className="flex-1">
              <h5 className="text-xs font-bold font-mono uppercase tracking-wide text-stone-400">Notificación</h5>
              <p className="text-xs text-stone-200 mt-0.5">{toast.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
