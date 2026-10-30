import nodemailer from "nodemailer";

// Configuración de transporte SMTP oficial de Impormax
const SMTP_CONFIG = {
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

const transporter = nodemailer.createTransport(SMTP_CONFIG);

function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(amount);
}

function formatDate(dateInput?: string | Date): string {
  try {
    const d = dateInput ? new Date(dateInput) : new Date();
    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "America/Bogota"
    }).format(d);
  } catch {
    return new Date().toLocaleDateString("es-CO");
  }
}

export interface OrderEmailPayload {
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  customer_document?: string;
  shipping_address?: string;
  shipping_city?: string;
  notes?: string;
  wompi_reference?: string;
  wompi_transaction_id?: string;
  yeminus_document_id?: string;
  total_amount: number;
  paid_amount: number;
  balance_pending?: number;
  product_name?: string;
  product_id?: string;
  items?: Array<{
    product_name?: string;
    name?: string;
    product_id?: string;
    product_reference?: string;
    id?: string;
    quantity: number;
    unit_price?: number;
    price?: number;
    total?: number;
  }>;
  created_at?: string;
  payment_method_label?: string;
}

export async function sendOrderConfirmationEmail(order: OrderEmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const recipient = String(order.customer_email || "").trim();
  if (!recipient || !recipient.includes("@")) {
    console.warn("[EMAIL WARN] Correo del cliente inválido o ausente:", recipient);
    return { success: false, error: "Correo de cliente inválido o ausente" };
  }

  const customerName = String(order.customer_name || "Estimado(a) Cliente").trim();
  const radicadoYeminus = order.yeminus_document_id || "En proceso de asignación";
  const wompiRef = order.wompi_reference || "N/A";
  const txId = order.wompi_transaction_id || "";
  const total = Number(order.total_amount) || 0;
  const paid = Number(order.paid_amount) || 0;
  const balance = order.balance_pending !== undefined ? Number(order.balance_pending) : Math.max(0, total - paid);
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
      total: total
    }];
  }
  const itemsHtml = items.map((it, idx) => {
    const name = it.product_name || it.name || "Producto Navideño";
    const ref = it.product_reference || it.product_id || it.id || "";
    const qty = Number(it.quantity) || 1;
    const unitPrice = Number(it.unit_price || it.price) || (qty > 0 ? Math.round((Number(it.total) || 0) / qty) : 0);
    const itemTot = Number(it.total) || (unitPrice * qty);

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
  <title>Confirmación de Pedido - Impormax Navidad</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Contenedor Principal -->
        <table role="presentation" width="100%" style="max-width: 620px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
          
          <!-- Encabezado Navideño Impormax -->
          <tr>
            <td style="background: linear-gradient(135deg, #064e3b 0%, #047857 60%, #065f46 100%); padding: 32px 28px; text-align: center; color: #ffffff;">
              <div style="font-size: 28px; font-weight: 800; letter-spacing: 1px; color: #fde047; margin-bottom: 4px;">
                ★ IMPORMAX NAVIDAD ★
              </div>
              <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 2px; color: #a7f3d0; margin-bottom: 16px;">
                Pereira - Risaralda | Cra 7 # 21-42 Centro
              </div>
              <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 9999px; padding: 6px 18px; font-size: 14px; font-weight: 700; color: #ffffff;">
                ✓ ¡Tu ${isFullyPaid ? "Compra" : "Plan Separe"} ha sido confirmado!
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
                Hemos recibido y confirmado tu pago exitosamente. A continuación encontrarás todos los detalles oficiales de tu orden y el radicado formal en nuestro sistema ERP.
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
                        <td style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700; padding-top: 8px;">ID Transacción:</td>
                        <td style="text-align: right; font-size: 12px; color: #64748b; font-family: monospace; padding-top: 8px;">${txId}</td>
                      </tr>` : ""}
                      <tr>
                        <td style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700; padding-top: 8px;">Método de Pago:</td>
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

              <!-- Tabla de Artículos -->
              <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 12px; letter-spacing: 0.5px;">
                📦 Artículos en tu Pedido:
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
                  ${itemsHtml || `<tr><td colspan="4" style="padding: 16px; text-align: center; color: #64748b;">Artículos de temporada navideña</td></tr>`}
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
                    ${isFullyPaid ? "PAGADO TOTALMENTE ✓" : formatCOP(balance)}
                  </td>
                </tr>
                ${!isFullyPaid ? `
                <tr>
                  <td colspan="2" style="font-size: 12px; color: #64748b; padding-top: 8px;">
                    * Recuerda que tienes plazo de cancelar tu saldo restante en abonos libres antes del <strong>16 de noviembre de 2026</strong>.
                  </td>
                </tr>` : ""}
              </table>

              <!-- Datos de Envío y Destinatario -->
              <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 12px;">
                📍 Información de Despacho y Contacto:
              </div>
              <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; font-size: 13px; color: #334155; line-height: 1.6;">
                <div><strong>Destinatario:</strong> ${customerName}</div>
                ${cleanDoc ? `<div><strong>Cédula / NIT:</strong> ${cleanDoc}</div>` : ""}
                ${order.customer_phone ? `<div><strong>Teléfono / WhatsApp:</strong> ${order.customer_phone}</div>` : ""}
                <div><strong>Dirección de Entrega:</strong> ${address}</div>
                <div><strong>Ciudad / Destino:</strong> ${city}</div>
                ${notes ? `<div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #e2e8f0; color: #64748b;"><em>Observaciones: "${notes}"</em></div>` : ""}
              </div>

              <!-- Botones de Acción -->
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
                ¿Tienes preguntas o deseas realizar un nuevo abono? Escríbenos directamente a nuestro WhatsApp oficial o responde a este correo.
              </p>
            </td>
          </tr>

          <!-- Pie de Página -->
          <tr>
            <td style="background-color: #0f172a; padding: 24px 28px; text-align: center; color: #94a3b8; font-size: 12px; line-height: 1.6;">
              <div style="font-weight: 700; color: #f8fafc; font-size: 14px; margin-bottom: 4px;">
                Distribuidora Impormax S.A.S.
              </div>
              <div>NIT: 816.008.621-1 | Pereira, Risaralda, Colombia</div>
              <div style="margin-top: 12px; color: #64748b; font-size: 11px;">
                Este es un comprobante de notificación oficial generado automáticamente tras la confirmación de tu pago en pasarela Wompi. Por favor conserva este correo para tu radicado.
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
IMPORMAX NAVIDAD - Confirmación de ${isFullyPaid ? "Compra" : "Plan Separe"}
============================================================
Hola ${customerName},

¡Tu pago ha sido confirmado exitosamente!

DETALLES OFICIALES:
- Radicado ERP Yeminus: ${radicadoYeminus}
- Referencia Wompi: ${wompiRef}
${txId ? `- ID Transacción: ${txId}\n` : ""}- Método de Pago: ${methodLabel}
- Fecha: ${dateFormatted}

RESUMEN FINANCIERO:
- Total del Pedido: ${formatCOP(total)}
- Monto Abonado Hoy: ${formatCOP(paid)}
- Saldo Restante: ${isFullyPaid ? "PAGADO TOTALMENTE" : formatCOP(balance)}

DATOS DE ENTREGA:
- Destinatario: ${customerName}
- Documento: ${cleanDoc}
- Dirección: ${address}
- Ciudad: ${city}
${order.customer_phone ? `- Teléfono: ${order.customer_phone}\n` : ""}${notes ? `- Observaciones: ${notes}\n` : ""}
ARTÍCULOS:
${items.map(it => `• ${it.quantity}x ${it.product_name || it.name} - Total: ${formatCOP(Number(it.total) || 0)}`).join("\n")}

Distribuidora Impormax S.A.S. - Pereira, Colombia
Cra 7 # 21-42 Centro
  `.trim();

  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || '"Impormax Navidad" <notificaciones@impormax.net>',
      to: recipient,
      bcc: "notificaciones@impormax.net", // Copia oculta a la tienda para registro administrativo
      subject: `🎄 Confirmación de tu ${isFullyPaid ? "Pedido" : "Plan Separe"} [${radicadoYeminus}] - Impormax Navidad`,
      text: textContent,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL SUCCESS] Correo de confirmación enviado exitosamente a ${recipient} (Radicado: ${radicadoYeminus}, ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error(`[EMAIL ERROR] Fallo al enviar correo a ${recipient}:`, err.message);
    return { success: false, error: err.message };
  }
}
