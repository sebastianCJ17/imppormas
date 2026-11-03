import { getSupabaseClient, isSupabaseConfigured } from '../supabase/client';
import { Product, Order, Payment, OrderStatus } from '../types';

// Opciones de configuración de la API Externa REST
const API_BASE_URL = import.meta.env.VITE_EXTERNAL_API_URL || '';

/**
 * Resuelve la URL correcta para la API según el entorno.
 * Si se ejecuta bajo la subcarpeta /plansepare/ (cPanel), antepone automáticamente /plansepare
 * para evitar que las peticiones caigan en el WordPress raíz del dominio.
 */
export const getApiUrl = (endpoint: string): string => {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    if (pathname.includes('/plansepare') && !path.startsWith('/plansepare')) {
      return `/plansepare${path}`;
    }
  }
  return path;
};

export const getAdminHeaders = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};
  const token = sessionStorage.getItem('impormax_admin_token') || (sessionStorage.getItem('impormax_admin_auth') === 'true' ? 'impormax2026' : '');
  return token ? { 'Authorization': `Bearer ${token}`, 'x-admin-key': token } : {};
};

// Catálogo por defecto de Árboles de Navidad Premium de Impormax
// Contiene imágenes reales y profesionales de alta calidad, precios coherentes en COP
// y porcentajes de separación ("Plan Separe") realistas e interactivos.
export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'arb-01',
    name: 'Árbol Imperial Nevado Premium',
    description: 'Nuestro árbol insignia. Diseñado con ramas densas que imitan la nieve natural esponjada del norte. Estructura de aluminio reforzada, súper duradero y de fácil ensamble.',
    price: 680000,
    discountPrice: 590000,
    imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=800',
    stock: 12,
    separePercentage: 30, // 30% Plan Separe
    features: ['Altura: 2.20 metros', 'Puntas nevadas ultra densas', 'Base metálica reforzada', 'Ramas plegables automáticas'],
    dimensions: 'Altura: 2.20m | Diámetro: 1.35m',
    category: 'Árboles',
    color: 'Nevado',
    height: 'Alto (más de 2.10m)',
    publicationDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    isNew: true
  },
  {
    id: 'arb-02',
    name: 'Árbol Canadiense Verde Clásico',
    description: 'Sabor tradicional. Densidad excepcional con acículas de pino bicolor para un realismo inigualable. Ideal para decoraciones clásicas con luces cálidas.',
    price: 490000,
    discountPrice: 420000,
    imageUrl: 'https://images.unsplash.com/photo-1512413990053-0df13b3189a0?auto=format&fit=crop&q=80&w=800',
    stock: 25,
    separePercentage: 30, // 30% Plan Separe
    features: ['Altura: 1.80 metros', 'Pino bicolor ultra realista', 'Retardante de fuego', 'Soporta adornos pesados'],
    dimensions: 'Altura: 1.80m | Diámetro: 1.15m',
    category: 'Árboles',
    color: 'Verde',
    height: 'Mediano (1.80m a 2.00m)',
    publicationDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    isNew: false
  },
  {
    id: 'arb-03',
    name: 'Árbol de Lujo Alpino Con Piñas',
    description: 'Estilo rústico sofisticado. Incluye piñas de pino reales recolectadas e iluminación micro-LED cálida integrada de bajo consumo pre-instalada.',
    price: 850000,
    discountPrice: 790000,
    imageUrl: 'https://images.unsplash.com/photo-1576692139733-8581d494022a?auto=format&fit=crop&q=80&w=800',
    stock: 8,
    separePercentage: 30, // 30% Plan Separe
    features: ['Altura: 2.10 metros', 'Piñas de pino naturales incorporadas', '300 luces LED cálidas integradas', 'Pedal de encendido incluido'],
    dimensions: 'Altura: 2.10m | Diámetro: 1.25m',
    category: 'Árboles',
    color: 'Dorado',
    height: 'Alto (más de 2.10m)',
    publicationDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    isNew: false
  },
  {
    id: 'arb-04',
    name: 'Árbol Slim Elegance Premium',
    description: 'Diseño inteligente para espacios compactos o apartamentos modernos sin sacrificar altura ni majestuosidad. Perfil esbelto con máxima elegancia.',
    price: 450000,
    discountPrice: 380000,
    imageUrl: 'https://images.unsplash.com/photo-1545232979-8bf34eb9757b?auto=format&fit=crop&q=80&w=800',
    stock: 15,
    separePercentage: 30, // 30% Plan Separe
    features: ['Altura: 2.00 metros', 'Perfil delgado ideal para apartamentos', 'Montaje rápido en 3 pasos', 'Incluye bolsa premium para almacenamiento'],
    dimensions: 'Altura: 2.00m | Diámetro: 0.85m',
    category: 'Árboles',
    color: 'Nevado',
    height: 'Mediano (1.80m a 2.00m)',
    publicationDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    isNew: true
  },
  {
    id: 'dec-01',
    name: 'Set de Bolas de Navidad Champaña',
    description: 'Set de 38 piezas de bolas premium en acabado mate, brillante y escarchado. Añaden una elegancia inigualable a cualquier decoración de árbol.',
    price: 90000,
    discountPrice: 74000,
    imageUrl: 'https://images.unsplash.com/photo-1543258103-a62bdc069871?auto=format&fit=crop&q=80&w=800',
    stock: 45,
    separePercentage: 100, // No aplica separado (pago completo)
    features: ['Contenido: 38 piezas de 8cm', 'Acabados mixtos (brillante/mate)', 'Resistente a caídas', 'Color champaña/dorado'],
    dimensions: 'Diámetro: 8cm | Material: Poliestireno',
    category: 'Bolas',
    color: 'Champaña/Bronce',
    height: 'No aplica',
    publicationDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    isNew: true
  },
  {
    id: 'dec-02',
    name: 'Cinta Alambrada Navideña de Lujo',
    description: 'Cinta alambrada de alta calidad de 2.5 pulgadas por 10 yardas. Perfecta para hacer lazos majestuosos y decorar las ramas superiores de tu árbol.',
    price: 25000,
    discountPrice: 18000,
    imageUrl: 'https://images.unsplash.com/photo-1575549594211-18c1b69a17a3?auto=format&fit=crop&q=80&w=800',
    stock: 60,
    separePercentage: 100, // No aplica separado (pago completo)
    features: ['Longitud: 10 Yardas (9.1 metros)', 'Bordes alambrados para moldear fácil', 'Color rojo con destellos dorados', 'Ancho: 2.5 pulgadas'],
    dimensions: 'Ancho: 2.5 in | Largo: 10 yds',
    category: 'Cintas y Mallas',
    color: 'Rojo',
    height: 'No aplica',
    publicationDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
    isNew: false
  },
  {
    id: 'dec-03',
    name: 'Instalación Lineal Micro-LED',
    description: 'Instalación lineal micro-LED de alambre de cobre de 16 metros de largo con 100 bombillas de luz cálida. Cuenta con 8 modos de iluminación simétrica.',
    price: 45000,
    discountPrice: 32000,
    imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=800',
    stock: 50,
    separePercentage: 100, // No aplica separado (pago completo)
    features: ['Longitud: 16 metros', '100 luces Micro-LED cálidas', 'Alambre de cobre flexible y discreto', 'Control con 8 modos de luz'],
    dimensions: 'Longitud: 16m | Conector: USB',
    category: 'Luces Navideñas',
    color: 'Dorado',
    height: 'No aplica',
    publicationDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    isNew: true
  }
];

