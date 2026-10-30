import React, { useState, useEffect, FormEvent } from 'react';
import { motion } from 'motion/react';
import { Order, OrderItem, Payment, Product } from '../types';
import { apiService } from '../services/api';
import { getSupabaseClient } from '../supabase/client';
import { 
  ShieldCheck, 
  Search, 
  RefreshCw, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  DollarSign, 
  Package, 
  User, 
  Phone, 
  MapPin, 
  Mail, 
  FileText, 
  ArrowLeft, 
  Landmark, 
  Key, 
  CreditCard,
  Building2,
  Calendar,
  AlertTriangle,
  ExternalLink,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  Loader2,
  Database,
  Download,
  Server,
  Trash2,
  FileSpreadsheet,
  Printer,
  Copy,
  Check,
  X,
  FileDown,
  AlertCircle,
  Send,
  Edit3,
  Plus,
  Layers,
  ChevronLeft,
  ChevronRight,
  MessageSquare
} from 'lucide-react';
import OrderReceiptModal, { OrderReceiptData } from './OrderReceiptModal';

interface AdminPortalProps {
  onBackToStore?: () => void;
}

export default function AdminPortal({ onBackToStore }: AdminPortalProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('impormax_admin_auth') === 'true';
    }
    return false;
  });
  const [adminPassword, setAdminPassword] = useState('');
  const [adminEmail, setAdminEmail] = useState('admin@impormax.com');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'pending_verification' | 'all' | 'approved' | 'pagado'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [ordersPerPage, setOrdersPerPage] = useState<number>(10);
  const [processingPayId, setProcessingPayId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Estados para respaldo y sincronización de catálogo
  const [isSyncingCatalog, setIsSyncingCatalog] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [backupStatus, setBackupStatus] = useState<{
    inMemoryCount: number;
    localFileCount: number;
    supabaseConnected: boolean;
    supabaseCount: number;
    lastMemorySync: string | null;
  } | null>(null);

  // Estados para Modal de Reporte de Pedidos
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSearch, setReportSearch] = useState('');
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Estados para Modal de Comprobante / Recibo Oficial
  const [selectedReceipt, setSelectedReceipt] = useState<OrderReceiptData | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);

  // Estados para Modal de Edición Completa del Pedido (Cliente, Envío y Artículos)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editingCustomerName, setEditingCustomerName] = useState<string>('');
  const [editingCustomerDoc, setEditingCustomerDoc] = useState<string>('');
  const [editingCustomerPhone, setEditingCustomerPhone] = useState<string>('');
  const [editingCustomerEmail, setEditingCustomerEmail] = useState<string>('');
  const [editingShippingAddress, setEditingShippingAddress] = useState<string>('');
  const [editingShippingCity, setEditingShippingCity] = useState<string>('');
  const [editingNotes, setEditingNotes] = useState<string>('');
  const [editingItems, setEditingItems] = useState<OrderItem[]>([]);
  const [syncToYeminusOnSave, setSyncToYeminusOnSave] = useState(false);
  const [isUpdatingProduct, setIsUpdatingProduct] = useState(false);

  const getDisplayOrderItems = (order: Order): (OrderItem & { list_price?: number })[] => {
    const findProductInCatalog = (sku?: string, name?: string) => {
      if (!catalogProducts || catalogProducts.length === 0) return null;
      if (sku) {
        const s = String(sku).trim().toLowerCase();
        const found = catalogProducts.find(p => 
          String(p.id).toLowerCase() === s || 
          String(p.code).toLowerCase() === s || 
          (p.reference && String(p.reference).toLowerCase() === s)
        );
        if (found) return found;
      }
      if (name) {
        const cleanN = name.replace(/^\d+x\s+/, '').replace(/\s*\(Plan Separe.*?\)/, '').trim().toLowerCase();
        const found = catalogProducts.find(p => p.name.toLowerCase() === cleanN);
        if (found) return found;
        const sub = catalogProducts.find(p => cleanN.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(cleanN));
        if (sub) return sub;
      }
      return null;
    };

    if (order.items && order.items.length > 0) {
      return order.items.map(it => {
        const cat = findProductInCatalog(it.product_id, it.product_name);
        const qty = Math.max(1, Number(it.quantity) || 1);
        const activeFeedPrice = cat ? (cat.discountPrice || cat.price) : 0;
        const uPrice = Number(it.unit_price) || activeFeedPrice || Math.round(Number(it.total || order.total_amount) / qty);
        const tot = Number(it.total) || (uPrice * qty);
        const cleanPId = (cat ? cat.id : (it.product_id && it.product_id !== 'ONLINE' ? it.product_id : (it.product_reference && it.product_reference !== 'ONLINE' ? it.product_reference : ''))) || '';
        const cleanRef = ((cat && cat.reference) ? cat.reference : (it.product_reference && it.product_reference !== 'ONLINE' ? it.product_reference : cleanPId)) || '';
        return {
          ...it,
          product_id: cleanPId,
          product_reference: cleanRef,
          product_name: cat ? cat.name : it.product_name,
          quantity: qty,
          unit_price: uPrice,
          total: tot,
          list_price: cat ? cat.price : undefined,
          discount_percentage: cat ? cat.discountPercentage : it.discount_percentage,
        };
      });
    }

    const clean = (order.product_name || '').replace(/\[[^\]]*\]/g, '').trim();
    const rawParts = clean.split(/,\s*(?=\d+x\s+)/).map(s => s.trim()).filter(Boolean);
    const rawSkus = (order.product_id || '').split(',').map(s => s.trim()).filter(Boolean);

    if (rawParts.length > 1) {
      return rawParts.map((itemStr, idx) => {
        const m = itemStr.match(/^(\d+)x\s+(.+)$/);
        const qty = m ? parseInt(m[1]) : 1;
        const name = m ? m[2].trim() : itemStr;
        const sku = (rawSkus[idx] && rawSkus[idx] !== 'ONLINE') ? rawSkus[idx] : (rawSkus[0] && rawSkus[0] !== 'ONLINE' ? rawSkus[0] : '');
        const cat = findProductInCatalog(sku, name);
        const activeFeedPrice = cat ? (cat.discountPrice || cat.price) : 0;
        const uPrice = activeFeedPrice || Math.round((Number(order.total_amount) || 0) / (rawParts.length * qty));
        const itemTot = uPrice * qty;
        return {
          product_id: cat ? cat.id : sku,
          product_reference: (cat && cat.reference) ? cat.reference : (sku || ''),
          product_name: cat ? cat.name : name,
          quantity: qty,
          unit_price: uPrice,
          total: itemTot,
          list_price: cat ? cat.price : undefined,
          discount_percentage: cat ? cat.discountPercentage : undefined,
        };
      });
    }

    const singleSku = (rawSkus[0] && rawSkus[0] !== 'ONLINE') ? rawSkus[0] : (order.product_id && order.product_id !== 'ONLINE' ? order.product_id : '');
    const cat = findProductInCatalog(singleSku, clean);
    const singlePrice = cat ? (cat.discountPrice || cat.price) : (Number(order.total_amount) || 0);

    return [{
      product_id: cat ? cat.id : singleSku,
      product_reference: (cat && cat.reference) ? cat.reference : singleSku,
      product_name: cat ? cat.name : (clean || 'Producto Navideño'),
      quantity: 1,
      unit_price: singlePrice,
      total: singlePrice,
      list_price: cat ? cat.price : undefined,
      discount_percentage: cat ? cat.discountPercentage : undefined,
    }];
  };

  const handleOpenEditProduct = (order: Order) => {
    setEditingOrder(order);
    setEditingCustomerName(order.customer_name || '');
    setEditingCustomerDoc(order.customer_document || '');
    setEditingCustomerPhone(order.customer_phone || '');
    setEditingCustomerEmail(order.customer_email || '');
    const currentAddress = order.shipping_address || '';
    setEditingShippingAddress(currentAddress === 'Entrega a domicilio / Retiro en tienda' ? '' : currentAddress);
    setEditingShippingCity(order.shipping_city || '');
    setEditingNotes(order.notes || order.observaciones || '');
    setCatalogSearch('');

    const displayItems = getDisplayOrderItems(order);
    setEditingItems(displayItems.map(it => ({ ...it })));
    setSyncToYeminusOnSave(false);
  };

  const handleAddProductFromCatalog = (prod: Product) => {
    const price = prod.discountPrice || prod.price;
    setEditingItems(prev => [
      ...prev,
      {
        product_id: prod.id,
        product_reference: prod.reference || prod.id,
        product_name: prod.name,
        quantity: 1,
        unit_price: price,
        total: price
      }
    ]);
    setCatalogSearch('');
    showToast(`✓ "${prod.name}" añadido a los artículos.`);
  };

  const handleAddItemRow = () => {
    setEditingItems(prev => [
      ...prev,
      {
        product_id: '',
        product_reference: '',
        product_name: '',
        quantity: 1,
        unit_price: 0,
        total: 0
      }
    ]);
  };

  const handleRemoveItemRow = (idx: number) => {
    setEditingItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: keyof OrderItem, value: any) => {
    setEditingItems(prev => {
      const copy = [...prev];
      const cur = { ...copy[idx], [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        const qty = Math.max(1, Number(cur.quantity) || 1);
        const price = Math.max(0, Number(cur.unit_price) || 0);
        cur.quantity = qty;
        cur.unit_price = price;
        cur.total = qty * price;
      }
      copy[idx] = cur;
      return copy;
    });
  };

  const handleSaveProductEdit = async () => {
    if (!editingOrder) return;
    if (editingItems.length === 0) {
      showToast('Debes mantener al menos un artículo en el pedido.', 'error');
      return;
    }
    for (const it of editingItems) {
      if (!it.product_name.trim()) {
        showToast('Cada artículo debe tener un nombre de producto válido.', 'error');
        return;
      }
    }

    setIsUpdatingProduct(true);
    try {
      const res = await apiService.updateOrderFull(editingOrder.id, {
        customer_name: editingCustomerName.trim() || editingOrder.customer_name,
        customer_document: editingCustomerDoc.trim() || editingOrder.customer_document,
        customer_phone: editingCustomerPhone.trim() || editingOrder.customer_phone,
        shipping_address: editingShippingAddress.trim() || editingOrder.shipping_address || '',
        shipping_city: editingShippingCity.trim() || editingOrder.shipping_city || '',
        notes: editingNotes.trim(),
        observaciones: editingNotes.trim(),
        items: editingItems,
        yeminus_sync: syncToYeminusOnSave
      });
      if (res && res.success) {
        showToast(res.message || '✓ Pedido, datos de envío y artículos actualizados exitosamente.');
        setEditingOrder(null);
        await loadData();
      } else {
        showToast(res?.error || 'No se pudo actualizar el pedido.', 'error');
      }
    } catch (err: any) {
      showToast(`Error al actualizar pedido: ${err.message}`, 'error');
    } finally {
      setIsUpdatingProduct(false);
    }
  };

  const handleViewReceipt = async (order: Order) => {
    setLoadingReceiptId(order.id);
    try {
      const receipt = await apiService.getReceipt(order.id);
      if (receipt) {
        setSelectedReceipt(receipt);
        setIsReceiptModalOpen(true);
      } else {
        const localDocId = order.product_name?.match(/\[Ref:\s*([^\]]+)\]/)?.[1] || `SLP-${order.id.slice(0, 8)}`;
        const cleanProductName = order.product_name?.replace(/\s*\[Ref:\s*[^\]]+\]/, '') || 'Pedido Navideño Impormax';
        const fallbackReceipt: OrderReceiptData = {
          orderId: order.id,
          documentId: localDocId,
          reference: order.id,
          transactionId: order.id,
          status: 'APPROVED',
          statusMessage: 'Pedido Aprobado y Confirmado',
          date: order.created_at,
          customer: {
            name: order.customer_name,
            email: order.customer_email,
            phone: order.customer_phone,
            document: order.customer_document,
            address: 'Dirección registrada en tienda',
            city: 'Pereira'
          },
          items: [
            {
              id: order.product_id,
              name: cleanProductName,
              quantity: 1,
              price: order.total_amount,
              total: order.total_amount
            }
          ],
          financial: {
            totalOrder: order.total_amount,
            amountPaid: order.paid_amount,
            totalAbonado: order.paid_amount,
            balancePending: order.balance_pending,
            isPlanSepare: order.balance_pending > 0
          },
          paymentMethod: {
            type: 'WOMPI',
            label: 'Wompi Bancolombia'
          }
        };
        setSelectedReceipt(fallbackReceipt);
        setIsReceiptModalOpen(true);
      }
    } catch (err: any) {
      showToast(`Error al cargar recibo: ${err.message}`, 'error');
    } finally {
      setLoadingReceiptId(null);
    }
  };

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedOrders, fetchedPayments, status, prods] = await Promise.all([
        apiService.getAllOrders(),
        apiService.getAllPayments(),
        apiService.getBackupStatus().catch(() => null),
        apiService.getProducts().catch(() => [])
      ]);
      setOrders(fetchedOrders);
      setPayments(fetchedPayments);
      if (status) {
        setBackupStatus(status);
      }
      if (prods && prods.length > 0) {
        setCatalogProducts(prods);
      }
    } catch (err) {
      console.error('Error cargando datos de administración:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncCatalog = async () => {
    setIsSyncingCatalog(true);
    try {
      const result = await apiService.syncCatalog();
      if (result && result.success) {
        setNotification({
          type: 'success',
          message: `¡Éxito! ${result.count || 590} productos sincronizados y respaldados en Supabase y disco.`
        });
        const newStatus = await apiService.getBackupStatus();
        if (newStatus) setBackupStatus(newStatus);
      } else {
        setNotification({
          type: 'error',
          message: `Aviso: ${result?.error || 'No se pudo completar la sincronización'}`
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Error al sincronizar catálogo: ${err.message}`
      });
    } finally {
      setIsSyncingCatalog(false);
      setTimeout(() => setNotification(null), 6000);
    }
  };

  const handleExportBackup = () => {
    window.open('/api/products/export-backup', '_blank');
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthenticating(true);

    try {
      // 1. Intentar Autenticación con Supabase Auth si está disponible
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: adminEmail.trim(),
            password: adminPassword,
          });

          if (!error && data?.session) {
            sessionStorage.setItem('impormax_admin_token', 'impormax2026');
            sessionStorage.setItem('impormax_admin_auth', 'true');
            setIsAuthenticated(true);
            loadData();
            setIsAuthenticating(false);
            return;
          }
        } catch (supabaseAuthErr) {
          console.warn('Supabase Auth login no se completó, verificando clave maestra:', supabaseAuthErr);
        }
      }

      // 2. Validación Segura de Clave en el Backend
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword.trim() })
      });
      const data = await res.json();
      if (data.success && data.token) {
        sessionStorage.setItem('impormax_admin_token', data.token);
        sessionStorage.setItem('impormax_admin_auth', 'true');
        setIsAuthenticated(true);
        loadData();
      } else {
        setAuthError(data.error || 'Contraseña incorrecta. Por favor ingresa la clave de administración autorizada por Impormax.');
      }
    } catch (err) {
      setAuthError('Error al procesar el inicio de sesión. Intenta nuevamente.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('impormax_admin_auth');
    sessionStorage.removeItem('impormax_admin_token');
    setIsAuthenticated(false);
    setAdminPassword('');
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Handler para aprobar pago pendiente y sincronizar con Yeminus ERP
  const handleApprovePayment = async (paymentId: string, orderData?: Order) => {
    setProcessingPayId(paymentId);
    try {
      const res = await apiService.approvePayment(paymentId, orderData);
      showToast(res?.message || '✓ Pago verificado y aprobado con éxito. Saldo actualizado y registrado en Yeminus ERP.');
      await loadData();
    } catch (err: any) {
      console.error('Error al aprobar pago:', err);
      showToast(err.message || 'Error al procesar la aprobación del pago.', 'error');
    } finally {
      setProcessingPayId(null);
    }
  };

  // Handler para aprobar pedido completo y radicar en Yeminus
  const handleApproveOrder = async (order: Order) => {
    setProcessingPayId(order.id);
    try {
      const res = await apiService.approveOrder(order.id, order);
      showToast(res?.message || '✓ Pedido aprobado exitosamente y radicado en Yeminus ERP.');
      await loadData();
    } catch (err: any) {
      console.error('Error al aprobar pedido:', err);
      showToast(err.message || 'Error al aprobar el pedido.', 'error');
    } finally {
      setProcessingPayId(null);
    }
  };

  // Handler para reenviar comprobante por correo electrónico al cliente
  const handleResendEmail = async (order: Order) => {
    setSendingEmailId(order.id);
    try {
      const res = await apiService.resendOrderEmail(order.id, order.customer_email, order);
      if (res.success) {
        showToast(res.message || `✓ Correo enviado con éxito a ${order.customer_email}`);
      } else {
        showToast(res.error || 'Error al enviar correo al cliente', 'error');
      }
    } catch (err: any) {
      console.error('Error enviando correo:', err);
      showToast(err.message || 'Error al enviar correo', 'error');
    } finally {
      setSendingEmailId(null);
    }
  };

  // Handler para sincronizar un pedido individual a Yeminus ERP
  const handleSyncOrderToYeminus = async (order: Order) => {
    setProcessingPayId(order.id);
    try {
      const res = await apiService.syncOrderToYeminus(order.id, order, true);
      if (!res.success) {
        throw new Error(res.message || 'Error al sincronizar con el ERP Yeminus');
      }
      showToast(res?.message || '✓ Pedido sincronizado con éxito a Yeminus ERP (Sucursal 02, Caja 9, Punto 8).');
      await loadData();
    } catch (err: any) {
      console.error('Error al sincronizar con Yeminus:', err);
      showToast(err.message || 'Error al sincronizar con Yeminus ERP.', 'error');
    } finally {
      setProcessingPayId(null);
    }
  };

  const handleManualSyncToYeminus = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      await handleSyncOrderToYeminus(order);
    }
  };

  // Handler para sincronizar todos los pedidos con Yeminus ERP
  const handleSyncAllToYeminus = async () => {
    setIsLoading(true);
    try {
      const res = await apiService.syncAllOrdersToYeminus(true, orders);
      showToast(`✓ Sincronización Yeminus completada: ${res.synced_count || 0} pedidos procesados exitosamente.`);
      await loadData();
    } catch (err: any) {
      console.error('Error al sincronizar pedidos con Yeminus:', err);
      showToast(err.message || 'Error al sincronizar pedidos con Yeminus.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handler para reconciliar pagos de Wompi directamente y registrar faltantes en Supabase y Yeminus
  const handleReconcileWompi = async () => {
    setIsLoading(true);
    try {
      showToast('Consultando transacciones aprobadas recientes en Wompi...');
      const res = await apiService.reconcileWompiTransactions();
      if (res.success) {
        if (res.reconciledCount && res.reconciledCount > 0) {
          showToast(`✓ ¡${res.reconciledCount} pedido(s) sincronizado(s) exitosamente a Supabase y Yeminus!`);
        } else {
          showToast(`✓ Todo al día: ${res.totalApproved || 0} transacciones aprobadas en Wompi ya están registradas.`);
        }
        await loadData();
      } else {
        showToast(res.error || 'Error al conciliar transacciones con Wompi.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error en la conciliación con Wompi.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handler para rechazar comprobante
  const handleRejectPayment = async (paymentId: string) => {
    if (!confirm('¿Estás seguro de rechazar este comprobante de pago?')) return;
    setProcessingPayId(paymentId);
    try {
      await apiService.rejectPayment(paymentId);
      showToast('Comprobante de pago rechazado.', 'error');
      await loadData();
    } catch (err) {
      console.error('Error al rechazar pago:', err);
      showToast('Error al procesar el rechazo.', 'error');
    } finally {
      setProcessingPayId(null);
    }
  };

  // Handler para vaciar pedidos de prueba y empezar de cero
  const handleClearTestOrders = async () => {
    if (!confirm('¿Deseas vaciar todos los pedidos y comprobantes de prueba para iniciar en limpio desde hoy?')) return;
    setIsLoading(true);
    try {
      const res = await apiService.clearAllOrders();
      if (res.success) {
        showToast('✓ Pedidos de prueba eliminados. La base de datos está en limpio.');
        await loadData();
      } else {
        showToast(`Error: ${res.message}`, 'error');
      }
    } catch (err: any) {
      showToast(`Error al vaciar: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Calcular Estadísticas
  const pendingPayments = payments.filter((p) => p.status === 'pending');
  const approvedPayments = payments.filter((p) => p.status === 'approved');
  const totalApprovedAmount = approvedPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalPendingAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalOrdersCount = orders.length;
  const completedOrdersCount = orders.filter((o) => o.status === 'pagado').length;

  // Totales consolidados para reportes
  const grandTotalOrdersValue = orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const grandTotalPaidValue = orders.reduce((sum, o) => sum + (Number(o.paid_amount) || 0), 0);
  const grandTotalBalanceValue = orders.reduce((sum, o) => sum + (Number(o.balance_pending) || 0), 0);

  // Filtrado de pedidos dentro del modal de reporte
  const reportOrders = orders.filter((order) => {
    if (!reportSearch.trim()) return true;
    const q = reportSearch.toLowerCase().trim();
    return (
      order.id.toLowerCase().includes(q) ||
      order.customer_name.toLowerCase().includes(q) ||
      order.customer_document.toLowerCase().includes(q) ||
      order.customer_phone.toLowerCase().includes(q) ||
      order.shipping_city.toLowerCase().includes(q) ||
      order.product_name.toLowerCase().includes(q)
    );
  });
  const reportTotalOrdersValue = reportOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const reportTotalPaidValue = reportOrders.reduce((sum, o) => sum + (Number(o.paid_amount) || 0), 0);
  const reportTotalBalanceValue = reportOrders.reduce((sum, o) => sum + (Number(o.balance_pending) || 0), 0);

  // Descargar Reporte en formato CSV compatible con Excel
  const handleExportOrdersCSV = () => {
    if (orders.length === 0) {
      showToast('No hay pedidos registrados para exportar.', 'error');
      return;
    }

    const headers = [
      'N°',
      'ID Pedido',
      'Fecha',
      'Cliente',
      'Cédula / NIT',
      'Teléfono',
      'Correo',
      'Ciudad',
      'Dirección',
      'Producto / Detalle',
      'Estado',
      'Valor Total Pedido (COP)',
      'Total Abonado (COP)',
      'Saldo Pendiente (COP)'
    ];

    const rows = orders.map((o, idx) => {
      const statusText = o.status === 'pagado' ? 'PAGADO 100%' : o.status === 'abonando' ? 'EN ABONOS' : 'PENDIENTE';
      const cleanCustomer = (o.customer_name || '').replace(/[\r\n;"]+/g, ' ').trim();
      const displayItems = getDisplayOrderItems(o);
      const cleanProd = displayItems
        .map(it => {
          const refStr = it.product_reference && it.product_reference !== it.product_id ? ` (Ref: ${it.product_reference})` : '';
          return `${it.quantity}x [${it.product_id}${refStr}] ${it.product_name} ($${it.unit_price} c/u = $${it.total})`;
        })
        .join(' | ');
      const cleanAddress = (o.shipping_address || '').replace(/[\r\n;"]+/g, ' ').trim();
      const cleanCity = (o.shipping_city || '').replace(/[\r\n;"]+/g, ' ').trim();
      const dateStr = new Date(o.created_at).toLocaleDateString('es-CO');

      return [
        idx + 1,
        `"${o.id}"`,
        `"${dateStr}"`,
        `"${cleanCustomer}"`,
        `"${o.customer_document || ''}"`,
        `"${o.customer_phone || ''}"`,
        `"${o.customer_email || ''}"`,
        `"${cleanCity}"`,
        `"${cleanAddress}"`,
        `"${cleanProd}"`,
        `"${statusText}"`,
        Math.round(o.total_amount || 0),
        Math.round(o.paid_amount || 0),
        Math.round(o.balance_pending || 0)
      ].join(';');
    });

    const totalRow = [
      'TOTALES',
      `"${orders.length} pedidos"`,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      Math.round(grandTotalOrdersValue),
      Math.round(grandTotalPaidValue),
      Math.round(grandTotalBalanceValue)
    ].join(';');

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows, totalRow].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `reporte_pedidos_impormax_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('✓ Reporte Excel (CSV) generado y descargado.');
  };

  // Copiar resumen de pedidos formateado para WhatsApp / Mensajes
  const handleCopyReportSummary = () => {
    if (orders.length === 0) {
      showToast('No hay pedidos registrados para copiar.', 'error');
      return;
    }
    const textLines = [
      `📊 REPORTE DE PEDIDOS - IMPORMAX NAVIDAD`,
      `📅 Fecha: ${new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
      `------------------------------------------------`,
      `📦 TOTAL PEDIDOS: ${orders.length}`,
      `💰 VALOR TOTAL PEDIDOS: ${formatCOP(grandTotalOrdersValue)}`,
      `✅ TOTAL RECAUDADO / ABONADO: ${formatCOP(grandTotalPaidValue)}`,
      `⏳ SALDO TOTAL PENDIENTE: ${formatCOP(grandTotalBalanceValue)}`,
      `------------------------------------------------`,
      `DETALLE POR CLIENTE (${orders.length} pedidos):`,
      ...orders.map((o, i) => {
        const statusText = o.status === 'pagado' ? '✓ PAGADO 100%' : o.status === 'abonando' ? 'EN ABONOS' : 'PENDIENTE';
        const displayItems = getDisplayOrderItems(o);
        let itemsDetail = '';
        if (displayItems.length > 1) {
          const totalUnits = displayItems.reduce((acc, it) => acc + (it.quantity || 1), 0);
          itemsDetail = `   • Artículos (${displayItems.length} productos / ${totalUnits} unidades):\n` +
            displayItems.map((it, idx) => {
              const refStr = it.product_reference && it.product_reference !== it.product_id ? ` | Ref: ${it.product_reference}` : '';
              return `     ${idx + 1}) [${it.product_id || 'SKU'}${refStr}] ${it.product_name} — Cant: ${it.quantity} x ${formatCOP(it.unit_price)} = ${formatCOP(it.total || (it.unit_price * it.quantity))}`;
            }).join('\n');
        } else {
          const single = displayItems[0];
          const singleQty = single?.quantity || 1;
          const singlePrice = single?.unit_price || o.total_amount;
          const refStr = single?.product_reference && single.product_reference !== single.product_id ? ` | Ref: ${single.product_reference}` : '';
          itemsDetail = `   • Producto: [${single?.product_id || 'SKU'}${refStr}] ${single?.product_name || o.product_name} — Cant: ${singleQty} x ${formatCOP(singlePrice)} = ${formatCOP(single?.total || o.total_amount)}`;
        }
        return `${i + 1}. ${o.customer_name} | CC: ${o.customer_document || 'N/A'} | Tel: ${o.customer_phone || 'N/A'}\n   • Envío: ${o.shipping_address}, ${o.shipping_city}\n${itemsDetail}\n   • Valor Pedido: ${formatCOP(o.total_amount)} | Abonado: ${formatCOP(o.paid_amount)} | Saldo: ${formatCOP(o.balance_pending)} [${statusText}]`;
      }),
      `------------------------------------------------`,
      `TOTAL CONSOLIDADO: ${formatCOP(grandTotalOrdersValue)} en ${orders.length} pedidos.`
    ];

    navigator.clipboard.writeText(textLines.join('\n')).then(() => {
      setCopiedSummary(true);
      showToast('✓ Resumen de pedidos copiado al portapapeles.');
      setTimeout(() => setCopiedSummary(false), 3000);
    }).catch(() => {
      showToast('No se pudo copiar automáticamente.', 'error');
    });
  };

  const handlePrintReport = () => {
    window.print();
  };

  // Reiniciar a la primera página cuando cambie el filtro o la búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, searchQuery, ordersPerPage]);

  // Filtrado exhaustivo de la lista de pedidos
  const filteredOrders = orders.filter((order) => {
    const orderPayments = payments.filter((p) => p.order_id === order.id);
    const hasPendingPayment = orderPayments.some((p) => p.status === 'pending');

    // Filtro por Tab de Estado
    if (filterStatus === 'pending_verification' && !hasPendingPayment) return false;
    if (filterStatus === 'approved' && order.status === 'pending' && !hasPendingPayment) return false;
    if (filterStatus === 'pagado' && order.status !== 'pagado') return false;

    // Búsqueda por texto (Cédula, Nombre, Teléfono, Email, Dirección, Ciudad, ID, Wompi, Yeminus, Producto)
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (order.id && order.id.toLowerCase().includes(q)) ||
      (order.customer_name && order.customer_name.toLowerCase().includes(q)) ||
      (order.customer_document && order.customer_document.toLowerCase().includes(q)) ||
      (order.customer_phone && order.customer_phone.toLowerCase().includes(q)) ||
      (order.customer_email && order.customer_email.toLowerCase().includes(q)) ||
      (order.shipping_address && order.shipping_address.toLowerCase().includes(q)) ||
      (order.shipping_city && order.shipping_city.toLowerCase().includes(q)) ||
      (order.product_name && order.product_name.toLowerCase().includes(q)) ||
      (order.wompi_reference && order.wompi_reference.toLowerCase().includes(q)) ||
      (order.yeminus_document_id && order.yeminus_document_id.toLowerCase().includes(q))
    );
  });

  // Cálculos de Paginación
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ordersPerPage));
  const startIndex = (currentPage - 1) * ordersPerPage;
  const endIndex = Math.min(startIndex + ordersPerPage, filteredOrders.length);
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-stone-900 text-stone-100 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-md bg-stone-800 border border-stone-700 rounded-3xl p-8 shadow-2xl space-y-6 relative overflow-hidden"
        >
          {/* Accent decoration */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-brand-blue via-emerald-500 to-amber-500" />

          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-stone-900 border border-stone-700 flex items-center justify-center mx-auto text-brand-blue shadow-inner">
              <Lock className="w-8 h-8" />
            </div>
            <span className="inline-block px-3 py-1 rounded-full bg-brand-blue/20 text-brand-blue text-[10px] font-mono font-bold uppercase tracking-wider">
              Acceso Restringido • Impormax Admin
            </span>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Iniciar Sesión
            </h2>
            <p className="text-xs text-stone-400">
              Ingresa la contraseña de administrador autorizada para acceder al panel de control de Supabase y gestión de pagos.
            </p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            {authError && (
              <div className="p-3.5 rounded-2xl bg-red-950/80 border border-red-700 text-red-200 text-xs font-medium flex items-start gap-2.5 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-300 uppercase tracking-wider font-mono">
                Usuario / Correo Electrónico
              </label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@impormax.com"
                className="w-full px-4 py-3 bg-stone-900 border border-stone-700 focus:border-brand-blue rounded-xl text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-brand-blue/30 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-300 uppercase tracking-wider font-mono">
                Contraseña de Administrador
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-4 pr-11 py-3 bg-stone-900 border border-stone-700 focus:border-brand-blue rounded-xl text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-brand-blue/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full py-3.5 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verificando Supabase...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Ingresar al Panel de Control</span>
                </>
              )}
            </button>
          </form>

          {onBackToStore && (
            <div className="pt-2 text-center border-t border-stone-700/60">
              <button
                type="button"
                onClick={onBackToStore}
                className="text-xs font-bold text-stone-400 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1.5 font-mono"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver a la tienda principal</span>
              </button>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100/70 text-stone-900 pb-16 pt-6 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Bar */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-stone-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2.5 bg-brand-blue/10 text-brand-blue rounded-xl">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <span className="text-xs font-mono font-bold tracking-wider text-brand-blue uppercase bg-brand-blue/5 px-2.5 py-1 rounded-md border border-brand-blue/20">
                Impormax Control Admin
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
              Panel de Verificación de Pagos y Pedidos
            </h1>
            <p className="text-xs text-stone-500">
              Gestión centralizada de pedidos, pasarela Wompi Bancolombia, sincronización con Yeminus ERP y abonos de clientes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowReportModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow-emerald-600/20 cursor-pointer"
              title="Sacar reporte consolidado de pedidos: cuántos hay, de quién, valor individual y valor total"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Reporte de Pedidos</span>
            </button>

            <button
              onClick={loadData}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-all border border-stone-200 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition-all cursor-pointer font-mono"
              title="Cerrar sesión de administrador"
            >
              <LogOut className="w-4 h-4 text-red-600" />
              <span>Salir</span>
            </button>

            {onBackToStore && (
              <button
                onClick={onBackToStore}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver a la Tienda</span>
              </button>
            )}
          </div>
        </div>

        {/* Metrics Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Transferencias por verificar */}
          <div className="bg-gradient-to-br from-amber-500/10 via-amber-50 to-white rounded-2xl p-5 border border-amber-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-900">
                Abonos por Verificación
              </span>
              <div className="p-2 bg-amber-500 text-white rounded-lg font-mono text-xs font-black animate-pulse">
                ⏳ {pendingPayments.length}
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-950 font-mono">
              {formatCOP(totalPendingAmount)}
            </div>
            <p className="text-[11px] text-amber-800/80">
              Transferencias Directas o Bre-B requiriendo confirmación de extracto.
            </p>
          </div>

          {/* Card 2: Total Recaudado / Verificado */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-500">
                Recaudado Aprobado
              </span>
              <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">
              {formatCOP(totalApprovedAmount)}
            </div>
            <p className="text-[11px] text-stone-500">
              {approvedPayments.length} abonos y pagos efectivamente confirmados.
            </p>
          </div>

          {/* Card 3: Total Pedidos */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-500">
                Total Pedidos Registrados
              </span>
              <div className="p-2 bg-blue-100 text-brand-blue rounded-lg">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-stone-900 font-mono">
              {totalOrdersCount}
            </div>
            <p className="text-[11px] text-stone-500">
              Plan Separe y ventas directas en sistema.
            </p>
          </div>

          {/* Card 4: Pedidos Completamente Pagados */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-500">
                Pedidos Pagados 100%
              </span>
              <div className="p-2 bg-purple-100 text-purple-800 rounded-lg">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-purple-950 font-mono">
              {completedOrdersCount}
            </div>
            <p className="text-[11px] text-stone-500">
              Listos para despacho o entrega inmediata.
            </p>
          </div>

        </div>

        {/* Database & Catalog Backup Card */}
        <div className="bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-7 shadow-md border border-blue-900/60 relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
                  <Database className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-blue-300 bg-blue-900/50 px-2.5 py-1 rounded-md border border-blue-700/50">
                  Respaldo Permanente Supabase & Disco
                </span>
                <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-700/50 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Carga Ultrarrápida (&lt;100ms)
                </span>
              </div>

              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                Catálogo Espejo para Contingencia y Velocidad
              </h2>
              
              <p className="text-xs text-slate-300 leading-relaxed">
                Guarda los <strong className="text-white">590 productos</strong> consultados de la API de Yeminus (con imagen, stock, precios y descuentos) directamente en la tabla <code className="bg-slate-800 text-blue-300 px-1 py-0.5 rounded font-mono text-[11px]">public.products</code> de Supabase y en disco. Así, si el ERP Yeminus no responde o tarda más de 2 segundos, la landing cargará al instante desde este respaldo sin que los clientes lo noten.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-blue-400" />
                  <span>En Memoria: <strong className="text-white">{backupStatus?.inMemoryCount || 590} productos</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Supabase: <strong className="text-white">{backupStatus?.supabaseCount ? `${backupStatus.supabaseCount} productos` : 'Tabla lista en Supabase'}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Actualización: <strong className="text-slate-300">{backupStatus?.lastMemorySync ? new Date(backupStatus.lastMemorySync).toLocaleTimeString() : 'Automática'}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 min-w-[240px]">
              <button
                onClick={handleSyncCatalog}
                disabled={isSyncingCatalog}
                className="w-full py-3.5 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl text-xs font-extrabold uppercase tracking-wider transition-all shadow-lg hover:shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSyncingCatalog ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Guardando en Supabase...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 text-white" />
                    <span>Sincronizar y Guardar en Supabase</span>
                  </>
                )}
              </button>

              <button
                onClick={handleExportBackup}
                className="w-full py-2.5 px-4 bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 hover:text-white rounded-xl text-xs font-bold font-mono transition-all border border-slate-700 flex items-center justify-center gap-2 cursor-pointer"
                title="Descargar archivo JSON con los 590 productos y sus imágenes"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                <span>Descargar Copia JSON (590 items)</span>
              </button>

              <button
                onClick={handleClearTestOrders}
                className="w-full py-2.5 px-4 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-100 rounded-xl text-xs font-bold font-mono transition-all border border-rose-800/50 flex items-center justify-center gap-2 cursor-pointer"
                title="Eliminar todos los pedidos de prueba de la base de datos"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Vaciar Pedidos de Prueba</span>
              </button>
            </div>
          </div>
        </div>

        {/* Controls Bar: Filters & Search */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                filterStatus === 'all'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              Todos ({orders.length})
            </button>

            <button
              onClick={() => setFilterStatus('pending_verification')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterStatus === 'pending_verification'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <span>⏳ Pendientes Verificación</span>
              <span className="bg-white/20 text-white px-1.5 py-0.2 rounded font-mono text-[10px]">
                {pendingPayments.length}
              </span>
            </button>

            <button
              onClick={() => setFilterStatus('approved')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                filterStatus === 'approved'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              Abonando / Activos
            </button>

            <button
              onClick={() => setFilterStatus('pagado')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                filterStatus === 'pagado'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-50 text-purple-900 hover:bg-purple-100 border border-purple-200'
              }`}
            >
              Completados (100%)
            </button>
          </div>

          {/* Search Bar & Export Report */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Buscar por cédula, nombre, tel, ciudad o ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-stone-50 border border-stone-200 focus:outline-brand-blue rounded-xl text-xs text-stone-800 placeholder-stone-400 font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5 rounded-full cursor-pointer"
                  title="Limpiar búsqueda"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={() => setShowReportModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-2xs"
              title="Ver reporte con detalle de clientes y totales"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span className="hidden md:inline">Sacar Reporte</span>
              <span className="md:hidden">Reporte</span>
            </button>

            <button
              onClick={handleReconcileWompi}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-xs disabled:opacity-50"
              title="Consultar Wompi para detectar pagos aprobados y sincronizarlos con Supabase y Yeminus"
            >
              <CheckCircle2 className={`w-4 h-4 ${isLoading ? 'animate-spin' : 'text-indigo-200'}`} />
              <span className="hidden sm:inline">Conciliar Wompi</span>
              <span className="sm:hidden">Wompi</span>
            </button>

            <button
              onClick={handleSyncAllToYeminus}
              disabled={isLoading || orders.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-xs disabled:opacity-50"
              title="Sincronizar pedidos con Yeminus ERP (Sucursal 02, Caja 9, Punto 8)"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sincronizar con Yeminus</span>
              <span className="sm:hidden">Yeminus</span>
            </button>
          </div>

        </div>

        {/* Orders & Payments List */}
        {isLoading ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-stone-200/80 shadow-sm space-y-3">
            <RefreshCw className="w-8 h-8 text-brand-blue animate-spin mx-auto" />
            <p className="text-xs text-stone-500 font-medium">Cargando base de datos de pedidos y transferencias...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-stone-200/80 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto text-xl">
              📦
            </div>
            <h3 className="text-sm font-bold text-stone-800">
              {orders.length === 0 ? 'Sin pedidos registrados (Base en limpio)' : 'No se encontraron registros con este filtro'}
            </h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              {orders.length === 0
                ? 'El panel de pedidos está completamente vacío y listo para producción. Los nuevos pedidos que se creen a partir de hoy aparecerán aquí en tiempo real.'
                : 'Ajusta el término de búsqueda o selecciona otra pestaña para ver los pedidos.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Resumen de paginación superior */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-stone-500 font-medium px-1 gap-2">
              <span className="flex items-center gap-1.5 flex-wrap">
                <span>Mostrando</span>
                <strong className="text-stone-900 font-mono font-bold">{filteredOrders.length === 0 ? 0 : startIndex + 1} - {endIndex}</strong>
                <span>de</span>
                <strong className="text-stone-900 font-mono font-bold">{filteredOrders.length}</strong>
                <span>pedidos encontrados</span>
                {searchQuery && (
                  <span className="text-brand-blue font-bold">para "{searchQuery}"</span>
                )}
              </span>
              {totalPages > 1 && (
                <span className="font-mono text-stone-600 bg-stone-100 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border border-stone-200">
                  Página {currentPage} de {totalPages}
                </span>
              )}
            </div>

            <div className="space-y-4">
              {paginatedOrders.map((order) => {
              const orderPayments = payments.filter((p) => p.order_id === order.id);
              const pendingPaysForOrder = orderPayments.filter((p) => p.status === 'pending');

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-3xl border transition-all overflow-hidden shadow-sm ${
                    pendingPaysForOrder.length > 0
                      ? 'border-amber-300 ring-2 ring-amber-400/20'
                      : 'border-stone-200/80 hover:border-stone-300'
                  }`}
                >
                  {/* Order Top Banner */}
                  <div className="p-5 bg-stone-50/70 border-b border-stone-150 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-black text-sm text-stone-900 bg-white px-3 py-1 rounded-lg border border-stone-200 shadow-2xs">
                        {order.id}
                      </span>

                      {/* Status Tag */}
                      {order.status === 'pagado' ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 text-[10px] font-bold uppercase tracking-wider font-mono">
                          ✓ Pagado 100%
                        </span>
                      ) : order.status === 'abonando' ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold uppercase tracking-wider font-mono">
                          En Abonos (Plan Separe)
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold uppercase tracking-wider font-mono">
                          ⏳ Pendiente Aprobación Inicial
                        </span>
                      )}

                      {/* Yeminus ERP Sync Status */}
                      {order.product_name && order.product_name.includes('SLP-SLP-') ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 text-[10px] font-bold uppercase tracking-wider font-mono flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-blue-700" />
                          Yeminus: {order.product_name.match(/SLP-SLP-\d+/)?.[0] || 'SLP Registrado'}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold uppercase tracking-wider font-mono flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          Sin radicar en Yeminus
                        </span>
                      )}

                      <span className="text-[11px] text-stone-400 font-mono">
                        {new Date(order.created_at).toLocaleDateString('es-CO', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono">
                      <div>
                        <span className="text-stone-400 block text-[10px]">Total Pedido:</span>
                        <strong className="text-stone-900 text-sm">{formatCOP(order.total_amount)}</strong>
                      </div>
                      <div className="border-l border-stone-200 pl-4">
                        <span className="text-stone-400 block text-[10px]">Abonado Aprobado:</span>
                        <strong className="text-emerald-700 text-sm">{formatCOP(order.paid_amount)}</strong>
                      </div>
                      <div className="border-l border-stone-200 pl-4">
                        <span className="text-stone-400 block text-[10px]">Saldo Pendiente:</span>
                        <strong className="text-amber-700 text-sm">{formatCOP(order.balance_pending)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Order Details Body */}
                  <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* Column 1: Customer Data */}
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <h4 className="font-extrabold uppercase tracking-wider text-stone-500 text-[10px] flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-stone-600" /> Datos del Cliente
                        </h4>
                        <button
                          onClick={() => handleOpenEditProduct(order)}
                          className="text-[10px] text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 rounded-md border border-indigo-200 cursor-pointer transition shadow-2xs"
                          title="Editar o registrar cédula, dirección y teléfono de este cliente"
                        >
                          <Edit3 className="w-2.5 h-2.5" /> Editar Datos
                        </button>
                      </div>
                      <div className="bg-stone-50/80 p-3.5 rounded-2xl border border-stone-150 space-y-2">
                        <div>
                          <span className="text-[10px] text-stone-400 font-bold block uppercase tracking-wide">Nombre Completo:</span>
                          <p className="font-bold text-stone-900 text-sm leading-tight">{order.customer_name || 'Sin nombre registrado'}</p>
                        </div>
                        
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <FileText className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span className="text-stone-500 text-[11px] font-medium">CC / NIT:</span>
                          {order.customer_document && order.customer_document !== '222222222' ? (
                            <strong className="text-stone-900 font-mono text-xs bg-white px-2 py-0.5 rounded border border-stone-200">
                              {order.customer_document}
                            </strong>
                          ) : (
                            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[10px] font-semibold border border-amber-200">
                              Sin cédula registrada
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span className="text-stone-500 text-[11px]">Tel:</span>
                          <span className="text-stone-800 font-mono text-[11px] font-semibold">{order.customer_phone || <span className="text-stone-400 italic">No registrado</span>}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0 truncate" />
                          <span className="text-stone-500 text-[11px]">Email:</span>
                          <span className="text-stone-700 text-[11px] truncate">{order.customer_email || <span className="text-stone-400 italic">No registrado</span>}</span>
                        </div>

                        <div className="pt-2 border-t border-stone-200/70 space-y-1">
                          <div className="flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                            <div className="space-y-0.5 min-w-0">
                              <span className="text-[10px] text-stone-400 font-bold block uppercase tracking-wide">Dirección de Entrega:</span>
                              {order.shipping_address && order.shipping_address !== 'Entrega a domicilio / Retiro en tienda' ? (
                                <p className="text-stone-800 font-medium text-xs leading-snug break-words">
                                  {order.shipping_address}
                                </p>
                              ) : (
                                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[10px] font-semibold border border-amber-200 block">
                                  Sin dirección especificada
                                </span>
                              )}
                              <p className="text-stone-500 text-[11px] font-medium pt-0.5">
                                <strong>Ciudad:</strong>{' '}
                                {order.shipping_city ? (
                                  <span className="text-stone-900 font-semibold">{order.shipping_city}</span>
                                ) : (
                                  <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-amber-200">
                                    No especificada (Pendiente por confirmar)
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>

                        {(order.notes || order.observaciones) && (
                          <div className="pt-2 border-t border-stone-200/70">
                            <span className="text-[10px] text-stone-400 font-bold block uppercase tracking-wide">
                              Observaciones / Indicaciones:
                            </span>
                            <p className="text-stone-850 font-medium text-xs leading-snug break-words bg-amber-50/70 text-amber-950 p-2.5 rounded-xl border border-amber-200/80 mt-1 flex items-start gap-1.5">
                              <span className="text-amber-600 font-bold text-sm leading-none shrink-0">💬</span>
                              <span>{order.notes || order.observaciones}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Column 2: Product Info & Order Items */}
                    {(() => {
                      const displayItems = getDisplayOrderItems(order);
                      const isMulti = displayItems.length > 1;
                      const totalUnits = displayItems.reduce((acc, it) => acc + (it.quantity || 1), 0);
                      const calculatedItemsSum = displayItems.reduce((acc, it) => acc + (it.total || (it.unit_price * it.quantity)), 0);

                      return (
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <h4 className="font-extrabold uppercase tracking-wider text-stone-500 text-[10px] flex items-center gap-1.5">
                              <Package className="w-3.5 h-3.5 text-stone-600" />
                              <span>Artículos del Pedido ({displayItems.length})</span>
                            </h4>
                            {order.yeminus_sync_status === 'SYNCED' ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold text-[9px]">
                                ERP: {order.yeminus_document_id || 'SLP'}
                              </span>
                            ) : order.yeminus_sync_status === 'ERP_SYNC_FAILED' ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-mono font-bold text-[9px] flex items-center gap-0.5" title={order.yeminus_last_error}>
                                <AlertCircle className="w-2.5 h-2.5" /> Error ERP
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-mono font-bold text-[9px]">
                                ERP: Pendiente
                              </span>
                            )}
                          </div>

                          <div className="bg-stone-50/80 p-3 rounded-2xl border border-stone-150 space-y-2.5">
                            {isMulti && (
                              <div className="flex items-center justify-between px-2.5 py-1.5 bg-indigo-50/90 border border-indigo-200/80 rounded-xl text-[10px] text-indigo-950">
                                <span className="font-bold flex items-center gap-1.5">
                                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Pedido compuesto ({displayItems.length} artículos diferentes)</span>
                                </span>
                                <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-indigo-200 text-indigo-700">
                                  {totalUnits} unds en total
                                </span>
                              </div>
                            )}

                            <div className="border border-stone-200/80 rounded-xl overflow-hidden bg-white shadow-2xs">
                              <div className="bg-stone-100/90 px-2 py-1 text-[9px] font-extrabold text-stone-500 grid grid-cols-12 gap-1 uppercase tracking-wider font-mono border-b border-stone-200">
                                <span className="col-span-3">SKU / Ref</span>
                                <span className="col-span-4">Producto</span>
                                <span className="col-span-1 text-center">Cant</span>
                                <span className="col-span-2 text-right">Lista 8 Unit</span>
                                <span className="col-span-2 text-right">Total</span>
                              </div>
                              <div className="divide-y divide-stone-100 text-[10px]">
                                {displayItems.map((it: any, iIdx: number) => {
                                  const itemQty = Math.max(1, Number(it.quantity) || 1);
                                  const itemUnit = Number(it.unit_price) || Math.round(Number(it.total) / itemQty);
                                  const itemTot = Number(it.total) || (itemUnit * itemQty);
                                  const listPrice = Number(it.list_price || 0);
                                  return (
                                    <div key={iIdx} className="px-2 py-1.5 grid grid-cols-12 gap-1 items-center hover:bg-stone-50/50">
                                      <div className="col-span-3 truncate text-[9px] font-mono">
                                        <strong className="text-stone-800 block truncate" title={it.product_reference || it.product_id}>{it.product_reference || it.product_id || '-'}</strong>
                                        {it.product_id && it.product_reference && it.product_reference !== it.product_id && (
                                          <span className="text-[8px] text-stone-400 block truncate" title={it.product_id}>Cod: {it.product_id}</span>
                                        )}
                                      </div>
                                      <div className="col-span-4 min-w-0">
                                        <span className="font-medium text-stone-900 truncate block text-[10px]" title={it.product_name}>{it.product_name}</span>
                                        {it.discount_percentage > 0 && (
                                          <span className="text-[8px] font-mono text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded font-bold">
                                            -{it.discount_percentage}% Lista 8
                                          </span>
                                        )}
                                      </div>
                                      <span className="col-span-1 text-center font-bold text-stone-700 font-mono">x{itemQty}</span>
                                      <div className="col-span-2 text-right font-mono text-[9px]">
                                        {listPrice > itemUnit && (
                                          <span className="text-[8px] text-stone-400 line-through block font-mono">
                                            {formatCOP(listPrice)}
                                          </span>
                                        )}
                                        <strong className="text-stone-800 block">{formatCOP(itemUnit)}</strong>
                                      </div>
                                      <span className="col-span-2 text-right font-mono font-bold text-stone-900">{formatCOP(itemTot)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                              {isMulti && (
                                <div className="bg-stone-50/90 px-2 py-1.5 border-t border-stone-200 flex items-center justify-between text-[10px] font-mono">
                                  <span className="font-bold text-stone-600">Total Artículos ({displayItems.length}):</span>
                                  <span className="font-bold text-stone-900">{formatCOP(calculatedItemsSum)}</span>
                                </div>
                              )}
                            </div>

                            {order.yeminus_last_error && order.yeminus_sync_status === 'ERP_SYNC_FAILED' && (
                              <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-[10px] text-rose-800 font-mono">
                                <strong>Aviso Yeminus:</strong> {order.yeminus_last_error}
                                <button
                                  onClick={() => handleManualSyncToYeminus(order.id)}
                                  className="mt-1 block text-brand-blue font-bold underline hover:text-brand-blue/80"
                                >
                                  Reintentar sincronización directa
                                </button>
                              </div>
                            )}

                            {order.wompi_reference && (
                              <div className="flex justify-between text-[10px] text-stone-500 font-mono border-t border-stone-200/60 pt-2">
                                <span>Ref Wompi:</span>
                                <span className="font-bold">{order.wompi_reference}</span>
                              </div>
                            )}
                            <div className={`flex justify-between text-[11px] text-stone-600 ${!order.wompi_reference ? 'border-t border-stone-200/60 pt-2' : ''}`}>
                              <span>Método de pago:</span>
                              <span className="font-mono font-bold uppercase text-brand-blue">{order.payment_method || 'wompi'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Column 3: Payment Records & Verification Actions */}
                    <div className="space-y-2 text-xs md:col-span-1">
                      <h4 className="font-extrabold uppercase tracking-wider text-stone-400 text-[10px] flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-stone-500" /> Historial de Pagos y Comprobantes
                      </h4>

                      {orderPayments.length === 0 ? (
                        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 text-stone-400 text-center text-[11px]">
                          No se han registrado abonos o comprobantes aún.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {orderPayments.map((p) => {
                            const isPending = p.status === 'pending';
                            const isApproved = p.status === 'approved';

                            return (
                              <div
                                key={p.id}
                                className={`p-3.5 rounded-2xl border space-y-2 transition-all ${
                                  isPending
                                    ? 'bg-amber-50/90 border-amber-300 shadow-2xs'
                                    : isApproved
                                    ? 'bg-emerald-50/50 border-emerald-200'
                                    : 'bg-rose-50/50 border-rose-200 opacity-60'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 font-bold font-mono text-[11px]">
                                    {p.payment_method === 'transferencia' ? (
                                      <Landmark className="w-3.5 h-3.5 text-brand-blue" />
                                    ) : p.payment_method === 'bre-b' ? (
                                      <Key className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                                    )}
                                    <span className="uppercase">{p.payment_method}</span>
                                  </div>

                                  {isPending ? (
                                    <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-950 font-bold text-[9px] uppercase font-mono tracking-wider flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-amber-700" /> Pendiente
                                    </span>
                                  ) : isApproved ? (
                                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-[9px] uppercase font-mono tracking-wider flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Aprobado
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 font-bold text-[9px] uppercase font-mono tracking-wider flex items-center gap-1">
                                      <XCircle className="w-3 h-3 text-rose-600" /> Rechazado
                                    </span>
                                  )}
                                </div>

                                <div className="flex justify-between items-baseline">
                                  <div>
                                    <span className="text-[10px] text-stone-500 block">Monto del Comprobante:</span>
                                    <span className="font-extrabold text-sm font-mono text-stone-900">
                                      {formatCOP(p.amount)}
                                    </span>
                                  </div>
                                  <div className="text-right font-mono text-[10px]">
                                    <span className="text-stone-400 block">Comprobante / Ref:</span>
                                    <strong className="text-stone-800 bg-white px-1.5 py-0.5 rounded border border-stone-200">
                                      {p.payment_reference || 'N/A'}
                                    </strong>
                                  </div>
                                </div>

                                {/* Action Buttons for Pending Payments */}
                                {isPending && (
                                  <div className="pt-2 border-t border-amber-200/80 flex items-center gap-2">
                                    <button
                                      onClick={() => handleApprovePayment(p.id, order)}
                                      disabled={processingPayId === p.id}
                                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-[11px] transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1"
                                    >
                                      {processingPayId === p.id ? (
                                        <span>Aprobando...</span>
                                      ) : (
                                        <>
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                          <span>Aprobar Pago</span>
                                        </>
                                      )}
                                    </button>

                                    <button
                                      onClick={() => handleRejectPayment(p.id)}
                                      disabled={processingPayId === p.id}
                                      className="py-2 px-3 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1"
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                      <span>Rechazar</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Order Action Footer: Acciones directas de Aprobación y Sincronización Yeminus ERP */}
                  <div className="px-5 py-3.5 bg-stone-50/90 border-t border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {order.product_name && order.product_name.includes('SLP-SLP-') ? (
                        <div className="flex items-center gap-1.5 text-xs text-blue-900 font-mono">
                          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>
                            Radicado en Yeminus ERP (Suc 02, Caja 9, Pto 8):{' '}
                            <strong className="bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-800">
                              {order.product_name.match(/SLP-SLP-\d+/)?.[0] || 'SLP Oficial'}
                            </strong>
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-amber-800 font-mono">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Pedido pendiente por registrar en Yeminus ERP</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Botón Aprobar Pedido si está en estado pendiente */}
                      {order.status === 'pending' && (
                        <button
                          onClick={() => handleApproveOrder(order)}
                          disabled={processingPayId === order.id}
                          className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                          title="Aprobar pedido formalmente y crear documento SLP en Yeminus ERP"
                        >
                          {processingPayId === order.id ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Aprobando...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Aprobar Pedido y Radicar</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Botón Ver Comprobante */}
                      <button
                        onClick={() => handleViewReceipt(order)}
                        disabled={loadingReceiptId === order.id}
                        className="py-2 px-3.5 rounded-xl font-bold text-xs bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                        title="Ver, imprimir o compartir el comprobante / recibo oficial de este pedido"
                      >
                        {loadingReceiptId === order.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-700" />
                        ) : (
                          <Printer className="w-3.5 h-3.5 text-amber-700" />
                        )}
                        <span>Ver Recibo / PDF</span>
                      </button>

                      {/* Botón Reenviar Correo Oficial */}
                      <button
                        onClick={() => handleResendEmail(order)}
                        disabled={sendingEmailId === order.id}
                        className="py-2 px-3 rounded-xl font-bold text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                        title={`Reenviar comprobante oficial por correo a ${order.customer_email || 'el cliente'}`}
                      >
                        {sendingEmailId === order.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                        ) : (
                          <Mail className="w-3.5 h-3.5 text-emerald-700" />
                        )}
                        <span>Enviar Correo</span>
                      </button>

                      {/* Botón Editar Pedido, Envío y Artículos */}
                      <button
                        onClick={() => handleOpenEditProduct(order)}
                        className="py-2 px-3 rounded-xl font-bold text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                        title="Editar o corregir los datos del cliente, dirección de entrega y los artículos exactos de este pedido"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-indigo-700" />
                        <span>Editar Pedido / Envío</span>
                      </button>

                      <button
                        onClick={() => handleSyncOrderToYeminus(order)}
                        disabled={processingPayId === order.id}
                        className={`py-2 px-3.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50 ${
                          order.product_name && order.product_name.includes('SLP-SLP-')
                            ? 'bg-white hover:bg-stone-100 text-stone-700 border border-stone-200'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                        title="Enviar o actualizar registro de pedido en Yeminus ERP (Sucursal 02, Caja 9, Punto 8)"
                      >
                        {processingPayId === order.id ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Sincronizando...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>
                              {order.product_name && order.product_name.includes('SLP-SLP-')
                                ? 'Re-sincronizar Yeminus'
                                : 'Enviar a Yeminus ERP'}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Barra de Paginación */}
          {totalPages > 1 && (
            <div className="bg-white rounded-3xl border border-stone-200 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm mt-6">
              <div className="text-xs text-stone-500 font-medium">
                Mostrando <strong className="text-stone-900 font-mono font-bold">{startIndex + 1}</strong> a <strong className="text-stone-900 font-mono font-bold">{endIndex}</strong> de <strong className="text-stone-900 font-mono font-bold">{filteredOrders.length}</strong> pedidos
              </div>

              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1 text-xs font-bold shadow-2xs"
                  title="Página anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Anterior</span>
                </button>

                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                    .map((pageNum, idx, arr) => {
                      const prev = arr[idx - 1];
                      return (
                        <React.Fragment key={pageNum}>
                          {prev && pageNum - prev > 1 && (
                            <span className="px-1 text-stone-400 text-xs">...</span>
                          )}
                          <button
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-8 h-8 rounded-xl text-xs font-bold font-mono transition cursor-pointer ${
                              currentPage === pageNum
                                ? 'bg-brand-blue text-white shadow-xs'
                                : 'bg-stone-50 text-stone-700 hover:bg-stone-100 border border-stone-200'
                            }`}
                          >
                            {pageNum}
                          </button>
                        </React.Fragment>
                      );
                    })}
                </div>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1 text-xs font-bold shadow-2xs"
                  title="Página siguiente"
                >
                  <span className="hidden sm:inline">Siguiente</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Selector de Pedidos por Página */}
              <div className="flex items-center gap-2 text-xs text-stone-500 font-medium">
                <span>Por página:</span>
                <select
                  value={ordersPerPage}
                  onChange={(e) => {
                    setOrdersPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-stone-800 cursor-pointer focus:outline-brand-blue"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      </div>

      {/* Modal de Reporte Completo de Pedidos */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Modal Header */}
            <div className="p-6 sm:p-7 border-b border-stone-200 bg-stone-50/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-mono font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                    Reporte Consolidado • Impormax Navidad
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                  Reporte General de Pedidos y Recaudos
                </h2>
                <p className="text-xs text-stone-500">
                  Resumen de cuántos pedidos hay en total, datos de cada cliente, valor individual de cada pedido y valor total consolidado.
                </p>
              </div>

              {/* Header Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportOrdersCSV}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                  title="Descargar archivo Excel (CSV) con el listado completo y totales"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Excel (.csv)</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyReportSummary}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded-xl text-xs font-bold transition-all cursor-pointer font-mono"
                  title="Copiar texto resumen para enviar por WhatsApp o Email"
                >
                  {copiedSummary ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-stone-600" />
                      <span>Copiar Resumen</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handlePrintReport}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded-xl text-xs font-bold transition-all cursor-pointer font-mono"
                  title="Imprimir o guardar en PDF"
                >
                  <Printer className="w-4 h-4 text-stone-600" />
                  <span>Imprimir / PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer"
                  title="Cerrar ventana"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Metrics Summary Strip (KPIs) */}
            <div className="p-6 bg-stone-100/60 border-b border-stone-200 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-1">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-stone-500 block">
                  1. Cantidad de Pedidos
                </span>
                <div className="text-xl sm:text-2xl font-black text-stone-900 font-mono">
                  {orders.length} pedidos
                </div>
                <p className="text-[11px] text-stone-500">
                  {completedOrdersCount} pagados al 100% • {orders.length - completedOrdersCount} en proceso
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-1">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-700 block">
                  2. Valor Total Pedidos
                </span>
                <div className="text-xl sm:text-2xl font-black text-blue-900 font-mono">
                  {formatCOP(grandTotalOrdersValue)}
                </div>
                <p className="text-[11px] text-blue-700/80">
                  Suma del 100% de los pedidos registrados
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-1">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-700 block">
                  3. Total Recaudado / Abonos
                </span>
                <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">
                  {formatCOP(grandTotalPaidValue)}
                </div>
                <p className="text-[11px] text-emerald-700/80">
                  {approvedPayments.length} pagos verificados y aprobados
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-1">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-700 block">
                  4. Saldo Total Pendiente
                </span>
                <div className="text-xl sm:text-2xl font-black text-amber-800 font-mono">
                  {formatCOP(grandTotalBalanceValue)}
                </div>
                <p className="text-[11px] text-amber-700/80">
                  Por cobrar a clientes antes de despacho
                </p>
              </div>
            </div>

            {/* In-Modal Filter / Search */}
            <div className="px-6 py-3 bg-white border-b border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Filtrar por cliente, cédula, teléfono, ciudad..."
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-stone-50 border border-stone-200 focus:outline-emerald-600 rounded-xl text-xs text-stone-800 placeholder-stone-400"
                />
              </div>
              <div className="text-xs font-mono text-stone-500 w-full sm:w-auto text-right">
                Mostrando <strong>{reportOrders.length}</strong> de <strong>{orders.length}</strong> pedidos
              </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-auto p-4 sm:p-6">
              {reportOrders.length === 0 ? (
                <div className="py-12 text-center text-stone-500 space-y-2">
                  <p className="text-sm font-bold text-stone-700">No hay pedidos para mostrar</p>
                  <p className="text-xs">Verifica el término de búsqueda o registra nuevos pedidos en la tienda.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-stone-200 shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse bg-white">
                    <thead>
                      <tr className="bg-stone-100/90 text-stone-700 border-b border-stone-200 font-mono uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-3.5 font-bold">#</th>
                        <th className="py-3 px-3.5 font-bold">ID Pedido</th>
                        <th className="py-3 px-3.5 font-bold">Fecha</th>
                        <th className="py-3 px-3.5 font-bold">Cliente (De quién)</th>
                        <th className="py-3 px-3.5 font-bold">Contacto</th>
                        <th className="py-3 px-3.5 font-bold">Ciudad / Envío</th>
                        <th className="py-3 px-3.5 font-bold min-w-[200px]">Producto</th>
                        <th className="py-3 px-3.5 font-bold text-center">Estado</th>
                        <th className="py-3 px-3.5 font-bold text-right">Valor Pedido</th>
                        <th className="py-3 px-3.5 font-bold text-right">Abonado</th>
                        <th className="py-3 px-3.5 font-bold text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-150">
                      {reportOrders.map((o, idx) => (
                        <tr key={o.id} className="hover:bg-stone-50/80 transition-colors">
                          <td className="py-3 px-3.5 font-mono text-stone-400 text-[11px]">{idx + 1}</td>
                          <td className="py-3 px-3.5 font-mono font-bold text-stone-900 whitespace-nowrap">
                            <span className="bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                              {o.id}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 font-mono text-stone-600 whitespace-nowrap text-[11px]">
                            {new Date(o.created_at).toLocaleDateString('es-CO')}
                          </td>
                          <td className="py-3 px-3.5">
                            <div className="font-bold text-stone-900">{o.customer_name}</div>
                            <div className="text-[10px] font-mono text-stone-500">CC: {o.customer_document || 'N/A'}</div>
                          </td>
                          <td className="py-3 px-3.5 text-[11px] text-stone-600">
                            <div>{o.customer_phone}</div>
                            <div className="text-stone-400 text-[10px] truncate max-w-[140px]">{o.customer_email}</div>
                          </td>
                          <td className="py-3 px-3.5 text-[11px]">
                            <span className="font-semibold text-stone-800">{o.shipping_city}</span>
                            <p className="text-[10px] text-stone-500 truncate max-w-[140px]">{o.shipping_address}</p>
                          </td>
                          <td className="py-3 px-3.5 text-[11px] text-stone-800">
                            {(() => {
                              const displayItems = getDisplayOrderItems(o);
                              if (displayItems.length > 1) {
                                const totalUnits = displayItems.reduce((acc, it) => acc + (it.quantity || 1), 0);
                                return (
                                  <div className="space-y-1.5 min-w-[260px]">
                                    <div className="flex items-center gap-1.5">
                                      <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900 font-bold font-mono text-[9px] border border-indigo-200">
                                        {displayItems.length} artículos ({totalUnits} unds)
                                      </span>
                                    </div>
                                    <div className="border border-stone-200 rounded-lg overflow-hidden bg-stone-50/60 divide-y divide-stone-150 text-[10px]">
                                      {displayItems.map((it, itIdx) => (
                                        <div key={itIdx} className="px-2 py-1 flex items-center justify-between gap-1 hover:bg-white">
                                          <span className="truncate max-w-[170px]" title={it.product_name}>
                                            <strong className="font-mono text-stone-700">{it.quantity}x</strong> {it.product_name}
                                          </span>
                                          <span className="font-mono font-bold text-stone-800 shrink-0 text-[9px]">
                                            {formatCOP(it.total || (it.unit_price * it.quantity))}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              }
                              const singleIt = displayItems[0];
                              return (
                                <div className="min-w-[200px]">
                                  <div className="font-medium text-stone-900 leading-snug">{o.product_name}</div>
                                  {singleIt && (
                                    <div className="text-[10px] font-mono text-stone-500 mt-0.5">
                                      {singleIt.quantity > 1 ? `${singleIt.quantity} unds a ${formatCOP(singleIt.unit_price)} c/u` : `Ref: ${singleIt.product_reference || singleIt.product_id || '-'}`}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            {o.status === 'pagado' ? (
                              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 font-bold font-mono text-[9px] uppercase">
                                ✓ Pagado
                              </span>
                            ) : o.status === 'abonando' ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-bold font-mono text-[9px] uppercase">
                                En Abonos
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold font-mono text-[9px] uppercase">
                                Pendiente
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-bold text-stone-900 whitespace-nowrap">
                            {formatCOP(o.total_amount)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                            {formatCOP(o.paid_amount)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-bold text-amber-700 whitespace-nowrap">
                            {formatCOP(o.balance_pending)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-stone-900 text-white font-mono font-black border-t-2 border-stone-900">
                        <td colSpan={8} className="py-3.5 px-3.5 uppercase tracking-wider text-xs">
                          TOTALES CONSOLIDADOS ({reportOrders.length} PEDIDOS):
                        </td>
                        <td className="py-3.5 px-3.5 text-right text-xs whitespace-nowrap text-emerald-300">
                          {formatCOP(reportTotalOrdersValue)}
                        </td>
                        <td className="py-3.5 px-3.5 text-right text-xs whitespace-nowrap text-emerald-300">
                          {formatCOP(reportTotalPaidValue)}
                        </td>
                        <td className="py-3.5 px-3.5 text-right text-xs whitespace-nowrap text-amber-300">
                          {formatCOP(reportTotalBalanceValue)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-stone-500 font-mono text-[11px]">
                Reporte generado para administración Impormax • Base de datos Supabase
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportOrdersCSV}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer transition-all inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Archivo Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl font-bold cursor-pointer transition-all"
                >
                  Cerrar
                </button>
              </div>
            </div>

          </motion.div>
        </div>
      )}

      {/* Modal para Editar y Gestionar Datos de Envío y Artículos del Pedido */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-stone-200 space-y-5 max-h-[94vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="font-extrabold text-stone-900 text-lg flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-indigo-600" />
                  Editar Pedido, Datos de Envío y Artículos
                </h3>
                <p className="text-xs text-stone-500 mt-0.5 font-mono">
                  ID Pedido: <strong className="text-stone-800">{editingOrder.id}</strong> | Wompi Ref: <strong className="text-stone-800">{editingOrder.wompi_reference || 'N/A'}</strong>
                </p>
              </div>
              <button
                onClick={() => setEditingOrder(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* SECCIÓN 1: DATOS DEL CLIENTE Y ENVÍO */}
            <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-200 space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                Datos del Cliente y Dirección de Entrega
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">Nombre del Cliente:</label>
                  <input
                    type="text"
                    value={editingCustomerName}
                    onChange={(e) => setEditingCustomerName(e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl font-medium focus:outline-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">Cédula / NIT / Documento:</label>
                  <input
                    type="text"
                    value={editingCustomerDoc}
                    onChange={(e) => setEditingCustomerDoc(e.target.value)}
                    placeholder="Ej: 1052389078"
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl font-mono font-bold focus:outline-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">Teléfono / WhatsApp:</label>
                  <input
                    type="text"
                    value={editingCustomerPhone}
                    onChange={(e) => setEditingCustomerPhone(e.target.value)}
                    placeholder="Ej: 3101234567"
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl font-medium focus:outline-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">Correo Electrónico:</label>
                  <input
                    type="email"
                    value={editingCustomerEmail}
                    onChange={(e) => setEditingCustomerEmail(e.target.value)}
                    placeholder="cliente@email.com"
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl font-medium focus:outline-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-rose-500" /> Dirección de Entrega:
                  </label>
                  <input
                    type="text"
                    value={editingShippingAddress}
                    onChange={(e) => setEditingShippingAddress(e.target.value)}
                    placeholder="Ej: Cra 14 # 20-30 Apto 402, Pereira"
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl font-medium focus:outline-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">Ciudad de Envío:</label>
                  <input
                    type="text"
                    list="ciudades-colombia-admin"
                    value={editingShippingCity}
                    onChange={(e) => setEditingShippingCity(e.target.value)}
                    placeholder="Ej: Pereira, Bogotá, Cali..."
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl font-medium focus:outline-indigo-500"
                  />
                  <datalist id="ciudades-colombia-admin">
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
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-stone-600 mb-1 flex items-center justify-between">
                    <span>Observaciones o Indicaciones Especiales:</span>
                    <span className="text-stone-400 font-normal text-[10px]">Opcional (horarios, color, modelo)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={editingNotes}
                    onChange={(e) => setEditingNotes(e.target.value)}
                    placeholder="Ej: Entregar después de las 2 PM, modelo nevado, timbre averiado..."
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl font-medium focus:outline-indigo-500 text-xs resize-none"
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: BUSCADOR DE CATÁLOGO PARA AÑADIR PRODUCTOS */}
            <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-150 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase font-extrabold text-indigo-950 tracking-wider flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-indigo-600" /> Buscar y Agregar Producto del Catálogo (590+ Artículos):
                </span>
                <span className="text-[10px] text-indigo-700 font-mono">
                  {catalogProducts.length > 0 ? `${catalogProducts.length} productos disponibles` : 'Catálogo listo'}
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Escribe el nombre o SKU (ej: Arbol Nevado, Cascanueces, 8010147, 401563)..."
                  className="w-full px-3.5 py-2 text-xs bg-white border border-indigo-200 rounded-xl font-medium focus:outline-indigo-600 shadow-2xs"
                />
                {catalogSearch.trim().length >= 2 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-2xl border border-stone-200 shadow-xl z-20 max-h-56 overflow-y-auto divide-y divide-stone-100">
                    {catalogProducts
                      .filter(p => 
                        p.name.toLowerCase().includes(catalogSearch.toLowerCase().trim()) ||
                        p.id.toLowerCase().includes(catalogSearch.toLowerCase().trim())
                      )
                      .slice(0, 8)
                      .map((prod) => (
                        <div
                          key={prod.id}
                          onClick={() => handleAddProductFromCatalog(prod)}
                          className="p-2.5 hover:bg-indigo-50/60 transition cursor-pointer flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            {prod.imageUrl ? (
                              <img src={prod.imageUrl} alt={prod.name} className="w-8 h-8 rounded-lg object-cover border border-stone-200 shrink-0" />
                            ) : (
                              <Package className="w-8 h-8 p-1.5 rounded-lg bg-stone-100 text-stone-500 shrink-0" />
                            )}
                            <div className="truncate">
                              <p className="font-bold text-stone-900 truncate">{prod.name}</p>
                              <p className="text-[10px] text-stone-500 font-mono">SKU: <strong>{prod.id}</strong></p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-bold text-stone-900 text-xs">
                              {formatCOP(prod.discountPrice || prod.price)}
                            </span>
                            <button
                              type="button"
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold cursor-pointer transition flex items-center gap-1 shadow-2xs"
                            >
                              <Plus className="w-3 h-3" /> Añadir
                            </button>
                          </div>
                        </div>
                      ))}
                    {catalogProducts.filter(p => 
                      p.name.toLowerCase().includes(catalogSearch.toLowerCase().trim()) ||
                      p.id.toLowerCase().includes(catalogSearch.toLowerCase().trim())
                    ).length === 0 && (
                      <div className="p-3 text-center text-xs text-stone-500">
                        No se encontraron productos con "{catalogSearch}". Puedes añadir una fila manual abajo.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* SECCIÓN 3: TABLA DE ARTÍCULOS EDITABLES */}
            <div className="border border-stone-200 rounded-2xl overflow-hidden shadow-2xs">
              <div className="bg-stone-100 px-3 py-2 text-[10px] font-extrabold text-stone-600 grid grid-cols-12 gap-2 uppercase tracking-wider font-mono border-b border-stone-200">
                <span className="col-span-3">Código / SKU</span>
                <span className="col-span-4">Nombre del Producto</span>
                <span className="col-span-2 text-center">Cantidad</span>
                <span className="col-span-2 text-right">Precio Unitario</span>
                <span className="col-span-1 text-center">Eliminar</span>
              </div>

              <div className="divide-y divide-stone-150 p-1.5 space-y-1">
                {editingItems.map((item, idx) => (
                  <div key={idx} className="p-2 grid grid-cols-12 gap-2 items-center bg-white rounded-xl hover:bg-stone-50/50">
                    <div className="col-span-3">
                      <input
                        type="text"
                        value={item.product_id}
                        onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                        placeholder="Ej: 8010147"
                        className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-stone-50 border border-stone-200 rounded-lg focus:bg-white focus:outline-indigo-500"
                      />
                    </div>
                    <div className="col-span-4">
                      <input
                        type="text"
                        value={item.product_name}
                        onChange={(e) => handleItemChange(idx, 'product_name', e.target.value)}
                        placeholder="Nombre descriptivo del artículo"
                        className="w-full px-2.5 py-1.5 text-xs font-medium bg-stone-50 border border-stone-200 rounded-lg focus:bg-white focus:outline-indigo-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-full px-2.5 py-1.5 text-xs font-bold text-center bg-stone-50 border border-stone-200 rounded-lg focus:bg-white focus:outline-indigo-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-right bg-stone-50 border border-stone-200 rounded-lg focus:bg-white focus:outline-indigo-500"
                      />
                    </div>
                    <div className="col-span-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        disabled={editingItems.length <= 1}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg disabled:opacity-30 cursor-pointer transition"
                        title="Eliminar este artículo"
                      >
                        <Trash2 className="w-4 h-4 mx-auto" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Botón Añadir Fila y Resumen Financiero Dinámico */}
              <div className="p-3 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="px-3.5 py-2 bg-white hover:bg-stone-100 border border-stone-300 rounded-xl font-bold text-stone-700 flex items-center gap-1.5 cursor-pointer shadow-2xs transition"
                >
                  <Plus className="w-4 h-4 text-emerald-600" />
                  <span>Añadir Fila Vacía</span>
                </button>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <div>
                    <span className="text-stone-400 block text-[10px]">Total Calculado:</span>
                    <strong className="text-stone-900 text-sm">
                      {formatCOP(editingItems.reduce((acc, it) => acc + (it.total || (it.quantity * it.unit_price)), 0))}
                    </strong>
                  </div>
                  <div className="border-l border-stone-200 pl-3">
                    <span className="text-stone-400 block text-[10px]">Abonado Pagado:</span>
                    <strong className="text-emerald-700 text-sm">
                      {formatCOP(editingOrder.paid_amount || 0)}
                    </strong>
                  </div>
                  <div className="border-l border-stone-200 pl-3">
                    <span className="text-stone-400 block text-[10px]">Saldo Restante:</span>
                    <strong className="text-amber-700 text-sm">
                      {formatCOP(Math.max(0, editingItems.reduce((acc, it) => acc + (it.total || (it.quantity * it.unit_price)), 0) - (editingOrder.paid_amount || 0)))}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN 4: CHECKBOX PARA SINCRONIZAR A YEMINUS ERP */}
            <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-blue-950 font-medium select-none">
                <input
                  type="checkbox"
                  checked={syncToYeminusOnSave}
                  onChange={(e) => setSyncToYeminusOnSave(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-stone-300 focus:ring-blue-500 cursor-pointer"
                />
                <span>Radicar inmediatamente a Yeminus ERP (Sucursal 02, Caja 9, Punto 8) con estos artículos y datos actualizados</span>
              </label>
            </div>

            {/* FOOTER ACCIONES */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveProductEdit}
                disabled={isUpdatingProduct}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-md"
              >
                {isUpdatingProduct ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Guardando Cambios del Pedido...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Guardar Pedido y Artículos</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Comprobante / Recibo Oficial de Pedido */}
      <OrderReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        receipt={selectedReceipt}
      />

      {/* Floating Admin Toast Notification */}
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className={`fixed bottom-6 right-6 z-50 max-w-sm p-4 rounded-2xl shadow-xl flex items-center gap-3 text-white text-xs font-bold ${
            notification.type === 'success' ? 'bg-emerald-700' : 'bg-rose-700'
          }`}
        >
          <span>{notification.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{notification.message}</span>
        </motion.div>
      )}
    </div>
  );
}
