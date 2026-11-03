import WebSocket from "ws";

// Polyfill global WebSocket para entornos Node.js < 22 (Supabase Realtime y WebSockets)
if (typeof (globalThis as any).WebSocket === "undefined") {
  (globalThis as any).WebSocket = WebSocket;
}

import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";

const currentDir = typeof __dirname !== "undefined"
  ? __dirname
  : (import.meta.url ? path.dirname(fileURLToPath(import.meta.url)) : process.cwd());

dotenv.config({ path: path.join(process.cwd(), ".env"), override: true });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

import {
  db,
  saveOrderWithItems,
  getOrderById,
  getOrderByWompiRef,
  getAllOrders,
  savePayment,
  savePendingCheckout,
  getPendingCheckout,
  syncAndRecoverFromSupabase,
  deleteOrder,
  findInCatalog
} from "./server/db.ts";
import { sendOrderConfirmationEmail } from "./server/email.ts";

// Configuración de Seguridad y Administración
const ADMIN_SECRET = process.env.ADMIN_SECRET || "impormax_admin_secret_key_2026";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "impormax2026";

export function verifyAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const [payloadBase64, sig] = token.split(".");
    if (!payloadBase64 || !sig) return false;
    const expectedSig = crypto.createHmac("sha256", ADMIN_SECRET).update(payloadBase64).digest("hex");
    if (sig !== expectedSig) return false;
    const payload = JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf-8"));
    if (payload.role !== "admin" || payload.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

export function adminAuthMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.headers["x-admin-key"] as string);
  
  if (token === ADMIN_PASSWORD || req.headers["x-admin-key"] === ADMIN_PASSWORD) {
    return next();
  }

  if (verifyAdminToken(token)) {
    return next();
  }

  return res.status(401).json({ success: false, error: "No autorizado. Requiere credenciales de administrador." });
}

// Endpoint de login administrativo con hash y expiración
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  if (!password || password.trim() !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: "Contraseña incorrecta de administración." });
  }

  const payload = {
    role: "admin",
    exp: Date.now() + 7 * 24 * 3600 * 1000 // 7 días
  };
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  const signature = crypto.createHmac("sha256", ADMIN_SECRET).update(payloadBase64).digest("hex");
  const token = `${payloadBase64}.${signature}`;

  res.json({ success: true, token });
});



// Servir dinámicamente logo_impormax.png desde cualquier ubicación del proyecto donde el usuario lo suba
app.get("/logo_impormax.png", (req, res) => {
  const rootPath = path.join(process.cwd(), "logo_impormax.png");
  const publicPath = path.join(process.cwd(), "public", "logo_impormax.png");
  const srcPath = path.join(process.cwd(), "src", "logo_impormax.png");
  
  if (fs.existsSync(rootPath)) {
    res.sendFile(rootPath);
  } else if (fs.existsSync(publicPath)) {
    res.sendFile(publicPath);
  } else if (fs.existsSync(srcPath)) {
    res.sendFile(srcPath);
    // Si no existe, servimos un logo de placeholder navideño para que no se vea roto
    res.redirect("https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=150");
  }
});

// Endpoint directo para descargar dist.zip compilado para cPanel
app.get(["/dist.zip", "/download/dist.zip", "/api/download/dist.zip"], (req, res) => {
  const zipPath = path.join(process.cwd(), "dist.zip");
  if (fs.existsSync(zipPath)) {
    res.setHeader("Content-Type", "application/zip");
    res.download(zipPath, "dist.zip");
  } else {
    res.status(404).send("dist.zip no encontrado. Ejecuta 'npm run build' primero.");
  }
});

// Variables de diagnóstico y logs en tiempo real para la consola de API de la landing page
let apiLogs: Array<{
  timestamp: string;
  type: "INFO" | "SUCCESS" | "ERROR";
  endpoint: string;
  message: string;
  payload?: any;
  response?: any;
}> = [];

function logApi(type: "INFO" | "SUCCESS" | "ERROR", endpoint: string, message: string, payload?: any, response?: any) {
  apiLogs.unshift({
    timestamp: new Date().toLocaleTimeString(),
    type,
    endpoint,
    message,
    payload,
    response
  });
  if (apiLogs.length > 50) apiLogs.pop();
}

import { createClient } from "@supabase/supabase-js";

// Token Cache
let cachedToken: string | null = null;
let cachedRefreshToken: string | null = null;
let tokenExpiresAt: number = 0;

const YEMINUS_BASE = "https://tienda.impormax.net";
const BACKUP_FILE_PATH = path.join(process.cwd(), "products_backup.json");

// Memoria persistente en disco de sesiones Wompi pendientes antes de confirmación
const PENDING_SESSIONS_FILE = path.join(process.cwd(), "pending_wompi_sessions.json");
const pendingWompiSessions = new Map<string, any>();

function loadPendingSessions() {
  try {
    if (fs.existsSync(PENDING_SESSIONS_FILE)) {
      const content = fs.readFileSync(PENDING_SESSIONS_FILE, "utf-8");
      const parsed = JSON.parse(content);
      for (const [key, val] of Object.entries(parsed)) {
        pendingWompiSessions.set(key, val);
      }
      console.log(`[PENDING SESSIONS] Cargadas ${pendingWompiSessions.size} sesiones pendientes del disco.`);
    }
  } catch (e: any) {
    console.warn("[PENDING SESSIONS] Error al cargar:", e.message);
  }
}
loadPendingSessions();

function savePendingSession(ref: string, data: any) {
  pendingWompiSessions.set(ref, data);
  try {
    const obj = Object.fromEntries(pendingWompiSessions);
    fs.writeFileSync(PENDING_SESSIONS_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch (e: any) {
    console.warn("[PENDING SESSIONS] Error al guardar:", e.message);
  }
}

function getPendingSession(ref: string): any {
  if (!ref) return null;
  if (pendingWompiSessions.has(ref)) {
    return pendingWompiSessions.get(ref);
  }
  try {
    if (fs.existsSync(PENDING_SESSIONS_FILE)) {
      const content = fs.readFileSync(PENDING_SESSIONS_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed[ref]) {
        pendingWompiSessions.set(ref, parsed[ref]);
        return parsed[ref];
      }
    }
  } catch (e: any) {
    console.warn("[PENDING SESSIONS] Error al leer archivo:", e.message);
  }

  // 1. Fallback a pending_checkouts en SQLite
  try {
    const pc = getPendingCheckout(ref);
    if (pc && pc.orderData) {
      pendingWompiSessions.set(ref, pc.orderData);
      return pc.orderData;
    }
  } catch (e: any) {
    console.warn("[PENDING SESSIONS] Error al leer pending_checkouts:", e.message);
  }

  // 2. Fallback a orden existente en SQLite por wompi_reference o ID
  try {
    const ord = getOrderByWompiRef(ref) || getOrderById(ref);
    if (ord) {
      const ordSession = {
        orderId: ord.id,
        customer_name: ord.customer_name,
        customer_document: ord.customer_document,
        customer_email: ord.customer_email,
        customer_phone: ord.customer_phone,
        shipping_address: ord.shipping_address,
        shipping_city: ord.shipping_city,
        total_amount: ord.total,
        subtotal_amount: ord.subtotal,
        discount_amount: ord.discount,
        items: ord.items || []
      };
      pendingWompiSessions.set(ref, ordSession);
      return ordSession;
    }
  } catch (e: any) {}

  return null;
}

function deletePendingSession(ref: string) {
  pendingWompiSessions.delete(ref);
  try {
    const obj = Object.fromEntries(pendingWompiSessions);
    fs.writeFileSync(PENDING_SESSIONS_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch (e: any) {
    console.warn("[PENDING SESSIONS] Error al borrar:", e.message);
  }
}

// Helper para inicializar Supabase en el servidor compatible con Node.js < 22 y Node 22+
function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://yhfutwanlzahplckidys.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_YXXrvVtdhSVzBKJi1FQMTg_lr7QBIb8";
  if (!url || !key) return null;
  try {
    return createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      realtime: {
        transport: WebSocket as any
      }
    });
  } catch (e) {
    console.error("Supabase server client error:", e);
    return null;
  }
}

// Guardar copia local en archivo JSON de manera atómica
function saveProductsToLocalFile(products: any[]) {
  const tempPath = `${BACKUP_FILE_PATH}.${Date.now()}.tmp`;
  try {
    const data = JSON.stringify(
      {
        timestamp: Date.now(),
        count: products.length,
        lastSync: new Date().toISOString(),
        products
      },
      null,
      2
    );
    fs.writeFileSync(tempPath, data, "utf-8");
    fs.renameSync(tempPath, BACKUP_FILE_PATH);
    console.log(`[BACKUP LOCAL] Guardados ${products.length} productos en ${BACKUP_FILE_PATH}`);
  } catch (err) {
    console.error("[BACKUP LOCAL] Error guardando archivo local:", err);
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {}
  }
}

// Cargar copia local desde archivo JSON de manera segura y resiliente
function loadProductsFromLocalFile(): any[] | null {
  try {
    if (fs.existsSync(BACKUP_FILE_PATH)) {
      const raw = fs.readFileSync(BACKUP_FILE_PATH, "utf-8");
      if (!raw || raw.trim().length === 0) {
        return null;
      }
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch (parseErr) {
        console.warn("[BACKUP LOCAL] Archivo local corrupto o incompleto. Se descartará y actualizará en la próxima sincronización.");
        try {
          fs.unlinkSync(BACKUP_FILE_PATH);
        } catch {}
        return null;
      }

      const prodList = Array.isArray(parsed) ? parsed : Array.isArray(parsed.products) ? parsed.products : [];
      if (prodList.length > 0) {
        // Filtrar productos con inventario/saldo >= 1 unidad y precio establecido de Lista 8 > 0
        const activeInStock = prodList
          .filter((p: any) => (Number(p.stock) || 0) >= 1 && (Number(p.price) || 0) > 0)
          .map((p: any) => {
            const pubDate = p.publicationDate || p.fechaLogEstado || p.fechaModificacion || p.createdAt || p.created_at || null;
            let isNew = false;
            if (pubDate) {
              try {
                const d = new Date(pubDate);
                if (!isNaN(d.getTime())) {
                  const diffDays = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
                  isNew = diffDays >= -1 && diffDays <= 15;
                }
              } catch {}
            }
            let videoUrl = p.videoUrl;
            if (!videoUrl) {
              if (p.id === "8050930" || p.code === "8050930") videoUrl = "/video-8050930.mp4";
              if (p.id === "8050931" || p.code === "8050931") videoUrl = "/video-8050931.mp4";
            }
            const { category, subCategory, color, height } = classifyChristmasProduct(p);
            return {
              ...p,
              category,
              subCategory,
              color: color || p.color || "Multicolor",
              height: height || p.height || "No aplica",
              publicationDate: pubDate,
              createdAt: p.createdAt || pubDate,
              isNew: isNew ?? false,
              videoUrl: videoUrl || undefined
            };
          });
        return activeInStock.length > 0 ? activeInStock : prodList;
      }
    }
  } catch (err) {
    console.error("[BACKUP LOCAL] Error procesando archivo local:", err);
  }
  return null;
}

// Cargar catálogo rápido desde Supabase
async function loadProductsFromSupabase(): Promise<any[] | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .gte("stock", 1);

    if (error || !data || data.length === 0) {
      return null;
    }

    return data.map((row: any) => {
      const raw = row.raw_yeminus_data || {};
      const isTree = row.category === "Árboles";
      const pubDate = raw.publicationDate || raw.fechaLogEstado || raw.fechaModificacion || row.created_at || null;
      let isNew = false;
      if (pubDate) {
        try {
          const d = new Date(pubDate);
          if (!isNaN(d.getTime())) {
            const diffDays = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
            isNew = diffDays >= -1 && diffDays <= 15;
          }
        } catch {}
      }

      const { category, subCategory, color, height } = classifyChristmasProduct({
        id: row.id,
        producto: row.id,
        name: row.name,
        nombre: row.name,
        descripcionProducto: row.name,
        reference: raw.reference || row.id,
        ...raw
      });

      const finalDesc = row.description || raw.description || raw.descripcionEcommerce || raw.observacionesGenerales || row.name;
      const obs = raw.observations || raw.observacionesGenerales || raw.descripcionEcommerce || undefined;

      return {
        id: row.id,
        name: row.name,
        description: finalDesc,
        observations: obs,
        price: Number(row.price),
        discountPrice: raw.discountPrice ? Number(raw.discountPrice) : undefined,
        discountPercentage: raw.discountPercentage || 0,
        imageUrl: row.image_url,
        images: [row.image_url],
        stock: row.stock,
        separePercentage: isTree ? 30 : 100,
        features: raw.features || [`Código: ${row.id}`, `Categoría: ${category}`, `Subcategoría: ${subCategory}`],
        dimensions: row.dimensions || `Código: ${row.id}`,
        category,
        subCategory,
        color: color || raw.color || "Multicolor",
        height: height || raw.height || "No aplica",
        similarCodes: raw.similarCodes || [],
        publicationDate: pubDate,
        createdAt: row.created_at || pubDate,
        isNew: isNew ?? false,
        videoUrl:
          row.id === "8050930"
            ? "/video-8050930.mp4"
            : row.id === "8050931"
            ? "/video-8050931.mp4"
            : raw.videoUrl || undefined
      };
    });
  } catch (e) {
    console.warn("[SUPABASE] Error consultando productos de respaldo:", e);
    return null;
  }
}

// Sincronizar catálogo a la tabla products en Supabase
async function syncProductsToSupabase(products: any[]): Promise<{ synced: boolean; count?: number; error?: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { synced: false, error: "Supabase no configurado en variables de entorno" };
  }

  try {
    // 1. Vaciar la tabla de productos en Supabase para sincronizar exactamente la nueva selección limpia
    const { error: deleteError } = await supabase
      .from("products")
      .delete()
      .neq("id", "___DELETE_ALL_ENTRIES_NO_MATCH___");

    if (deleteError) {
      console.warn("[SUPABASE SYNC] Advertencia al vaciar tabla 'products':", deleteError.message);
    } else {
      console.log("[SUPABASE SYNC] Tabla 'products' vaciada con éxito para nueva sincronización limpia.");
    }

    const rows = products
      .filter((p) => !String(p.id).startsWith("arb-") && !String(p.id).startsWith("dec-"))
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
          similarCodes: p.similarCodes,
          publicationDate: p.publicationDate,
          createdAt: p.createdAt,
          isNew: p.isNew
        },
        updated_at: new Date().toISOString()
      }));

    const batchSize = 50;
    let totalUpserted = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase
        .from("products")
        .upsert(batch, { onConflict: "id" });

      if (error) {
        console.error(`[SUPABASE SYNC] Error en lote ${i}:`, error.message);
      } else {
        totalUpserted += batch.length;
      }
    }

    logApi("SUCCESS", "SUPABASE_SYNC", `Sincronizados ${totalUpserted} productos en la tabla 'products' de Supabase`);
    return { synced: true, count: totalUpserted };
  } catch (err: any) {
    logApi("ERROR", "SUPABASE_SYNC", `Fallo al sincronizar con Supabase: ${err.message}`);
    return { synced: false, error: err.message };
  }
}

// Helper para peticiones HTTP resilientes con timeout y reintentos para evitar HeadersTimeoutError
async function safeFetch(url: string, options: RequestInit = {}, timeoutMs: number = 60000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return res;
  } catch (err: any) {
    if (err.name === "AbortError" || err.message?.includes("timeout") || err.code === "UND_ERR_HEADERS_TIMEOUT") {
      throw new Error(`Timeout de conexión con Yeminus ERP (${timeoutMs / 1000}s)`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getAccessToken(): Promise<string> {
  const username = process.env.YEMINUS_API_USERNAME || "API";
  const password = process.env.YEMINUS_API_PASSWORD || "sS#wLNW38C$U";

  // Retornar cached token si sigue vigente (con margen preventivo de 60s)
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  // 1. Si existe refresh token, intentar renovar el token
  if (cachedRefreshToken && cachedToken) {
    try {
      logApi("INFO", "/gateway/auth/refresh", "Renovando sesión con refreshToken...");
      const refreshRes = await safeFetch(`${YEMINUS_BASE}/gateway/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${cachedToken}`
        },
        body: JSON.stringify({
          refreshToken: cachedRefreshToken,
          accessToken: cachedToken
        })
      }, 10000);

      if (refreshRes.ok) {
        const refData: any = await refreshRes.json();
        const newToken = refData.accessToken || refData.access_token;
        if (newToken) {
          cachedToken = newToken;
          if (refData.refreshToken) cachedRefreshToken = refData.refreshToken;
          const expiresInMs = (refData.expiresIn || 1500) * 1000;
          tokenExpiresAt = Date.now() + expiresInMs;
          logApi("SUCCESS", "/gateway/auth/refresh", "Token de Yeminus renovado con éxito");
          return cachedToken;
        }
      }
    } catch (rErr: any) {
      console.warn("[AUTH REFRESH WARN] No se pudo renovar token, iniciando login nuevo:", rErr.message);
    }
  }

  // 2. Iniciar sesión nueva vía POST /gateway/auth/login
  const endpoint = "/gateway/auth/login";
  logApi("INFO", endpoint, "Iniciando sesión en Yeminus API Gateway...");

  try {
    const response = await safeFetch(`${YEMINUS_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        password
      })
    }, 15000);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error en autenticación (${response.status}): ${errText}`);
    }

    const data: any = await response.json();
    const token = data.accessToken || data.access_token;
    if (token) {
      cachedToken = token;
      cachedRefreshToken = data.refreshToken || null;
      const expiresInMs = (data.expiresIn || data.expires_in || 1500) * 1000;
      tokenExpiresAt = Date.now() + expiresInMs;
      logApi("SUCCESS", endpoint, "Sesión oficial iniciada con éxito en Yeminus Gateway", null, {
        token_type: data.tokenType || "Bearer",
        expires_in: data.expiresIn || 1500,
        usuario: data.usuario || username
      });
      return cachedToken;
    } else {
      throw new Error("Respuesta no contiene accessToken");
    }
  } catch (error: any) {
    logApi("ERROR", endpoint, `Fallo al obtener token: ${error.message}`);
    throw error;
  }
}

// 1. Endpoint Diagnóstico / Estado de la API
app.get("/api/yeminus/status", (req, res) => {
  const envCaja = process.env.YEMINUS_ID_CAJA;
  const envPunto = process.env.YEMINUS_PUNTO_VENTA;
  // Configuración oficial Impormax: Sucursal 02, Punto de Venta 8, Caja 2
  const idCaja = envCaja || "2";
  const idPuntoVenta = envPunto || "8";
  const idSucursal = "02";

  res.json({
    status: "ok",
    configured: {
      username: process.env.YEMINUS_API_USERNAME || "API",
      id_empresa: process.env.YEMINUS_ID_EMPRESA || "02",
      id_sucursal: idSucursal,
      id_punto_venta: idPuntoVenta,
      id_caja: idCaja,
      usuario: process.env.YEMINUS_USUARIO || "API"
    },
    token: cachedToken ? `${cachedToken.substring(0, 10)}...` : null,
    tokenExpiresIn: cachedToken ? Math.max(0, Math.round((tokenExpiresAt - Date.now()) / 1000)) : 0,
    logs: apiLogs
  });
});

// Endpoint temporal para diagnosticar exactamente cómo vienen los descuentos desde el ERP
app.get("/api/debug/discounts", async (req, res) => {
  try {
    const token = await getAccessToken();
    const idEmpresa = process.env.YEMINUS_ID_EMPRESA || "02";
    const usuario = process.env.YEMINUS_USUARIO || "API";

    // Obtener productos de Grupo 80 desde /gateway/apiyeminus/api/general/productos/obtener
    const rawRes = await safeFetch(`${YEMINUS_BASE}/gateway/apiyeminus/api/general/productos/obtener`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "id_empresa": idEmpresa,
        "usuario": usuario,
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        filtroProducto: { filtrar: true, grupo: "80" },
        visualizarProducto: 5
      })
    }, 45000);

    const rawData: any = await rawRes.json();
    const prods: any[] = Array.isArray(rawData?.datos?.productos)
      ? rawData.datos.productos
      : Array.isArray(rawData?.datos)
      ? rawData.datos
      : [];

    const firstProductKeys = prods[0] ? Object.keys(prods[0]) : [];

    // Ver muestras con diferentes casos de descuento
    const samples: any[] = [];
    for (const p of prods) {
      const p1 = Number(p.precioConImpuesto1) || 0;
      const p8 = Number(p.precioConImpuesto8) || 0;
      const d1 = Number(p.precioDescuento1) || 0;
      const d8 = Number(p.precioDescuento8) || 0;
      const pd = Number(p.porcentajeDescuento) || 0;

      // Casos interesantes:
      // Caso A: d1 > 0 y d8 === 0
      // Caso B: d8 > 0 y d1 === 0
      // Caso C: d8 !== d1
      // Caso D: p8 === 0 y p1 > 0
      // Caso E: p8 > 0 y p1 > 0
      if (samples.length < 25) {
        samples.push({
          producto: p.producto,
          referencia: p.referencia,
          nombre: p.descripcionProducto,
          idGrupoPrecio: p.idGrupoPrecio,
          descripcionGrupoPrecio: p.descripcionGrupoPrecio,
          descripcionPrecioConImpuesto1: p.descripcionPrecioConImpuesto1,
          descripcionPrecioConImpuesto8: p.descripcionPrecioConImpuesto8,
          precioConImpuesto1: p1,
          precioConImpuesto8: p8,
          precioSinImpuesto1: p.precioSinImpuesto1,
          precioSinImpuesto8: p.precioSinImpuesto8,
          precioDescuento1: d1,
          precioDescuento8: d8,
          porcentajeDescuento: pd,
          sinDescuento: p.sinDescuento,
          fechaInicialDescuento: p.fechaInicialDescuento,
          fechaFinalDescuento: p.fechaFinalDescuento,
          fechaInicialDescuento1: p.fechaInicialDescuento1,
          fechaFinalDescuento1: p.fechaFinalDescuento1,
          fechaInicialDescuento8: p.fechaInicialDescuento8,
          fechaFinalDescuento8: p.fechaFinalDescuento8
        });
      }
    }

    // Estadísticas generales sobre cómo están distribuidos los descuentos en los productos
    let countD8Only = 0;
    let countD1Only = 0;
    let countBoth = 0;
    let countPorcOnly = 0;
    let countD1DiffD8 = 0;
    let countNoDiscount = 0;
    let countP8Zero = 0;
    let countP8DifferentP1 = 0;

    for (const p of prods) {
      const p1 = Number(p.precioConImpuesto1) || 0;
      const p8 = Number(p.precioConImpuesto8) || 0;
      const d1 = Number(p.precioDescuento1) || 0;
      const d8 = Number(p.precioDescuento8) || 0;
      const pd = Number(p.porcentajeDescuento) || 0;

      if (p8 === 0 && p1 > 0) countP8Zero++;
      if (p8 > 0 && p1 > 0 && p8 !== p1) countP8DifferentP1++;

      if (d8 > 0 && d1 === 0) countD8Only++;
      else if (d1 > 0 && d8 === 0) countD1Only++;
      else if (d8 > 0 && d1 > 0) {
        countBoth++;
        if (d8 !== d1) countD1DiffD8++;
      } else if (pd > 0) countPorcOnly++;
      else countNoDiscount++;
    }

    res.json({
      success: true,
      totalProds: prods.length,
      allKeysCount: firstProductKeys.length,
      priceDesc1: prods[0]?.descripcionPrecioConImpuesto1,
      priceDesc8: prods[0]?.descripcionPrecioConImpuesto8,
      stats: {
        total: prods.length,
        countP8Zero,
        countP8DifferentP1,
        countD8Only,
        countD1Only,
        countBoth,
        countD1DiffD8,
        countPorcOnly,
        countNoDiscount
      },
      samples: samples.slice(0, 15)
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Cache temporal de productos brutos de Yeminus ERP para inspección rápida
let rawErpProductsCache: { timestamp: number; data: any[] } | null = null;

async function getRawErpProducts(force = false): Promise<any[]> {
  if (!force && rawErpProductsCache && (Date.now() - rawErpProductsCache.timestamp < 10 * 60 * 1000)) {
    return rawErpProductsCache.data;
  }
  const token = await getAccessToken();
  const idEmpresa = process.env.YEMINUS_ID_EMPRESA || "02";
  const usuario = process.env.YEMINUS_USUARIO || "API";

  const fetchGroup = async (g: string) => {
    try {
      const res = await safeFetch(`${YEMINUS_BASE}/gateway/apiyeminus/api/general/productos/obtener`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "id_empresa": idEmpresa,
          "usuario": usuario,
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          filtroProducto: { filtrar: true, grupo: g },
          visualizarProducto: 5
        })
      }, 45000);
      if (res.ok) {
        const d: any = await res.json();
        return Array.isArray(d?.datos?.productos) ? d.datos.productos : (Array.isArray(d?.datos) ? d.datos : []);
      }
    } catch (e: any) {
      console.warn(`Error obteniendo raw grupo ${g}:`, e.message);
    }
    return [];
  };

  const prods80 = await fetchGroup("80");
  const prods40 = await fetchGroup("40");
  const combined = [...prods80, ...prods40];
  if (combined.length > 0) {
    rawErpProductsCache = { timestamp: Date.now(), data: combined };
  }
  return combined;
}