// Llave de consulta para LocalStorage
const LOCAL_ORDERS_KEY = 'impormax_local_orders';
const LOCAL_PAYMENTS_KEY = 'impormax_local_payments';

// Inicializar Base de Datos en LocalStorage vacía para producción limpia
const initializeLocalStorageDb = () => {
  if (typeof window === 'undefined') return;
  
  try {
    // Si contiene datos de prueba previos (como IMP-2026-0001 o sin estructura), limpiar
    const currentOrders = JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) || '[]');
    const filteredOrders = currentOrders.filter(
      (o: any) => o && o.id !== 'IMP-2026-0001' && o.id !== 'IMP-2026-0002' && o.customer_name !== 'Juan Pérez Díaz' && o.customer_name !== 'Sandra Milena Gómez'
    );
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(filteredOrders));

    const currentPayments = JSON.parse(localStorage.getItem(LOCAL_PAYMENTS_KEY) || '[]');
    const filteredPayments = currentPayments.filter(
      (p: any) => p && p.id !== 'pay-uuid-01' && p.order_id !== 'IMP-2026-0001'
    );
    localStorage.setItem(LOCAL_PAYMENTS_KEY, JSON.stringify(filteredPayments));
  } catch {
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify([]));
    localStorage.setItem(LOCAL_PAYMENTS_KEY, JSON.stringify([]));
  }
};

// Ejecutar Inicialización Limpia
initializeLocalStorageDb();

