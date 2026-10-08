// Builds and emails the Smart Car Wash booking invoice (SCWBS invoice
// template). Only called by verify-paystack-payment after Paystack has
// confirmed the transaction and the booking has been marked as paid.

const VAT_RATE = 0.15;
const TIME_ZONE = "Africa/Johannesburg";

// Mirrors src/lib/packages.ts — edge functions can't import from src/.
const PACKAGE_DETAILS: Record<string, { name: string; features: string[] }> = {
  basic: { name: "Basic shine", features: ["Exterior wash", "Wheel rinse", "Hand dry"] },
  premium: { name: "Premium detail", features: ["Everything in Basic", "Interior vacuum", "Tire shine", "Window polish"] },
  deluxe: { name: "Deluxe showroom", features: ["Everything in Premium", "Hand wax", "Leather conditioning", "Engine bay clean"] },
};

export type InvoiceItem = {
  type: string;
  description: string;
  qty: number;
  unitPrice: number;
  amount: number;
};

export type InvoiceData = {
  invoiceNumber: string;
  invoiceDate: string;
  paymentDate: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  bookingRef: string;
  vehicle: string;
  registration: string;
  bookingSlot: string;
  items: InvoiceItem[];
  paymentMethod: string;
  transactionId: string;
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
};

type Booking = {
  id: string;
  car_make: string;
  car_model: string;
  car_plate: string;
  package: string;
  scheduled_at: string;
};

type Profile = {
  full_name?: string | null;
  surname?: string | null;
  phone?: string | null;
  email?: string | null;
} | null;

// deno-lint-ignore no-explicit-any
type PaystackTransaction = Record<string, any>;

const round2 = (value: number) => Math.round(value * 100) / 100;

const formatDate = (value: string | Date) =>
  new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE }).format(new Date(value));

const formatSlot = (value: string) =>
  new Intl.DateTimeFormat("en-ZA", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TIME_ZONE,
  }).format(new Date(value));

const formatMoney = (value: number) =>
  value.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ /g, " ");

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const describePaymentMethod = (transaction: PaystackTransaction) => {
  const channel = String(transaction.channel ?? "online payment").replace(/_/g, " ");
  const auth = transaction.authorization ?? {};
  if (channel === "card" && auth.last4) {
    const brand = auth.card_type ? capitalize(String(auth.card_type).trim()) : "Card";
    return `${brand} •••• ${auth.last4} (Paystack)`;
  }
  return `${capitalize(channel)} (Paystack)`;
};

export const buildBookingInvoice = (booking: Booking, profile: Profile, fallbackEmail: string, transaction: PaystackTransaction): InvoiceData => {
  // Prices in the system are VAT-inclusive, so split the paid total into
  // its VAT-exclusive subtotal and the 15% VAT portion.
  const total = round2(Number(transaction.amount) / 100);
  const subtotal = round2(total / (1 + VAT_RATE));
  const vat = round2(total - subtotal);
  const pkg = PACKAGE_DETAILS[booking.package] ?? { name: capitalize(booking.package), features: [] };
  const paidAt = transaction.paid_at ?? transaction.paidAt ?? new Date().toISOString();
  const bookingRef = booking.id.slice(0, 8).toUpperCase();
  const name = [profile?.full_name, profile?.surname].filter(Boolean).join(" ").trim();

  return {
    invoiceNumber: `SCW-${new Date(paidAt).toISOString().slice(0, 10).replace(/-/g, "")}-${bookingRef}`,
    invoiceDate: formatDate(new Date()),
    paymentDate: formatDate(paidAt),
    customerName: name || "Valued customer",
    customerEmail: profile?.email || fallbackEmail,
    customerPhone: profile?.phone || "—",
    bookingRef,
    vehicle: `${booking.car_make} ${booking.car_model}`.trim(),
    registration: booking.car_plate.toUpperCase(),
    bookingSlot: formatSlot(booking.scheduled_at),
    items: [{
      type: "Service",
      description: pkg.features.length ? `${pkg.name} — ${pkg.features.join(", ")}` : pkg.name,
      qty: 1,
      unitPrice: subtotal,
      amount: subtotal,
    }],
    paymentMethod: describePaymentMethod(transaction),
    transactionId: String(transaction.id ?? transaction.reference),
    subtotal,
    discount: 0,
    vat,
    total,
  };
};