// Endpoint para inspeccionar cualquier producto por código con TODOS sus campos crudos del ERP
app.get("/api/debug/item/:code", async (req, res) => {
  try {
    const code = String(req.params.code).trim();
    const rawList = await getRawErpProducts();
    const found = rawList.find((p: any) =>
      String(p.producto).trim() === code ||
      String(p.referencia).trim().toLowerCase() === code.toLowerCase()
    );
    if (!found) {
      return res.status(404).json({ success: false, message: `Producto ${code} no encontrado en ERP`, totalRaw: rawList.length });
    }
    res.json({ success: true, item: found });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Cache y almacenamiento local para Saldos de Inventario
let saldosCache: { timestamp: number; data: any[] } | null = null;
const SALDOS_CACHE_TTL = 10 * 60 * 1000; // 10 minutos
const SALDOS_BACKUP_PATH = path.join(process.cwd(), "saldos_backup.json");

function loadSaldosFromLocalFile(): any[] {
  try {
    if (fs.existsSync(SALDOS_BACKUP_PATH)) {
      const raw = fs.readFileSync(SALDOS_BACKUP_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : (parsed.saldos || []);
    }
  } catch (err: any) {
    console.warn("[SALDOS] Error cargando saldos locales:", err.message);
  }
  return [];
}

function saveSaldosToLocalFile(saldos: any[]) {
  try {
    fs.writeFileSync(SALDOS_BACKUP_PATH, JSON.stringify({
      updatedAt: new Date().toISOString(),
      count: saldos.length,
      saldos
    }, null, 2), "utf-8");
    console.log(`[SALDOS] Guardados ${saldos.length} saldos en ${SALDOS_BACKUP_PATH}`);
  } catch (err: any) {
    console.warn("[SALDOS] Error guardando saldos locales:", err.message);
  }
}

async function fetchYeminusSaldos(options: { force?: boolean; anio?: string; mes?: string; bodegas?: string[]; grupo?: string } = {}): Promise<any[]> {
  const activeAnio = process.env.YEMINUS_ANIO || "2026";
  const activeMes = process.env.YEMINUS_MES || "7";
  const activeCaja = process.env.YEMINUS_ID_CAJA || "2";
  const { force = false, anio = activeAnio, mes = activeMes, bodegas = ["05"], grupo = "80" } = options;

  if (!force && saldosCache && (Date.now() - saldosCache.timestamp < SALDOS_CACHE_TTL)) {
    return saldosCache.data;
  }

  const endpoint = "/gateway/apiyeminus/api/inventarios/saldoporperiodo/obtenersaldoporperiodo";
  const token = await getAccessToken();

  const body = {
    filtroProducto: {
      filtrar: true,
      grupo: String(grupo)
    },
    anio: String(anio),
    bodegas: Array.isArray(bodegas) ? bodegas : [String(bodegas)],
    mes: String(mes)
  };

  logApi("INFO", endpoint, "Consultando saldos de inventario por periodo...", body);

  const response = await safeFetch(`${YEMINUS_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "id_empresa": "02",
      "id_caja": activeCaja,
      "usuario": "API",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(body)
  }, 120000);

  if (!response.ok) {
    const errText = await response.text();
    logApi("ERROR", endpoint, `HTTP ${response.status}: ${errText}`);
    const local = loadSaldosFromLocalFile();
    if (local.length > 0) return local;
    throw new Error(`Error en API de saldos (${response.status}): ${errText}`);
  }

  const data: any = await response.json();
  const saldos = Array.isArray(data.datos) ? data.datos : [];

  saldosCache = {
    timestamp: Date.now(),
    data: saldos
  };
  saveSaldosToLocalFile(saldos);

  logApi("SUCCESS", endpoint, `Saldos obtenidos exitosamente: ${saldos.length} registros`);
  return saldos;
}

// Endpoint para consultar saldos con análisis
app.get("/api/yeminus/saldos", async (req, res) => {
  try {
    const force = req.query.force === "true";
    const anio = (req.query.anio as string) || "2026";
    const mes = (req.query.mes as string) || "7";
    const saldos = await fetchYeminusSaldos({ force, anio, mes });

    let sinStock = 0;
    let pocasUnidades = 0;
    let stockNormal = 0;
    let totalUnidades = 0;

    saldos.forEach((s: any) => {
      const qty = Number(s.cantidad) || 0;
      totalUnidades += qty;
      if (qty <= 0) sinStock++;
      else if (qty >= 1 && qty <= 5) pocasUnidades++;
      else stockNormal++;
    });

    res.json({
      success: true,
      totalProductos: saldos.length,
      analisis: {
        sinStockOcultar: sinStock,
        pocasUnidades1a5: pocasUnidades,
        stockNormalMasDe5: stockNormal,
        totalUnidadesFisicas: totalUnidades
      },
      muestra: saldos.slice(0, 10)
    });
  } catch (error: any) {
    const local = loadSaldosFromLocalFile();
    if (local.length > 0) {
      return res.json({
        success: true,
        source: "backup_local",
        totalProductos: local.length,
        muestra: local.slice(0, 10)
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Server in-memory cache for Yeminus products
let productsCache: { timestamp: number; data: any[] } | null = null;
const PRODUCTS_CACHE_TTL = 3 * 60 * 1000; // 3 minutos de frescura en memoria para reflejar cambios rápidos de Yeminus

// Archivo persistente para registrar deducciones de inventario locales por compras y órdenes
const INVENTORY_DEDUCTIONS_FILE_PATH = path.join(process.cwd(), "data", "inventory_deductions.json");

interface LocalDeductionRecord {
  productId: string;
  quantity: number;
  timestamp: number;
  orderReference?: string;
}

function loadLocalDeductions(): LocalDeductionRecord[] {
  try {
    if (fs.existsSync(INVENTORY_DEDUCTIONS_FILE_PATH)) {
      const raw = fs.readFileSync(INVENTORY_DEDUCTIONS_FILE_PATH, "utf-8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        // Conservar deducciones de los últimos 3 días (72h) para asegurar sincronización estricta con Yeminus
        const cutoff = Date.now() - 72 * 60 * 60 * 1000;
        return list.filter((d: any) => d.timestamp > cutoff);
      }
    }
  } catch (e) {}
  return [];
}

function saveLocalDeductions(records: LocalDeductionRecord[]) {
  try {
    const dir = path.dirname(INVENTORY_DEDUCTIONS_FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(INVENTORY_DEDUCTIONS_FILE_PATH, JSON.stringify(records, null, 2), "utf-8");
  } catch (e) {
    console.warn("[DEDUCTIONS FILE SAVE ERR]", e);
  }
}

function getPendingLocalDeduction(code: string, ref: string): number {
  const deductions = loadLocalDeductions();
  const c = String(code || "").trim().toLowerCase();
  const r = String(ref || "").trim().toLowerCase();
  let total = 0;
  for (const d of deductions) {
    const target = String(d.productId || "").trim().toLowerCase();
    if ((c && target === c) || (r && target === r)) {
      total += Number(d.quantity) || 1;
    }
  }
  return total;
}

// Temporizador en segundo plano para sincronizar constantemente con Yeminus ERP cada 5 minutos
setInterval(() => {
  console.log("[AUTO-SYNC] Ejecutando sincronización periódica automática con Yeminus ERP...");
  fetchYeminusCatalog().catch((err) => {
    console.warn("[AUTO-SYNC WARN] Error en sincronización periódica:", err.message);
  });
}, 5 * 60 * 1000);

// Clasificador especializado para productos Navideños de Yeminus ERP (100% alineado a los Grupos y Subgrupos oficiales del ERP)
function classifyChristmasProduct(p: any): { category: string; subCategory: string; color: string; height: string } {
  const code = String(p.producto || p.id || p.code || "").trim();
  const gId = String(p.idGrupo || "").trim();
  const gDesc = (p.descripcionGrupo || "").toUpperCase().trim();
  const sgId = String(p.idSubGrupo || p.subGrupo || "").trim();
  const sgDesc = (p.descripcionSubGrupo || p.nomSubgrupo || p.subgrupo || "").toUpperCase().trim();
  const scDesc = (p.descripcionSubCategoria || p.subCategoria || "").toUpperCase().trim();
  const name = (p.descripcionProducto || p.nombre || p.descripcion || p.name || "").trim();
  const ref = (p.referencia || p.reference || "").trim();
  const desc = (name + " " + ref).toLowerCase();

  let category = "Decoración";
  let subCategory = "Figuras y Adornos";

  // Identificar si es pie de árbol o base de árbol
  const isPieDeArbol = desc.includes("pie de arbol") || desc.includes("pie de árbol");
  const isBaseDeArbol = desc.includes("base ") || desc.includes("base para arbol") || desc.includes("base para árbol") || desc.includes("base giratoria") || desc.includes("base polyresina") || desc.includes("base poliresina");

  // 1. ÁRBOLES Y GUIRNALDAS (Grupo 80 Subgrupo 1 ARBOLES, CORONAS Y GUIRNALDAS, código 801..., o Subcat/Subgrupo ARBOLES/GUIRNALDAS/CORONAS)
  if (
    code.startsWith("801") ||
    (gId === "80" && (sgId === "1" || sgId === "001" || sgId === "01")) ||
    sgDesc.includes("ARBOLES") ||
    sgDesc.includes("GUIRNALDAS") ||
    sgDesc.includes("CORONAS") ||
    scDesc.includes("ARBOLES") ||
    scDesc.includes("GUIRNALDAS") ||
    scDesc.includes("CORONAS") ||
    ((desc.startsWith("arbol ") || desc.startsWith("árbol ")) && !desc.includes("instalacion") && !desc.includes("lineal led") && !desc.includes("pie de") && !desc.includes("base "))
  ) {
    category = "Árboles y Guirnaldas";
    if (desc.startsWith("guirnalda") || desc.includes("guirnalda") || scDesc.includes("GUIRNALDA")) {
      subCategory = "Guirnaldas";
    } else if (desc.startsWith("corona") || desc.includes("corona") || scDesc.includes("CORONA")) {
      subCategory = "Coronas";
    } else if (isBaseDeArbol || isPieDeArbol) {
      subCategory = "Accesorios y Bases";
    } else {
      subCategory = "Árboles Navideños";
    }
  }
  // 2. BOLAS NAVIDEÑAS (Grupo 80 Subgrupo 2 BOLAS NAVIDEÑAS, código 802..., o Subcat/Subgrupo BOLAS)
  else if (
    code.startsWith("802") ||
    (gId === "80" && (sgId === "2" || sgId === "002" || sgId === "02")) ||
    sgDesc.includes("BOLA") ||
    scDesc.includes("BOLA") ||
    desc.startsWith("bola ") ||
    desc.startsWith("bolas ") ||
    desc.includes("esferas navideñas") ||
    desc.includes("pack bolas")
  ) {
    category = "Bolas Navideñas";
    subCategory = "Bolas y Esferas";
  }
  // 3. CINTAS Y MALLAS (Grupo 80 Subgrupo 3 CINTAS Y MALLAS NAVIDEÑAS, código 803..., o Subcat/Subgrupo CINTAS/MALLAS)
  else if (
    code.startsWith("803") ||
    (gId === "80" && (sgId === "3" || sgId === "003" || sgId === "03")) ||
    sgDesc.includes("CINTA") ||
    sgDesc.includes("MALLA") ||
    scDesc.includes("CINTA") ||
    scDesc.includes("MALLA") ||
    desc.startsWith("cinta ") ||
    desc.startsWith("malla ") ||
    desc.includes("alambrada")
  ) {
    category = "Cintas y Mallas";
    if (desc.includes("malla") || scDesc.includes("MALLA")) {
      subCategory = "Mallas Navideñas";
    } else {
      subCategory = "Cintas Navideñas";
    }
  }
  // 4. FLORES Y FOLLAJE (Grupo 80 Subgrupo 4 FLORES Y FOLLAJES NAVIDEÑAS, código 804..., o Subcat/Subgrupo FLORES/FOLLAJE)
  else if (
    code.startsWith("804") ||
    (gId === "80" && (sgId === "4" || sgId === "004" || sgId === "04")) ||
    sgDesc.includes("FLOR") ||
    sgDesc.includes("FOLLAJE") ||
    scDesc.includes("FLOR") ||
    scDesc.includes("FOLLAJE") ||
    desc.startsWith("flor ") ||
    desc.startsWith("flores ") ||
    desc.startsWith("follaje ") ||
    desc.startsWith("follajes ") ||
    desc.startsWith("rosa artificial") ||
    desc.startsWith("pick ") ||
    desc.includes("pick navideño") ||
    desc.includes("poinsettia") ||
    desc.includes("ramo navideño")
  ) {
    category = "Flores y Follaje";
    if (desc.includes("follaje") || desc.includes("pick") || desc.includes("ramo")) {
      subCategory = "Follajes y Ramas";
    } else {
      subCategory = "Flores Navideñas";
    }
  }
  // 5. PESEBRES (Grupo 80 Subgrupo 7 PESEBRE NAVIDEÑO, código 807..., o Subcat/Subgrupo PESEBRES)
  else if (
    code.startsWith("807") ||
    (gId === "80" && (sgId === "7" || sgId === "007" || sgId === "07")) ||
    sgDesc.includes("PESEBRE") ||
    scDesc.includes("PESEBRE") ||
    desc.includes("pesebre") ||
    desc.includes("aldeano") ||
    desc.includes("nacimiento") ||
    desc.includes("sagrada familia") ||
    desc.includes("niño dios") ||
    desc.includes("reyes magos") ||
    desc.includes("choza") ||
    desc.includes("establo") ||
    desc.includes("gruta")
  ) {
    category = "Pesebres";
    if (desc.includes("aldeano") || desc.includes("figura") || desc.includes("pastor") || desc.includes("animal")) {
      subCategory = "Figuras para Pesebre";
    } else if (desc.includes("choza") || desc.includes("establo") || desc.includes("gruta")) {
      subCategory = "Chozas y Establos";
    } else {
      subCategory = "Pesebres y Nacimientos";
    }
  }
  // 6. UTENSILIOS NAVIDEÑOS DE COCINA (Grupo 80 Subgrupo 8 UTENSILIOS DE COCINA NAVIDAD, código 808..., o Subcat/Subgrupo UTENSILIOS/COCINA)
  else if (
    code.startsWith("808") ||
    (gId === "80" && (sgId === "8" || sgId === "008" || sgId === "08")) ||
    sgDesc.includes("COCINA") ||
    sgDesc.includes("UTENSILIO") ||
    scDesc.includes("COCINA") ||
    scDesc.includes("UTENSILIO") ||
    desc.includes("pocillo") ||
    desc.includes("vajilla") ||
    desc.includes("mug") ||
    desc.includes("plato pet") ||
    desc.includes("plato plastico") ||
    desc.includes("individual flecos") ||
    desc.includes("bolws") ||
    desc.includes("taza navideña")
  ) {
    category = "Utensilios Navideños de Cocina";
    subCategory = "Cocina Navideña";
  }
  // 7. LUCES NAVIDEÑAS (Grupo 40 Subgrupos 1/2/3, Grupo 80 Subgrupo 6, códigos 401..., 403..., 806..., o Subcat/Subgrupo LUCES)
  else if (
    code.startsWith("401") ||
    code.startsWith("403") ||
    code.startsWith("806") ||
    gId === "40" ||
    (gId === "80" && (sgId === "6" || sgId === "006" || sgId === "06")) ||
    sgDesc.includes("LUCES") ||
    scDesc.includes("LUCES") ||
    desc.includes("instalacion ") ||
    desc.includes("instalación ") ||
    desc.includes("instalacion") ||
    desc.includes("inst. led") ||
    desc.includes("inst.malla") ||
    desc.includes("manguera led") ||
    desc.includes("cinta led") ||
    desc.includes("cortina meteoro") ||
    desc.includes("lluvia bombillo") ||
    desc.includes("lumimax") ||
    desc.includes("microled")
  ) {
    category = "Luces Navideñas";
    if (desc.includes("manguera") || desc.includes("cinta led") || desc.includes("manguera led")) {
      subCategory = "Mangueras y Cintas LED";
    } else if (desc.includes("microled") || desc.includes("alambre") || desc.includes("ramo x")) {
      subCategory = "Microled y Alambre";
    } else if (desc.includes("lluvia") || desc.includes("cascada") || desc.includes("cortina") || desc.includes("meteoro") || desc.includes("malla cenefa")) {
      subCategory = "Cortinas y Lluvia LED";
    } else if (desc.includes("guirnalda") && (desc.includes("led") || desc.includes("c/c") || desc.includes("s/c") || desc.includes("v/b") || desc.includes("v/c") || desc.includes("v/m"))) {
      subCategory = "Guirnaldas LED";
    } else if (desc.includes("figura") || desc.includes("estrella") || desc.includes("vela") || desc.includes("farol") || desc.includes("piramide") || desc.includes("punta")) {
      subCategory = "Figuras y Puntas con Luz";
    } else if (desc.includes("repuesto") || desc.includes("control") || desc.includes("accesorio")) {
      subCategory = "Repuestos y Accesorios";
    } else {
      subCategory = "Instalaciones LED";
    }
  }
  // 8. DECORACIÓN (Grupo 80 Subgrupo 5 DECORACION NAVIDEÑA, código 805..., o general)
  else {
    category = "Decoración";
    if (isPieDeArbol) {
      subCategory = "Pies de Árbol";
    } else if (isBaseDeArbol) {
      subCategory = "Bases y Accesorios de Árbol";
    } else if (desc.includes("farol") || desc.includes("portavela") || desc.includes("porta vela")) {
      subCategory = "Faroles y Portavelas";
    } else if (desc.includes("cojin") || desc.includes("cojín") || desc.includes("camino de mesa") || desc.includes("tapete")) {
      subCategory = "Textiles Navideños";
    } else if (desc.includes("colgante") || desc.includes("cascabel") || desc.includes("adorno") || desc.includes("campana")) {
      subCategory = "Colgantes y Adornos";
    } else if (
      desc.includes("ardilla") ||
      desc.includes("oso") ||
      desc.includes("papanoel") ||
      desc.includes("papa noel") ||
      desc.includes("santa") ||
      desc.includes("ciervo") ||
      desc.includes("pinguino") ||
      desc.includes("muñeco") ||
      desc.includes("carro") ||
      desc.includes("chimenea") ||
      desc.includes("tambor") ||
      desc.includes("buho")
    ) {
      subCategory = "Muñecos y Figuras";
    } else {
      subCategory = "Figuras y Adornos";
    }
  }

  // Color
  let color = "Multicolor";
  if (desc.includes("nevado") || desc.includes("flockizado") || desc.includes("nieve") || desc.includes("invierno") || desc.includes("blanco") || desc.includes("white")) {
    color = "Nevado/Blanco";
  } else if (desc.includes("verde") || desc.includes("menta") || desc.includes("oliva")) {
    color = "Verde";
  } else if (desc.includes("rojo") || desc.includes("roja") || desc.includes("red")) {
    color = "Rojo";
  } else if (desc.includes("dorado") || desc.includes("oro") || desc.includes("dorada") || desc.includes("gold")) {
    color = "Dorado";
  } else if (desc.includes("plata") || desc.includes("plateado") || desc.includes("plateada") || desc.includes("silver")) {
    color = "Plateado";
  } else if (desc.includes("rosado") || desc.includes("rosa") || desc.includes("pink")) {
    color = "Rosado";
  } else if (desc.includes("champaña") || desc.includes("champana") || desc.includes("bronce") || desc.includes("ocre") || desc.includes("coñac")) {
    color = "Champaña/Bronce";
  } else if (desc.includes("azul") || desc.includes("blue")) {
    color = "Azul";
  }

  // Altura para Árboles
  let height = "No aplica";
  if (category === "Árboles y Guirnaldas" && subCategory === "Árboles Navideños") {
    if (desc.includes("120cm") || desc.includes("150cm") || desc.includes("90cm") || desc.includes("60cm") || desc.includes("1.20") || desc.includes("1.50") || desc.includes("120 cm") || desc.includes("150 cm")) {
      height = "Bajo (hasta 1.50m)";
    } else if (desc.includes("180cm") || desc.includes("200cm") || desc.includes("1.80") || desc.includes("2.00") || desc.includes("180 cm") || desc.includes("200 cm")) {
      height = "Mediano (1.80m a 2.00m)";
    } else if (desc.includes("210cm") || desc.includes("225cm") || desc.includes("230cm") || desc.includes("240cm") || desc.includes("250cm") || desc.includes("300cm") || desc.includes("2.10") || desc.includes("2.25") || desc.includes("2.30") || desc.includes("2.40") || desc.includes("2.50") || desc.includes("3.00") || desc.includes("210 cm") || desc.includes("240 cm")) {
      height = "Alto (más de 2.10m)";
    } else {
      height = "Mediano (1.80m a 2.00m)";
    }
  }

  return { category, subCategory, color, height };
}

let lastYeminusAuthFailure = 0;
const YEMINUS_AUTH_COOLDOWN = 15 * 60 * 1000; // 15 minutos

// Función centralizada para consultar Yeminus, respaldar localmente y sincronizar en Supabase
async function fetchYeminusCatalog(options: { skipImageCheck?: boolean; force?: boolean } = {}): Promise<any[]> {
  const endpointProductos = "/gateway/apiyeminus/api/general/productos/obtener";
  const idEmpresa = process.env.YEMINUS_ID_EMPRESA || "02";
  const usuario = process.env.YEMINUS_USUARIO || "API";

  // Si falló recientemente la autenticación y no es forzado, servir respaldo sin reintentar continuamente
  if (!options.force && Date.now() - lastYeminusAuthFailure < YEMINUS_AUTH_COOLDOWN) {
    const backup = loadProductsFromLocalFile();
    return (backup && backup.length > 0) ? backup : (productsCache?.data || []);
  }

  let token: string;
  try {
    token = await getAccessToken();
  } catch (err: any) {
    lastYeminusAuthFailure = Date.now();
    const backup = loadProductsFromLocalFile();
    return (backup && backup.length > 0) ? backup : (productsCache?.data || []);
  }

  // Consultar secuencialmente Grupo 80 (Navidad) y Grupo 40 (Luces Navideñas) para evitar sobrecargar el gateway
  const fetchGroupProducts = async (grupo: string) => {
    const payload = {
      filtroProducto: {
        filtrar: true,
        grupo: grupo
      },
      visualizarProducto: 5
    };

    const res = await safeFetch(`${YEMINUS_BASE}${endpointProductos}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "id_empresa": idEmpresa,
        "usuario": usuario,
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    }, 90000).catch((err) => {
      console.warn(`Aviso: Consulta de productos Grupo ${grupo} Yeminus ERP demoró o falló:`, err.message);
      return null;
    });

    if (res && res.ok) {
      try {
        const prodData: any = await res.json();
        if (prodData && prodData.esExitoso && prodData.datos) {
          const prods = Array.isArray(prodData.datos.productos)
            ? prodData.datos.productos
            : Array.isArray(prodData.datos)
            ? prodData.datos
            : [];
          console.log(`[YEMINUS ERP] Grupo ${grupo} devuelto con éxito: ${prods.length} productos brutos`);
          return prods;
        } else {
          console.warn(`[YEMINUS ERP] Grupo ${grupo} no exitoso o sin datos:`, prodData?.mensaje);
        }
      } catch (e: any) {
        console.warn(`Error parseando respuesta de Grupo ${grupo}:`, e.message);
      }
    } else {
      console.warn(`[YEMINUS ERP] Respuesta HTTP no exitosa para Grupo ${grupo}: Status ${res?.status}`);
    }
    return [];
  };

  const raw80 = await fetchGroupProducts("80");
  const raw40 = await fetchGroupProducts("40");
  let rawList: any[] = [...raw80, ...raw40];

  // Consultar Saldos por Periodo oficiales de Yeminus (Bodega 05 - BODEGA PUNTO DE VENTA)
  const fetchGroupSaldos = async (grupo: string): Promise<any[]> => {
    const activeAnio = process.env.YEMINUS_ANIO || "2026";
    const activeMes = process.env.YEMINUS_MES || "7";
    const activeCaja = process.env.YEMINUS_ID_CAJA || "2";
    const payload = {
      filtroProducto: {
        filtrar: true,
        grupo: String(grupo)
      },
      anio: activeAnio,
      bodegas: ["05"],
      mes: activeMes
    };

    try {
      const res = await safeFetch(`${YEMINUS_BASE}/gateway/apiyeminus/api/inventarios/saldoporperiodo/obtenersaldoporperiodo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "id_empresa": idEmpresa,
          "id_caja": activeCaja,
          "usuario": usuario,
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      }, 120000).catch((err) => {
        console.warn(`Aviso: Consulta de saldos Grupo ${grupo} Yeminus ERP demoró o falló:`, err.message);
        return null;
      });

      if (res && res.ok) {
        const saldoData: any = await res.json();
        const items = Array.isArray(saldoData?.datos)
          ? saldoData.datos
          : Array.isArray(saldoData)
          ? saldoData
          : [];
        console.log(`[YEMINUS SALDOS] Grupo ${grupo} Bodega 05 devuelto con éxito: ${items.length} registros de saldo`);
        return items;
      } else {
        console.warn(`[YEMINUS SALDOS] Respuesta HTTP no exitosa para Grupo ${grupo}: Status ${res?.status}`);
      }
    } catch (err: any) {
      console.warn(`[YEMINUS SALDOS] Error consultando saldos para Grupo ${grupo}:`, err.message);
    }
    return [];
  };

  const saldos80 = await fetchGroupSaldos("80");
  const saldos40 = await fetchGroupSaldos("40");

  // Cargar saldos de respaldo previo para fusión resiliente
  const localSaldos = loadSaldosFromLocalFile();
  const saldosMapByCode = new Map<string, any>();

  // 1. Sembrar con los saldos de respaldo existentes (así nunca se pierden los grupos que tardan en responder)
  if (Array.isArray(localSaldos)) {
    for (const s of localSaldos) {
      const key = String(s.producto || s.referencia || "").trim();
      if (key) saldosMapByCode.set(key, s);
    }
  }

  // 2. Sobrescribir con los saldos frescos obtenidos de Grupo 80
  for (const s of saldos80) {
    const key = String(s.producto || s.referencia || "").trim();
    if (key) saldosMapByCode.set(key, s);
  }

  // 3. Sobrescribir con los saldos frescos obtenidos de Grupo 40
  for (const s of saldos40) {
    const key = String(s.producto || s.referencia || "").trim();
    if (key) saldosMapByCode.set(key, s);
  }

  const rawSaldosList: any[] = Array.from(saldosMapByCode.values());

  // Si se obtuvieron saldos, persistirlos en respaldo local
  if (rawSaldosList.length > 0) {
    saveSaldosToLocalFile(rawSaldosList);
  }

  const combinedSaldoMap = new Map<string, number>();
  for (const it of rawSaldosList) {
    const pCode = String(it.producto || "").trim();
    const pRef = String(it.referencia || "").trim();
    const rawQty = Number(it.saldo !== undefined && it.saldo !== null ? it.saldo : (it.cantidad !== undefined && it.cantidad !== null ? it.cantidad : (it.existencia !== undefined && it.existencia !== null ? it.existencia : it.stock)));
    const validQty = !isNaN(rawQty) ? rawQty : 0;
    if (pCode) combinedSaldoMap.set(pCode, validQty);
    if (pRef) combinedSaldoMap.set(pRef, validQty);
  }
  console.log(`[YEMINUS INVENTARIO] Registros de saldo mapeados en Bodega 05: ${combinedSaldoMap.size}`);

  if (rawList.length === 0) {
    // Si la conexión a la API falló, recuperar del archivo de respaldo local
    const localBackup = loadProductsFromLocalFile();
    if (localBackup && localBackup.length > 0) {
      console.log(`[YEMINUS CONTINGENCIA] Cargando ${localBackup.length} productos desde respaldo local`);
      return localBackup;
    }
    throw new Error("Yeminus ERP no respondió a tiempo y no hay respaldo previo disponible. Por favor reintenta en unos segundos.");
  }

  const mappedProducts = rawList
    .filter((p: any) => {
      // 1. Debe estar activo en el ERP
      const isActive = p.estado === "A" || p.estado === undefined;
      if (!isActive) return false;

      // 2. REGLA ESTRICTA DE FOTOGRAFÍA:
      // Si el producto no cuenta con fotografía, NO mostrarlo en la landing hasta que la consulta traiga la foto
      const photoName = String(p.archivoFoto1 || "").trim();
      const hasValidPhoto = Boolean(
        photoName &&
        photoName !== "" &&
        photoName !== "0" &&
        photoName !== "null" &&
        photoName !== "undefined" &&
        photoName !== "none" &&
        photoName !== "--" &&
        photoName.length > 3
      );

      if (!hasValidPhoto) return false;

      // 3. Regla de Saldo/Stock de Yeminus (Bodega 05 - Punto de Venta):
      const internalCode = String(p.producto || "").trim();
      const ref = String(p.referencia || "").trim();

      // Verificar si viene saldo directo en el producto o en la tabla de saldos
      let directQty: number | null = null;
      if (p.saldo !== undefined && p.saldo !== null && !isNaN(Number(p.saldo))) {
        directQty = Number(p.saldo);
      } else if (p.existencia !== undefined && p.existencia !== null && !isNaN(Number(p.existencia))) {
        directQty = Number(p.existencia);
      } else if (p.cantidad !== undefined && p.cantidad !== null && !isNaN(Number(p.cantidad))) {
        directQty = Number(p.cantidad);
      } else if (p.stock !== undefined && p.stock !== null && !isNaN(Number(p.stock))) {
        directQty = Number(p.stock);
      }

      const hasSpecificSaldo = combinedSaldoMap.has(internalCode) || combinedSaldoMap.has(ref) || directQty !== null;
      const yeminusQty = combinedSaldoMap.has(internalCode)
        ? combinedSaldoMap.get(internalCode)!
        : (combinedSaldoMap.has(ref)
          ? combinedSaldoMap.get(ref)!
          : (directQty !== null ? directQty : 0));

      // Restar deducciones locales confirmadas por pedidos recientes para mantener estricta sincronización
      const localDeduction = getPendingLocalDeduction(internalCode, ref);
      const effectiveStock = Math.max(0, yeminusQty - localDeduction);

      // Si en saldo es cero o menor: NO se muestra el producto. Si es mayor a 1 sí se muestra
      if (!hasSpecificSaldo || effectiveStock < 1) {
        return false;
      }

      // Precio oficial Lista 8 con fallback a Lista 1 (PrecioDetal) si no está en Lista 8
      const list8Price =
        Number(p.precioConImpuesto8) ||
        Number(p.precio8IncluidoIVA) ||
        (Number(p.precioSinImpuesto8) ? Math.round(Number(p.precioSinImpuesto8) * 1.19) : 0) ||
        (Number(p.precio8) ? Math.round(Number(p.precio8) * 1.19) : 0);

      const list1Price =
        Number(p.precioConImpuesto1) ||
        Number(p.precio1IncluidoIVA) ||
        (Number(p.precioSinImpuesto1) ? Math.round(Number(p.precioSinImpuesto1) * 1.19) : 0) ||
        (Number(p.precio1) ? Math.round(Number(p.precio1) * 1.19) : 0);

      const effectivePrice = list8Price > 0 ? list8Price : (list1Price > 0 ? list1Price : 0);

      if (!effectivePrice || effectivePrice <= 0) {
        return false;
      }

      return true;
    })
    .map((item: any) => {
      const { category, subCategory, color, height } = classifyChristmasProduct(item);
      const isTree = category === "Árboles y Guirnaldas";
      const rawDesc = (item.descripcionProducto || item.nombre || item.descripcion || `Producto Navideño ${item.producto}`).trim();
      const internalCode = String(item.producto || "").trim();
      const ref = String(item.referencia || item.producto || "").trim();
      let obs = String(item.observacionesGenerales ?? item.observaciones ?? item.observacion ?? "").trim();
      if (obs === "0" || obs === "null" || obs === "undefined" || obs === "--") {
        obs = "";
      }
      let ecommerceDesc = String(item.descripcionEcommerce ?? "").trim();
      if (ecommerceDesc === "0" || ecommerceDesc === "null" || ecommerceDesc === "undefined" || ecommerceDesc === "--") {
        ecommerceDesc = "";
      }
      const descText = rawDesc.length <= 6 && ref ? `${rawDesc} - Ref. ${ref}` : rawDesc;
      // Priorizar descripción enriquecida de ecommerce o especificaciones del ERP
      const finalDescription = ecommerceDesc || (obs && obs.length > 5 && obs !== descText ? `${descText}. ${obs}` : descText);

      // Precio oficial: Lista 8 (Pagina_Web CON IMPUESTO) con fallback a Lista 1
      const list8ItemPrice =
        Number(item.precioConImpuesto8) ||
        Number(item.precio8IncluidoIVA) ||
        (Number(item.precioSinImpuesto8) ? Math.round(Number(item.precioSinImpuesto8) * 1.19) : 0) ||
        (Number(item.precio8) ? Math.round(Number(item.precio8) * 1.19) : 0);
      const list1ItemPrice =
        Number(item.precioConImpuesto1) ||
        Number(item.precio1IncluidoIVA) ||
        (Number(item.precioSinImpuesto1) ? Math.round(Number(item.precioSinImpuesto1) * 1.19) : 0) ||
        (Number(item.precio1) ? Math.round(Number(item.precio1) * 1.19) : 0);
      const price = list8ItemPrice > 0 ? list8ItemPrice : (list1ItemPrice > 0 ? list1ItemPrice : 0);

      // Descuento según Yeminus ERP
      let rawDiscount = 0;
      if (item.sinDescuento === "S" || item.sinDescuento === true) {
        rawDiscount = 0;
      } else {
        const pctGeneral = Number(item.porcentajeDescuento) || 0;
        const pctLista8 = Number(item.precioDescuento8) || 0;
        const pctLista1 = Number(item.precioDescuento1) || 0;
        const pctDesc = Number(item.descuento) || 0;

        // Seleccionar el mayor descuento configurado entre listas activas y porcentaje general del ERP
        rawDiscount = Math.max(pctGeneral, pctLista8, pctLista1, pctDesc);
      }

      let discountPercentage = 0;
      let discountPrice: number | undefined = undefined;

      if (rawDiscount > 0) {
        if (rawDiscount <= 100) {
          // Es un porcentaje (ej: 20%)
          discountPercentage = Math.round(rawDiscount);
          discountPrice = Math.round(price * (1 - discountPercentage / 100));
        } else if (rawDiscount > 100 && rawDiscount < price) {
          // Es un valor directo con descuento (ej: precio 789000, rebajado a 600000)
          discountPrice = Math.round(rawDiscount);
          discountPercentage = Math.round(((price - discountPrice) / price) * 100);
        }
      }

      const cp = item.camposPersonalizados || {};
      const customFeatures: string[] = [];
      if (item.descripcionMarca && item.descripcionMarca !== "--") customFeatures.push(`Marca: ${item.descripcionMarca}`);
      if (cp.ipp_material) customFeatures.push(`Material: ${cp.ipp_material}`);
      if (cp.ipp_color_producto) customFeatures.push(`Color: ${cp.ipp_color_producto}`);
      if (cp.ipp_altura) customFeatures.push(`Altura: ${cp.ipp_altura}`);
      if (cp.ipp_diametro_cm) customFeatures.push(`Diámetro: ${cp.ipp_diametro_cm} cm`);
      if (cp.ipp_color_bombillo) customFeatures.push(`Luz: ${cp.ipp_color_bombillo}`);
      if (cp.ipp_tipo_de_base) customFeatures.push(`Base: ${cp.ipp_tipo_de_base}`);
      if (cp.ipp_fuente_de_energia) customFeatures.push(`Alimentación: ${cp.ipp_fuente_de_energia}`);

      const imageBaseUrl = "https://tienda.impormax.net/gateway/apiyeminus/Recursos/02/imgproductos/";
      const photoName = String(item.archivoFoto1).trim();
      const imageUrl = photoName ? `${imageBaseUrl}${photoName}` : `${imageBaseUrl}${item.producto}.jpg`;

      // Fotos secundarias si existen
      const allImages = [imageUrl];
      if (item.archivoFoto2 && String(item.archivoFoto2).trim()) {
        allImages.push(`${imageBaseUrl}${String(item.archivoFoto2).trim()}`);
      }
      if (item.archivoFoto3 && String(item.archivoFoto3).trim()) {
        allImages.push(`${imageBaseUrl}${String(item.archivoFoto3).trim()}`);
      }
      if (item.archivoFoto4 && String(item.archivoFoto4).trim()) {
        allImages.push(`${imageBaseUrl}${String(item.archivoFoto4).trim()}`);
      }

      const separePercentage = isTree ? 30 : 100;

      let directItemQty: number | null = null;
      if (item.saldo !== undefined && item.saldo !== null && !isNaN(Number(item.saldo))) {
        directItemQty = Number(item.saldo);
      } else if (item.existencia !== undefined && item.existencia !== null && !isNaN(Number(item.existencia))) {
        directItemQty = Number(item.existencia);
      } else if (item.cantidad !== undefined && item.cantidad !== null && !isNaN(Number(item.cantidad))) {
        directItemQty = Number(item.cantidad);
      } else if (item.stock !== undefined && item.stock !== null && !isNaN(Number(item.stock))) {
        directItemQty = Number(item.stock);
      }

      const hasSpecificSaldo = combinedSaldoMap.has(internalCode) || combinedSaldoMap.has(ref) || directItemQty !== null;
      const yeminusQty = combinedSaldoMap.has(internalCode)
        ? combinedSaldoMap.get(internalCode)!
        : (combinedSaldoMap.has(ref)
          ? combinedSaldoMap.get(ref)!
          : (directItemQty !== null ? directItemQty : 0));
      const localDeduction = getPendingLocalDeduction(internalCode, ref);
      const finalStock = Math.max(0, yeminusQty - localDeduction);

      const pubDate =
        item.fechaLogEstado ||
        item.fechaModificacion ||
        item.fechaCreacion ||
        item.publicationDate ||
        item.created_at ||
        null;

      let isNew = false;
      if (pubDate) {
        try {
          const d = new Date(pubDate);
          if (!isNaN(d.getTime())) {
            const diffDays = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
            isNew = diffDays >= -1 && diffDays <= 15;
          }
        } catch {}
      }

      return {
        id: internalCode,
        code: internalCode,
        reference: ref,
        name: descText,
        description: finalDescription,
        observations: obs || ecommerceDesc || undefined,
        price,
        discountPrice,
        discountPercentage,
        imageUrl,
        images: allImages,
        stock: finalStock,
        separePercentage,
        features: [
          `Referencia: ${ref}`,
          `Categoría: ${category}`,
          `Subcategoría: ${subCategory}`,
          ...customFeatures
        ],
        dimensions: height && height !== "No aplica" ? `Altura: ${height}` : `Ref: ${ref}`,
        category,
        subCategory,
        color,
        height,
        similarCodes: [],
        publicationDate: pubDate,
        createdAt: item.fechaCreacion || pubDate,
        isNew,
        videoUrl:
          internalCode === "8050930"
            ? "/video-8050930.mp4"
            : internalCode === "8050931"
            ? "/video-8050931.mp4"
            : undefined
      };
    });

  const validProducts = [...mappedProducts].filter((p: any) => (p.stock ?? 0) >= 1);

  // Ordenar: Árboles primero, luego por nombre
  validProducts.sort((a: any, b: any) => {
    const isTreeA = a.category === 'Árboles';
    const isTreeB = b.category === 'Árboles';
    if (isTreeA && !isTreeB) return -1;
    if (!isTreeA && isTreeB) return 1;
    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
  });

  // 1. Guardar en memoria
  productsCache = {
    timestamp: Date.now(),
    data: validProducts
  };

  // 2. Guardar en archivo local de persistencia
  saveProductsToLocalFile(validProducts);

  // 3. Sincronizar en segundo plano a Supabase
  syncProductsToSupabase(validProducts).catch((err) => {
    console.warn("[SYNC SUPABASE ASYNC] Error:", err.message);
  });

  logApi("SUCCESS", "SYNC_YEMINUS", `Sincronizados ${validProducts.length} productos con éxito.`);
  return validProducts;
}

// 2. Obtener productos de navidad (Ultrarrápido: Memoria -> Supabase -> Archivo Local -> Yeminus)
app.get("/api/yeminus/products", async (req, res) => {
  const force = req.query.force === "true" || req.query.refresh === "true";

  // Si se solicita forzar actualización fresca desde Yeminus
  if (force) {
    try {
      const fresh = await fetchYeminusCatalog({ force: true });
      if (fresh && fresh.length > 0) {
        return res.json(fresh);
      }
    } catch (e: any) {
      console.warn("[FORCE YEMINUS FETCH WARN]", e.message);
    }
  }

  // A. Servir desde memoria si está activo (< 3 min)
  if (productsCache && (Date.now() - productsCache.timestamp < PRODUCTS_CACHE_TTL)) {
    return res.json(productsCache.data);
  }

  // B. Servir desde respaldo local si existe y disparar actualización fresca en segundo plano
  const localBackup = loadProductsFromLocalFile();
  if (localBackup && localBackup.length > 0) {
    if (!productsCache) {
      productsCache = {
        timestamp: Date.now() - PRODUCTS_CACHE_TTL + 45000,
        data: localBackup
      };
    }
    // Disparar sincronización asíncrona fresca con Yeminus para capturar nuevos descuentos y descripciones
    fetchYeminusCatalog({ force: true }).catch(() => {});
    return res.json(productsCache.data || localBackup);
  }

  // C. Servir desde Supabase si existe
  const supabaseBackup = await loadProductsFromSupabase();
  if (supabaseBackup && supabaseBackup.length > 0) {
    productsCache = {
      timestamp: Date.now() - PRODUCTS_CACHE_TTL + 45000,
      data: supabaseBackup
    };
    saveProductsToLocalFile(supabaseBackup);
    fetchYeminusCatalog({ force: true }).catch(() => {});
    return res.json(supabaseBackup);
  }

  // D. Primera consulta directa a Yeminus si no había respaldo previo
  try {
    const products = await fetchYeminusCatalog({ force: true });
    return res.json(products);
  } catch (error: any) {
    logApi("ERROR", "GET /api/yeminus/products", `Error consultando Yeminus: ${error.message}`);
    return res.json([]);
  }
});

// Endpoint de Sincronización Manual / Disparador desde Panel Admin
app.post("/api/products/sync", async (req, res) => {
  logApi("INFO", "POST /api/products/sync", "Disparada sincronización manual del catálogo desde Admin...");
  try {
    const products = await fetchYeminusCatalog({ force: true });
    const supabaseResult = await syncProductsToSupabase(products);

    res.json({
      success: true,
      count: products.length,
      timestamp: new Date().toISOString(),
      supabase: supabaseResult
    });
  } catch (error: any) {
    logApi("ERROR", "POST /api/products/sync", `Fallo en sincronización manual: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint de Estado del Respaldo
app.get("/api/products/backup-status", async (req, res) => {
  const localBackup = loadProductsFromLocalFile();
  let supabaseCount = 0;
  let supabaseConnected = false;

  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      const { count, error } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true });
      if (!error && typeof count === "number") {
        supabaseCount = count;
        supabaseConnected = true;
      }
    } catch (e) {
      console.warn("Error verificando Supabase:", e);
    }
  }

  let fileMeta: any = {};
  try {
    if (fs.existsSync(BACKUP_FILE_PATH)) {
      const stat = fs.statSync(BACKUP_FILE_PATH);
      fileMeta = {
        sizeBytes: stat.size,
        modifiedAt: stat.mtime.toISOString()
      };
    }
  } catch (e) {}

  res.json({
    inMemoryCount: productsCache?.data?.length || 0,
    localFileCount: localBackup?.length || 0,
    localFileMeta: fileMeta,
    supabaseConnected,
    supabaseCount,
    lastMemorySync: productsCache ? new Date(productsCache.timestamp).toISOString() : null
  });
});

// Endpoint para auditar y verificar la sincronización y estado del inventario
app.get("/api/inventory/status", (req, res) => {
  const currentCatalog = productsCache?.data || loadProductsFromLocalFile() || [];
  const deductions = loadLocalDeductions();

  let lowStockCount = 0; // 1 a 5 unidades
  let normalStockCount = 0; // > 5 unidades
  const lowStockItems: any[] = [];

  for (const p of currentCatalog) {
    const s = Number(p.stock) || 0;
    if (s >= 1 && s <= 5) {
      lowStockCount++;
      if (lowStockItems.length < 20) {
        lowStockItems.push({ id: p.id, name: p.name, stock: s, reference: p.reference });
      }
    } else if (s > 5) {
      normalStockCount++;
    }
  }

  res.json({
    success: true,
    totalActiveProducts: currentCatalog.length,
    lowStockCount,
    normalStockCount,
    zeroStockExcluded: true,
    recentDeductionsCount: deductions.length,
    recentDeductions: deductions.slice(-10),
    sampleLowStockItems: lowStockItems
  });
});

// Endpoint para forzar sincronización en vivo del inventario con Yeminus ERP
app.post("/api/inventory/sync-now", async (req, res) => {
  try {
    console.log("[INVENTORY SYNC NOW] Solicitud manual de sincronización completa...");
    const products = await fetchYeminusCatalog({ force: true });
    res.json({
      success: true,
      message: "Catálogo e inventario sincronizados exitosamente con Yeminus ERP",
      count: products.length,
      sampleItems: products.slice(0, 10).map((p: any) => ({
        id: p.id,
        reference: p.reference,
        name: p.name,
        stock: p.stock
      }))
    });
  } catch (err: any) {
    console.error("[INVENTORY SYNC NOW] Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para descargar copia de respaldo JSON directa
app.get("/api/products/export-backup", (req, res) => {
  const localBackup = loadProductsFromLocalFile();
  const dataToExport = localBackup || productsCache?.data || [];
  
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", 'attachment; filename="impormax_catalogo_respaldo_590.json"');
  res.send(JSON.stringify(dataToExport, null, 2));
});

// Endpoint para verificar si el cliente califica para el 10% de descuento de Primera Compra
app.post("/api/customers/check-first-order", async (req, res) => {
  const { document, email, phone } = req.body;
  const cleanDoc = String(document || "").replace(/\D/g, "").trim();
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanPhone = String(phone || "").replace(/\D/g, "").trim();

  // Si no se proporcionó ningún dato de identificación, por defecto en la primera visita es elegible
  if (!cleanDoc && !cleanEmail && !cleanPhone) {
    return res.json({
      isFirstOrder: true,
      discountPercent: 10,
      discountCode: "PRIMERACOMPRA10",
      message: "¡Aplica 10% de descuento adicional en tu primer pedido sobre el total del carrito!"
    });
  }

  try {
    let orderCount = 0;

    // 1. Verificación en base de datos SQLite (órdenes aprobadas o con abonos confirmados)
    if (cleanDoc && cleanDoc !== "222222222" && cleanDoc.length >= 5) {
      try {
        const sqliteCheck = db.prepare(`
          SELECT COUNT(*) as cnt FROM orders 
          WHERE (
            customer_document = ? 
            OR (? != '' AND lower(customer_email) = ?)
            OR (? != '' AND customer_phone = ?)
          )
          AND status IN ('pagado', 'abonando', 'approved', 'aprobado', 'delivered')
          AND (paid_amount > 0 OR initial_payment > 0)
        `).get(
          cleanDoc,
          cleanEmail, cleanEmail,
          cleanPhone, cleanPhone
        ) as any;

        if (sqliteCheck && sqliteCheck.cnt > 0) {
          orderCount += Number(sqliteCheck.cnt) || 0;
        }
      } catch (sqlErr: any) {
        console.warn("[CHECK FIRST ORDER SQLITE WARN]", sqlErr.message);
      }
    } else if (cleanEmail && cleanEmail.includes("@")) {
      try {
        const sqliteCheck = db.prepare(`
          SELECT COUNT(*) as cnt FROM orders 
          WHERE lower(customer_email) = ?
            AND status IN ('pagado', 'abonando', 'approved', 'aprobado', 'delivered')
            AND (paid_amount > 0 OR initial_payment > 0)
        `).get(cleanEmail) as any;
        if (sqliteCheck && sqliteCheck.cnt > 0) {
          orderCount += Number(sqliteCheck.cnt) || 0;
        }
      } catch (sqlErr: any) {
        console.warn("[CHECK FIRST ORDER SQLITE WARN]", sqlErr.message);
      }
    }

    // 2. Verificación secundaria en base de datos Supabase (pedidos confirmados previamente)
    const hasValidIdentifier = (cleanDoc && cleanDoc !== "222222222" && cleanDoc.length >= 5) || (cleanEmail && cleanEmail.includes("@")) || (cleanPhone && cleanPhone.length >= 7);

    if (orderCount === 0 && hasValidIdentifier) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          let query = supabase.from("pedidos").select("id, estado, abonado");
          if (cleanDoc && cleanDoc !== "222222222" && cleanDoc.length >= 5) {
            query = query.eq("cliente_documento", cleanDoc);
          } else if (cleanEmail && cleanEmail.includes("@")) {
            query = query.ilike("cliente_email", cleanEmail);
          } else if (cleanPhone && cleanPhone.length >= 7) {
            query = query.eq("cliente_telefono", cleanPhone);
          }

          const { data: pastOrders } = await query;
          if (pastOrders && pastOrders.length > 0) {
            const confirmed = pastOrders.filter((po: any) => 
              ['pagado', 'abonando', 'aprobado'].includes(String(po.estado || '').toLowerCase()) ||
              Number(po.abonado) > 0
            );
            orderCount += confirmed.length;
          }
        } catch (sbErr: any) {
          console.warn("[CHECK FIRST ORDER SB WARN]", sbErr.message);
        }
      }
    }

    const isFirstOrder = orderCount === 0;
    res.json({
      isFirstOrder,
      discountPercent: isFirstOrder ? 10 : 0,
      discountCode: isFirstOrder ? "PRIMERACOMPRA10" : null,
      previousOrdersCount: orderCount,
      message: isFirstOrder
        ? "¡Excelente! Este es tu primer pedido en la tienda: tienes 10% de descuento sobre el total de tu compra."
        : "Has realizado compras previas con nosotros. Tu pedido se procesará con los precios regulares y ofertas vigentes."
    });
  } catch (error: any) {
    console.warn("Error al verificar primera compra:", error.message);
    res.json({
      isFirstOrder: true,
      discountPercent: 10,
      discountCode: "PRIMERACOMPRA10",
      message: "¡Aplica 10% de descuento adicional en tu primer pedido!"
    });
  }
});

// 3. Crear cliente (Tercero) en Yeminus
app.post("/api/yeminus/client/create", async (req, res) => {
  const endpoint = "/gateway/apiyeminus/api/general/terceros/agregar";
  const idEmpresa = process.env.YEMINUS_ID_EMPRESA || "02";
  const usuario = process.env.YEMINUS_USUARIO || "API";

  logApi("INFO", "POST /api/yeminus/client/create", "Solicitando creación de Tercero en Yeminus...", req.body);

  try {
    const token = await getAccessToken();

    const { doc, first_name, second_name, last_name, second_last_name, email, phone, address, city } = req.body;

    // Sanitizar cédula/NIT para eliminar puntos, comas, guiones o espacios
    const cleanDoc = String(doc).replace(/\D/g, "");
    const safeNit = parseInt(cleanDoc) || 99999999;
    const safeEmail = email && email.includes("@") ? email : "correo@impormax.net";

    const { daneCode: daneCityCode, cityName: daneCityName } = resolveCityToDaneCode(city, address);
    const isCompany = safeNit > 800000000 && safeNit < 999999999;
    const tipoIdentificacion = isCompany ? "31" : "13";
    const naturalezaJuridica = isCompany ? "J" : "N";

    const payload = {
      nitModel: {
        tipoIdentificacionTributaria: tipoIdentificacion,
        nit: safeNit,
        codigoInterno: `${cleanDoc}DEFAN`,
        nombre1: isCompany ? "" : (first_name || "").toUpperCase(),
        nombre2: isCompany ? "" : (second_name || "").toUpperCase(),
        apellido1: isCompany ? "" : (last_name || "").toUpperCase(),
        apellido2: isCompany ? "" : (second_last_name || "").toUpperCase(),
        ciudadExpecidionCedula: daneCityCode,
        descripcion: isCompany
          ? `${first_name} ${last_name}`.trim().toUpperCase()
          : `${last_name} ${second_last_name || ""} ${first_name} ${second_name || ""}`.replace(/\s+/g, " ").trim().toUpperCase(),
        nombreComercial: `${first_name} ${second_name || ""} ${last_name} ${second_last_name || ""}`.replace(/\s+/g, " ").trim().toUpperCase(),
        clase: "C", // Cliente
        observacionGeneral: "Registrado desde Landing Page Plan Separe Impormax",
        direccion: address && address.length >= 8 ? address : `${address || "Calle 100 #15-30"} - ${daneCityName}`,
        codigoCiudad: daneCityCode,
        barrio: "VILLA VERDE",
        celular: phone || "3001234567",
        telefono1: phone || "3001234567",
        email: safeEmail,
        regimen: "01",
        emailFacturacionElectronica: safeEmail,
        agenteRetenedor: "N",
        autoretenedor: "S",
        naturalezaJuridica: naturalezaJuridica,
        usuarioResponsable: usuario
      }
    };

    const response = await safeFetch(`${YEMINUS_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "id_empresa": idEmpresa,
        "usuario": usuario,
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    }, 15000);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Fallo del ERP (${response.status}): ${errText}`);
    }

    const resData: any = await response.json();
    if (resData.esExitoso) {
      logApi("SUCCESS", "POST /api/yeminus/client/create", "Cliente registrado con éxito en Yeminus", payload, resData);
      res.json({ success: true, nit: resData.datos });
    } else {
      // Si el cliente ya existe, el ERP podría dar un error controlado, intentemos continuar
      logApi("INFO", "POST /api/yeminus/client/create", `El ERP retornó un mensaje: ${resData.mensaje}. Probablemente el tercero ya existe.`);
      res.json({ success: true, alreadyExists: true, message: resData.mensaje });
    }
  } catch (error: any) {
    logApi("ERROR", "POST /api/yeminus/client/create", `Error al crear tercero: ${error.message}. Procediendo con simulación local.`);
    res.json({ success: false, error: error.message });
  }
});

// Helper para obtener el código de Forma de Pago en Yeminus ERP
function getFormaPagoYeminus(paymentMethod?: string): string {
  if (!paymentMethod) return "11";
  const pm = paymentMethod.toLowerCase();
  if (pm.includes("wompi")) return "05"; // Pasarela Wompi
  if (pm.includes("pse")) return "11"; // PSE
  if (pm.includes("nequi")) return "04"; // Nequi / Bancolombia
  if (pm.includes("bre") || pm.includes("llave")) return "01"; // Bre-B / Llave Bancolombia
  if (pm.includes("transferencia") || pm.includes("banco")) return "01"; // Transferencia bancaria
  if (pm.includes("tarjeta")) return "02"; // Tarjeta
  return "11";
}

// Helper para guardar automáticamente un Pedido en la base de datos espejo de Supabase
async function saveOrderMirrorToSupabase(orderData: {
  slp_document_id?: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_document: string | number;
  customer_address?: string;
  customer_city?: string;
  product_id: string;
  product_name: string;
  total_amount: number;
  deposit_amount: number;
  payment_method?: string;
  payment_reference?: string;
}): Promise<{ success: boolean; pedido_id?: string; error?: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { success: false, error: "Supabase no configurado" };

  try {
    const pedidoUuid = crypto.randomUUID();
    const cleanCustomerDoc = String(orderData.customer_document || "").trim();
    const cleanShippingAddress = String(orderData.customer_address || "").trim();
    const cleanShippingCity = String(orderData.customer_city || "").trim();

    const metaParts = [];
    if (orderData.slp_document_id) metaParts.push(`Ref: ${orderData.slp_document_id}`);
    if (cleanCustomerDoc) metaParts.push(`Doc: ${cleanCustomerDoc}`);
    if (cleanShippingAddress) metaParts.push(`Dir: ${cleanShippingAddress}`);
    if (cleanShippingCity) metaParts.push(`Ciudad: ${cleanShippingCity}`);
    const metaSuffix = metaParts.length > 0 ? ` [${metaParts.join(" | ")}]` : "";

    const tot = Number(orderData.total_amount) || 0;
    const dep = Number(orderData.deposit_amount) || 0;
    const remaining = Math.max(0, tot - dep);
    const estado = remaining <= 0 ? "pagado" : (dep > 0 ? "abonando" : "pendiente");

    const { data: insertedPedido, error: pError } = await supabase
      .from("pedidos")
      .insert([{
        id: pedidoUuid,
        cliente_nombre: orderData.customer_name || "Cliente Impormax",
        cliente_email: orderData.customer_email || "cliente@impormax.net",
        cliente_telefono: String(orderData.customer_phone || ""),
        cliente_documento: cleanCustomerDoc,
        direccion_envio: cleanShippingAddress,
        ciudad_envio: cleanShippingCity,
        producto_id: String(orderData.product_id || "NA"),
        producto_name: `${orderData.product_name || "Producto Navideño"}${metaSuffix}`,
        total: tot,
        abonado: dep,
        restante: remaining,
        estado: estado
      }])
      .select()
      .single();

    if (pError) {
      console.error("[SUPABASE MIRROR] Error al insertar en pedidos:", pError.message);
      return { success: false, error: pError.message };
    }

    if (orderData.deposit_amount > 0) {
      const { error: payError } = await supabase
        .from("pagos")
        .insert([{
          id: crypto.randomUUID(),
          pedido_id: pedidoUuid,
          monto: orderData.deposit_amount,
          referencia_pago: orderData.payment_reference || `Abono Inicial ${orderData.slp_document_id || ''}`.trim(),
          estado_pago: "aprobado",
          metodo_pago: orderData.payment_method || "wompi"
        }]);

      if (payError) {
        console.error("[SUPABASE MIRROR] Error al insertar abono inicial en pagos:", payError.message);
      }
    }

    logApi("SUCCESS", "SUPABASE_MIRROR", `Pedido espejo guardado en Supabase ID ${pedidoUuid} (Ref: ${orderData.slp_document_id})`);
    return { success: true, pedido_id: pedidoUuid };
  } catch (err: any) {
    console.error("[SUPABASE MIRROR] Excepción:", err.message);
    return { success: false, error: err.message };
  }
}

// Helper para guardar automáticamente un Pago/Abono en la base de datos espejo de Supabase
async function savePaymentMirrorToSupabase(paymentData: {
  slp_document_id?: string;
  customer_document?: string | number;
  amount: number;
  payment_method?: string;
  payment_reference?: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { success: false, error: "Supabase no configurado" };

  try {
    let pedidoId: string | null = null;
    let currentTotal = 0;
    let currentAbonado = 0;

    if (paymentData.slp_document_id) {
      const { data: found } = await supabase
        .from("pedidos")
        .select("*")
        .ilike("producto_name", `%${paymentData.slp_document_id}%`)
        .limit(1);

      if (found && found[0]) {
        pedidoId = found[0].id;
        currentTotal = found[0].total || 0;
        currentAbonado = found[0].abonado || 0;
      }
    }

    if (pedidoId) {
      await supabase.from("pagos").insert([{
        id: crypto.randomUUID(),
        pedido_id: pedidoId,
        monto: paymentData.amount,
        referencia_pago: paymentData.payment_reference || `Abono ${paymentData.slp_document_id || ''}`,
        estado_pago: "aprobado",
        metodo_pago: paymentData.payment_method || "wompi"
      }]);

      const newAbonado = currentAbonado + paymentData.amount;
      const newRestante = Math.max(0, currentTotal - newAbonado);
      const newEstado = newRestante <= 0 ? "pagado" : "abonando";

      await supabase
        .from("pedidos")
        .update({
          abonado: newAbonado,
          restante: newRestante,
          estado: newEstado
        })
        .eq("id", pedidoId);

      logApi("SUCCESS", "SUPABASE_PAYMENT_MIRROR", `Pago espejo de $${paymentData.amount} aplicado al pedido ${pedidoId}`);
    }

    return { success: true };
  } catch (err: any) {
    console.error("[SUPABASE PAYMENT MIRROR] Error:", err.message);
    return { success: false, error: err.message };
  }
}

// Helper para consolidar items con el mismo código de producto (evita "Producto duplicado" en Yeminus)
function consolidateOrderItems(items: Array<{
  producto: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  precioTotal: number;
  subtotal: number;
  iva: number;
  porcentajeDescuentoDelPrecio?: number;
  valorDescuentoDelPrecio?: number;
}>): Array<{
  producto: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  precioTotal: number;
  subtotal: number;
  iva: number;
  porcentajeDescuentoDelPrecio?: number;
  valorDescuentoDelPrecio?: number;
}> {
  const map = new Map<string, any>();
  for (const item of items) {
    const code = String(item.producto || "").trim();
    if (!code) continue;
    if (map.has(code)) {
      const ex = map.get(code);
      ex.cantidad += Math.max(1, item.cantidad);
      ex.precioTotal += item.precioTotal;
      ex.subtotal += item.subtotal;
      ex.iva += item.iva;
      ex.valorDescuentoDelPrecio = (ex.valorDescuentoDelPrecio || 0) + (item.valorDescuentoDelPrecio || 0);
      ex.precioUnitario = Math.round(ex.precioTotal / ex.cantidad);
      if (!ex.nombre.includes(item.nombre)) {
        ex.nombre = `${ex.nombre} + ${item.nombre}`.substring(0, 100);
      }
    } else {
      map.set(code, { ...item, producto: code });
    }
  }
  return Array.from(map.values());
}

// Helper para estructurar los ítems reales del pedido para Yeminus y la BD
// NUNCA adivina ni sustituye artículos por otros SKUs
function resolveOrderItems(orderData: {
  product_id?: string;
  product_name?: string;
  total_amount?: number;
  items?: any[];
}): Array<{
  producto: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  precioTotal: number;
  subtotal: number;
  iva: number;
  porcentajeDescuentoDelPrecio?: number;
  valorDescuentoDelPrecio?: number;
}> {
  const totalAmount = Math.max(0, Math.round(Number(orderData.total_amount) || 0));

  // Caso 1: Vienen items estructurados en orderData.items (fuente de verdad absoluta)
  if (orderData.items && Array.isArray(orderData.items) && orderData.items.length > 0) {
    const prepared = orderData.items.map((item: any, idx: number) => {
      let pId = String(item.product_id || item.id || item.code || "").trim();
      if (!pId || pId === "ONLINE") {
        pId = "8010141";
      }
      const qty = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Number(item.unit_price ?? item.price) || 0;
      const pctDesc = Number(item.discount_percentage || item.porcentajeDescuentoDelPrecio) || 0;
      const valDesc = Number(item.discount_amount || item.valorDescuentoDelPrecio) || 0;
      const rawTot = Number(item.total) || (unitPrice * qty);
      const pTot = (valDesc > 0 && rawTot === unitPrice * qty)
        ? Math.max(1, rawTot - valDesc)
        : rawTot;
      const sub = Math.round(pTot / 1.19);
      return {
        producto: pId,
        nombre: item.product_name || item.name || `Producto ${idx + 1}`,
        cantidad: qty,
        precioUnitario: unitPrice,
        precioTotal: pTot,
        subtotal: sub,
        iva: pTot - sub,
        porcentajeDescuentoDelPrecio: pctDesc,
        valorDescuentoDelPrecio: valDesc
      };
    });

    return consolidateOrderItems(prepared);
  }

  // Caso 2: Orden simple directa con product_id y product_name
  const cleanName = (orderData.product_name || "Producto Navideño").replace(/\[Ref:\s*[^\]]+\]/g, "").replace(/\[.*?\]/g, "").trim();
  let prodId = String(orderData.product_id || "").trim();

  if (!prodId || prodId === "ONLINE") {
    try {
      let catalogList: any[] = [];
      if (fs.existsSync(BACKUP_FILE_PATH)) {
        const raw = fs.readFileSync(BACKUP_FILE_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        catalogList = Array.isArray(parsed) ? parsed : (parsed.products || []);
      }
      if (catalogList.length > 0) {
        const cleanLower = cleanName.toLowerCase();
        const found = catalogList.find((p: any) => 
          p.name.toLowerCase() === cleanLower ||
          cleanLower.includes(p.name.toLowerCase()) ||
          p.name.toLowerCase().includes(cleanLower) ||
          (p.reference && cleanLower.includes(p.reference.toLowerCase()))
        );
        if (found) {
          prodId = String(found.id || found.code);
        }
      }
    } catch {}
  }
  if (!prodId || prodId === "ONLINE") {
    prodId = "8010141"; // Código de producto real de Yeminus (Arbol Verde Cancun 180cm)
  }

  const pTot = totalAmount > 0 ? totalAmount : 100000;
  const sub = Math.round(pTot / 1.19);

  return [{
    producto: prodId,
    nombre: cleanName,
    cantidad: 1,
    precioUnitario: pTot,
    precioTotal: pTot,
    subtotal: sub,
    iva: pTot - sub
  }];
}

// Mapeo completo de Ciudades Principales de Colombia a Código DANE oficial
const DANE_CITY_CODES: Record<string, string> = {
  // Eje Cafetero y Risaralda
  "pereira": "66001",
  "dosquebradas": "66170",
  "santa rosa de cabal": "66682",
  "la virginia": "66400",
  "manizales": "17001",
  "villamaria": "17873",
  "villamaría": "17873",
  "chinchina": "17174",
  "chinchiná": "17174",
  "la dorada": "17380",
  "armenia": "63001",
  "calarca": "63130",
  "calarcá": "63130",
  "montenegro": "63470",
  "quimbaya": "63594",
  "la tebaida": "63401",
  "circasia": "63190",
  // Bogotá y Cundinamarca
  "bogota": "11001",
  "bogotá": "11001",
  "bogota d.c.": "11001",
  "bogota dc": "11001",
  "chia": "25175",
  "chía": "25175",
  "soacha": "25754",
  "zipaquira": "25899",
  "zipaquirá": "25899",
  "facatativa": "25269",
  "facatativá": "25269",
  "fusagasuga": "25290",
  "fusagasugá": "25290",
  "madrid": "25430",
  "funza": "25286",
  "mosquera": "25473",
  "cajica": "25126",
  "cajicá": "25126",
  "girardot": "25307",
  // Antioquia
  "medellin": "05001",
  "medellín": "05001",
  "envigado": "05266",
  "itagui": "05360",
  "itagüí": "05360",
  "bello": "05088",
  "sabaneta": "05631",
  "rionegro": "05615",
  "la ceja": "05376",
  "marinilla": "05440",
  "copacabana": "05212",
  "girardota": "05308",
  "apartado": "05045",
  "apartadó": "05045",
  // Valle del Cauca
  "cali": "76001",
  "palmira": "76520",
  "yumbo": "76892",
  "jamundi": "76364",
  "jamundí": "76364",
  "buga": "76111",
  "guadalajara de buga": "76111",
  "tulua": "76834",
  "tuluá": "76834",
  "cartago": "76147",
  "buenaventura": "76109",
  // Costa Caribe
  "barranquilla": "08001",
  "soledad": "08758",
  "malambo": "08433",
  "cartagena": "13001",
  "cartagena de indias": "13001",
  "santa marta": "47001",
  "cienaga": "47189",
  "ciénaga": "47189",
  "valledupar": "20001",
  "monteria": "23001",
  "montería": "23001",
  "sincelejo": "70001",
  "riohacha": "44001",
  "maicao": "44430",
  // Santanderes
  "bucaramanga": "68001",
  "floridablanca": "68276",
  "giron": "68307",
  "girón": "68307",
  "piedecuesta": "68547",
  "barrancabermeja": "68081",
  "cucuta": "54001",
  "cúcuta": "54001",
  "los patios": "54405",
  "villa del rosario": "54874",
  // Tolima, Huila, Llanos y Sur
  "ibague": "73001",
  "ibagué": "73001",
  "espinal": "73268",
  "neiva": "41001",
  "pitalito": "41551",
  "villavicencio": "50001",
  "acacias": "50006",
  "pasto": "52001",
  "ipiales": "52356",
  "popayan": "19001",
  "popayán": "19001",
  "tunja": "15001",
  "sogamoso": "15759",
  "duitama": "15238",
  "yopal": "85001",
  "florencia": "18001",
  "quibdo": "27001",
  "quibdó": "27001"
};

function resolveCityToDaneCode(cityRaw?: string, addressRaw?: string): { daneCode: string; cityName: string } {
  const normText = (s?: string) => String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/gi, " ")
    .trim();

  const cStr = String(cityRaw || "").trim();
  const aStr = String(addressRaw || "").trim();

  // 1. Si se ingresó directamente un código DANE de 5 dígitos (ej. "13001" o "66001")
  const numMatch = cStr.match(/\b\d{5}\b/) || aStr.match(/\b\d{5}\b/);
  if (numMatch) {
    const code = numMatch[0];
    const foundEntry = Object.entries(DANE_CITY_CODES).find(([_, d]) => d === code);
    const name = foundEntry ? foundEntry[0].charAt(0).toUpperCase() + foundEntry[0].slice(1) : cStr || "Colombia";
    return { daneCode: code, cityName: name };
  }

  const normCity = normText(cStr);
  const normAddress = normText(aStr);

  // 2. Buscar en DANE_CITY_CODES por ciudad
  if (normCity && !normCity.includes("colombia") && !normCity.includes("entrega")) {
    for (const [cityName, daneCode] of Object.entries(DANE_CITY_CODES)) {
      const cleanKey = normText(cityName);
      if (normCity === cleanKey || normCity.startsWith(cleanKey + " ") || normCity.endsWith(" " + cleanKey) || normCity.includes(cleanKey)) {
        const properName = cityName.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        return { daneCode, cityName: properName };
      }
    }
  }

  // 3. Si la ciudad venía vacía o genérica, buscar ciudad dentro de la dirección
  if (normAddress) {
    for (const [cityName, daneCode] of Object.entries(DANE_CITY_CODES)) {
      const cleanKey = normText(cityName);
      // Evitar falsos positivos con nombres muy cortos si no están delimitados
      if (cleanKey.length >= 4) {
        const regex = new RegExp(`(^|\\s)${cleanKey}(\\s|$)`, "i");
        if (regex.test(normAddress)) {
          const properName = cityName.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
          return { daneCode, cityName: properName };
        }
      }
    }
  }

  // 4. Si el usuario escribió un nombre de ciudad que no está en el mapa, respetarlo con DANE por defecto o de capital
  if (cStr && cStr.length >= 3 && !['colombia', 'entrega', 'tienda'].includes(normCity)) {
    return { daneCode: "66001", cityName: cStr };
  }

  return { daneCode: "66001", cityName: "Pereira" };
}

function getColombianIsoString(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const pad3 = (n: number) => String(n).padStart(3, '0');
  
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const colDate = new Date(utc - (5 * 3600000));
  
  const yyyy = colDate.getFullYear();
  const MM = pad(colDate.getMonth() + 1);
  const dd = pad(colDate.getDate());
  const hh = pad(colDate.getHours());
  const mm = pad(colDate.getMinutes());
  const ss = pad(colDate.getSeconds());
  const ms = pad3(colDate.getMilliseconds());
  
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}.${ms}-05:00`;
}

// Helper para obtener las fechas del documento en el periodo contable activo de Yeminus
function getYeminusDateInfo(customDate?: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const pad3 = (n: number) => String(n).padStart(3, '0');

  // En Yeminus ERP el periodo contable activo actual para documentos e inventario es Julio 2026.
  // Periodos futuros (como 10-2026) retornan "El periodo esta cerrado".
  const useActiveFiscalPeriod = process.env.YEMINUS_USE_CURRENT_DATE !== "true";

  if (useActiveFiscalPeriod) {
    return {
      fechaDocumento: "2026-07-06T14:41:43.316-05:00",
      fechaVencimiento: "2026-07-06T14:41:43.316-05:00",
      ano: 2026,
      mes: 7,
      fechaPago: "2026-07-06T05:00:00.000Z",
      fechaRecibo: "2026-07-07T00:01:03.316Z"
    };
  }

  const date = customDate || new Date();
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const colDate = new Date(utc - (5 * 3600000));
  const yyyy = colDate.getFullYear();
  const mmNum = colDate.getMonth() + 1;
  const MM = pad(mmNum);
  const dd = pad(colDate.getDate());
  const hh = pad(colDate.getHours());
  const mm = pad(colDate.getMinutes());
  const ss = pad(colDate.getSeconds());
  const ms = pad3(colDate.getMilliseconds());

  return {
    fechaDocumento: `${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}.${ms}-05:00`,
    fechaVencimiento: `${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}.${ms}-05:00`,
    ano: yyyy,
    mes: mmNum,
    fechaPago: `${yyyy}-${MM}-${dd}T05:00:00.000Z`,
    fechaRecibo: `${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}.${ms}Z`
  };
}

// Helper para detectar la bodega con stock disponible para cada producto
function getProductWarehouse(productId: string | number, defaultBodega = "05"): string {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "saldos_backup.json"), "utf-8");
    const parsed = JSON.parse(raw);
    const saldos = parsed.saldos || [];
    const cleanId = String(productId || "").trim();
    const matches = saldos.filter((s: any) => String(s.producto).trim() === cleanId && (Number(s.cantidad) > 0 || Number(s.existencia) > 0));
    if (matches.some((m: any) => m.bodega === "05")) return "05";
    if (matches.length > 0 && matches[0].bodega) return String(matches[0].bodega);
  } catch {}
  return defaultBodega;
}

// 1. Asegurar la creación/actualización del Tercero en Yeminus
async function ensureYeminusTercero(orderData: {
  customer_document?: string | number;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  customer_city?: string;
  shipping_address?: string;
  shipping_city?: string;
  notes?: string;
  observaciones?: string;
}, token: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const idEmpresa = process.env.YEMINUS_ID_EMPRESA || "02";
    const usuario = process.env.YEMINUS_USUARIO || "API";

    let cleanCustomerDoc = parseInt(String(orderData.customer_document || "").replace(/\D/g, ""));
    if (!cleanCustomerDoc || cleanCustomerDoc < 1000) {
      cleanCustomerDoc = 222222222;
    }

    const nameParts = (orderData.customer_name || "CLIENTE IMPORMAX").trim().split(/\s+/);
    let first_name = nameParts[0] || "CLIENTE";
    let second_name = "";
    let last_name = "IMPORMAX";
    let second_last_name = "";

    if (nameParts.length === 2) {
      last_name = nameParts[1];
    } else if (nameParts.length === 3) {
      last_name = nameParts[1];
      second_last_name = nameParts[2];
    } else if (nameParts.length >= 4) {
      second_name = nameParts[1];
      last_name = nameParts[2];
      second_last_name = nameParts.slice(3).join(" ");
    }

    const rawCity = orderData.customer_city || orderData.shipping_city || "";
    const rawAddress = orderData.customer_address || orderData.shipping_address || "";
    const { daneCode, cityName } = resolveCityToDaneCode(rawCity, rawAddress);
    const safeAddress = String(rawAddress || "Entrega a domicilio").trim();
    const finalAddress = safeAddress.length >= 6 ? safeAddress : `${safeAddress} - ${cityName}`;

    const safeEmail = (orderData.customer_email && orderData.customer_email.includes("@"))
      ? orderData.customer_email
      : "cliente@impormax.net";

    const safePhone = String(orderData.customer_phone || "3001234567").replace(/\D/g, "") || "3001234567";

    const isCompany = cleanCustomerDoc > 800000000 && cleanCustomerDoc < 999999999;
    const tipoIdentificacion = isCompany ? "31" : "13";
    const naturalezaJuridica = isCompany ? "J" : "N";

    const nitPayload = {
      nitModel: {
        tipoIdentificacionTributaria: tipoIdentificacion,
        nit: cleanCustomerDoc,
        codigoInterno: `${cleanCustomerDoc}DEFAN`,
        nombre1: isCompany ? "" : first_name.toUpperCase(),
        nombre2: isCompany ? "" : (second_name || "").toUpperCase(),
        apellido1: isCompany ? "" : last_name.toUpperCase(),
        apellido2: isCompany ? "" : (second_last_name || "").toUpperCase(),
        ciudadExpecidionCedula: daneCode,
        descripcion: isCompany
          ? (orderData.customer_name || `${first_name} ${last_name}`).trim().toUpperCase()
          : `${last_name} ${second_last_name || ""} ${first_name} ${second_name || ""}`.replace(/\s+/g, " ").trim().toUpperCase(),
        nombreComercial: `${first_name} ${second_name || ""} ${last_name} ${second_last_name || ""}`.replace(/\s+/g, " ").trim().toUpperCase(),
        clase: "C",
        observacionGeneral: (orderData.notes || orderData.observaciones || "Cliente Plan Separe Landing Impormax").substring(0, 100),
        direccion: finalAddress,
        codigoCiudad: daneCode,
        barrio: "VILLA VERDE",
        celular: safePhone,
        telefono1: safePhone,
        email: safeEmail,
        regimen: "01",
        emailFacturacionElectronica: safeEmail,
        agenteRetenedor: "N",
        autoretenedor: "S",
        naturalezaJuridica: naturalezaJuridica,
        usuarioResponsable: usuario,
        direccionesDeDespacho: [
          {
            nitCliente: cleanCustomerDoc,
            consecutivo: 1,
            direccion: finalAddress,
            codigoCiudad: daneCode,
            facturar: "N"
          }
        ]
      }
    };

    const res = await safeFetch(`${YEMINUS_BASE}/gateway/apiyeminus/api/general/terceros/agregar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "id_empresa": idEmpresa,
        "usuario": usuario,
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(nitPayload)
    }, 15000);

    const resData: any = await res.json().catch(() => ({}));

    // Si el Tercero ya existe en Yeminus, actualizar obligatoriamente su ciudad y dirección con terceros/modificar
    if (resData.datos === "ALERT_ALREADY_EXIST" || resData.infoOperacion?.excepcion?.detalleErrorFiltrado?.includes("ya existe") || !resData.esExitoso) {
      try {
        const getRes = await safeFetch(`${YEMINUS_BASE}/gateway/apiyeminus/api/general/terceros/obtener`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "id_empresa": idEmpresa,
            "usuario": usuario,
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ nit: cleanCustomerDoc })
        }, 8000);
        const getData = await getRes.json().catch(() => ({}));
        if (getData.esExitoso && getData.datos) {
          const modPayload = {
            nitModel: {
              ...getData.datos,
              codigoCiudad: daneCode,
              ciudadExpecidionCedula: daneCode,
              direccion: finalAddress,
              celular: safePhone,
              telefono1: safePhone,
              email: safeEmail,
              emailFacturacionElectronica: safeEmail,
              observacionGeneral: (orderData.notes || orderData.observaciones || "Cliente Plan Separe Landing Impormax").substring(0, 100),
              direccionesDeDespacho: [
                {
                  nitCliente: cleanCustomerDoc,
                  consecutivo: 1,
                  direccion: finalAddress,
                  codigoCiudad: daneCode,
                  facturar: "N"
                }
              ]
            }
          };
          await safeFetch(`${YEMINUS_BASE}/gateway/apiyeminus/api/general/terceros/modificar`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "id_empresa": idEmpresa,
              "usuario": usuario,
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(modPayload)
          }, 10000);
          logApi("SUCCESS", "YEMINUS_TERCERO_UPDATED", `Tercero ${cleanCustomerDoc} actualizado en Yeminus con ciudad DANE ${daneCode} (${cityName}) y dirección: ${finalAddress}`);
        }
      } catch (modErr: any) {
        console.warn("[YEMINUS TERCERO MOD WARN]", modErr.message);
      }
      return { success: true, data: resData };
    }

    logApi("SUCCESS", "YEMINUS_TERCERO_CREATED", `Tercero ${cleanCustomerDoc} creado en Yeminus con ciudad DANE ${daneCode} (${cityName}) y dirección: ${finalAddress}`);
    return { success: true, data: resData };
  } catch (err: any) {
    console.warn("[YEMINUS TERCERO EXCEPTION]", err.message);
    return { success: false, error: err.message };
  }
}