export const apiService = {
  /**
   * Obtiene la lista de árboles de navidad desde el REST API,
   * con fallback seguro y elegante al catálogo por defecto.
   */
  async getProducts(): Promise<Product[]> {
    try {
      const response = await fetch(getApiUrl("/api/yeminus/products"));
      if (!response.ok) throw new Error("Fallo al consultar productos del servidor proxy");
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        // Regla estricta: Solo mostrar productos con stock/saldo >= 1 y con fotografía real
        return (data as Product[]).filter((p) => {
          const hasStock = (p.stock ?? 0) >= 1;
          const img = String(p.imageUrl || '').trim();
          const hasPhoto = Boolean(
            img &&
            img !== '' &&
            !img.includes('placeholder') &&
            !img.endsWith('/') &&
            !img.endsWith('null') &&
            !img.endsWith('0.jpg') &&
            !img.includes('undefined')
          );
          return hasStock && hasPhoto;
        });
      }
    } catch (error) {
      console.warn("Failing Yeminus API, using premium fallback catalog:", error);
    }

    // Retorno directo sin API o en fallback
    return new Promise((resolve) => {
      setTimeout(() => resolve(DEFAULT_PRODUCTS.filter((p) => (p.stock ?? 0) >= 1)), 600); // Pequeño delay de red
    });
  },

  /**
   * Verifica si el cliente califica para el 10% de descuento de Primera Compra
   */
  async checkFirstOrder(params: { document?: string; email?: string; phone?: string }): Promise<{
    isFirstOrder: boolean;
    discountPercent: number;
    discountCode?: string | null;
    message: string;
  }> {
    try {
      const response = await fetch(getApiUrl("/api/customers/check-first-order"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params)
      });
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (e) {
      console.warn("Fallo al verificar primera compra:", e);
    }
    // Fallback favorable al cliente
    return {
      isFirstOrder: true,
      discountPercent: 10,
      discountCode: "PRIMERACOMPRA10",
      message: "¡Aplica 10% de descuento adicional en tu primer pedido!"
    };
  },

  /**
   * Registra un nuevo pedido. 
   * Intenta registrar el cliente (tercero) y crear el separado (documento SLP) en Yeminus,
   * con persistencia de contingencia local.
   */
  async createOrder(orderData: Omit<Order, 'id' | 'paid_amount' | 'balance_pending' | 'status' | 'created_at'> & { items?: Array<{ product_id: string; product_name: string; quantity: number; price: number }> }): Promise<Order> {
    // 1. Guardar primero en el Backend oficial (/api/orders) para almacenar en las 3 tablas (orders, order_items, payments)
    try {
      const resp = await fetch(getApiUrl('/api/orders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      if (resp.ok) {
        const json = await resp.json();
        if (json.success && json.order) {
          const created: Order = {
            id: json.order.id,
            customer_name: json.order.customer_name,
            customer_document: json.order.customer_document,
            customer_email: json.order.customer_email,
            customer_phone: json.order.customer_phone,
            shipping_address: json.order.shipping_address,
            shipping_city: json.order.shipping_city,
            product_id: json.order.product_id,
            product_name: json.order.product_name,
            subtotal_amount: json.order.subtotal_amount || json.order.subtotal,
            discount_amount: json.order.discount_amount || json.order.discount,
            total_amount: json.order.total_amount || json.order.total,
            deposit_amount: json.order.deposit_amount || json.order.initial_payment,
            paid_amount: json.order.paid_amount,
            balance_pending: json.order.balance_pending || json.order.balance,
            status: json.order.status,
            items: json.order.items,
            created_at: json.order.created_at
          };
          const localOrders = JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) || '[]');
          localOrders.unshift(created);
          localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(localOrders.slice(0, 50)));
          return created;
        }
      }
    } catch (e) {
      console.warn("Error enviando pedido a backend /api/orders:", e);
    }

    const uuidSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderId = (orderData as any).wompi_reference || `IMP-2026-${uuidSuffix}`;

    const newOrder: Order = {
      ...orderData,
      id: orderId,
      paid_amount: 0,
      balance_pending: orderData.total_amount,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    // Registrar en Supabase si está disponible
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const orderUuid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : undefined;
        const { data, error } = await supabase
          .from('pedidos')
          .insert([{
            id: orderUuid,
            cliente_nombre: newOrder.customer_name,
            cliente_email: newOrder.customer_email,
            cliente_telefono: newOrder.customer_phone,
            producto_id: newOrder.product_id,
            producto_name: `${newOrder.product_name} [Ref: ${newOrder.id}]`,
            total: newOrder.total_amount,
            abonado: newOrder.paid_amount || 0,
            restante: newOrder.balance_pending || newOrder.total_amount,
            estado: newOrder.status === 'pagado' ? 'pagado' : 'abonando'
          }])
          .select()
          .single();

        if (error) {
          console.warn('Advertencia al insertar en Supabase pedidos:', error.message);
        } else if (data) {
          newOrder.balance_pending = data.restante ?? (data.total - (data.abonado || 0));
        }
      } catch (err) {
        console.warn('Supabase no disponible para inserción de pedido, usando almacenamiento local.');
      }
    }

    // Guardar siempre Localmente para garantizar persistencia inmediata
    const localOrders = JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) || '[]');
    const existingIdx = localOrders.findIndex((o: Order) => o.id === newOrder.id);
    if (existingIdx !== -1) {
      localOrders[existingIdx] = newOrder;
    } else {
      localOrders.push(newOrder);
    }
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(localOrders));

    return newOrder;
  },

  /**
   * Registra un pago o abono a un separado en Yeminus.
   * Auto-actualiza el saldo en el ERP, Supabase y LocalStorage.
   * isInitial indica que es el abono inicial cargado con la creación del SLP (evita duplicar abono en Yeminus).
   */
  async registerPayment(paymentData: Omit<Payment, 'id' | 'created_at'>, isInitial = false): Promise<Payment> {
    const paymentId = `pay-${Math.random().toString(36).substr(2, 9)}`;
    let isYeminus = false;

    // Intentar pagar en Yeminus si el order_id inicia con "SLP" y NO es el abono inicial (ya registrado en la creación del SLP)
    if (paymentData.order_id.startsWith("SLP") && !isInitial) {
      try {
        const localOrders = JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) || '[]');
        const order = localOrders.find((o: Order) => o.id === paymentData.order_id);
        const docNum = order ? order.customer_document : "15150150";

        const response = await fetch(getApiUrl("/api/yeminus/separados/pagar"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_document: docNum,
            amount: paymentData.amount,
            slp_document_id: paymentData.order_id,
            payment_method: paymentData.payment_method
          })
        });

        const data = await response.json();
        if (data.success) {
          isYeminus = true;
          console.log(`Pago aplicado con éxito en Yeminus para el documento: ${paymentData.order_id}`);
        }
      } catch (err) {
        console.warn("Fallo registro en Yeminus, guardando de forma local:", err);
      }
    }

    const newPayment: Payment = {
      ...paymentData,
      id: paymentId,
      created_at: new Date().toISOString()
    };

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        let targetPedidoUuid: string | undefined = newPayment.order_id.length === 36 ? newPayment.order_id : undefined;

        if (!targetPedidoUuid) {
          try {
            const { data: foundOrder } = await supabase
              .from('pedidos')
              .select('id, total, abonado')
              .ilike('producto_name', `%${newPayment.order_id}%`)
              .limit(1)
              .maybeSingle();

            if (foundOrder?.id) {
              targetPedidoUuid = foundOrder.id;
            }
          } catch (findErr) {
            // continuar
          }
        }

        const { error } = await supabase
          .from('pagos')
          .insert([{
            pedido_id: targetPedidoUuid,
            monto: newPayment.amount,
            referencia_pago: newPayment.payment_reference || `PAY-${newPayment.id}`,
            estado_pago: newPayment.status === 'approved' ? 'aprobado' : 'pendiente',
            metodo_pago: newPayment.payment_method
          }]);

        if (error) {
          console.warn('Advertencia registrando pago en Supabase pagos:', error.message);
        } else if (newPayment.status === 'approved' || isYeminus) {
          try {
            const { data: orderData } = await supabase
              .from('pedidos')
              .select('id, total, abonado')
              .or(`id.eq.${targetPedidoUuid || newPayment.order_id},producto_name.ilike.%${newPayment.order_id}%`)
              .limit(1)
              .maybeSingle();

            if (orderData) {
              const updatedPaid = (orderData.abonado || 0) + newPayment.amount;
              const remaining = Math.max(0, orderData.total - updatedPaid);
              const updatedStatus = remaining <= 0 ? 'pagado' : 'abonando';
              await supabase
                .from('pedidos')
                .update({ abonado: updatedPaid, restante: remaining, estado: updatedStatus })
                .eq('id', orderData.id);
            }
          } catch (updateErr) {
            console.warn('No se pudo actualizar el saldo acumulado en Supabase pedidos:', updateErr);
          }
        }
      } catch (err) {
        console.warn('Supabase no disponible para pagos, usando guardado local.');
      }
    }

    // Fallback LocalStorage: Guardar siempre el pago y actualizar el pedido correspondiente
    const localPayments = JSON.parse(localStorage.getItem(LOCAL_PAYMENTS_KEY) || '[]');
    const pIdx = localPayments.findIndex((p: Payment) => p.id === newPayment.id);
    if (pIdx !== -1) {
      localPayments[pIdx] = newPayment;
    } else {
      localPayments.push(newPayment);
    }
    localStorage.setItem(LOCAL_PAYMENTS_KEY, JSON.stringify(localPayments));

    // Si el pago es aprobado, actualizar la deuda del pedido local
    if (newPayment.status === 'approved' || isYeminus) {
      const localOrders = JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) || '[]');
      const orderIdx = localOrders.findIndex((o: Order) => o.id === newPayment.order_id);
      
      if (orderIdx !== -1) {
        const order = localOrders[orderIdx];
        const newPaidAmount = Number(order.paid_amount || 0) + Number(newPayment.amount);
        order.paid_amount = newPaidAmount;
        order.balance_pending = Math.max(0, order.total_amount - newPaidAmount);
        
        if (newPaidAmount >= order.total_amount) {
          order.status = 'pagado';
        } else if (newPaidAmount > 0) {
          order.status = 'abonando';
        }
        
        localOrders[orderIdx] = order;
        localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(localOrders));
      }
    }

    return newPayment;
  },

  /**
   * Consulta los pedidos en base al Documento de identidad del cliente.
   * Si detecta separados de Yeminus (referencia SLP), realiza una consulta en tiempo real
   * a Yeminus para traer el saldo y abonos reales actualizados en el ERP.
   */
  async searchOrdersByDocument(document: string): Promise<Order[]> {
    const cleanDoc = document.trim();
    if (!cleanDoc) return [];

    const orderMap = new Map<string, Order>();

    // 1. Consultar endpoint centralizado del backend (SQLite + Supabase con ítems completos)
    try {
      const res = await fetch(getApiUrl(`/api/orders/by-document/${encodeURIComponent(cleanDoc)}`));
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.orders)) {
          for (const o of data.orders) {
            orderMap.set(o.id, {
              id: o.id,
              customer_name: o.customer_name || o.cliente_nombre || "Cliente",
              customer_email: o.customer_email || o.cliente_email || "",
              customer_phone: o.customer_phone || o.cliente_telefono || "",
              customer_document: o.customer_document || cleanDoc,
              shipping_address: o.shipping_address || o.direccion_envio || "",
              shipping_city: o.shipping_city || o.ciudad_envio || "",
              product_id: o.product_id || (o.items?.[0]?.product_id) || "",
              product_name: o.product_name || (o.items && o.items.length > 0 ? o.items.map((it: any) => `${it.quantity}x ${it.product_name}`).join(", ") : "Pedido Navideño"),
              total_amount: Number(o.total_amount || o.total) || 0,
              deposit_amount: Number(o.deposit_amount || o.initial_payment) || Math.round((Number(o.total) || 0) * 0.3),
              paid_amount: Number(o.paid_amount || o.abonado) || 0,
              balance_pending: Number(o.balance_pending ?? o.balance ?? o.restante) || Math.max(0, (Number(o.total) || 0) - (Number(o.paid_amount || o.abonado) || 0)),
              status: (o.status || (Number(o.balance ?? o.restante) <= 0 ? 'pagado' : 'abonando')) as any,
              wompi_reference: o.wompi_reference || o.referencia_wompi,
              wompi_transaction_id: o.wompi_transaction_id || o.transaccion_id,
              yeminus_document_id: o.yeminus_document_id || o.documento_yeminus,
              yeminus_sync_status: o.yeminus_sync_status || (o.yeminus_document_id ? 'SYNCED' : 'PENDING'),
              notes: o.notes || o.observaciones,
              items: o.items || [],
              created_at: o.created_at
            });
          }
        }
      }
    } catch (apiErr) {
      console.warn("Aviso al consultar /api/orders/by-document:", apiErr);
    }

    // 2. Complementar con órdenes guardadas localmente en el navegador
    const localOrders: Order[] = JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) || '[]');
    const matchingLocal = localOrders.filter(o => {
      const docClean = String(o.customer_document || "").replace(/\D/g, "");
      const searchClean = cleanDoc.replace(/\D/g, "");
      return docClean === searchClean || o.customer_document === cleanDoc || String(o.id).includes(cleanDoc);
    });

    for (const lo of matchingLocal) {
      if (!orderMap.has(lo.id)) {
        orderMap.set(lo.id, lo);
      }
    }

    return Array.from(orderMap.values());
  },

  /**
   * Reenvía el comprobante oficial por correo electrónico a un pedido
   */
  async resendOrderEmail(orderId: string, email?: string, orderData?: any): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(getApiUrl(`/api/orders/${orderId}/resend-email`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, orderData })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Obtiene todos los pagos asociados a un separado específico.
   */
  async getPaymentsByOrderId(orderId: string): Promise<Payment[]> {
    // 1. Consultar endpoint backend /api/orders/:id/payments (combina SQLite + Supabase + Wompi)
    try {
      const resp = await fetch(getApiUrl(`/api/orders/${encodeURIComponent(orderId)}/payments`));
      if (resp.ok) {
        const json = await resp.json();
        if (json.success && Array.isArray(json.payments) && json.payments.length > 0) {
          return json.payments.map((p: any) => ({
            id: p.id,
            order_id: p.order_id || orderId,
            amount: Number(p.amount) || 0,
            payment_method: p.payment_method || 'wompi',
            payment_reference: p.payment_reference || '',
            status: p.status === 'approved' ? 'approved' : 'pending',
            created_at: p.created_at
          })) as Payment[];
        }
      }
    } catch (e) {
      console.warn("Aviso al consultar /api/orders/:id/payments:", e);
    }

    if (orderId.startsWith("SLP")) {
      try {
        const localOrders = JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) || '[]');
        const order = localOrders.find((o: Order) => o.id === orderId);
        
        if (order) {
          const response = await fetch(getApiUrl("/api/yeminus/separados/extracto"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customer_document: order.customer_document,
              slp_document_id: orderId
            })
          });

          const data = await response.json();
          if (data.success && Array.isArray(data.payments)) {
            return data.payments.map((p: any, idx: number) => ({
              id: p.reference || `pay-yeminus-${idx}`,
              order_id: orderId,
              amount: p.amount,
              payment_method: 'pse',
              payment_reference: p.reference || `YEM-${idx}`,
              status: 'approved',
              created_at: p.date
            })) as Payment[];
          }
        }
      } catch (err) {
        console.warn(`No se pudieron jalar abonos reales de Yeminus para ${orderId}:`, err);
      }
    }

    const localPayments: Payment[] = JSON.parse(localStorage.getItem(LOCAL_PAYMENTS_KEY) || '[]');
    const matchingLocal = localPayments.filter(p => p.order_id === orderId);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('pagos')
          .select('*')
          .eq('pedido_id', orderId);

        if (!error && data) {
          const supabasePayments = data.map((p: any) => ({
            id: p.id,
            order_id: p.pedido_id,
            amount: Number(p.monto),
            payment_method: p.metodo_pago || 'wompi',
            payment_reference: p.referencia_pago,
            status: p.estado_pago === 'aprobado' ? 'approved' : 'pending',
            created_at: p.created_at
          })) as Payment[];
          const combinedMap = new Map<string, Payment>();
          matchingLocal.forEach(p => combinedMap.set(p.id, p));
          supabasePayments.forEach(p => combinedMap.set(p.id, p));
          return Array.from(combinedMap.values());
        }
      } catch (err) {
        console.warn('Consulta Supabase de pagos no disponible:', err);
      }
    }

    return matchingLocal;
  },

  /**
   * Obtiene la totalidad de los pedidos para el Panel de Administración (Impormax Admin)
   */
  async getAllOrders(): Promise<Order[]> {
    const localOrders: Order[] = JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) || '[]');
    let serverOrders: Order[] = [];

    // 1. Prioridad: Consultar API Backend /api/orders (garantiza persistencia y conexión directa segura a Supabase)
    try {
      const res = await fetch(getApiUrl('/api/orders'));
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.orders)) {
          serverOrders = json.orders;
        }
      }
    } catch (apiErr) {
      console.warn('Backend /api/orders no respondió, intentando fallback cliente:', apiErr);
    }

    // 2. Si el servidor respondió con pedidos, combinamos con locales y retornamos
    if (serverOrders.length > 0) {
      const combinedMap = new Map<string, Order>();
      localOrders.forEach(o => combinedMap.set(o.id, o));
      serverOrders.forEach(o => combinedMap.set(o.id, o));
      return Array.from(combinedMap.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    let supabaseOrders: Order[] = [];
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('pedidos')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          supabaseOrders = data.map((o: any) => {
            const docMatch = o.producto_name?.match(/Doc:\s*([^\|\]]+)/);
            const dirMatch = o.producto_name?.match(/Dir:\s*([^\|\]]+)/);
            const cityMatch = o.producto_name?.match(/Ciudad:\s*([^\|\]]+)/);

            const cleanDoc = docMatch ? docMatch[1].trim() : (o.cliente_documento || "");
            const cleanDir = dirMatch ? dirMatch[1].trim() : (o.cliente_direccion || "Entrega a domicilio registrada");
            const cleanCity = cityMatch ? cityMatch[1].trim() : (o.cliente_ciudad || "Pereira");

            const cleanName = (o.producto_name || "Pedido Navideño Impormax")
              .replace(/\[[^\]]*\]/g, "")
              .trim();

            return {
              id: o.id,
              customer_name: o.cliente_nombre || "Cliente Impormax",
              customer_email: o.cliente_email || "",
              customer_phone: o.cliente_telefono || "",
              customer_document: cleanDoc,
              shipping_address: cleanDir,
              shipping_city: cleanCity,
              product_id: o.producto_id,
              product_name: cleanName,
              total_amount: Number(o.total) || 0,
              deposit_amount: Math.round((Number(o.total) || 0) * 0.3),
              paid_amount: Number(o.abonado) || 0,
              balance_pending: Number(o.restante) ?? (Number(o.total) - Number(o.abonado)),
              status: o.estado === 'pagado' ? 'pagado' : (o.abonado > 0 ? 'abonando' : 'pending'),
              created_at: o.created_at
            };
          }) as Order[];
        }
      } catch (err) {
        console.warn('Supabase no disponible o tabla pedidos no encontrada:', err);
      }
    }

    const combinedMap = new Map<string, Order>();
    localOrders.forEach(o => combinedMap.set(o.id, o));
    supabaseOrders.forEach(o => combinedMap.set(o.id, o));

    return Array.from(combinedMap.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  /**
   * Obtiene la totalidad de los pagos registrados para el Panel de Administración
   */
  async getAllPayments(): Promise<Payment[]> {
    const localPayments: Payment[] = JSON.parse(localStorage.getItem(LOCAL_PAYMENTS_KEY) || '[]');
    let serverPayments: Payment[] = [];

    // 1. Prioridad: Consultar API Backend /api/payments
    try {
      const res = await fetch(getApiUrl('/api/payments'));
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.payments)) {
          serverPayments = json.payments;
        }
      }
    } catch (apiErr) {
      console.warn('Backend /api/payments no respondió, intentando fallback cliente:', apiErr);
    }

    if (serverPayments.length > 0) {
      const combinedMap = new Map<string, Payment>();
      localPayments.forEach(p => combinedMap.set(p.id, p));
      serverPayments.forEach(p => combinedMap.set(p.id, p));
      return Array.from(combinedMap.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    let supabasePayments: Payment[] = [];
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('pagos')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          supabasePayments = data.map((p: any) => ({
            id: p.id,
            order_id: p.pedido_id,
            amount: Number(p.monto) || 0,
            payment_method: p.metodo_pago || 'wompi',
            payment_reference: p.referencia_pago,
            status: p.estado_pago === 'aprobado' ? 'approved' : 'pending',
            created_at: p.created_at
          })) as Payment[];
        }
      } catch (err) {
        console.warn('Supabase no disponible o tabla pagos no encontrada:', err);
      }
    }

    const combinedMap = new Map<string, Payment>();
    localPayments.forEach(p => combinedMap.set(p.id, p));
    supabasePayments.forEach(p => combinedMap.set(p.id, p));

    return Array.from(combinedMap.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  /**
   * Obtiene los datos completos de un recibo / comprobante de pago
   */
  async getReceipt(idOrRef: string): Promise<any> {
    try {
      const res = await fetch(getApiUrl(`/api/receipt/${encodeURIComponent(idOrRef)}`));
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.receipt) {
          return json.receipt;
        }
      }
    } catch (e) {
      console.warn('Error al obtener recibo de API:', e);
    }
    return null;
  },

  /**
   * Reconcilia transacciones aprobadas en Wompi con Supabase y Yeminus ERP
   */
  async reconcileWompi(days: number = 60, force: boolean = false): Promise<any> {
    const res = await fetch(getApiUrl('/api/wompi/reconcile-transactions'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days, force })
    });
    return await res.json();
  },

  /**
   * Actualiza el nombre y detalle de productos de un pedido en la base de datos
   */
  async updateOrderProduct(orderId: string, productName: string, productId?: string): Promise<any> {
    const res = await fetch(getApiUrl('/api/orders/update-product'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, productName, productId })
    });
    return await res.json();
  },

  /**
   * Aprueba un pago o abono pendiente de verificación por parte del administrador de Impormax.
   * Dispara automáticamente la creación/abono en Yeminus ERP Sucursal 2, Caja 9, Punto de Venta 8.
   */
  async approvePayment(
    paymentId: string,
    orderIdOrData?: string | Order,
    orderData?: Order,
    amount?: number
  ): Promise<{ success: boolean; yeminus_document_id?: string; message?: string }> {
    let resolvedOrderId = typeof orderIdOrData === 'string' ? orderIdOrData : (orderIdOrData?.id || '');
    const resolvedOrderData = typeof orderIdOrData === 'object' ? orderIdOrData : orderData;
    let resolvedAmount = amount || (resolvedOrderData ? Number(resolvedOrderData.deposit_amount || 0) : 0);
    let yeminusDocId = '';

    let returnMessage = '';
    // 1. Llamar al backend para procesar en Supabase y sincronizar con Yeminus (Sucursal 2, Caja 9, Punto 8)
    try {
      const res = await fetch(getApiUrl('/api/orders/approve-payment'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, orderId: resolvedOrderId, orderData: resolvedOrderData, amount: resolvedAmount })
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || data.message || 'Error al aprobar pago en servidor');
      }
      if (data.order_id) resolvedOrderId = data.order_id;
      if (data.yeminus_document_id) yeminusDocId = data.yeminus_document_id;
      returnMessage = data.message || (yeminusDocId ? `✓ Pago aprobado y radicado en Yeminus ERP: ${yeminusDocId}` : '✓ Pago aprobado con éxito');
    } catch (apiErr: any) {
      console.warn('Advertencia llamando a /api/orders/approve-payment:', apiErr);
      if (apiErr.message && !apiErr.message.includes('fetch failed')) {
        throw apiErr;
      }
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: payData } = await supabase
          .from('pagos')
          .select('*')
          .eq('id', paymentId)
          .single();

        if (payData) {
          resolvedOrderId = payData.pedido_id || resolvedOrderId;
          resolvedAmount = Number(payData.monto) || resolvedAmount;

          await supabase
            .from('pagos')
            .update({ estado_pago: 'aprobado' })
            .eq('id', paymentId);

          if (resolvedOrderId) {
            const { data: ord } = await supabase
              .from('pedidos')
              .select('id, total, abonado, producto_name')
              .eq('id', resolvedOrderId)
              .single();

            if (ord) {
              const updatedPaid = (ord.abonado || 0) + resolvedAmount;
              const remaining = Math.max(0, ord.total - updatedPaid);
              const updatedStatus = remaining <= 0 ? 'pagado' : 'abonando';
              let updatedProductName = ord.producto_name;
              if (yeminusDocId) {
                const cleanName = (ord.producto_name || '').replace(/\[Ref:\s*[^\]]+\]/g, '').trim();
                updatedProductName = `${cleanName} [Ref: ${yeminusDocId}]`;
              }
              await supabase
                .from('pedidos')
                .update({ abonado: updatedPaid, restante: remaining, estado: updatedStatus, producto_name: updatedProductName })
                .eq('id', resolvedOrderId);
            }
          }
        }
      } catch (err) {
        console.warn('Fallo actualización Supabase al aprobar pago:', err);
      }
    }

    // Actualizar también en LocalStorage / fallback
    const localPayments: Payment[] = JSON.parse(localStorage.getItem(LOCAL_PAYMENTS_KEY) || '[]');
    const payIdx = localPayments.findIndex(p => p.id === paymentId);
    if (payIdx !== -1) {
      localPayments[payIdx].status = 'approved';
      resolvedOrderId = localPayments[payIdx].order_id || resolvedOrderId;
      resolvedAmount = localPayments[payIdx].amount || resolvedAmount;
      localStorage.setItem(LOCAL_PAYMENTS_KEY, JSON.stringify(localPayments));
    }

    if (resolvedOrderId && resolvedAmount > 0) {
      const localOrders: Order[] = JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) || '[]');
      const ordIdx = localOrders.findIndex(o => o.id === resolvedOrderId);
      if (ordIdx !== -1) {
        const order = localOrders[ordIdx];
        const newPaid = Number(order.paid_amount || 0) + Number(resolvedAmount);
        order.paid_amount = newPaid;
        order.balance_pending = Math.max(0, order.total_amount - newPaid);
        order.status = newPaid >= order.total_amount ? 'pagado' : 'abonando';
        if (yeminusDocId) {
          const cleanName = (order.product_name || '').replace(/\[Ref:\s*[^\]]+\]/g, '').trim();
          order.product_name = `${cleanName} [Ref: ${yeminusDocId}]`;
        }
        localOrders[ordIdx] = order;
        localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(localOrders));
      }
    }

    return {
      success: true,
      yeminus_document_id: yeminusDocId,
      message: returnMessage || (yeminusDocId ? `✓ Pago aprobado y radicado en Yeminus ERP: ${yeminusDocId}` : '✓ Pago aprobado con éxito')
    };
  },

  /**
   * Aprueba directamente un pedido y lo radica en Yeminus ERP
   */
  async approveOrder(orderId: string, orderData?: Order): Promise<{ success: boolean; yeminus_document_id?: string; message?: string }> {
    let yeminusDocId = '';
    let returnMessage = '';
    try {
      const res = await fetch(getApiUrl('/api/orders/approve-order'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminHeaders()
        },
        body: JSON.stringify({ orderId, orderData })
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || data.message || 'Error al aprobar pedido en servidor');
      }
      if (data.yeminus_document_id) yeminusDocId = data.yeminus_document_id;
      returnMessage = data.message || (yeminusDocId ? `✓ Pedido aprobado y radicado en Yeminus ERP: ${yeminusDocId}` : '✓ Pedido aprobado con éxito');
    } catch (apiErr: any) {
      console.warn('Advertencia llamando a /api/orders/approve-order:', apiErr);
      if (apiErr.message && !apiErr.message.includes('fetch failed')) {
        throw apiErr;
      }
    }

    // Actualizar localmente
    const localOrders: Order[] = JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) || '[]');
    const ordIdx = localOrders.findIndex(o => o.id === orderId);
    if (ordIdx !== -1) {
      const order = localOrders[ordIdx];
      const newPaid = order.paid_amount > 0 ? order.paid_amount : order.deposit_amount;
      order.paid_amount = newPaid;
      order.balance_pending = Math.max(0, order.total_amount - newPaid);
      order.status = newPaid >= order.total_amount ? 'pagado' : 'abonando';
      if (yeminusDocId) {
        order.yeminus_document_id = yeminusDocId;
        order.yeminus_sync_status = 'SYNCED';
      }
      localOrders[ordIdx] = order;
      localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(localOrders));
    }

    return {
      success: true,
      yeminus_document_id: yeminusDocId,
      message: returnMessage || (yeminusDocId ? `✓ Pedido radicado en Yeminus ERP: ${yeminusDocId}` : '✓ Pedido aprobado exitosamente')
    };
  },

  /**
   * Sincroniza un pedido existente hacia Yeminus Sucursal 2, Caja 9, Punto de Venta 8.
   */
  async syncOrderToYeminus(orderId: string, orderData?: Order, force = false): Promise<{ success: boolean; document_id?: string; message: string }> {
    try {
      const res = await fetch(getApiUrl(`/api/yeminus/sync-order/${orderId}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminHeaders()
        },
        body: JSON.stringify({ force, orderData })
      });
      const data = await res.json();
      if (data.success && data.document_id) {
        // Actualizar en localStorage si existe
        const localOrders: Order[] = JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) || '[]');
        const ordIdx = localOrders.findIndex(o => o.id === orderId);
        if (ordIdx !== -1) {
          localOrders[ordIdx].yeminus_document_id = data.document_id;
          localOrders[ordIdx].yeminus_sync_status = 'SYNCED';
          localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(localOrders));
        }
      }
      if (!data.success) {
        return {
          success: false,
          message: data.message || data.error || 'Error al sincronizar con el ERP Yeminus'
        };
      }
      return data;
    } catch (err: any) {
      return { success: false, message: err.message || 'Error de red al conectar con el servidor' };
    }
  },

  /**
   * Sincroniza masivamente todos los pedidos hacia Yeminus Sucursal 2, Caja 9, Punto de Venta 8.
   */
  async syncAllOrdersToYeminus(force = false, orders?: Order[]): Promise<{ success: boolean; total_orders: number; synced_count: number; results: any[] }> {
    try {
      const res = await fetch(getApiUrl('/api/yeminus/sync-all-pending'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminHeaders()
        },
        body: JSON.stringify({ force, orders })
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, total_orders: 0, synced_count: 0, results: [] };
    }
  },

  /**
   * Actualiza los artículos exactos de un pedido en la base de datos y opcionalmente sincroniza con Yeminus
   */
  async updateOrderItems(orderId: string, items: any[], yeminusSync: boolean = false): Promise<any> {
    try {
      const res = await fetch(getApiUrl(`/api/orders/${orderId}/update-items`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminHeaders()
        },
        body: JSON.stringify({ items, yeminus_sync: yeminusSync })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Actualiza la totalidad de los datos de un pedido (Cliente, Cédula, Teléfono, Correo, Dirección, Ciudad y Artículos)
   */
  async updateOrderFull(orderId: string, updateData: {
    customer_name?: string;
    customer_document?: string;
    customer_phone?: string;
    customer_email?: string;
    shipping_address?: string;
    shipping_city?: string;
    notes?: string;
    observaciones?: string;
    items?: any[];
    yeminus_sync?: boolean;
  }): Promise<any> {
    try {
      const res = await fetch(getApiUrl(`/api/orders/${orderId}/update-order`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminHeaders()
        },
        body: JSON.stringify(updateData)
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Rechaza un comprobante de transferencia o abono inválido
   */
  async rejectPayment(paymentId: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase
          .from('pagos')
          .update({ status: 'rejected' })
          .eq('id', paymentId);
      } catch (err) {
        console.warn('Fallo actualización Supabase al rechazar pago:', err);
      }
    }

    const localPayments: Payment[] = JSON.parse(localStorage.getItem(LOCAL_PAYMENTS_KEY) || '[]');
    const payIdx = localPayments.findIndex(p => p.id === paymentId);
    if (payIdx !== -1) {
      localPayments[payIdx].status = 'rejected';
      localStorage.setItem(LOCAL_PAYMENTS_KEY, JSON.stringify(localPayments));
    }

    return true;
  },

  /**
   * Sincroniza el catálogo completo de 590+ productos desde el ERP y los guarda en Supabase y disco
   */
  async syncCatalog(): Promise<{ success: boolean; count?: number; supabase?: any; error?: string }> {
    try {
      const response = await fetch(getApiUrl("/api/products/sync"), {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await response.json();
      return data;
    } catch (err: any) {
      console.warn("Fallo endpoint /api/products/sync, intentando sincronización directa cliente:", err);
      // Fallback directo a través de Supabase en cliente
      try {
        const products = await this.getProducts();
        if (products && products.length > 0) {
          const directResult = await this.saveCatalogToSupabaseDirect(products);
          return { success: true, count: directResult.count, supabase: { synced: true, count: directResult.count } };
        }
      } catch (clientErr: any) {
        return { success: false, error: clientErr.message || err.message };
      }
      return { success: false, error: err.message };
    }
  },

  /**
   * Consulta el estado actual de los respaldos (memoria, archivo JSON local y Supabase)
   */
  async getBackupStatus(): Promise<any> {
    try {
      const response = await fetch(getApiUrl("/api/products/backup-status"));
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn("No se pudo consultar estado de respaldo del servidor:", e);
    }
    return null;
  },

  /**
   * Guarda directamente los productos en Supabase desde el cliente (para respaldo inmediato)
   */
  async saveCatalogToSupabaseDirect(products: Product[]): Promise<{ count: number; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { count: 0, error: "Supabase no configurado en cliente" };
    }

    try {
      // Limpiar items de demo de prueba previos
      await supabase
        .from("products")
        .delete()
        .in("id", ["arb-01", "arb-02", "arb-03", "arb-04", "dec-01", "dec-02", "dec-03", "1", "2", "3"]);

      const rows = products
        .filter((p) => !String(p.id).startsWith("arb-") && !String(p.id).startsWith("dec-") && String(p.id).length > 2)
        .map((p) => ({
          id: String(p.id).trim(),
          name: p.name,
          category: p.category || "Decoraciones",
          price: p.price || 0,
          deposit_amount: p.separePercentage === 30 ? Math.round(p.price * 0.3) : p.price,
          stock: p.stock || 0,
          image_url: p.imageUrl,
          dimensions: p.dimensions || "",
          description: p.description || p.name,
          is_active: true,
          raw_yeminus_data: {
            discountPrice: p.discountPrice,
            discountPercentage: p.discountPercentage,
            features: p.features,
            color: p.color,
            height: p.height,
            subCategory: p.subCategory,
            similarCodes: p.similarCodes
          },
          updated_at: new Date().toISOString()
        }));

      if (rows.length === 0) {
        return { count: 0, error: "No hay productos reales del ERP para guardar (evitando productos demo)" };
      }

      const batchSize = 50;
      let total = 0;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await supabase
          .from("products")
          .upsert(batch, { onConflict: "id" });
        if (error) {
          console.error(`Error upsert lote ${i}:`, error.message);
        } else {
          total += batch.length;
        }
      }
      return { count: total };
    } catch (e: any) {
      return { count: 0, error: e.message };
    }
  },

  /**
   * Elimina todos los pedidos y comprobantes de prueba, dejando la base de datos limpia desde cero.
   */
  async clearAllOrders(): Promise<{ success: boolean; message?: string }> {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify([]));
        localStorage.setItem(LOCAL_PAYMENTS_KEY, JSON.stringify([]));
      }

      await fetch(getApiUrl('/api/orders/clear-all'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminHeaders()
        }
      });

      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.from('pagos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('pedidos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      }

      return { success: true, message: 'Todos los pedidos y pagos de prueba han sido eliminados con éxito.' };
    } catch (err: any) {
      console.error('Error al vaciar pedidos:', err);
      return { success: false, message: err.message };
    }
  },

  /**
   * Elimina un pedido individual de la base de datos y de Supabase
   */
  async deleteOrder(orderId: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(getApiUrl(`/api/orders/${orderId}`), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...getAdminHeaders()
        }
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  },

  /**
   * Limpia masivamente pedidos con errores o de prueba
   */
  async cleanErrorOrders(): Promise<{ success: boolean; deletedCount: number; message: string }> {
    try {
      const res = await fetch(getApiUrl("/api/orders/clean-errors"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAdminHeaders()
        }
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, deletedCount: 0, message: err.message };
    }
  },

  /**
   * Reconcilia automáticamente las transacciones aprobadas en Wompi con Supabase y el ERP Yeminus
   */
  async reconcileWompiTransactions(): Promise<{
    success: boolean;
    totalApproved?: number;
    reconciledCount?: number;
    skippedCount?: number;
    error?: string;
  }> {
    try {
      const res = await fetch(getApiUrl("/api/wompi/reconcile-transactions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
};