export const renderInvoiceHtml = (invoice: InvoiceData) => {
  const e = (value: string) => escapeHtml(value);
  const blue = "#0b7bb8";
  const ink = "#14212b";
  const muted = "#5b6b78";
  const label = `font-size:11px;letter-spacing:1.5px;font-weight:600;color:${muted};text-transform:uppercase;`;

  const itemRows = invoice.items.map((item) => `
          <tr>
            <td style="padding:12px 8px;border-bottom:1px solid #d9dee3;color:${ink};font-size:14px;">${e(item.type)}</td>
            <td style="padding:12px 8px;border-bottom:1px solid #d9dee3;color:${ink};font-size:14px;">${e(item.description)}</td>
            <td style="padding:12px 8px;border-bottom:1px solid #d9dee3;color:${ink};font-size:14px;text-align:center;">${item.qty}</td>
            <td style="padding:12px 8px;border-bottom:1px solid #d9dee3;color:${ink};font-size:14px;text-align:right;white-space:nowrap;">R ${formatMoney(item.unitPrice)}</td>
            <td style="padding:12px 8px;border-bottom:1px solid #d9dee3;color:${ink};font-size:14px;text-align:right;white-space:nowrap;">R ${formatMoney(item.amount)}</td>
          </tr>`).join("");

  const detailCell = (title: string, value: string, last = false) => `
              <td valign="top" style="padding:14px 16px;${last ? "" : "border-right:1px solid #c9dff0;"}">
                <div style="${label}">${title}</div>
                <div style="margin-top:6px;font-size:14px;font-weight:600;color:${ink};">${e(value)}</div>
              </td>`;

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice ${e(invoice.invoiceNumber)}</title></head>
<body style="margin:0;padding:0;background:#f1f4f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:${ink};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f4f7;padding:24px 8px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;background:#ffffff;border-radius:8px;">
        <!-- Header -->
        <tr><td style="padding:36px 36px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td valign="top">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="width:52px;height:52px;background:${blue};border-radius:10px;text-align:center;vertical-align:middle;font-size:26px;color:#ffffff;">&#128167;</td>
                <td style="padding-left:14px;">
                  <div style="font-size:26px;font-weight:800;color:${ink};">Smart Car Wash</div>
                  <div style="font-size:13px;color:${muted};margin-top:2px;">Booking System · SCWBS</div>
                </td>
              </tr></table>
            </td>
            <td valign="top" align="right">
              <div style="font-size:32px;font-weight:800;letter-spacing:4px;color:${blue};">INVOICE</div>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:8px;font-size:13px;color:${muted};">
                <tr><td align="right" style="padding:3px 12px 3px 0;">Invoice no.</td><td align="right" style="font-weight:600;color:${ink};">${e(invoice.invoiceNumber)}</td></tr>
                <tr><td align="right" style="padding:3px 12px 3px 0;">Invoice date</td><td align="right" style="font-weight:600;color:${ink};">${e(invoice.invoiceDate)}</td></tr>
                <tr><td align="right" style="padding:3px 12px 3px 0;">Payment date</td><td align="right" style="font-weight:600;color:${ink};">${e(invoice.paymentDate)}</td></tr>
              </table>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="border-top:4px solid ${blue};font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- From / Bill to -->
        <tr><td style="padding:28px 36px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td valign="top" width="50%" style="font-size:14px;line-height:1.7;">
              <div style="${label}">From</div>
              <div style="font-weight:700;">Smart Car Wash</div>
              <div>Bester Last 311-Jt</div><div>Mbombela</div><div>1201</div>
            </td>
            <td valign="top" width="50%" style="font-size:14px;line-height:1.7;">
              <div style="${label}">Bill to</div>
              <div style="font-weight:700;">${e(invoice.customerName)}</div>
              <div>${e(invoice.customerEmail)}</div>
              <div>${e(invoice.customerPhone)}</div>
            </td>
          </tr></table>
        </td></tr>

        <!-- Booking details -->
        <tr><td style="padding:16px 36px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e4f0f9;border:1px solid #c9dff0;border-radius:6px;"><tr>
            ${detailCell("Booking ref", invoice.bookingRef)}
            ${detailCell("Vehicle", invoice.vehicle)}
            ${detailCell("Registration", invoice.registration)}
            ${detailCell("Date &amp; time", invoice.bookingSlot, true)}
          </tr></table>
        </td></tr>

        <!-- Items -->
        <tr><td style="padding:16px 36px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <th align="left" style="padding:10px 8px;border-bottom:2px solid ${ink};white-space:nowrap;${label}">Type</th>
              <th align="left" style="padding:10px 8px;border-bottom:2px solid ${ink};white-space:nowrap;${label}">Description</th>
              <th align="center" style="padding:10px 8px;border-bottom:2px solid ${ink};white-space:nowrap;${label}">Qty</th>
              <th align="right" style="padding:10px 8px;border-bottom:2px solid ${ink};white-space:nowrap;${label}">Unit price</th>
              <th align="right" style="padding:10px 8px;border-bottom:2px solid ${ink};white-space:nowrap;${label}">Amount</th>
            </tr>${itemRows}
          </table>
        </td></tr>

        <!-- Payment + totals -->
        <tr><td style="padding:20px 36px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td valign="top" width="48%" style="font-size:14px;line-height:1.7;color:${muted};padding-right:16px;">
              <div style="font-size:13px;letter-spacing:2px;font-weight:700;color:${muted};">PAYMENT</div>
              <div>Paid by <strong style="color:${ink};">${e(invoice.paymentMethod)}</strong></div>
              <div>Transaction ID <strong style="color:${ink};">${e(invoice.transactionId)}</strong></div>
              <div style="margin-top:6px;">Please show this invoice or your booking reference when you arrive.</div>
            </td>
            <td valign="top" width="52%">
              <div style="text-align:right;margin-bottom:10px;">
                <span style="display:inline-block;background:#dff3e6;color:#1f7a45;font-weight:700;font-size:13px;letter-spacing:1.5px;padding:6px 16px;border-radius:999px;">PAID</span>
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;color:${ink};">
                <tr><td style="padding:6px 0;">Subtotal</td><td align="right">R ${formatMoney(invoice.subtotal)}</td></tr>
                <tr><td style="padding:6px 0;">Discount</td><td align="right">− R ${formatMoney(invoice.discount)}</td></tr>
                <tr><td style="padding:6px 0 12px;border-bottom:2px solid ${ink};">VAT (15%)</td><td align="right" style="padding-bottom:12px;border-bottom:2px solid ${ink};">R ${formatMoney(invoice.vat)}</td></tr>
                <tr><td style="padding:14px 0 0;font-size:19px;font-weight:700;">Total paid</td><td align="right" style="padding-top:14px;font-size:19px;font-weight:800;color:${blue};">R ${formatMoney(invoice.total)}</td></tr>
              </table>
            </td>
          </tr></table>
        </td></tr>

        <tr><td style="border-top:1px solid #d9dee3;padding:20px 36px 32px;text-align:center;font-size:13px;color:${muted};">
          Thank you for booking with Smart Car Wash · Bester Last 311-Jt, Mbombela, 1201
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

export const sendInvoiceEmail = async (invoice: InvoiceData) => {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) throw new Error("RESEND_API_KEY is not set — cannot send the invoice email.");

  // Resend's onboarding@resend.dev sender only delivers to the Resend account
  // owner. Set INVOICE_FROM_EMAIL to an address on a verified domain so
  // customers actually receive their invoices.
  const from = Deno.env.get("INVOICE_FROM_EMAIL") || "Smart Car Wash <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [invoice.customerEmail],
      subject: `Your Smart Car Wash invoice ${invoice.invoiceNumber} — PAID`,
      html: renderInvoiceHtml(invoice),
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend API error ${response.status}: ${await response.text()}`);
  }
};