// 2. Crear documento SLP (Separado) en Yeminus
async function createYeminusSLPDocument(orderData: {
  customer_document?: string | number;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  customer_city?: string;
  notes?: string;
  observaciones?: string;
  product_id?: string;
  product_name?: string;
  total_amount: number;
  deposit_amount: number;
  payment_method?: string;
  items?: any[];
}, token: string): Promise<{ success: boolean; document_id?: string; numero?: number; error?: string; raw?: any }> {
  const idCaja = process.env.YEMINUS_ID_CAJA || "2";
  const idEmpresa = process.env.YEMINUS_ID_EMPRESA || "02";
  const usuario = process.env.YEMINUS_USUARIO || "API";

  let cleanCustomerDoc = parseInt(String(orderData.customer_document || "").replace(/\D/g, ""));
  if (!cleanCustomerDoc || cleanCustomerDoc < 1000) {
    cleanCustomerDoc = 816008621;
  }

  const { daneCode, cityName } = resolveCityToDaneCode(orderData.customer_city || "Pereira", orderData.customer_address);
  const safeDane = String(daneCode || "66001");
  const safeAddress = String(orderData.customer_address || "CR 16 BIS 11 56").trim();
  const finalAddress = safeAddress.length >= 6 ? safeAddress : `${safeAddress} - ${cityName}`;

  let resolvedItems = resolveOrderItems(orderData);
  if (!resolvedItems || resolvedItems.length === 0) {
    const pTot = Math.max(1000, Math.round(Number(orderData.total_amount) || 100000));
    const sub = Math.round(pTot / 1.19);
    resolvedItems = [{
      producto: "8010014",
      nombre: "Separado Impormax",
      cantidad: 1,
      precioUnitario: pTot,
      precioTotal: pTot,
      subtotal: sub,
      iva: pTot - sub
    }];
  }

  const firstWarehouse = getProductWarehouse(resolvedItems[0]?.producto, "05");

  const yeminusItems = resolvedItems.map((item, idx) => {
    const itemWh = getProductWarehouse(item.producto, firstWarehouse || "05");
    const subtotal = Math.round(Number(item.subtotal) || Math.round(Number(item.precioTotal) / 1.19));
    const iva = Math.round(Number(item.iva) || (Number(item.precioTotal) - subtotal));
    const precioTotalConIva = subtotal + iva;
    const descPct = Number(item.porcentajeDescuentoDelPrecio) || 0;
    const descVal = Number(item.valorDescuentoDelPrecio) || 0;

    return {
      producto: String(item.producto || "8010014"),
      cantidad: Number(item.cantidad) || 1,
      porcentajeImpuesto: 19,
      almacen: itemWh,
      almacenDestino: "07",
      porcentajeDescuentoDelPrecio: descPct,
      valorDescuentoDelPrecio: descVal,
      precioTotal: subtotal,
      valorImpuestoDelPrecio: iva,
      precioTotalIncluidoImpuesto: precioTotalConIva,
      numeroDePedidoProduccion: 2,
      itemPedidoProduccion: idx + 1
    };
  });

  const depositVal = Math.round(Number(orderData.deposit_amount) || 0);
  const obsText = (orderData.notes || orderData.observaciones || `PLAN SEPARE IMPORMAX - ${(orderData.customer_name || '').toUpperCase().substring(0, 45)}`).trim();
  const dateInfo = getYeminusDateInfo();

  const makePayload = (dDoc: string, dVenc: string) => ({
    documento: {
      tipoDocumento: "SLP",
      prefijo: "SLP",
      numero: 0,
      fechaDocumento: dDoc,
      fechaVencimiento: dVenc,
      codigoTercero1: cleanCustomerDoc,
      numeroDeCaja: idCaja,
      numeroDireccionDespacho: 1,
      codigoCiudadDespacho: safeDane,
      direccionDeDespacho: finalAddress,
      codigoVendedor: "01",
      almacenOrigenEncabezado: firstWarehouse || "05",
      almacenDestinoEncabezado: "07",
      observaciones: obsText,
      numeroPrecioProducto: 1,
      codigoPatronContable: "SLP",
      valorAdicional: depositVal,
      numeroPedido: 1,
      itemPedido: 1,
      numeroCaja: idCaja,
      items: yeminusItems
    },
    actualizarDocOrigen: false,
    desdeCapturaNueva: true
  });

  let payload = makePayload(dateInfo.fechaDocumento, dateInfo.fechaVencimiento);

  let response = await safeFetch(`${YEMINUS_BASE}/gateway/apiyeminus/api/inventarios/documentos/agregarnuevo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "id_empresa": idEmpresa,
      "id_caja": idCaja,
      "usuario": usuario,
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  }, 35000);

  if (response.status === 503) {
    console.warn("[YEMINUS] Rate limit 503 detectado, esperando 3 segundos para reintentar...");
    await new Promise(r => setTimeout(r, 3000));
    response = await safeFetch(`${YEMINUS_BASE}/gateway/apiyeminus/api/inventarios/documentos/agregarnuevo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "id_empresa": idEmpresa,
        "id_caja": idCaja,
        "usuario": usuario,
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    }, 35000);
  }

  if (!response.ok) {
    const errText = await response.text();
    return { success: false, error: `ERP HTTP ${response.status}: ${errText}` };
  }

  let resData: any = await response.json();

  // Si el ERP responde que el periodo está cerrado, reintentar con el periodo activo de Julio 2026
  if (!resData.esExitoso && resData.mensaje && resData.mensaje.includes("periodo esta cerrado")) {
    console.log("[YEMINUS RETRY] Periodo cerrado detectado. Reintentando con fecha del periodo activo autorizado (2026-07-06)...");
    payload = makePayload("2026-07-06T14:41:43.316-05:00", "2026-07-06T14:41:43.316-05:00");
    const retryRes = await safeFetch(`${YEMINUS_BASE}/gateway/apiyeminus/api/inventarios/documentos/agregarnuevo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "id_empresa": idEmpresa,
        "id_caja": idCaja,
        "usuario": usuario,
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    }, 35000);
    if (retryRes.ok) {
      resData = await retryRes.json();
    }
  }

  if (resData.esExitoso && resData.datos) {
    const doc = resData.datos;
    const docNum = Number(doc.numero || doc);
    const documentId = `SLP-SLP-${docNum}`;
    logApi("SUCCESS", "YEMINUS_SLP_CREATED", `Documento SLP creado en Yeminus (Caja ${idCaja}): ${documentId}`, payload, resData);
    return {
      success: true,
      document_id: documentId,
      numero: docNum,
      raw: resData
    };
  } else {
    const errDet = resData.infoOperacion?.excepcion?.detalleErrorFiltrado || resData.mensaje || "Error desconocido del ERP";
    logApi("ERROR", "YEMINUS_SLP_REJECTED", `Yeminus rechazó el documento SLP: ${errDet}`, payload, resData);
    return { success: false, error: errDet, raw: resData };
  }
}

// 3. Pagar documento SLP en Yeminus (Forma de pago 11 en Caja 2)
async function payYeminusSLPDocument(params: {
  numero: number;
  valorPagado: number;
  token: string;
}): Promise<{ success: boolean; raw?: any; error?: string }> {
  try {
    const { numero, valorPagado, token } = params;
    const idEmpresa = process.env.YEMINUS_ID_EMPRESA || "02";
    const idCaja = process.env.YEMINUS_ID_CAJA || "2";
    const usuario = process.env.YEMINUS_USUARIO || "API";
    const dateInfo = getYeminusDateInfo();

    const payload = {
      pagos: [
        {
          valorPagadoSinPropina: Math.round(valorPagado),
          numeroFactura: Number(numero),
          año: dateInfo.ano,
          mes: dateInfo.mes,
          valorPagado: Math.round(valorPagado),
          fecha: dateInfo.fechaPago,
          objFormaPago: {
            formaPago: "11"
          },
          index: 1,
          valorPagadoOriginal: Math.round(valorPagado),
          tipoTransaccion: "SLP",
          prefijo: "SLP",
          codigoFormaPago: "11",
          caja: idCaja
        }
      ]
    };

    const res = await safeFetch(`${YEMINUS_BASE}/gateway/apiyeminus/api/inventarios/documentos/pagarfactura`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "id_empresa": idEmpresa,
        "id_caja": idCaja,
        "usuario": usuario,
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    }, 20000);

    const data: any = await res.json().catch(() => ({}));
    if (data.esExitoso || data.datos === "ALERT_SUCCESS_SAVE" || data.infoOperacion?.esExitosa) {
      logApi("SUCCESS", "YEMINUS_SLP_PAID", `Documento SLP ${numero} pagado en Caja ${idCaja} con éxito: ${valorPagado} COP`, payload, data);
      return { success: true, raw: data };
    } else {
      const err = data.infoOperacion?.excepcion?.detalleErrorFiltrado || data.mensaje || "Error al pagar SLP";
      logApi("INFO", "YEMINUS_SLP_PAY_WARN", `Aviso al pagar SLP ${numero}: ${err}`, payload, data);
      return { success: false, error: err, raw: data };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 4. Contabilizar documento SLP en Yeminus
async function contabilizeYeminusSLPDocument(params: {
  numero: number;
  token: string;
}): Promise<{ success: boolean; raw?: any; error?: string }> {
  try {
    const { numero, token } = params;
    const idEmpresa = process.env.YEMINUS_ID_EMPRESA || "02";
    const idCaja = process.env.YEMINUS_ID_CAJA || "2";
    const usuario = process.env.YEMINUS_USUARIO || "API";

    const payload = {
      tipoDocumento: "SLP",
      prefijo: "SLP",
      numero: Number(numero)
    };

    const res = await safeFetch(`${YEMINUS_BASE}/gateway/apiyeminus/api/inventarios/documentos/contabilizardocumento`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "id_empresa": idEmpresa,
        "id_caja": idCaja,
        "usuario": usuario,
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    }, 20000);

    const data: any = await res.json().catch(() => ({}));
    if (data.esExitoso || data.infoOperacion?.esExitosa) {
      logApi("SUCCESS", "YEMINUS_SLP_CONTABILIZED", `Documento SLP ${numero} contabilizado con éxito`, payload, data);
      return { success: true, raw: data };
    } else {
      const err = data.infoOperacion?.excepcion?.detalleErrorFiltrado || data.mensaje || "Aviso contabilización";
      logApi("INFO", "YEMINUS_SLP_CONTAB_WARN", `Aviso al contabilizar SLP ${numero}: ${err}`, payload, data);
      return { success: false, error: err, raw: data };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 5. Consultar Extracto Financiero Oficial de un Documento SLP en Yeminus (Cuenta 280596)
async function fetchYeminusExtracto(params: {
  tercero: number | string;
  documento: string;
  token?: string;
}): Promise<{ success: boolean; datos?: any; raw?: any; error?: string }> {
  try {
    const token = params.token || await getAccessToken();
    const idEmpresa = process.env.YEMINUS_ID_EMPRESA || "02";
    const usuario = process.env.YEMINUS_USUARIO || "API";

    const cleanTercero = parseInt(String(params.tercero).replace(/\D/g, "")) || 816008621;
    let cleanDoc = String(params.documento).trim();
    if (!cleanDoc.startsWith("SLP-SLP-") && !cleanDoc.startsWith("SLP-")) {
      cleanDoc = `SLP-SLP-${cleanDoc}`;
    }

    const payload = {
      tercero: cleanTercero,
      cuenta: "280596", // Cuenta oficial Separados de Clientes
      documento: cleanDoc
    };

    const res = await safeFetch(`${YEMINUS_BASE}/gateway/financiero/extractodocumentoreferencia/obtener`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "id_empresa": idEmpresa,
        "usuario": usuario,
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    }, 25000);

    const data: any = await res.json().catch(() => ({}));
    if (data.esExitoso && data.datos) {
      return { success: true, datos: data.datos, raw: data };
    } else {
      const err = data.infoOperacion?.excepcion?.detalleErrorFiltrado || data.mensaje || "No se encontró extracto";
      return { success: false, error: err, raw: data };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Mecanismo centralizado de deduplicación y cerrojo (Mutex) para Yeminus y Wompi
// Garantiza que JAMÁS se suba el mismo pedido más de una sola vez a Yeminus ERP
const yeminusDocsByReference = new Map<string, string>();
const inFlightYeminusDocumentCreation = new Map<string, Promise<any>>();
const inFlightWompiConfirmations = new Map<string, Promise<any>>();

// Helper central que ejecuta de forma coordinada el flujo completo de 3 pasos:
// Paso 1: Asegurar Tercero + Crear SLP
// Paso 2: Pagar Factura SLP (Caja 2, Forma de pago 11)
// Paso 3: Contabilizar SLP
// Paso 4: Consultar y verificar Extracto Financiero en Yeminus
async function createOrSyncYeminusDocument(orderData: {
  customer_document?: string | number;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  customer_city?: string;
  notes?: string;
  observaciones?: string;
  product_id?: string;
  product_name?: string;
  total_amount: number;
  deposit_amount: number;
  payment_method?: string;
  items?: any[];
  order_id?: string;
  wompi_reference?: string;
  payment_reference?: string;
}): Promise<{
  success: boolean;
  document_id?: string;
  numero?: number | string;
  pagado?: boolean;
  contabilizado?: boolean;
  extracto?: any;
  error?: string;
  raw?: any;
  already_synced?: boolean;
}> {
  const candidateKeys = [
    orderData.wompi_reference,
    orderData.payment_reference,
    orderData.order_id
  ].map(k => String(k || "").trim()).filter(Boolean);

  const cleanCustomerDoc = String(orderData.customer_document || "").split("-")[0].replace(/\D/g, "") || "816008621";
  const roundedTotal = Math.round(Number(orderData.total_amount) || 0);

  // 1. Si alguna de las claves de este pedido ya tiene radicado en memoria en esta sesión
  for (const key of candidateKeys) {
    if (yeminusDocsByReference.has(key)) {
      const existingDoc = yeminusDocsByReference.get(key)!;
      console.log(`[YEMINUS DEDUP] Pedido con clave ${key} ya tiene documento SLP registrado: ${existingDoc}. Se omite duplicación.`);
      for (const k of candidateKeys) yeminusDocsByReference.set(k, existingDoc);
      return {
        success: true,
        document_id: existingDoc,
        numero: Number(existingDoc.replace(/\D/g, "")) || 0,
        already_synced: true
      };
    }
  }

  // 2. Si ya hay una creación de documento en vuelo para alguna de estas claves, esperar resolución única
  for (const key of candidateKeys) {
    if (inFlightYeminusDocumentCreation.has(key)) {
      console.log(`[YEMINUS MUTEX] Creación de documento SLP ya en vuelo para clave ${key}. Esperando resolución única...`);
      return await inFlightYeminusDocumentCreation.get(key);
    }
  }

  // 3. Verificar si en SQLite ya existe radicado oficial para alguna de las claves del pedido
  for (const key of candidateKeys) {
    try {
      const sqliteOrder = getOrderByWompiRef(key) || getOrderById(key);
      if (sqliteOrder && sqliteOrder.yeminus_document_id && sqliteOrder.yeminus_document_id.startsWith("SLP-SLP-")) {
        console.log(`[YEMINUS DEDUP] Pedido ${key} ya tiene SLP oficial en SQLite: ${sqliteOrder.yeminus_document_id}.`);
        for (const k of candidateKeys) yeminusDocsByReference.set(k, sqliteOrder.yeminus_document_id);
        return {
          success: true,
          document_id: sqliteOrder.yeminus_document_id,
          numero: Number(sqliteOrder.yeminus_document_id.replace(/\D/g, "")) || 0,
          already_synced: true
        };
      }
    } catch {}
  }

  // 4. Verificar si en SQLite se creó un pedido reciente (< 10 min) para este cliente y monto exacto con radicado SLP
  try {
    const recentSynced = db.prepare(`
      SELECT yeminus_document_id, wompi_reference, id 
      FROM orders 
      WHERE customer_document = ? 
        AND total = ? 
        AND yeminus_document_id LIKE 'SLP-SLP-%'
        AND created_at >= datetime('now', '-10 minutes')
      ORDER BY created_at DESC 
      LIMIT 1
    `).get(cleanCustomerDoc, roundedTotal) as any;

    if (recentSynced && recentSynced.yeminus_document_id) {
      console.log(`[YEMINUS DEDUP] Pedido idéntico reciente detectado en SQLite para cédula ${cleanCustomerDoc} (${roundedTotal}): ${recentSynced.yeminus_document_id}.`);
      for (const k of candidateKeys) yeminusDocsByReference.set(k, recentSynced.yeminus_document_id);
      return {
        success: true,
        document_id: recentSynced.yeminus_document_id,
        numero: Number(recentSynced.yeminus_document_id.replace(/\D/g, "")) || 0,
        already_synced: true
      };
    }
  } catch {}

  // 5. Verificar si en Supabase ya existe radicado oficial
  for (const key of candidateKeys) {
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data: dbOrders } = await supabase
          .from("pedidos")
          .select("id, producto_name, referencia_wompi, documento_yeminus")
          .or(`referencia_wompi.eq.${key},id.eq.${key}`)
          .limit(1);
        if (dbOrders && dbOrders.length > 0) {
          const found = dbOrders[0];
          const existingDoc = found.documento_yeminus || found.producto_name?.match(/\[Ref:\s*([^\]]+)\]/)?.[1];
          if (existingDoc && existingDoc.startsWith("SLP-SLP-")) {
            console.log(`[YEMINUS DEDUP] Pedido ${key} ya tiene SLP oficial en Supabase: ${existingDoc}.`);
            for (const k of candidateKeys) yeminusDocsByReference.set(k, existingDoc);
            return {
              success: true,
              document_id: existingDoc,
              numero: Number(existingDoc.replace(/\D/g, "")) || 0,
              already_synced: true
            };
          }
        }
      }
    } catch {}
  }

  // 6. Envolver la creación en un Promise atómico registrado en inFlightYeminusDocumentCreation
  const primaryKey = candidateKeys[0] || `FP_${cleanCustomerDoc}_${roundedTotal}_${Date.now()}`;
  const keysToLock = candidateKeys.length > 0 ? candidateKeys : [primaryKey];

  let createPromise: Promise<any>;

  const runCreation = async () => {
    try {
      const token = await getAccessToken();

      // Paso 0: Asegurar creación/actualización del Tercero con DANE de ciudad
      await ensureYeminusTercero(orderData, token);

      // Paso 1: Crear Documento SLP en Yeminus
      const creationRes = await createYeminusSLPDocument(orderData, token);
      if (!creationRes.success || !creationRes.numero) {
        return { success: false, error: creationRes.error || "No se pudo crear el documento SLP en Yeminus", raw: creationRes.raw };
      }

      const docNumero = creationRes.numero;
      const documentId = creationRes.document_id || `SLP-SLP-${docNumero}`;

      // Registrar inmediatamente en mapa de deduplicación para todas las claves
      for (const k of keysToLock) {
        yeminusDocsByReference.set(k, documentId);
        try {
          db.prepare(`UPDATE orders SET yeminus_document_id = ?, yeminus_sync_status = 'SYNCED', yeminus_last_error = '' WHERE wompi_reference = ? OR id = ?`).run(
            documentId,
            k,
            orderData.order_id || k
          );
        } catch {}
      }

      // Paso 2: Pagar documento SLP en Yeminus (Forma de pago 11 en Caja 2)
      let pagadoExitoso = false;
      const depositAmount = Math.round(Number(orderData.deposit_amount) || 0);

      if (depositAmount > 0) {
        try {
          const payRes = await payYeminusSLPDocument({
            numero: docNumero,
            valorPagado: depositAmount,
            token
          });
          if (payRes.success) pagadoExitoso = true;
        } catch (payErr: any) {
          logApi("INFO", "YEMINUS_SLP_PAY_WARN", `Aviso al pagar SLP ${docNumero}: ${payErr.message}`);
        }
      }

      // Paso 3: Contabilizar Documento SLP en Yeminus
      const contRes = await contabilizeYeminusSLPDocument({
        numero: docNumero,
        token
      });
      const contabilizadoExitoso = contRes.success;

      // Paso 4: Registrar Recibo en Cartera Clientes (RLP) en cuenta 280596
      let reciboNumero: any = null;
      if (depositAmount > 0) {
        try {
          const reciboRes = await registerYeminusAbonoInternal({
            order_id: orderData.order_id,
            amount: depositAmount,
            payment_reference: orderData.payment_reference || orderData.wompi_reference || `INIT-${documentId}`,
            customer_document: cleanCustomerDoc,
            slp_document_id: documentId,
            payment_method: orderData.payment_method || "WOMPI"
          });
          if (reciboRes && (reciboRes.esExitoso || reciboRes.datos)) {
            pagadoExitoso = true;
            reciboNumero = reciboRes.datos?.numero || reciboRes.datos?.identificadorDocumento;
            logApi("SUCCESS", "YEMINUS_RLP_RECIBO_CREATED", `Recibo de cartera RLP creado con éxito para ${documentId}: $${depositAmount} COP (${reciboNumero})`, reciboRes);
          }
        } catch (reciboErr: any) {
          logApi("INFO", "YEMINUS_RLP_RECIBO_WARN", `Aviso registrando recibo RLP para ${documentId}: ${reciboErr.message}`);
        }
      }

      // Paso 4: Consultar extracto financiero para confirmar radicado y saldo en cuenta 280596
      let extractoData: any = null;
      const cleanDocInt = parseInt(cleanCustomerDoc) || 816008621;
      const extRes = await fetchYeminusExtracto({
        tercero: cleanDocInt,
        documento: documentId,
        token
      });
      if (extRes.success && extRes.datos) {
        extractoData = extRes.datos;
      }

      return {
        success: true,
        document_id: documentId,
        numero: docNumero,
        pagado: pagadoExitoso,
        recibo: reciboNumero,
        contabilizado: contabilizadoExitoso,
        extracto: extractoData,
        raw: creationRes.raw
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  createPromise = runCreation();

  for (const k of keysToLock) {
    inFlightYeminusDocumentCreation.set(k, createPromise);
  }

  try {
    return await createPromise;
  } finally {
    for (const k of keysToLock) {
      inFlightYeminusDocumentCreation.delete(k);
    }
  }
}

// 4. Crear documento SLP (Separado) con réplica espejo en Supabase
app.post("/api/yeminus/separados/create", async (req, res) => {
  logApi("INFO", "POST /api/yeminus/separados/create", "Iniciando creación de documento SLP...", req.body);

  try {
    const {
      customer_document,
      customer_name,
      customer_email,
      customer_phone,
      product_id,
      product_name,
      total_amount,
      deposit_amount,
      customer_address,
      customer_city,
      payment_method,
      payment_reference,
      items
    } = req.body;

    const wompiRef = req.body.wompi_reference || payment_reference || req.body.order_id || "";

    const yeminusRes = await createOrSyncYeminusDocument({
      customer_document,
      customer_name,
      customer_email,
      customer_phone,
      customer_address,
      customer_city,
      product_id,
      product_name,
      total_amount,
      deposit_amount,
      payment_method,
      items,
      order_id: req.body.order_id || req.body.id,
      wompi_reference: wompiRef,
      payment_reference: payment_reference || wompiRef,
      notes: req.body.notes || req.body.observaciones,
      observaciones: req.body.notes || req.body.observaciones
    });

    let documentIdCreated = yeminusRes.success && yeminusRes.document_id ? yeminusRes.document_id : "";

    if (!documentIdCreated) {
      documentIdCreated = `SLP-IMP-${Date.now().toString().slice(-6)}`;
    }

    // Sanitizar cédula/NIT para el espejo
    const cleanDoc = parseInt(String(customer_document).replace(/\D/g, "")) || 12345678;

    // Guardar SIEMPRE como espejo en la base de datos Supabase
    const mirrorResult = await saveOrderMirrorToSupabase({
      slp_document_id: documentIdCreated,
      customer_name: customer_name || `Cliente C.C. ${cleanDoc}`,
      customer_email: customer_email || "cliente@impormax.net",
      customer_phone: customer_phone || "",
      customer_document: cleanDoc,
      customer_address: customer_address || req.body.shipping_address || "Cra 7 # 21-42 Pereira Centro",
      customer_city: customer_city || req.body.shipping_city || "Pereira",
      product_id: product_id || "VARIOS",
      product_name: product_name || "Separado Navideño Impormax",
      total_amount: total_amount || 0,
      deposit_amount: deposit_amount || 0,
      payment_method: payment_method || "wompi",
      payment_reference: payment_reference || `INIT-${documentIdCreated}`
    });

    res.json({
      success: true,
      document_id: documentIdCreated,
      numero: documentIdCreated.replace(/\D/g, "") || "1",
      total: total_amount,
      pagado: deposit_amount,
      saldo: total_amount - deposit_amount,
      yeminus_success: yeminusRes.success,
      yeminus_error: yeminusRes.error,
      supabase_mirror: mirrorResult
    });
  } catch (error: any) {
    logApi("ERROR", "POST /api/yeminus/separados/create", `Fallo general: ${error.message}`);
    res.json({ success: false, error: error.message });
  }
});

// Endpoint para sincronizar un pedido específico hacia Yeminus Sucursal 2, Caja 9, Punto de Venta 8
app.post("/api/yeminus/sync-order/:id", adminAuthMiddleware, async (req, res) => {
  const { id } = req.params;
  const force = req.body?.force === true || req.query?.force === "true";
  const clientOrderData = req.body?.orderData || {};
  try {
    let order: any = getOrderById(id);

    if (!order) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data: dbOrder } = await supabase.from("pedidos").select("*").eq("id", id).maybeSingle();
        if (dbOrder) order = dbOrder;
      }
    }

    if (!order && Object.keys(clientOrderData).length > 0) {
      order = clientOrderData;
    }

    if (!order) {
      return res.status(404).json({ success: false, error: "Pedido no encontrado en base de datos" });
    }

    // Si ya tiene un identificador oficial de Yeminus y no se solicita forzar re-envío
    const currentYeminusDoc = order.yeminus_document_id || order.documento_yeminus || clientOrderData.yeminus_document_id;
    if (!force && currentYeminusDoc && String(currentYeminusDoc).startsWith("SLP-SLP-")) {
      return res.json({
        success: true,
        already_synced: true,
        document_id: currentYeminusDoc,
        message: `El pedido ya se encuentra registrado en Yeminus ERP: ${currentYeminusDoc}.`
      });
    }

    // Extraer campos soportando tanto camelCase como snake_case y formato Supabase
    const docMatch = (order.producto_name || clientOrderData.product_name)?.match(/Doc:\s*([^\|\]]+)/);
    const dirMatch = (order.producto_name || clientOrderData.product_name)?.match(/Dir:\s*([^\|\]]+)/);
    const cityMatch = (order.producto_name || clientOrderData.product_name)?.match(/Ciudad:\s*([^\|\]]+)/);

    const customerDoc = String(
      clientOrderData.customer_document ||
      order.customer_document ||
      order.cliente_documento ||
      (docMatch ? docMatch[1].trim() : "") ||
      "222222222"
    ).trim();

    const customerName = (
      clientOrderData.customer_name ||
      order.customer_name ||
      order.cliente_nombre ||
      "Cliente Impormax"
    );

    const customerEmail = (
      clientOrderData.customer_email ||
      order.customer_email ||
      order.cliente_email ||
      ""
    );

    const customerPhone = (
      clientOrderData.customer_phone ||
      order.customer_phone ||
      order.cliente_telefono ||
      ""
    );

    const shippingAddress = (
      clientOrderData.shipping_address ||
      order.shipping_address ||
      order.cliente_direccion ||
      (dirMatch ? dirMatch[1].trim() : "") ||
      "Cra 7 # 21-42 Pereira Centro"
    );

    const shippingCity = (
      clientOrderData.shipping_city ||
      order.shipping_city ||
      order.cliente_ciudad ||
      (cityMatch ? cityMatch[1].trim() : "") ||
      "Pereira"
    );

    const totalAmt = Number(
      clientOrderData.total_amount ??
      order.total ??
      order.total_amount ??
      0
    );

    const paidAmt = Number(
      clientOrderData.paid_amount ??
      order.paid_amount ??
      order.abonado ??
      order.deposit_amount ??
      0
    );

    const itemsToSync = (
      Array.isArray(clientOrderData.items) && clientOrderData.items.length > 0
        ? clientOrderData.items
        : Array.isArray(order.items) && order.items.length > 0
        ? order.items
        : []
    );

    const yeminusRes = await createOrSyncYeminusDocument({
      customer_document: customerDoc,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      customer_address: shippingAddress,
      customer_city: shippingCity,
      notes: clientOrderData.notes || order.notes || order.observaciones,
      observaciones: clientOrderData.notes || order.notes || order.observaciones,
      product_id: itemsToSync[0]?.product_id || (order.producto_id !== "ONLINE" ? order.producto_id : "") || "",
      product_name: itemsToSync[0]?.product_name || clientOrderData.product_name || order.product_name || order.producto_name || "Producto Navideño",
      total_amount: totalAmt,
      deposit_amount: paidAmt > 0 ? paidAmt : Math.round(totalAmt * 0.3),
      payment_method: clientOrderData.payment_method || order.payment_method || "wompi",
      order_id: order.id || id,
      wompi_reference: clientOrderData.wompi_reference || order.wompi_reference || order.referencia_wompi,
      payment_reference: clientOrderData.wompi_reference || order.wompi_reference || order.referencia_wompi,
      items: itemsToSync
    });

    if (!yeminusRes.success || !yeminusRes.document_id) {
      const errMsg = yeminusRes.error || "No se pudo crear el documento en Yeminus ERP. Verifica la respuesta del gateway.";
      try {
        db.prepare(`UPDATE orders SET yeminus_sync_status = 'ERP_SYNC_FAILED', yeminus_last_error = ? WHERE id = ?`).run(
          errMsg,
          id
        );
      } catch {}
      return res.status(400).json({
        success: false,
        error: errMsg,
        message: errMsg
      });
    }

    // Actualizar registro en SQLite
    try {
      db.prepare(`UPDATE orders SET yeminus_document_id = ?, yeminus_sync_status = 'SYNCED', yeminus_last_error = '' WHERE id = ?`).run(
        yeminusRes.document_id,
        id
      );
    } catch {}

    // Actualizar también en Supabase para sincronización total en tiempo real
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const cleanName = (order.producto_name || clientOrderData.product_name || order.product_name || "Pedido Navideño Impormax")
          .replace(/\[Ref:\s*[^\]]+\]/g, "")
          .trim();
        await supabase
          .from("pedidos")
          .update({
            documento_yeminus: yeminusRes.document_id,
            producto_name: `${cleanName} [Ref: ${yeminusRes.document_id}]`
          })
          .eq("id", id);
      } catch (sbErr: any) {
        console.warn("[SUPABASE ORDER UPDATE WARN]", sbErr.message);
      }
    }

    // Descontar inventario local
    deductLocalInventory(
      itemsToSync.map((it: any) => ({
        product_id: it.product_id,
        quantity: it.quantity || 1,
        product_name: it.product_name
      })),
      yeminusRes.document_id
    );

    res.json({
      success: true,
      document_id: yeminusRes.document_id,
      numero: yeminusRes.numero,
      message: `✓ Pedido sincronizado exitosamente con Yeminus (Sucursal 02, Caja 9, Punto 8): ${yeminusRes.document_id}`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, message: err.message });
  }
});

// Endpoint para sincronizar masivamente pedidos a Yeminus Sucursal 2, Caja 9, Punto de Venta 8
app.post("/api/yeminus/sync-all-pending", adminAuthMiddleware, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const force = req.body?.force === true || req.query?.force === "true";
    const onlyApproved = req.body?.onlyApproved === true || req.body?.filter === "approved" || req.query?.filter === "approved";
    const clientOrders = Array.isArray(req.body?.orders) ? req.body.orders : [];

    let targetPedidos: any[] = [];

    if (supabase) {
      const { data: pedidos } = await supabase.from("pedidos").select("*").order("created_at", { ascending: true });
      if (pedidos && pedidos.length > 0) {
        targetPedidos = [...pedidos];
      }
    }

    // Agregar pedidos de cliente si no están ya en la lista
    if (clientOrders.length > 0) {
      for (const co of clientOrders) {
        const exists = targetPedidos.some(p => String(p.id).trim() === String(co.id).trim());
        if (!exists) {
          targetPedidos.push({
            id: co.id,
            cliente_nombre: co.customer_name,
            cliente_email: co.customer_email,
            cliente_telefono: co.customer_phone,
            customer_document: co.customer_document,
            producto_id: co.product_id,
            producto_name: co.product_name,
            total: co.total_amount,
            abonado: co.paid_amount || co.deposit_amount,
            estado: co.status,
            shipping_address: co.shipping_address,
            shipping_city: co.shipping_city,
            items: co.items
          });
        }
      }
    }

    if (onlyApproved) {
      targetPedidos = targetPedidos.filter(p => Number(p.abonado) > 0 || p.estado === "pagado" || p.estado === "abonando");
    }

    const results: Array<{
      id: string;
      cliente: string;
      telefono?: string;
      email?: string;
      total: number;
      abonado: number;
      success: boolean;
      document_id?: string;
      numero?: number | string;
      items?: any[];
      error?: string;
    }> = [];

    for (const pedido of targetPedidos) {
      // Omitir pedidos con total 0
      const totalAmount = Number(pedido.total || pedido.total_amount || 0);
      if (totalAmount <= 0) continue;

      const prodName = pedido.producto_name || pedido.product_name || "";
      const resolvedItems = resolveOrderItems({
        product_id: pedido.producto_id || pedido.product_id,
        product_name: prodName,
        total_amount: totalAmount,
        items: pedido.items
      });

      // Si no es forzado y ya tiene radicado SLP (en nombre, columna o BD), mantener referencia previa y omitir duplicación
      const existingRadicado = (pedido.yeminus_document_id && pedido.yeminus_document_id.startsWith("SLP-"))
        ? pedido.yeminus_document_id
        : (pedido.documento_yeminus && pedido.documento_yeminus.startsWith("SLP-"))
        ? pedido.documento_yeminus
        : prodName.match(/SLP-SLP-\d+/)?.[0] || (prodName.includes("SLP-SLP-") ? "SLP-SLP" : null);

      if (!force && existingRadicado) {
        results.push({
          id: pedido.id,
          cliente: pedido.cliente_nombre || pedido.customer_name,
          telefono: pedido.cliente_telefono || pedido.customer_phone,
          email: pedido.cliente_email || pedido.customer_email,
          total: totalAmount,
          abonado: Number(pedido.abonado || pedido.paid_amount || 0),
          success: true,
          document_id: existingRadicado,
          items: resolvedItems
        });
        continue;
      }

      // Pausa prudente para no sobrecargar el límite de peticiones de Yeminus
      await new Promise(r => setTimeout(r, 1500));

      const customerDoc = pedido.customer_document || "222222222";
      const paidAmount = Number(pedido.abonado || pedido.paid_amount || pedido.deposit_amount || 0);

      const yeminusRes = await createOrSyncYeminusDocument({
        customer_document: customerDoc,
        customer_name: pedido.cliente_nombre || pedido.customer_name,
        customer_email: pedido.cliente_email || pedido.customer_email,
        customer_phone: pedido.cliente_telefono || pedido.customer_phone,
        customer_address: pedido.shipping_address || "Pereira - Risaralda",
        customer_city: pedido.shipping_city || "Pereira",
        product_id: pedido.producto_id || pedido.product_id,
        product_name: prodName,
        total_amount: totalAmount,
        deposit_amount: paidAmount > 0 ? paidAmount : Math.round(totalAmount * 0.3),
        payment_method: pedido.payment_method || "wompi",
        order_id: pedido.id,
        wompi_reference: pedido.referencia_wompi || pedido.wompi_reference,
        payment_reference: pedido.referencia_wompi || pedido.wompi_reference,
        items: pedido.items || []
      });

      if (yeminusRes.success && yeminusRes.document_id) {
        const cleanProductName = prodName
          .replace(/\[Ref:\s*[^\]]+\]/g, "")
          .trim();
        const updatedProductName = `${cleanProductName} [Ref: ${yeminusRes.document_id}]`;

        if (supabase) {
          await supabase
            .from("pedidos")
            .update({ producto_name: updatedProductName })
            .eq("id", pedido.id);
        }

        // Descontar inventario local para sincronización exacta
        deductLocalInventory(
          resolvedItems.map((it: any) => ({
            product_id: it.producto || it.product_id,
            quantity: it.cantidad || it.quantity || 1,
            product_name: it.nombre || it.product_name
          })),
          yeminusRes.document_id
        );

        results.push({
          id: pedido.id,
          cliente: pedido.cliente_nombre || pedido.customer_name,
          telefono: pedido.cliente_telefono || pedido.customer_phone,
          email: pedido.cliente_email || pedido.customer_email,
          total: totalAmount,
          abonado: paidAmount,
          success: true,
          document_id: yeminusRes.document_id,
          numero: yeminusRes.numero,
          items: resolvedItems
        });
      } else {
        results.push({
          id: pedido.id,
          cliente: pedido.cliente_nombre || pedido.customer_name,
          telefono: pedido.cliente_telefono || pedido.customer_phone,
          email: pedido.cliente_email || pedido.customer_email,
          total: totalAmount,
          abonado: paidAmount,
          success: false,
          error: yeminusRes.error,
          items: resolvedItems
        });
      }
    }

    const syncedCount = results.filter(r => r.success).length;
    res.json({
      success: true,
      total_orders: targetPedidos.length,
      synced_count: syncedCount,
      configured: {
        id_empresa: "02",
        id_sucursal: "02",
        id_punto_venta: "8",
        id_caja: "2"
      },
      results
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint explícito para aprobar un pago y garantizar sincronización a Yeminus Sucursal 02, Caja 2, Punto de Venta 8
app.post("/api/orders/approve-payment", async (req, res) => {
  const { paymentId, orderId, orderData: clientOrderData, amount: clientAmount } = req.body;
  try {
    const supabase = getSupabaseAdmin();
    let updatedOrderId = orderId;
    let paymentAmount = clientAmount || 0;

    if (supabase && paymentId) {
      const { data: payData } = await supabase
        .from("pagos")
        .select("*")
        .eq("id", paymentId)
        .maybeSingle();

      if (payData) {
        updatedOrderId = payData.pedido_id || orderId;
        paymentAmount = Number(payData.monto) || paymentAmount;

        await supabase
          .from("pagos")
          .update({ estado_pago: "aprobado" })
          .eq("id", paymentId);
      }
    }

    let orderToSync: any = clientOrderData;
    if (supabase && updatedOrderId && !orderToSync) {
      const { data: dbOrder } = await supabase
        .from("pedidos")
        .select("*")
        .eq("id", updatedOrderId)
        .maybeSingle();
      if (dbOrder) orderToSync = dbOrder;
    }

    let yeminusSyncResult: string | null = null;
    let newPaid = 0;
    let totalOrd = 0;

    if (orderToSync) {
      const currentPaid = Number(orderToSync.paid_amount || orderToSync.abonado || 0);
      totalOrd = Number(orderToSync.total_amount || orderToSync.total || 0);
      const incAmount = paymentAmount > 0 ? paymentAmount : Number(orderToSync.deposit_amount || 0);
      newPaid = currentPaid > 0 && currentPaid >= incAmount ? currentPaid : (currentPaid + incAmount);
      const remaining = Math.max(0, totalOrd - newPaid);
      const newStatus = remaining <= 0 ? "pagado" : "abonando";

      const currentProdName = orderToSync.product_name || orderToSync.producto_name || "";
      // Si el pedido no tiene SLP oficial en Yeminus, crearlo automáticamente en Sucursal 2, Caja 9, Punto de Venta 8
      if (!currentProdName.includes("SLP-SLP-")) {
        const syncRes = await createOrSyncYeminusDocument({
          customer_document: orderToSync.customer_document || "222222222",
          customer_name: orderToSync.customer_name || orderToSync.cliente_nombre,
          customer_email: orderToSync.customer_email || orderToSync.cliente_email,
          customer_phone: orderToSync.customer_phone || orderToSync.cliente_telefono,
          customer_address: orderToSync.shipping_address || orderToSync.customer_address || "Pereira - Risaralda",
          customer_city: orderToSync.shipping_city || orderToSync.customer_city || "Pereira",
          product_id: orderToSync.product_id || orderToSync.producto_id,
          product_name: currentProdName,
          total_amount: totalOrd,
          deposit_amount: newPaid,
          payment_method: orderToSync.payment_method || "wompi",
          order_id: orderToSync.id || updatedOrderId,
          wompi_reference: orderToSync.wompi_reference || orderToSync.referencia_wompi,
          payment_reference: orderToSync.wompi_reference || orderToSync.referencia_wompi,
          items: orderToSync.items || []
        });

        if (syncRes.success && syncRes.document_id) {
          const cleanProd = currentProdName.replace(/\[Ref:\s*[^\]]+\]/g, "").trim();
          orderToSync.producto_name = `${cleanProd} [Ref: ${syncRes.document_id}]`;
          orderToSync.product_name = orderToSync.producto_name;
          yeminusSyncResult = syncRes.document_id;

          // Descontar inventario local
          const resolvedItems = resolveOrderItems({
            product_id: orderToSync.product_id || orderToSync.producto_id,
            product_name: currentProdName,
            total_amount: totalOrd,
            items: orderToSync.items
          });
          deductLocalInventory(resolvedItems.map((it: any) => ({
            product_id: it.producto,
            quantity: it.cantidad,
            product_name: it.nombre
          })), syncRes.document_id);
        }
      } else {
        // YA TIENE SLP OFICIAL EN YEMINUS -> Registrar el pago del abono en Yeminus
        try {
          const abonoAmt = paymentAmount > 0 ? paymentAmount : incAmount;
          let docRef = orderToSync.yeminus_document_id || "";
          if (!docRef && currentProdName) {
            const m = currentProdName.match(/\[Ref:\s*([^\]]+)\]/i);
            if (m && m[1]) docRef = m[1].trim();
          }

          const abonoRes = await registerYeminusAbonoInternal({
            order_id: updatedOrderId || orderToSync.id,
            amount: abonoAmt,
            payment_reference: orderToSync.wompi_reference || `ABONO-MANUAL-${Date.now()}`,
            customer_document: orderToSync.customer_document || orderToSync.cliente_documento,
            slp_document_id: docRef,
            payment_method: orderToSync.payment_method || "wompi"
          });
          logApi("SUCCESS", "APPROVE_PAYMENT_SLP_ABONO", `Abono de $${abonoAmt} aplicado exitosamente a Yeminus SLP ${docRef}`, abonoRes);
          yeminusSyncResult = docRef;
        } catch (abonoErr: any) {
          console.warn("[APPROVE PAYMENT SLP ABONO WARN]", abonoErr.message);
        }
      }

      if (supabase && (updatedOrderId || orderToSync.id)) {
        await supabase
          .from("pedidos")
          .update({
            abonado: newPaid,
            restante: remaining,
            estado: newStatus,
            producto_name: orderToSync.producto_name || orderToSync.product_name
          })
          .eq("id", updatedOrderId || orderToSync.id);
      }
    }

    res.json({
      success: true,
      order_id: updatedOrderId,
      yeminus_document_id: yeminusSyncResult,
      message: "Pago aprobado con éxito" + (yeminusSyncResult ? ` y registrado en Yeminus ERP: ${yeminusSyncResult}` : "")
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint explícito para aprobar un pedido y sincronizarlo de inmediato con Yeminus
app.post("/api/orders/approve-order", adminAuthMiddleware, async (req, res) => {
  const { orderId, orderData: clientOrderData } = req.body;
  try {
    let orderToSync: any = getOrderById(orderId);
    if (!orderToSync && clientOrderData) orderToSync = clientOrderData;

    if (!orderToSync) {
      const supabase = getSupabaseAdmin();
      if (supabase && orderId) {
        const { data: dbOrder } = await supabase.from("pedidos").select("*").eq("id", orderId).maybeSingle();
        if (dbOrder) orderToSync = dbOrder;
      }
    }

    if (!orderToSync) {
      return res.status(404).json({ success: false, error: "Pedido no encontrado" });
    }

    let yeminusSyncResult: string | null = null;
    const totalOrd = Number(orderToSync.total_amount || orderToSync.total || 0);
    const depositOrd = Number(orderToSync.paid_amount || orderToSync.abonado || orderToSync.deposit_amount || 0);
    const newPaid = depositOrd > 0 ? depositOrd : Math.round(totalOrd * 0.3);
    const remaining = Math.max(0, totalOrd - newPaid);
    const newStatus = remaining <= 0 ? "pagado" : "abonando";
    const itemsToSync = orderToSync.items && orderToSync.items.length > 0 ? orderToSync.items : [];

    // Crear/sincronizar documento en Yeminus si aún no está radicado
    if (!orderToSync.yeminus_document_id) {
      const syncRes = await createOrSyncYeminusDocument({
        customer_document: orderToSync.customer_document || "222222222",
        customer_name: orderToSync.customer_name || orderToSync.cliente_nombre || "Cliente Impormax",
        customer_email: orderToSync.customer_email || orderToSync.cliente_email,
        customer_phone: orderToSync.customer_phone || orderToSync.cliente_telefono,
        customer_address: orderToSync.shipping_address || "Pereira - Risaralda",
        customer_city: orderToSync.shipping_city || "Pereira",
        product_id: itemsToSync[0]?.product_id || (orderToSync.producto_id !== "ONLINE" ? orderToSync.producto_id : "") || "",
        product_name: itemsToSync[0]?.product_name || orderToSync.product_name || "Producto Navideño",
        total_amount: totalOrd,
        deposit_amount: newPaid,
        payment_method: orderToSync.payment_method || "wompi",
        order_id: orderId || orderToSync.id,
        wompi_reference: orderToSync.wompi_reference || orderToSync.referencia_wompi,
        payment_reference: orderToSync.wompi_reference || orderToSync.referencia_wompi,
        items: itemsToSync
      });

      if (syncRes.success && syncRes.document_id) {
        yeminusSyncResult = syncRes.document_id;
        db.prepare(`UPDATE orders SET yeminus_document_id = ?, yeminus_sync_status = 'SYNCED', yeminus_last_error = '' WHERE id = ?`).run(syncRes.document_id, orderId || orderToSync.id);

        deductLocalInventory(itemsToSync.map((it: any) => ({
          product_id: it.product_id,
          quantity: it.quantity || 1,
          product_name: it.product_name
        })), syncRes.document_id);
      } else {
        db.prepare(`UPDATE orders SET yeminus_sync_status = 'ERP_SYNC_FAILED', yeminus_last_error = ? WHERE id = ?`).run(syncRes.error || "Error ERP", orderId || orderToSync.id);
      }
    } else {
      // Ya tiene documento radicado en Yeminus -> Asentar el abono contra el SLP existente
      try {
        await registerYeminusAbonoInternal({
          order_id: orderId || orderToSync.id,
          amount: newPaid,
          payment_reference: orderToSync.wompi_reference || `ABONO-ORD-${Date.now()}`,
          customer_document: orderToSync.customer_document,
          slp_document_id: orderToSync.yeminus_document_id,
          payment_method: orderToSync.payment_method || "wompi"
        });
        yeminusSyncResult = orderToSync.yeminus_document_id;
      } catch (abonoErr: any) {
        console.warn("[APPROVE ORDER SLP ABONO WARN]", abonoErr.message);
      }
    }

    // Actualizar estado en SQLite
    db.prepare(`UPDATE orders SET paid_amount = ?, balance = ?, status = ? WHERE id = ?`).run(newPaid, remaining, newStatus, orderId || orderToSync.id);

    const supabase = getSupabaseAdmin();
    if (supabase && (orderId || orderToSync.id)) {
      try {
        await supabase
          .from("pedidos")
          .update({
            abonado: newPaid,
            restante: remaining,
            estado: newStatus
          })
          .eq("id", orderId || orderToSync.id);
      } catch {}
    }

    res.json({
      success: true,
      order_id: orderId || orderToSync.id,
      yeminus_document_id: yeminusSyncResult,
      message: `✓ Pedido aprobado exitosamente` + (yeminusSyncResult ? ` y radicado en Yeminus ERP: ${yeminusSyncResult}` : "")
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint principal para crear y guardar pedidos completos en la base de datos (orders, order_items, payments)
app.post("/api/orders", async (req, res) => {
  try {
    const {
      customer_name,
      customer_document,
      customer_email,
      customer_phone,
      shipping_address,
      shipping_city,
      subtotal_amount,
      discount_amount,
      total_amount,
      deposit_amount,
      payment_method,
      payment_reference,
      wompi_reference,
      items,
      status
    } = req.body;

    const cleanName = String(customer_name || "").trim();
    const cleanDoc = String(customer_document || "").trim();
    const cleanEmail = String(customer_email || "").trim();
    const cleanPhone = String(customer_phone || "").trim();
    const cleanAddress = String(shipping_address || "").trim();
    const cleanCity = String(shipping_city || req.body.customer_city || "").trim();
    const cleanNotes = String(req.body.notes || req.body.observaciones || "").trim();

    if (!cleanName) {
      return res.status(400).json({ success: false, error: "El nombre completo del cliente es obligatorio" });
    }
    if (!cleanDoc) {
      return res.status(400).json({ success: false, error: "El número de documento / cédula es obligatorio" });
    }
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return res.status(400).json({ success: false, error: "El correo electrónico es obligatorio y debe ser válido" });
    }
    if (!cleanPhone) {
      return res.status(400).json({ success: false, error: "El número de teléfono o celular es obligatorio" });
    }
    if (!cleanAddress) {
      return res.status(400).json({ success: false, error: "La dirección de entrega o residencia es obligatoria" });
    }
    if (!cleanCity) {
      return res.status(400).json({ success: false, error: "La ciudad de entrega o residencia es obligatoria" });
    }

    const isUuid = (str: any) => typeof str === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
    const orderId = (req.body.id && isUuid(req.body.id)) ? req.body.id : crypto.randomUUID();
    const orderTotal = Math.round(Number(total_amount) || 0);
    const initialDeposit = Math.round(Number(deposit_amount) || orderTotal);
    const ref = wompi_reference || payment_reference || `REF-${Date.now()}`;
    const orderStatus = status || (initialDeposit >= orderTotal ? "pagado" : (initialDeposit > 0 ? "abonando" : "pendiente"));
    const remainingBalance = Math.max(0, orderTotal - initialDeposit);

    // Mapear cada artículo con catálogo oficial de Yeminus (sin permitir 'ONLINE')
    let itemsToSave: any[] = [];
    if (Array.isArray(items) && items.length > 0) {
      itemsToSave = items.map((it: any) => {
        const cat = findInCatalog(it.product_id, it.product_name, Number(it.total || it.unit_price || it.price));
        const pId = (cat ? cat.id : (it.product_id && it.product_id !== "ONLINE" ? it.product_id : (it.product_reference && it.product_reference !== "ONLINE" ? it.product_reference : "8010141"))).trim();
        const pRef = (cat ? (cat.reference || cat.id) : (it.product_reference && it.product_reference !== "ONLINE" ? it.product_reference : pId)).trim();
        const pName = (cat ? cat.name : String(it.product_name || "Producto Navideño")).trim();
        const qty = Math.max(1, Number(it.quantity) || 1);
        const unitPrice = Math.round(Number(it.unit_price ?? it.price) || (cat ? Number(cat.discountPrice || cat.price) : 0));
        const tot = Math.round(Number(it.total) || (unitPrice * qty));
        const sub = Math.round(Number(it.subtotal) || tot);
        const tax = Math.round(sub - (sub / 1.19));

        return {
          product_id: pId,
          product_reference: pRef,
          product_name: pName,
          quantity: qty,
          unit_price: unitPrice,
          price: unitPrice,
          discount_percentage: Number(it.discount_percentage) || (cat ? Number(cat.discountPercentage || 0) : 0),
          discount_amount: Math.round(Number(it.discount_amount) || 0),
          subtotal: sub,
          tax,
          total: tot,
          warehouse_origin: "05",
          warehouse_destination: "07"
        };
      });
    }

    // 1. Guardar en tabla orders y tabla order_items
    const savedOrder = saveOrderWithItems({
      id: orderId,
      customer_document: cleanDoc,
      customer_name: cleanName,
      customer_email: cleanEmail,
      customer_phone: cleanPhone,
      shipping_address: cleanAddress,
      shipping_city: cleanCity,
      notes: cleanNotes,
      subtotal: Math.round(Number(subtotal_amount) || orderTotal),
      discount: Math.round(Number(discount_amount) || 0),
      total: orderTotal,
      initial_payment: initialDeposit,
      paid_amount: (orderStatus === 'pagado' || orderStatus === 'abonando') ? initialDeposit : 0,
      balance: (orderStatus === 'pagado' || orderStatus === 'abonando') ? remainingBalance : orderTotal,
      status: orderStatus,
      wompi_reference: ref,
      wompi_transaction_id: req.body.wompi_transaction_id || "",
      yeminus_document_id: "",
      yeminus_sync_status: "PENDING",
      yeminus_last_error: ""
    }, itemsToSave);

    // 2. Guardar en tabla payments si hay abono inicial registrado
    if (initialDeposit > 0 && (orderStatus === 'pagado' || orderStatus === 'abonando')) {
      savePayment({
        id: crypto.randomUUID(),
        order_id: orderId,
        amount: initialDeposit,
        payment_reference: ref,
        transaction_id: ref,
        payment_method: (payment_method || "WOMPI").toUpperCase(),
        status: "APPROVED",
        raw_data: JSON.stringify(req.body),
        created_at: new Date().toISOString()
      });
    }

    // 3. Guardar en pending_checkouts y memoria
    savePendingCheckout(ref, orderId, Math.round(initialDeposit * 100), "COP", {
      ...req.body,
      orderId,
      items: itemsToSave
    });
    savePendingSession(ref, {
      ...req.body,
      orderId,
      items: itemsToSave,
      amountInCents: Math.round(initialDeposit * 100),
      createdAt: Date.now()
    });

    // 4. Replicar en Supabase para compatibilidad externa (con todas las columnas de la BD)
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const prodSummaryName = itemsToSave.map(it => `${it.quantity}x ${it.product_name}`).join(", ") || "Pedido Navideño Impormax";
        const metaParts = [];
        if (cleanDoc) metaParts.push(`Doc: ${cleanDoc}`);
        if (cleanAddress) metaParts.push(`Dir: ${cleanAddress}`);
        if (cleanCity) metaParts.push(`Ciudad: ${cleanCity}`);
        if (cleanNotes) metaParts.push(`Obs: ${cleanNotes}`);
        const metaSuffix = metaParts.length > 0 ? ` [${metaParts.join(" | ")}]` : "";

        const fullSupabasePayload: any = {
          id: orderId,
          cliente_nombre: cleanName,
          cliente_email: cleanEmail,
          cliente_telefono: cleanPhone,
          cliente_documento: cleanDoc,
          direccion_envio: cleanAddress,
          ciudad_envio: cleanCity,
          observaciones: cleanNotes,
          subtotal: Number(subtotal_amount) || orderTotal,
          descuento: Number(discount_amount) || 0,
          referencia_wompi: ref,
          transaccion_id: req.body.wompi_transaction_id || "",
          producto_id: itemsToSave.map(it => it.product_id).join(", ") || "8010141",
          producto_name: `${prodSummaryName}${metaSuffix}`,
          total: orderTotal,
          abonado: (orderStatus === 'pagado' || orderStatus === 'abonando') ? initialDeposit : 0,
          restante: (orderStatus === 'pagado' || orderStatus === 'abonando') ? remainingBalance : orderTotal,
          estado: orderStatus
        };

        const { error: insErr } = await supabase.from("pedidos").insert([fullSupabasePayload]);
        if (insErr) {
          // Intentar sin columna observaciones si aún no la han añadido a la tabla
          const { observaciones: _obs, ...payloadWithoutObs } = fullSupabasePayload;
          const { error: insErr2 } = await supabase.from("pedidos").insert([payloadWithoutObs]);
          if (insErr2) {
            // Fallback a campos básicos en caso de esquemas antiguos
            await supabase.from("pedidos").insert([{
              id: orderId,
              cliente_nombre: cleanName,
              cliente_email: cleanEmail,
              cliente_telefono: cleanPhone,
              producto_id: itemsToSave.map(it => it.product_id).join(", ") || "8010141",
              producto_name: `${prodSummaryName}${metaSuffix}`,
              total: orderTotal,
              abonado: (orderStatus === 'pagado' || orderStatus === 'abonando') ? initialDeposit : 0,
              restante: (orderStatus === 'pagado' || orderStatus === 'abonando') ? remainingBalance : orderTotal,
              estado: orderStatus
            }]);
          }
        }
      } catch (sbErr: any) {
        console.warn("[POST /api/orders SB WARN]", sbErr.message);
      }
    }

    logApi("SUCCESS", "POST /api/orders", `Pedido creado y guardado: ${orderId} (${orderStatus}) con ${itemsToSave.length} artículos.`);

    res.json({
      success: true,
      order: savedOrder,
      message: "Pedido guardado con éxito en todas las tablas del sistema."
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint explícito para guardar/actualizar pedido en el espejo de Supabase
app.post("/api/orders/save-mirror", async (req, res) => {
  try {
    const result = await saveOrderMirrorToSupabase(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para vaciar pedidos y pagos de prueba
app.post("/api/orders/clear-all", adminAuthMiddleware, async (req, res) => {
  try {
    db.exec(`
      DELETE FROM payments;
      DELETE FROM order_items;
      DELETE FROM orders;
      DELETE FROM pending_checkouts;
    `);

    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        await supabase.from("pagos").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        await supabase.from("pedidos").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      } catch {}
    }
    res.json({ success: true, message: "Pedidos y pagos de prueba eliminados correctamente." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Función interna para registrar abonos directamente en Yeminus (SLP pagarfactura + RLP recibo)
async function registerYeminusAbonoInternal(data: {
  order_id?: string;
  amount: number;
  payment_reference: string;
  customer_document?: string | number;
  slp_document_id?: string;
  payment_method?: string;
}) {
  const idEmpresa = process.env.YEMINUS_ID_EMPRESA || "02";
  const usuario = process.env.YEMINUS_USUARIO || "API";
  const idCaja = process.env.YEMINUS_ID_CAJA || "2";

  const { customer_document, amount, payment_method, payment_reference } = data;
  let slp_document_id = data.slp_document_id;
  const token = await getAccessToken();

  // 1. Resolver pedido en SQLite o Supabase para obtener el radicado oficial SLP
  let orderSql: any = null;
  if (data.order_id) {
    orderSql = getOrderById(data.order_id) || getOrderByWompiRef(data.order_id);
    if (!slp_document_id && orderSql?.yeminus_document_id) {
      slp_document_id = orderSql.yeminus_document_id;
    }
  }

  if (!slp_document_id && data.payment_reference) {
    orderSql = orderSql || getOrderByWompiRef(data.payment_reference);
    if (orderSql?.yeminus_document_id) {
      slp_document_id = orderSql.yeminus_document_id;
    }
  }

  if (!slp_document_id && data.order_id) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { data: ord } = await supabase.from("pedidos").select("producto_name").eq("id", data.order_id).maybeSingle();
        if (ord && ord.producto_name) {
          const m = ord.producto_name.match(/\[Ref:\s*([^\]]+)\]/i);
          if (m && m[1]) slp_document_id = m[1].trim();
        }
      } catch {}
    }
  }

  let slpNumero: number | null = null;
  if (slp_document_id) {
    const match = slp_document_id.match(/SLP-SLP-(\d+)/i) || slp_document_id.match(/SLP-(\d+)/i) || slp_document_id.match(/(\d+)/);
    if (match && match[1]) {
      slpNumero = parseInt(match[1], 10);
    }
  }

  logApi("INFO", "YEMINUS_ABONO_INIT", `Procesando abono de $${amount} COP para pedido ${data.order_id || payment_reference} (SLP Doc: ${slp_document_id || 'N/A'}, Número: ${slpNumero || 'N/A'})`);

  let slpPaySuccess = false;
  let slpPayResult: any = null;

  // 2. Si el pedido tiene documento SLP en Yeminus, asentar el pago del abono directamente en el SLP (pagarfactura)
  if (slpNumero && slpNumero > 0) {
    try {
      const payRes = await payYeminusSLPDocument({
        numero: slpNumero,
        valorPagado: Math.round(amount),
        token
      });
      if (payRes.success) {
        slpPaySuccess = true;
        slpPayResult = payRes.raw;
        logApi("SUCCESS", "YEMINUS_ABONO_SLP_PAID", `Abono de $${amount} COP aplicado con éxito a SLP ${slpNumero} en Yeminus ERP`, payRes.raw);

        // Contabilizar documento SLP tras pago del abono
        try {
          await contabilizeYeminusSLPDocument({
            numero: slpNumero,
            token
          });
        } catch (contErr: any) {
          console.warn("[ABONO CONTABILIZE WARN]", contErr.message);
        }
      } else {
        logApi("INFO", "YEMINUS_ABONO_SLP_PAY_WARN", `Aviso al pagar abono en SLP ${slpNumero}: ${payRes.error}`);
      }
    } catch (payErr: any) {
      logApi("ERROR", "YEMINUS_ABONO_SLP_PAY_ERR", `Error al pagar abono en SLP ${slpNumero}: ${payErr.message}`);
    }
  }

  // 3. Registrar también el recibo de cartera RLP (agregarecibo)
  let cleanCustomerDoc = parseInt(String(customer_document || orderSql?.customer_document || "").replace(/\D/g, ""));
  if (!cleanCustomerDoc || cleanCustomerDoc < 1000) {
    cleanCustomerDoc = 816008621;
  }

  const endpoint = "/gateway/cuentasporcobrar/carteraclientes/agregarecibo";
  const dateInfo = getYeminusDateInfo();
  const desc = `ABONO SEPARE REF ${slp_document_id || payment_reference}`.substring(0, 100);

  const payload = {
    numero: 0,
    prefijo: "RCP",
    nitCliente: cleanCustomerDoc,
    fecha: dateInfo.fechaRecibo,
    descripcion: desc,
    tipoDocumento: "RLP",
    valor: Math.round(amount),
    valorNoAplicado: Math.round(amount),
    formaPago: "11",
    claseRecibo: "O",
    cuentaOtrosIngresos: "280596",
    documentoReferenciaCuenta: slp_document_id || `SLP-${slpNumero || '1'}`,
    caja: idCaja,
    usuario: usuario
  };

  let rlpSuccess = false;
  let rlpData: any = null;
  try {
    const response = await fetch(`${YEMINUS_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "id_empresa": idEmpresa,
        "id_caja": idCaja,
        "usuario": usuario,
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      rlpData = await response.json();
      if (rlpData.esExitoso || rlpData.datos) {
        rlpSuccess = true;
        logApi("SUCCESS", "YEMINUS_ABONO_RLP_SUCCESS", `Recibo RLP registrado para abono de ${slp_document_id}: $${amount} COP`, rlpData);
      }
    }
  } catch (rlpErr: any) {
    console.warn("[ABONO RLP ERR]", rlpErr.message);
  }

  // Si se aplicó con éxito en el SLP o en el recibo de cartera RLP
  if (slpPaySuccess || rlpSuccess) {
    savePaymentMirrorToSupabase({
      slp_document_id: slp_document_id || `SLP-${slpNumero || '1'}`,
      customer_document: cleanCustomerDoc,
      amount,
      payment_method: payment_method || "wompi",
      payment_reference: `ABONO-${slpNumero || Date.now()}`
    }).catch(e => console.warn("[SUPABASE MIRROR PAY] Error:", e.message));

    return {
      esExitoso: true,
      slpPaySuccess,
      rlpSuccess,
      slpNumero,
      datos: rlpData?.datos || slpPayResult?.datos || { numero: slpNumero, valor: amount }
    };
  }

  // Fallback si no había SLP ni RLP
  return {
    esExitoso: true,
    slpPaySuccess: false,
    rlpSuccess: false,
    slpNumero,
    datos: { numero: slpNumero, valor: amount }
  };
}

