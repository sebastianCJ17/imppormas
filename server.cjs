var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  adminAuthMiddleware: () => adminAuthMiddleware,
  verifyAdminToken: () => verifyAdminToken
});
module.exports = __toCommonJS(server_exports);
var import_ws = __toESM(require("ws"), 1);
var import_express = __toESM(require("express"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_fs2 = __toESM(require("fs"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var import_url = require("url");

// server/db.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var import_module = require("module");
var requireModule = typeof require === "function" ? require : (0, import_module.createRequire)(typeof __filename !== "undefined" ? __filename : process.cwd());
var DATA_DIR = import_path.default.join(process.cwd(), "data");
if (!import_fs.default.existsSync(DATA_DIR)) {
  import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
}
var DB_PATH = import_path.default.join(DATA_DIR, "impormax_orders.db");
var JSON_BACKUP_PATH = import_path.default.join(DATA_DIR, "impormax_orders_backup.json");
var FallbackDatabase = class {
  constructor() {
    this.data = {
      orders: {},
      order_items: {},
      payments: {},
      pending_checkouts: {}
    };
    this.loadFromDisk();
  }
  loadFromDisk() {
    try {
      if (import_fs.default.existsSync(JSON_BACKUP_PATH)) {
        const raw = import_fs.default.readFileSync(JSON_BACKUP_PATH, "utf8");
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
    } catch (e) {
      console.warn("[FALLBACK DB] Error cargando desde disco:", e.message);
    }
  }
  saveToDisk() {
    try {
      const tempPath = `${JSON_BACKUP_PATH}.${Date.now()}.tmp`;
      import_fs.default.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), "utf8");
      import_fs.default.renameSync(tempPath, JSON_BACKUP_PATH);
    } catch (e) {
      console.warn("[FALLBACK DB] Error guardando en disco:", e.message);
    }
  }
  exec(sql) {
    return this;
  }
  pragma(str) {
    return this;
  }
  prepare(sql) {
    const s = sql.trim().replace(/\s+/g, " ");
    const dbInstance = this;
    return {
      run(...args) {
        try {
          if (s.startsWith("INSERT INTO orders")) {
            const [
              id,
              customer_document,
              customer_name,
              customer_email,
              customer_phone,
              shipping_address,
              shipping_city,
              notes,
              subtotal,
              discount,
              total,
              initial_payment,
              paid_amount,
              balance,
              status,
              wompi_reference,
              wompi_transaction_id,
              yeminus_document_id,
              yeminus_sync_status,
              yeminus_last_error,
              created_at,
              updated_at
            ] = args;
            const existing = dbInstance.data.orders[id] || {};
            const cleanDoc = customer_document && customer_document !== "222222222" ? customer_document : existing.customer_document || customer_document || "";
            const cleanName = customer_name && customer_name !== "Cliente Impormax" ? customer_name : existing.customer_name || customer_name || "Cliente Impormax";
            const cleanAddr = shipping_address && !shipping_address.includes("Entrega a domicilio / Retiro en tienda") ? shipping_address : existing.shipping_address || shipping_address || "";
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
              discount: Number(discount) !== void 0 ? Number(discount) : existing.discount || 0,
              total: Number(total) || existing.total || 0,
              initial_payment: Number(initial_payment) || existing.initial_payment || 0,
              paid_amount: Number(paid_amount) || existing.paid_amount || 0,
              balance: Number(balance) !== void 0 ? Number(balance) : existing.balance || 0,
              status: status || existing.status || "pendiente",
              wompi_reference: wompi_reference || existing.wompi_reference || "",
              wompi_transaction_id: wompi_transaction_id || existing.wompi_transaction_id || "",
              yeminus_document_id: yeminus_document_id || existing.yeminus_document_id || "",
              yeminus_sync_status: yeminus_sync_status || existing.yeminus_sync_status || "PENDING",
              yeminus_last_error: yeminus_last_error !== void 0 ? yeminus_last_error : existing.yeminus_last_error || "",
              created_at: existing.created_at || created_at || (/* @__PURE__ */ new Date()).toISOString(),
              updated_at: updated_at || (/* @__PURE__ */ new Date()).toISOString()
            };
            dbInstance.saveToDisk();
            return { changes: 1 };
          }
          if (s.startsWith("INSERT INTO order_items")) {
            const [
              id,
              order_id,
              product_id,
              product_reference,
              product_name,
              quantity,
              unit_price,
              discount_percentage,
              discount_amount,
              subtotal,
              tax,
              total,
              warehouse_origin,
              warehouse_destination
            ] = args;
            dbInstance.data.order_items[id] = {
              id: String(id),
              order_id: String(order_id),
              product_id: String(product_id || ""),
              product_reference: String(product_reference || ""),
              product_name: String(product_name || "Producto Navide\xF1o"),
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
          if (s.startsWith("INSERT INTO payments")) {
            const [
              id,
              order_id,
              amount,
              payment_reference,
              transaction_id,
              payment_method,
              status,
              raw_data,
              created_at
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
              created_at: created_at || existing.created_at || (/* @__PURE__ */ new Date()).toISOString()
            };
            dbInstance.saveToDisk();
            return { changes: 1 };
          }
          if (s.startsWith("INSERT INTO pending_checkouts")) {
            const [reference, order_id, amount_in_cents, currency, order_data_json, created_at] = args;
            dbInstance.data.pending_checkouts[reference] = {
              reference: String(reference),
              order_id: String(order_id),
              amount_in_cents: Number(amount_in_cents) || 0,
              currency: currency || "COP",
              order_data_json: String(order_data_json || "{}"),
              created_at: created_at || (/* @__PURE__ */ new Date()).toISOString()
            };
            dbInstance.saveToDisk();
            return { changes: 1 };
          }
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
          if (s.includes("UPDATE orders SET yeminus_document_id") && s.includes("WHERE wompi_reference = ? OR id = ?")) {
            const [docId, ref, id] = args;
            let changes = 0;
            for (const ord of Object.values(dbInstance.data.orders)) {
              if (ord.wompi_reference === ref || ord.id === id) {
                ord.yeminus_document_id = docId;
                ord.yeminus_sync_status = "SYNCED";
                ord.yeminus_last_error = "";
                ord.updated_at = (/* @__PURE__ */ new Date()).toISOString();
                changes++;
              }
            }
            if (changes > 0) dbInstance.saveToDisk();
            return { changes };
          }
          if (s.includes("UPDATE orders SET yeminus_document_id = ?, yeminus_sync_status = 'SYNCED'") && s.includes("WHERE id = ?")) {
            const [docId, id] = args;
            const ord = dbInstance.data.orders[id];
            if (ord) {
              ord.yeminus_document_id = docId;
              ord.yeminus_sync_status = "SYNCED";
              ord.yeminus_last_error = "";
              ord.updated_at = (/* @__PURE__ */ new Date()).toISOString();
              dbInstance.saveToDisk();
              return { changes: 1 };
            }
            return { changes: 0 };
          }
          if (s.includes("UPDATE orders SET yeminus_sync_status = 'ERP_SYNC_FAILED'") && s.includes("WHERE id = ?")) {
            const [err, id] = args;
            const ord = dbInstance.data.orders[id];
            if (ord) {
              ord.yeminus_sync_status = "ERP_SYNC_FAILED";
              ord.yeminus_last_error = String(err || "");
              ord.updated_at = (/* @__PURE__ */ new Date()).toISOString();
              dbInstance.saveToDisk();
              return { changes: 1 };
            }
            return { changes: 0 };
          }
          if (s.includes("UPDATE orders SET paid_amount = ?, balance = ?, status = ? WHERE id = ?")) {
            const [newPaid, rem, newSt, id] = args;
            const ord = dbInstance.data.orders[id];
            if (ord) {
              ord.paid_amount = Number(newPaid) || 0;
              ord.balance = Number(rem) || 0;
              ord.status = String(newSt || "abonando");
              ord.updated_at = (/* @__PURE__ */ new Date()).toISOString();
              dbInstance.saveToDisk();
              return { changes: 1 };
            }
            return { changes: 0 };
          }
          if (s.includes("UPDATE orders") && s.includes("WHERE id = ?")) {
            const oId = String(args[args.length - 1]);
            const ord = dbInstance.data.orders[oId];
            if (ord) {
              if (s.includes("wompi_reference = CASE")) {
                const [wRef, wTx] = args;
                if (!ord.wompi_reference && wRef) ord.wompi_reference = wRef;
                if (!ord.wompi_transaction_id && wTx) ord.wompi_transaction_id = wTx;
              }
              ord.updated_at = (/* @__PURE__ */ new Date()).toISOString();
              dbInstance.saveToDisk();
              return { changes: 1 };
            }
          }
          return { changes: 0 };
        } catch (e) {
          console.warn("[FALLBACK DB RUN ERROR]", e.message);
          return { changes: 0 };
        }
      },
      get(...args) {
        try {
          if (s.includes("SELECT id FROM payments WHERE id = ?") || s.includes("SELECT * FROM payments WHERE id = ?")) {
            const pId = String(args[0]);
            return dbInstance.data.payments[pId] || null;
          }
          if (s.includes("SELECT * FROM orders WHERE id = ?") || s.includes("SELECT * FROM orders WHERE id LIKE ?")) {
            const rawId = String(args[0] || "").replace(/[%_]/g, "").trim();
            if (dbInstance.data.orders[rawId]) return dbInstance.data.orders[rawId];
            for (const ord of Object.values(dbInstance.data.orders)) {
              if (ord.id === rawId || rawId.length >= 6 && ord.id.startsWith(rawId)) {
                return ord;
              }
            }
            return null;
          }
          if (s.includes("SELECT * FROM orders WHERE wompi_reference = ? OR yeminus_document_id = ?")) {
            const [ref, yDoc] = args.map((a) => String(a || "").trim());
            for (const ord of Object.values(dbInstance.data.orders)) {
              if (ref && ord.wompi_reference === ref || yDoc && ord.yeminus_document_id === yDoc) return ord;
            }
            return null;
          }
          if (s.includes("SELECT * FROM orders WHERE wompi_reference = ?") || s.includes("wompi_transaction_id")) {
            const [ref1, ref2, id3] = args.map((a) => String(a || "").trim());
            for (const ord of Object.values(dbInstance.data.orders)) {
              if (ref1 && ord.wompi_reference === ref1 || ref2 && ord.wompi_transaction_id === ref2 || id3 && ord.id === id3) {
                return ord;
              }
            }
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
          if (s.includes("SELECT * FROM pending_checkouts WHERE reference = ?")) {
            const ref = String(args[0]);
            return dbInstance.data.pending_checkouts[ref] || null;
          }
          return null;
        } catch (e) {
          console.warn("[FALLBACK DB GET ERROR]", e.message);
          return null;
        }
      },
      all(...args) {
        try {
          if (s.includes("SELECT * FROM payments WHERE order_id = ? AND status = 'approved'")) {
            const orderId = String(args[0]);
            return Object.values(dbInstance.data.payments).filter((p) => p.order_id === orderId && String(p.status || "").toLowerCase() === "approved").sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
          }
          if (s.includes("SELECT") && s.includes("FROM payments") && s.includes("raw_data")) {
            return Object.values(dbInstance.data.payments).filter((p) => p.raw_data && p.raw_data !== "");
          }
          if (s.includes("SELECT") && s.includes("FROM orders") && s.includes("WHERE")) {
            const rawDoc = String(args[0] || "").trim();
            const cleanDoc = rawDoc.replace(/\D/g, "");
            const searchRaw = rawDoc.toLowerCase();
            return Object.values(dbInstance.data.orders).filter((ord) => {
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
            }).sort(
              (a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))
            );
          }
          if (s.includes("SELECT") && s.includes("FROM orders")) {
            return Object.values(dbInstance.data.orders).sort(
              (a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))
            );
          }
          if (s.includes("SELECT * FROM order_items WHERE order_id = ?")) {
            const orderId = String(args[0]);
            return Object.values(dbInstance.data.order_items).filter((it) => it.order_id === orderId);
          }
          if (s.includes("SELECT * FROM payments WHERE order_id = ?") || s.includes("SELECT * FROM payments WHERE order_id LIKE")) {
            const rawOrderId = String(args[0] || "").replace(/[%_]/g, "").trim();
            return Object.values(dbInstance.data.payments).filter((p) => {
              if (p.order_id === rawOrderId) return true;
              if (rawOrderId.length >= 6 && p.order_id.startsWith(rawOrderId)) return true;
              if (p.payment_reference && rawOrderId.length >= 6 && p.payment_reference.includes(rawOrderId)) return true;
              return false;
            }).sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
          }
          if (s.includes("SELECT") && s.includes("FROM payments")) {
            return Object.values(dbInstance.data.payments).sort(
              (a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))
            );
          }
          return [];
        } catch (e) {
          console.warn("[FALLBACK DB ALL ERROR]", e.message);
          return [];
        }
      }
    };
  }
};
function createDatabaseInstance() {
  console.log("[DATABASE] Motor de datos en JavaScript puro activado (100% compatible con cPanel y Cloud).");
  return new FallbackDatabase();
}
var db = createDatabaseInstance();
function findInCatalog(sku, name, amount) {
  try {
    const bPath = import_path.default.join(process.cwd(), "products_backup.json");
    if (!import_fs.default.existsSync(bPath)) return null;
    const pBackup = JSON.parse(import_fs.default.readFileSync(bPath, "utf8")).products || [];
    if (sku && sku !== "ONLINE") {
      const s = String(sku).trim().toLowerCase();
      const byId = pBackup.find(
        (pr) => String(pr.id).toLowerCase() === s || String(pr.code).toLowerCase() === s || pr.reference && String(pr.reference).toLowerCase() === s
      );
      if (byId) return byId;
    }
    if (name) {
      const cleanName = name.replace(/^(\d+x\s+)+/, "").replace(/\s*\(Plan Separe.*?\)/, "").replace(/\s*\[Ref:\s*[^\]]+\]/g, "").replace(/\s*\[Doc:\s*[^\]]+\]/g, "").replace(/\s*\[Dir:\s*[^\]]+\]/g, "").replace(/\s*\[Ciudad:\s*[^\]]+\]/g, "").replace(/\[[^\]]*\]/g, "").trim().toLowerCase();
      const byName = pBackup.find((pr) => pr.name.toLowerCase() === cleanName);
      if (byName) return byName;
      const bySub = pBackup.find((pr) => cleanName.includes(pr.name.toLowerCase()) || pr.name.toLowerCase().includes(cleanName));
      if (bySub) return bySub;
      const tokens = cleanName.split(/\s+/).filter((w) => w.length > 2);
      if (tokens.length >= 2) {
        const scored = pBackup.map((pr) => {
          const pTokens = pr.name.toLowerCase().split(/\s+/);
          const matches = tokens.filter((t) => pTokens.includes(t)).length;
          return { pr, score: matches };
        }).sort((a, b) => b.score - a.score);
        if (scored[0] && scored[0].score >= 2) {
          return scored[0].pr;
        }
      }
    }
    if (amount && amount > 0) {
      const exact = pBackup.find((pr) => pr.price === amount || pr.discountPrice === amount);
      if (exact) return exact;
      const d10 = pBackup.find((pr) => Math.round((pr.discountPrice || pr.price) * 0.9) === amount || Math.round(pr.price * 0.9) === amount);
      if (d10) return d10;
      const s30 = pBackup.find((pr) => Math.round((pr.discountPrice || pr.price) * 0.3) === amount || Math.round((pr.discountPrice || pr.price) * 0.9 * 0.3) === amount);
      if (s30) return s30;
    }
  } catch {
  }
  return null;
}
function saveOrderWithItems(order, items) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
        WHEN trim(coalesce(excluded.shipping_address, '')) != '' AND excluded.shipping_address NOT IN ('Entrega a domicilio / Retiro en tienda', 'Entrega a domicilio', 'Direcci\xF3n de Entrega Registrada') THEN trim(excluded.shipping_address)
        WHEN trim(coalesce(orders.shipping_address, '')) != '' AND orders.shipping_address NOT IN ('Entrega a domicilio / Retiro en tienda', 'Entrega a domicilio', 'Direcci\xF3n de Entrega Registrada') THEN orders.shipping_address
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
      const pId = rawPid && rawPid !== "ONLINE" ? rawPid : cat ? cat.id : rawRef && rawRef !== "ONLINE" ? rawRef : "8010141";
      const pRef = rawRef && rawRef !== "ONLINE" ? rawRef : cat ? cat.reference || cat.id : pId;
      const pName = rawName && rawName !== "Producto Navide\xF1o" && rawName !== "ONLINE" ? rawName : cat ? cat.name : "Producto Navide\xF1o";
      const unitPrice = Number(it.unit_price ?? it.price) || (cat ? Number(cat.discountPrice || cat.price) : 0);
      const subtotal = Number(it.subtotal) || unitPrice * qty;
      const tax = Number(it.tax) || Math.round(subtotal - subtotal / 1.19);
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
  return getOrderById(order.id);
}
function getOrderById(id) {
  if (!id) return null;
  const clean = String(id).trim();
  let row = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(clean);
  if (!row) {
    row = db.prepare(`SELECT * FROM orders WHERE wompi_reference = ? OR yeminus_document_id = ?`).get(clean, clean);
  }
  if (!row) return null;
  return hydrateOrder(row);
}
function getOrderByWompiRef(ref) {
  if (!ref) return null;
  const clean = String(ref).trim();
  let row = db.prepare(`SELECT * FROM orders WHERE wompi_reference = ? OR wompi_transaction_id = ? OR id = ?`).get(clean, clean, clean);
  if (!row && clean.startsWith("WMP-ABONO-")) {
    const parts = clean.split("-");
    const targetId = parts.slice(2).join("-");
    if (targetId) {
      row = db.prepare(`SELECT * FROM orders WHERE id = ? OR wompi_reference = ?`).get(targetId, targetId);
    }
  }
  if (!row) return null;
  return hydrateOrder(row);
}
function getAllOrders() {
  const rows = db.prepare(`SELECT * FROM orders ORDER BY created_at DESC`).all();
  return rows.map((r) => hydrateOrder(r));
}
function deleteOrder(id) {
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
function hydrateOrder(row) {
  const items = db.prepare(`SELECT * FROM order_items WHERE order_id = ?`).all(row.id);
  const payments = db.prepare(`SELECT * FROM payments WHERE order_id = ? ORDER BY created_at ASC`).all(row.id);
  return {
    ...row,
    items,
    payments
  };
}
function savePayment(payment) {
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
    payment.created_at || (/* @__PURE__ */ new Date()).toISOString()
  );
}
function savePendingCheckout(reference, orderId, amountInCents, currency, orderData) {
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
    (/* @__PURE__ */ new Date()).toISOString()
  );
}
function getPendingCheckout(reference) {
  const row = db.prepare(`SELECT * FROM pending_checkouts WHERE reference = ?`).get(reference);
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
async function syncAndRecoverFromSupabase(supabaseClient) {
  if (!supabaseClient) return 0;
  try {
    const { data: pedidos, error } = await supabaseClient.from("pedidos").select("*");
    if (error || !pedidos) return 0;
    let pBackup = [];
    try {
      const fs3 = require("fs");
      const path3 = require("path");
      const bPath = path3.join(process.cwd(), "products_backup.json");
      if (fs3.existsSync(bPath)) {
        pBackup = JSON.parse(fs3.readFileSync(bPath, "utf8")).products || [];
      }
    } catch {
    }
    const findInCatalog2 = (sku, name) => {
      if (sku && sku !== "ONLINE") {
        const s = String(sku).trim().toLowerCase();
        const byId = pBackup.find(
          (pr) => String(pr.id).toLowerCase() === s || String(pr.code).toLowerCase() === s || pr.reference && String(pr.reference).toLowerCase() === s
        );
        if (byId) return byId;
      }
      if (name) {
        const cleanName = name.replace(/^(\d+x\s+)+/, "").replace(/\s*\(Plan Separe.*?\)/i, "").replace(/\s*\[Ref:\s*[^\]]+\]/gi, "").replace(/\s*\[Doc:\s*[^\]]+\]/gi, "").replace(/\s*\[Dir:\s*[^\]]+\]/gi, "").replace(/\s*\[Ciudad:\s*[^\]]+\]/gi, "").replace(/\[[^\]]*\]/g, "").trim().toLowerCase();
        const byName = pBackup.find((pr) => pr.name.toLowerCase() === cleanName);
        if (byName) return byName;
        const bySub = pBackup.find((pr) => cleanName.includes(pr.name.toLowerCase()) || pr.name.toLowerCase().includes(cleanName));
        if (bySub) return bySub;
        const tokens = cleanName.split(/\s+/).filter((w) => w.length > 2);
        if (tokens.length >= 2) {
          const scored = pBackup.map((pr) => {
            const pTokens = pr.name.toLowerCase().split(/\s+/);
            const matches = tokens.filter((t) => pTokens.includes(t)).length;
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
      const cleanProductName = (p.producto_name || "Producto Navide\xF1o").replace(/\[[^\]]*\]/g, "").trim();
      const rawTotal = Number(p.total) || 0;
      const abonado = Number(p.abonado) || 0;
      const isTotalCorrupted = existing && rawTotal > 0 && Math.abs(existing.total - rawTotal) > 10;
      const hasWrongTree = existing?.items?.some((it) => it.product_id === "8010141" && !cleanProductName.toLowerCase().includes("cancun"));
      const hasInvalidItems = !existing?.items || existing.items.length === 0 || existing.items.some((it) => !it.product_id || it.product_id === "ONLINE" || it.product_reference === "ONLINE") || hasWrongTree;
      const isAbonoCorrupted = existing && existing.paid_amount !== abonado && abonado > 0;
      if (!existing || hasInvalidItems || isTotalCorrupted || isAbonoCorrupted || p.id === "e5b3dccf-de4c-4a59-8f52-89f904c5dfcd") {
        const parsedItems = [];
        let calcSubtotal = 0;
        let calcDiscount = 0;
        let calcTotal = 0;
        if (p.id === "e5b3dccf-de4c-4a59-8f52-89f904c5dfcd" || p.cliente_nombre && p.cliente_nombre.toLowerCase().includes("federico tangarife")) {
          parsedItems.push({
            product_id: "401563",
            product_reference: "LX-N0144",
            product_name: "Instalaci\xF3n Lineal Led Carrete x 100mts de 1000L - Luz C\xE1lida",
            quantity: 2,
            unit_price: 26e4,
            price: 26e4,
            subtotal: 52e4,
            tax: Math.round(52e4 - 52e4 / 1.19),
            total: 52e4,
            warehouse_origin: "05",
            warehouse_destination: "07"
          });
          parsedItems.push({
            product_id: "8040211",
            product_reference: "DTI00383R",
            product_name: "Flor Navidad 28cm 5 P\xE9talos Rojo Terciopelo Escarchado",
            quantity: 4,
            unit_price: 58118,
            price: 58118,
            subtotal: 232472,
            tax: Math.round(232472 - 232472 / 1.19),
            total: 232472,
            warehouse_origin: "05",
            warehouse_destination: "07"
          });
          calcTotal = 752472;
          calcSubtotal = 752472;
        } else {
          const rawItems = cleanProductName.split(/,\s*(?=\d+x\s+)/).map((s) => s.trim()).filter(Boolean);
          const rawSkus = (p.producto_id || "").split(",").map((s) => s.trim()).filter(Boolean);
          const itemsToProcess = rawItems.length > 0 ? rawItems : [cleanProductName];
          itemsToProcess.forEach((itemStr, idx) => {
            const m = itemStr.match(/^(\d+)x\s+(.+)$/);
            const qty = m ? parseInt(m[1]) : 1;
            const name = m ? m[2].trim() : itemStr.trim();
            const rawSku = rawSkus[idx] && rawSkus[idx] !== "ONLINE" ? rawSkus[idx] : rawSkus[0] && rawSkus[0] !== "ONLINE" ? rawSkus[0] : p.producto_id && p.producto_id !== "ONLINE" ? p.producto_id : "";
            const foundP = findInCatalog2(rawSku, name);
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
                tax: Math.round(itemTot - itemTot / 1.19),
                total: itemTot,
                warehouse_origin: "05",
                warehouse_destination: "07"
              });
            } else {
              const uPrice = Math.round((rawTotal || 5e4) / (itemsToProcess.length * qty));
              const itemTot = uPrice * qty;
              calcTotal += itemTot;
              calcSubtotal += itemTot;
              const cleanItemSku = rawSku && rawSku !== "ONLINE" ? rawSku : `PROD-${idx + 1}`;
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
                tax: Math.round(itemTot - itemTot / 1.19),
                total: itemTot,
                warehouse_origin: "05",
                warehouse_destination: "07"
              });
            }
          });
        }
        const effectiveTotal = rawTotal > 0 ? rawTotal : calcTotal > 0 ? calcTotal : 0;
        const effectiveSubtotal = calcSubtotal > 0 ? calcSubtotal : effectiveTotal;
        const effectiveDiscount = calcDiscount > 0 ? calcDiscount : Math.max(0, effectiveSubtotal - effectiveTotal);
        const effectiveStatus = effectiveTotal > 0 && abonado >= effectiveTotal - 10 || Number(p.restante) <= 0 ? "pagado" : abonado > 0 ? "abonando" : p.estado || "pendiente";
        const restante = effectiveStatus === "pagado" ? 0 : p.restante !== void 0 && p.restante !== null && !isNaN(Number(p.restante)) ? Number(p.restante) : Math.max(0, effectiveTotal - abonado);
        const effectiveDoc = existing?.customer_document && existing.customer_document !== "222222222" && existing.customer_document !== "" ? existing.customer_document : customerDocFromMeta || p.cliente_documento || p.customer_document || "";
        const isGenericAddr = !existing?.shipping_address || [
          "Entrega a domicilio / Retiro en tienda",
          "Entrega a domicilio",
          "Direcci\xF3n de Entrega Registrada"
        ].includes(existing.shipping_address);
        const effectiveAddress = !isGenericAddr && existing?.shipping_address ? existing.shipping_address : shippingAddressFromMeta || p.direccion_envio || p.shipping_address || existing?.shipping_address || "";
        const effectiveCity = existing?.shipping_city && existing.shipping_city !== "Pereira" && existing.shipping_city !== "" ? existing.shipping_city : shippingCityFromMeta || p.ciudad_envio || p.shipping_city || (existing?.shipping_city !== "Pereira" ? existing?.shipping_city : "") || "";
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
          created_at: p.created_at || (/* @__PURE__ */ new Date()).toISOString()
        }, parsedItems);
        importedCount++;
      } else if (!existing.yeminus_document_id && yeminusDocId) {
        db.prepare(`UPDATE orders SET yeminus_document_id = ?, yeminus_sync_status = 'SYNCED' WHERE id = ?`).run(yeminusDocId, p.id);
      }
    }
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
            created_at: pay.created_at || (/* @__PURE__ */ new Date()).toISOString()
          });
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
  } catch (err) {
    console.warn("[RECOVER FROM SUPABASE WARN]", err.message);
    return 0;
  }
}
function auditAndFixAllOrderItemPrices() {
  try {
    let pBackup = [];
    try {
      const fs3 = require("fs");
      const path3 = require("path");
      const bPath = path3.join(process.cwd(), "products_backup.json");
      if (fs3.existsSync(bPath)) {
        pBackup = JSON.parse(fs3.readFileSync(bPath, "utf8")).products || [];
      }
    } catch {
    }
    const orders = getAllOrders();
    let fixed = 0;
    for (const order of orders) {
      const items = order.items || [];
      if (items.length === 0) continue;
      const orderTotal = Number(order.total) || 0;
      if (orderTotal <= 0) continue;
      const currentSum = items.reduce((acc, it) => acc + Number(it.total || it.unit_price * it.quantity), 0);
      const needsFix = Math.abs(currentSum - orderTotal) > 2 || items.some((it) => it.unit_price <= 0 || it.total <= 0);
      if (!needsFix) continue;
      let newItems = [];
      if (items.length === 1) {
        const it = items[0];
        const qty = Math.max(1, Number(it.quantity) || 1);
        const unitPrice = Math.round(orderTotal / qty);
        newItems.push({
          ...it,
          quantity: qty,
          unit_price: unitPrice,
          subtotal: orderTotal,
          tax: Math.round(orderTotal - orderTotal / 1.19),
          total: orderTotal
        });
      } else {
        const weights = items.map((it) => {
          const sku = String(it.product_id || "").trim();
          const foundP = pBackup.find((pr) => String(pr.id).trim() === sku || String(pr.code).trim() === sku);
          const basePrice = it.unit_price > 0 && it.unit_price < orderTotal ? it.unit_price : foundP ? Number(foundP.discountPrice || foundP.price || 5e4) : 5e4;
          return Math.max(1e3, basePrice) * Math.max(1, Number(it.quantity) || 1);
        });
        const totalW = weights.reduce((a, b) => a + b, 0) || 1;
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
            tax: Math.round(itemTot - itemTot / 1.19),
            total: itemTot
          };
        });
      }
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
        const pId = (cat ? cat.id : it.product_id && it.product_id !== "ONLINE" ? it.product_id : it.product_reference && it.product_reference !== "ONLINE" ? it.product_reference : "8010141").trim();
        const pRef = (cat ? cat.reference || cat.id : it.product_reference && it.product_reference !== "ONLINE" ? it.product_reference : pId).trim();
        const pName = (cat ? cat.name : String(it.product_name || "Producto Navide\xF1o")).trim();
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
      console.log(`[DB AUDIT] Corregidos los precios y totales de art\xEDculos en ${fixed} pedidos.`);
    }
    return fixed;
  } catch (err) {
    console.warn("[DB AUDIT ERROR]", err.message);
    return 0;
  }
}
function enrichExistingOrders() {
  try {
    const customerUpdates = {
      "Federico Tangarife Martinez": { doc: "1058821087", phone: "3216041090" },
      "Judy Cabarcas": { doc: "40187061", phone: "3112027858" },
      "Diana Milena Rincon Pati\xF1o": { doc: "42120333", phone: "3127959861" },
      "Ruth Esther Sanchez Sanchez": { doc: "26863726", phone: "3185355168" },
      "Dora Tabares": { doc: "42881724", phone: "3216149828" },
      "Ana Maria Sanchez": { doc: "30401854", phone: "3176689509" },
      "luisa fernanda ospina lozano": { doc: "1053801786", phone: "3103991228" },
      "Susana mejia martinez": { doc: "1053806279", phone: "3116906567" },
      "KELLY PATRICIA GA\xD1AN": { doc: "25181177", phone: "3153048861" },
      "Rosana Freyle": { doc: "49769542", phone: "3215322671" },
      "Kelly Naranjo": { doc: "38473054", phone: "3153856521" },
      "Rosemary consuegra": { doc: "49792570", phone: "3157183046" },
      "Rosemary consuegra sanguino": { doc: "49782570", phone: "3157183046" },
      "Sugey Norela Ramos Rodriguez": { doc: "1121825637", phone: "3106699165" },
      "Edna Marcela Vera Diaz": { doc: "27555715", phone: "3153091949" },
      "Yuli Estefania Cruz": { doc: "1088300478", phone: "3234460037" },
      "Jenny Fernanda Rozo Arg\xFCello": { doc: "1087996022", phone: "3043529062" },
      "Leidy Johanna Quiceno alvarez": { doc: "1102828770", phone: "3113389662" },
      "Leidy Moreno Becerra": { doc: "55582516", phone: "3178451358" },
      "Luis Alvarez": { doc: "27555715", phone: "3153091949" },
      "Yinna milena pe\xF1alosa": { phone: "3025320501" },
      "Christian Hernandez gomez": { phone: "3008242733" },
      "Gabriela jimenez": { phone: "3214985377" },
      "Luz Divina Casta\xF1eda Carmona": { phone: "3185566926" },
      "Yeisy Alexandra Carvajal Salas": { phone: "3108660961" }
    };
    const updateStmt = db.prepare(`
      UPDATE orders 
      SET customer_document = CASE WHEN ? != '' THEN ? ELSE customer_document END,
          customer_phone = CASE WHEN ? != '' THEN ? ELSE customer_phone END
      WHERE id = ?
    `);
    const all = db.prepare(`SELECT id, customer_name, customer_document, customer_phone FROM orders`).all();
    for (const o of all) {
      const match = Object.entries(customerUpdates).find(
        ([name]) => o.customer_name.toLowerCase().trim().includes(name.toLowerCase().trim()) || name.toLowerCase().trim().includes(o.customer_name.toLowerCase().trim())
      );
      if (match) {
        const u = match[1];
        const newDoc = u.doc && (!o.customer_document || o.customer_document === "222222222") ? u.doc : o.customer_document || "";
        const newPhone = u.phone && (!o.customer_phone || o.customer_phone === "3000000000") ? u.phone : o.customer_phone || "";
        if (newDoc !== o.customer_document || newPhone !== o.customer_phone) {
          updateStmt.run(newDoc, newDoc, newPhone, newPhone, o.id);
        }
      }
    }
    const paymentsWithRaw = db.prepare(`SELECT payment_reference, raw_data, order_id FROM payments WHERE raw_data != ''`).all();
    for (const p of paymentsWithRaw) {
      try {
        const raw = JSON.parse(p.raw_data);
        const doc = raw.billing_data?.legal_id || raw.customer_data?.legal_id || raw.payment_method?.extra?.user_legal_id || raw.payment_method?.extra?.identificationNumber;
        const phone = raw.customer_data?.phone_number || raw.payment_method?.extra?.cellphoneNumber;
        if (doc || phone) {
          const ord = (p.order_id ? getOrderById(p.order_id) : null) || (p.payment_reference ? getOrderByWompiRef(p.payment_reference) : null);
          if (ord) {
            const cleanDoc = doc && String(doc).trim() !== "222222222" ? String(doc).trim() : ord.customer_document;
            const cleanPhone = phone && String(phone).trim() !== "3000000000" ? String(phone).replace(/^\+57/, "").trim() : ord.customer_phone;
            if (cleanDoc !== ord.customer_document || cleanPhone !== ord.customer_phone) {
              updateStmt.run(cleanDoc, cleanDoc, cleanPhone, cleanPhone, ord.id);
            }
          }
        }
      } catch {
      }
    }
  } catch (err) {
    console.warn("[ENRICH ORDERS WARN]", err.message);
  }
}
try {
  auditAndFixAllOrderItemPrices();
  enrichExistingOrders();
} catch {
}

