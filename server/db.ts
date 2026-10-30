import fs from "fs";
import path from "path";
import { createRequire } from "module";

const requireModule = typeof require === "function" ? require : createRequire(typeof __filename !== "undefined" ? __filename : process.cwd());

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "impormax_orders.db");
const JSON_BACKUP_PATH = path.join(DATA_DIR, "impormax_orders_backup.json");

interface FallbackState {
  orders: Record<string, any>;
  order_items: Record<string, any>;
  payments: Record<string, any>;
  pending_checkouts: Record<string, any>;
}

class FallbackDatabase {
  private data: FallbackState = {
    orders: {},
    order_items: {},
    payments: {},
    pending_checkouts: {}
  };

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(JSON_BACKUP_PATH)) {
        const raw = fs.readFileSync(JSON_BACKUP_PATH, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          this.data = {
            orders: parsed.orders || {},
            order_items: parsed.order_items || {},
            payments: parsed.payments || {},
            pending_checkouts: parsed.pending_checkouts || {}
          };
          console.log(`[FALLBACK DB] Datos locales cargados: ${Object.keys(this.data.orders).length} pedidos`);
        }
      }
    } catch (e: any) {
      console.warn("[FALLBACK DB] Error cargando desde disco:", e.message);
    }
  }

  private saveToDisk() {
    try {
      const tempPath = `${JSON_BACKUP_PATH}.${Date.now()}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), "utf8");
      fs.renameSync(tempPath, JSON_BACKUP_PATH);
    } catch (e: any) {
      console.warn("[FALLBACK DB] Error guardando en disco:", e.message);
    }
  }

  exec(sql: string) {
    return this;
  }

  pragma(str: string) {
    return this;
  }

  prepare(sql: string) {
    const s = sql.trim().replace(/\s+/g, " ");
    const dbInstance = this;

    return {
      run(...args: any[]) {
        try {
          // 1. INSERT INTO orders ...
          if (s.startsWith("INSERT INTO orders")) {
            const [
              id, customer_document, customer_name, customer_email, customer_phone,
              shipping_address, shipping_city, notes, subtotal, discount, total,
              initial_payment, paid_amount, balance, status, wompi_reference,
              wompi_transaction_id, yeminus_document_id, yeminus_sync_status,
              yeminus_last_error, created_at, updated_at
            ] = args;

            const existing = dbInstance.data.orders[id] || {};
            const cleanDoc = (customer_document && customer_document !== "222222222") ? customer_document : (existing.customer_document || customer_document || "");
            const cleanName = (customer_name && customer_name !== "Cliente Impormax") ? customer_name : (existing.customer_name || customer_name || "Cliente Impormax");
            const cleanAddr = (shipping_address && !shipping_address.includes("Entrega a domicilio / Retiro en tienda")) ? shipping_address : (existing.shipping_address || shipping_address || "");

            dbInstance.data.orders[id] = {
              ...existing,
              id: String(id),
              customer_document: cleanDoc,
              customer_name: cleanName,
              customer_email: customer_email || existing.customer_email || "",
              customer_phone: customer_phone || existing.customer_phone || "",
              shipping_address: cleanAddr,
              shipping_city: shipping_city || existing.shipping_city || "",
              notes: notes || existing.notes || "",
              subtotal: Number(subtotal) || existing.subtotal || 0,
              discount: Number(discount) !== undefined ? Number(discount) : (existing.discount || 0),
              total: Number(total) || existing.total || 0,
              initial_payment: Number(initial_payment) || existing.initial_payment || 0,
              paid_amount: Number(paid_amount) || existing.paid_amount || 0,
              balance: Number(balance) !== undefined ? Number(balance) : (existing.balance || 0),
              status: status || existing.status || "pendiente",
              wompi_reference: wompi_reference || existing.wompi_reference || "",
              wompi_transaction_id: wompi_transaction_id || existing.wompi_transaction_id || "",
              yeminus_document_id: yeminus_document_id || existing.yeminus_document_id || "",
              yeminus_sync_status: yeminus_sync_status || existing.yeminus_sync_status || "PENDING",
              yeminus_last_error: yeminus_last_error !== undefined ? yeminus_last_error : (existing.yeminus_last_error || ""),
              created_at: existing.created_at || created_at || new Date().toISOString(),
              updated_at: updated_at || new Date().toISOString()
            };
            dbInstance.saveToDisk();
            return { changes: 1 };
          }

          // 2. INSERT INTO order_items ...
          if (s.startsWith("INSERT INTO order_items")) {
            const [
              id, order_id, product_id, product_reference, product_name,
              quantity, unit_price, discount_percentage, discount_amount,
              subtotal, tax, total, warehouse_origin, warehouse_destination
            ] = args;

            dbInstance.data.order_items[id] = {
              id: String(id),
              order_id: String(order_id),
              product_id: String(product_id || ""),
              product_reference: String(product_reference || ""),
              product_name: String(product_name || "Producto Navideño"),
              quantity: Number(quantity) || 1,
              unit_price: Number(unit_price) || 0,
              discount_percentage: Number(discount_percentage) || 0,
              discount_amount: Number(discount_amount) || 0,
              subtotal: Number(subtotal) || 0,
              tax: Number(tax) || 0,
              total: Number(total) || 0,
              warehouse_origin: warehouse_origin || "05",
              warehouse_destination: warehouse_destination || "07"
            };
            dbInstance.saveToDisk();
            return { changes: 1 };
          }

          // 3. INSERT INTO payments ...
          if (s.startsWith("INSERT INTO payments")) {
            const [
              id, order_id, amount, payment_reference, transaction_id,
              payment_method, status, raw_data, created_at
            ] = args;

            const existing = dbInstance.data.payments[id] || {};
            dbInstance.data.payments[id] = {
              ...existing,
              id: String(id),
              order_id: String(order_id),
              amount: Number(amount) || 0,
              payment_reference: payment_reference || "",
              transaction_id: transaction_id || "",
              payment_method: payment_method || "WOMPI",
              status: status || "APPROVED",
              raw_data: raw_data || "",
              created_at: created_at || existing.created_at || new Date().toISOString()
            };
            dbInstance.saveToDisk();
            return { changes: 1 };
          }

          // 4. INSERT INTO pending_checkouts ...
          if (s.startsWith("INSERT INTO pending_checkouts")) {
            const [reference, order_id, amount_in_cents, currency, order_data_json, created_at] = args;
            dbInstance.data.pending_checkouts[reference] = {
              reference: String(reference),
              order_id: String(order_id),
              amount_in_cents: Number(amount_in_cents) || 0,
              currency: currency || "COP",
              order_data_json: String(order_data_json || "{}"),
              created_at: created_at || new Date().toISOString()
            };
            dbInstance.saveToDisk();
            return { changes: 1 };
          }

          // 5. DELETE FROM order_items WHERE order_id = ?
          if (s.includes("DELETE FROM order_items WHERE order_id = ?")) {
            const orderId = String(args[0]);
            let changes = 0;
            for (const [k, v] of Object.entries(dbInstance.data.order_items)) {
              if (v.order_id === orderId) {
                delete dbInstance.data.order_items[k];
                changes++;
              }
            }
            if (changes > 0) dbInstance.saveToDisk();
            return { changes };
          }

          // 6. DELETE FROM payments WHERE order_id = ?
          if (s.includes("DELETE FROM payments WHERE order_id = ?")) {
            const orderId = String(args[0]);
            let changes = 0;
            for (const [k, v] of Object.entries(dbInstance.data.payments)) {
              if (v.order_id === orderId) {
                delete dbInstance.data.payments[k];
                changes++;
              }
            }
            if (changes > 0) dbInstance.saveToDisk();
            return { changes };
          }

          // 7. DELETE FROM orders WHERE id = ?
          if (s.includes("DELETE FROM orders WHERE id = ?")) {
            const id = String(args[0]);
            let changes = 0;
            if (dbInstance.data.orders[id]) {
              delete dbInstance.data.orders[id];
              changes = 1;
              dbInstance.saveToDisk();
            }
            return { changes };
          }

          // 8. UPDATE orders SET yeminus_document_id = ?, yeminus_sync_status = 'SYNCED', yeminus_last_error = '' WHERE wompi_reference = ? OR id = ?
          if (s.includes("UPDATE orders SET yeminus_document_id") && s.includes("WHERE wompi_reference = ? OR id = ?")) {
            const [docId, ref, id] = args;
            let changes = 0;
            for (const ord of Object.values(dbInstance.data.orders)) {
              if (ord.wompi_reference === ref || ord.id === id) {
                ord.yeminus_document_id = docId;
                ord.yeminus_sync_status = "SYNCED";
                ord.yeminus_last_error = "";
                ord.updated_at = new Date().toISOString();
                changes++;
              }
            }
            if (changes > 0) dbInstance.saveToDisk();
            return { changes };
          }

          // 9. UPDATE orders SET yeminus_document_id = ?, yeminus_sync_status = 'SYNCED', yeminus_last_error = '' WHERE id = ?
          if (s.includes("UPDATE orders SET yeminus_document_id = ?, yeminus_sync_status = 'SYNCED'") && s.includes("WHERE id = ?")) {
            const [docId, id] = args;
            const ord = dbInstance.data.orders[id];
            if (ord) {
              ord.yeminus_document_id = docId;
              ord.yeminus_sync_status = "SYNCED";
              ord.yeminus_last_error = "";
              ord.updated_at = new Date().toISOString();
              dbInstance.saveToDisk();
              return { changes: 1 };
            }
            return { changes: 0 };
          }

          // 10. UPDATE orders SET yeminus_sync_status = 'ERP_SYNC_FAILED', yeminus_last_error = ? WHERE id = ?
          if (s.includes("UPDATE orders SET yeminus_sync_status = 'ERP_SYNC_FAILED'") && s.includes("WHERE id = ?")) {
            const [err, id] = args;
            const ord = dbInstance.data.orders[id];
            if (ord) {
              ord.yeminus_sync_status = "ERP_SYNC_FAILED";
              ord.yeminus_last_error = String(err || "");
              ord.updated_at = new Date().toISOString();
              dbInstance.saveToDisk();
              return { changes: 1 };
            }
            return { changes: 0 };
          }

          // 11. UPDATE orders SET paid_amount = ?, balance = ?, status = ? WHERE id = ?
          if (s.includes("UPDATE orders SET paid_amount = ?, balance = ?, status = ? WHERE id = ?")) {
            const [newPaid, rem, newSt, id] = args;
            const ord = dbInstance.data.orders[id];
            if (ord) {
              ord.paid_amount = Number(newPaid) || 0;
              ord.balance = Number(rem) || 0;
              ord.status = String(newSt || "abonando");
              ord.updated_at = new Date().toISOString();
              dbInstance.saveToDisk();
              return { changes: 1 };
            }
            return { changes: 0 };
          }

          // 12. UPDATE orders SET wompi_reference = CASE ... WHERE id = ?
          if (s.includes("UPDATE orders") && s.includes("WHERE id = ?")) {
            const oId = String(args[args.length - 1]);
            const ord = dbInstance.data.orders[oId];
            if (ord) {
              if (s.includes("wompi_reference = CASE")) {
                const [wRef, wTx] = args;
                if (!ord.wompi_reference && wRef) ord.wompi_reference = wRef;
                if (!ord.wompi_transaction_id && wTx) ord.wompi_transaction_id = wTx;
              }
              ord.updated_at = new Date().toISOString();
              dbInstance.saveToDisk();
              return { changes: 1 };
            }
          }

          return { changes: 0 };
        } catch (e: any) {
          console.warn("[FALLBACK DB RUN ERROR]", e.message);
          return { changes: 0 };
        }
      },

      get(...args: any[]) {
        try {
          // SELECT id FROM payments WHERE id = ?
          if (s.includes("SELECT id FROM payments WHERE id = ?") || s.includes("SELECT * FROM payments WHERE id = ?")) {
            const pId = String(args[0]);
            return dbInstance.data.payments[pId] || null;
          }

          // SELECT * FROM orders WHERE id = ? OR id LIKE ?
          if (s.includes("SELECT * FROM orders WHERE id = ?") || s.includes("SELECT * FROM orders WHERE id LIKE ?")) {
            const rawId = String(args[0] || "").replace(/[%_]/g, "").trim();
            if (dbInstance.data.orders[rawId]) return dbInstance.data.orders[rawId];
            for (const ord of Object.values(dbInstance.data.orders)) {
              if (ord.id === rawId || (rawId.length >= 6 && ord.id.startsWith(rawId))) {
                return ord;
              }
            }
            return null;
          }

          // SELECT * FROM orders WHERE wompi_reference = ? OR yeminus_document_id = ?
          if (s.includes("SELECT * FROM orders WHERE wompi_reference = ? OR yeminus_document_id = ?")) {
            const [ref, yDoc] = args.map(a => String(a || "").trim());
            for (const ord of Object.values(dbInstance.data.orders)) {
              if ((ref && ord.wompi_reference === ref) || (yDoc && ord.yeminus_document_id === yDoc)) return ord;
            }
            return null;
          }

          // SELECT * FROM orders WHERE wompi_reference = ? OR wompi_transaction_id = ?
          if (s.includes("SELECT * FROM orders WHERE wompi_reference = ?") || s.includes("wompi_transaction_id")) {
            const [ref1, ref2, id3] = args.map(a => String(a || "").trim());
            for (const ord of Object.values(dbInstance.data.orders)) {
              if ((ref1 && ord.wompi_reference === ref1) || (ref2 && ord.wompi_transaction_id === ref2) || (id3 && ord.id === id3)) {
                return ord;
              }
            }
            // Fallback para referencias de abono WMP-ABONO-[prefix]-...
            for (const ref of [ref1, ref2, id3]) {
              if (ref && ref.startsWith("WMP-ABONO-")) {
                const parts = ref.split("-");
                const prefix = parts[2];
                if (prefix && prefix.length >= 6) {
                  for (const ord of Object.values(dbInstance.data.orders)) {
                    if (ord.id.startsWith(prefix) || ord.id === prefix) return ord;
                  }
                }
              }
            }
            return null;
          }

          // SELECT * FROM pending_checkouts WHERE reference = ?
          if (s.includes("SELECT * FROM pending_checkouts WHERE reference = ?")) {
            const ref = String(args[0]);
            return dbInstance.data.pending_checkouts[ref] || null;
          }

          return null;
        } catch (e: any) {
          console.warn("[FALLBACK DB GET ERROR]", e.message);
          return null;
        }
      },

      all(...args: any[]) {
        try {
          // SELECT * FROM payments WHERE order_id = ? AND status = 'approved'
          if (s.includes("SELECT * FROM payments WHERE order_id = ? AND status = 'approved'")) {
            const orderId = String(args[0]);
            return Object.values(dbInstance.data.payments)
              .filter((p: any) => p.order_id === orderId && String(p.status || "").toLowerCase() === "approved")
              .sort((a: any, b: any) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
          }

          // SELECT payment_reference, raw_data, order_id FROM payments WHERE raw_data != ''
          if (s.includes("SELECT") && s.includes("FROM payments") && s.includes("raw_data")) {
            return Object.values(dbInstance.data.payments).filter((p: any) => p.raw_data && p.raw_data !== "");
          }

          // SELECT * FROM orders WHERE customer_document ...
          if (s.includes("SELECT") && s.includes("FROM orders") && s.includes("WHERE")) {
            const rawDoc = String(args[0] || "").trim();
            const cleanDoc = rawDoc.replace(/\D/g, "");
            const searchRaw = rawDoc.toLowerCase();

            return Object.values(dbInstance.data.orders).filter((ord: any) => {
              const doc = String(ord.customer_document || "").replace(/\D/g, "");
              const phone = String(ord.customer_phone || "").replace(/\D/g, "");
              const email = String(ord.customer_email || "").toLowerCase().trim();
              const id = String(ord.id || "").toLowerCase().trim();
              const ref = String(ord.wompi_reference || "").toLowerCase().trim();

              if (cleanDoc && cleanDoc.length >= 4) {
                if (doc === cleanDoc || doc === searchRaw) return true;
                if (cleanDoc.length >= 6 && phone.includes(cleanDoc)) return true;
              }
              if (searchRaw.includes("@") && email === searchRaw) return true;
              if (id === searchRaw || ref === searchRaw) return true;
              if (searchRaw.length >= 8 && id.startsWith(searchRaw)) return true;
              return false;
            }).sort((a: any, b: any) =>
              String(b.created_at || "").localeCompare(String(a.created_at || ""))
            );
          }

          // SELECT * FROM orders / SELECT id, customer_name, customer_document, customer_phone FROM orders
          if (s.includes("SELECT") && s.includes("FROM orders")) {
            return Object.values(dbInstance.data.orders).sort((a: any, b: any) =>
              String(b.created_at || "").localeCompare(String(a.created_at || ""))
            );
          }

          // SELECT * FROM order_items WHERE order_id = ?
          if (s.includes("SELECT * FROM order_items WHERE order_id = ?")) {
            const orderId = String(args[0]);
            return Object.values(dbInstance.data.order_items).filter((it: any) => it.order_id === orderId);
          }

          // SELECT * FROM payments WHERE order_id = ? OR order_id LIKE ? OR payment_reference LIKE ?
          if (s.includes("SELECT * FROM payments WHERE order_id = ?") || s.includes("SELECT * FROM payments WHERE order_id LIKE")) {
            const rawOrderId = String(args[0] || "").replace(/[%_]/g, "").trim();
            return Object.values(dbInstance.data.payments)
              .filter((p: any) => {
                if (p.order_id === rawOrderId) return true;
                if (rawOrderId.length >= 6 && p.order_id.startsWith(rawOrderId)) return true;
                if (p.payment_reference && rawOrderId.length >= 6 && p.payment_reference.includes(rawOrderId)) return true;
                return false;
              })
              .sort((a: any, b: any) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
          }

          // SELECT * FROM payments ORDER BY created_at DESC / SELECT * FROM payments
          if (s.includes("SELECT") && s.includes("FROM payments")) {
            return Object.values(dbInstance.data.payments).sort((a: any, b: any) =>
              String(b.created_at || "").localeCompare(String(a.created_at || ""))
            );
          }

          return [];
        } catch (e: any) {
          console.warn("[FALLBACK DB ALL ERROR]", e.message);
          return [];
        }
      }
    };
  }
}

// Motor 100% JavaScript puro: Cero dependencias nativas C++ (sin better-sqlite3 ni node-gyp).
// Garantiza 100% de compatibilidad en cPanel, hosting compartido y entornos Cloud.
function createDatabaseInstance(): any {
  console.log("[DATABASE] Motor de datos en JavaScript puro activado (100% compatible con cPanel y Cloud).");
  return new FallbackDatabase();
}

export const db = createDatabaseInstance();

export interface OrderRecord {
  id: string;
  customer_document: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: string;
  shipping_city: string;
  notes?: string;
  observaciones?: string;
  subtotal: number;
  discount: number;
  total: number;
  initial_payment: number;
  paid_amount: number;
  balance: number;
  status: string;
  wompi_reference: string;
  wompi_transaction_id: string;
  yeminus_document_id: string;
  yeminus_sync_status: string;
  yeminus_last_error: string;
  created_at: string;
  updated_at: string;
  items?: OrderItemRecord[];
  payments?: PaymentRecord[];
}

export interface OrderItemRecord {
  id: string;
  order_id: string;
  product_id: string;
  product_reference?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_percentage?: number;
  discount_amount?: number;
  subtotal: number;
  tax: number;
  total: number;
  warehouse_origin?: string;
  warehouse_destination?: string;
}

export interface PaymentRecord {
  id: string;
  order_id: string;
  amount: number;
  payment_reference: string;
  transaction_id: string;
  payment_method: string;
  status: string;
  raw_data?: string;
  created_at: string;
}

/**
 * Creates or updates an order in SQLite
 */
/**
 * Busca un producto en el catálogo oficial de Yeminus de respaldo.
 * Garantiza códigos numéricos y referencias reales, eliminando 'ONLINE'.
 */
export function findInCatalog(sku?: string, name?: string, amount?: number): any | null {
  try {
    const bPath = path.join(process.cwd(), "products_backup.json");
    if (!fs.existsSync(bPath)) return null;
    const pBackup = JSON.parse(fs.readFileSync(bPath, "utf8")).products || [];

    if (sku && sku !== "ONLINE") {
      const s = String(sku).trim().toLowerCase();
      const byId = pBackup.find((pr: any) => 
        String(pr.id).toLowerCase() === s || 
        String(pr.code).toLowerCase() === s || 
        (pr.reference && String(pr.reference).toLowerCase() === s)
      );
      if (byId) return byId;
    }
    if (name) {
      const cleanName = name
        .replace(/^(\d+x\s+)+/, "")
        .replace(/\s*\(Plan Separe.*?\)/, "")
        .replace(/\s*\[Ref:\s*[^\]]+\]/g, "")
        .replace(/\s*\[Doc:\s*[^\]]+\]/g, "")
        .replace(/\s*\[Dir:\s*[^\]]+\]/g, "")
        .replace(/\s*\[Ciudad:\s*[^\]]+\]/g, "")
        .replace(/\[[^\]]*\]/g, "")
        .trim()
        .toLowerCase();

      const byName = pBackup.find((pr: any) => pr.name.toLowerCase() === cleanName);
      if (byName) return byName;

      const bySub = pBackup.find((pr: any) => cleanName.includes(pr.name.toLowerCase()) || pr.name.toLowerCase().includes(cleanName));
      if (bySub) return bySub;

      const tokens = cleanName.split(/\s+/).filter((w: string) => w.length > 2);
      if (tokens.length >= 2) {
        const scored = pBackup.map((pr: any) => {
          const pTokens = pr.name.toLowerCase().split(/\s+/);
          const matches = tokens.filter((t: string) => pTokens.includes(t)).length;
          return { pr, score: matches };
        }).sort((a: any, b: any) => b.score - a.score);
        if (scored[0] && scored[0].score >= 2) {
          return scored[0].pr;
        }
      }
    }
    if (amount && amount > 0) {
      const exact = pBackup.find((pr: any) => pr.price === amount || pr.discountPrice === amount);
      if (exact) return exact;
      const d10 = pBackup.find((pr: any) => Math.round((pr.discountPrice || pr.price) * 0.9) === amount || Math.round(pr.price * 0.9) === amount);
      if (d10) return d10;
      const s30 = pBackup.find((pr: any) => Math.round((pr.discountPrice || pr.price) * 0.3) === amount || Math.round((pr.discountPrice || pr.price) * 0.9 * 0.3) === amount);
      if (s30) return s30;
    }
  } catch {}
  return null;
}

export function saveOrderWithItems(
  order: Omit<OrderRecord, "created_at" | "updated_at"> & { created_at?: string; updated_at?: string },
  items: Array<Omit<OrderItemRecord, "order_id" | "id"> & { id?: string; price?: number }>
): OrderRecord {
  const now = new Date().toISOString();
  const createdAt = order.created_at || now;
  const updatedAt = now;

  const insertOrder = db.prepare(`
    INSERT INTO orders (
      id, customer_document, customer_name, customer_email, customer_phone,
      shipping_address, shipping_city, notes, subtotal, discount, total,
      initial_payment, paid_amount, balance, status, wompi_reference,
      wompi_transaction_id, yeminus_document_id, yeminus_sync_status,
      yeminus_last_error, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      customer_document = CASE 
        WHEN trim(coalesce(excluded.customer_document, '')) != '' AND excluded.customer_document != '222222222' THEN trim(excluded.customer_document)
        WHEN trim(coalesce(orders.customer_document, '')) != '' AND orders.customer_document != '222222222' THEN orders.customer_document
        ELSE trim(coalesce(excluded.customer_document, ''))
      END,
      customer_name = CASE 
        WHEN trim(coalesce(excluded.customer_name, '')) != '' AND excluded.customer_name != 'Cliente Impormax' THEN trim(excluded.customer_name)
        WHEN trim(coalesce(orders.customer_name, '')) != '' AND orders.customer_name != 'Cliente Impormax' THEN orders.customer_name
        ELSE trim(coalesce(excluded.customer_name, 'Cliente Impormax'))
      END,
      customer_email = CASE 
        WHEN trim(coalesce(excluded.customer_email, '')) != '' THEN trim(excluded.customer_email)
        ELSE orders.customer_email 
      END,
      customer_phone = CASE 
        WHEN trim(coalesce(excluded.customer_phone, '')) != '' AND excluded.customer_phone != '3000000000' THEN trim(excluded.customer_phone)
        WHEN trim(coalesce(orders.customer_phone, '')) != '' AND orders.customer_phone != '3000000000' THEN orders.customer_phone
        ELSE trim(coalesce(excluded.customer_phone, ''))
      END,
      shipping_address = CASE 
        WHEN trim(coalesce(excluded.shipping_address, '')) != '' AND excluded.shipping_address NOT IN ('Entrega a domicilio / Retiro en tienda', 'Entrega a domicilio', 'Dirección de Entrega Registrada') THEN trim(excluded.shipping_address)
        WHEN trim(coalesce(orders.shipping_address, '')) != '' AND orders.shipping_address NOT IN ('Entrega a domicilio / Retiro en tienda', 'Entrega a domicilio', 'Dirección de Entrega Registrada') THEN orders.shipping_address
        WHEN trim(coalesce(excluded.shipping_address, '')) != '' THEN trim(excluded.shipping_address)
        ELSE orders.shipping_address
      END,
      shipping_city = CASE 
        WHEN trim(coalesce(excluded.shipping_city, '')) != '' THEN trim(excluded.shipping_city)
        ELSE orders.shipping_city 
      END,
      notes = CASE
        WHEN trim(coalesce(excluded.notes, '')) != '' THEN trim(excluded.notes)
        ELSE orders.notes
      END,
      subtotal = CASE WHEN excluded.subtotal > 0 THEN excluded.subtotal ELSE orders.subtotal END,
      discount = excluded.discount,
      total = CASE WHEN excluded.total > 0 THEN excluded.total ELSE orders.total END,
      initial_payment = CASE WHEN excluded.initial_payment > 0 THEN excluded.initial_payment ELSE orders.initial_payment END,
      paid_amount = CASE WHEN excluded.paid_amount > 0 THEN excluded.paid_amount ELSE orders.paid_amount END,
      balance = excluded.balance,
      status = CASE WHEN excluded.status != 'pendiente' THEN excluded.status ELSE orders.status END,
      wompi_reference = CASE WHEN excluded.wompi_reference != '' THEN excluded.wompi_reference ELSE orders.wompi_reference END,
      wompi_transaction_id = CASE WHEN excluded.wompi_transaction_id != '' THEN excluded.wompi_transaction_id ELSE orders.wompi_transaction_id END,
      yeminus_document_id = CASE WHEN excluded.yeminus_document_id != '' THEN excluded.yeminus_document_id ELSE orders.yeminus_document_id END,
      yeminus_sync_status = CASE WHEN excluded.yeminus_sync_status != 'PENDING' THEN excluded.yeminus_sync_status ELSE orders.yeminus_sync_status END,
      yeminus_last_error = excluded.yeminus_last_error,
      updated_at = excluded.updated_at
  `);

  insertOrder.run(
    order.id,
    order.customer_document || "",
    order.customer_name || "Cliente Impormax",
    order.customer_email || "",
    order.customer_phone || "",
    order.shipping_address || "",
    order.shipping_city || "",
    order.notes || order.observaciones || "",
    Number(order.subtotal) || 0,
    Number(order.discount) || 0,
    Number(order.total) || 0,
    Number(order.initial_payment) || 0,
    Number(order.paid_amount) || 0,
    Number(order.balance) || 0,
    order.status || "pendiente",
    order.wompi_reference || "",
    order.wompi_transaction_id || "",
    order.yeminus_document_id || "",
    order.yeminus_sync_status || "PENDING",
    order.yeminus_last_error || "",
    createdAt,
    updatedAt
  );

  // If items provided, replace items for this order with guaranteed Yeminus codes (NEVER 'ONLINE')
  if (items && items.length > 0) {
    db.prepare(`DELETE FROM order_items WHERE order_id = ?`).run(order.id);
    const insertItem = db.prepare(`
      INSERT INTO order_items (
        id, order_id, product_id, product_reference, product_name,
        quantity, unit_price, discount_percentage, discount_amount,
        subtotal, tax, total, warehouse_origin, warehouse_destination
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const it of items) {
      const itemId = it.id || crypto.randomUUID();
      const qty = Math.max(1, Number(it.quantity) || 1);
      const rawPid = String(it.product_id || "").trim();
      const rawRef = String(it.product_reference || "").trim();
      const rawName = String(it.product_name || "").trim();

      const cat = findInCatalog(rawPid, rawName, Number(it.total || it.unit_price));
      const pId = (rawPid && rawPid !== "ONLINE") ? rawPid : (cat ? cat.id : (rawRef && rawRef !== "ONLINE" ? rawRef : "8010141"));
      const pRef = (rawRef && rawRef !== "ONLINE") ? rawRef : (cat ? (cat.reference || cat.id) : pId);
      const pName = (rawName && rawName !== "Producto Navideño" && rawName !== "ONLINE") ? rawName : (cat ? cat.name : "Producto Navideño");
      const unitPrice = Number(it.unit_price ?? (it as any).price) || (cat ? Number(cat.discountPrice || cat.price) : 0);
      const subtotal = Number(it.subtotal) || (unitPrice * qty);
      const tax = Number(it.tax) || Math.round(subtotal - (subtotal / 1.19));
      const total = Number(it.total) || subtotal;

      insertItem.run(
        itemId,
        order.id,
        pId,
        pRef,
        pName,
        qty,
        unitPrice,
        Number(it.discount_percentage) || (cat ? Number(cat.discountPercentage || 0) : 0),
        Number(it.discount_amount) || 0,
        subtotal,
        tax,
        total,
        it.warehouse_origin || "05",
        it.warehouse_destination || "07"
      );
    }
  }

  return getOrderById(order.id)!;
}

export function getOrderById(id: string): OrderRecord | null {
  if (!id) return null;
  const clean = String(id).trim();
  let row = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(clean) as any;
  if (!row) {
    row = db.prepare(`SELECT * FROM orders WHERE wompi_reference = ? OR yeminus_document_id = ?`).get(clean, clean) as any;
  }
  if (!row) return null;
  return hydrateOrder(row);
}

export function getOrderByWompiRef(ref: string): OrderRecord | null {
  if (!ref) return null;
  const clean = String(ref).trim();
  let row = db.prepare(`SELECT * FROM orders WHERE wompi_reference = ? OR wompi_transaction_id = ? OR id = ?`).get(clean, clean, clean) as any;
  if (!row && clean.startsWith("WMP-ABONO-")) {
    const parts = clean.split("-");
    const targetId = parts.slice(2).join("-");
    if (targetId) {
      row = db.prepare(`SELECT * FROM orders WHERE id = ? OR wompi_reference = ?`).get(targetId, targetId) as any;
    }
  }
  if (!row) return null;
  return hydrateOrder(row);
}

export function getAllOrders(): OrderRecord[] {
  const rows = db.prepare(`SELECT * FROM orders ORDER BY created_at DESC`).all() as any[];
  return rows.map(r => hydrateOrder(r));
}

export function deleteOrder(id: string): boolean {
  try {
    db.prepare(`DELETE FROM payments WHERE order_id = ?`).run(id);
    db.prepare(`DELETE FROM order_items WHERE order_id = ?`).run(id);
    const info = db.prepare(`DELETE FROM orders WHERE id = ?`).run(id);
    return info.changes > 0;
  } catch (e) {
    console.error("Error deleting order from SQLite:", e);
    return false;
  }
}

function hydrateOrder(row: any): OrderRecord {
  const items = db.prepare(`SELECT * FROM order_items WHERE order_id = ?`).all(row.id) as any[];
  const payments = db.prepare(`SELECT * FROM payments WHERE order_id = ? ORDER BY created_at ASC`).all(row.id) as any[];
  return {
    ...row,
    items,
    payments
  };
}

export function savePayment(payment: PaymentRecord): void {
  let effectiveOrderId = payment.order_id;
  const ord = getOrderById(effectiveOrderId);
  if (ord) {
    effectiveOrderId = ord.id;
  }
  db.prepare(`
    INSERT INTO payments (
      id, order_id, amount, payment_reference, transaction_id, payment_method, status, raw_data, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      order_id = excluded.order_id,
      amount = excluded.amount,
      payment_reference = excluded.payment_reference,
      status = excluded.status,
      raw_data = excluded.raw_data
  `).run(
    payment.id,
    effectiveOrderId,
    payment.amount,
    payment.payment_reference,
    payment.transaction_id,
    payment.payment_method,
    payment.status,
    payment.raw_data || "",
    payment.created_at || new Date().toISOString()
  );
}

export function savePendingCheckout(
  reference: string,
  orderId: string,
  amountInCents: number,
  currency: string,
  orderData: any
): void {
  db.prepare(`
    INSERT INTO pending_checkouts (
      reference, order_id, amount_in_cents, currency, order_data_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(reference) DO UPDATE SET
      order_id = excluded.order_id,
      amount_in_cents = excluded.amount_in_cents,
      order_data_json = excluded.order_data_json,
      created_at = excluded.created_at
  `).run(
    reference,
    orderId,
    amountInCents,
    currency,
    JSON.stringify(orderData),
    new Date().toISOString()
  );
}

export function getPendingCheckout(reference: string): any | null {
  const row = db.prepare(`SELECT * FROM pending_checkouts WHERE reference = ?`).get(reference) as any;
  if (!row) return null;
  try {
    return {
      reference: row.reference,
      orderId: row.order_id,
      amountInCents: row.amount_in_cents,
      currency: row.currency,
      orderData: JSON.parse(row.order_data_json),
      createdAt: row.created_at
    };
  } catch {
    return null;
  }
}

/**
 * Recovers, migrates and normalizes legacy orders from Supabase (e.g. Federico Tangarife, etc.)
 * Strips metadata tags like [Ref: SLP-...] from product names, extracts clean Yeminus doc IDs,
 * preserves all payment records, and ensures order_items are structured.
 */
export async function syncAndRecoverFromSupabase(supabaseClient: any): Promise<number> {
  if (!supabaseClient) return 0;
  try {
    const { data: pedidos, error } = await supabaseClient.from("pedidos").select("*");
    if (error || !pedidos) return 0;

    let pBackup: any[] = [];
    try {
      const fs = require("fs");
      const path = require("path");
      const bPath = path.join(process.cwd(), "products_backup.json");
      if (fs.existsSync(bPath)) {
        pBackup = JSON.parse(fs.readFileSync(bPath, "utf8")).products || [];
      }
    } catch {}

    const findInCatalog = (sku?: string, name?: string) => {
      if (sku && sku !== "ONLINE") {
        const s = String(sku).trim().toLowerCase();
        const byId = pBackup.find((pr: any) => 
          String(pr.id).toLowerCase() === s || 
          String(pr.code).toLowerCase() === s || 
          (pr.reference && String(pr.reference).toLowerCase() === s)
        );
        if (byId) return byId;
      }
      if (name) {
        const cleanName = name
          .replace(/^(\d+x\s+)+/, "")
          .replace(/\s*\(Plan Separe.*?\)/i, "")
          .replace(/\s*\[Ref:\s*[^\]]+\]/gi, "")
          .replace(/\s*\[Doc:\s*[^\]]+\]/gi, "")
          .replace(/\s*\[Dir:\s*[^\]]+\]/gi, "")
          .replace(/\s*\[Ciudad:\s*[^\]]+\]/gi, "")
          .replace(/\[[^\]]*\]/g, "")
          .trim()
          .toLowerCase();

        const byName = pBackup.find((pr: any) => pr.name.toLowerCase() === cleanName);
        if (byName) return byName;

        const bySub = pBackup.find((pr: any) => cleanName.includes(pr.name.toLowerCase()) || pr.name.toLowerCase().includes(cleanName));
        if (bySub) return bySub;

        const tokens = cleanName.split(/\s+/).filter(w => w.length > 2);
        if (tokens.length >= 2) {
          const scored = pBackup.map(pr => {
            const pTokens = pr.name.toLowerCase().split(/\s+/);
            const matches = tokens.filter(t => pTokens.includes(t)).length;
            return { pr, score: matches };
          }).sort((a, b) => b.score - a.score);
          if (scored[0] && scored[0].score >= 2) {
            return scored[0].pr;
          }
        }
      }
      return null;
    };

    let importedCount = 0;
    for (const p of pedidos) {
      const existing = getOrderById(p.id);
      
      // Extract metadata if embedded in producto_name
      const refMatch = p.producto_name?.match(/Ref:\s*([^\|\]]+)/);
      let yeminusDocId = existing?.yeminus_document_id || "";
      if (!yeminusDocId && refMatch) {
        yeminusDocId = refMatch[1].trim().replace(/^SLP-SLP-/, "SLP-");
      }

      const docMatch = p.producto_name?.match(/Doc:\s*([^\|\]]+)/);
      const customerDocFromMeta = docMatch ? docMatch[1].trim() : "";

      const dirMatch = p.producto_name?.match(/Dir:\s*([^\|\]]+)/);
      const shippingAddressFromMeta = dirMatch ? dirMatch[1].trim() : "";

      const cityMatch = p.producto_name?.match(/Ciudad:\s*([^\|\]]+)/);
      const shippingCityFromMeta = cityMatch ? cityMatch[1].trim() : "";

      const obsMatch = p.producto_name?.match(/Obs:\s*([^\|\]]+)/);
      const notesFromMeta = obsMatch ? obsMatch[1].trim() : "";

      // Clean product name
      const cleanProductName = (p.producto_name || "Producto Navideño")
        .replace(/\[[^\]]*\]/g, "")
        .trim();

      const rawTotal = Number(p.total) || 0;
      const abonado = Number(p.abonado) || 0;

      const isTotalCorrupted = existing && rawTotal > 0 && Math.abs(existing.total - rawTotal) > 10;
      const hasWrongTree = existing?.items?.some(it => it.product_id === "8010141" && !cleanProductName.toLowerCase().includes("cancun"));
      const hasInvalidItems = !existing?.items || existing.items.length === 0 || existing.items.some(it => !it.product_id || it.product_id === "ONLINE" || it.product_reference === "ONLINE") || hasWrongTree;
      const isAbonoCorrupted = existing && existing.paid_amount !== abonado && abonado > 0;

      // If order not yet in SQLite, or needs updating
      if (!existing || hasInvalidItems || isTotalCorrupted || isAbonoCorrupted || p.id === "e5b3dccf-de4c-4a59-8f52-89f904c5dfcd") {
        // Derive items from product name if no items existed yet
        const parsedItems: any[] = [];
        let calcSubtotal = 0;
        let calcDiscount = 0;
        let calcTotal = 0;

        // Special recovery for Federico's order (Luces y Flores Navideñas)
        if (p.id === "e5b3dccf-de4c-4a59-8f52-89f904c5dfcd" || (p.cliente_nombre && p.cliente_nombre.toLowerCase().includes("federico tangarife"))) {
          parsedItems.push({
            product_id: "401563",
            product_reference: "LX-N0144",
            product_name: "Instalación Lineal Led Carrete x 100mts de 1000L - Luz Cálida",
            quantity: 2,
            unit_price: 260000,
            price: 260000,
            subtotal: 520000,
            tax: Math.round(520000 - (520000 / 1.19)),
            total: 520000,
            warehouse_origin: "05",
            warehouse_destination: "07"
          });
          parsedItems.push({
            product_id: "8040211",
            product_reference: "DTI00383R",
            product_name: "Flor Navidad 28cm 5 Pétalos Rojo Terciopelo Escarchado",
            quantity: 4,
            unit_price: 58118,
            price: 58118,
            subtotal: 232472,
            tax: Math.round(232472 - (232472 / 1.19)),
            total: 232472,
            warehouse_origin: "05",
            warehouse_destination: "07"
          });
          calcTotal = 752472;
          calcSubtotal = 752472;
        } else {
          const rawItems = cleanProductName.split(/,\s*(?=\d+x\s+)/).map((s: string) => s.trim()).filter(Boolean);
          const rawSkus = (p.producto_id || "").split(",").map((s: string) => s.trim()).filter(Boolean);

          const itemsToProcess = rawItems.length > 0 ? rawItems : [cleanProductName];

          itemsToProcess.forEach((itemStr: string, idx: number) => {
            const m = itemStr.match(/^(\d+)x\s+(.+)$/);
            const qty = m ? parseInt(m[1]) : 1;
            const name = m ? m[2].trim() : itemStr.trim();
            const rawSku = (rawSkus[idx] && rawSkus[idx] !== "ONLINE") ? rawSkus[idx] : (rawSkus[0] && rawSkus[0] !== "ONLINE" ? rawSkus[0] : (p.producto_id && p.producto_id !== "ONLINE" ? p.producto_id : ""));
            const foundP = findInCatalog(rawSku, name);

            if (foundP) {
              const activePrice = Number(foundP.discountPrice || foundP.price);
              const listPrice = Number(foundP.price);
              const itemTot = activePrice * qty;
              const itemSub = listPrice * qty;
              const itemDisc = Math.max(0, (listPrice - activePrice) * qty);

              calcTotal += itemTot;
              calcSubtotal += itemSub;
              calcDiscount += itemDisc;

              parsedItems.push({
                product_id: foundP.id,
                product_reference: foundP.reference || foundP.id,
                product_name: foundP.name,
                quantity: qty,
                unit_price: activePrice,
                price: activePrice,
                discount_percentage: Number(foundP.discountPercentage) || 0,
                discount_amount: itemDisc,
                subtotal: itemSub,
                tax: Math.round(itemTot - (itemTot / 1.19)),
                total: itemTot,
                warehouse_origin: "05",
                warehouse_destination: "07"
              });
            } else {
              const uPrice = Math.round((rawTotal || 50000) / (itemsToProcess.length * qty));
              const itemTot = uPrice * qty;
              calcTotal += itemTot;
              calcSubtotal += itemTot;

              const cleanItemSku = (rawSku && rawSku !== "ONLINE") ? rawSku : `PROD-${idx + 1}`;
              parsedItems.push({
                product_id: cleanItemSku,
                product_reference: cleanItemSku,
                product_name: name,
                quantity: qty,
                unit_price: uPrice,
                price: uPrice,
                discount_percentage: 0,
                discount_amount: 0,
                subtotal: itemTot,
                tax: Math.round(itemTot - (itemTot / 1.19)),
                total: itemTot,
                warehouse_origin: "05",
                warehouse_destination: "07"
              });
            }
          });
        }

        const effectiveTotal = rawTotal > 0 ? rawTotal : (calcTotal > 0 ? calcTotal : 0);
        const effectiveSubtotal = calcSubtotal > 0 ? calcSubtotal : effectiveTotal;
        const effectiveDiscount = calcDiscount > 0 ? calcDiscount : Math.max(0, effectiveSubtotal - effectiveTotal);
        const effectiveStatus = (effectiveTotal > 0 && abonado >= (effectiveTotal - 10)) || Number(p.restante) <= 0
          ? "pagado"
          : (abonado > 0 ? "abonando" : (p.estado || "pendiente"));
        const restante = effectiveStatus === "pagado" ? 0 : (p.restante !== undefined && p.restante !== null && !isNaN(Number(p.restante)) ? Number(p.restante) : Math.max(0, effectiveTotal - abonado));

        const effectiveDoc = (existing?.customer_document && existing.customer_document !== '222222222' && existing.customer_document !== '')
          ? existing.customer_document
          : (customerDocFromMeta || p.cliente_documento || p.customer_document || "");
        const isGenericAddr = !existing?.shipping_address || [
          'Entrega a domicilio / Retiro en tienda',
          'Entrega a domicilio',
          'Dirección de Entrega Registrada'
        ].includes(existing.shipping_address);
        const effectiveAddress = (!isGenericAddr && existing?.shipping_address)
          ? existing.shipping_address
          : (shippingAddressFromMeta || p.direccion_envio || p.shipping_address || existing?.shipping_address || "");
        const effectiveCity = (existing?.shipping_city && existing.shipping_city !== 'Pereira' && existing.shipping_city !== '')
          ? existing.shipping_city
          : (shippingCityFromMeta || p.ciudad_envio || p.shipping_city || (existing?.shipping_city !== 'Pereira' ? existing?.shipping_city : '') || "");
        const effectiveNotes = (p.observaciones || p.notes || notesFromMeta || existing?.notes || "").trim();

        saveOrderWithItems({
          id: p.id,
          customer_document: effectiveDoc,
          customer_name: p.cliente_nombre || "Cliente Impormax",
          customer_email: p.cliente_email || "",
          customer_phone: p.cliente_telefono || "",
          shipping_address: effectiveAddress,
          shipping_city: effectiveCity,
          notes: effectiveNotes,
          subtotal: effectiveSubtotal,
          discount: effectiveDiscount,
          total: effectiveTotal,
          initial_payment: abonado,
          paid_amount: abonado,
          balance: restante,
          status: effectiveStatus,
          wompi_reference: existing?.wompi_reference || "",
          wompi_transaction_id: existing?.wompi_transaction_id || "",
          yeminus_document_id: yeminusDocId,
          yeminus_sync_status: yeminusDocId ? "SYNCED" : "PENDING",
          yeminus_last_error: "",
          created_at: p.created_at || new Date().toISOString()
        }, parsedItems);
        importedCount++;
      } else if (!existing.yeminus_document_id && yeminusDocId) {
        db.prepare(`UPDATE orders SET yeminus_document_id = ?, yeminus_sync_status = 'SYNCED' WHERE id = ?`).run(yeminusDocId, p.id);
      }
    }

    // Also import pagos from Supabase
    const { data: pagos } = await supabaseClient.from("pagos").select("*");
    if (pagos) {
      for (const pay of pagos) {
        const pRef = pay.referencia_pago || "";
        const row = db.prepare(`SELECT id FROM payments WHERE id = ?`).get(pay.id);
        if (!row) {
          savePayment({
            id: pay.id,
            order_id: pay.pedido_id || "",
            amount: Number(pay.monto) || 0,
            payment_reference: pRef,
            transaction_id: pay.id,
            payment_method: pay.metodo_pago || "WOMPI",
            status: pay.estado_pago || "approved",
            created_at: pay.created_at || new Date().toISOString()
          });

          // If the order exists, link the wompi_reference
          if (pRef && pay.pedido_id) {
            db.prepare(`
              UPDATE orders 
              SET wompi_reference = CASE WHEN wompi_reference = '' THEN ? ELSE wompi_reference END,
                  wompi_transaction_id = CASE WHEN wompi_transaction_id = '' THEN ? ELSE wompi_transaction_id END
              WHERE id = ?
            `).run(pRef, pay.id, pay.pedido_id);
          }
        }
      }
    }

    return importedCount;
  } catch (err: any) {
    console.warn("[RECOVER FROM SUPABASE WARN]", err.message);
    return 0;
  }
}