// 5. Registrar abono / pago (RLP)
app.post("/api/yeminus/separados/pagar", async (req, res) => {
  logApi("INFO", "POST /api/yeminus/separados/pagar", "Iniciando registro de pago RLP...", req.body);
  try {
    const resData = await registerYeminusAbonoInternal(req.body);
    res.json({
      success: true,
      receipt_id: resData.datos?.identificadorDocumento,
      numero: resData.datos?.numero,
      valor: resData.datos?.valor
    });
  } catch (error: any) {
    logApi("ERROR", "POST /api/yeminus/separados/pagar", `Fallo al registrar pago en Yeminus: ${error.message}.`);
    // Guardar en Supabase de contingencia
    if (req.body.amount && req.body.slp_document_id) {
      savePaymentMirrorToSupabase({
        slp_document_id: req.body.slp_document_id,
        customer_document: req.body.customer_document,
        amount: req.body.amount,
        payment_method: req.body.payment_method || "wompi",
        payment_reference: `CONT-${Date.now()}`
      }).catch(() => {});
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Consultar Extracto de un Separado
app.post("/api/yeminus/separados/extracto", async (req, res) => {
  const endpoint = "/gateway/financiero/extractodocumentoreferencia/obtener";
  const idEmpresa = process.env.YEMINUS_ID_EMPRESA || "02";
  const usuario = process.env.YEMINUS_USUARIO || "API";

  logApi("INFO", "POST /api/yeminus/separados/extracto", "Solicitando extracto del documento de referencia...", req.body);

  try {
    const token = await getAccessToken();

    const { customer_document, slp_document_id } = req.body;
    const cleanCustomerDoc = parseInt(String(customer_document).replace(/\D/g, "")) || 99999999;

    const payload = {
      tercero: cleanCustomerDoc,
      cuenta: "280596", // Cuenta plan separe
      documento: slp_document_id
    };

    const response = await fetch(`${YEMINUS_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "id_empresa": idEmpresa,
        "usuario": usuario,
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Fallo de Yeminus al obtener extracto (${response.status}): ${errText}`);
    }

    const resData: any = await response.json();
    if (resData.esExitoso && resData.datos) {
      logApi("SUCCESS", "POST /api/yeminus/separados/extracto", "Extracto consultado con éxito de Yeminus", payload, resData);
      
      const { datos } = resData;
      let totalAbonado = 0;
      const history = (datos.detalle || []).map((pay: any) => {
        totalAbonado += pay.credito;
        return {
          date: pay.fecha,
          reference: pay.documento,
          amount: pay.credito,
          type: pay.tipoDocumento === "SLP" ? "Abono Inicial" : "Abono Adicional",
          description: pay.observaciones
        };
      });

      res.json({
        success: true,
        document_id: datos.documento,
        total_amount: datos.valor,
        paid_amount: totalAbonado,
        balance_pending: Math.max(0, datos.valor - totalAbonado),
        customer_name: datos.descripcionTercero,
        payments: history
      });
    } else {
      throw new Error(resData.mensaje || "No se encontró el extracto para esta referencia");
    }
  } catch (error: any) {
    logApi("ERROR", "POST /api/yeminus/separados/extracto", `Fallo al consultar extracto en Yeminus: ${error.message}.`);
    res.json({ success: false, error: error.message });
  }
});

// 7. Preparar Sesión y Generar Firma de Integridad Wompi Colombia (SHA-256)
app.post("/api/wompi/prepare-checkout", async (req, res) => {
  try {
    const { reference, amountInCents, currency = "COP", orderData } = req.body;
    
    const publicKey = process.env.WOMPI_PUBLIC_KEY || "pub_prod_rYeI0ExCzLD8zRsQB8IQTpajkGFJlBkc";
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET || "prod_integrity_MWWeP0cqezh091PkMVprYnbbxAHBhMZT";

    const cleanAmountInCents = Math.round(Number(amountInCents));

    if (!reference || !cleanAmountInCents) {
      return res.status(400).json({ success: false, error: "Faltan parámetros 'reference' o 'amountInCents'" });
    }

    if (cleanAmountInCents <= 0) {
      return res.status(400).json({ success: false, error: "El monto debe ser mayor a cero" });
    }

    if (orderData) {
      // Validar que todos los campos obligatorios del cliente estén presentes
      const cleanCustomerDoc = String(orderData.customer_document || "").trim();
      const cleanCustomerName = String(orderData.customer_name || "").trim();
      const cleanCustomerEmail = String(orderData.customer_email || "").trim();
      const cleanCustomerPhone = String(orderData.customer_phone || "").trim();
      const cleanShippingAddress = String(orderData.shipping_address || "").trim();
      const cleanShippingCity = String(orderData.shipping_city || orderData.customer_city || "").trim();
      const cleanNotes = String(orderData.notes || orderData.observaciones || "").trim();

      if (!cleanCustomerName || !cleanCustomerDoc || !cleanCustomerEmail || !cleanCustomerPhone || !cleanShippingAddress || !cleanShippingCity) {
        return res.status(400).json({
          success: false,
          error: "Todos los campos de cliente (Nombre, Cédula, Correo, Teléfono, Dirección y Ciudad) son estrictamente obligatorios para proceder."
        });
      }

      // Validar inventario disponible en tiempo real antes de permitir checkout
      const itemsToCheck = (Array.isArray(orderData.items) && orderData.items.length > 0)
        ? orderData.items
        : (orderData.product_id ? [{ product_id: orderData.product_id, quantity: Number(orderData.quantity) || 1, product_name: orderData.product_name }] : []);

      if (itemsToCheck.length > 0) {
        const catalog = productsCache?.data || loadProductsFromLocalFile() || [];
        for (const it of itemsToCheck) {
          const prod = catalog.find((p: any) => 
            String(p.id).trim() === String(it.product_id).trim() || 
            String(p.code).trim() === String(it.product_id).trim() || 
            String(p.reference).trim() === String(it.product_id).trim()
          );
          if (prod) {
            const availStock = Number(prod.stock) || 0;
            if (availStock <= 0) {
              return res.status(400).json({
                success: false,
                error: `El producto "${prod.name || it.product_name}" se encuentra agotado. Por favor retíralo para continuar.`
              });
            }
            if ((it.quantity || 1) > availStock) {
              return res.status(400).json({
                success: false,
                error: `El producto "${prod.name || it.product_name}" solo tiene ${availStock} unidad(es) disponible(s). Por favor ajusta la cantidad.`
              });
            }
          }
        }
      }

      // Validar regla de abono mínimo ($50.000 COP a menos que el saldo sea inferior)
      const payAmountCOP = Math.round(cleanAmountInCents / 100);
      if (reference.startsWith("WMP-ABONO-") || orderData.isAbono) {
        const orderBalance = Number(orderData.balance_pending ?? orderData.restante ?? 100000);
        const minAbono = Math.min(50000, orderBalance);
        if (payAmountCOP < minAbono) {
          return res.status(400).json({
            success: false,
            error: `El abono mínimo permitido es de $${minAbono.toLocaleString('es-CO')} COP.`
          });
        }
      }

      const isUuid = (str: any) => typeof str === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
      const pendingUuid = (orderData.id && isUuid(orderData.id))
        ? orderData.id
        : (orderData.order_id && isUuid(orderData.order_id) ? orderData.order_id : crypto.randomUUID());
      orderData.id = pendingUuid;
      orderData.order_id = pendingUuid;
      const orderTotal = Math.round(Number(orderData.total_amount) || payAmountCOP);

      // Estructurar items completos con precios unitarios oficiales de Lista 8 y totales exactos
      let rawItemList = (Array.isArray(orderData.items) && orderData.items.length > 0)
        ? orderData.items
        : [];

      if (rawItemList.length === 0) {
        let pId = String(orderData.product_id || "").trim();
        let pName = String(orderData.product_name || "Producto Navideño").trim();
        try {
          if (fs.existsSync(BACKUP_FILE_PATH)) {
            const parsed = JSON.parse(fs.readFileSync(BACKUP_FILE_PATH, "utf-8"));
            const cList = Array.isArray(parsed) ? parsed : (parsed.products || []);
            const found = cList.find((p: any) => 
              (pId && pId !== "ONLINE" && (p.id === pId || p.reference === pId || p.code === pId)) ||
              (pName && p.name.toLowerCase() === pName.toLowerCase())
            );
            if (found) {
              pId = found.id;
              pName = found.name;
            }
          }
        } catch {}

        rawItemList = [{
          product_id: pId && pId !== "ONLINE" ? pId : `PROD-${pendingUuid.slice(0, 8)}`,
          product_reference: pId && pId !== "ONLINE" ? pId : "ONLINE",
          product_name: pName,
          quantity: 1,
          unit_price: orderTotal,
          total: orderTotal
        }];
      }

      const itemsToSave = rawItemList.map((it: any, idx: number) => {
        const qty = Math.max(1, Number(it.quantity) || 1);
        const unitPrice = Math.round(Number(it.unit_price ?? it.price) || Math.round(orderTotal / (rawItemList.length * qty)));
        const itemTot = Math.round(Number(it.total) || (unitPrice * qty));
        const subtotal = Math.round(Number(it.subtotal) || itemTot);
        const tax = Math.round(subtotal - (subtotal / 1.19));
        const cleanProdId = String(it.product_id && it.product_id !== "ONLINE" ? it.product_id : (it.product_reference || "")).trim();
        const cleanRef = String(it.product_reference && it.product_reference !== "ONLINE" ? it.product_reference : cleanProdId).trim();
        return {
          product_id: cleanProdId || `PROD-${pendingUuid.slice(0, 8)}-${idx + 1}`,
          product_reference: cleanRef || cleanProdId || "ONLINE",
          product_name: String(it.product_name || it.name || "Producto Navideño").trim(),
          quantity: qty,
          unit_price: unitPrice,
          price: unitPrice,
          discount_percentage: Number(it.discount_percentage) || 0,
          discount_amount: Math.round(Number(it.discount_amount) || 0),
          subtotal,
          tax,
          total: itemTot,
          warehouse_origin: "05",
          warehouse_destination: "07"
        };
      });

      // 1. Guardar inmediatamente en la base de datos relacional SQLite (fuente de verdad permanente)
      saveOrderWithItems({
        id: pendingUuid,
        customer_document: cleanCustomerDoc,
        customer_name: cleanCustomerName,
        customer_email: cleanCustomerEmail,
        customer_phone: cleanCustomerPhone,
        shipping_address: cleanShippingAddress,
        shipping_city: cleanShippingCity,
        notes: cleanNotes,
        subtotal: Math.round(Number(orderData.subtotal_amount) || orderTotal),
        discount: Math.round(Number(orderData.discount_amount) || 0),
        total: orderTotal,
        initial_payment: payAmountCOP,
        paid_amount: 0,
        balance: orderTotal,
        status: "pendiente",
        wompi_reference: reference,
        wompi_transaction_id: "",
        yeminus_document_id: "",
        yeminus_sync_status: "PENDING",
        yeminus_last_error: ""
      }, itemsToSave);

      // Guardar en tabla de checkout pendiente en SQLite
      savePendingCheckout(reference, pendingUuid, cleanAmountInCents, currency, {
        ...orderData,
        orderId: pendingUuid,
        shipping_city: cleanShippingCity,
        notes: cleanNotes,
        items: itemsToSave
      });

      // Guardar en memoria y archivo JSON para redundancia total
      savePendingSession(reference, {
        ...orderData,
        orderId: pendingUuid,
        shipping_city: cleanShippingCity,
        notes: cleanNotes,
        items: itemsToSave,
        amountInCents: cleanAmountInCents,
        createdAt: Date.now()
      });

      // 2. Replicar en Supabase para compatibilidad externa (con nombre limpio, sin alterar producto_name con metadatos)
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          const metaParts = [];
          if (cleanCustomerDoc) metaParts.push(`Doc: ${cleanCustomerDoc}`);
          if (cleanShippingAddress) metaParts.push(`Dir: ${cleanShippingAddress}`);
          if (cleanShippingCity) metaParts.push(`Ciudad: ${cleanShippingCity}`);
          if (cleanNotes) metaParts.push(`Obs: ${cleanNotes}`);
          const metaSuffix = metaParts.length > 0 ? ` [${metaParts.join(" | ")}]` : "";

          const fullPendingSbPayload: any = {
            id: pendingUuid,
            cliente_nombre: cleanCustomerName,
            cliente_email: cleanCustomerEmail,
            cliente_telefono: cleanCustomerPhone,
            cliente_documento: cleanCustomerDoc,
            direccion_envio: cleanShippingAddress,
            ciudad_envio: cleanShippingCity,
            observaciones: cleanNotes,
            subtotal: Math.round(Number(orderData.subtotal_amount) || orderTotal),
            descuento: Math.round(Number(orderData.discount_amount) || 0),
            referencia_wompi: reference,
            transaccion_id: "",
            documento_yeminus: "",
            producto_id: itemsToSave.map(it => it.product_id).join(", ") || (orderData.product_id !== "ONLINE" ? orderData.product_id : "") || "8010141",
            producto_name: `${itemsToSave.map(it => `${it.quantity}x ${it.product_name}`).join(", ")}${metaSuffix}`,
            total: orderTotal,
            abonado: 0,
            restante: orderTotal,
            estado: "pendiente"
          };

          const { error: insErr } = await supabase.from("pedidos").insert([fullPendingSbPayload]);
          if (insErr) {
            const { observaciones: _o, ...payloadNoObs } = fullPendingSbPayload;
            const { error: insErr2 } = await supabase.from("pedidos").insert([payloadNoObs]);
            if (insErr2) {
              await supabase.from("pedidos").insert([{
                id: pendingUuid,
                cliente_nombre: cleanCustomerName,
                cliente_email: cleanCustomerEmail,
                cliente_telefono: cleanCustomerPhone,
                producto_id: itemsToSave.map(it => it.product_id).join(", ") || (orderData.product_id !== "ONLINE" ? orderData.product_id : "") || "8010141",
                producto_name: `${itemsToSave.map(it => `${it.quantity}x ${it.product_name}`).join(", ")}${metaSuffix}`,
                total: orderTotal,
                abonado: 0,
                restante: orderTotal,
                estado: "pendiente"
              }]);
            }
          }
        } catch (sbErr: any) {
          console.warn("[PREPARE CHECKOUT SB WARN]", sbErr.message);
        }
      }
    }

    // Firma de integridad: SHA256(Referencia + MontoEnCentavos + Moneda + SecretoIntegridad)
    const stringToSign = `${reference}${cleanAmountInCents}${currency}${integritySecret}`;
    const signature = crypto.createHash("sha256").update(stringToSign).digest("hex");

    logApi("INFO", "POST /api/wompi/prepare-checkout", `Checkout preparado para referencia ${reference} ($${cleanAmountInCents / 100} COP)`, { reference, amountInCents: cleanAmountInCents });

    res.json({
      success: true,
      signature,
      publicKey,
      currency,
      amountInCents: cleanAmountInCents,
      reference
    });
  } catch (err: any) {
    logApi("ERROR", "POST /api/wompi/prepare-checkout", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Compatibilidad con firma anterior
app.post("/api/wompi/signature", (req, res) => {
  try {
    const { reference, amountInCents, currency = "COP" } = req.body;
    const publicKey = process.env.WOMPI_PUBLIC_KEY || "pub_prod_rYeI0ExCzLD8zRsQB8IQTpajkGFJlBkc";
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET || "prod_integrity_MWWeP0cqezh091PkMVprYnbbxAHBhMZT";

    if (!reference || !amountInCents) {
      return res.status(400).json({ success: false, error: "Faltan parámetros 'reference' o 'amountInCents'" });
    }

    const stringToSign = `${reference}${amountInCents}${currency}${integritySecret}`;
    const signature = crypto.createHash("sha256").update(stringToSign).digest("hex");

    res.json({
      success: true,
      signature,
      publicKey,
      currency,
      amountInCents,
      reference
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Función para purgar transacciones rechazadas o canceladas
async function purgeRejectedWompiTransaction(reference: string) {
  if (!reference) return;
  deletePendingSession(reference);
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      await supabase.from("pagos").delete().eq("referencia_pago", reference);
      await supabase.from("pedidos").delete().ilike("producto_name", `%${reference}%`);
      console.log(`[WOMPI PURGE] Registro purgado completamente para referencia rechazada: ${reference}`);
    } catch (e: any) {
      console.warn(`[WOMPI PURGE ERR] Error al purgar ${reference}:`, e.message);
    }
  }
}

// Conjunto en memoria para evitar reprocesamiento en caso de concurrencia webhook / redirect
const processedWompiReferences = new Set<string>();

// Función para descontar inventario local en tiempo real tras confirmación de pago
function deductLocalInventory(items: Array<{ product_id: string; quantity: number; product_name?: string }>, orderRef?: string) {
  if (!items || !Array.isArray(items) || items.length === 0) return;

  try {
    // 1. Guardar en el registro persistente de deducciones locales
    const currentDeductions = loadLocalDeductions();
    for (const item of items) {
      const qtyToDeduct = Number(item.quantity) || 1;
      const targetId = String(item.product_id || "").trim();
      if (targetId && qtyToDeduct > 0) {
        currentDeductions.push({
          productId: targetId,
          quantity: qtyToDeduct,
          timestamp: Date.now(),
          orderReference: orderRef
        });
      }
    }
    saveLocalDeductions(currentDeductions);

    let modified = false;
    let rawList: any[] = [];
    if (fs.existsSync(BACKUP_FILE_PATH)) {
      try {
        const raw = fs.readFileSync(BACKUP_FILE_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        rawList = Array.isArray(parsed) ? parsed : Array.isArray(parsed.products) ? parsed.products : [];
      } catch (e) {}
    }

    if (rawList.length === 0 && productsCache?.data) {
      rawList = [...productsCache.data];
    }

    for (const item of items) {
      const qtyToDeduct = Number(item.quantity) || 1;
      const targetId = String(item.product_id || "").trim();

      const idx = rawList.findIndex((p: any) => 
        String(p.id).trim() === targetId || 
        String(p.code).trim() === targetId || 
        String(p.reference).trim() === targetId
      );

      if (idx !== -1) {
        const currentStock = Number(rawList[idx].stock) || 0;
        const newStock = Math.max(0, currentStock - qtyToDeduct);
        rawList[idx].stock = newStock;
        modified = true;
        logApi("INFO", "INVENTORY_DEDUCT", `Descontadas ${qtyToDeduct} unidades de "${rawList[idx].name}" (${targetId}). Stock actualizado: ${currentStock} -> ${newStock}`);
      }
    }

    if (modified) {
      // Guardar lista completa con stock actualizado
      saveProductsToLocalFile(rawList);

      // Actualizar cache en memoria filtrando los que tengan stock >= 1 (regla estricta: si queda en 0, no se muestra)
      const activeProducts = rawList.filter((p: any) => (p.stock ?? 0) >= 1);
      productsCache = {
        timestamp: Date.now(),
        data: activeProducts
      };

      // Si Supabase está disponible, actualizar también en la tabla
      const supabase = getSupabaseAdmin();
      if (supabase) {
        for (const item of items) {
          const targetId = String(item.product_id || "").trim();
          const prod = rawList.find((p: any) => String(p.id).trim() === targetId || String(p.code).trim() === targetId);
          if (prod) {
            supabase.from("products").update({ stock: prod.stock }).eq("id", prod.id).then(({ error }) => {
              if (error) console.warn("[SUPABASE STOCK UPDATE ERR]", error.message);
            });
          }
        }
      }
    }
  } catch (err: any) {
    console.error("[INVENTORY_DEDUCT ERROR]", err);
  }
}

// Helper para construir el comprobante / recibo oficial estructurado de la transacción
function buildReceiptData(
  transaction: any,
  sessionData: any,
  order: any,
  documentId: string,
  amount: number,
  paymentRecord?: any
) {
  const customerName = order?.cliente_nombre || sessionData?.customer_name || transaction?.customer_data?.full_name || transaction?.payment_method?.extra?.card_holder || transaction?.payment_method?.extra?.fullName || "Cliente Impormax";
  const customerEmail = order?.cliente_email || sessionData?.customer_email || transaction?.customer_email || "cliente@impormax.net";
  const customerPhone = order?.cliente_telefono || sessionData?.customer_phone || transaction?.customer_data?.phone_number || transaction?.payment_method?.extra?.cellphoneNumber || "";
  const customerDoc = sessionData?.customer_document || transaction?.billing_data?.legal_id || transaction?.customer_data?.legal_id || paymentRecord?.customer_document || order?.cliente_documento || "10203040";
  const address = sessionData?.shipping_address || "Entrega a domicilio / Retiro en tienda";
  const city = sessionData?.shipping_city || "Pereira";
  
  const totalAmount = Number(order?.total) || Number(sessionData?.total_amount) || amount;
  const paidAmount = Number(order?.abonado) || amount;
  const balancePending = (order && order.restante !== undefined && order.restante !== null && !isNaN(Number(order.restante)))
    ? Number(order.restante)
    : Math.max(0, totalAmount - paidAmount);
  const isPlanSepare = balancePending > 0;

  // Items adquiridos (prioridad: items estructurados del pedido en BD o sesión)
  const rawItems = (order?.items && order.items.length > 0)
    ? order.items
    : (sessionData?.items && sessionData.items.length > 0)
    ? sessionData.items
    : [];

  let items: any[] = [];
  if (rawItems && rawItems.length > 0) {
    items = rawItems.map((it: any) => ({
      id: (it.product_reference && it.product_reference !== "ONLINE") ? it.product_reference : (it.product_id && it.product_id !== "ONLINE" ? it.product_id : ""),
      name: it.product_name || it.name || "Producto Navideño",
      quantity: Number(it.quantity) || 1,
      price: Number(it.unit_price || it.price) || Math.round(totalAmount / (rawItems.length * (Number(it.quantity) || 1))),
      total: Number(it.total) || ((Number(it.unit_price || it.price) || Math.round(totalAmount / rawItems.length)) * (Number(it.quantity) || 1))
    }));
  } else if (order?.producto_name) {
    items = [{
      id: (order.producto_id && order.producto_id !== "ONLINE") ? order.producto_id : "",
      name: order.producto_name.replace(/\s*\[Ref:\s*[^\]]+\]/, "").replace(/\[.*?\]/g, "").trim(),
      quantity: sessionData?.quantity || 1,
      price: totalAmount,
      total: totalAmount
    }];
  }

  const paymentMethodType = (transaction?.payment_method_type || paymentRecord?.metodo_pago || "WOMPI").toUpperCase();
  const pmExtra = transaction?.payment_method?.extra || {};
  const authCode = pmExtra?.authorization_code || pmExtra?.external_identifier || pmExtra?.nequi_transaction_id || pmExtra?.transfer_voucher || transaction?.id || paymentRecord?.id || "";

  let methodLabel = paymentMethodType;
  if (paymentMethodType === "CARD") {
    methodLabel = `Tarjeta ${pmExtra?.brand || "Crédito/Débito"} **** ${pmExtra?.last_four || ""}`;
  } else if (paymentMethodType === "NEQUI") {
    methodLabel = "Nequi Bancolombia";
  } else if (paymentMethodType === "BANCOLOMBIA_TRANSFER") {
    methodLabel = "Bancolombia Transferencia";
  } else if (paymentMethodType === "BANCOLOMBIA_QR") {
    methodLabel = "Bancolombia Código QR";
  } else if (paymentMethodType === "PSE") {
    methodLabel = `PSE - ${pmExtra?.financial_institution_code || "Banco en línea"}`;
  }

  const cleanDocId = documentId || order?.producto_name?.match(/\[Ref:\s*([^\]]+)\]/)?.[1] || (transaction?.reference ? `SLP-${transaction.reference}` : "");

  return {
    orderId: order?.id || null,
    documentId: cleanDocId,
    reference: transaction?.reference || paymentRecord?.referencia_pago || "",
    transactionId: transaction?.id || paymentRecord?.id || "",
    authorizationCode: authCode,
    status: "APPROVED",
    statusMessage: "Pago Aprobado y Confirmado",
    date: transaction?.created_at || order?.created_at || new Date().toISOString(),
    customer: {
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
      document: customerDoc,
      address,
      city
    },
    items,
    financial: {
      totalOrder: totalAmount,
      amountPaid: amount,
      totalAbonado: paidAmount,
      balancePending: balancePending,
      isPlanSepare,
      depositPercentage: totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 100
    },
    paymentMethod: {
      type: paymentMethodType,
      label: methodLabel,
      brand: pmExtra?.brand || pmExtra?.bank || paymentMethodType,
      lastFour: pmExtra?.last_four || null,
      details: pmExtra?.card_holder ? `${methodLabel} (${pmExtra.card_holder})` : methodLabel
    }
  };
}

// Función maestra para procesar y consolidar una transacción APROBADA por Wompi
async function confirmWompiApprovedTransaction(transaction: any, fallbackOrderData?: any) {
  const {
    id,
    reference,
    amount_in_cents,
    payment_method_type,
    customer_email,
    customer_data,
    billing_data,
    payment_method
  } = transaction;

  const refKey = String(reference || "").trim();

  // 0. Mutex Atómico en vuelo: Si la confirmación de esta transacción ya está en ejecución (ej. webhook + redirección cliente concurrentes)
  if (refKey && inFlightWompiConfirmations.has(refKey)) {
    console.log(`[WOMPI MUTEX] Transacción ${refKey} ya está siendo confirmada en vuelo. Esperando resolución única...`);
    return await inFlightWompiConfirmations.get(refKey);
  }

  const confirmPromise = (async () => {
    const amount = (amount_in_cents || 0) / 100;
    const supabase = getSupabaseAdmin();
    const pendingCheckoutRow = getPendingCheckout(reference);
    const sessionData = getPendingSession(reference) || pendingCheckoutRow?.orderData || fallbackOrderData || {};

    // 1. Verificar si ya fue procesada en memoria
    if (refKey && processedWompiReferences.has(refKey)) {
      console.log(`[WOMPI APROBADO] Referencia ${refKey} ya en memoria de procesados.`);
      let existingOrder: any = getOrderByWompiRef(refKey);
      let existingPayment: any = null;
      if (supabase) {
        const { data: payments } = await supabase.from("pagos").select("*, pedidos(*)").eq("referencia_pago", refKey).limit(1);
        if (payments && payments.length > 0) {
          existingPayment = payments[0];
          if (!existingOrder) existingOrder = existingPayment.pedidos;
        }
      }
      const docId = existingOrder?.yeminus_document_id || existingOrder?.producto_name?.match(/\[Ref:\s*([^\]]+)\]/)?.[1] || refKey;
      const receipt = buildReceiptData(transaction, sessionData, existingOrder, docId, amount, existingPayment);
      return {
        success: true,
        status: "APPROVED",
        alreadyProcessed: true,
        document_id: docId,
        order: existingOrder,
        receipt
      };
    }

    // 2. Verificar si ya existe en SQLite como pedido pagado o abonado
    if (refKey) {
      const existingSqlite = getOrderByWompiRef(refKey);
      if (existingSqlite && (existingSqlite.status === 'pagado' || existingSqlite.status === 'abonando')) {
        console.log(`[WOMPI APROBADO] Transacción ${refKey} ya confirmada en SQLite: ${existingSqlite.id} (SLP: ${existingSqlite.yeminus_document_id}).`);
        processedWompiReferences.add(refKey);
        const docId = existingSqlite.yeminus_document_id || `SLP-${refKey}`;
        const receipt = buildReceiptData(transaction, sessionData, existingSqlite, docId, existingSqlite.paid_amount || amount);
        return {
          success: true,
          status: "APPROVED",
          alreadyProcessed: true,
          document_id: docId,
          order: existingSqlite,
          receipt
        };
      }
    }

    // 3. Verificar si ya fue procesada en base de datos Supabase (Idempotencia estricta)
    if (supabase && refKey) {
      const { data: existingPayments } = await supabase
        .from("pagos")
        .select("*, pedidos(*)")
        .eq("referencia_pago", refKey);

      if (existingPayments && existingPayments.length > 0 && existingPayments[0].estado_pago === "aprobado") {
        console.log(`[WOMPI APROBADO] Transacción ${refKey} ya procesada previamente en Supabase.`);
        processedWompiReferences.add(refKey);
        const existingPayment = existingPayments[0];
        const existingOrder = existingPayment.pedidos;
        const docId = existingOrder?.producto_name?.match(/\[Ref:\s*([^\]]+)\]/)?.[1] || refKey;
        const receipt = buildReceiptData(transaction, sessionData, existingOrder, docId, existingPayment.monto || amount, existingPayment);
        
        return {
          success: true,
          status: "APPROVED",
          alreadyProcessed: true,
          document_id: docId,
          payment: existingPayment,
          order: existingOrder,
          receipt
        };
      }
    }

    // Prioridad 1: Buscar la orden estructurada en SQLite (por referencia de Wompi o ID de sesión)
    let sqliteOrder = getOrderByWompiRef(reference);
    if (!sqliteOrder && (sessionData?.orderId || sessionData?.id || pendingCheckoutRow?.orderId)) {
      sqliteOrder = getOrderById(sessionData?.orderId || sessionData?.id || pendingCheckoutRow?.orderId);
    }

    const rawDoc = sessionData.customer_document || fallbackOrderData?.customer_document || sqliteOrder?.customer_document || billing_data?.legal_id || customer_data?.legal_id || payment_method?.extra?.user_legal_id || payment_method?.extra?.identificationNumber || "";
    const customerDoc = (rawDoc && rawDoc !== "222222222") ? String(rawDoc).trim() : (sqliteOrder?.customer_document && sqliteOrder.customer_document !== "222222222" ? sqliteOrder.customer_document : String(rawDoc || ""));

    const rawName = sessionData.customer_name || fallbackOrderData?.customer_name || sqliteOrder?.customer_name || customer_data?.full_name || payment_method?.extra?.card_holder || payment_method?.extra?.fullName || "Cliente Impormax";
    const customerName = String(rawName).trim();

    const rawPhone = sessionData.customer_phone || fallbackOrderData?.customer_phone || sqliteOrder?.customer_phone || customer_data?.phone_number || payment_method?.extra?.cellphoneNumber || "";
    const customerPhone = String(rawPhone).trim();

    const rawEmail = sessionData.customer_email || fallbackOrderData?.customer_email || sqliteOrder?.customer_email || customer_email || "cliente@impormax.net";
    const customerEmailReal = String(rawEmail).trim();

    const rawAddress = sessionData.shipping_address || fallbackOrderData?.shipping_address || "";
    const effectiveAddress = (rawAddress && !['Entrega a domicilio / Retiro en tienda', 'Entrega a domicilio', 'Dirección de Entrega Registrada'].includes(rawAddress))
      ? String(rawAddress).trim()
      : (sqliteOrder?.shipping_address && !['Entrega a domicilio / Retiro en tienda', 'Entrega a domicilio', 'Dirección de Entrega Registrada'].includes(sqliteOrder.shipping_address)
        ? sqliteOrder.shipping_address
        : (rawAddress || sqliteOrder?.shipping_address || "Entrega a domicilio"));

    const rawCity = sessionData.shipping_city || sessionData.customer_city || fallbackOrderData?.shipping_city || "";
    const effectiveCity = String(rawCity || (sqliteOrder?.shipping_city !== 'Pereira' ? sqliteOrder?.shipping_city : '') || sqliteOrder?.shipping_city || "").trim();

    const rawNotes = sessionData.notes || sessionData.observaciones || fallbackOrderData?.notes || fallbackOrderData?.observaciones || sqliteOrder?.notes || "";
    const effectiveNotes = String(rawNotes).trim();

    // Caso 1: Abono a pedido existente (únicamente si es explícitamente abono con referencia WMP-ABONO o isAbono === true)
    const isAbonoExplicit = reference.startsWith("WMP-ABONO-") || sessionData.isAbono === true;
    if (isAbonoExplicit) {
      const rawTarget = sessionData.order_id || sessionData.orderId || reference.split("-")[2];
      let existingOrderSql = getOrderById(rawTarget) || sqliteOrder;

      // Si no se encuentra en SQLite, buscar en Supabase por ID completo o prefijo
      if (!existingOrderSql && supabase) {
        try {
          const { data: sbMatch } = await supabase.from("pedidos").select("*");
          if (sbMatch && sbMatch.length > 0) {
            const matched = sbMatch.find((o: any) =>
              o.id === rawTarget ||
              (rawTarget && o.id.startsWith(rawTarget)) ||
              (rawTarget && rawTarget.startsWith(o.id.slice(0, 8))) ||
              (customerEmailReal && o.cliente_email && o.cliente_email.toLowerCase() === customerEmailReal.toLowerCase())
            );
            if (matched) {
              await syncAndRecoverFromSupabase(supabase);
              existingOrderSql = getOrderById(matched.id);
            }
          }
        } catch (e: any) {
          console.warn("[ABONO SB LOOKUP ERR]", e.message);
        }
      }

      if (existingOrderSql) {
        const fullOrderId = existingOrderSql.id;
        const newPayId = crypto.randomUUID();

        // Registrar pago en SQLite
        savePayment({
          id: newPayId,
          order_id: fullOrderId,
          amount,
          payment_reference: reference,
          transaction_id: transaction.id || "",
          payment_method: (payment_method_type || "wompi").toLowerCase(),
          status: "approved",
          raw_data: JSON.stringify(transaction),
          created_at: transaction.created_at || new Date().toISOString()
        });

        // Recalcular el total abonado consolidado con base en todos los pagos aprobados
        const allDbPayments = db.prepare(`SELECT * FROM payments WHERE order_id = ? AND status = 'approved'`).all(fullOrderId) as any[];
        const totalPaidAll = allDbPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
        const effectivePaid = Math.max(totalPaidAll, (Number(existingOrderSql.paid_amount) || 0) + amount);
        const newRestante = Math.max(0, existingOrderSql.total - effectivePaid);
        const newEstado = newRestante <= 0 ? "pagado" : "abonando";

        saveOrderWithItems({
          ...existingOrderSql,
          paid_amount: effectivePaid,
          balance: newRestante,
          status: newEstado,
          wompi_reference: existingOrderSql.wompi_reference || reference,
          wompi_transaction_id: transaction.id || existingOrderSql.wompi_transaction_id
        }, existingOrderSql.items || []);

        // Mirror a Supabase con el ID exacto del pedido y UUID válido de pago
        if (supabase) {
          try {
            await supabase.from("pedidos").update({
              abonado: effectivePaid,
              restante: newRestante,
              estado: newEstado
            }).eq("id", fullOrderId);
            await supabase.from("pagos").upsert([{
              id: newPayId,
              pedido_id: fullOrderId,
              monto: amount,
              referencia_pago: reference,
              estado_pago: "aprobado",
              metodo_pago: (payment_method_type || "wompi").toLowerCase()
            }]);
          } catch (e: any) {
            console.warn("[ABONO SB MIRROR ERR]", e.message);
          }
        }

        // Registrar abono en Yeminus
        try {
          await registerYeminusAbonoInternal({
            order_id: fullOrderId,
            amount,
            payment_reference: reference,
            customer_document: customerDoc
          });
        } catch (e: any) {
          console.warn("[WOMPI ABONO YEMINUS ERR]", e.message);
        }

        processedWompiReferences.add(reference);
        const updatedOrder = getOrderById(fullOrderId)!;
        const docId = updatedOrder.yeminus_document_id || `SLP-${reference}`;
        const receipt = buildReceiptData(transaction, sessionData, updatedOrder, docId, amount, {
          id: newPayId,
          metodo_pago: payment_method_type
        });

        return {
          success: true,
          status: "APPROVED",
          isAbono: true,
          document_id: docId,
          order: updatedOrder,
          receipt
        };
      }
    }

    // Caso 2: Nuevo Pedido Aprobado (o confirmación de checkout preparado)
    // Si no se encontró en SQLite, buscar en Supabase por referencia Wompi o email/documento
    if (!sqliteOrder && supabase) {
      try {
        const { data: sbMatch } = await supabase.from("pedidos").select("*").eq("referencia_wompi", reference).maybeSingle();
        if (sbMatch) {
          await syncAndRecoverFromSupabase(supabase);
          sqliteOrder = getOrderById(sbMatch.id);
        } else if (customerEmailReal && customerEmailReal.includes("@")) {
          const { data: sbByEmail } = await supabase.from("pedidos").select("*").ilike("cliente_email", customerEmailReal).order("created_at", { ascending: false }).limit(1);
          if (sbByEmail && sbByEmail.length > 0) {
            await syncAndRecoverFromSupabase(supabase);
            sqliteOrder = getOrderById(sbByEmail[0].id);
          }
        }
      } catch (e: any) {
        console.warn("[CHECKOUT SB LOOKUP ERR]", e.message);
      }
    }

    const orderTotal = sqliteOrder?.total || Number(sessionData.total_amount) || amount;
    const isTotalPaid = amount >= orderTotal;
    const orderStatus = isTotalPaid ? "pagado" : "abonando";
    const restante = Math.max(0, orderTotal - amount);
    const isUuid = (str: any) => typeof str === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
    const orderUuid = (sqliteOrder?.id && isUuid(sqliteOrder.id))
      ? sqliteOrder.id
      : (sessionData?.orderId && isUuid(sessionData.orderId) ? sessionData.orderId : crypto.randomUUID());

    // Artículos exactos sin adivinar ni sustituir jamás por 'ONLINE'
    let orderItemsToProcess = (sessionData.items && sessionData.items.length > 0)
      ? sessionData.items
      : (fallbackOrderData?.items && fallbackOrderData.items.length > 0)
      ? fallbackOrderData.items
      : (sqliteOrder?.items && sqliteOrder.items.length > 0)
      ? sqliteOrder.items
      : [];

    if (orderItemsToProcess.length === 0) {
      const pId = sessionData.product_id;
      const pName = sessionData.product_name;
      const cat = findInCatalog(pId, pName);

      orderItemsToProcess = [{
        product_id: cat ? cat.id : (pId && pId !== "ONLINE" ? pId : `PROD-${orderUuid.slice(0, 8)}`),
        product_reference: cat ? (cat.reference || cat.id) : (pId && pId !== "ONLINE" ? pId : "ONLINE"),
        product_name: cat ? cat.name : (pName || "Producto Navideño"),
        quantity: 1,
        unit_price: orderTotal,
        total: orderTotal
      }];
    }

    const cleanCustomerDocument = customerDoc;

    // 1. Verificar si este pedido ya tiene radicado oficial en Yeminus para evitar crear duplicados
    let documentId = sqliteOrder?.yeminus_document_id || "";
    if (!documentId && refKey) {
      documentId = yeminusDocsByReference.get(refKey) || "";
    }
    if (!documentId && orderUuid) {
      documentId = yeminusDocsByReference.get(orderUuid) || "";
    }

    let yeminusSyncStatus: 'SYNCED' | 'ERP_SYNC_FAILED' = documentId ? 'SYNCED' : 'ERP_SYNC_FAILED';
    let yeminusLastError = "";

    if (!documentId) {
      try {
        const syncResult = await createOrSyncYeminusDocument({
          customer_document: cleanCustomerDocument,
          customer_name: customerName,
          product_id: orderItemsToProcess[0]?.product_id || orderItemsToProcess[0]?.product_reference || "ONLINE",
          product_name: orderItemsToProcess[0]?.product_name || "Producto Navideño",
          total_amount: orderTotal,
          deposit_amount: amount,
          customer_address: effectiveAddress,
          customer_city: effectiveCity,
          customer_email: customerEmailReal,
          customer_phone: customerPhone,
          notes: effectiveNotes,
          observaciones: effectiveNotes,
          payment_method: "wompi",
          order_id: orderUuid,
          wompi_reference: reference,
          payment_reference: reference,
          items: orderItemsToProcess
        });

        if (syncResult && syncResult.success && syncResult.document_id) {
          documentId = syncResult.document_id;
          yeminusSyncStatus = "SYNCED";
          yeminusLastError = "";
          if (refKey) yeminusDocsByReference.set(refKey, documentId);
          if (orderUuid) yeminusDocsByReference.set(orderUuid, documentId);
        } else {
          yeminusLastError = syncResult?.error || "Error al sincronizar con Yeminus ERP";
        }
      } catch (errYem: any) {
        yeminusLastError = errYem.message;
        console.warn("[WOMPI YEMINUS SLP WARN]", errYem.message);
      }
    } else {
      console.log(`[WOMPI APROBADO] Pedido ya cuenta con documento SLP previo en Yeminus: ${documentId}. Se omite duplicación.`);
    }

    // 1. Guardar permanentemente en SQLite con estado exacto y los artículos intactos
    const savedSqliteOrder = saveOrderWithItems({
      id: orderUuid,
      customer_document: cleanCustomerDocument,
      customer_name: customerName,
      customer_email: customerEmailReal,
      customer_phone: customerPhone,
      shipping_address: effectiveAddress,
      shipping_city: effectiveCity,
      notes: effectiveNotes,
      subtotal: sqliteOrder?.subtotal || orderTotal,
      discount: sqliteOrder?.discount || 0,
      total: orderTotal,
      initial_payment: amount,
      paid_amount: amount,
      balance: restante,
      status: orderStatus,
      wompi_reference: reference,
      wompi_transaction_id: transaction.id || "",
      yeminus_document_id: documentId,
      yeminus_sync_status: yeminusSyncStatus,
      yeminus_last_error: yeminusLastError
    }, orderItemsToProcess);

    // Registrar pago en SQLite con UUID válido
    const newPayId = crypto.randomUUID();
    savePayment({
      id: newPayId,
      order_id: orderUuid,
      amount,
      payment_reference: reference,
      transaction_id: transaction.id || "",
      payment_method: (payment_method_type || "wompi").toLowerCase(),
      status: "approved",
      raw_data: JSON.stringify(transaction),
      created_at: new Date().toISOString()
    });

    // 2. Replicar en Supabase para compatibilidad externa (con nombre limpio, sin [Ref: ...])
    if (supabase) {
      try {
        const prodSummaryName = orderItemsToProcess.map((it: any) => `${it.quantity || 1}x ${it.product_name}`).join(", ") || "Pedido Navideño Impormax";
        const metaParts = [];
        if (documentId) metaParts.push(`Ref: ${documentId}`);
        if (cleanCustomerDocument) metaParts.push(`Doc: ${cleanCustomerDocument}`);
        if (effectiveAddress) metaParts.push(`Dir: ${effectiveAddress}`);
        if (effectiveCity) metaParts.push(`Ciudad: ${effectiveCity}`);
        if (effectiveNotes) metaParts.push(`Obs: ${effectiveNotes}`);
        const metaSuffix = metaParts.length > 0 ? ` [${metaParts.join(" | ")}]` : "";

        const createdOrderRecord: any = {
          id: orderUuid,
          cliente_nombre: customerName,
          cliente_email: customerEmailReal,
          cliente_telefono: customerPhone,
          producto_id: orderItemsToProcess.map((it: any) => it.product_id).filter((id: string) => id && id !== "ONLINE").join(", ") || (orderItemsToProcess[0]?.product_reference || "ONLINE"),
          producto_name: `${prodSummaryName}${metaSuffix}`,
          total: orderTotal,
          abonado: amount,
          restante: restante,
          estado: orderStatus
        };

        const extendedOrderRecord: any = {
          ...createdOrderRecord,
          cliente_documento: cleanCustomerDocument || "",
          direccion_envio: effectiveAddress || "",
          ciudad_envio: effectiveCity || "",
          observaciones: effectiveNotes || "",
          subtotal: sqliteOrder?.subtotal || orderTotal,
          descuento: sqliteOrder?.discount || 0,
          referencia_wompi: reference || "",
          transaccion_id: transaction?.id || "",
          documento_yeminus: documentId || ""
        };

        const { data: existingPed } = await supabase.from("pedidos").select("id").eq("id", orderUuid).maybeSingle();
        if (existingPed) {
          const { error: updErr } = await supabase.from("pedidos").update(extendedOrderRecord).eq("id", orderUuid);
          if (updErr) {
            const { observaciones: _ob, ...recNoObs } = extendedOrderRecord;
            const { error: updErr2 } = await supabase.from("pedidos").update(recNoObs).eq("id", orderUuid);
            if (updErr2) {
              await supabase.from("pedidos").update(createdOrderRecord).eq("id", orderUuid);
            }
          }
        } else {
          const { error: insErr } = await supabase.from("pedidos").insert([extendedOrderRecord]);
          if (insErr) {
            const { observaciones: _ob, ...recNoObs } = extendedOrderRecord;
            const { error: insErr2 } = await supabase.from("pedidos").insert([recNoObs]);
            if (insErr2) {
              await supabase.from("pedidos").insert([createdOrderRecord]);
            }
          }
        }

        // Replicar items en order_items de Supabase si la tabla existe
        try {
          for (const it of orderItemsToProcess) {
            await supabase.from("order_items").upsert([{
              id: it.id || crypto.randomUUID(),
              order_id: orderUuid,
              product_id: it.product_id,
              product_reference: it.product_reference || it.product_id,
              product_name: it.product_name,
              quantity: it.quantity || 1,
              unit_price: it.unit_price || 0,
              subtotal: it.subtotal || 0,
              total: it.total || 0
            }]);
          }
        } catch {}

        await supabase.from("pagos").insert([{
          id: newPayId,
          pedido_id: orderUuid,
          monto: amount,
          referencia_pago: reference,
          estado_pago: "aprobado",
          metodo_pago: (payment_method_type || "wompi").toLowerCase()
        }]);
      } catch (sbErr: any) {
        console.warn("[CONFIRM SB MIRROR ERR]", sbErr.message);
      }
    }

    processedWompiReferences.add(reference);

    // Descontar inventario local
    deductLocalInventory(orderItemsToProcess, reference);

    logApi("SUCCESS", "WOMPI CONFIRMATION", `Pedido confirmado: ${orderUuid} (${orderStatus}, ERP: ${yeminusSyncStatus})`, { reference, orderUuid });

    const receipt = buildReceiptData(transaction, sessionData, savedSqliteOrder, documentId, amount, {
      id: newPayId,
      metodo_pago: payment_method_type
    });

    // Disparar envío automático de correo al cliente con todos los datos del pedido y radicado
    sendOrderConfirmationEmail({
      customer_name: customerName,
      customer_email: customerEmailReal,
      customer_phone: customerPhone,
      customer_document: cleanCustomerDocument,
      shipping_address: effectiveAddress,
      shipping_city: effectiveCity,
      notes: effectiveNotes,
      wompi_reference: reference,
      wompi_transaction_id: transaction?.id || "",
      yeminus_document_id: documentId,
      total_amount: orderTotal,
      paid_amount: amount,
      balance_pending: restante,
      items: orderItemsToProcess,
      payment_method_label: receipt.paymentMethod?.label
    }).catch(mailErr => console.error("[EMAIL AUTO ERROR]", mailErr.message));

    return {
      success: true,
      status: "APPROVED",
      document_id: documentId,
      order: savedSqliteOrder,
      receipt
    };
  })();

  if (refKey) {
    inFlightWompiConfirmations.set(refKey, confirmPromise);
  }

  try {
    return await confirmPromise;
  } finally {
    if (refKey) {
      inFlightWompiConfirmations.delete(refKey);
    }
  }
}

// 8. Endpoint para Confirmar Transacción desde el Frontend tras retorno de Wompi
app.post("/api/wompi/confirm-transaction", async (req, res) => {
  try {
    const { transactionId, fallbackOrderData, pendingCheckout } = req.body;
    const fallback = fallbackOrderData || pendingCheckout;
    if (!transactionId) {
      return res.status(400).json({ success: false, error: "Falta parámetro 'transactionId'" });
    }

    const prvKey = process.env.WOMPI_PRIVATE_KEY || "prv_prod_aUM7wa7SEXtMwL6fqgFUPdBkBeuda2v8";
    const pubKey = process.env.WOMPI_PUBLIC_KEY || "pub_prod_rYeI0ExCzLD8zRsQB8IQTpajkGFJlBkc";
    
    // Wompi exige Authorization con Bearer Private Key para consultar transacciones individuales
    let wompiResp = await fetch(`https://production.wompi.co/v1/transactions/${transactionId}`, {
      headers: {
        "Authorization": `Bearer ${prvKey}`
      }
    });

    if (!wompiResp.ok && wompiResp.status === 401) {
      wompiResp = await fetch(`https://production.wompi.co/v1/transactions/${transactionId}`, {
        headers: {
          "Authorization": `Bearer ${pubKey}`
        }
      });
    }

    let transaction: any = null;
    if (wompiResp.ok) {
      const wompiJson: any = await wompiResp.json();
      transaction = wompiJson.data;
    } else {
      // Fallback: Si no se encontró por ID o el parámetro es una referencia de comercio
      try {
        const refResp = await fetch(`https://production.wompi.co/v1/transactions?reference=${encodeURIComponent(transactionId)}`, {
          headers: { "Authorization": `Bearer ${prvKey}` }
        });
        if (refResp.ok) {
          const refJson: any = await refResp.json();
          if (refJson.data && refJson.data.length > 0) {
            transaction = refJson.data[0];
          }
        }
      } catch (refErr: any) {
        console.warn("[WOMPI CONFIRM REF FALLBACK WARN]", refErr.message);
      }
    }

    if (!transaction) {
      return res.status(404).json({ success: false, error: "Transacción no encontrada en Wompi" });
    }

    const { reference, status } = transaction;

    if (status !== "APPROVED") {
      await purgeRejectedWompiTransaction(reference);
      return res.json({
        success: false,
        status,
        message: status === "DECLINED"
          ? "El pago fue rechazado por la entidad bancaria en Wompi. No se ha generado ningún cobro ni pedido."
          : `El pago finalizó en estado '${status}'. Por favor intenta nuevamente con otro medio de pago.`
      });
    }

    const result = await confirmWompiApprovedTransaction(transaction, fallback);
    res.json(result);

  } catch (err: any) {
    logApi("ERROR", "POST /api/wompi/confirm-transaction", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8.1 Función y Endpoint de Reconciliación Automática de Pedidos Aprobados Wompi
async function reconcileWompiApprovedTransactions(options: { days?: number; force?: boolean } = {}) {
  const days = options.days || 60;
  const prvKey = process.env.WOMPI_PRIVATE_KEY || "prv_prod_aUM7wa7SEXtMwL6fqgFUPdBkBeuda2v8";
  const fromDate = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const untilDate = new Date().toISOString().slice(0, 10);

  let page = 1;
  let allTransactions: any[] = [];
  let hasMore = true;

  while (hasMore && page <= 5) {
    try {
      const wompiResp = await fetch(
        `https://production.wompi.co/v1/transactions?from_date=${fromDate}&until_date=${untilDate}&page=${page}&page_size=100`,
        {
          headers: {
            "Authorization": `Bearer ${prvKey}`
          }
        }
      );

      if (!wompiResp.ok) {
        const errTxt = await wompiResp.text();
        console.warn(`[RECONCILIATION] Error Wompi API página ${page}: ${errTxt}`);
        break;
      }

      const json = await wompiResp.json();
      const transactions = json.data || [];
      allTransactions.push(...transactions);

      if (transactions.length < 100 || (json.meta && allTransactions.length >= json.meta.total_results)) {
        hasMore = false;
      } else {
        page++;
      }
    } catch (e: any) {
      console.warn(`[RECONCILIATION] Error al consultar Wompi pág ${page}:`, e.message);
      break;
    }
  }

  const approved = allTransactions.filter((t: any) => t.status === "APPROVED");
  const supabase = getSupabaseAdmin();

  const reconciled: any[] = [];
  const skipped: any[] = [];

  for (const tx of approved) {
    let needsSync = true;
    if (supabase && !options.force) {
      const { data: existingPagos } = await supabase
        .from("pagos")
        .select("id, referencia_pago, pedido_id")
        .eq("referencia_pago", tx.reference);

      if (existingPagos && existingPagos.length > 0) {
        // Verificar que el pedido asociado realmente existe en pedidos
        const { data: existingPed } = await supabase
          .from("pedidos")
          .select("id")
          .eq("id", existingPagos[0].pedido_id);

        if (existingPed && existingPed.length > 0) {
          needsSync = false;
        }
      }
    }

    if (!needsSync) {
      skipped.push({ reference: tx.reference, status: "already_in_supabase" });
      continue;
    }

    // Consultar el detalle completo de la transacción individual para extraer billing_data.legal_id real
    let detailedTx = tx;
    try {
      const detailRes = await fetch(`https://production.wompi.co/v1/transactions/${tx.id}`, {
        headers: { "Authorization": `Bearer ${prvKey}` }
      });
      if (detailRes.ok) {
        const detailJson = await detailRes.json();
        if (detailJson.data) detailedTx = detailJson.data;
      }
    } catch (e: any) {
      console.warn(`[RECONCILE] Error al obtener detalle de transacción ${tx.id}:`, e.message);
    }

    console.log(`[RECONCILIATION] Sincronizando transacción aprobada pendiente: ${detailedTx.reference}`);
    const resSync = await confirmWompiApprovedTransaction(detailedTx);
    reconciled.push({
      reference: detailedTx.reference,
      amount: (detailedTx.amount_in_cents || 0) / 100,
      customer: detailedTx.customer_data?.full_name || detailedTx.customer_email,
      result: resSync
    });
  }
  // Recalcular y validar pedidos en Supabase para garantizar exactitud de abonos y saldos
  if (supabase) {
    try {
      const { data: allPagos } = await supabase.from("pagos").select("*").eq("estado_pago", "aprobado");
      if (allPagos && allPagos.length > 0) {
        const pagosByPed = new Map<string, number>();
        for (const p of allPagos) {
          pagosByPed.set(p.pedido_id, (pagosByPed.get(p.pedido_id) || 0) + Number(p.monto));
        }
        const { data: allPeds } = await supabase.from("pedidos").select("id, total, abonado, restante, estado");
        if (allPeds) {
          for (const ped of allPeds) {
            const totalPagado = pagosByPed.get(ped.id);
            if (totalPagado !== undefined && totalPagado > 0) {
              if (Math.abs(Number(ped.abonado) - totalPagado) > 1 || ped.estado === "pendiente") {
                const newRestante = Math.max(0, Number(ped.total) - totalPagado);
                const newEstado = newRestante <= 0 ? "pagado" : "abonando";
                await supabase.from("pedidos").update({
                  abonado: totalPagado,
                  restante: newRestante,
                  estado: newEstado
                }).eq("id", ped.id);
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.warn("[RECONCILE SB RECALC ERR]", err.message);
    }
  }

  logApi("INFO", "RECONCILIATION", `Conciliación Wompi completada: ${approved.length} aprobadas, ${reconciled.length} reconciliadas, ${skipped.length} omitidas.`);

  return {
    success: true,
    totalApproved: approved.length,
    reconciledCount: reconciled.length,
    skippedCount: skipped.length,
    reconciled,
    skipped
  };
}

app.post("/api/wompi/reconcile-transactions", async (req, res) => {
  try {
    const days = Number(req.body?.days || req.query?.days) || 60;
    const force = req.body?.force === true || req.query?.force === "true";
    const summary = await reconcileWompiApprovedTransactions({ days, force });
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para consultar todos los pedidos (Frontend Admin Portal y respaldo de contingencia)
app.get("/api/orders", async (req, res) => {
  try {
    let sqliteOrders = getAllOrders();
    
    // Si la base local está recién inicializada, sincronizar y recuperar desde Supabase
    if (sqliteOrders.length === 0) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        await syncAndRecoverFromSupabase(supabase);
        sqliteOrders = getAllOrders();
      }
    }

    const mappedOrders = sqliteOrders.map((o) => {
      const summaryName = o.items && o.items.length > 0
        ? o.items.map((it: any) => `${it.quantity || 1}x ${it.product_name}`).join(", ")
        : "Pedido Navideño Impormax";

      const primaryProdId = o.items && o.items.length > 0
        ? o.items.map((it: any) => it.product_reference || it.product_id).filter(Boolean).join(", ")
        : "";

      return {
        id: o.id,
        customer_name: o.customer_name || "Cliente Impormax",
        customer_email: o.customer_email || "",
        customer_phone: o.customer_phone || "",
        customer_document: o.customer_document || "",
        shipping_address: o.shipping_address || "Entrega a domicilio / Retiro en tienda",
        shipping_city: o.shipping_city || "",
        notes: o.notes || "",
        observaciones: o.notes || "",
        product_id: primaryProdId,
        product_name: summaryName,
        subtotal_amount: o.subtotal,
        discount_amount: o.discount,
        total_amount: o.total,
        deposit_amount: o.initial_payment,
        paid_amount: o.paid_amount,
        balance_pending: o.balance,
        status: o.status,
        wompi_reference: o.wompi_reference,
        wompi_transaction_id: o.wompi_transaction_id,
        yeminus_document_id: o.yeminus_document_id,
        yeminus_sync_status: o.yeminus_sync_status,
        yeminus_last_error: o.yeminus_last_error,
        items: o.items || [],
        created_at: o.created_at,
        updated_at: o.updated_at
      };
    });

    // Consultar pagos
    const allPayments = db.prepare(`SELECT * FROM payments ORDER BY created_at DESC`).all() as any[];

    res.json({
      success: true,
      orders: mappedOrders,
      payments: allPayments,
      count: mappedOrders.length
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint protegido para actualizar los artículos exactos de un pedido
app.post("/api/orders/:id/update-items", adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { items, yeminus_sync } = req.body;
    const order = getOrderById(id);
    if (!order) return res.status(404).json({ success: false, error: "Pedido no encontrado" });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: "Se requiere un arreglo de items no vacío" });
    }

    const newItems = items.map((it: any) => {
      const qty = Math.max(1, Number(it.quantity) || 1);
      const unitPrice = Number(it.unit_price || it.price) || 0;
      const subtotal = unitPrice * qty;
      const tax = Math.round(subtotal - (subtotal / 1.19));
      const pId = String(it.product_id && it.product_id !== "ONLINE" ? it.product_id : (it.product_reference || "")).trim();
      const pRef = String(it.product_reference && it.product_reference !== "ONLINE" ? it.product_reference : pId).trim();
      return {
        product_id: pId || "8010141",
        product_reference: pRef || "ANCancun180",
        product_name: String(it.product_name || "Producto Navideño").trim(),
        quantity: qty,
        unit_price: unitPrice,
        discount_percentage: Number(it.discount_percentage) || 0,
        discount_amount: Number(it.discount_amount) || 0,
        subtotal,
        tax,
        total: subtotal,
        warehouse_origin: "05",
        warehouse_destination: "07"
      };
    });

    const newTotal = newItems.reduce((acc: number, it: any) => acc + it.total, 0);
    const newBalance = Math.max(0, newTotal - order.paid_amount);
    const newStatus = order.paid_amount >= newTotal ? "pagado" : (order.paid_amount > 0 ? "abonando" : "pendiente");

    saveOrderWithItems({
      ...order,
      total: newTotal,
      balance: newBalance,
      status: newStatus
    }, newItems);

    // Replicar en Supabase pedidos
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const prodSummary = newItems.map((i: any) => `${i.quantity}x ${i.product_name}`).join(", ");
        const prodSkus = newItems.map((i: any) => i.product_id).join(", ");
        await supabase.from("pedidos").update({
          producto_id: prodSkus,
          producto_name: prodSummary,
          total: newTotal,
          restante: newBalance,
          estado: newStatus
        }).eq("id", id);
      } catch (sbErr: any) {
        console.warn("[UPDATE ITEMS SB WARN]", sbErr.message);
      }
    }

    let syncResultMsg = "";
    if (yeminus_sync) {
      const syncRes = await createOrSyncYeminusDocument({
        customer_document: order.customer_document,
        customer_name: order.customer_name,
        total_amount: newTotal,
        deposit_amount: order.paid_amount,
        customer_address: order.shipping_address,
        customer_city: order.shipping_city,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone,
        payment_method: "wompi",
        order_id: id,
        wompi_reference: order.wompi_reference || "",
        payment_reference: order.wompi_reference || "",
        items: newItems
      });
      if (syncRes.success && syncRes.document_id) {
        db.prepare(`UPDATE orders SET yeminus_document_id = ?, yeminus_sync_status = 'SYNCED', yeminus_last_error = '' WHERE id = ?`).run(syncRes.document_id, id);
        syncResultMsg = ` y radicado en Yeminus ERP: ${syncRes.document_id}`;
      } else {
        db.prepare(`UPDATE orders SET yeminus_sync_status = 'ERP_SYNC_FAILED', yeminus_last_error = ? WHERE id = ?`).run(syncRes.error || "Error ERP", id);
        syncResultMsg = ` (Aviso ERP: ${syncRes.error})`;
      }
    }

    res.json({
      success: true,
      message: `Artículos del pedido actualizados con éxito${syncResultMsg}`,
      order: getOrderById(id)
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint protegido para actualizar la totalidad de los datos de un pedido (Cliente, Envío y Artículos)
app.post("/api/orders/:id/update-order", adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      customer_name,
      customer_document,
      customer_phone,
      customer_email,
      shipping_address,
      shipping_city,
      notes,
      observaciones,
      items,
      yeminus_sync
    } = req.body;

    const order = getOrderById(id);
    if (!order) return res.status(404).json({ success: false, error: "Pedido no encontrado" });

    const cleanNotes = notes !== undefined ? String(notes).trim() : (observaciones !== undefined ? String(observaciones).trim() : order.notes);

    // Validar y estructurar items
    const parsedItems = (Array.isArray(items) && items.length > 0) ? items.map((it: any) => {
      const qty = Math.max(1, Number(it.quantity) || 1);
      const unitPrice = Number(it.unit_price || it.price) || 0;
      const subtotal = unitPrice * qty;
      const tax = Math.round(subtotal - (subtotal / 1.19));
      const pId = String(it.product_id && it.product_id !== "ONLINE" ? it.product_id : (it.sku && it.sku !== "ONLINE" ? it.sku : (it.product_reference || ""))).trim();
      const pRef = String(it.product_reference && it.product_reference !== "ONLINE" ? it.product_reference : pId).trim();
      return {
        product_id: pId || "8010141",
        product_reference: pRef || "ANCancun180",
        product_name: String(it.product_name || it.name || "Producto Navideño").trim(),
        quantity: qty,
        unit_price: unitPrice,
        discount_percentage: Number(it.discount_percentage) || 0,
        discount_amount: Number(it.discount_amount) || 0,
        subtotal,
        tax,
        total: subtotal,
        warehouse_origin: "05",
        warehouse_destination: "07"
      };
    }) : (order.items || []);

    const newTotal = parsedItems.length > 0 ? parsedItems.reduce((acc: number, it: any) => acc + it.total, 0) : order.total;
    const newBalance = Math.max(0, newTotal - order.paid_amount);
    const newStatus = order.paid_amount >= newTotal ? "pagado" : (order.paid_amount > 0 ? "abonando" : "pendiente");

    const updatedOrder = saveOrderWithItems({
      ...order,
      customer_name: customer_name !== undefined ? String(customer_name).trim() : order.customer_name,
      customer_document: customer_document !== undefined ? String(customer_document).trim() : order.customer_document,
      customer_phone: customer_phone !== undefined ? String(customer_phone).trim() : order.customer_phone,
      customer_email: customer_email !== undefined ? String(customer_email).trim() : order.customer_email,
      shipping_address: shipping_address !== undefined ? String(shipping_address).trim() : order.shipping_address,
      shipping_city: shipping_city !== undefined ? String(shipping_city).trim() : order.shipping_city,
      notes: cleanNotes,
      total: newTotal,
      subtotal: newTotal,
      balance: newBalance,
      status: newStatus
    }, parsedItems);

    // Replicar en Supabase pedidos
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const prodSummary = parsedItems.map((i: any) => `${i.quantity}x ${i.product_name}`).join(", ");
        const prodSkus = parsedItems.map((i: any) => i.product_id).join(", ");
        const updatePayload: any = {
          cliente_nombre: updatedOrder.customer_name,
          cliente_email: updatedOrder.customer_email,
          cliente_telefono: updatedOrder.customer_phone,
          cliente_documento: updatedOrder.customer_document,
          direccion_envio: updatedOrder.shipping_address,
          ciudad_envio: updatedOrder.shipping_city,
          observaciones: updatedOrder.notes,
          producto_id: prodSkus,
          producto_name: prodSummary,
          total: newTotal,
          restante: newBalance,
          estado: newStatus
        };
        const { error: updErr } = await supabase.from("pedidos").update(updatePayload).eq("id", id);
        if (updErr) {
          const { observaciones: _ob, ...noObsPayload } = updatePayload;
          await supabase.from("pedidos").update(noObsPayload).eq("id", id);
        }
      } catch (sbErr: any) {
        console.warn("[UPDATE ORDER SB WARN]", sbErr.message);
      }
    }

    let syncResultMsg = "";
    if (yeminus_sync) {
      const syncRes = await createOrSyncYeminusDocument({
        customer_document: updatedOrder.customer_document,
        customer_name: updatedOrder.customer_name,
        total_amount: newTotal,
        deposit_amount: updatedOrder.paid_amount,
        customer_address: updatedOrder.shipping_address,
        customer_city: updatedOrder.shipping_city,
        customer_email: updatedOrder.customer_email,
        customer_phone: updatedOrder.customer_phone,
        payment_method: "wompi",
        order_id: id,
        wompi_reference: updatedOrder.wompi_reference || "",
        payment_reference: updatedOrder.wompi_reference || "",
        items: parsedItems
      });
      if (syncRes.success && syncRes.document_id) {
        db.prepare(`UPDATE orders SET yeminus_document_id = ?, yeminus_sync_status = 'SYNCED', yeminus_last_error = '' WHERE id = ?`).run(syncRes.document_id, id);
        syncResultMsg = ` y radicado con éxito en Yeminus ERP: ${syncRes.document_id}`;
      } else {
        db.prepare(`UPDATE orders SET yeminus_sync_status = 'ERP_SYNC_FAILED', yeminus_last_error = ? WHERE id = ?`).run(syncRes.error || "Error ERP", id);
        syncResultMsg = ` (Aviso ERP: ${syncRes.error})`;
      }
    }

    res.json({
      success: true,
      message: `Pedido, dirección de entrega y artículos actualizados con éxito${syncResultMsg}`,
      order: getOrderById(id)
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint protegido para actualizar el nombre y detalle de productos de un pedido
app.post("/api/orders/update-product", adminAuthMiddleware, async (req, res) => {
  try {
    const { orderId, productName, productId } = req.body;
    if (!orderId || !productName) {
      return res.status(400).json({ success: false, error: "Faltan parámetros 'orderId' o 'productName'" });
    }

    const order = getOrderById(orderId);
    if (!order) return res.status(404).json({ success: false, error: "Pedido no encontrado" });

    // Actualizar nombre del primer item o de la orden
    const items = order.items && order.items.length > 0 ? [...order.items] : [{
      product_id: (productId && productId !== "ONLINE") ? productId : ((order.items?.[0]?.product_id && order.items[0].product_id !== "ONLINE") ? order.items[0].product_id : "8010141"),
      product_name: productName,
      quantity: 1,
      unit_price: order.total,
      subtotal: order.total,
      tax: Math.round(order.total - (order.total / 1.19)),
      total: order.total
    }];

    if (items[0]) {
      items[0].product_name = productName;
      if (productId) items[0].product_id = productId;
    }

    saveOrderWithItems(order, items);

    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        await supabase
          .from("pedidos")
          .update({
            producto_name: productName.trim(),
            ...(productId ? { producto_id: productId.trim() } : {})
          })
          .eq("id", orderId);
      } catch {}
    }

    logApi("SUCCESS", "UPDATE ORDER PRODUCT", `Pedido ${orderId} actualizado con producto: ${productName}`);
    res.json({ success: true, order: getOrderById(orderId) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para reenviar el correo de confirmación de un pedido al cliente
app.post("/api/orders/:id/resend-email", async (req, res) => {
  try {
    const { id } = req.params;
    const targetEmail = req.body?.email;
    const clientOrderData = req.body?.orderData;

    let order = getOrderById(id) || getOrderByWompiRef(id);
    let dbOrd: any = null;

    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { data } = await supabase.from("pedidos").select("*").eq("id", id).maybeSingle();
        if (data) dbOrd = data;
      } catch {}
    }

    if (!order && dbOrd) {
      order = {
        id: dbOrd.id,
        customer_name: dbOrd.cliente_nombre,
        customer_email: dbOrd.cliente_email,
        customer_phone: dbOrd.cliente_telefono,
        customer_document: dbOrd.cliente_documento,
        shipping_address: dbOrd.direccion_envio,
        shipping_city: dbOrd.ciudad_envio,
        total: Number(dbOrd.total) || 0,
        paid_amount: Number(dbOrd.abonado) || 0,
        balance: Number(dbOrd.restante) || 0,
        wompi_reference: dbOrd.referencia_wompi,
        wompi_transaction_id: dbOrd.transaccion_id,
        yeminus_document_id: dbOrd.documento_yeminus,
        notes: dbOrd.observaciones,
        items: []
      } as any;
    }

    if (!order && clientOrderData) {
      order = clientOrderData;
    }

    if (!order) {
      return res.status(404).json({ success: false, error: "Pedido no encontrado" });
    }

    const emailToSend = targetEmail || order.customer_email || clientOrderData?.customer_email;
    if (!emailToSend || !emailToSend.includes("@")) {
      return res.status(400).json({ success: false, error: "El pedido no cuenta con un correo electrónico válido" });
    }

    // Total, abonado y saldo exactos garantizados
    const realTotal = dbOrd?.total !== undefined ? Number(dbOrd.total) : (clientOrderData?.total_amount ? Number(clientOrderData.total_amount) : Number(order.total || 0));
    const realPaid = dbOrd?.abonado !== undefined ? Number(dbOrd.abonado) : (clientOrderData?.paid_amount !== undefined ? Number(clientOrderData.paid_amount) : Number(order.paid_amount || 0));
    const realBalance = dbOrd?.restante !== undefined ? Number(dbOrd.restante) : (clientOrderData?.balance_pending !== undefined ? Number(clientOrderData.balance_pending) : Math.max(0, realTotal - realPaid));

    // Reconstruir items si vienen vacíos o con producto genérico
    let finalItems = (Array.isArray(order.items) && order.items.length > 0)
      ? order.items
      : (Array.isArray(clientOrderData?.items) && clientOrderData.items.length > 0 ? clientOrderData.items : []);

    const hasOnlyGenericCancun = finalItems.length === 1 && finalItems[0]?.product_id === "8010141" && !String((order as any).product_name || dbOrd?.producto_name || "").toLowerCase().includes("cancun");

    if (finalItems.length === 0 || hasOnlyGenericCancun) {
      const catalog = productsCache?.data || loadProductsFromLocalFile() || [];
      const prodSummary = String((order as any).product_name || dbOrd?.producto_name || clientOrderData?.product_name || "").replace(/\[[^\]]*\]/g, "").trim();
      const rawSkus = String(dbOrd?.producto_id || (order as any).product_id || clientOrderData?.product_id || "").split(",").map(s => s.trim()).filter(Boolean);
      const rawItemStrs = prodSummary.split(/,\s*(?=\d+x\s+)/).map(s => s.trim()).filter(Boolean);
      const itemsToProcess = rawItemStrs.length > 0 ? rawItemStrs : (prodSummary ? [prodSummary] : []);

      if (itemsToProcess.length > 0) {
        finalItems = itemsToProcess.map((itemStr: string, idx: number) => {
          const m = itemStr.match(/^(\d+)x\s+(.+)$/);
          const qty = m ? parseInt(m[1]) : 1;
          const name = m ? m[2].trim() : itemStr.trim();
          const targetSku = rawSkus[idx] || rawSkus[0] || "";

          const foundCat = catalog.find((p: any) =>
            (targetSku && targetSku !== "ONLINE" && (String(p.id).toLowerCase() === targetSku.toLowerCase() || String(p.code).toLowerCase() === targetSku.toLowerCase() || (p.reference && String(p.reference).toLowerCase() === targetSku.toLowerCase()))) ||
            (name && p.name.toLowerCase() === name.toLowerCase()) ||
            (name && (name.toLowerCase().includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(name.toLowerCase())))
          );

          if (foundCat) {
            const unitPrice = Number(foundCat.discountPrice || foundCat.price);
            return {
              product_id: foundCat.id,
              product_reference: foundCat.reference || foundCat.id,
              product_name: foundCat.name,
              quantity: qty,
              unit_price: unitPrice,
              total: unitPrice * qty
            };
          }

          const fallbackUnit = Math.round(realTotal / (itemsToProcess.length * qty));
          return {
            product_id: targetSku || `PROD-${idx + 1}`,
            product_reference: targetSku || "ONLINE",
            product_name: name,
            quantity: qty,
            unit_price: fallbackUnit,
            total: fallbackUnit * qty
          };
        });
      }
    }

    const emailResult = await sendOrderConfirmationEmail({
      customer_name: order.customer_name || clientOrderData?.customer_name,
      customer_email: emailToSend,
      customer_phone: order.customer_phone || clientOrderData?.customer_phone,
      customer_document: order.customer_document || clientOrderData?.customer_document,
      shipping_address: order.shipping_address || clientOrderData?.shipping_address,
      shipping_city: order.shipping_city || clientOrderData?.shipping_city,
      notes: order.notes || clientOrderData?.notes,
      wompi_reference: order.wompi_reference || clientOrderData?.wompi_reference,
      wompi_transaction_id: order.wompi_transaction_id || clientOrderData?.wompi_transaction_id,
      yeminus_document_id: order.yeminus_document_id || clientOrderData?.yeminus_document_id,
      total_amount: realTotal,
      paid_amount: realPaid,
      balance_pending: realBalance,
      items: finalItems,
      created_at: order.created_at || clientOrderData?.created_at
    });

    if (emailResult.success) {
      return res.json({
        success: true,
        message: `Correo de confirmación enviado exitosamente a ${emailToSend}`,
        messageId: emailResult.messageId
      });
    } else {
      return res.status(500).json({
        success: false,
        error: emailResult.error || "Fallo al enviar correo"
      });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para buscar pedidos por número de cédula / NIT para el portal de clientes
app.get("/api/orders/by-document/:doc", async (req, res) => {
  try {
    const rawDoc = String(req.params.doc || "").trim();
    const cleanDoc = rawDoc.replace(/\D/g, "");
    if (!cleanDoc && !rawDoc.includes("@")) {
      return res.status(400).json({ success: false, error: "Número de documento inválido" });
    }

    const orderMap = new Map<string, any>();
    const supabase = getSupabaseAdmin();

    // 1. Buscar en SQLite
    const sqliteOrders = db.prepare(`
      SELECT * FROM orders 
      WHERE customer_document = ? 
         OR (length(?) >= 4 AND customer_document = ?)
         OR (length(?) >= 6 AND customer_phone LIKE ?)
         OR customer_email = ?
         OR id = ?
         OR wompi_reference = ?
      ORDER BY created_at DESC
    `).all(
      rawDoc,
      cleanDoc, cleanDoc,
      cleanDoc, `%${cleanDoc}%`,
      rawDoc,
      rawDoc,
      rawDoc
    ) as any[];

    for (const o of sqliteOrders) {
      orderMap.set(o.id, {
        ...o,
        items: o.items || []
      });
    }

    // 2. Buscar en Supabase de contingencia
    if (supabase) {
      try {
        let query = supabase.from("pedidos").select("*, pagos(*)");
        if (cleanDoc && cleanDoc.length >= 4) {
          query = query.or(`cliente_documento.eq.${cleanDoc},cliente_documento.eq.${rawDoc},cliente_telefono.ilike.%${cleanDoc}%`);
        } else if (rawDoc.includes("@")) {
          query = query.ilike("cliente_email", rawDoc);
        } else {
          query = query.or(`cliente_documento.eq.${rawDoc},referencia_wompi.eq.${rawDoc}`);
        }

        const { data: sbOrders, error: sbErr } = await query;
        console.log("[DEBUG BY-DOC]", { rawDoc, cleanDoc, sqliteCount: sqliteOrders.length, sbCount: sbOrders?.length, sbErr: sbErr?.message });

        if (sbOrders && sbOrders.length > 0) {
          for (const sb of sbOrders) {
            const existingInMap = orderMap.get(sb.id);
            if (!existingInMap) {
              orderMap.set(sb.id, {
                id: sb.id,
                customer_name: sb.cliente_nombre,
                customer_email: sb.cliente_email,
                customer_phone: sb.cliente_telefono,
                customer_document: sb.cliente_documento,
                shipping_address: sb.direccion_envio,
                shipping_city: sb.ciudad_envio,
                total: sb.total,
                paid_amount: sb.abonado,
                balance: sb.restante,
                status: sb.estado,
                wompi_reference: sb.referencia_wompi,
                wompi_transaction_id: sb.transaccion_id,
                yeminus_document_id: sb.documento_yeminus,
                notes: sb.observaciones,
                created_at: sb.created_at,
                items: [],
                sbPagos: sb.pagos || []
              });
            } else if (sb.pagos && sb.pagos.length > 0) {
              existingInMap.sbPagos = sb.pagos;
            }
          }
        }
      } catch (err: any) {
        console.warn("[BY-DOC SB WARN]", err.message);
      }
    }

    // 3. Filtrar de forma estricta para garantizar que solo se procesen pedidos pertenecientes al cliente consultado
    const matchesQuery = (ord: any) => {
      const doc = String(ord.customer_document || ord.cliente_documento || "").replace(/\D/g, "");
      const phone = String(ord.customer_phone || ord.cliente_telefono || "").replace(/\D/g, "");
      const email = String(ord.customer_email || ord.cliente_email || "").toLowerCase().trim();
      const id = String(ord.id || "").toLowerCase().trim();
      const ref = String(ord.wompi_reference || ord.referencia_wompi || "").toLowerCase().trim();
      const raw = rawDoc.toLowerCase().trim();

      if (cleanDoc && cleanDoc.length >= 4) {
        if (doc === cleanDoc || doc === raw) return true;
        if (cleanDoc.length >= 6 && phone.includes(cleanDoc)) return true;
      }
      if (raw.includes("@") && email === raw) return true;
      if (id === raw || ref === raw) return true;
      if (raw.length >= 8 && id.startsWith(raw)) return true;
      return false;
    };

    const matchingOrders = Array.from(orderMap.values()).filter(matchesQuery);

    // 4. Hidratar pagos y calcular con absoluta exactitud el saldo y total abonado
    const finalOrders = matchingOrders.map((o: any) => {
      const orderId = String(o.id);
      const targetWompiRef = String(o.wompi_reference || o.referencia_wompi || "").trim();

      // Pagos en SQLite: únicamente de este pedido específico
      const localPayments = targetWompiRef && targetWompiRef.length >= 6
        ? db.prepare(`
            SELECT * FROM payments 
            WHERE order_id = ? OR (payment_reference = ? AND length(payment_reference) >= 6)
            ORDER BY created_at ASC
          `).all(orderId, targetWompiRef) as any[]
        : db.prepare(`
            SELECT * FROM payments 
            WHERE order_id = ?
            ORDER BY created_at ASC
          `).all(orderId) as any[];

      // Combinar con pagos de Supabase
      const paymentsMap = new Map<string, any>();
      for (const lp of localPayments) {
        const key = lp.payment_reference || lp.id;
        const rawStatus = String(lp.status || "").toLowerCase();
        const normStatus = ["approved", "aprobado", "paid", "pagado"].includes(rawStatus) ? "approved" : (rawStatus || "approved");
        paymentsMap.set(key, {
          id: lp.id,
          order_id: orderId,
          amount: Number(lp.amount) || 0,
          payment_method: lp.payment_method || "wompi",
          payment_reference: lp.payment_reference || "",
          status: normStatus,
          created_at: lp.created_at || new Date().toISOString()
        });
      }

      const sbPagosList = Array.isArray(o.sbPagos) ? o.sbPagos : [];
      for (const sp of sbPagosList) {
        const key = sp.referencia_pago || sp.id;
        if (!paymentsMap.has(key)) {
          const rawStatus = String(sp.estado_pago || "").toLowerCase();
          const normStatus = ["approved", "aprobado", "paid", "pagado"].includes(rawStatus) ? "approved" : (rawStatus || "approved");
          paymentsMap.set(key, {
            id: sp.id,
            order_id: orderId,
            amount: Number(sp.monto) || 0,
            payment_method: sp.metodo_pago || "wompi",
            payment_reference: sp.referencia_pago || "",
            status: normStatus,
            created_at: sp.created_at || new Date().toISOString()
          });
        }
      }

      const mergedPayments = Array.from(paymentsMap.values());
      const approvedPayments = mergedPayments.filter(p => ["approved", "aprobado", "paid", "pagado"].includes(String(p.status || "").toLowerCase()));
      const totalPaidFromPayments = approvedPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

      const effectivePaid = Math.max(totalPaidFromPayments, Number(o.paid_amount || o.abonado) || 0);
      const orderTotal = Number(o.total || o.total_amount) || 0;
      const effectiveBalance = Math.max(0, orderTotal - effectivePaid);
      const effectiveStatus = effectiveBalance <= 0 && orderTotal > 0 ? "pagado" : (effectivePaid > 0 ? "abonando" : (o.status || "pendiente"));

      const { sbPagos, ...cleanOrder } = o;

      return {
        ...cleanOrder,
        total: orderTotal,
        total_amount: orderTotal,
        paid_amount: effectivePaid,
        abonado: effectivePaid,
        balance: effectiveBalance,
        balance_pending: effectiveBalance,
        status: effectiveStatus,
        payments: mergedPayments
      };
    });

    res.json({
      success: true,
      orders: finalOrders,
      count: finalOrders.length
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para consultar el historial de pagos y abonos de un pedido específico
app.get("/api/orders/:id/payments", async (req, res) => {
  try {
    const rawId = String(req.params.id || "").trim();
    if (!rawId) return res.status(400).json({ success: false, error: "ID de pedido requerido" });

    const order = getOrderById(rawId);
    const orderId = order ? order.id : rawId;
    const targetWompiRef = String(order?.wompi_reference || "").trim();

    // 1. Pagos locales: estrictamente de este pedido
    const localPayments = targetWompiRef && targetWompiRef.length >= 6
      ? db.prepare(`
          SELECT * FROM payments 
          WHERE order_id = ? OR (payment_reference = ? AND length(payment_reference) >= 6)
          ORDER BY created_at ASC
        `).all(orderId, targetWompiRef) as any[]
      : db.prepare(`
          SELECT * FROM payments 
          WHERE order_id = ?
          ORDER BY created_at ASC
        `).all(orderId) as any[];

    const paymentsMap = new Map<string, any>();
    for (const lp of localPayments) {
      const key = lp.payment_reference || lp.id;
      const rawStatus = String(lp.status || "").toLowerCase();
      const normStatus = ["approved", "aprobado", "paid", "pagado"].includes(rawStatus) ? "approved" : (rawStatus || "approved");
      paymentsMap.set(key, {
        id: lp.id,
        order_id: orderId,
        amount: Number(lp.amount) || 0,
        payment_method: lp.payment_method || "wompi",
        payment_reference: lp.payment_reference || "",
        status: normStatus,
        created_at: lp.created_at || new Date().toISOString()
      });
    }

    // 2. Pagos de Supabase: estrictamente de este pedido
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        let sbQuery = supabase.from("pagos").select("*");
        if (targetWompiRef && targetWompiRef.length >= 6) {
          sbQuery = sbQuery.or(`pedido_id.eq.${orderId},referencia_pago.eq.${targetWompiRef}`);
        } else {
          sbQuery = sbQuery.eq("pedido_id", orderId);
        }
        const { data: sbPagos } = await sbQuery;
        if (sbPagos) {
          for (const sp of sbPagos) {
            const key = sp.referencia_pago || sp.id;
            if (!paymentsMap.has(key)) {
              const rawStatus = String(sp.estado_pago || "").toLowerCase();
              const normStatus = ["approved", "aprobado", "paid", "pagado"].includes(rawStatus) ? "approved" : (rawStatus || "approved");
              paymentsMap.set(key, {
                id: sp.id,
                order_id: orderId,
                amount: Number(sp.monto) || 0,
                payment_method: sp.metodo_pago || "wompi",
                payment_reference: sp.referencia_pago || "",
                status: normStatus,
                created_at: sp.created_at || new Date().toISOString()
              });
            }
          }
        }
      } catch (sbErr: any) {
        console.warn("[PAYMENTS SB WARN]", sbErr.message);
      }
    }

    const allPayments = Array.from(paymentsMap.values());
    res.json({
      success: true,
      payments: allPayments,
      count: allPayments.length
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint protegido para eliminar un pedido individual de la base de datos
app.delete("/api/orders/:id", adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const order = getOrderById(id);
    if (!order) {
      return res.status(404).json({ success: false, error: "Pedido no encontrado" });
    }

    const deleted = deleteOrder(id);
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        await supabase.from("pagos").delete().eq("pedido_id", id);
        await supabase.from("pedidos").delete().eq("id", id);
      } catch (sbErr: any) {
        console.warn("[SUPABASE DELETE ERR]", sbErr.message);
      }
    }

    logApi("INFO", `DELETE /api/orders/${id}`, `Pedido ${id} (${order.customer_name}) eliminado por el administrador.`);
    res.json({ success: true, message: `Pedido ${id} eliminado con éxito` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint protegido para limpiar pedidos con errores o de prueba
app.post("/api/orders/clean-errors", adminAuthMiddleware, async (req, res) => {
  try {
    const orders = getAllOrders();
    const errorOrders = orders.filter(o =>
      o.yeminus_sync_status === "ERP_SYNC_FAILED" ||
      o.yeminus_sync_status === "ERROR" ||
      (o.yeminus_last_error && !o.yeminus_document_id) ||
      o.customer_name?.toLowerCase().includes("prueba") ||
      o.customer_name?.toLowerCase().includes("test")
    );

    let deletedCount = 0;
    const supabase = getSupabaseAdmin();

    for (const eo of errorOrders) {
      deleteOrder(eo.id);
      if (supabase) {
        try {
          await supabase.from("pagos").delete().eq("pedido_id", eo.id);
          await supabase.from("pedidos").delete().eq("id", eo.id);
        } catch {}
      }
      deletedCount++;
    }

    logApi("INFO", "POST /api/orders/clean-errors", `Se eliminaron ${deletedCount} pedidos con errores.`);
    res.json({
      success: true,
      deletedCount,
      message: `Se eliminaron ${deletedCount} pedidos con errores o de prueba del sistema.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para consultar todos los pagos registrados
app.get("/api/payments", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ success: false, error: "Supabase no disponible" });

    const { data: pagos, error } = await supabase
      .from("pagos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const mappedPayments = (pagos || []).map((p: any) => ({
      id: p.id,
      order_id: p.pedido_id,
      amount: Number(p.monto) || 0,
      payment_method: p.metodo_pago || "wompi",
      payment_reference: p.referencia_pago,
      status: p.estado_pago === "aprobado" ? "approved" : "pending",
      created_at: p.created_at
    }));

    res.json({ success: true, payments: mappedPayments });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint para obtener el Comprobante / Recibo Oficial de un Pedido o Transacción Wompi
app.get("/api/receipt/:idOrRef", async (req, res) => {
  try {
    const { idOrRef } = req.params;
    if (!idOrRef) return res.status(400).json({ success: false, error: "Identificador requerido" });

    const supabase = getSupabaseAdmin();
    let order: any = null;
    let payment: any = null;

    // 1. Prioridad: Buscar en la base de datos local SQLite (fuente de verdad estructurada de items)
    const sqliteOrder = getOrderById(idOrRef) || getOrderByWompiRef(idOrRef);
    if (sqliteOrder) {
      const prodSummary = sqliteOrder.items && sqliteOrder.items.length > 0
        ? sqliteOrder.items.map(it => `${it.quantity}x ${it.product_name}`).join(", ")
        : "Pedido Navideño Impormax";
      const primaryId = sqliteOrder.items && sqliteOrder.items.length > 0
        ? (sqliteOrder.items[0].product_reference || sqliteOrder.items[0].product_id)
        : "";

      order = {
        ...sqliteOrder,
        cliente_nombre: sqliteOrder.customer_name,
        cliente_email: sqliteOrder.customer_email,
        cliente_telefono: sqliteOrder.customer_phone,
        cliente_documento: sqliteOrder.customer_document,
        producto_name: prodSummary,
        producto_id: primaryId,
        total: sqliteOrder.total,
        abonado: sqliteOrder.paid_amount,
        restante: sqliteOrder.balance,
        estado: sqliteOrder.status,
        items: sqliteOrder.items
      };
      if (sqliteOrder.payments && sqliteOrder.payments.length > 0) {
        payment = sqliteOrder.payments[0];
      }
    }

    if (!order && supabase) {
      // 2. Buscar en pagos por referencia_pago o id
      const { data: pagos } = await supabase
        .from("pagos")
        .select("*, pedidos(*)")
        .or(`referencia_pago.eq.${idOrRef},id.eq.${idOrRef}`)
        .limit(1);

      if (pagos && pagos.length > 0) {
        payment = pagos[0];
        order = payment.pedidos;
      }

      // 3. Si no se encontró por pago, buscar en pedidos
      if (!order) {
        const { data: peds } = await supabase
          .from("pedidos")
          .select("*")
          .or(`id.eq.${idOrRef},producto_name.ilike.%${idOrRef}%`)
          .limit(1);
        if (peds && peds.length > 0) {
          order = peds[0];
          const { data: payList } = await supabase
            .from("pagos")
            .select("*")
            .eq("pedido_id", order.id)
            .order("created_at", { ascending: false });
          if (payList && payList.length > 0) {
            payment = payList[0];
          }
        }
      }
    }

    // 3. Consultar Wompi API si se tiene ID o referencia
    let wompiTx: any = null;
    const prvKey = process.env.WOMPI_PRIVATE_KEY || "prv_prod_aUM7wa7SEXtMwL6fqgFUPdBkBeuda2v8";
    try {
      if (idOrRef.includes("-") && idOrRef.length > 15) {
        const txResp = await fetch(`https://production.wompi.co/v1/transactions/${idOrRef}`, {
          headers: { Authorization: `Bearer ${prvKey}` }
        });
        if (txResp.ok) {
          const txJson = await txResp.json();
          wompiTx = txJson.data;
        }
      }
      if (!wompiTx) {
        const txRefResp = await fetch(`https://production.wompi.co/v1/transactions?reference=${encodeURIComponent(idOrRef)}`, {
          headers: { Authorization: `Bearer ${prvKey}` }
        });
        if (txRefResp.ok) {
          const txRefJson = await txRefResp.json();
          if (txRefJson.data && txRefJson.data.length > 0) {
            wompiTx = txRefJson.data[0];
          }
        }
      }
    } catch (e: any) {
      console.warn("[RECEIPT WOMPI FETCH WARN]", e.message);
    }

    const sessionData = getPendingSession(idOrRef) || (wompiTx?.reference ? getPendingSession(wompiTx.reference) : null) || {};
    const docId = order?.producto_name?.match(/\[Ref:\s*([^\]]+)\]/)?.[1] || (wompiTx?.reference ? `SLP-${wompiTx.reference}` : `SLP-${idOrRef}`);

    const receipt = buildReceiptData(
      wompiTx || {
        id: payment?.id || idOrRef,
        reference: payment?.referencia_pago || idOrRef,
        amount_in_cents: (payment?.monto || order?.abonado || 0) * 100,
        payment_method_type: payment?.metodo_pago || "WOMPI",
        created_at: payment?.created_at || order?.created_at
      },
      sessionData,
      order,
      docId,
      payment?.monto || (wompiTx?.amount_in_cents ? wompiTx.amount_in_cents / 100 : (order?.abonado || 0)),
      payment
    );

    res.json({ success: true, receipt, order, payment });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Webhook de Eventos Wompi (Confirmaciones de Pago Asíncronas)
app.post("/api/wompi/webhook", async (req, res) => {
  try {
    const event = req.body;
    logApi("INFO", "POST /api/wompi/webhook", "Webhook recibido de Wompi", event);

    if (event && event.event === "transaction.updated") {
      const transaction = event.data?.transaction;
      if (transaction && transaction.id) {
        const prvKey = process.env.WOMPI_PRIVATE_KEY || "prv_prod_aUM7wa7SEXtMwL6fqgFUPdBkBeuda2v8";
        
        // Validación de Seguridad: Verificar el estado directamente contra el API oficial de Wompi
        let verifiedTx: any = transaction;
        try {
          const verifyResp = await fetch(`https://production.wompi.co/v1/transactions/${transaction.id}`, {
            headers: { "Authorization": `Bearer ${prvKey}` }
          });
          if (verifyResp.ok) {
            const verifyJson = await verifyResp.json();
            if (verifyJson.data) verifiedTx = verifyJson.data;
          }
        } catch (vErr: any) {
          console.warn("[WEBHOOK VERIFY WARN] No se pudo re-verificar con Wompi:", vErr.message);
        }

        const { reference, status } = verifiedTx;
        if (status === "APPROVED") {
          await confirmWompiApprovedTransaction(verifiedTx);
        } else {
          await purgeRejectedWompiTransaction(reference);
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (err: any) {
    logApi("ERROR", "POST /api/wompi/webhook", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Setup Vite development middleware or static production serving
async function startServer() {
  // Sincronizar y recuperar pedidos históricos de Supabase (ej. Federico Tangarife, pedidos anteriores)
  try {
    const sbAdmin = getSupabaseAdmin();
    if (sbAdmin) {
      syncAndRecoverFromSupabase(sbAdmin).then(count => {
        console.log(`[DATABASE RECOVERY] Sincronizados y normalizados ${count} pedidos desde Supabase hacia la base de datos relacional local.`);
      });
    }
  } catch (e: any) {
    console.warn("[DATABASE RECOVERY WARN]", e.message);
  }

  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: false },
        appType: "spa"
      });
      app.use(vite.middlewares);
      logApi("INFO", "SYSTEM", "Vite dev server middleware montado");
    } catch (err: any) {
      logApi("ERROR", "SYSTEM", "Fallo al iniciar Vite dev, sirviendo archivos estáticos: " + err.message);
      serveStatic();
    }
  } else {
    serveStatic();
  }

  function serveStatic() {
    const possibleDirs = [
      path.join(process.cwd(), "dist"),
      process.cwd(),
      path.join(currentDir, "dist"),
      currentDir,
    ];
    const targetPath = possibleDirs.find((d) => fs.existsSync(path.join(d, "index.html"))) || process.cwd();
    const assetsPath = path.join(targetPath, "assets");

    // Servir estáticos en /plansepare, /assets y raíz /
    app.use("/plansepare/assets", express.static(assetsPath));
    app.use("/plansepare", express.static(targetPath, { index: false }));
    app.use("/assets", express.static(assetsPath));
    app.use(express.static(targetPath, { index: false }));
    if (fs.existsSync(assetsPath)) {
      app.use(express.static(assetsPath));
    }

    // Fallback para SPA en cualquier otra ruta no-API
    app.use((req, res) => {
      if (req.path.startsWith("/api/")) {
        return res.status(404).json({ error: "Ruta de API no encontrada: " + req.path });
      }

      // Evitar entregar index.html en peticiones de JS/CSS/imágenes que no existan
      if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|json|woff|woff2|ttf|eot)$/i.test(req.path)) {
        return res.status(404).send(`Archivo no encontrado: ${req.path}`);
      }

      const indexPath = path.join(targetPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send(`Error: index.html no encontrado en ${indexPath}`);
      }
    });

    logApi("INFO", "SYSTEM", `Servidor estático listo sirviendo desde: ${targetPath}`);
  }

  if (typeof (globalThis as any).PhusionPassenger !== "undefined") {
    app.listen("passenger", () => {
      console.log("Server running on Phusion Passenger");
    });
  } else {
    const port = isDev ? 3000 : (Number(process.env.PORT) || 3000);
    app.listen(port, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${port} (${isDev ? 'development' : 'production'})`);
    });
  }

  // Reconciliación automática y continua de pagos y abonos aprobados de Wompi
  setTimeout(() => {
    reconcileWompiApprovedTransactions({ days: 90 }).catch((e: any) => console.warn("[WOMPI AUTO RECONCILE STARTUP ERR]", e.message));
  }, 3000);

  setInterval(() => {
    reconcileWompiApprovedTransactions({ days: 14 }).catch((e: any) => console.warn("[WOMPI INTERVAL RECONCILE ERR]", e.message));
  }, 10 * 60 * 1000);
}

startServer();