// server/email.ts
var import_nodemailer = __toESM(require("nodemailer"), 1);
var SMTP_CONFIG = {
  host: process.env.SMTP_HOST || "mail.impormax.net",
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER || "notificaciones@impormax.net",
    pass: process.env.SMTP_PASS || "Conexion2026**"
  },
  tls: {
    rejectUnauthorized: false
  }
};
var transporter = import_nodemailer.default.createTransport(SMTP_CONFIG);
function formatCOP(amount) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(amount);
}
function formatDate(dateInput) {
  try {
    const d = dateInput ? new Date(dateInput) : /* @__PURE__ */ new Date();
    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "America/Bogota"
    }).format(d);
  } catch {
    return (/* @__PURE__ */ new Date()).toLocaleDateString("es-CO");
  }
}
async function sendOrderConfirmationEmail(order) {
  const recipient = String(order.customer_email || "").trim();
  if (!recipient || !recipient.includes("@")) {
    console.warn("[EMAIL WARN] Correo del cliente inv\xE1lido o ausente:", recipient);
    return { success: false, error: "Correo de cliente inv\xE1lido o ausente" };
  }
  const customerName = String(order.customer_name || "Estimado(a) Cliente").trim();
  const radicadoYeminus = order.yeminus_document_id || "En proceso de asignaci\xF3n";
  const wompiRef = order.wompi_reference || "N/A";
  const txId = order.wompi_transaction_id || "";
  const total = Number(order.total_amount) || 0;
  const paid = Number(order.paid_amount) || 0;
  const balance = order.balance_pending !== void 0 ? Number(order.balance_pending) : Math.max(0, total - paid);
  const isFullyPaid = balance <= 0;
  const methodLabel = order.payment_method_label || "Pasarela Wompi Bancolombia";
  const dateFormatted = formatDate(order.created_at);
  const cleanDoc = String(order.customer_document || "").trim();
  const address = String(order.shipping_address || "Retiro en tienda o entrega coordinada").trim();
  const city = String(order.shipping_city || "Colombia").trim();
  const notes = String(order.notes || "").trim();
  let items = order.items && order.items.length > 0 ? order.items : [];
  if (items.length === 0 && order.product_name) {
    items = [{
      product_name: order.product_name.replace(/\[[^\]]*\]/g, "").trim(),
      product_id: order.product_id || "",
      product_reference: order.product_id || "",
      quantity: 1,
      unit_price: total,
      total
    }];
  }
  const itemsHtml = items.map((it, idx) => {
    const name = it.product_name || it.name || "Producto Navide\xF1o";
    const ref = it.product_reference || it.product_id || it.id || "";
    const qty = Number(it.quantity) || 1;
    const unitPrice = Number(it.unit_price || it.price) || (qty > 0 ? Math.round((Number(it.total) || 0) / qty) : 0);
    const itemTot = Number(it.total) || unitPrice * qty;
    return `
      <tr style="border-bottom: 1px solid #e7e5e4;">
        <td style="padding: 12px 10px; font-size: 14px; color: #1c1917; vertical-align: top;">
          <div style="font-weight: 600; color: #0f172a;">${name}</div>
          ${ref ? `<div style="font-size: 12px; color: #64748b; font-family: monospace; margin-top: 2px;">Ref/SKU: ${ref}</div>` : ""}
        </td>
        <td style="padding: 12px 10px; text-align: center; font-size: 14px; color: #334155; vertical-align: top; font-weight: 600;">
          ${qty}
        </td>
        <td style="padding: 12px 10px; text-align: right; font-size: 14px; color: #334155; vertical-align: top;">
          ${formatCOP(unitPrice)}
        </td>
        <td style="padding: 12px 10px; text-align: right; font-size: 14px; font-weight: 700; color: #047857; vertical-align: top;">
          ${formatCOP(itemTot)}
        </td>
      </tr>
    `;
  }).join("");
  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmaci\xF3n de Pedido - Impormax Navidad</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Contenedor Principal -->
        <table role="presentation" width="100%" style="max-width: 620px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
          
          <!-- Encabezado Navide\xF1o Impormax -->
          <tr>
            <td style="background: linear-gradient(135deg, #064e3b 0%, #047857 60%, #065f46 100%); padding: 32px 28px; text-align: center; color: #ffffff;">
              <div style="font-size: 28px; font-weight: 800; letter-spacing: 1px; color: #fde047; margin-bottom: 4px;">
                \u2605 IMPORMAX NAVIDAD \u2605
              </div>
              <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 2px; color: #a7f3d0; margin-bottom: 16px;">
                Pereira - Risaralda | Cra 7 # 21-42 Centro
              </div>
              <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 9999px; padding: 6px 18px; font-size: 14px; font-weight: 700; color: #ffffff;">
                \u2713 \xA1Tu ${isFullyPaid ? "Compra" : "Plan Separe"} ha sido confirmado!
              </div>
            </td>
          </tr>

          <!-- Cuerpo del Mensaje -->
          <tr>
            <td style="padding: 28px;">
              <p style="font-size: 16px; color: #334155; margin: 0 0 16px 0; line-height: 1.5;">
                Hola <strong style="color: #0f172a;">${customerName}</strong>,
              </p>
              <p style="font-size: 14px; color: #475569; margin: 0 0 24px 0; line-height: 1.6;">
                Hemos recibido y confirmado tu pago exitosamente. A continuaci\xF3n encontrar\xE1s todos los detalles oficiales de tu orden y el radicado formal en nuestro sistema ERP.
              </p>

              <!-- Bloque de Radicados Oficiales -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table role="presentation" width="100%">
                      <tr>
                        <td style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px;">Radicado ERP Yeminus:</td>
                        <td style="text-align: right; font-size: 15px; font-weight: 800; color: #047857; font-family: monospace;">${radicadoYeminus}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700; padding-top: 8px;">Ref. Pago Wompi:</td>
                        <td style="text-align: right; font-size: 13px; font-weight: 700; color: #0f172a; font-family: monospace; padding-top: 8px;">${wompiRef}</td>
                      </tr>
                      ${txId ? `
                      <tr>
                        <td style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700; padding-top: 8px;">ID Transacci\xF3n:</td>
                        <td style="text-align: right; font-size: 12px; color: #64748b; font-family: monospace; padding-top: 8px;">${txId}</td>
                      </tr>` : ""}
                      <tr>
                        <td style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700; padding-top: 8px;">M\xE9todo de Pago:</td>
                        <td style="text-align: right; font-size: 13px; color: #334155; font-weight: 600; padding-top: 8px;">${methodLabel}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700; padding-top: 8px;">Fecha de Registro:</td>
                        <td style="text-align: right; font-size: 13px; color: #334155; padding-top: 8px;">${dateFormatted}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Tabla de Art\xEDculos -->
              <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 12px; letter-spacing: 0.5px;">
                \u{1F4E6} Art\xEDculos en tu Pedido:
              </div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
                <thead>
                  <tr style="background-color: #f1f5f9; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; color: #475569; border-bottom: 1px solid #cbd5e1;">
                    <th style="padding: 10px; text-align: left;">Producto</th>
                    <th style="padding: 10px; text-align: center;">Cant.</th>
                    <th style="padding: 10px; text-align: right;">Unitario</th>
                    <th style="padding: 10px; text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml || `<tr><td colspan="4" style="padding: 16px; text-align: center; color: #64748b;">Art\xEDculos de temporada navide\xF1a</td></tr>`}
                </tbody>
              </table>

              <!-- Resumen Financiero -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px;">
                <tr>
                  <td style="font-size: 14px; color: #475569; padding-bottom: 6px;">Total del Pedido:</td>
                  <td style="text-align: right; font-size: 15px; font-weight: 700; color: #0f172a; padding-bottom: 6px;">${formatCOP(total)}</td>
                </tr>
                <tr>
                  <td style="font-size: 14px; color: #047857; font-weight: 700; padding-bottom: 6px;">Monto Abonado Hoy (Wompi):</td>
                  <td style="text-align: right; font-size: 15px; font-weight: 800; color: #047857; padding-bottom: 6px;">${formatCOP(paid)}</td>
                </tr>
                <tr style="border-top: 1px dashed #cbd5e1;">
                  <td style="font-size: 15px; font-weight: 800; color: ${isFullyPaid ? "#047857" : "#b45309"}; padding-top: 10px;">
                    ${isFullyPaid ? "Estado de Cuenta:" : "Saldo Restante Pendiente:"}
                  </td>
                  <td style="text-align: right; font-size: 17px; font-weight: 900; color: ${isFullyPaid ? "#047857" : "#b45309"}; padding-top: 10px;">
                    ${isFullyPaid ? "PAGADO TOTALMENTE \u2713" : formatCOP(balance)}
                  </td>
                </tr>
                ${!isFullyPaid ? `
                <tr>
                  <td colspan="2" style="font-size: 12px; color: #64748b; padding-top: 8px;">
                    * Recuerda que tienes plazo de cancelar tu saldo restante en abonos libres antes del <strong>16 de noviembre de 2026</strong>.
                  </td>
                </tr>` : ""}
              </table>

              <!-- Datos de Env\xEDo y Destinatario -->
              <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 12px;">
                \u{1F4CD} Informaci\xF3n de Despacho y Contacto:
              </div>
              <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; font-size: 13px; color: #334155; line-height: 1.6;">
                <div><strong>Destinatario:</strong> ${customerName}</div>
                ${cleanDoc ? `<div><strong>C\xE9dula / NIT:</strong> ${cleanDoc}</div>` : ""}
                ${order.customer_phone ? `<div><strong>Tel\xE9fono / WhatsApp:</strong> ${order.customer_phone}</div>` : ""}
                <div><strong>Direcci\xF3n de Entrega:</strong> ${address}</div>
                <div><strong>Ciudad / Destino:</strong> ${city}</div>
                ${notes ? `<div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #e2e8f0; color: #64748b;"><em>Observaciones: "${notes}"</em></div>` : ""}
              </div>

              <!-- Botones de Acci\xF3n -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 16px;">
                <tr>
                  <td align="center">
                    <a href="https://tienda.impormax.net" target="_blank" style="display: inline-block; background-color: #047857; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 28px; border-radius: 10px; box-shadow: 0 4px 12px rgba(4, 120, 87, 0.25);">
                      Ingresar a Mi Cuenta y Monitorear Separe
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; color: #64748b; text-align: center; margin: 16px 0 0 0;">
                \xBFTienes preguntas o deseas realizar un nuevo abono? Escr\xEDbenos directamente a nuestro WhatsApp oficial o responde a este correo.
              </p>
            </td>
          </tr>

          <!-- Pie de P\xE1gina -->
          <tr>
            <td style="background-color: #0f172a; padding: 24px 28px; text-align: center; color: #94a3b8; font-size: 12px; line-height: 1.6;">
              <div style="font-weight: 700; color: #f8fafc; font-size: 14px; margin-bottom: 4px;">
                Distribuidora Impormax S.A.S.
              </div>
              <div>NIT: 816.008.621-1 | Pereira, Risaralda, Colombia</div>
              <div style="margin-top: 12px; color: #64748b; font-size: 11px;">
                Este es un comprobante de notificaci\xF3n oficial generado autom\xE1ticamente tras la confirmaci\xF3n de tu pago en pasarela Wompi. Por favor conserva este correo para tu radicado.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
  const textContent = `
IMPORMAX NAVIDAD - Confirmaci\xF3n de ${isFullyPaid ? "Compra" : "Plan Separe"}
============================================================
Hola ${customerName},

\xA1Tu pago ha sido confirmado exitosamente!

DETALLES OFICIALES:
- Radicado ERP Yeminus: ${radicadoYeminus}
- Referencia Wompi: ${wompiRef}
${txId ? `- ID Transacci\xF3n: ${txId}
` : ""}- M\xE9todo de Pago: ${methodLabel}
- Fecha: ${dateFormatted}

RESUMEN FINANCIERO:
- Total del Pedido: ${formatCOP(total)}
- Monto Abonado Hoy: ${formatCOP(paid)}
- Saldo Restante: ${isFullyPaid ? "PAGADO TOTALMENTE" : formatCOP(balance)}

DATOS DE ENTREGA:
- Destinatario: ${customerName}
- Documento: ${cleanDoc}
- Direcci\xF3n: ${address}
- Ciudad: ${city}
${order.customer_phone ? `- Tel\xE9fono: ${order.customer_phone}
` : ""}${notes ? `- Observaciones: ${notes}
` : ""}
ART\xCDCULOS:
${items.map((it) => `\u2022 ${it.quantity}x ${it.product_name || it.name} - Total: ${formatCOP(Number(it.total) || 0)}`).join("\n")}

Distribuidora Impormax S.A.S. - Pereira, Colombia
Cra 7 # 21-42 Centro
  `.trim();
  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || '"Impormax Navidad" <notificaciones@impormax.net>',
      to: recipient,
      bcc: "notificaciones@impormax.net",
      // Copia oculta a la tienda para registro administrativo
      subject: `\u{1F384} Confirmaci\xF3n de tu ${isFullyPaid ? "Pedido" : "Plan Separe"} [${radicadoYeminus}] - Impormax Navidad`,
      text: textContent,
      html: htmlContent
    };
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL SUCCESS] Correo de confirmaci\xF3n enviado exitosamente a ${recipient} (Radicado: ${radicadoYeminus}, ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[EMAIL ERROR] Fallo al enviar correo a ${recipient}:`, err.message);
    return { success: false, error: err.message };
  }
}

// server.ts
var import_supabase_js = require("@supabase/supabase-js");
var import_meta = {};
if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = import_ws.default;
}
var currentDir = typeof __dirname !== "undefined" ? __dirname : import_meta.url ? import_path2.default.dirname((0, import_url.fileURLToPath)(import_meta.url)) : process.cwd();
import_dotenv.default.config({ path: import_path2.default.join(process.cwd(), ".env"), override: true });
var app = (0, import_express.default)();
var PORT = process.env.PORT || 3e3;
app.use(import_express.default.json());
var ADMIN_SECRET = process.env.ADMIN_SECRET || "impormax_admin_secret_key_2026";
var ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "impormax2026";
function verifyAdminToken(token) {
  if (!token) return false;
  try {
    const [payloadBase64, sig] = token.split(".");
    if (!payloadBase64 || !sig) return false;
    const expectedSig = import_crypto.default.createHmac("sha256", ADMIN_SECRET).update(payloadBase64).digest("hex");
    if (sig !== expectedSig) return false;
    const payload = JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf-8"));
    if (payload.role !== "admin" || payload.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}
function adminAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : req.headers["x-admin-key"];
  if (token === ADMIN_PASSWORD || req.headers["x-admin-key"] === ADMIN_PASSWORD) {
    return next();
  }
  if (verifyAdminToken(token)) {
    return next();
  }
  return res.status(401).json({ success: false, error: "No autorizado. Requiere credenciales de administrador." });
}
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  if (!password || password.trim() !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: "Contrase\xF1a incorrecta de administraci\xF3n." });
  }
  const payload = {
    role: "admin",
    exp: Date.now() + 7 * 24 * 3600 * 1e3
    // 7 días
  };
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  const signature = import_crypto.default.createHmac("sha256", ADMIN_SECRET).update(payloadBase64).digest("hex");
  const token = `${payloadBase64}.${signature}`;
  res.json({ success: true, token });
});
app.get("/logo_impormax.png", (req, res) => {
  const rootPath = import_path2.default.join(process.cwd(), "logo_impormax.png");
  const publicPath = import_path2.default.join(process.cwd(), "public", "logo_impormax.png");
  const srcPath = import_path2.default.join(process.cwd(), "src", "logo_impormax.png");
  if (import_fs2.default.existsSync(rootPath)) {
    res.sendFile(rootPath);
  } else if (import_fs2.default.existsSync(publicPath)) {
    res.sendFile(publicPath);
  } else if (import_fs2.default.existsSync(srcPath)) {
    res.sendFile(srcPath);
    res.redirect("https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=150");
  }
});
app.get(["/dist.zip", "/download/dist.zip", "/api/download/dist.zip"], (req, res) => {
  const zipPath = import_path2.default.join(process.cwd(), "dist.zip");
  if (import_fs2.default.existsSync(zipPath)) {
    res.setHeader("Content-Type", "application/zip");
    res.download(zipPath, "dist.zip");
  } else {
    res.status(404).send("dist.zip no encontrado. Ejecuta 'npm run build' primero.");
  }
});
var apiLogs = [];
function logApi(type, endpoint, message, payload, response) {
  apiLogs.unshift({
    timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString(),
    type,
    endpoint,
    message,
    payload,
    response
  });
  if (apiLogs.length > 50) apiLogs.pop();
}
var cachedToken = null;
var cachedRefreshToken = null;
var tokenExpiresAt = 0;
var YEMINUS_BASE = "https://tienda.impormax.net";
var BACKUP_FILE_PATH = import_path2.default.join(process.cwd(), "products_backup.json");
var PENDING_SESSIONS_FILE = import_path2.default.join(process.cwd(), "pending_wompi_sessions.json");
var pendingWompiSessions = /* @__PURE__ */ new Map();
function loadPendingSessions() {
  try {
    if (import_fs2.default.existsSync(PENDING_SESSIONS_FILE)) {
      const content = import_fs2.default.readFileSync(PENDING_SESSIONS_FILE, "utf-8");
      const parsed = JSON.parse(content);
      for (const [key, val] of Object.entries(parsed)) {
        pendingWompiSessions.set(key, val);
      }
      console.log(`[PENDING SESSIONS] Cargadas ${pendingWompiSessions.size} sesiones pendientes del disco.`);
    }
  } catch (e) {
    console.warn("[PENDING SESSIONS] Error al cargar:", e.message);
  }
}
loadPendingSessions();
function savePendingSession(ref, data) {
  pendingWompiSessions.set(ref, data);
  try {
    const obj = Object.fromEntries(pendingWompiSessions);
    import_fs2.default.writeFileSync(PENDING_SESSIONS_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch (e) {
    console.warn("[PENDING SESSIONS] Error al guardar:", e.message);
  }
}
function getPendingSession(ref) {
  if (!ref) return null;
  if (pendingWompiSessions.has(ref)) {
    return pendingWompiSessions.get(ref);
  }
  try {
    if (import_fs2.default.existsSync(PENDING_SESSIONS_FILE)) {
      const content = import_fs2.default.readFileSync(PENDING_SESSIONS_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed[ref]) {
        pendingWompiSessions.set(ref, parsed[ref]);
        return parsed[ref];
      }
    }
  } catch (e) {
    console.warn("[PENDING SESSIONS] Error al leer archivo:", e.message);
  }
  try {
    const pc = getPendingCheckout(ref);
    if (pc && pc.orderData) {
      pendingWompiSessions.set(ref, pc.orderData);
      return pc.orderData;
    }
  } catch (e) {
    console.warn("[PENDING SESSIONS] Error al leer pending_checkouts:", e.message);
  }
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
  } catch (e) {
  }
  return null;
}
function deletePendingSession(ref) {
  pendingWompiSessions.delete(ref);
  try {
    const obj = Object.fromEntries(pendingWompiSessions);
    import_fs2.default.writeFileSync(PENDING_SESSIONS_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch (e) {
    console.warn("[PENDING SESSIONS] Error al borrar:", e.message);
  }
}
function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://yhfutwanlzahplckidys.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_YXXrvVtdhSVzBKJi1FQMTg_lr7QBIb8";
  if (!url || !key) return null;
  try {
    return (0, import_supabase_js.createClient)(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      realtime: {
        transport: import_ws.default
      }
    });
  } catch (e) {
    console.error("Supabase server client error:", e);
    return null;
  }
}
function saveProductsToLocalFile(products) {
  const tempPath = `${BACKUP_FILE_PATH}.${Date.now()}.tmp`;
  try {
    const data = JSON.stringify(
      {
        timestamp: Date.now(),
        count: products.length,
        lastSync: (/* @__PURE__ */ new Date()).toISOString(),
        products
      },
      null,
      2
    );
    import_fs2.default.writeFileSync(tempPath, data, "utf-8");
    import_fs2.default.renameSync(tempPath, BACKUP_FILE_PATH);
    console.log(`[BACKUP LOCAL] Guardados ${products.length} productos en ${BACKUP_FILE_PATH}`);
  } catch (err) {
    console.error("[BACKUP LOCAL] Error guardando archivo local:", err);
    try {
      if (import_fs2.default.existsSync(tempPath)) import_fs2.default.unlinkSync(tempPath);
    } catch {
    }
  }
}
function loadProductsFromLocalFile() {
  try {
    if (import_fs2.default.existsSync(BACKUP_FILE_PATH)) {
      const raw = import_fs2.default.readFileSync(BACKUP_FILE_PATH, "utf-8");
      if (!raw || raw.trim().length === 0) {
        return null;
      }
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (parseErr) {
        console.warn("[BACKUP LOCAL] Archivo local corrupto o incompleto. Se descartar\xE1 y actualizar\xE1 en la pr\xF3xima sincronizaci\xF3n.");
        try {
          import_fs2.default.unlinkSync(BACKUP_FILE_PATH);
        } catch {
        }
        return null;
      }
      const prodList = Array.isArray(parsed) ? parsed : Array.isArray(parsed.products) ? parsed.products : [];
      if (prodList.length > 0) {
        const activeInStock = prodList.filter((p) => (Number(p.stock) || 0) >= 1 && (Number(p.price) || 0) > 0).map((p) => {
          const pubDate = p.publicationDate || p.fechaLogEstado || p.fechaModificacion || p.createdAt || p.created_at || null;
          let isNew = false;
          if (pubDate) {
            try {
              const d = new Date(pubDate);
              if (!isNaN(d.getTime())) {
                const diffDays = (Date.now() - d.getTime()) / (1e3 * 60 * 60 * 24);
                isNew = diffDays >= -1 && diffDays <= 15;
              }
            } catch {
            }
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
            videoUrl: videoUrl || void 0
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
async function loadProductsFromSupabase() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from("products").select("*").eq("is_active", true).gte("stock", 1);
    if (error || !data || data.length === 0) {
      return null;
    }
    return data.map((row) => {
      const raw = row.raw_yeminus_data || {};
      const isTree = row.category === "\xC1rboles";
      const pubDate = raw.publicationDate || raw.fechaLogEstado || raw.fechaModificacion || row.created_at || null;
      let isNew = false;
      if (pubDate) {
        try {
          const d = new Date(pubDate);
          if (!isNaN(d.getTime())) {
            const diffDays = (Date.now() - d.getTime()) / (1e3 * 60 * 60 * 24);
            isNew = diffDays >= -1 && diffDays <= 15;
          }
        } catch {
        }
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
      const obs = raw.observations || raw.observacionesGenerales || raw.descripcionEcommerce || void 0;
      return {
        id: row.id,
        name: row.name,
        description: finalDesc,
        observations: obs,
        price: Number(row.price),
        discountPrice: raw.discountPrice ? Number(raw.discountPrice) : void 0,
        discountPercentage: raw.discountPercentage || 0,
        imageUrl: row.image_url,
        images: [row.image_url],
        stock: row.stock,
        separePercentage: isTree ? 30 : 100,
        features: raw.features || [`C\xF3digo: ${row.id}`, `Categor\xEDa: ${category}`, `Subcategor\xEDa: ${subCategory}`],
        dimensions: row.dimensions || `C\xF3digo: ${row.id}`,
        category,
        subCategory,
        color: color || raw.color || "Multicolor",
        height: height || raw.height || "No aplica",
        similarCodes: raw.similarCodes || [],
        publicationDate: pubDate,
        createdAt: row.created_at || pubDate,
        isNew: isNew ?? false,
        videoUrl: row.id === "8050930" ? "/video-8050930.mp4" : row.id === "8050931" ? "/video-8050931.mp4" : raw.videoUrl || void 0
      };
    });
  } catch (e) {
    console.warn("[SUPABASE] Error consultando productos de respaldo:", e);
    return null;
  }
}
async function syncProductsToSupabase(products) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { synced: false, error: "Supabase no configurado en variables de entorno" };
  }
  try {
    const { error: deleteError } = await supabase.from("products").delete().neq("id", "___DELETE_ALL_ENTRIES_NO_MATCH___");
    if (deleteError) {
      console.warn("[SUPABASE SYNC] Advertencia al vaciar tabla 'products':", deleteError.message);
    } else {
      console.log("[SUPABASE SYNC] Tabla 'products' vaciada con \xE9xito para nueva sincronizaci\xF3n limpia.");
    }
    const rows = products.filter((p) => !String(p.id).startsWith("arb-") && !String(p.id).startsWith("dec-")).map((p) => ({
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
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }));
    const batchSize = 50;
    let totalUpserted = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase.from("products").upsert(batch, { onConflict: "id" });
      if (error) {
        console.error(`[SUPABASE SYNC] Error en lote ${i}:`, error.message);
      } else {
        totalUpserted += batch.length;
      }
    }
    logApi("SUCCESS", "SUPABASE_SYNC", `Sincronizados ${totalUpserted} productos en la tabla 'products' de Supabase`);
    return { synced: true, count: totalUpserted };
  } catch (err) {
    logApi("ERROR", "SUPABASE_SYNC", `Fallo al sincronizar con Supabase: ${err.message}`);
    return { synced: false, error: err.message };
  }
}
async function safeFetch(url, options = {}, timeoutMs = 6e4) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return res;
  } catch (err) {
    if (err.name === "AbortError" || err.message?.includes("timeout") || err.code === "UND_ERR_HEADERS_TIMEOUT") {
      throw new Error(`Timeout de conexi\xF3n con Yeminus ERP (${timeoutMs / 1e3}s)`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
async function getAccessToken() {
  const username = process.env.YEMINUS_API_USERNAME || "API";
  const password = process.env.YEMINUS_API_PASSWORD || "sS#wLNW38C$U";
  if (cachedToken && Date.now() < tokenExpiresAt - 6e4) {
    return cachedToken;
  }
  if (cachedRefreshToken && cachedToken) {
    try {
      logApi("INFO", "/gateway/auth/refresh", "Renovando sesi\xF3n con refreshToken...");
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
      }, 1e4);
      if (refreshRes.ok) {
        const refData = await refreshRes.json();
        const newToken = refData.accessToken || refData.access_token;
        if (newToken) {
          cachedToken = newToken;
          if (refData.refreshToken) cachedRefreshToken = refData.refreshToken;
          const expiresInMs = (refData.expiresIn || 1500) * 1e3;
          tokenExpiresAt = Date.now() + expiresInMs;
          logApi("SUCCESS", "/gateway/auth/refresh", "Token de Yeminus renovado con \xE9xito");
          return cachedToken;
        }
      }
    } catch (rErr) {
      console.warn("[AUTH REFRESH WARN] No se pudo renovar token, iniciando login nuevo:", rErr.message);
    }
  }
  const endpoint = "/gateway/auth/login";
  logApi("INFO", endpoint, "Iniciando sesi\xF3n en Yeminus API Gateway...");
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
    }, 15e3);
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error en autenticaci\xF3n (${response.status}): ${errText}`);
    }
    const data = await response.json();
    const token = data.accessToken || data.access_token;
    if (token) {
      cachedToken = token;
      cachedRefreshToken = data.refreshToken || null;
      const expiresInMs = (data.expiresIn || data.expires_in || 1500) * 1e3;
      tokenExpiresAt = Date.now() + expiresInMs;
      logApi("SUCCESS", endpoint, "Sesi\xF3n oficial iniciada con \xE9xito en Yeminus Gateway", null, {
        token_type: data.tokenType || "Bearer",
        expires_in: data.expiresIn || 1500,
        usuario: data.usuario || username
      });
      return cachedToken;
    } else {
      throw new Error("Respuesta no contiene accessToken");
    }
  } catch (error) {
    logApi("ERROR", endpoint, `Fallo al obtener token: ${error.message}`);
    throw error;
  }
}
app.get("/api/yeminus/status", (req, res) => {
  const envCaja = process.env.YEMINUS_ID_CAJA;
  const envPunto = process.env.YEMINUS_PUNTO_VENTA;
  const idCaja = envCaja && envCaja !== "2" && envCaja !== "3" && envCaja !== "7" && envCaja !== "8" ? envCaja : "9";
  const idPuntoVenta = envPunto && envPunto !== "2" && envPunto !== "3" && envPunto !== "9" ? envPunto : "8";
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
    tokenExpiresIn: cachedToken ? Math.max(0, Math.round((tokenExpiresAt - Date.now()) / 1e3)) : 0,
    logs: apiLogs
  });
});
var saldosCache = null;
var SALDOS_CACHE_TTL = 10 * 60 * 1e3;
var SALDOS_BACKUP_PATH = import_path2.default.join(process.cwd(), "saldos_backup.json");
function loadSaldosFromLocalFile() {
  try {
    if (import_fs2.default.existsSync(SALDOS_BACKUP_PATH)) {
      const raw = import_fs2.default.readFileSync(SALDOS_BACKUP_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : parsed.saldos || [];
    }
  } catch (err) {
    console.warn("[SALDOS] Error cargando saldos locales:", err.message);
  }
  return [];
}
function saveSaldosToLocalFile(saldos) {
  try {
    import_fs2.default.writeFileSync(SALDOS_BACKUP_PATH, JSON.stringify({
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      count: saldos.length,
      saldos
    }, null, 2), "utf-8");
    console.log(`[SALDOS] Guardados ${saldos.length} saldos en ${SALDOS_BACKUP_PATH}`);
  } catch (err) {
    console.warn("[SALDOS] Error guardando saldos locales:", err.message);
  }
}
async function fetchYeminusSaldos(options = {}) {
  const d = /* @__PURE__ */ new Date();
  const currentYear = String(d.getFullYear());
  const currentMonth = String(d.getMonth() + 1);
  const { force = false, anio = currentYear, mes = currentMonth, bodegas = ["05"], grupo = "80" } = options;
  if (!force && saldosCache && Date.now() - saldosCache.timestamp < SALDOS_CACHE_TTL) {
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
      "id_caja": "9",
      "usuario": "API",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(body)
  }, 12e4);
  if (!response.ok) {
    const errText = await response.text();
    logApi("ERROR", endpoint, `HTTP ${response.status}: ${errText}`);
    const local = loadSaldosFromLocalFile();
    if (local.length > 0) return local;
    throw new Error(`Error en API de saldos (${response.status}): ${errText}`);
  }
  const data = await response.json();
  const saldos = Array.isArray(data.datos) ? data.datos : [];
  saldosCache = {
    timestamp: Date.now(),
    data: saldos
  };
  saveSaldosToLocalFile(saldos);
  logApi("SUCCESS", endpoint, `Saldos obtenidos exitosamente: ${saldos.length} registros`);
  return saldos;
}
app.get("/api/yeminus/saldos", async (req, res) => {
  try {
    const force = req.query.force === "true";
    const anio = req.query.anio || "2026";
    const mes = req.query.mes || "7";
    const saldos = await fetchYeminusSaldos({ force, anio, mes });
    let sinStock = 0;
    let pocasUnidades = 0;
    let stockNormal = 0;
    let totalUnidades = 0;
    saldos.forEach((s) => {
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
  } catch (error) {
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
var productsCache = null;
var PRODUCTS_CACHE_TTL = 3 * 60 * 1e3;
var INVENTORY_DEDUCTIONS_FILE_PATH = import_path2.default.join(process.cwd(), "data", "inventory_deductions.json");
function loadLocalDeductions() {
  try {
    if (import_fs2.default.existsSync(INVENTORY_DEDUCTIONS_FILE_PATH)) {
      const raw = import_fs2.default.readFileSync(INVENTORY_DEDUCTIONS_FILE_PATH, "utf-8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const cutoff = Date.now() - 72 * 60 * 60 * 1e3;
        return list.filter((d) => d.timestamp > cutoff);
      }
    }
  } catch (e) {
  }
  return [];
}
function saveLocalDeductions(records) {
  try {
    const dir = import_path2.default.dirname(INVENTORY_DEDUCTIONS_FILE_PATH);
    if (!import_fs2.default.existsSync(dir)) import_fs2.default.mkdirSync(dir, { recursive: true });
    import_fs2.default.writeFileSync(INVENTORY_DEDUCTIONS_FILE_PATH, JSON.stringify(records, null, 2), "utf-8");
  } catch (e) {
    console.warn("[DEDUCTIONS FILE SAVE ERR]", e);
  }
}
function getPendingLocalDeduction(code, ref) {
  const deductions = loadLocalDeductions();
  const c = String(code || "").trim().toLowerCase();
  const r = String(ref || "").trim().toLowerCase();
  let total = 0;
  for (const d of deductions) {
    const target = String(d.productId || "").trim().toLowerCase();
    if (c && target === c || r && target === r) {
      total += Number(d.quantity) || 1;
    }
  }
  return total;
}
setInterval(() => {
  fetchYeminusCatalog().catch(() => {
  });
}, 15 * 60 * 1e3);
function classifyChristmasProduct(p) {
  const code = String(p.producto || p.id || p.code || "").trim();
  const gId = String(p.idGrupo || "").trim();
  const gDesc = (p.descripcionGrupo || "").toUpperCase().trim();
  const sgId = String(p.idSubGrupo || p.subGrupo || "").trim();
  const sgDesc = (p.descripcionSubGrupo || p.nomSubgrupo || p.subgrupo || "").toUpperCase().trim();
  const scDesc = (p.descripcionSubCategoria || p.subCategoria || "").toUpperCase().trim();
  const name = (p.descripcionProducto || p.nombre || p.descripcion || p.name || "").trim();
  const ref = (p.referencia || p.reference || "").trim();
  const desc = (name + " " + ref).toLowerCase();
  let category = "Decoraci\xF3n";
  let subCategory = "Figuras y Adornos";
  const isPieDeArbol = desc.includes("pie de arbol") || desc.includes("pie de \xE1rbol");
  const isBaseDeArbol = desc.includes("base ") || desc.includes("base para arbol") || desc.includes("base para \xE1rbol") || desc.includes("base giratoria") || desc.includes("base polyresina") || desc.includes("base poliresina");
  if (code.startsWith("801") || gId === "80" && (sgId === "1" || sgId === "001" || sgId === "01") || sgDesc.includes("ARBOLES") || sgDesc.includes("GUIRNALDAS") || sgDesc.includes("CORONAS") || scDesc.includes("ARBOLES") || scDesc.includes("GUIRNALDAS") || scDesc.includes("CORONAS") || (desc.startsWith("arbol ") || desc.startsWith("\xE1rbol ")) && !desc.includes("instalacion") && !desc.includes("lineal led") && !desc.includes("pie de") && !desc.includes("base ")) {
    category = "\xC1rboles y Guirnaldas";
    if (desc.startsWith("guirnalda") || desc.includes("guirnalda") || scDesc.includes("GUIRNALDA")) {
      subCategory = "Guirnaldas";
    } else if (desc.startsWith("corona") || desc.includes("corona") || scDesc.includes("CORONA")) {
      subCategory = "Coronas";
    } else if (isBaseDeArbol || isPieDeArbol) {
      subCategory = "Accesorios y Bases";
    } else {
      subCategory = "\xC1rboles Navide\xF1os";
    }
  } else if (code.startsWith("802") || gId === "80" && (sgId === "2" || sgId === "002" || sgId === "02") || sgDesc.includes("BOLA") || scDesc.includes("BOLA") || desc.startsWith("bola ") || desc.startsWith("bolas ") || desc.includes("esferas navide\xF1as") || desc.includes("pack bolas")) {
    category = "Bolas Navide\xF1as";
    subCategory = "Bolas y Esferas";
  } else if (code.startsWith("803") || gId === "80" && (sgId === "3" || sgId === "003" || sgId === "03") || sgDesc.includes("CINTA") || sgDesc.includes("MALLA") || scDesc.includes("CINTA") || scDesc.includes("MALLA") || desc.startsWith("cinta ") || desc.startsWith("malla ") || desc.includes("alambrada")) {
    category = "Cintas y Mallas";
    if (desc.includes("malla") || scDesc.includes("MALLA")) {
      subCategory = "Mallas Navide\xF1as";
    } else {
      subCategory = "Cintas Navide\xF1as";
    }
  } else if (code.startsWith("804") || gId === "80" && (sgId === "4" || sgId === "004" || sgId === "04") || sgDesc.includes("FLOR") || sgDesc.includes("FOLLAJE") || scDesc.includes("FLOR") || scDesc.includes("FOLLAJE") || desc.startsWith("flor ") || desc.startsWith("flores ") || desc.startsWith("follaje ") || desc.startsWith("follajes ") || desc.startsWith("rosa artificial") || desc.startsWith("pick ") || desc.includes("pick navide\xF1o") || desc.includes("poinsettia") || desc.includes("ramo navide\xF1o")) {
    category = "Flores y Follaje";
    if (desc.includes("follaje") || desc.includes("pick") || desc.includes("ramo")) {
      subCategory = "Follajes y Ramas";
    } else {
      subCategory = "Flores Navide\xF1as";
    }
  } else if (code.startsWith("807") || gId === "80" && (sgId === "7" || sgId === "007" || sgId === "07") || sgDesc.includes("PESEBRE") || scDesc.includes("PESEBRE") || desc.includes("pesebre") || desc.includes("aldeano") || desc.includes("nacimiento") || desc.includes("sagrada familia") || desc.includes("ni\xF1o dios") || desc.includes("reyes magos") || desc.includes("choza") || desc.includes("establo") || desc.includes("gruta")) {
    category = "Pesebres";
    if (desc.includes("aldeano") || desc.includes("figura") || desc.includes("pastor") || desc.includes("animal")) {
      subCategory = "Figuras para Pesebre";
    } else if (desc.includes("choza") || desc.includes("establo") || desc.includes("gruta")) {
      subCategory = "Chozas y Establos";
    } else {
      subCategory = "Pesebres y Nacimientos";
    }
  } else if (code.startsWith("808") || gId === "80" && (sgId === "8" || sgId === "008" || sgId === "08") || sgDesc.includes("COCINA") || sgDesc.includes("UTENSILIO") || scDesc.includes("COCINA") || scDesc.includes("UTENSILIO") || desc.includes("pocillo") || desc.includes("vajilla") || desc.includes("mug") || desc.includes("plato pet") || desc.includes("plato plastico") || desc.includes("individual flecos") || desc.includes("bolws") || desc.includes("taza navide\xF1a")) {
    category = "Utensilios Navide\xF1os de Cocina";
    subCategory = "Cocina Navide\xF1a";
  } else if (code.startsWith("401") || code.startsWith("403") || code.startsWith("806") || gId === "40" || gId === "80" && (sgId === "6" || sgId === "006" || sgId === "06") || sgDesc.includes("LUCES") || scDesc.includes("LUCES") || desc.includes("instalacion ") || desc.includes("instalaci\xF3n ") || desc.includes("instalacion") || desc.includes("inst. led") || desc.includes("inst.malla") || desc.includes("manguera led") || desc.includes("cinta led") || desc.includes("cortina meteoro") || desc.includes("lluvia bombillo") || desc.includes("lumimax") || desc.includes("microled")) {
    category = "Luces Navide\xF1as";
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
  } else {
    category = "Decoraci\xF3n";
    if (isPieDeArbol) {
      subCategory = "Pies de \xC1rbol";
    } else if (isBaseDeArbol) {
      subCategory = "Bases y Accesorios de \xC1rbol";
    } else if (desc.includes("farol") || desc.includes("portavela") || desc.includes("porta vela")) {
      subCategory = "Faroles y Portavelas";
    } else if (desc.includes("cojin") || desc.includes("coj\xEDn") || desc.includes("camino de mesa") || desc.includes("tapete")) {
      subCategory = "Textiles Navide\xF1os";
    } else if (desc.includes("colgante") || desc.includes("cascabel") || desc.includes("adorno") || desc.includes("campana")) {
      subCategory = "Colgantes y Adornos";
    } else if (desc.includes("ardilla") || desc.includes("oso") || desc.includes("papanoel") || desc.includes("papa noel") || desc.includes("santa") || desc.includes("ciervo") || desc.includes("pinguino") || desc.includes("mu\xF1eco") || desc.includes("carro") || desc.includes("chimenea") || desc.includes("tambor") || desc.includes("buho")) {
      subCategory = "Mu\xF1ecos y Figuras";
    } else {
      subCategory = "Figuras y Adornos";
    }
  }
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
  } else if (desc.includes("champa\xF1a") || desc.includes("champana") || desc.includes("bronce") || desc.includes("ocre") || desc.includes("co\xF1ac")) {
    color = "Champa\xF1a/Bronce";
  } else if (desc.includes("azul") || desc.includes("blue")) {
    color = "Azul";
  }
  let height = "No aplica";
  if (category === "\xC1rboles y Guirnaldas" && subCategory === "\xC1rboles Navide\xF1os") {
    if (desc.includes("120cm") || desc.includes("150cm") || desc.includes("90cm") || desc.includes("60cm") || desc.includes("1.20") || desc.includes("1.50") || desc.includes("120 cm") || desc.includes("150 cm")) {
      height = "Bajo (hasta 1.50m)";
    } else if (desc.includes("180cm") || desc.includes("200cm") || desc.includes("1.80") || desc.includes("2.00") || desc.includes("180 cm") || desc.includes("200 cm")) {
      height = "Mediano (1.80m a 2.00m)";
    } else if (desc.includes("210cm") || desc.includes("225cm") || desc.includes("230cm") || desc.includes("240cm") || desc.includes("250cm") || desc.includes("300cm") || desc.includes("2.10") || desc.includes("2.25") || desc.includes("2.30") || desc.includes("2.40") || desc.includes("2.50") || desc.includes("3.00") || desc.includes("210 cm") || desc.includes("240 cm")) {
      height = "Alto (m\xE1s de 2.10m)";
    } else {
      height = "Mediano (1.80m a 2.00m)";
    }
  }
  return { category, subCategory, color, height };
}
var lastYeminusAuthFailure = 0;
var YEMINUS_AUTH_COOLDOWN = 15 * 60 * 1e3;
async function fetchYeminusCatalog(options = {}) {
  const endpointProductos = "/gateway/apiyeminus/api/general/productos/obtener";
  const idEmpresa = process.env.YEMINUS_ID_EMPRESA || "02";
  const usuario = process.env.YEMINUS_USUARIO || "API";
  if (!options.force && Date.now() - lastYeminusAuthFailure < YEMINUS_AUTH_COOLDOWN) {
    const backup = loadProductsFromLocalFile();
    return backup && backup.length > 0 ? backup : productsCache?.data || [];
  }
  let token;
  try {
    token = await getAccessToken();
  } catch (err) {
    lastYeminusAuthFailure = Date.now();
    const backup = loadProductsFromLocalFile();
    return backup && backup.length > 0 ? backup : productsCache?.data || [];
  }
  const fetchGroupProducts = async (grupo) => {
    const payload = {
      filtroProducto: {
        filtrar: true,
        grupo
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
    }, 9e4).catch((err) => {
      console.warn(`Aviso: Consulta de productos Grupo ${grupo} Yeminus ERP demor\xF3 o fall\xF3:`, err.message);
      return null;
    });
    if (res && res.ok) {
      try {
        const prodData = await res.json();
        if (prodData && prodData.esExitoso && prodData.datos) {
          const prods = Array.isArray(prodData.datos.productos) ? prodData.datos.productos : Array.isArray(prodData.datos) ? prodData.datos : [];
          console.log(`[YEMINUS ERP] Grupo ${grupo} devuelto con \xE9xito: ${prods.length} productos brutos`);
          return prods;
        } else {
          console.warn(`[YEMINUS ERP] Grupo ${grupo} no exitoso o sin datos:`, prodData?.mensaje);
        }
      } catch (e) {
        console.warn(`Error parseando respuesta de Grupo ${grupo}:`, e.message);
      }
    } else {
      console.warn(`[YEMINUS ERP] Respuesta HTTP no exitosa para Grupo ${grupo}: Status ${res?.status}`);
    }
    return [];
  };
  const raw80 = await fetchGroupProducts("80");
  const raw40 = await fetchGroupProducts("40");
  let rawList = [...raw80, ...raw40];
  const fetchGroupSaldos = async (grupo) => {
    const d = /* @__PURE__ */ new Date();
    const payload = {
      filtroProducto: {
        filtrar: true,
        grupo: String(grupo)
      },
      anio: String(d.getFullYear()),
      bodegas: ["05"],
      mes: String(d.getMonth() + 1)
    };
    try {
      const res = await safeFetch(`${YEMINUS_BASE}/gateway/apiyeminus/api/inventarios/saldoporperiodo/obtenersaldoporperiodo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "id_empresa": idEmpresa,
          "id_caja": "9",
          "usuario": usuario,
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      }, 12e4).catch((err) => {
        console.warn(`Aviso: Consulta de saldos Grupo ${grupo} Yeminus ERP demor\xF3 o fall\xF3:`, err.message);
        return null;
      });
      if (res && res.ok) {
        const saldoData = await res.json();
        const items = Array.isArray(saldoData?.datos) ? saldoData.datos : Array.isArray(saldoData) ? saldoData : [];
        console.log(`[YEMINUS SALDOS] Grupo ${grupo} Bodega 05 devuelto con \xE9xito: ${items.length} registros de saldo`);
        return items;
      } else {
        console.warn(`[YEMINUS SALDOS] Respuesta HTTP no exitosa para Grupo ${grupo}: Status ${res?.status}`);
      }
    } catch (err) {
      console.warn(`[YEMINUS SALDOS] Error consultando saldos para Grupo ${grupo}:`, err.message);
    }
    return [];
  };
  const saldos80 = await fetchGroupSaldos("80");
  const saldos40 = await fetchGroupSaldos("40");
  const localSaldos = loadSaldosFromLocalFile();
  const saldosMapByCode = /* @__PURE__ */ new Map();
  if (Array.isArray(localSaldos)) {
    for (const s of localSaldos) {
      const key = String(s.producto || s.referencia || "").trim();
      if (key) saldosMapByCode.set(key, s);
    }
  }
  for (const s of saldos80) {
    const key = String(s.producto || s.referencia || "").trim();
    if (key) saldosMapByCode.set(key, s);
  }
  for (const s of saldos40) {
    const key = String(s.producto || s.referencia || "").trim();
    if (key) saldosMapByCode.set(key, s);
  }
  const rawSaldosList = Array.from(saldosMapByCode.values());
  if (rawSaldosList.length > 0) {
    saveSaldosToLocalFile(rawSaldosList);
  }
  const combinedSaldoMap = /* @__PURE__ */ new Map();
  for (const it of rawSaldosList) {
    const pCode = String(it.producto || "").trim();
    const pRef = String(it.referencia || "").trim();
    const rawQty = Number(it.cantidad !== void 0 ? it.cantidad : it.existencia);
    const validQty = !isNaN(rawQty) ? rawQty : 0;
    if (pCode) combinedSaldoMap.set(pCode, validQty);
    if (pRef) combinedSaldoMap.set(pRef, validQty);
  }
  console.log(`[YEMINUS INVENTARIO] Registros de saldo mapeados en Bodega 05: ${combinedSaldoMap.size}`);
  if (rawList.length === 0) {
    const localBackup = loadProductsFromLocalFile();
    if (localBackup && localBackup.length > 0) {
      console.log(`[YEMINUS CONTINGENCIA] Cargando ${localBackup.length} productos desde respaldo local`);
      return localBackup;
    }
    throw new Error("Yeminus ERP no respondi\xF3 a tiempo y no hay respaldo previo disponible. Por favor reintenta en unos segundos.");
  }
  const mappedProducts = rawList.filter((p) => {
    const isActive = p.estado === "A" || p.estado === void 0;
    if (!isActive) return false;
    const hasPhotoStatus = p.idEstado === 49 || p.idEstado === 2 || p.descripcionEstado === "EN LA TIENDA" || p.descripcionEstado === "CON FOTOS";
    const hasPhotoFile = Boolean(
      p.archivoFoto1 && String(p.archivoFoto1).trim() !== "" && String(p.archivoFoto1).trim() !== "null"
    );
    if (!hasPhotoStatus || !hasPhotoFile) return false;
    const internalCode = String(p.producto || "").trim();
    const ref = String(p.referencia || "").trim();
    const hasSpecificSaldo = combinedSaldoMap.has(internalCode) || combinedSaldoMap.has(ref);
    const yeminusQty = hasSpecificSaldo ? combinedSaldoMap.has(internalCode) ? combinedSaldoMap.get(internalCode) : combinedSaldoMap.get(ref) : 0;
    const localDeduction = getPendingLocalDeduction(internalCode, ref);
    const effectiveStock = Math.max(0, yeminusQty - localDeduction);
    if (!hasSpecificSaldo || effectiveStock <= 0) {
      return false;
    }
    const list8Price = Number(p.precioConImpuesto8) || Number(p.precio8IncluidoIVA) || (Number(p.precioSinImpuesto8) ? Math.round(Number(p.precioSinImpuesto8) * 1.19) : 0) || (Number(p.precio8) ? Math.round(Number(p.precio8) * 1.19) : 0);
    const list1Price = Number(p.precioConImpuesto1) || Number(p.precio1IncluidoIVA) || (Number(p.precioSinImpuesto1) ? Math.round(Number(p.precioSinImpuesto1) * 1.19) : 0) || (Number(p.precio1) ? Math.round(Number(p.precio1) * 1.19) : 0);
    const effectivePrice = list8Price > 0 ? list8Price : list1Price > 0 ? list1Price : 0;
    if (!effectivePrice || effectivePrice <= 0) {
      return false;
    }
    return true;
  }).map((item) => {
    const { category, subCategory, color, height } = classifyChristmasProduct(item);
    const isTree = category === "\xC1rboles y Guirnaldas";
    const rawDesc = (item.descripcionProducto || item.nombre || item.descripcion || `Producto Navide\xF1o ${item.producto}`).trim();
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
    const finalDescription = ecommerceDesc || (obs && obs.length > 5 && obs !== descText ? `${descText}. ${obs}` : descText);
    const list8ItemPrice = Number(item.precioConImpuesto8) || Number(item.precio8IncluidoIVA) || (Number(item.precioSinImpuesto8) ? Math.round(Number(item.precioSinImpuesto8) * 1.19) : 0) || (Number(item.precio8) ? Math.round(Number(item.precio8) * 1.19) : 0);
    const list1ItemPrice = Number(item.precioConImpuesto1) || Number(item.precio1IncluidoIVA) || (Number(item.precioSinImpuesto1) ? Math.round(Number(item.precioSinImpuesto1) * 1.19) : 0) || (Number(item.precio1) ? Math.round(Number(item.precio1) * 1.19) : 0);
    const price = list8ItemPrice > 0 ? list8ItemPrice : list1ItemPrice > 0 ? list1ItemPrice : 0;
    let discountVal = 0;
    if (Number(item.precioDescuento8) > 0) {
      discountVal = Number(item.precioDescuento8);
    } else if (Number(item.porcentajeDescuento) > 0) {
      discountVal = Number(item.porcentajeDescuento);
    } else if (Number(item.precioDescuento1) > 0) {
      discountVal = Number(item.precioDescuento1);
    }
    const discountPercentage = discountVal > 0 ? Math.round(discountVal) : 0;
    const discountPrice = discountPercentage > 0 ? Math.round(price * (1 - discountPercentage / 100)) : void 0;
    const cp = item.camposPersonalizados || {};
    const customFeatures = [];
    if (item.descripcionMarca && item.descripcionMarca !== "--") customFeatures.push(`Marca: ${item.descripcionMarca}`);
    if (cp.ipp_material) customFeatures.push(`Material: ${cp.ipp_material}`);
    if (cp.ipp_color_producto) customFeatures.push(`Color: ${cp.ipp_color_producto}`);
    if (cp.ipp_altura) customFeatures.push(`Altura: ${cp.ipp_altura}`);
    if (cp.ipp_diametro_cm) customFeatures.push(`Di\xE1metro: ${cp.ipp_diametro_cm} cm`);
    if (cp.ipp_color_bombillo) customFeatures.push(`Luz: ${cp.ipp_color_bombillo}`);
    if (cp.ipp_tipo_de_base) customFeatures.push(`Base: ${cp.ipp_tipo_de_base}`);
    if (cp.ipp_fuente_de_energia) customFeatures.push(`Alimentaci\xF3n: ${cp.ipp_fuente_de_energia}`);
    const imageBaseUrl = "https://tienda.impormax.net/gateway/apiyeminus/Recursos/02/imgproductos/";
    const photoName = String(item.archivoFoto1).trim();
    const imageUrl = photoName ? `${imageBaseUrl}${photoName}` : `${imageBaseUrl}${item.producto}.jpg`;
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
    const hasSpecificSaldo = combinedSaldoMap.has(internalCode) || combinedSaldoMap.has(ref);
    const yeminusQty = hasSpecificSaldo ? combinedSaldoMap.has(internalCode) ? combinedSaldoMap.get(internalCode) : combinedSaldoMap.get(ref) : 0;
    const localDeduction = getPendingLocalDeduction(internalCode, ref);
    const finalStock = Math.max(0, yeminusQty - localDeduction);
    const pubDate = item.fechaLogEstado || item.fechaModificacion || item.fechaCreacion || item.publicationDate || item.created_at || null;
    let isNew = false;
    if (pubDate) {
      try {
        const d = new Date(pubDate);
        if (!isNaN(d.getTime())) {
          const diffDays = (Date.now() - d.getTime()) / (1e3 * 60 * 60 * 24);
          isNew = diffDays >= -1 && diffDays <= 15;
        }
      } catch {
      }
    }
    return {
      id: internalCode,
      code: internalCode,
      reference: ref,
      name: descText,
      description: finalDescription,
      observations: obs || ecommerceDesc || void 0,
      price,
      discountPrice,
      discountPercentage,
      imageUrl,
      images: allImages,
      stock: finalStock,
      separePercentage,
      features: [
        `Referencia: ${ref}`,
        `Categor\xEDa: ${category}`,
        `Subcategor\xEDa: ${subCategory}`,
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
      videoUrl: internalCode === "8050930" ? "/video-8050930.mp4" : internalCode === "8050931" ? "/video-8050931.mp4" : void 0
    };
  });
  const validProducts = [...mappedProducts].filter((p) => (p.stock ?? 0) >= 1);
  validProducts.sort((a, b) => {
    const isTreeA = a.category === "\xC1rboles";
    const isTreeB = b.category === "\xC1rboles";
    if (isTreeA && !isTreeB) return -1;
    if (!isTreeA && isTreeB) return 1;
    return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
  });
  productsCache = {
    timestamp: Date.now(),
    data: validProducts
  };
  saveProductsToLocalFile(validProducts);
  syncProductsToSupabase(validProducts).catch((err) => {
    console.warn("[SYNC SUPABASE ASYNC] Error:", err.message);
  });
  logApi("SUCCESS", "SYNC_YEMINUS", `Sincronizados ${validProducts.length} productos con \xE9xito.`);
  return validProducts;
}
app.get("/api/yeminus/products", async (req, res) => {
  const force = req.query.force === "true" || req.query.refresh === "true";
  if (force) {
    try {
      const fresh = await fetchYeminusCatalog({ force: true });
      if (fresh && fresh.length > 0) {
        return res.json(fresh);
      }
    } catch (e) {
      console.warn("[FORCE YEMINUS FETCH WARN]", e.message);
    }
  }
  if (productsCache && Date.now() - productsCache.timestamp < PRODUCTS_CACHE_TTL) {
    return res.json(productsCache.data);
  }
  const localBackup = loadProductsFromLocalFile();
  if (localBackup && localBackup.length > 0) {
    if (!productsCache) {
      productsCache = {
        timestamp: Date.now() - PRODUCTS_CACHE_TTL + 45e3,
        data: localBackup
      };
    }
    fetchYeminusCatalog({ force: true }).catch(() => {
    });
    return res.json(productsCache.data || localBackup);
  }
  const supabaseBackup = await loadProductsFromSupabase();
  if (supabaseBackup && supabaseBackup.length > 0) {
    productsCache = {
      timestamp: Date.now() - PRODUCTS_CACHE_TTL + 45e3,
      data: supabaseBackup
    };
    saveProductsToLocalFile(supabaseBackup);
    fetchYeminusCatalog({ force: true }).catch(() => {
    });
    return res.json(supabaseBackup);
  }
  try {
    const products = await fetchYeminusCatalog({ force: true });
    return res.json(products);
  } catch (error) {
    logApi("ERROR", "GET /api/yeminus/products", `Error consultando Yeminus: ${error.message}`);
    return res.json([]);
  }
});
app.post("/api/products/sync", async (req, res) => {
  logApi("INFO", "POST /api/products/sync", "Disparada sincronizaci\xF3n manual del cat\xE1logo desde Admin...");
  try {
    const products = await fetchYeminusCatalog({ force: true });
    const supabaseResult = await syncProductsToSupabase(products);
    res.json({
      success: true,
      count: products.length,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      supabase: supabaseResult
    });
  } catch (error) {
    logApi("ERROR", "POST /api/products/sync", `Fallo en sincronizaci\xF3n manual: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
app.get("/api/products/backup-status", async (req, res) => {
  const localBackup = loadProductsFromLocalFile();
  let supabaseCount = 0;
  let supabaseConnected = false;
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      const { count, error } = await supabase.from("products").select("*", { count: "exact", head: true });
      if (!error && typeof count === "number") {
        supabaseCount = count;
        supabaseConnected = true;
      }
    } catch (e) {
      console.warn("Error verificando Supabase:", e);
    }
  }
  let fileMeta = {};
  try {
    if (import_fs2.default.existsSync(BACKUP_FILE_PATH)) {
      const stat = import_fs2.default.statSync(BACKUP_FILE_PATH);
      fileMeta = {
        sizeBytes: stat.size,
        modifiedAt: stat.mtime.toISOString()
      };
    }
  } catch (e) {
  }
  res.json({
    inMemoryCount: productsCache?.data?.length || 0,
    localFileCount: localBackup?.length || 0,
    localFileMeta: fileMeta,
    supabaseConnected,
    supabaseCount,
    lastMemorySync: productsCache ? new Date(productsCache.timestamp).toISOString() : null
  });
});
app.get("/api/inventory/status", (req, res) => {
  const currentCatalog = productsCache?.data || loadProductsFromLocalFile() || [];
  const deductions = loadLocalDeductions();
  let lowStockCount = 0;
  let normalStockCount = 0;
  const lowStockItems = [];
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
app.post("/api/inventory/sync-now", async (req, res) => {
  try {
    console.log("[INVENTORY SYNC NOW] Solicitud manual de sincronizaci\xF3n completa...");
    const products = await fetchYeminusCatalog({ force: true });
    res.json({
      success: true,
      message: "Cat\xE1logo e inventario sincronizados exitosamente con Yeminus ERP",
      count: products.length,
      sampleItems: products.slice(0, 10).map((p) => ({
        id: p.id,
        reference: p.reference,
        name: p.name,
        stock: p.stock
      }))
    });
  } catch (err) {
    console.error("[INVENTORY SYNC NOW] Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/products/export-backup", (req, res) => {
  const localBackup = loadProductsFromLocalFile();
  const dataToExport = localBackup || productsCache?.data || [];
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", 'attachment; filename="impormax_catalogo_respaldo_590.json"');
  res.send(JSON.stringify(dataToExport, null, 2));
});
app.post("/api/customers/check-first-order", async (req, res) => {
  const { document, email, phone } = req.body;
  const cleanDoc = String(document || "").replace(/\D/g, "").trim();
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanPhone = String(phone || "").replace(/\D/g, "").trim();
  if (!cleanDoc && !cleanEmail && !cleanPhone) {
    return res.json({
      isFirstOrder: true,
      discountPercent: 10,
      discountCode: "PRIMERACOMPRA10",
      message: "\xA1Aplica 10% de descuento adicional en tu primer pedido sobre el total del carrito!"
    });
  }
  try {
    let orderCount = 0;
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
          cleanEmail,
          cleanEmail,
          cleanPhone,
          cleanPhone
        );
        if (sqliteCheck && sqliteCheck.cnt > 0) {
          orderCount += Number(sqliteCheck.cnt) || 0;
        }
      } catch (sqlErr) {
        console.warn("[CHECK FIRST ORDER SQLITE WARN]", sqlErr.message);
      }
    } else if (cleanEmail && cleanEmail.includes("@")) {
      try {
        const sqliteCheck = db.prepare(`
          SELECT COUNT(*) as cnt FROM orders 
          WHERE lower(customer_email) = ?
            AND status IN ('pagado', 'abonando', 'approved', 'aprobado', 'delivered')
            AND (paid_amount > 0 OR initial_payment > 0)
        `).get(cleanEmail);
        if (sqliteCheck && sqliteCheck.cnt > 0) {
          orderCount += Number(sqliteCheck.cnt) || 0;
        }
      } catch (sqlErr) {
        console.warn("[CHECK FIRST ORDER SQLITE WARN]", sqlErr.message);
      }
    }
    const hasValidIdentifier = cleanDoc && cleanDoc !== "222222222" && cleanDoc.length >= 5 || cleanEmail && cleanEmail.includes("@") || cleanPhone && cleanPhone.length >= 7;
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
            const confirmed = pastOrders.filter(
              (po) => ["pagado", "abonando", "aprobado"].includes(String(po.estado || "").toLowerCase()) || Number(po.abonado) > 0
            );
            orderCount += confirmed.length;
          }
        } catch (sbErr) {
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
      message: isFirstOrder ? "\xA1Excelente! Este es tu primer pedido en la tienda: tienes 10% de descuento sobre el total de tu compra." : "Has realizado compras previas con nosotros. Tu pedido se procesar\xE1 con los precios regulares y ofertas vigentes."
    });
  } catch (error) {
    console.warn("Error al verificar primera compra:", error.message);
    res.json({
      isFirstOrder: true,
      discountPercent: 10,
      discountCode: "PRIMERACOMPRA10",
      message: "\xA1Aplica 10% de descuento adicional en tu primer pedido!"
    });
  }
});
app.post("/api/yeminus/client/create", async (req, res) => {
  const endpoint = "/gateway/apiyeminus/api/general/terceros/agregar";
  const idEmpresa = process.env.YEMINUS_ID_EMPRESA || "02";
  const usuario = process.env.YEMINUS_USUARIO || "API";
  logApi("INFO", "POST /api/yeminus/client/create", "Solicitando creaci\xF3n de Tercero en Yeminus...", req.body);
  try {
    const token = await getAccessToken();
    const { doc, first_name, second_name, last_name, second_last_name, email, phone, address, city } = req.body;
    const cleanDoc = String(doc).replace(/\D/g, "");
    const safeNit = parseInt(cleanDoc) || 99999999;
    const safeEmail = email && email.includes("@") ? email : "correo@impormax.net";
    const { daneCode: daneCityCode, cityName: daneCityName } = resolveCityToDaneCode(city, address);
    const isCompany = safeNit > 8e8 && safeNit < 999999999;
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
        descripcion: isCompany ? `${first_name} ${last_name}`.trim().toUpperCase() : `${last_name} ${second_last_name || ""} ${first_name} ${second_name || ""}`.replace(/\s+/g, " ").trim().toUpperCase(),
        nombreComercial: `${first_name} ${second_name || ""} ${last_name} ${second_last_name || ""}`.replace(/\s+/g, " ").trim().toUpperCase(),
        clase: "C",
        // Cliente
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
        naturalezaJuridica,
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
    }, 15e3);
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Fallo del ERP (${response.status}): ${errText}`);
    }
    const resData = await response.json();
    if (resData.esExitoso) {
      logApi("SUCCESS", "POST /api/yeminus/client/create", "Cliente registrado con \xE9xito en Yeminus", payload, resData);
      res.json({ success: true, nit: resData.datos });
    } else {
      logApi("INFO", "POST /api/yeminus/client/create", `El ERP retorn\xF3 un mensaje: ${resData.mensaje}. Probablemente el tercero ya existe.`);
      res.json({ success: true, alreadyExists: true, message: resData.mensaje });
    }
  } catch (error) {
    logApi("ERROR", "POST /api/yeminus/client/create", `Error al crear tercero: ${error.message}. Procediendo con simulaci\xF3n local.`);
    res.json({ success: false, error: error.message });
  }
});
function getFormaPagoYeminus(paymentMethod) {
  if (!paymentMethod) return "11";
  const pm = paymentMethod.toLowerCase();
  if (pm.includes("wompi")) return "05";
  if (pm.includes("pse")) return "11";
  if (pm.includes("nequi")) return "04";
  if (pm.includes("bre") || pm.includes("llave")) return "01";
  if (pm.includes("transferencia") || pm.includes("banco")) return "01";
  if (pm.includes("tarjeta")) return "02";
  return "11";
}
async function saveOrderMirrorToSupabase(orderData) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { success: false, error: "Supabase no configurado" };
  try {
    const pedidoUuid = import_crypto.default.randomUUID();
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
    const estado = remaining <= 0 ? "pagado" : dep > 0 ? "abonando" : "pendiente";
    const { data: insertedPedido, error: pError } = await supabase.from("pedidos").insert([{
      id: pedidoUuid,
      cliente_nombre: orderData.customer_name || "Cliente Impormax",
      cliente_email: orderData.customer_email || "cliente@impormax.net",
      cliente_telefono: String(orderData.customer_phone || ""),
      cliente_documento: cleanCustomerDoc,
      direccion_envio: cleanShippingAddress,
      ciudad_envio: cleanShippingCity,
      producto_id: String(orderData.product_id || "NA"),
      producto_name: `${orderData.product_name || "Producto Navide\xF1o"}${metaSuffix}`,
      total: tot,
      abonado: dep,
      restante: remaining,
      estado
    }]).select().single();
    if (pError) {
      console.error("[SUPABASE MIRROR] Error al insertar en pedidos:", pError.message);
      return { success: false, error: pError.message };
    }
    if (orderData.deposit_amount > 0) {
      const { error: payError } = await supabase.from("pagos").insert([{
        id: import_crypto.default.randomUUID(),
        pedido_id: pedidoUuid,
        monto: orderData.deposit_amount,
        referencia_pago: orderData.payment_reference || `Abono Inicial ${orderData.slp_document_id || ""}`.trim(),
        estado_pago: "aprobado",
        metodo_pago: orderData.payment_method || "wompi"
      }]);
      if (payError) {
        console.error("[SUPABASE MIRROR] Error al insertar abono inicial en pagos:", payError.message);
      }
    }
    logApi("SUCCESS", "SUPABASE_MIRROR", `Pedido espejo guardado en Supabase ID ${pedidoUuid} (Ref: ${orderData.slp_document_id})`);
    return { success: true, pedido_id: pedidoUuid };
  } catch (err) {
    console.error("[SUPABASE MIRROR] Excepci\xF3n:", err.message);
    return { success: false, error: err.message };
  }
}
async function savePaymentMirrorToSupabase(paymentData) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { success: false, error: "Supabase no configurado" };
  try {
    let pedidoId = null;
    let currentTotal = 0;
    let currentAbonado = 0;
    if (paymentData.slp_document_id) {
      const { data: found } = await supabase.from("pedidos").select("*").ilike("producto_name", `%${paymentData.slp_document_id}%`).limit(1);
      if (found && found[0]) {
        pedidoId = found[0].id;
        currentTotal = found[0].total || 0;
        currentAbonado = found[0].abonado || 0;
      }
    }
    if (pedidoId) {
      await supabase.from("pagos").insert([{
        id: import_crypto.default.randomUUID(),
        pedido_id: pedidoId,
        monto: paymentData.amount,
        referencia_pago: paymentData.payment_reference || `Abono ${paymentData.slp_document_id || ""}`,
        estado_pago: "aprobado",
        metodo_pago: paymentData.payment_method || "wompi"
      }]);
      const newAbonado = currentAbonado + paymentData.amount;
      const newRestante = Math.max(0, currentTotal - newAbonado);
      const newEstado = newRestante <= 0 ? "pagado" : "abonando";
      await supabase.from("pedidos").update({
        abonado: newAbonado,
        restante: newRestante,
        estado: newEstado
      }).eq("id", pedidoId);
      logApi("SUCCESS", "SUPABASE_PAYMENT_MIRROR", `Pago espejo de $${paymentData.amount} aplicado al pedido ${pedidoId}`);
    }
    return { success: true };
  } catch (err) {
    console.error("[SUPABASE PAYMENT MIRROR] Error:", err.message);
    return { success: false, error: err.message };
  }
}
function consolidateOrderItems(items) {
  const map = /* @__PURE__ */ new Map();
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
function resolveOrderItems(orderData) {
  const totalAmount = Math.max(0, Math.round(Number(orderData.total_amount) || 0));
  if (orderData.items && Array.isArray(orderData.items) && orderData.items.length > 0) {
    const prepared = orderData.items.map((item, idx) => {
      let pId = String(item.product_id || item.id || item.code || "").trim();
      if (!pId || pId === "ONLINE") {
        pId = "8010141";
      }
      const qty = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Number(item.unit_price ?? item.price) || 0;
      const pctDesc = Number(item.discount_percentage || item.porcentajeDescuentoDelPrecio) || 0;
      const valDesc = Number(item.discount_amount || item.valorDescuentoDelPrecio) || 0;
      const rawTot = Number(item.total) || unitPrice * qty;
      const pTot2 = valDesc > 0 && rawTot === unitPrice * qty ? Math.max(1, rawTot - valDesc) : rawTot;
      const sub2 = Math.round(pTot2 / 1.19);
      return {
        producto: pId,
        nombre: item.product_name || item.name || `Producto ${idx + 1}`,
        cantidad: qty,
        precioUnitario: unitPrice,
        precioTotal: pTot2,
        subtotal: sub2,
        iva: pTot2 - sub2,
        porcentajeDescuentoDelPrecio: pctDesc,
        valorDescuentoDelPrecio: valDesc
      };
    });
    return consolidateOrderItems(prepared);
  }
  const cleanName = (orderData.product_name || "Producto Navide\xF1o").replace(/\[Ref:\s*[^\]]+\]/g, "").replace(/\[.*?\]/g, "").trim();
  let prodId = String(orderData.product_id || "").trim();
  if (!prodId || prodId === "ONLINE") {
    try {
      let catalogList = [];
      if (import_fs2.default.existsSync(BACKUP_FILE_PATH)) {
        const raw = import_fs2.default.readFileSync(BACKUP_FILE_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        catalogList = Array.isArray(parsed) ? parsed : parsed.products || [];
      }
      if (catalogList.length > 0) {
        const cleanLower = cleanName.toLowerCase();
        const found = catalogList.find(
          (p) => p.name.toLowerCase() === cleanLower || cleanLower.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(cleanLower) || p.reference && cleanLower.includes(p.reference.toLowerCase())
        );
        if (found) {
          prodId = String(found.id || found.code);
        }
      }
    } catch {
    }
  }
  if (!prodId || prodId === "ONLINE") {
    prodId = "8010141";
  }
  const pTot = totalAmount > 0 ? totalAmount : 1e5;
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
var DANE_CITY_CODES = {
  // Eje Cafetero y Risaralda
  "pereira": "66001",
  "dosquebradas": "66170",
  "santa rosa de cabal": "66682",
  "la virginia": "66400",
  "manizales": "17001",
  "villamaria": "17873",
  "villamar\xEDa": "17873",
  "chinchina": "17174",
  "chinchin\xE1": "17174",
  "la dorada": "17380",
  "armenia": "63001",
  "calarca": "63130",
  "calarc\xE1": "63130",
  "montenegro": "63470",
  "quimbaya": "63594",
  "la tebaida": "63401",
  "circasia": "63190",
  // Bogotá y Cundinamarca
  "bogota": "11001",
  "bogot\xE1": "11001",
  "bogota d.c.": "11001",
  "bogota dc": "11001",
  "chia": "25175",
  "ch\xEDa": "25175",
  "soacha": "25754",
  "zipaquira": "25899",
  "zipaquir\xE1": "25899",
  "facatativa": "25269",
  "facatativ\xE1": "25269",
  "fusagasuga": "25290",
  "fusagasug\xE1": "25290",
  "madrid": "25430",
  "funza": "25286",
  "mosquera": "25473",
  "cajica": "25126",
  "cajic\xE1": "25126",
  "girardot": "25307",
  // Antioquia
  "medellin": "05001",
  "medell\xEDn": "05001",
  "envigado": "05266",
  "itagui": "05360",
  "itag\xFC\xED": "05360",
  "bello": "05088",
  "sabaneta": "05631",
  "rionegro": "05615",
  "la ceja": "05376",
  "marinilla": "05440",
  "copacabana": "05212",
  "girardota": "05308",
  "apartado": "05045",
  "apartad\xF3": "05045",
  // Valle del Cauca
  "cali": "76001",
  "palmira": "76520",
  "yumbo": "76892",
  "jamundi": "76364",
  "jamund\xED": "76364",
  "buga": "76111",
  "guadalajara de buga": "76111",
  "tulua": "76834",
  "tulu\xE1": "76834",
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
  "ci\xE9naga": "47189",
  "valledupar": "20001",
  "monteria": "23001",
  "monter\xEDa": "23001",
  "sincelejo": "70001",
  "riohacha": "44001",
  "maicao": "44430",
  // Santanderes
  "bucaramanga": "68001",
  "floridablanca": "68276",
  "giron": "68307",
  "gir\xF3n": "68307",
  "piedecuesta": "68547",
  "barrancabermeja": "68081",
  "cucuta": "54001",
  "c\xFAcuta": "54001",
  "los patios": "54405",
  "villa del rosario": "54874",
  // Tolima, Huila, Llanos y Sur
  "ibague": "73001",
  "ibagu\xE9": "73001",
  "espinal": "73268",
  "neiva": "41001",
  "pitalito": "41551",
  "villavicencio": "50001",
  "acacias": "50006",
  "pasto": "52001",
  "ipiales": "52356",
  "popayan": "19001",
  "popay\xE1n": "19001",
  "tunja": "15001",
  "sogamoso": "15759",
  "duitama": "15238",
  "yopal": "85001",
  "florencia": "18001",
  "quibdo": "27001",
  "quibd\xF3": "27001"
};
function resolveCityToDaneCode(cityRaw, addressRaw) {
  const normText = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, " ").trim();
  const cStr = String(cityRaw || "").trim();
  const aStr = String(addressRaw || "").trim();
  const numMatch = cStr.match(/\b\d{5}\b/) || aStr.match(/\b\d{5}\b/);
  if (numMatch) {
    const code = numMatch[0];
    const foundEntry = Object.entries(DANE_CITY_CODES).find(([_, d]) => d === code);
    const name = foundEntry ? foundEntry[0].charAt(0).toUpperCase() + foundEntry[0].slice(1) : cStr || "Colombia";
    return { daneCode: code, cityName: name };
  }
  const normCity = normText(cStr);
  const normAddress = normText(aStr);
  if (normCity && !normCity.includes("colombia") && !normCity.includes("entrega")) {
    for (const [cityName, daneCode] of Object.entries(DANE_CITY_CODES)) {
      const cleanKey = normText(cityName);
      if (normCity === cleanKey || normCity.startsWith(cleanKey + " ") || normCity.endsWith(" " + cleanKey) || normCity.includes(cleanKey)) {
        const properName = cityName.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        return { daneCode, cityName: properName };
      }
    }
  }
  if (normAddress) {
    for (const [cityName, daneCode] of Object.entries(DANE_CITY_CODES)) {
      const cleanKey = normText(cityName);
      if (cleanKey.length >= 4) {
        const regex = new RegExp(`(^|\\s)${cleanKey}(\\s|$)`, "i");
        if (regex.test(normAddress)) {
          const properName = cityName.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
          return { daneCode, cityName: properName };
        }
      }
    }
  }
  if (cStr && cStr.length >= 3 && !["colombia", "entrega", "tienda"].includes(normCity)) {
    return { daneCode: "66001", cityName: cStr };
  }
  return { daneCode: "66001", cityName: "Pereira" };
}
function getColombianIsoString(date = /* @__PURE__ */ new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const pad3 = (n) => String(n).padStart(3, "0");
  const utc = date.getTime() + date.getTimezoneOffset() * 6e4;
  const colDate = new Date(utc - 5 * 36e5);
  const yyyy = colDate.getFullYear();
  const MM = pad(colDate.getMonth() + 1);
  const dd = pad(colDate.getDate());
  const hh = pad(colDate.getHours());
  const mm = pad(colDate.getMinutes());
  const ss = pad(colDate.getSeconds());
  const ms = pad3(colDate.getMilliseconds());
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}.${ms}-05:00`;
}
async function ensureYeminusTercero(orderData, token) {
  try {
    const idEmpresa = process.env.YEMINUS_ID_EMPRESA || "02";
    const usuario = process.env.YEMINUS_USUARIO || "API";
    let cleanCustomerDoc = parseInt(String(orderData.customer_document || "").replace(/\D/g, ""));
    if (!cleanCustomerDoc || cleanCustomerDoc < 1e3) {
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
    const safeEmail = orderData.customer_email && orderData.customer_email.includes("@") ? orderData.customer_email : "cliente@impormax.net";
    const safePhone = String(orderData.customer_phone || "3001234567").replace(/\D/g, "") || "3001234567";
    const isCompany = cleanCustomerDoc > 8e8 && cleanCustomerDoc < 999999999;
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
        descripcion: isCompany ? (orderData.customer_name || `${first_name} ${last_name}`).trim().toUpperCase() : `${last_name} ${second_last_name || ""} ${first_name} ${second_name || ""}`.replace(/\s+/g, " ").trim().toUpperCase(),
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
        naturalezaJuridica,
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
    }, 15e3);
    const resData = await res.json().catch(() => ({}));
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
        }, 8e3);
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
          }, 1e4);
          logApi("SUCCESS", "YEMINUS_TERCERO_UPDATED", `Tercero ${cleanCustomerDoc} actualizado en Yeminus con ciudad DANE ${daneCode} (${cityName}) y direcci\xF3n: ${finalAddress}`);
        }
      } catch (modErr) {
        console.warn("[YEMINUS TERCERO MOD WARN]", modErr.message);
      }
      return { success: true, data: resData };
    }
    logApi("SUCCESS", "YEMINUS_TERCERO_CREATED", `Tercero ${cleanCustomerDoc} creado en Yeminus con ciudad DANE ${daneCode} (${cityName}) y direcci\xF3n: ${finalAddress}`);
    return { success: true, data: resData };
  } catch (err) {
    console.warn("[YEMINUS TERCERO EXCEPTION]", err.message);
    return { success: false, error: err.message };
  }
}
async function createYeminusSLPDocument(orderData, token) {
  const envCaja = process.env.YEMINUS_ID_CAJA;
  const idCaja = envCaja && envCaja !== "2" && envCaja !== "3" && envCaja !== "7" && envCaja !== "8" ? envCaja : "9";
  const idEmpresa = process.env.YEMINUS_ID_EMPRESA || "02";
  const usuario = process.env.YEMINUS_USUARIO || "API";
  let cleanCustomerDoc = parseInt(String(orderData.customer_document || "").replace(/\D/g, ""));
  if (!cleanCustomerDoc || cleanCustomerDoc < 1e3) {
    cleanCustomerDoc = 222222222;
  }
  const { daneCode, cityName } = resolveCityToDaneCode(orderData.customer_city || "Pereira", orderData.customer_address);
  const safeDane = String(daneCode || "66001");
  const safeAddress = String(orderData.customer_address || "Cra 7 # 21-42 Pereira Centro").trim();
  const finalAddress = safeAddress.length >= 8 ? safeAddress : `${safeAddress} - Colombia`;
  let resolvedItems = resolveOrderItems(orderData);
  if (!resolvedItems || resolvedItems.length === 0) {
    const pTot = Math.max(1e3, Math.round(Number(orderData.total_amount) || 1e5));
    const sub = Math.round(pTot / 1.19);
    resolvedItems = [{
      producto: "8010141",
      nombre: "Separado Impormax",
      cantidad: 1,
      precioUnitario: pTot,
      precioTotal: pTot,
      subtotal: sub,
      iva: pTot - sub
    }];
  }
  const yeminusItems = resolvedItems.map((item, idx) => ({
    producto: item.producto,
    cantidad: item.cantidad,
    porcentajeImpuesto: 19,
    almacen: "05",
    almacenDestino: "07",
    porcentajeDescuentoDelPrecio: item.porcentajeDescuentoDelPrecio || 0,
    valorDescuentoDelPrecio: item.valorDescuentoDelPrecio || 0,
    precioTotal: item.subtotal,
    valorImpuestoDelPrecio: item.iva,
    precioTotalIncluidoImpuesto: item.precioTotal,
    numeroDePedidoProduccion: 0,
    itemPedidoProduccion: 0
  }));
  const depositVal = Math.round(Number(orderData.deposit_amount) || 0);
  const obsText = (orderData.notes || orderData.observaciones || `PLAN SEPARE IMPORMAX - ${(orderData.customer_name || "").toUpperCase().substring(0, 45)}`).trim();
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  const fechaVencimiento = `${currentYear}-12-31T23:59:59.000-05:00`;
  const payload = {
    documento: {
      tipoDocumento: "SLP",
      prefijo: "SLP",
      numero: 0,
      fechaDocumento: getColombianIsoString(),
      fechaVencimiento,
      codigoTercero1: String(cleanCustomerDoc),
      numeroDeCaja: idCaja,
      numeroDireccionDespacho: 0,
      codigoCiudadDespacho: safeDane,
      direccionDeDespacho: finalAddress,
      codigoVendedor: "01",
      almacenOrigenEncabezado: "05",
      almacenDestinoEncabezado: "07",
      observaciones: obsText,
      numeroPrecioProducto: 8,
      codigoPatronContable: "SLP",
      valorAdicional: depositVal,
      numeroPedido: 0,
      itemPedido: 0,
      numeroCaja: idCaja,
      items: yeminusItems
    },
    actualizarDocOrigen: false,
    desdeCapturaNueva: true
  };
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
  }, 35e3);
  if (response.status === 503) {
    console.warn("[YEMINUS] Rate limit 503 detectado, esperando 3 segundos para reintentar...");
    await new Promise((r) => setTimeout(r, 3e3));
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
    }, 35e3);
  }
  if (!response.ok) {
    const errText = await response.text();
    return { success: false, error: `ERP HTTP ${response.status}: ${errText}` };
  }
  const resData = await response.json();
  if (resData.esExitoso && resData.datos) {
    const doc = resData.datos;
    const docNum = Number(doc.numero || doc);
    const documentId = `SLP-SLP-${docNum}`;
    logApi("SUCCESS", "YEMINUS_SLP_CREATED", `Documento SLP creado en Yeminus (Caja 2): ${documentId}`, payload, resData);
    return {
      success: true,
      document_id: documentId,
      numero: docNum,
      raw: resData
    };
  } else {
    const errDet = resData.infoOperacion?.excepcion?.detalleErrorFiltrado || resData.mensaje || "Error desconocido del ERP";
    logApi("ERROR", "YEMINUS_SLP_REJECTED", `Yeminus rechaz\xF3 el documento SLP: ${errDet}`, payload, resData);
    return { success: false, error: errDet, raw: resData };
  }
}
async function payYeminusSLPDocument(params) {
  try {
    const { numero, valorPagado, token } = params;
    const idEmpresa = process.env.YEMINUS_ID_EMPRESA || "02";
    const usuario = process.env.YEMINUS_USUARIO || "API";
    const now = /* @__PURE__ */ new Date();
    const payload = {
      pagos: [
        {
          valorPagadoSinPropina: valorPagado,
          numeroFactura: numero,
          a\u00F1o: now.getFullYear(),
          mes: now.getMonth() + 1,
          valorPagado,
          fecha: getColombianIsoString(now),
          objFormaPago: {
            formaPago: "11"
          },
          index: 1,
          valorPagadoOriginal: valorPagado,
          tipoTransaccion: "SLP",
          prefijo: "SLP",
          codigoFormaPago: "11",
          caja: "2"
        }
      ]
    };
    const res = await safeFetch(`${YEMINUS_BASE}/gateway/apiyeminus/api/inventarios/documentos/pagarfactura`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "id_empresa": idEmpresa,
        "usuario": usuario,
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    }, 2e4);
    const data = await res.json().catch(() => ({}));
    if (data.esExitoso || data.datos === "ALERT_SUCCESS_SAVE" || data.infoOperacion?.esExitosa) {
      logApi("SUCCESS", "YEMINUS_SLP_PAID", `Documento SLP ${numero} pagado en Caja 2 con \xE9xito: ${valorPagado} COP`, payload, data);
      return { success: true, raw: data };
    } else {
      const err = data.infoOperacion?.excepcion?.detalleErrorFiltrado || data.mensaje || "Error al pagar SLP";
      logApi("INFO", "YEMINUS_SLP_PAY_WARN", `Aviso al pagar SLP ${numero}: ${err}`, payload, data);
      return { success: false, error: err, raw: data };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}
async function contabilizeYeminusSLPDocument(params) {
  try {
    const { numero, token } = params;
    const idEmpresa = process.env.YEMINUS_ID_EMPRESA || "02";
    const usuario = process.env.YEMINUS_USUARIO || "API";
    const payload = {
      tipoDocumento: "SLP",
      prefijo: "SLP",
      numero
    };
    const res = await safeFetch(`${YEMINUS_BASE}/gateway/apiyeminus/api/inventarios/documentos/contabilizardocumento`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "id_empresa": idEmpresa,
        "usuario": usuario,
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    }, 2e4);
    const data = await res.json().catch(() => ({}));
    if (data.esExitoso || data.infoOperacion?.esExitosa) {
      logApi("SUCCESS", "YEMINUS_SLP_CONTABILIZED", `Documento SLP ${numero} contabilizado con \xE9xito`, payload, data);
      return { success: true, raw: data };
    } else {
      const err = data.infoOperacion?.excepcion?.detalleErrorFiltrado || data.mensaje || "Aviso contabilizaci\xF3n";
      logApi("INFO", "YEMINUS_SLP_CONTAB_WARN", `Aviso al contabilizar SLP ${numero}: ${err}`, payload, data);
      return { success: false, error: err, raw: data };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}
async function fetchYeminusExtracto(params) {
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
      cuenta: "280596",
      // Cuenta oficial Separados de Clientes
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
    }, 25e3);
    const data = await res.json().catch(() => ({}));
    if (data.esExitoso && data.datos) {
      return { success: true, datos: data.datos, raw: data };
    } else {
      const err = data.infoOperacion?.excepcion?.detalleErrorFiltrado || data.mensaje || "No se encontr\xF3 extracto";
      return { success: false, error: err, raw: data };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}
var yeminusDocsByReference = /* @__PURE__ */ new Map();
var inFlightYeminusDocumentCreation = /* @__PURE__ */ new Map();
var inFlightWompiConfirmations = /* @__PURE__ */ new Map();
async function createOrSyncYeminusDocument(orderData) {
  const candidateKeys = [
    orderData.wompi_reference,
    orderData.payment_reference,
    orderData.order_id
  ].map((k) => String(k || "").trim()).filter(Boolean);
  const cleanCustomerDoc = String(orderData.customer_document || "").split("-")[0].replace(/\D/g, "") || "816008621";
  const roundedTotal = Math.round(Number(orderData.total_amount) || 0);
  for (const key of candidateKeys) {
    if (yeminusDocsByReference.has(key)) {
      const existingDoc = yeminusDocsByReference.get(key);
      console.log(`[YEMINUS DEDUP] Pedido con clave ${key} ya tiene documento SLP registrado: ${existingDoc}. Se omite duplicaci\xF3n.`);
      for (const k of candidateKeys) yeminusDocsByReference.set(k, existingDoc);
      return {
        success: true,
        document_id: existingDoc,
        numero: Number(existingDoc.replace(/\D/g, "")) || 0,
        already_synced: true
      };
    }
  }
  for (const key of candidateKeys) {
    if (inFlightYeminusDocumentCreation.has(key)) {
      console.log(`[YEMINUS MUTEX] Creaci\xF3n de documento SLP ya en vuelo para clave ${key}. Esperando resoluci\xF3n \xFAnica...`);
      return await inFlightYeminusDocumentCreation.get(key);
    }
  }
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
    } catch {
    }
  }
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
    `).get(cleanCustomerDoc, roundedTotal);
    if (recentSynced && recentSynced.yeminus_document_id) {
      console.log(`[YEMINUS DEDUP] Pedido id\xE9ntico reciente detectado en SQLite para c\xE9dula ${cleanCustomerDoc} (${roundedTotal}): ${recentSynced.yeminus_document_id}.`);
      for (const k of candidateKeys) yeminusDocsByReference.set(k, recentSynced.yeminus_document_id);
      return {
        success: true,
        document_id: recentSynced.yeminus_document_id,
        numero: Number(recentSynced.yeminus_document_id.replace(/\D/g, "")) || 0,
        already_synced: true
      };
    }
  } catch {
  }
  for (const key of candidateKeys) {
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data: dbOrders } = await supabase.from("pedidos").select("id, producto_name, referencia_wompi, documento_yeminus").or(`referencia_wompi.eq.${key},id.eq.${key}`).limit(1);
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
    } catch {
    }
  }
  const primaryKey = candidateKeys[0] || `FP_${cleanCustomerDoc}_${roundedTotal}_${Date.now()}`;
  const keysToLock = candidateKeys.length > 0 ? candidateKeys : [primaryKey];
  let createPromise;
  const runCreation = async () => {
    try {
      const token = await getAccessToken();
      await ensureYeminusTercero(orderData, token);
      const creationRes = await createYeminusSLPDocument(orderData, token);
      if (!creationRes.success || !creationRes.numero) {
        return { success: false, error: creationRes.error || "No se pudo crear el documento SLP en Yeminus", raw: creationRes.raw };
      }
      const docNumero = creationRes.numero;
      const documentId = creationRes.document_id || `SLP-SLP-${docNumero}`;
      for (const k of keysToLock) {
        yeminusDocsByReference.set(k, documentId);
        try {
          db.prepare(`UPDATE orders SET yeminus_document_id = ?, yeminus_sync_status = 'SYNCED', yeminus_last_error = '' WHERE wompi_reference = ? OR id = ?`).run(
            documentId,
            k,
            orderData.order_id || k
          );
        } catch {
        }
      }
      let pagadoExitoso = false;
      let reciboNumero = null;
      const depositAmount = Math.round(Number(orderData.deposit_amount) || 0);
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
            logApi("SUCCESS", "YEMINUS_RLP_RECIBO_CREATED", `Recibo de cartera RLP creado con \xE9xito para ${documentId}: $${depositAmount} COP (${reciboNumero})`, reciboRes);
          }
        } catch (reciboErr) {
          logApi("INFO", "YEMINUS_RLP_RECIBO_WARN", `Aviso registrando recibo RLP para ${documentId}: ${reciboErr.message}`);
        }
        try {
          const payRes = await payYeminusSLPDocument({
            numero: docNumero,
            valorPagado: depositAmount,
            token
          });
          if (payRes.success) pagadoExitoso = true;
        } catch {
        }
      }
      const contRes = await contabilizeYeminusSLPDocument({
        numero: docNumero,
        token
      });
      const contabilizadoExitoso = contRes.success;
      let extractoData = null;
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
    } catch (error) {
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
app.post("/api/yeminus/separados/create", async (req, res) => {
  logApi("INFO", "POST /api/yeminus/separados/create", "Iniciando creaci\xF3n de documento SLP...", req.body);
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
    const cleanDoc = parseInt(String(customer_document).replace(/\D/g, "")) || 12345678;
    const mirrorResult = await saveOrderMirrorToSupabase({
      slp_document_id: documentIdCreated,
      customer_name: customer_name || `Cliente C.C. ${cleanDoc}`,
      customer_email: customer_email || "cliente@impormax.net",
      customer_phone: customer_phone || "",
      customer_document: cleanDoc,
      customer_address: customer_address || req.body.shipping_address || "Cra 7 # 21-42 Pereira Centro",
      customer_city: customer_city || req.body.shipping_city || "Pereira",
      product_id: product_id || "VARIOS",
      product_name: product_name || "Separado Navide\xF1o Impormax",
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
  } catch (error) {
    logApi("ERROR", "POST /api/yeminus/separados/create", `Fallo general: ${error.message}`);
    res.json({ success: false, error: error.message });
  }
});
app.post("/api/yeminus/sync-order/:id", adminAuthMiddleware, async (req, res) => {
  const { id } = req.params;
  const force = req.body?.force === true || req.query?.force === "true";
  const clientOrderData = req.body?.orderData || {};
  try {
    let order = getOrderById(id);
    if (!order) {
      const supabase2 = getSupabaseAdmin();
      if (supabase2) {
        const { data: dbOrder } = await supabase2.from("pedidos").select("*").eq("id", id).maybeSingle();
        if (dbOrder) order = dbOrder;
      }
    }
    if (!order && Object.keys(clientOrderData).length > 0) {
      order = clientOrderData;
    }
    if (!order) {
      return res.status(404).json({ success: false, error: "Pedido no encontrado en base de datos" });
    }
    const currentYeminusDoc = order.yeminus_document_id || order.documento_yeminus || clientOrderData.yeminus_document_id;
    if (!force && currentYeminusDoc && String(currentYeminusDoc).startsWith("SLP-SLP-")) {
      return res.json({
        success: true,
        already_synced: true,
        document_id: currentYeminusDoc,
        message: `El pedido ya se encuentra registrado en Yeminus ERP: ${currentYeminusDoc}.`
      });
    }
    const docMatch = (order.producto_name || clientOrderData.product_name)?.match(/Doc:\s*([^\|\]]+)/);
    const dirMatch = (order.producto_name || clientOrderData.product_name)?.match(/Dir:\s*([^\|\]]+)/);
    const cityMatch = (order.producto_name || clientOrderData.product_name)?.match(/Ciudad:\s*([^\|\]]+)/);
    const customerDoc = String(
      clientOrderData.customer_document || order.customer_document || order.cliente_documento || (docMatch ? docMatch[1].trim() : "") || "222222222"
    ).trim();
    const customerName = clientOrderData.customer_name || order.customer_name || order.cliente_nombre || "Cliente Impormax";
    const customerEmail = clientOrderData.customer_email || order.customer_email || order.cliente_email || "";
    const customerPhone = clientOrderData.customer_phone || order.customer_phone || order.cliente_telefono || "";
    const shippingAddress = clientOrderData.shipping_address || order.shipping_address || order.cliente_direccion || (dirMatch ? dirMatch[1].trim() : "") || "Cra 7 # 21-42 Pereira Centro";
    const shippingCity = clientOrderData.shipping_city || order.shipping_city || order.cliente_ciudad || (cityMatch ? cityMatch[1].trim() : "") || "Pereira";
    const totalAmt = Number(
      clientOrderData.total_amount ?? order.total ?? order.total_amount ?? 0
    );
    const paidAmt = Number(
      clientOrderData.paid_amount ?? order.paid_amount ?? order.abonado ?? order.deposit_amount ?? 0
    );
    const itemsToSync = Array.isArray(clientOrderData.items) && clientOrderData.items.length > 0 ? clientOrderData.items : Array.isArray(order.items) && order.items.length > 0 ? order.items : [];
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
      product_name: itemsToSync[0]?.product_name || clientOrderData.product_name || order.product_name || order.producto_name || "Producto Navide\xF1o",
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
      } catch {
      }
      return res.status(400).json({
        success: false,
        error: errMsg,
        message: errMsg
      });
    }
    try {
      db.prepare(`UPDATE orders SET yeminus_document_id = ?, yeminus_sync_status = 'SYNCED', yeminus_last_error = '' WHERE id = ?`).run(
        yeminusRes.document_id,
        id
      );
    } catch {
    }
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const cleanName = (order.producto_name || clientOrderData.product_name || order.product_name || "Pedido Navide\xF1o Impormax").replace(/\[Ref:\s*[^\]]+\]/g, "").trim();
        await supabase.from("pedidos").update({
          documento_yeminus: yeminusRes.document_id,
          producto_name: `${cleanName} [Ref: ${yeminusRes.document_id}]`
        }).eq("id", id);
      } catch (sbErr) {
        console.warn("[SUPABASE ORDER UPDATE WARN]", sbErr.message);
      }
    }
    deductLocalInventory(
      itemsToSync.map((it) => ({
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
      message: `\u2713 Pedido sincronizado exitosamente con Yeminus (Sucursal 02, Caja 9, Punto 8): ${yeminusRes.document_id}`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, message: err.message });
  }
});
app.post("/api/yeminus/sync-all-pending", adminAuthMiddleware, async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const force = req.body?.force === true || req.query?.force === "true";
    const onlyApproved = req.body?.onlyApproved === true || req.body?.filter === "approved" || req.query?.filter === "approved";
    const clientOrders = Array.isArray(req.body?.orders) ? req.body.orders : [];
    let targetPedidos = [];
    if (supabase) {
      const { data: pedidos } = await supabase.from("pedidos").select("*").order("created_at", { ascending: true });
      if (pedidos && pedidos.length > 0) {
        targetPedidos = [...pedidos];
      }
    }
    if (clientOrders.length > 0) {
      for (const co of clientOrders) {
        const exists = targetPedidos.some((p) => String(p.id).trim() === String(co.id).trim());
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
      targetPedidos = targetPedidos.filter((p) => Number(p.abonado) > 0 || p.estado === "pagado" || p.estado === "abonando");
    }
    const results = [];
    for (const pedido of targetPedidos) {
      const totalAmount = Number(pedido.total || pedido.total_amount || 0);
      if (totalAmount <= 0) continue;
      const prodName = pedido.producto_name || pedido.product_name || "";
      const resolvedItems = resolveOrderItems({
        product_id: pedido.producto_id || pedido.product_id,
        product_name: prodName,
        total_amount: totalAmount,
        items: pedido.items
      });
      const existingRadicado = pedido.yeminus_document_id && pedido.yeminus_document_id.startsWith("SLP-") ? pedido.yeminus_document_id : pedido.documento_yeminus && pedido.documento_yeminus.startsWith("SLP-") ? pedido.documento_yeminus : prodName.match(/SLP-SLP-\d+/)?.[0] || (prodName.includes("SLP-SLP-") ? "SLP-SLP" : null);
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
      await new Promise((r) => setTimeout(r, 1500));
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
        const cleanProductName = prodName.replace(/\[Ref:\s*[^\]]+\]/g, "").trim();
        const updatedProductName = `${cleanProductName} [Ref: ${yeminusRes.document_id}]`;
        if (supabase) {
          await supabase.from("pedidos").update({ producto_name: updatedProductName }).eq("id", pedido.id);
        }
        deductLocalInventory(
          resolvedItems.map((it) => ({
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
    const syncedCount = results.filter((r) => r.success).length;
    res.json({
      success: true,
      total_orders: targetPedidos.length,
      synced_count: syncedCount,
      configured: {
        id_empresa: "02",
        id_sucursal: "02",
        id_punto_venta: "8",
        id_caja: "9"
      },
      results
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/orders/approve-payment", async (req, res) => {
  const { paymentId, orderId, orderData: clientOrderData, amount: clientAmount } = req.body;
  try {
    const supabase = getSupabaseAdmin();
    let updatedOrderId = orderId;
    let paymentAmount = clientAmount || 0;
    if (supabase && paymentId) {
      const { data: payData } = await supabase.from("pagos").select("*").eq("id", paymentId).maybeSingle();
      if (payData) {
        updatedOrderId = payData.pedido_id || orderId;
        paymentAmount = Number(payData.monto) || paymentAmount;
        await supabase.from("pagos").update({ estado_pago: "aprobado" }).eq("id", paymentId);
      }
    }
    let orderToSync = clientOrderData;
    if (supabase && updatedOrderId && !orderToSync) {
      const { data: dbOrder } = await supabase.from("pedidos").select("*").eq("id", updatedOrderId).maybeSingle();
      if (dbOrder) orderToSync = dbOrder;
    }
    let yeminusSyncResult = null;
    let newPaid = 0;
    let totalOrd = 0;
    if (orderToSync) {
      const currentPaid = Number(orderToSync.paid_amount || orderToSync.abonado || 0);
      totalOrd = Number(orderToSync.total_amount || orderToSync.total || 0);
      const incAmount = paymentAmount > 0 ? paymentAmount : Number(orderToSync.deposit_amount || 0);
      newPaid = currentPaid > 0 && currentPaid >= incAmount ? currentPaid : currentPaid + incAmount;
      const remaining = Math.max(0, totalOrd - newPaid);
      const newStatus = remaining <= 0 ? "pagado" : "abonando";
      const currentProdName = orderToSync.product_name || orderToSync.producto_name || "";
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
          const resolvedItems = resolveOrderItems({
            product_id: orderToSync.product_id || orderToSync.producto_id,
            product_name: currentProdName,
            total_amount: totalOrd,
            items: orderToSync.items
          });
          deductLocalInventory(resolvedItems.map((it) => ({
            product_id: it.producto,
            quantity: it.cantidad,
            product_name: it.nombre
          })), syncRes.document_id);
        }
      }
      if (supabase && (updatedOrderId || orderToSync.id)) {
        await supabase.from("pedidos").update({
          abonado: newPaid,
          restante: remaining,
          estado: newStatus,
          producto_name: orderToSync.producto_name || orderToSync.product_name
        }).eq("id", updatedOrderId || orderToSync.id);
      }
    }
    res.json({
      success: true,
      order_id: updatedOrderId,
      yeminus_document_id: yeminusSyncResult,
      message: "Pago aprobado con \xE9xito" + (yeminusSyncResult ? ` y registrado en Yeminus ERP: ${yeminusSyncResult}` : "")
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/orders/approve-order", adminAuthMiddleware, async (req, res) => {
  const { orderId, orderData: clientOrderData } = req.body;
  try {
    let orderToSync = getOrderById(orderId);
    if (!orderToSync && clientOrderData) orderToSync = clientOrderData;
    if (!orderToSync) {
      const supabase2 = getSupabaseAdmin();
      if (supabase2 && orderId) {
        const { data: dbOrder } = await supabase2.from("pedidos").select("*").eq("id", orderId).maybeSingle();
        if (dbOrder) orderToSync = dbOrder;
      }
    }
    if (!orderToSync) {
      return res.status(404).json({ success: false, error: "Pedido no encontrado" });
    }
    let yeminusSyncResult = null;
    const totalOrd = Number(orderToSync.total_amount || orderToSync.total || 0);
    const depositOrd = Number(orderToSync.paid_amount || orderToSync.abonado || orderToSync.deposit_amount || 0);
    const newPaid = depositOrd > 0 ? depositOrd : Math.round(totalOrd * 0.3);
    const remaining = Math.max(0, totalOrd - newPaid);
    const newStatus = remaining <= 0 ? "pagado" : "abonando";
    const itemsToSync = orderToSync.items && orderToSync.items.length > 0 ? orderToSync.items : [];
    if (!orderToSync.yeminus_document_id) {
      const syncRes = await createOrSyncYeminusDocument({
        customer_document: orderToSync.customer_document || "222222222",
        customer_name: orderToSync.customer_name || orderToSync.cliente_nombre || "Cliente Impormax",
        customer_email: orderToSync.customer_email || orderToSync.cliente_email,
        customer_phone: orderToSync.customer_phone || orderToSync.cliente_telefono,
        customer_address: orderToSync.shipping_address || "Pereira - Risaralda",
        customer_city: orderToSync.shipping_city || "Pereira",
        product_id: itemsToSync[0]?.product_id || (orderToSync.producto_id !== "ONLINE" ? orderToSync.producto_id : "") || "",
        product_name: itemsToSync[0]?.product_name || orderToSync.product_name || "Producto Navide\xF1o",
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
        deductLocalInventory(itemsToSync.map((it) => ({
          product_id: it.product_id,
          quantity: it.quantity || 1,
          product_name: it.product_name
        })), syncRes.document_id);
      } else {
        db.prepare(`UPDATE orders SET yeminus_sync_status = 'ERP_SYNC_FAILED', yeminus_last_error = ? WHERE id = ?`).run(syncRes.error || "Error ERP", orderId || orderToSync.id);
      }
    }
    db.prepare(`UPDATE orders SET paid_amount = ?, balance = ?, status = ? WHERE id = ?`).run(newPaid, remaining, newStatus, orderId || orderToSync.id);
    const supabase = getSupabaseAdmin();
    if (supabase && (orderId || orderToSync.id)) {
      try {
        await supabase.from("pedidos").update({
          abonado: newPaid,
          restante: remaining,
          estado: newStatus
        }).eq("id", orderId || orderToSync.id);
      } catch {
      }
    }
    res.json({
      success: true,
      order_id: orderId || orderToSync.id,
      yeminus_document_id: yeminusSyncResult,
      message: `\u2713 Pedido aprobado exitosamente` + (yeminusSyncResult ? ` y radicado en Yeminus ERP: ${yeminusSyncResult}` : "")
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
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
      return res.status(400).json({ success: false, error: "El n\xFAmero de documento / c\xE9dula es obligatorio" });
    }
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return res.status(400).json({ success: false, error: "El correo electr\xF3nico es obligatorio y debe ser v\xE1lido" });
    }
    if (!cleanPhone) {
      return res.status(400).json({ success: false, error: "El n\xFAmero de tel\xE9fono o celular es obligatorio" });
    }
    if (!cleanAddress) {
      return res.status(400).json({ success: false, error: "La direcci\xF3n de entrega o residencia es obligatoria" });
    }
    if (!cleanCity) {
      return res.status(400).json({ success: false, error: "La ciudad de entrega o residencia es obligatoria" });
    }
    const isUuid = (str) => typeof str === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
    const orderId = req.body.id && isUuid(req.body.id) ? req.body.id : import_crypto.default.randomUUID();
    const orderTotal = Math.round(Number(total_amount) || 0);
    const initialDeposit = Math.round(Number(deposit_amount) || orderTotal);
    const ref = wompi_reference || payment_reference || `REF-${Date.now()}`;
    const orderStatus = status || (initialDeposit >= orderTotal ? "pagado" : initialDeposit > 0 ? "abonando" : "pendiente");
    const remainingBalance = Math.max(0, orderTotal - initialDeposit);
    let itemsToSave = [];
    if (Array.isArray(items) && items.length > 0) {
      itemsToSave = items.map((it) => {
        const cat = findInCatalog(it.product_id, it.product_name, Number(it.total || it.unit_price || it.price));
        const pId = (cat ? cat.id : it.product_id && it.product_id !== "ONLINE" ? it.product_id : it.product_reference && it.product_reference !== "ONLINE" ? it.product_reference : "8010141").trim();
        const pRef = (cat ? cat.reference || cat.id : it.product_reference && it.product_reference !== "ONLINE" ? it.product_reference : pId).trim();
        const pName = (cat ? cat.name : String(it.product_name || "Producto Navide\xF1o")).trim();
        const qty = Math.max(1, Number(it.quantity) || 1);
        const unitPrice = Math.round(Number(it.unit_price ?? it.price) || (cat ? Number(cat.discountPrice || cat.price) : 0));
        const tot = Math.round(Number(it.total) || unitPrice * qty);
        const sub = Math.round(Number(it.subtotal) || tot);
        const tax = Math.round(sub - sub / 1.19);
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
      paid_amount: orderStatus === "pagado" || orderStatus === "abonando" ? initialDeposit : 0,
      balance: orderStatus === "pagado" || orderStatus === "abonando" ? remainingBalance : orderTotal,
      status: orderStatus,
      wompi_reference: ref,
      wompi_transaction_id: req.body.wompi_transaction_id || "",
      yeminus_document_id: "",
      yeminus_sync_status: "PENDING",
      yeminus_last_error: ""
    }, itemsToSave);
    if (initialDeposit > 0 && (orderStatus === "pagado" || orderStatus === "abonando")) {
      savePayment({
        id: import_crypto.default.randomUUID(),
        order_id: orderId,
        amount: initialDeposit,
        payment_reference: ref,
        transaction_id: ref,
        payment_method: (payment_method || "WOMPI").toUpperCase(),
        status: "APPROVED",
        raw_data: JSON.stringify(req.body),
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
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
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const prodSummaryName = itemsToSave.map((it) => `${it.quantity}x ${it.product_name}`).join(", ") || "Pedido Navide\xF1o Impormax";
        const metaParts = [];
        if (cleanDoc) metaParts.push(`Doc: ${cleanDoc}`);
        if (cleanAddress) metaParts.push(`Dir: ${cleanAddress}`);
        if (cleanCity) metaParts.push(`Ciudad: ${cleanCity}`);
        if (cleanNotes) metaParts.push(`Obs: ${cleanNotes}`);
        const metaSuffix = metaParts.length > 0 ? ` [${metaParts.join(" | ")}]` : "";
        const fullSupabasePayload = {
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
          producto_id: itemsToSave.map((it) => it.product_id).join(", ") || "8010141",
          producto_name: `${prodSummaryName}${metaSuffix}`,
          total: orderTotal,
          abonado: orderStatus === "pagado" || orderStatus === "abonando" ? initialDeposit : 0,
          restante: orderStatus === "pagado" || orderStatus === "abonando" ? remainingBalance : orderTotal,
          estado: orderStatus
        };
        const { error: insErr } = await supabase.from("pedidos").insert([fullSupabasePayload]);
        if (insErr) {
          const { observaciones: _obs, ...payloadWithoutObs } = fullSupabasePayload;
          const { error: insErr2 } = await supabase.from("pedidos").insert([payloadWithoutObs]);
          if (insErr2) {
            await supabase.from("pedidos").insert([{
              id: orderId,
              cliente_nombre: cleanName,
              cliente_email: cleanEmail,
              cliente_telefono: cleanPhone,
              producto_id: itemsToSave.map((it) => it.product_id).join(", ") || "8010141",
              producto_name: `${prodSummaryName}${metaSuffix}`,
              total: orderTotal,
              abonado: orderStatus === "pagado" || orderStatus === "abonando" ? initialDeposit : 0,
              restante: orderStatus === "pagado" || orderStatus === "abonando" ? remainingBalance : orderTotal,
              estado: orderStatus
            }]);
          }
        }
      } catch (sbErr) {
        console.warn("[POST /api/orders SB WARN]", sbErr.message);
      }
    }
    logApi("SUCCESS", "POST /api/orders", `Pedido creado y guardado: ${orderId} (${orderStatus}) con ${itemsToSave.length} art\xEDculos.`);
    res.json({
      success: true,
      order: savedOrder,
      message: "Pedido guardado con \xE9xito en todas las tablas del sistema."
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/orders/save-mirror", async (req, res) => {
  try {
    const result = await saveOrderMirrorToSupabase(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
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
      } catch {
      }
    }
    res.json({ success: true, message: "Pedidos y pagos de prueba eliminados correctamente." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
async function registerYeminusAbonoInternal(data) {
  const endpoint = "/gateway/cuentasporcobrar/carteraclientes/agregarecibo";
  const idEmpresa = process.env.YEMINUS_ID_EMPRESA || "02";
  const usuario = process.env.YEMINUS_USUARIO || "API";
  const envCaja = process.env.YEMINUS_ID_CAJA;
  const idCaja = envCaja && envCaja !== "2" && envCaja !== "3" && envCaja !== "7" && envCaja !== "8" ? envCaja : "9";
  const idSucursal = "02";
  const envPunto = process.env.YEMINUS_PUNTO_VENTA;
  const idPuntoVenta = envPunto && envPunto !== "2" && envPunto !== "3" && envPunto !== "9" ? envPunto : "8";
  const { customer_document, amount, payment_method, payment_reference } = data;
  let slp_document_id = data.slp_document_id;
  if (!slp_document_id && data.order_id) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data: ord } = await supabase.from("pedidos").select("producto_name").eq("id", data.order_id).single();
      if (ord && ord.producto_name) {
        const m = ord.producto_name.match(/\[Ref:\s*([^\]]+)\]/i);
        if (m && m[1]) slp_document_id = m[1].trim();
      }
    }
  }
  const cleanCustomerDoc = parseInt(String(customer_document).replace(/\D/g, "")) || 99999999;
  const formaPagoCodigo = getFormaPagoYeminus(payment_method);
  const sucursalNum = parseInt(idSucursal) || 2;
  const puntoVentaNum = parseInt(idPuntoVenta) || 8;
  const payload = {
    numero: 0,
    prefijo: "RCP",
    nitCliente: cleanCustomerDoc,
    sucursal: sucursalNum,
    codigoSucursal: sucursalNum,
    puntoDeVenta: puntoVentaNum,
    codigoPuntoDeVenta: puntoVentaNum,
    fecha: (/* @__PURE__ */ new Date()).toISOString(),
    descripcion: `ABONO PLAN SEPARE REF: ${slp_document_id || payment_reference} VIA ${(payment_method || "WOMPI").toUpperCase()}`,
    tipoDocumento: "RLP",
    valor: amount,
    valorNoAplicado: amount,
    formaPago: formaPagoCodigo,
    formaPagoId: formaPagoCodigo,
    claseRecibo: "O",
    cuentaOtrosIngresos: "280596",
    documentoReferenciaCuenta: slp_document_id || "SLP-SLP-1",
    caja: idCaja,
    usuario
  };
  const token = await getAccessToken();
  const response = await fetch(`${YEMINUS_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "id_empresa": idEmpresa,
      "id_sucursal": "02",
      "id_punto_venta": String(idPuntoVenta),
      "id_caja": String(idCaja),
      "usuario": usuario,
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Fallo del ERP al registrar abono (${response.status}): ${errText}`);
  }
  const resData = await response.json();
  if (resData.esExitoso) {
    savePaymentMirrorToSupabase({
      slp_document_id: slp_document_id || "SLP-SLP-1",
      customer_document: cleanCustomerDoc,
      amount,
      payment_method: payment_method || "wompi",
      payment_reference: `RLP-${resData.datos?.numero || Date.now()}`
    }).catch((e) => console.warn("[SUPABASE MIRROR PAY] Error:", e.message));
    return resData;
  } else {
    throw new Error(resData.mensaje || "Error al aplicar el pago en Yeminus");
  }
}
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
  } catch (error) {
    logApi("ERROR", "POST /api/yeminus/separados/pagar", `Fallo al registrar pago en Yeminus: ${error.message}.`);
    if (req.body.amount && req.body.slp_document_id) {
      savePaymentMirrorToSupabase({
        slp_document_id: req.body.slp_document_id,
        customer_document: req.body.customer_document,
        amount: req.body.amount,
        payment_method: req.body.payment_method || "wompi",
        payment_reference: `CONT-${Date.now()}`
      }).catch(() => {
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});
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
      cuenta: "280596",
      // Cuenta plan separe
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
    const resData = await response.json();
    if (resData.esExitoso && resData.datos) {
      logApi("SUCCESS", "POST /api/yeminus/separados/extracto", "Extracto consultado con \xE9xito de Yeminus", payload, resData);
      const { datos } = resData;
      let totalAbonado = 0;
      const history = (datos.detalle || []).map((pay) => {
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
      throw new Error(resData.mensaje || "No se encontr\xF3 el extracto para esta referencia");
    }
  } catch (error) {
    logApi("ERROR", "POST /api/yeminus/separados/extracto", `Fallo al consultar extracto en Yeminus: ${error.message}.`);
    res.json({ success: false, error: error.message });
  }
});
app.post("/api/wompi/prepare-checkout", async (req, res) => {
  try {
    const { reference, amountInCents, currency = "COP", orderData } = req.body;
    const publicKey = process.env.WOMPI_PUBLIC_KEY || "pub_prod_rYeI0ExCzLD8zRsQB8IQTpajkGFJlBkc";
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET || "prod_integrity_MWWeP0cqezh091PkMVprYnbbxAHBhMZT";
    const cleanAmountInCents = Math.round(Number(amountInCents));
    if (!reference || !cleanAmountInCents) {
      return res.status(400).json({ success: false, error: "Faltan par\xE1metros 'reference' o 'amountInCents'" });
    }
    if (cleanAmountInCents <= 0) {
      return res.status(400).json({ success: false, error: "El monto debe ser mayor a cero" });
    }
    if (orderData) {
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
          error: "Todos los campos de cliente (Nombre, C\xE9dula, Correo, Tel\xE9fono, Direcci\xF3n y Ciudad) son estrictamente obligatorios para proceder."
        });
      }
      const itemsToCheck = Array.isArray(orderData.items) && orderData.items.length > 0 ? orderData.items : orderData.product_id ? [{ product_id: orderData.product_id, quantity: Number(orderData.quantity) || 1, product_name: orderData.product_name }] : [];
      if (itemsToCheck.length > 0) {
        const catalog = productsCache?.data || loadProductsFromLocalFile() || [];
        for (const it of itemsToCheck) {
          const prod = catalog.find(
            (p) => String(p.id).trim() === String(it.product_id).trim() || String(p.code).trim() === String(it.product_id).trim() || String(p.reference).trim() === String(it.product_id).trim()
          );
          if (prod) {
            const availStock = Number(prod.stock) || 0;
            if (availStock <= 0) {
              return res.status(400).json({
                success: false,
                error: `El producto "${prod.name || it.product_name}" se encuentra agotado. Por favor ret\xEDralo para continuar.`
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
      const payAmountCOP = Math.round(cleanAmountInCents / 100);
      if (reference.startsWith("WMP-ABONO-") || orderData.isAbono) {
        const orderBalance = Number(orderData.balance_pending ?? orderData.restante ?? 1e5);
        const minAbono = Math.min(5e4, orderBalance);
        if (payAmountCOP < minAbono) {
          return res.status(400).json({
            success: false,
            error: `El abono m\xEDnimo permitido es de $${minAbono.toLocaleString("es-CO")} COP.`
          });
        }
      }
      const isUuid = (str) => typeof str === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
      const pendingUuid = orderData.id && isUuid(orderData.id) ? orderData.id : orderData.order_id && isUuid(orderData.order_id) ? orderData.order_id : import_crypto.default.randomUUID();
      orderData.id = pendingUuid;
      orderData.order_id = pendingUuid;
      const orderTotal = Math.round(Number(orderData.total_amount) || payAmountCOP);
      let rawItemList = Array.isArray(orderData.items) && orderData.items.length > 0 ? orderData.items : [];
      if (rawItemList.length === 0) {
        let pId = String(orderData.product_id || "").trim();
        let pName = String(orderData.product_name || "Producto Navide\xF1o").trim();
        try {
          if (import_fs2.default.existsSync(BACKUP_FILE_PATH)) {
            const parsed = JSON.parse(import_fs2.default.readFileSync(BACKUP_FILE_PATH, "utf-8"));
            const cList = Array.isArray(parsed) ? parsed : parsed.products || [];
            const found = cList.find(
              (p) => pId && pId !== "ONLINE" && (p.id === pId || p.reference === pId || p.code === pId) || pName && p.name.toLowerCase() === pName.toLowerCase()
            );
            if (found) {
              pId = found.id;
              pName = found.name;
            }
          }
        } catch {
        }
        rawItemList = [{
          product_id: pId && pId !== "ONLINE" ? pId : `PROD-${pendingUuid.slice(0, 8)}`,
          product_reference: pId && pId !== "ONLINE" ? pId : "ONLINE",
          product_name: pName,
          quantity: 1,
          unit_price: orderTotal,
          total: orderTotal
        }];
      }
      const itemsToSave = rawItemList.map((it, idx) => {
        const qty = Math.max(1, Number(it.quantity) || 1);
        const unitPrice = Math.round(Number(it.unit_price ?? it.price) || Math.round(orderTotal / (rawItemList.length * qty)));
        const itemTot = Math.round(Number(it.total) || unitPrice * qty);
        const subtotal = Math.round(Number(it.subtotal) || itemTot);
        const tax = Math.round(subtotal - subtotal / 1.19);
        const cleanProdId = String(it.product_id && it.product_id !== "ONLINE" ? it.product_id : it.product_reference || "").trim();
        const cleanRef = String(it.product_reference && it.product_reference !== "ONLINE" ? it.product_reference : cleanProdId).trim();
        return {
          product_id: cleanProdId || `PROD-${pendingUuid.slice(0, 8)}-${idx + 1}`,
          product_reference: cleanRef || cleanProdId || "ONLINE",
          product_name: String(it.product_name || it.name || "Producto Navide\xF1o").trim(),
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
      savePendingCheckout(reference, pendingUuid, cleanAmountInCents, currency, {
        ...orderData,
        orderId: pendingUuid,
        shipping_city: cleanShippingCity,
        notes: cleanNotes,
        items: itemsToSave
      });
      savePendingSession(reference, {
        ...orderData,
        orderId: pendingUuid,
        shipping_city: cleanShippingCity,
        notes: cleanNotes,
        items: itemsToSave,
        amountInCents: cleanAmountInCents,
        createdAt: Date.now()
      });
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          const metaParts = [];
          if (cleanCustomerDoc) metaParts.push(`Doc: ${cleanCustomerDoc}`);
          if (cleanShippingAddress) metaParts.push(`Dir: ${cleanShippingAddress}`);
          if (cleanShippingCity) metaParts.push(`Ciudad: ${cleanShippingCity}`);
          if (cleanNotes) metaParts.push(`Obs: ${cleanNotes}`);
          const metaSuffix = metaParts.length > 0 ? ` [${metaParts.join(" | ")}]` : "";
          const fullPendingSbPayload = {
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
            producto_id: itemsToSave.map((it) => it.product_id).join(", ") || (orderData.product_id !== "ONLINE" ? orderData.product_id : "") || "8010141",
            producto_name: `${itemsToSave.map((it) => `${it.quantity}x ${it.product_name}`).join(", ")}${metaSuffix}`,
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
                producto_id: itemsToSave.map((it) => it.product_id).join(", ") || (orderData.product_id !== "ONLINE" ? orderData.product_id : "") || "8010141",
                producto_name: `${itemsToSave.map((it) => `${it.quantity}x ${it.product_name}`).join(", ")}${metaSuffix}`,
                total: orderTotal,
                abonado: 0,
                restante: orderTotal,
                estado: "pendiente"
              }]);
            }
          }
        } catch (sbErr) {
          console.warn("[PREPARE CHECKOUT SB WARN]", sbErr.message);
        }
      }
    }
    const stringToSign = `${reference}${cleanAmountInCents}${currency}${integritySecret}`;
    const signature = import_crypto.default.createHash("sha256").update(stringToSign).digest("hex");
    logApi("INFO", "POST /api/wompi/prepare-checkout", `Checkout preparado para referencia ${reference} ($${cleanAmountInCents / 100} COP)`, { reference, amountInCents: cleanAmountInCents });
    res.json({
      success: true,
      signature,
      publicKey,
      currency,
      amountInCents: cleanAmountInCents,
      reference
    });
  } catch (err) {
    logApi("ERROR", "POST /api/wompi/prepare-checkout", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/wompi/signature", (req, res) => {
  try {
    const { reference, amountInCents, currency = "COP" } = req.body;
    const publicKey = process.env.WOMPI_PUBLIC_KEY || "pub_prod_rYeI0ExCzLD8zRsQB8IQTpajkGFJlBkc";
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET || "prod_integrity_MWWeP0cqezh091PkMVprYnbbxAHBhMZT";
    if (!reference || !amountInCents) {
      return res.status(400).json({ success: false, error: "Faltan par\xE1metros 'reference' o 'amountInCents'" });
    }
    const stringToSign = `${reference}${amountInCents}${currency}${integritySecret}`;
    const signature = import_crypto.default.createHash("sha256").update(stringToSign).digest("hex");
    res.json({
      success: true,
      signature,
      publicKey,
      currency,
      amountInCents,
      reference
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
async function purgeRejectedWompiTransaction(reference) {
  if (!reference) return;
  deletePendingSession(reference);
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      await supabase.from("pagos").delete().eq("referencia_pago", reference);
      await supabase.from("pedidos").delete().ilike("producto_name", `%${reference}%`);
      console.log(`[WOMPI PURGE] Registro purgado completamente para referencia rechazada: ${reference}`);
    } catch (e) {
      console.warn(`[WOMPI PURGE ERR] Error al purgar ${reference}:`, e.message);
    }
  }
}
var processedWompiReferences = /* @__PURE__ */ new Set();
function deductLocalInventory(items, orderRef) {
  if (!items || !Array.isArray(items) || items.length === 0) return;
  try {
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
    let rawList = [];
    if (import_fs2.default.existsSync(BACKUP_FILE_PATH)) {
      try {
        const raw = import_fs2.default.readFileSync(BACKUP_FILE_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        rawList = Array.isArray(parsed) ? parsed : Array.isArray(parsed.products) ? parsed.products : [];
      } catch (e) {
      }
    }
    if (rawList.length === 0 && productsCache?.data) {
      rawList = [...productsCache.data];
    }
    for (const item of items) {
      const qtyToDeduct = Number(item.quantity) || 1;
      const targetId = String(item.product_id || "").trim();
      const idx = rawList.findIndex(
        (p) => String(p.id).trim() === targetId || String(p.code).trim() === targetId || String(p.reference).trim() === targetId
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
      saveProductsToLocalFile(rawList);
      const activeProducts = rawList.filter((p) => (p.stock ?? 0) >= 1);
      productsCache = {
        timestamp: Date.now(),
        data: activeProducts
      };
      const supabase = getSupabaseAdmin();
      if (supabase) {
        for (const item of items) {
          const targetId = String(item.product_id || "").trim();
          const prod = rawList.find((p) => String(p.id).trim() === targetId || String(p.code).trim() === targetId);
          if (prod) {
            supabase.from("products").update({ stock: prod.stock }).eq("id", prod.id).then(({ error }) => {
              if (error) console.warn("[SUPABASE STOCK UPDATE ERR]", error.message);
            });
          }
        }
      }
    }
  } catch (err) {
    console.error("[INVENTORY_DEDUCT ERROR]", err);
  }
}
function buildReceiptData(transaction, sessionData, order, documentId, amount, paymentRecord) {
  const customerName = order?.cliente_nombre || sessionData?.customer_name || transaction?.customer_data?.full_name || transaction?.payment_method?.extra?.card_holder || transaction?.payment_method?.extra?.fullName || "Cliente Impormax";
  const customerEmail = order?.cliente_email || sessionData?.customer_email || transaction?.customer_email || "cliente@impormax.net";
  const customerPhone = order?.cliente_telefono || sessionData?.customer_phone || transaction?.customer_data?.phone_number || transaction?.payment_method?.extra?.cellphoneNumber || "";
  const customerDoc = sessionData?.customer_document || transaction?.billing_data?.legal_id || transaction?.customer_data?.legal_id || paymentRecord?.customer_document || order?.cliente_documento || "10203040";
  const address = sessionData?.shipping_address || "Entrega a domicilio / Retiro en tienda";
  const city = sessionData?.shipping_city || "Pereira";
  const totalAmount = Number(order?.total) || Number(sessionData?.total_amount) || amount;
  const paidAmount = Number(order?.abonado) || amount;
  const balancePending = order && order.restante !== void 0 && order.restante !== null && !isNaN(Number(order.restante)) ? Number(order.restante) : Math.max(0, totalAmount - paidAmount);
  const isPlanSepare = balancePending > 0;
  const rawItems = order?.items && order.items.length > 0 ? order.items : sessionData?.items && sessionData.items.length > 0 ? sessionData.items : [];
  let items = [];
  if (rawItems && rawItems.length > 0) {
    items = rawItems.map((it) => ({
      id: it.product_reference && it.product_reference !== "ONLINE" ? it.product_reference : it.product_id && it.product_id !== "ONLINE" ? it.product_id : "",
      name: it.product_name || it.name || "Producto Navide\xF1o",
      quantity: Number(it.quantity) || 1,
      price: Number(it.unit_price || it.price) || Math.round(totalAmount / (rawItems.length * (Number(it.quantity) || 1))),
      total: Number(it.total) || (Number(it.unit_price || it.price) || Math.round(totalAmount / rawItems.length)) * (Number(it.quantity) || 1)
    }));
  } else if (order?.producto_name) {
    items = [{
      id: order.producto_id && order.producto_id !== "ONLINE" ? order.producto_id : "",
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
    methodLabel = `Tarjeta ${pmExtra?.brand || "Cr\xE9dito/D\xE9bito"} **** ${pmExtra?.last_four || ""}`;
  } else if (paymentMethodType === "NEQUI") {
    methodLabel = "Nequi Bancolombia";
  } else if (paymentMethodType === "BANCOLOMBIA_TRANSFER") {
    methodLabel = "Bancolombia Transferencia";
  } else if (paymentMethodType === "BANCOLOMBIA_QR") {
    methodLabel = "Bancolombia C\xF3digo QR";
  } else if (paymentMethodType === "PSE") {
    methodLabel = `PSE - ${pmExtra?.financial_institution_code || "Banco en l\xEDnea"}`;
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
    date: transaction?.created_at || order?.created_at || (/* @__PURE__ */ new Date()).toISOString(),
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
      balancePending,
      isPlanSepare,
      depositPercentage: totalAmount > 0 ? Math.round(paidAmount / totalAmount * 100) : 100
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
async function confirmWompiApprovedTransaction(transaction, fallbackOrderData) {
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
  if (refKey && inFlightWompiConfirmations.has(refKey)) {
    console.log(`[WOMPI MUTEX] Transacci\xF3n ${refKey} ya est\xE1 siendo confirmada en vuelo. Esperando resoluci\xF3n \xFAnica...`);
    return await inFlightWompiConfirmations.get(refKey);
  }
  const confirmPromise = (async () => {
    const amount = (amount_in_cents || 0) / 100;
    const supabase = getSupabaseAdmin();
    const pendingCheckoutRow = getPendingCheckout(reference);
    const sessionData = getPendingSession(reference) || pendingCheckoutRow?.orderData || fallbackOrderData || {};
    if (refKey && processedWompiReferences.has(refKey)) {
      console.log(`[WOMPI APROBADO] Referencia ${refKey} ya en memoria de procesados.`);
      let existingOrder = getOrderByWompiRef(refKey);
      let existingPayment = null;
      if (supabase) {
        const { data: payments } = await supabase.from("pagos").select("*, pedidos(*)").eq("referencia_pago", refKey).limit(1);
        if (payments && payments.length > 0) {
          existingPayment = payments[0];
          if (!existingOrder) existingOrder = existingPayment.pedidos;
        }
      }
      const docId = existingOrder?.yeminus_document_id || existingOrder?.producto_name?.match(/\[Ref:\s*([^\]]+)\]/)?.[1] || refKey;
      const receipt2 = buildReceiptData(transaction, sessionData, existingOrder, docId, amount, existingPayment);
      return {
        success: true,
        status: "APPROVED",
        alreadyProcessed: true,
        document_id: docId,
        order: existingOrder,
        receipt: receipt2
      };
    }
    if (refKey) {
      const existingSqlite = getOrderByWompiRef(refKey);
      if (existingSqlite && (existingSqlite.status === "pagado" || existingSqlite.status === "abonando")) {
        console.log(`[WOMPI APROBADO] Transacci\xF3n ${refKey} ya confirmada en SQLite: ${existingSqlite.id} (SLP: ${existingSqlite.yeminus_document_id}).`);
        processedWompiReferences.add(refKey);
        const docId = existingSqlite.yeminus_document_id || `SLP-${refKey}`;
        const receipt2 = buildReceiptData(transaction, sessionData, existingSqlite, docId, existingSqlite.paid_amount || amount);
        return {
          success: true,
          status: "APPROVED",
          alreadyProcessed: true,
          document_id: docId,
          order: existingSqlite,
          receipt: receipt2
        };
      }
    }
    if (supabase && refKey) {
      const { data: existingPayments } = await supabase.from("pagos").select("*, pedidos(*)").eq("referencia_pago", refKey);
      if (existingPayments && existingPayments.length > 0 && existingPayments[0].estado_pago === "aprobado") {
        console.log(`[WOMPI APROBADO] Transacci\xF3n ${refKey} ya procesada previamente en Supabase.`);
        processedWompiReferences.add(refKey);
        const existingPayment = existingPayments[0];
        const existingOrder = existingPayment.pedidos;
        const docId = existingOrder?.producto_name?.match(/\[Ref:\s*([^\]]+)\]/)?.[1] || refKey;
        const receipt2 = buildReceiptData(transaction, sessionData, existingOrder, docId, existingPayment.monto || amount, existingPayment);
        return {
          success: true,
          status: "APPROVED",
          alreadyProcessed: true,
          document_id: docId,
          payment: existingPayment,
          order: existingOrder,
          receipt: receipt2
        };
      }
    }
    let sqliteOrder = getOrderByWompiRef(reference);
    if (!sqliteOrder && (sessionData?.orderId || sessionData?.id || pendingCheckoutRow?.orderId)) {
      sqliteOrder = getOrderById(sessionData?.orderId || sessionData?.id || pendingCheckoutRow?.orderId);
    }
    const rawDoc = sessionData.customer_document || fallbackOrderData?.customer_document || sqliteOrder?.customer_document || billing_data?.legal_id || customer_data?.legal_id || payment_method?.extra?.user_legal_id || payment_method?.extra?.identificationNumber || "";
    const customerDoc = rawDoc && rawDoc !== "222222222" ? String(rawDoc).trim() : sqliteOrder?.customer_document && sqliteOrder.customer_document !== "222222222" ? sqliteOrder.customer_document : String(rawDoc || "");
    const rawName = sessionData.customer_name || fallbackOrderData?.customer_name || sqliteOrder?.customer_name || customer_data?.full_name || payment_method?.extra?.card_holder || payment_method?.extra?.fullName || "Cliente Impormax";
    const customerName = String(rawName).trim();
    const rawPhone = sessionData.customer_phone || fallbackOrderData?.customer_phone || sqliteOrder?.customer_phone || customer_data?.phone_number || payment_method?.extra?.cellphoneNumber || "";
    const customerPhone = String(rawPhone).trim();
    const rawEmail = sessionData.customer_email || fallbackOrderData?.customer_email || sqliteOrder?.customer_email || customer_email || "cliente@impormax.net";
    const customerEmailReal = String(rawEmail).trim();
    const rawAddress = sessionData.shipping_address || fallbackOrderData?.shipping_address || "";
    const effectiveAddress = rawAddress && !["Entrega a domicilio / Retiro en tienda", "Entrega a domicilio", "Direcci\xF3n de Entrega Registrada"].includes(rawAddress) ? String(rawAddress).trim() : sqliteOrder?.shipping_address && !["Entrega a domicilio / Retiro en tienda", "Entrega a domicilio", "Direcci\xF3n de Entrega Registrada"].includes(sqliteOrder.shipping_address) ? sqliteOrder.shipping_address : rawAddress || sqliteOrder?.shipping_address || "Entrega a domicilio";
    const rawCity = sessionData.shipping_city || sessionData.customer_city || fallbackOrderData?.shipping_city || "";
    const effectiveCity = String(rawCity || (sqliteOrder?.shipping_city !== "Pereira" ? sqliteOrder?.shipping_city : "") || sqliteOrder?.shipping_city || "").trim();
    const rawNotes = sessionData.notes || sessionData.observaciones || fallbackOrderData?.notes || fallbackOrderData?.observaciones || sqliteOrder?.notes || "";
    const effectiveNotes = String(rawNotes).trim();
    const isAbonoExplicit = reference.startsWith("WMP-ABONO-") || sessionData.isAbono === true;
    if (isAbonoExplicit) {
      const rawTarget = sessionData.order_id || sessionData.orderId || reference.split("-")[2];
      let existingOrderSql = getOrderById(rawTarget) || sqliteOrder;
      if (!existingOrderSql && supabase) {
        try {
          const { data: sbMatch } = await supabase.from("pedidos").select("*");
          if (sbMatch && sbMatch.length > 0) {
            const matched = sbMatch.find(
              (o) => o.id === rawTarget || rawTarget && o.id.startsWith(rawTarget) || rawTarget && rawTarget.startsWith(o.id.slice(0, 8)) || customerEmailReal && o.cliente_email && o.cliente_email.toLowerCase() === customerEmailReal.toLowerCase()
            );
            if (matched) {
              await syncAndRecoverFromSupabase(supabase);
              existingOrderSql = getOrderById(matched.id);
            }
          }
        } catch (e) {
          console.warn("[ABONO SB LOOKUP ERR]", e.message);
        }
      }
      if (existingOrderSql) {
        const fullOrderId = existingOrderSql.id;
        const newPayId2 = import_crypto.default.randomUUID();
        savePayment({
          id: newPayId2,
          order_id: fullOrderId,
          amount,
          payment_reference: reference,
          transaction_id: transaction.id || "",
          payment_method: (payment_method_type || "wompi").toLowerCase(),
          status: "approved",
          raw_data: JSON.stringify(transaction),
          created_at: transaction.created_at || (/* @__PURE__ */ new Date()).toISOString()
        });
        const allDbPayments = db.prepare(`SELECT * FROM payments WHERE order_id = ? AND status = 'approved'`).all(fullOrderId);
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
        if (supabase) {
          try {
            await supabase.from("pedidos").update({
              abonado: effectivePaid,
              restante: newRestante,
              estado: newEstado
            }).eq("id", fullOrderId);
            await supabase.from("pagos").upsert([{
              id: newPayId2,
              pedido_id: fullOrderId,
              monto: amount,
              referencia_pago: reference,
              estado_pago: "aprobado",
              metodo_pago: (payment_method_type || "wompi").toLowerCase()
            }]);
          } catch (e) {
            console.warn("[ABONO SB MIRROR ERR]", e.message);
          }
        }
        try {
          await registerYeminusAbonoInternal({
            order_id: fullOrderId,
            amount,
            payment_reference: reference,
            customer_document: customerDoc
          });
        } catch (e) {
          console.warn("[WOMPI ABONO YEMINUS ERR]", e.message);
        }
        processedWompiReferences.add(reference);
        const updatedOrder = getOrderById(fullOrderId);
        const docId = updatedOrder.yeminus_document_id || `SLP-${reference}`;
        const receipt2 = buildReceiptData(transaction, sessionData, updatedOrder, docId, amount, {
          id: newPayId2,
          metodo_pago: payment_method_type
        });
        return {
          success: true,
          status: "APPROVED",
          isAbono: true,
          document_id: docId,
          order: updatedOrder,
          receipt: receipt2
        };
      }
    }
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
      } catch (e) {
        console.warn("[CHECKOUT SB LOOKUP ERR]", e.message);
      }
    }
    const orderTotal = sqliteOrder?.total || Number(sessionData.total_amount) || amount;
    const isTotalPaid = amount >= orderTotal;
    const orderStatus = isTotalPaid ? "pagado" : "abonando";
    const restante = Math.max(0, orderTotal - amount);
    const isUuid = (str) => typeof str === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
    const orderUuid = sqliteOrder?.id && isUuid(sqliteOrder.id) ? sqliteOrder.id : sessionData?.orderId && isUuid(sessionData.orderId) ? sessionData.orderId : import_crypto.default.randomUUID();
    let orderItemsToProcess = sessionData.items && sessionData.items.length > 0 ? sessionData.items : fallbackOrderData?.items && fallbackOrderData.items.length > 0 ? fallbackOrderData.items : sqliteOrder?.items && sqliteOrder.items.length > 0 ? sqliteOrder.items : [];
    if (orderItemsToProcess.length === 0) {
      const pId = sessionData.product_id;
      const pName = sessionData.product_name;
      const cat = findInCatalog(pId, pName);
      orderItemsToProcess = [{
        product_id: cat ? cat.id : pId && pId !== "ONLINE" ? pId : `PROD-${orderUuid.slice(0, 8)}`,
        product_reference: cat ? cat.reference || cat.id : pId && pId !== "ONLINE" ? pId : "ONLINE",
        product_name: cat ? cat.name : pName || "Producto Navide\xF1o",
        quantity: 1,
        unit_price: orderTotal,
        total: orderTotal
      }];
    }
    const cleanCustomerDocument = customerDoc;
    let documentId = sqliteOrder?.yeminus_document_id || "";
    if (!documentId && refKey) {
      documentId = yeminusDocsByReference.get(refKey) || "";
    }
    if (!documentId && orderUuid) {
      documentId = yeminusDocsByReference.get(orderUuid) || "";
    }
    let yeminusSyncStatus = documentId ? "SYNCED" : "ERP_SYNC_FAILED";
    let yeminusLastError = "";
    if (!documentId) {
      try {
        const syncResult = await createOrSyncYeminusDocument({
          customer_document: cleanCustomerDocument,
          customer_name: customerName,
          product_id: orderItemsToProcess[0]?.product_id || orderItemsToProcess[0]?.product_reference || "ONLINE",
          product_name: orderItemsToProcess[0]?.product_name || "Producto Navide\xF1o",
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
      } catch (errYem) {
        yeminusLastError = errYem.message;
        console.warn("[WOMPI YEMINUS SLP WARN]", errYem.message);
      }
    } else {
      console.log(`[WOMPI APROBADO] Pedido ya cuenta con documento SLP previo en Yeminus: ${documentId}. Se omite duplicaci\xF3n.`);
    }
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
    const newPayId = import_crypto.default.randomUUID();
    savePayment({
      id: newPayId,
      order_id: orderUuid,
      amount,
      payment_reference: reference,
      transaction_id: transaction.id || "",
      payment_method: (payment_method_type || "wompi").toLowerCase(),
      status: "approved",
      raw_data: JSON.stringify(transaction),
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    if (supabase) {
      try {
        const prodSummaryName = orderItemsToProcess.map((it) => `${it.quantity || 1}x ${it.product_name}`).join(", ") || "Pedido Navide\xF1o Impormax";
        const metaParts = [];
        if (documentId) metaParts.push(`Ref: ${documentId}`);
        if (cleanCustomerDocument) metaParts.push(`Doc: ${cleanCustomerDocument}`);
        if (effectiveAddress) metaParts.push(`Dir: ${effectiveAddress}`);
        if (effectiveCity) metaParts.push(`Ciudad: ${effectiveCity}`);
        if (effectiveNotes) metaParts.push(`Obs: ${effectiveNotes}`);
        const metaSuffix = metaParts.length > 0 ? ` [${metaParts.join(" | ")}]` : "";
        const createdOrderRecord = {
          id: orderUuid,
          cliente_nombre: customerName,
          cliente_email: customerEmailReal,
          cliente_telefono: customerPhone,
          producto_id: orderItemsToProcess.map((it) => it.product_id).filter((id2) => id2 && id2 !== "ONLINE").join(", ") || (orderItemsToProcess[0]?.product_reference || "ONLINE"),
          producto_name: `${prodSummaryName}${metaSuffix}`,
          total: orderTotal,
          abonado: amount,
          restante,
          estado: orderStatus
        };
        const extendedOrderRecord = {
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
        try {
          for (const it of orderItemsToProcess) {
            await supabase.from("order_items").upsert([{
              id: it.id || import_crypto.default.randomUUID(),
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
        } catch {
        }
        await supabase.from("pagos").insert([{
          id: newPayId,
          pedido_id: orderUuid,
          monto: amount,
          referencia_pago: reference,
          estado_pago: "aprobado",
          metodo_pago: (payment_method_type || "wompi").toLowerCase()
        }]);
      } catch (sbErr) {
        console.warn("[CONFIRM SB MIRROR ERR]", sbErr.message);
      }
    }
    processedWompiReferences.add(reference);
    deductLocalInventory(orderItemsToProcess, reference);
    logApi("SUCCESS", "WOMPI CONFIRMATION", `Pedido confirmado: ${orderUuid} (${orderStatus}, ERP: ${yeminusSyncStatus})`, { reference, orderUuid });
    const receipt = buildReceiptData(transaction, sessionData, savedSqliteOrder, documentId, amount, {
      id: newPayId,
      metodo_pago: payment_method_type
    });
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
    }).catch((mailErr) => console.error("[EMAIL AUTO ERROR]", mailErr.message));
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
app.post("/api/wompi/confirm-transaction", async (req, res) => {
  try {
    const { transactionId, fallbackOrderData, pendingCheckout } = req.body;
    const fallback = fallbackOrderData || pendingCheckout;
    if (!transactionId) {
      return res.status(400).json({ success: false, error: "Falta par\xE1metro 'transactionId'" });
    }
    const prvKey = process.env.WOMPI_PRIVATE_KEY || "prv_prod_aUM7wa7SEXtMwL6fqgFUPdBkBeuda2v8";
    const pubKey = process.env.WOMPI_PUBLIC_KEY || "pub_prod_rYeI0ExCzLD8zRsQB8IQTpajkGFJlBkc";
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
    let transaction = null;
    if (wompiResp.ok) {
      const wompiJson = await wompiResp.json();
      transaction = wompiJson.data;
    } else {
      try {
        const refResp = await fetch(`https://production.wompi.co/v1/transactions?reference=${encodeURIComponent(transactionId)}`, {
          headers: { "Authorization": `Bearer ${prvKey}` }
        });
        if (refResp.ok) {
          const refJson = await refResp.json();
          if (refJson.data && refJson.data.length > 0) {
            transaction = refJson.data[0];
          }
        }
      } catch (refErr) {
        console.warn("[WOMPI CONFIRM REF FALLBACK WARN]", refErr.message);
      }
    }
    if (!transaction) {
      return res.status(404).json({ success: false, error: "Transacci\xF3n no encontrada en Wompi" });
    }
    const { reference, status } = transaction;
    if (status !== "APPROVED") {
      await purgeRejectedWompiTransaction(reference);
      return res.json({
        success: false,
        status,
        message: status === "DECLINED" ? "El pago fue rechazado por la entidad bancaria en Wompi. No se ha generado ning\xFAn cobro ni pedido." : `El pago finaliz\xF3 en estado '${status}'. Por favor intenta nuevamente con otro medio de pago.`
      });
    }
    const result = await confirmWompiApprovedTransaction(transaction, fallback);
    res.json(result);
  } catch (err) {
    logApi("ERROR", "POST /api/wompi/confirm-transaction", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
async function reconcileWompiApprovedTransactions(options = {}) {
  const days = options.days || 60;
  const prvKey = process.env.WOMPI_PRIVATE_KEY || "prv_prod_aUM7wa7SEXtMwL6fqgFUPdBkBeuda2v8";
  const fromDate = new Date(Date.now() - days * 24 * 3600 * 1e3).toISOString().slice(0, 10);
  const untilDate = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  let page = 1;
  let allTransactions = [];
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
        console.warn(`[RECONCILIATION] Error Wompi API p\xE1gina ${page}: ${errTxt}`);
        break;
      }
      const json = await wompiResp.json();
      const transactions = json.data || [];
      allTransactions.push(...transactions);
      if (transactions.length < 100 || json.meta && allTransactions.length >= json.meta.total_results) {
        hasMore = false;
      } else {
        page++;
      }
    } catch (e) {
      console.warn(`[RECONCILIATION] Error al consultar Wompi p\xE1g ${page}:`, e.message);
      break;
    }
  }
  const approved = allTransactions.filter((t) => t.status === "APPROVED");
  const supabase = getSupabaseAdmin();
  const reconciled = [];
  const skipped = [];
  for (const tx of approved) {
    let needsSync = true;
    if (supabase && !options.force) {
      const { data: existingPagos } = await supabase.from("pagos").select("id, referencia_pago, pedido_id").eq("referencia_pago", tx.reference);
      if (existingPagos && existingPagos.length > 0) {
        const { data: existingPed } = await supabase.from("pedidos").select("id").eq("id", existingPagos[0].pedido_id);
        if (existingPed && existingPed.length > 0) {
          needsSync = false;
        }
      }
    }
    if (!needsSync) {
      skipped.push({ reference: tx.reference, status: "already_in_supabase" });
      continue;
    }
    let detailedTx = tx;
    try {
      const detailRes = await fetch(`https://production.wompi.co/v1/transactions/${tx.id}`, {
        headers: { "Authorization": `Bearer ${prvKey}` }
      });
      if (detailRes.ok) {
        const detailJson = await detailRes.json();
        if (detailJson.data) detailedTx = detailJson.data;
      }
    } catch (e) {
      console.warn(`[RECONCILE] Error al obtener detalle de transacci\xF3n ${tx.id}:`, e.message);
    }
    console.log(`[RECONCILIATION] Sincronizando transacci\xF3n aprobada pendiente: ${detailedTx.reference}`);
    const resSync = await confirmWompiApprovedTransaction(detailedTx);
    reconciled.push({
      reference: detailedTx.reference,
      amount: (detailedTx.amount_in_cents || 0) / 100,
      customer: detailedTx.customer_data?.full_name || detailedTx.customer_email,
      result: resSync
    });
  }
  if (supabase) {
    try {
      const { data: allPagos } = await supabase.from("pagos").select("*").eq("estado_pago", "aprobado");
      if (allPagos && allPagos.length > 0) {
        const pagosByPed = /* @__PURE__ */ new Map();
        for (const p of allPagos) {
          pagosByPed.set(p.pedido_id, (pagosByPed.get(p.pedido_id) || 0) + Number(p.monto));
        }
        const { data: allPeds } = await supabase.from("pedidos").select("id, total, abonado, restante, estado");
        if (allPeds) {
          for (const ped of allPeds) {
            const totalPagado = pagosByPed.get(ped.id);
            if (totalPagado !== void 0 && totalPagado > 0) {
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
    } catch (err) {
      console.warn("[RECONCILE SB RECALC ERR]", err.message);
    }
  }
  logApi("INFO", "RECONCILIATION", `Conciliaci\xF3n Wompi completada: ${approved.length} aprobadas, ${reconciled.length} reconciliadas, ${skipped.length} omitidas.`);
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
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/orders", async (req, res) => {
  try {
    let sqliteOrders = getAllOrders();
    if (sqliteOrders.length === 0) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        await syncAndRecoverFromSupabase(supabase);
        sqliteOrders = getAllOrders();
      }
    }
    const mappedOrders = sqliteOrders.map((o) => {
      const summaryName = o.items && o.items.length > 0 ? o.items.map((it) => `${it.quantity || 1}x ${it.product_name}`).join(", ") : "Pedido Navide\xF1o Impormax";
      const primaryProdId = o.items && o.items.length > 0 ? o.items.map((it) => it.product_reference || it.product_id).filter(Boolean).join(", ") : "";
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
    const allPayments = db.prepare(`SELECT * FROM payments ORDER BY created_at DESC`).all();
    res.json({
      success: true,
      orders: mappedOrders,
      payments: allPayments,
      count: mappedOrders.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/orders/:id/update-items", adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { items, yeminus_sync } = req.body;
    const order = getOrderById(id);
    if (!order) return res.status(404).json({ success: false, error: "Pedido no encontrado" });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: "Se requiere un arreglo de items no vac\xEDo" });
    }
    const newItems = items.map((it) => {
      const qty = Math.max(1, Number(it.quantity) || 1);
      const unitPrice = Number(it.unit_price || it.price) || 0;
      const subtotal = unitPrice * qty;
      const tax = Math.round(subtotal - subtotal / 1.19);
      const pId = String(it.product_id && it.product_id !== "ONLINE" ? it.product_id : it.product_reference || "").trim();
      const pRef = String(it.product_reference && it.product_reference !== "ONLINE" ? it.product_reference : pId).trim();
      return {
        product_id: pId || "8010141",
        product_reference: pRef || "ANCancun180",
        product_name: String(it.product_name || "Producto Navide\xF1o").trim(),
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
    const newTotal = newItems.reduce((acc, it) => acc + it.total, 0);
    const newBalance = Math.max(0, newTotal - order.paid_amount);
    const newStatus = order.paid_amount >= newTotal ? "pagado" : order.paid_amount > 0 ? "abonando" : "pendiente";
    saveOrderWithItems({
      ...order,
      total: newTotal,
      balance: newBalance,
      status: newStatus
    }, newItems);
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const prodSummary = newItems.map((i) => `${i.quantity}x ${i.product_name}`).join(", ");
        const prodSkus = newItems.map((i) => i.product_id).join(", ");
        await supabase.from("pedidos").update({
          producto_id: prodSkus,
          producto_name: prodSummary,
          total: newTotal,
          restante: newBalance,
          estado: newStatus
        }).eq("id", id);
      } catch (sbErr) {
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
      message: `Art\xEDculos del pedido actualizados con \xE9xito${syncResultMsg}`,
      order: getOrderById(id)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
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
    const cleanNotes = notes !== void 0 ? String(notes).trim() : observaciones !== void 0 ? String(observaciones).trim() : order.notes;
    const parsedItems = Array.isArray(items) && items.length > 0 ? items.map((it) => {
      const qty = Math.max(1, Number(it.quantity) || 1);
      const unitPrice = Number(it.unit_price || it.price) || 0;
      const subtotal = unitPrice * qty;
      const tax = Math.round(subtotal - subtotal / 1.19);
      const pId = String(it.product_id && it.product_id !== "ONLINE" ? it.product_id : it.sku && it.sku !== "ONLINE" ? it.sku : it.product_reference || "").trim();
      const pRef = String(it.product_reference && it.product_reference !== "ONLINE" ? it.product_reference : pId).trim();
      return {
        product_id: pId || "8010141",
        product_reference: pRef || "ANCancun180",
        product_name: String(it.product_name || it.name || "Producto Navide\xF1o").trim(),
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
    }) : order.items || [];
    const newTotal = parsedItems.length > 0 ? parsedItems.reduce((acc, it) => acc + it.total, 0) : order.total;
    const newBalance = Math.max(0, newTotal - order.paid_amount);
    const newStatus = order.paid_amount >= newTotal ? "pagado" : order.paid_amount > 0 ? "abonando" : "pendiente";
    const updatedOrder = saveOrderWithItems({
      ...order,
      customer_name: customer_name !== void 0 ? String(customer_name).trim() : order.customer_name,
      customer_document: customer_document !== void 0 ? String(customer_document).trim() : order.customer_document,
      customer_phone: customer_phone !== void 0 ? String(customer_phone).trim() : order.customer_phone,
      customer_email: customer_email !== void 0 ? String(customer_email).trim() : order.customer_email,
      shipping_address: shipping_address !== void 0 ? String(shipping_address).trim() : order.shipping_address,
      shipping_city: shipping_city !== void 0 ? String(shipping_city).trim() : order.shipping_city,
      notes: cleanNotes,
      total: newTotal,
      subtotal: newTotal,
      balance: newBalance,
      status: newStatus
    }, parsedItems);
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const prodSummary = parsedItems.map((i) => `${i.quantity}x ${i.product_name}`).join(", ");
        const prodSkus = parsedItems.map((i) => i.product_id).join(", ");
        const updatePayload = {
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
      } catch (sbErr) {
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
        syncResultMsg = ` y radicado con \xE9xito en Yeminus ERP: ${syncRes.document_id}`;
      } else {
        db.prepare(`UPDATE orders SET yeminus_sync_status = 'ERP_SYNC_FAILED', yeminus_last_error = ? WHERE id = ?`).run(syncRes.error || "Error ERP", id);
        syncResultMsg = ` (Aviso ERP: ${syncRes.error})`;
      }
    }
    res.json({
      success: true,
      message: `Pedido, direcci\xF3n de entrega y art\xEDculos actualizados con \xE9xito${syncResultMsg}`,
      order: getOrderById(id)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/orders/update-product", adminAuthMiddleware, async (req, res) => {
  try {
    const { orderId, productName, productId } = req.body;
    if (!orderId || !productName) {
      return res.status(400).json({ success: false, error: "Faltan par\xE1metros 'orderId' o 'productName'" });
    }
    const order = getOrderById(orderId);
    if (!order) return res.status(404).json({ success: false, error: "Pedido no encontrado" });
    const items = order.items && order.items.length > 0 ? [...order.items] : [{
      product_id: productId && productId !== "ONLINE" ? productId : order.items?.[0]?.product_id && order.items[0].product_id !== "ONLINE" ? order.items[0].product_id : "8010141",
      product_name: productName,
      quantity: 1,
      unit_price: order.total,
      subtotal: order.total,
      tax: Math.round(order.total - order.total / 1.19),
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
        await supabase.from("pedidos").update({
          producto_name: productName.trim(),
          ...productId ? { producto_id: productId.trim() } : {}
        }).eq("id", orderId);
      } catch {
      }
    }
    logApi("SUCCESS", "UPDATE ORDER PRODUCT", `Pedido ${orderId} actualizado con producto: ${productName}`);
    res.json({ success: true, order: getOrderById(orderId) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/orders/:id/resend-email", async (req, res) => {
  try {
    const { id } = req.params;
    const targetEmail = req.body?.email;
    const clientOrderData = req.body?.orderData;
    let order = getOrderById(id) || getOrderByWompiRef(id);
    let dbOrd = null;
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { data } = await supabase.from("pedidos").select("*").eq("id", id).maybeSingle();
        if (data) dbOrd = data;
      } catch {
      }
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
      };
    }
    if (!order && clientOrderData) {
      order = clientOrderData;
    }
    if (!order) {
      return res.status(404).json({ success: false, error: "Pedido no encontrado" });
    }
    const emailToSend = targetEmail || order.customer_email || clientOrderData?.customer_email;
    if (!emailToSend || !emailToSend.includes("@")) {
      return res.status(400).json({ success: false, error: "El pedido no cuenta con un correo electr\xF3nico v\xE1lido" });
    }
    const realTotal = dbOrd?.total !== void 0 ? Number(dbOrd.total) : clientOrderData?.total_amount ? Number(clientOrderData.total_amount) : Number(order.total || 0);
    const realPaid = dbOrd?.abonado !== void 0 ? Number(dbOrd.abonado) : clientOrderData?.paid_amount !== void 0 ? Number(clientOrderData.paid_amount) : Number(order.paid_amount || 0);
    const realBalance = dbOrd?.restante !== void 0 ? Number(dbOrd.restante) : clientOrderData?.balance_pending !== void 0 ? Number(clientOrderData.balance_pending) : Math.max(0, realTotal - realPaid);
    let finalItems = Array.isArray(order.items) && order.items.length > 0 ? order.items : Array.isArray(clientOrderData?.items) && clientOrderData.items.length > 0 ? clientOrderData.items : [];
    const hasOnlyGenericCancun = finalItems.length === 1 && finalItems[0]?.product_id === "8010141" && !String(order.product_name || dbOrd?.producto_name || "").toLowerCase().includes("cancun");
    if (finalItems.length === 0 || hasOnlyGenericCancun) {
      const catalog = productsCache?.data || loadProductsFromLocalFile() || [];
      const prodSummary = String(order.product_name || dbOrd?.producto_name || clientOrderData?.product_name || "").replace(/\[[^\]]*\]/g, "").trim();
      const rawSkus = String(dbOrd?.producto_id || order.product_id || clientOrderData?.product_id || "").split(",").map((s) => s.trim()).filter(Boolean);
      const rawItemStrs = prodSummary.split(/,\s*(?=\d+x\s+)/).map((s) => s.trim()).filter(Boolean);
      const itemsToProcess = rawItemStrs.length > 0 ? rawItemStrs : prodSummary ? [prodSummary] : [];
      if (itemsToProcess.length > 0) {
        finalItems = itemsToProcess.map((itemStr, idx) => {
          const m = itemStr.match(/^(\d+)x\s+(.+)$/);
          const qty = m ? parseInt(m[1]) : 1;
          const name = m ? m[2].trim() : itemStr.trim();
          const targetSku = rawSkus[idx] || rawSkus[0] || "";
          const foundCat = catalog.find(
            (p) => targetSku && targetSku !== "ONLINE" && (String(p.id).toLowerCase() === targetSku.toLowerCase() || String(p.code).toLowerCase() === targetSku.toLowerCase() || p.reference && String(p.reference).toLowerCase() === targetSku.toLowerCase()) || name && p.name.toLowerCase() === name.toLowerCase() || name && (name.toLowerCase().includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(name.toLowerCase()))
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
        message: `Correo de confirmaci\xF3n enviado exitosamente a ${emailToSend}`,
        messageId: emailResult.messageId
      });
    } else {
      return res.status(500).json({
        success: false,
        error: emailResult.error || "Fallo al enviar correo"
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/orders/by-document/:doc", async (req, res) => {
  try {
    const rawDoc = String(req.params.doc || "").trim();
    const cleanDoc = rawDoc.replace(/\D/g, "");
    if (!cleanDoc && !rawDoc.includes("@")) {
      return res.status(400).json({ success: false, error: "N\xFAmero de documento inv\xE1lido" });
    }
    const orderMap = /* @__PURE__ */ new Map();
    const supabase = getSupabaseAdmin();
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
      cleanDoc,
      cleanDoc,
      cleanDoc,
      `%${cleanDoc}%`,
      rawDoc,
      rawDoc,
      rawDoc
    );
    for (const o of sqliteOrders) {
      orderMap.set(o.id, {
        ...o,
        items: o.items || []
      });
    }
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
      } catch (err) {
        console.warn("[BY-DOC SB WARN]", err.message);
      }
    }
    const matchesQuery = (ord) => {
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
    const finalOrders = matchingOrders.map((o) => {
      const orderId = String(o.id);
      const targetWompiRef = String(o.wompi_reference || o.referencia_wompi || "").trim();
      const localPayments = targetWompiRef && targetWompiRef.length >= 6 ? db.prepare(`
            SELECT * FROM payments 
            WHERE order_id = ? OR (payment_reference = ? AND length(payment_reference) >= 6)
            ORDER BY created_at ASC
          `).all(orderId, targetWompiRef) : db.prepare(`
            SELECT * FROM payments 
            WHERE order_id = ?
            ORDER BY created_at ASC
          `).all(orderId);
      const paymentsMap = /* @__PURE__ */ new Map();
      for (const lp of localPayments) {
        const key = lp.payment_reference || lp.id;
        const rawStatus = String(lp.status || "").toLowerCase();
        const normStatus = ["approved", "aprobado", "paid", "pagado"].includes(rawStatus) ? "approved" : rawStatus || "approved";
        paymentsMap.set(key, {
          id: lp.id,
          order_id: orderId,
          amount: Number(lp.amount) || 0,
          payment_method: lp.payment_method || "wompi",
          payment_reference: lp.payment_reference || "",
          status: normStatus,
          created_at: lp.created_at || (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      const sbPagosList = Array.isArray(o.sbPagos) ? o.sbPagos : [];
      for (const sp of sbPagosList) {
        const key = sp.referencia_pago || sp.id;
        if (!paymentsMap.has(key)) {
          const rawStatus = String(sp.estado_pago || "").toLowerCase();
          const normStatus = ["approved", "aprobado", "paid", "pagado"].includes(rawStatus) ? "approved" : rawStatus || "approved";
          paymentsMap.set(key, {
            id: sp.id,
            order_id: orderId,
            amount: Number(sp.monto) || 0,
            payment_method: sp.metodo_pago || "wompi",
            payment_reference: sp.referencia_pago || "",
            status: normStatus,
            created_at: sp.created_at || (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      }
      const mergedPayments = Array.from(paymentsMap.values());
      const approvedPayments = mergedPayments.filter((p) => ["approved", "aprobado", "paid", "pagado"].includes(String(p.status || "").toLowerCase()));
      const totalPaidFromPayments = approvedPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
      const effectivePaid = Math.max(totalPaidFromPayments, Number(o.paid_amount || o.abonado) || 0);
      const orderTotal = Number(o.total || o.total_amount) || 0;
      const effectiveBalance = Math.max(0, orderTotal - effectivePaid);
      const effectiveStatus = effectiveBalance <= 0 && orderTotal > 0 ? "pagado" : effectivePaid > 0 ? "abonando" : o.status || "pendiente";
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
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/orders/:id/payments", async (req, res) => {
  try {
    const rawId = String(req.params.id || "").trim();
    if (!rawId) return res.status(400).json({ success: false, error: "ID de pedido requerido" });
    const order = getOrderById(rawId);
    const orderId = order ? order.id : rawId;
    const targetWompiRef = String(order?.wompi_reference || "").trim();
    const localPayments = targetWompiRef && targetWompiRef.length >= 6 ? db.prepare(`
          SELECT * FROM payments 
          WHERE order_id = ? OR (payment_reference = ? AND length(payment_reference) >= 6)
          ORDER BY created_at ASC
        `).all(orderId, targetWompiRef) : db.prepare(`
          SELECT * FROM payments 
          WHERE order_id = ?
          ORDER BY created_at ASC
        `).all(orderId);
    const paymentsMap = /* @__PURE__ */ new Map();
    for (const lp of localPayments) {
      const key = lp.payment_reference || lp.id;
      const rawStatus = String(lp.status || "").toLowerCase();
      const normStatus = ["approved", "aprobado", "paid", "pagado"].includes(rawStatus) ? "approved" : rawStatus || "approved";
      paymentsMap.set(key, {
        id: lp.id,
        order_id: orderId,
        amount: Number(lp.amount) || 0,
        payment_method: lp.payment_method || "wompi",
        payment_reference: lp.payment_reference || "",
        status: normStatus,
        created_at: lp.created_at || (/* @__PURE__ */ new Date()).toISOString()
      });
    }
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
              const normStatus = ["approved", "aprobado", "paid", "pagado"].includes(rawStatus) ? "approved" : rawStatus || "approved";
              paymentsMap.set(key, {
                id: sp.id,
                order_id: orderId,
                amount: Number(sp.monto) || 0,
                payment_method: sp.metodo_pago || "wompi",
                payment_reference: sp.referencia_pago || "",
                status: normStatus,
                created_at: sp.created_at || (/* @__PURE__ */ new Date()).toISOString()
              });
            }
          }
        }
      } catch (sbErr) {
        console.warn("[PAYMENTS SB WARN]", sbErr.message);
      }
    }
    const allPayments = Array.from(paymentsMap.values());
    res.json({
      success: true,
      payments: allPayments,
      count: allPayments.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
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
      } catch (sbErr) {
        console.warn("[SUPABASE DELETE ERR]", sbErr.message);
      }
    }
    logApi("INFO", `DELETE /api/orders/${id}`, `Pedido ${id} (${order.customer_name}) eliminado por el administrador.`);
    res.json({ success: true, message: `Pedido ${id} eliminado con \xE9xito` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/orders/clean-errors", adminAuthMiddleware, async (req, res) => {
  try {
    const orders = getAllOrders();
    const errorOrders = orders.filter(
      (o) => o.yeminus_sync_status === "ERP_SYNC_FAILED" || o.yeminus_sync_status === "ERROR" || o.yeminus_last_error && !o.yeminus_document_id || o.customer_name?.toLowerCase().includes("prueba") || o.customer_name?.toLowerCase().includes("test")
    );
    let deletedCount = 0;
    const supabase = getSupabaseAdmin();
    for (const eo of errorOrders) {
      deleteOrder(eo.id);
      if (supabase) {
        try {
          await supabase.from("pagos").delete().eq("pedido_id", eo.id);
          await supabase.from("pedidos").delete().eq("id", eo.id);
        } catch {
        }
      }
      deletedCount++;
    }
    logApi("INFO", "POST /api/orders/clean-errors", `Se eliminaron ${deletedCount} pedidos con errores.`);
    res.json({
      success: true,
      deletedCount,
      message: `Se eliminaron ${deletedCount} pedidos con errores o de prueba del sistema.`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/payments", async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return res.status(500).json({ success: false, error: "Supabase no disponible" });
    const { data: pagos, error } = await supabase.from("pagos").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    const mappedPayments = (pagos || []).map((p) => ({
      id: p.id,
      order_id: p.pedido_id,
      amount: Number(p.monto) || 0,
      payment_method: p.metodo_pago || "wompi",
      payment_reference: p.referencia_pago,
      status: p.estado_pago === "aprobado" ? "approved" : "pending",
      created_at: p.created_at
    }));
    res.json({ success: true, payments: mappedPayments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/receipt/:idOrRef", async (req, res) => {
  try {
    const { idOrRef } = req.params;
    if (!idOrRef) return res.status(400).json({ success: false, error: "Identificador requerido" });
    const supabase = getSupabaseAdmin();
    let order = null;
    let payment = null;
    const sqliteOrder = getOrderById(idOrRef) || getOrderByWompiRef(idOrRef);
    if (sqliteOrder) {
      const prodSummary = sqliteOrder.items && sqliteOrder.items.length > 0 ? sqliteOrder.items.map((it) => `${it.quantity}x ${it.product_name}`).join(", ") : "Pedido Navide\xF1o Impormax";
      const primaryId = sqliteOrder.items && sqliteOrder.items.length > 0 ? sqliteOrder.items[0].product_reference || sqliteOrder.items[0].product_id : "";
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
      const { data: pagos } = await supabase.from("pagos").select("*, pedidos(*)").or(`referencia_pago.eq.${idOrRef},id.eq.${idOrRef}`).limit(1);
      if (pagos && pagos.length > 0) {
        payment = pagos[0];
        order = payment.pedidos;
      }
      if (!order) {
        const { data: peds } = await supabase.from("pedidos").select("*").or(`id.eq.${idOrRef},producto_name.ilike.%${idOrRef}%`).limit(1);
        if (peds && peds.length > 0) {
          order = peds[0];
          const { data: payList } = await supabase.from("pagos").select("*").eq("pedido_id", order.id).order("created_at", { ascending: false });
          if (payList && payList.length > 0) {
            payment = payList[0];
          }
        }
      }
    }
    let wompiTx = null;
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
    } catch (e) {
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
      payment?.monto || (wompiTx?.amount_in_cents ? wompiTx.amount_in_cents / 100 : order?.abonado || 0),
      payment
    );
    res.json({ success: true, receipt, order, payment });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/wompi/webhook", async (req, res) => {
  try {
    const event = req.body;
    logApi("INFO", "POST /api/wompi/webhook", "Webhook recibido de Wompi", event);
    if (event && event.event === "transaction.updated") {
      const transaction = event.data?.transaction;
      if (transaction && transaction.id) {
        const prvKey = process.env.WOMPI_PRIVATE_KEY || "prv_prod_aUM7wa7SEXtMwL6fqgFUPdBkBeuda2v8";
        let verifiedTx = transaction;
        try {
          const verifyResp = await fetch(`https://production.wompi.co/v1/transactions/${transaction.id}`, {
            headers: { "Authorization": `Bearer ${prvKey}` }
          });
          if (verifyResp.ok) {
            const verifyJson = await verifyResp.json();
            if (verifyJson.data) verifiedTx = verifyJson.data;
          }
        } catch (vErr) {
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
  } catch (err) {
    logApi("ERROR", "POST /api/wompi/webhook", err.message);
    res.status(500).json({ error: err.message });
  }
});
async function startServer() {
  try {
    const sbAdmin = getSupabaseAdmin();
    if (sbAdmin) {
      syncAndRecoverFromSupabase(sbAdmin).then((count) => {
        console.log(`[DATABASE RECOVERY] Sincronizados y normalizados ${count} pedidos desde Supabase hacia la base de datos relacional local.`);
      });
    }
  } catch (e) {
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
    } catch (err) {
      logApi("ERROR", "SYSTEM", "Fallo al iniciar Vite dev, sirviendo archivos est\xE1ticos: " + err.message);
      serveStatic();
    }
  } else {
    serveStatic();
  }
  function serveStatic() {
    const possibleDirs = [
      import_path2.default.join(process.cwd(), "dist"),
      process.cwd(),
      import_path2.default.join(currentDir, "dist"),
      currentDir
    ];
    const targetPath = possibleDirs.find((d) => import_fs2.default.existsSync(import_path2.default.join(d, "index.html"))) || process.cwd();
    const assetsPath = import_path2.default.join(targetPath, "assets");
    app.use("/plansepare/assets", import_express.default.static(assetsPath));
    app.use("/plansepare", import_express.default.static(targetPath, { index: false }));
    app.use("/assets", import_express.default.static(assetsPath));
    app.use(import_express.default.static(targetPath, { index: false }));
    if (import_fs2.default.existsSync(assetsPath)) {
      app.use(import_express.default.static(assetsPath));
    }
    app.use((req, res) => {
      if (req.path.startsWith("/api/")) {
        return res.status(404).json({ error: "Ruta de API no encontrada: " + req.path });
      }
      if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|json|woff|woff2|ttf|eot)$/i.test(req.path)) {
        return res.status(404).send(`Archivo no encontrado: ${req.path}`);
      }
      const indexPath = import_path2.default.join(targetPath, "index.html");
      if (import_fs2.default.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send(`Error: index.html no encontrado en ${indexPath}`);
      }
    });
    logApi("INFO", "SYSTEM", `Servidor est\xE1tico listo sirviendo desde: ${targetPath}`);
  }
  if (typeof globalThis.PhusionPassenger !== "undefined") {
    app.listen("passenger", () => {
      console.log("Server running on Phusion Passenger");
    });
  } else {
    const port = isDev ? 3e3 : Number(process.env.PORT) || 3e3;
    app.listen(port, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${port} (${isDev ? "development" : "production"})`);
    });
  }
  setTimeout(() => {
    reconcileWompiApprovedTransactions({ days: 90 }).catch((e) => console.warn("[WOMPI AUTO RECONCILE STARTUP ERR]", e.message));
  }, 3e3);
  setInterval(() => {
    reconcileWompiApprovedTransactions({ days: 14 }).catch((e) => console.warn("[WOMPI INTERVAL RECONCILE ERR]", e.message));
  }, 10 * 60 * 1e3);
}
startServer();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  adminAuthMiddleware,
  verifyAdminToken
});
//# sourceMappingURL=server.cjs.map