/**
 * Audits all orders in SQLite and guarantees that for every order:
 * 1. If 1 item: item.quantity >= 1, item.unit_price = Math.round(order.total / item.quantity), item.total = order.total.
 * 2. If multi-items: distributes order.total proportionally based on catalog/existing price weights,
 *    ensuring that sum(item.total) === order.total exactly!
 */
export function auditAndFixAllOrderItemPrices(): number {
  try {
    let pBackup: any[] = [];
    try {
      const fs = require("fs");
      const path = require("path");
      const bPath = path.join(process.cwd(), "products_backup.json");
      if (fs.existsSync(bPath)) {
        pBackup = JSON.parse(fs.readFileSync(bPath, "utf8")).products || [];
      }
    } catch {}

    const orders = getAllOrders();
    let fixed = 0;

    for (const order of orders) {
      const items = order.items || [];
      if (items.length === 0) continue;

      const orderTotal = Number(order.total) || 0;
      if (orderTotal <= 0) continue;

      const currentSum = items.reduce((acc, it) => acc + Number(it.total || (it.unit_price * it.quantity)), 0);
      const needsFix = Math.abs(currentSum - orderTotal) > 2 || items.some(it => it.unit_price <= 0 || it.total <= 0);

      if (!needsFix) continue;

      let newItems: any[] = [];

      if (items.length === 1) {
        const it = items[0];
        const qty = Math.max(1, Number(it.quantity) || 1);
        const unitPrice = Math.round(orderTotal / qty);
        newItems.push({
          ...it,
          quantity: qty,
          unit_price: unitPrice,
          subtotal: orderTotal,
          tax: Math.round(orderTotal - (orderTotal / 1.19)),
          total: orderTotal
        });
      } else {
        const weights = items.map(it => {
          const sku = String(it.product_id || "").trim();
          const foundP = pBackup.find((pr: any) => String(pr.id).trim() === sku || String(pr.code).trim() === sku);
          const basePrice = (it.unit_price > 0 && it.unit_price < orderTotal)
            ? it.unit_price
            : (foundP ? Number(foundP.discountPrice || foundP.price || 50000) : 50000);
          return Math.max(1000, basePrice) * Math.max(1, Number(it.quantity) || 1);
        });

        const totalW = weights.reduce((a: number, b: number) => a + b, 0) || 1;
        let remaining = orderTotal;

        newItems = items.map((it, idx) => {
          const qty = Math.max(1, Number(it.quantity) || 1);
          let itemTot = Math.round(orderTotal * (weights[idx] / totalW));
          if (idx === items.length - 1) {
            itemTot = remaining;
          } else {
            remaining -= itemTot;
          }
          const uPrice = Math.round(itemTot / qty);
          return {
            ...it,
            quantity: qty,
            unit_price: uPrice,
            subtotal: itemTot,
            tax: Math.round(itemTot - (itemTot / 1.19)),
            total: itemTot
          };
        });
      }

      // Re-save items in order_items table
      db.prepare(`DELETE FROM order_items WHERE order_id = ?`).run(order.id);
      const insertItem = db.prepare(`
        INSERT INTO order_items (
          id, order_id, product_id, product_reference, product_name,
          quantity, unit_price, discount_percentage, discount_amount,
          subtotal, tax, total, warehouse_origin, warehouse_destination
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const it of newItems) {
        const cat = findInCatalog(it.product_id, it.product_name, Number(it.total || it.unit_price));
        const pId = (cat ? cat.id : (it.product_id && it.product_id !== "ONLINE" ? it.product_id : (it.product_reference && it.product_reference !== "ONLINE" ? it.product_reference : "8010141"))).trim();
        const pRef = (cat ? (cat.reference || cat.id) : (it.product_reference && it.product_reference !== "ONLINE" ? it.product_reference : pId)).trim();
        const pName = (cat ? cat.name : String(it.product_name || "Producto Navideño")).trim();

        insertItem.run(
          it.id || crypto.randomUUID(),
          order.id,
          pId,
          pRef,
          pName,
          it.quantity,
          it.unit_price,
          Number(it.discount_percentage) || 0,
          Number(it.discount_amount) || 0,
          it.subtotal,
          it.tax,
          it.total,
          it.warehouse_origin || "05",
          it.warehouse_destination || "07"
        );
      }
      fixed++;
    }

    if (fixed > 0) {
      console.log(`[DB AUDIT] Corregidos los precios y totales de artículos en ${fixed} pedidos.`);
    }
    return fixed;
  } catch (err: any) {
    console.warn("[DB AUDIT ERROR]", err.message);
    return 0;
  }
}

/**
 * Enriquece pedidos existentes en la base de datos con documentos, teléfonos y direcciones reales
 * obtenidos de las transacciones oficiales y pasarela Wompi.
 */
export function enrichExistingOrders(): void {
  try {
    const customerUpdates: Record<string, { doc?: string; phone?: string; city?: string; address?: string }> = {
      "Federico Tangarife Martinez": { doc: "1058821087", phone: "3216041090" },
      "Judy Cabarcas": { doc: "40187061", phone: "3112027858" },
      "Diana Milena Rincon Patiño": { doc: "42120333", phone: "3127959861" },
      "Ruth Esther Sanchez Sanchez": { doc: "26863726", phone: "3185355168" },
      "Dora Tabares": { doc: "42881724", phone: "3216149828" },
      "Ana Maria Sanchez": { doc: "30401854", phone: "3176689509" },
      "luisa fernanda ospina lozano": { doc: "1053801786", phone: "3103991228" },
      "Susana mejia martinez": { doc: "1053806279", phone: "3116906567" },
      "KELLY PATRICIA GAÑAN": { doc: "25181177", phone: "3153048861" },
      "Rosana Freyle": { doc: "49769542", phone: "3215322671" },
      "Kelly Naranjo": { doc: "38473054", phone: "3153856521" },
      "Rosemary consuegra": { doc: "49792570", phone: "3157183046" },
      "Rosemary consuegra sanguino": { doc: "49782570", phone: "3157183046" },
      "Sugey Norela Ramos Rodriguez": { doc: "1121825637", phone: "3106699165" },
      "Edna Marcela Vera Diaz": { doc: "27555715", phone: "3153091949" },
      "Yuli Estefania Cruz": { doc: "1088300478", phone: "3234460037" },
      "Jenny Fernanda Rozo Argüello": { doc: "1087996022", phone: "3043529062" },
      "Leidy Johanna Quiceno alvarez": { doc: "1102828770", phone: "3113389662" },
      "Leidy Moreno Becerra": { doc: "55582516", phone: "3178451358" },
      "Luis Alvarez": { doc: "27555715", phone: "3153091949" },
      "Yinna milena peñalosa": { phone: "3025320501" },
      "Christian Hernandez gomez": { phone: "3008242733" },
      "Gabriela jimenez": { phone: "3214985377" },
      "Luz Divina Castañeda Carmona": { phone: "3185566926" },
      "Yeisy Alexandra Carvajal Salas": { phone: "3108660961" }
    };

    const updateStmt = db.prepare(`
      UPDATE orders 
      SET customer_document = CASE WHEN ? != '' THEN ? ELSE customer_document END,
          customer_phone = CASE WHEN ? != '' THEN ? ELSE customer_phone END
      WHERE id = ?
    `);

    // 1. Enriquecer desde diccionario de clientes conocidos
    const all = db.prepare(`SELECT id, customer_name, customer_document, customer_phone FROM orders`).all() as any[];
    for (const o of all) {
      const match = Object.entries(customerUpdates).find(([name]) => 
        o.customer_name.toLowerCase().trim().includes(name.toLowerCase().trim()) ||
        name.toLowerCase().trim().includes(o.customer_name.toLowerCase().trim())
      );
      if (match) {
        const u = match[1];
        const newDoc = (u.doc && (!o.customer_document || o.customer_document === '222222222')) ? u.doc : (o.customer_document || '');
        const newPhone = (u.phone && (!o.customer_phone || o.customer_phone === '3000000000')) ? u.phone : (o.customer_phone || '');
        if (newDoc !== o.customer_document || newPhone !== o.customer_phone) {
          updateStmt.run(newDoc, newDoc, newPhone, newPhone, o.id);
        }
      }
    }

    // 2. Enriquecer automáticamente desde raw_data de payments de Wompi
    const paymentsWithRaw = db.prepare(`SELECT payment_reference, raw_data, order_id FROM payments WHERE raw_data != ''`).all() as any[];
    for (const p of paymentsWithRaw) {
      try {
        const raw = JSON.parse(p.raw_data);
        const doc = raw.billing_data?.legal_id || raw.customer_data?.legal_id || raw.payment_method?.extra?.user_legal_id || raw.payment_method?.extra?.identificationNumber;
        const phone = raw.customer_data?.phone_number || raw.payment_method?.extra?.cellphoneNumber;
        if (doc || phone) {
          const ord = (p.order_id ? getOrderById(p.order_id) : null) || (p.payment_reference ? getOrderByWompiRef(p.payment_reference) : null);
          if (ord) {
            const cleanDoc = (doc && String(doc).trim() !== '222222222') ? String(doc).trim() : ord.customer_document;
            const cleanPhone = (phone && String(phone).trim() !== '3000000000') ? String(phone).replace(/^\+57/, '').trim() : ord.customer_phone;
            if (cleanDoc !== ord.customer_document || cleanPhone !== ord.customer_phone) {
              updateStmt.run(cleanDoc, cleanDoc, cleanPhone, cleanPhone, ord.id);
            }
          }
        }
      } catch {}
    }
  } catch (err: any) {
    console.warn("[ENRICH ORDERS WARN]", err.message);
  }
}

// Ejecutar auditoría y enriquecimiento inicial al inicializar
try {
  auditAndFixAllOrderItemPrices();
  enrichExistingOrders();
} catch {}


