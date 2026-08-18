import { customAlphabet } from "nanoid";
import type { Order, OrderStatus } from "@/lib/db/schema";
import { platformEmailFrom, platformName } from "@/lib/platform";
import type { Tenant } from "@/lib/tenant-schema";

const nanoid = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 10);
const tokenId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 24);

export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type DetailRow = { label: string; value: string };

type EmailContent = {
  preview: string;
  greeting?: string;
  intro: string[];
  details?: DetailRow[];
  outro?: string[];
  cta?: { label: string; url: string };
  secondaryLinks?: Array<{ label: string; url: string }>;
  signoffName: string;
  signoffLine?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function listingsUrl(tenant: Tenant) {
  return `${tenant.siteUrl.replace(/\/$/, "")}/portal`;
}

function firstName(fullName: string) {
  const trimmed = fullName.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function buildText(content: EmailContent) {
  const lines: string[] = [];
  if (content.greeting) lines.push(content.greeting, "");
  for (const paragraph of content.intro) {
    lines.push(paragraph, "");
  }
  if (content.details?.length) {
    for (const row of content.details) {
      lines.push(`${row.label}: ${row.value}`);
    }
    lines.push("");
  }
  if (content.cta) {
    lines.push(content.cta.label, content.cta.url, "");
  }
  if (content.secondaryLinks?.length) {
    for (const link of content.secondaryLinks) {
      lines.push(`${link.label}: ${link.url}`);
    }
    lines.push("");
  }
  if (content.outro?.length) {
    for (const paragraph of content.outro) {
      lines.push(paragraph, "");
    }
  }
  lines.push(`— ${content.signoffName}`);
  if (content.signoffLine) lines.push(content.signoffLine);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function buildHtml(content: EmailContent) {
  const brand = platformName();
  const detailRows =
    content.details
      ?.map(
        (row) => `
      <tr>
        <td style="padding:8px 0;color:#4a524c;font-size:13px;width:120px;vertical-align:top;">${escapeHtml(row.label)}</td>
        <td style="padding:8px 0;color:#171a17;font-size:14px;font-weight:500;">${escapeHtml(row.value)}</td>
      </tr>`,
      )
      .join("") ?? "";

  const introHtml = content.intro
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;color:#171a17;font-size:15px;line-height:1.55;">${escapeHtml(paragraph)}</p>`,
    )
    .join("");

  const outroHtml =
    content.outro
      ?.map(
        (paragraph) =>
          `<p style="margin:16px 0 0;color:#171a17;font-size:15px;line-height:1.55;">${escapeHtml(paragraph)}</p>`,
      )
      .join("") ?? "";

  const ctaHtml = content.cta
    ? `
      <p style="margin:24px 0;">
        <a href="${escapeHtml(content.cta.url)}"
           style="display:inline-block;background:#2f5d50;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 18px;border-radius:2px;">
          ${escapeHtml(content.cta.label)}
        </a>
      </p>
      <p style="margin:0 0 16px;color:#4a524c;font-size:12px;line-height:1.5;word-break:break-all;">
        Or open this link:<br />${escapeHtml(content.cta.url)}
      </p>`
    : "";

  const secondaryHtml =
    content.secondaryLinks
      ?.map(
        (link) =>
          `<p style="margin:0 0 8px;color:#4a524c;font-size:13px;line-height:1.5;">
            ${escapeHtml(link.label)}:<br />
            <a href="${escapeHtml(link.url)}" style="color:#2f5d50;word-break:break-all;">${escapeHtml(link.url)}</a>
          </p>`,
      )
      .join("") ?? "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(content.preview)}</title>
</head>
<body style="margin:0;padding:0;background:#e8ebe6;font-family:Figtree,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.preview)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#e8ebe6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fcfdfa;border:1px solid rgba(23,26,23,0.12);">
          <tr>
            <td style="padding:20px 28px;border-bottom:1px solid rgba(23,26,23,0.12);">
              <p style="margin:0;color:#2f5d50;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">${escapeHtml(brand)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              ${
                content.greeting
                  ? `<p style="margin:0 0 16px;color:#171a17;font-size:15px;line-height:1.55;">${escapeHtml(content.greeting)}</p>`
                  : ""
              }
              ${introHtml}
              ${
                detailRows
                  ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 8px;border-top:1px solid rgba(23,26,23,0.12);border-bottom:1px solid rgba(23,26,23,0.12);">${detailRows}</table>`
                  : ""
              }
              ${ctaHtml}
              ${secondaryHtml}
              ${outroHtml}
              <p style="margin:28px 0 0;color:#171a17;font-size:15px;line-height:1.55;">
                — ${escapeHtml(content.signoffName)}${
                  content.signoffLine
                    ? `<br /><span style="color:#4a524c;font-size:13px;">${escapeHtml(content.signoffLine)}</span>`
                    : ""
                }
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function composeEmail(to: string, subject: string, content: EmailContent): OutboundEmail {
  return {
    to,
    subject,
    text: buildText(content),
    html: buildHtml(content),
  };
}

/**
 * Sends transactional email when RESEND_API_KEY is set.
 * Otherwise logs to the server console so local booking still works.
 */
export async function sendEmail(message: OutboundEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = platformEmailFrom();

  if (!apiKey) {
    console.info("[email:stub]", {
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    return { ok: true as const, stubbed: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html ?? `<pre>${escapeHtml(message.text)}</pre>`,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("[email] Resend failed", response.status, body);
    let detail = "Email provider rejected the message.";
    try {
      const parsed = JSON.parse(body) as { message?: string };
      if (parsed.message) detail = parsed.message;
    } catch {
      // keep default
    }
    return { ok: false as const, error: detail };
  }

  return { ok: true as const, stubbed: false };
}

export function bookingConfirmationEmail(options: {
  tenant: Tenant;
  agentName: string;
  agentEmail: string;
  propertyAddress: string;
  packageName: string;
  priceLabel: string;
  slotLabel: string;
  confirmationUrl: string;
}) {
  const { tenant } = options;
  const prepUrl = `${tenant.siteUrl.replace(/\/$/, "")}/prep`;

  return composeEmail(
    options.agentEmail,
    `We received your shoot request — ${options.propertyAddress}`,
    {
      preview: `Your shoot request with ${tenant.studioName} is in.`,
      greeting: `Hi ${firstName(options.agentName)},`,
      intro: [
        `Thank you for booking with ${tenant.studioName}. We've received your shoot request and will confirm one of your preferred times shortly.`,
      ],
      details: [
        { label: "Property", value: options.propertyAddress },
        { label: "Package", value: options.packageName },
        { label: "Quote", value: options.priceLabel },
        { label: "Preferred times", value: options.slotLabel },
      ],
      cta: { label: "View request summary", url: options.confirmationUrl },
      secondaryLinks: [
        { label: "Seller prep checklist", url: prepUrl },
        { label: "Your listings", url: listingsUrl(tenant) },
      ],
      outro: [
        "Please share the prep checklist with your seller ahead of the shoot so we can make the most of time on site.",
      ],
      signoffName: tenant.photographerName,
      signoffLine: tenant.email,
    },
  );
}

export function photographerNotifyEmail(options: {
  tenant: Tenant;
  orderId: string;
  agentName: string;
  agentEmail: string;
  agentPhone?: string | null;
  brokerage?: string | null;
  propertyAddress: string;
  city?: string | null;
  postalCode?: string | null;
  packageName: string;
  priceLabel: string;
  slotLabel: string;
  squareFootage?: number | null;
  occupancy?: string | null;
  accessType?: string | null;
  accessNotes?: string | null;
  pets?: string | null;
  parkingNotes?: string | null;
  meetingContact?: string | null;
  notes?: string | null;
  adminUrl: string;
}) {
  const details: DetailRow[] = [
    { label: "Order", value: options.orderId },
    { label: "Agent", value: `${options.agentName} <${options.agentEmail}>` },
  ];
  if (options.agentPhone?.trim()) {
    details.push({ label: "Phone", value: options.agentPhone.trim() });
  }
  if (options.brokerage?.trim()) {
    details.push({ label: "Brokerage", value: options.brokerage.trim() });
  }
  const propertyLine = [
    options.propertyAddress,
    options.city?.trim(),
    options.postalCode?.trim(),
  ]
    .filter(Boolean)
    .join(", ");
  details.push({ label: "Property", value: propertyLine });
  details.push({ label: "Package", value: options.packageName });
  if (options.squareFootage) {
    details.push({ label: "Size", value: `${options.squareFootage} sq ft` });
  }
  details.push({ label: "Quote", value: options.priceLabel });
  details.push({ label: "Preferred times", value: options.slotLabel });
  if (options.occupancy) {
    details.push({ label: "Occupancy", value: options.occupancy });
  }
  if (options.accessType) {
    details.push({ label: "Access", value: options.accessType });
  }
  if (options.accessNotes?.trim()) {
    details.push({ label: "Access notes", value: options.accessNotes.trim() });
  }
  if (options.meetingContact?.trim()) {
    details.push({
      label: "Meeting contact",
      value: options.meetingContact.trim(),
    });
  }
  if (options.pets?.trim()) {
    details.push({ label: "Pets", value: options.pets.trim() });
  }
  if (options.parkingNotes?.trim()) {
    details.push({ label: "Parking", value: options.parkingNotes.trim() });
  }
  if (options.notes?.trim()) {
    details.push({ label: "Notes", value: options.notes.trim() });
  }

  return composeEmail(
    options.tenant.email,
    `New shoot request — ${options.propertyAddress}`,
    {
      preview: `New booking from ${options.agentName} for ${options.propertyAddress}.`,
      greeting: `Hi ${firstName(options.tenant.photographerName)},`,
      intro: [
        "A new shoot request just came in. Review the details below and confirm a time from your admin board.",
      ],
      details,
      cta: { label: "Open admin board", url: options.adminUrl },
      signoffName: platformName(),
    },
  );
}

export function newOrderId() {
  return `ord_${nanoid()}`;
}

export function newPublicToken() {
  return tokenId();
}

export function newAppointmentId() {
  return `apt_${nanoid()}`;
}

export function orderStatusEmail(options: {
  tenant: Tenant;
  order: Order;
  status: OrderStatus;
  galleryUrl?: string;
  listingUrl?: string;
  listingCopyUrl?: string;
  prepUrl?: string;
  scheduledLabel?: string;
}): OutboundEmail | null {
  const { tenant, order, status } = options;
  const prepUrl = options.prepUrl ?? `${tenant.siteUrl.replace(/\/$/, "")}/prep`;
  const name = firstName(order.agentName);

  if (status === "confirmed") {
    const details: DetailRow[] = [
      { label: "Property", value: order.propertyAddress },
      { label: "Package", value: order.packageName },
    ];
    if (options.scheduledLabel) {
      details.push({ label: "Scheduled", value: options.scheduledLabel });
    }
    return composeEmail(order.agentEmail, `Your shoot is confirmed — ${order.propertyAddress}`, {
      preview: `Your shoot with ${tenant.studioName} is confirmed.`,
      greeting: `Hi ${name},`,
      intro: [
        `Great news — your shoot with ${tenant.studioName} is confirmed.`,
      ],
      details,
      secondaryLinks: [
        { label: "Seller prep checklist", url: prepUrl },
        { label: "Your listings", url: listingsUrl(tenant) },
      ],
      outro: [
        "Please forward the checklist to your seller so the home is ready when we arrive.",
      ],
      signoffName: tenant.photographerName,
      signoffLine: tenant.email,
    });
  }

  if (status === "shot") {
    return composeEmail(order.agentEmail, `Shoot complete — ${order.propertyAddress}`, {
      preview: `On-site photography for ${order.propertyAddress} is done.`,
      greeting: `Hi ${name},`,
      intro: [
        `We've finished photographing ${order.propertyAddress}. Your images are heading into editing next — we'll email you when the gallery is ready to review.`,
      ],
      details: [
        { label: "Property", value: order.propertyAddress },
        { label: "Package", value: order.packageName },
      ],
      signoffName: tenant.photographerName,
      signoffLine: tenant.email,
    });
  }

  if (status === "editing") {
    return composeEmail(order.agentEmail, `Editing in progress — ${order.propertyAddress}`, {
      preview: `${tenant.studioName} is editing photos for ${order.propertyAddress}.`,
      greeting: `Hi ${name},`,
      intro: [
        `Your photos for ${order.propertyAddress} are being edited. We'll notify you as soon as the gallery is ready.`,
      ],
      details: [
        { label: "Property", value: order.propertyAddress },
        { label: "Package", value: order.packageName },
      ],
      signoffName: tenant.photographerName,
      signoffLine: tenant.email,
    });
  }

  if (status === "delivered") {
    const secondaryLinks: Array<{ label: string; url: string }> = [
      { label: "Your listings", url: listingsUrl(tenant) },
    ];
    if (options.listingUrl) {
      secondaryLinks.push({ label: "Listing page", url: options.listingUrl });
    }
    if (options.listingCopyUrl) {
      secondaryLinks.push({ label: "Add listing copy", url: options.listingCopyUrl });
    }

    return composeEmail(order.agentEmail, `Your photos are ready — ${order.propertyAddress}`, {
      preview: `Your gallery for ${order.propertyAddress} is ready to review.`,
      greeting: `Hi ${name},`,
      intro: [
        `Your gallery for ${order.propertyAddress} is ready. You can preview the images now; unlock full-resolution and MLS downloads from the gallery page.`,
        "Add a headline and description for the listing page when you’re ready — that’s your copy, not the photographer’s.",
      ],
      cta: options.galleryUrl
        ? { label: "Open gallery", url: options.galleryUrl }
        : undefined,
      secondaryLinks,
      signoffName: tenant.photographerName,
      signoffLine: tenant.email,
    });
  }

  if (status === "paid") {
    return composeEmail(order.agentEmail, `Downloads unlocked — ${order.propertyAddress}`, {
      preview: `Payment received. Full downloads are available for ${order.propertyAddress}.`,
      greeting: `Hi ${name},`,
      intro: [
        "Thank you — payment is confirmed. Full-resolution and MLS downloads are now available on your gallery.",
      ],
      cta: options.galleryUrl
        ? { label: "Download photos", url: options.galleryUrl }
        : undefined,
      secondaryLinks: [{ label: "Your listings", url: listingsUrl(tenant) }],
      outro: [
        "If this listing went well, a short review or referral would mean a great deal.",
      ],
      signoffName: tenant.photographerName,
      signoffLine: tenant.email,
    });
  }

  if (status === "cancelled") {
    return composeEmail(order.agentEmail, `Shoot cancelled — ${order.propertyAddress}`, {
      preview: `The shoot for ${order.propertyAddress} has been cancelled.`,
      greeting: `Hi ${name},`,
      intro: [
        `The shoot for ${order.propertyAddress} has been cancelled. If you'd like to rebook, reply to this email or contact ${tenant.email}.`,
      ],
      signoffName: tenant.photographerName,
      signoffLine: tenant.email,
    });
  }

  return null;
}

/**
 * Photographer copy of lifecycle updates so the studio stays in the loop
 * (editors / inbox), even when the change was made in admin.
 */
export function photographerOrderStatusEmail(options: {
  tenant: Tenant;
  order: Order;
  status: OrderStatus;
  galleryUrl?: string;
  adminUrl?: string;
  scheduledLabel?: string;
  priceLabel?: string;
}): OutboundEmail | null {
  const { tenant, order, status } = options;
  const adminUrl =
    options.adminUrl ?? `${tenant.siteUrl.replace(/\/$/, "")}/admin`;
  const name = firstName(tenant.photographerName);

  const baseDetails: DetailRow[] = [
    { label: "Order", value: order.id },
    { label: "Agent", value: `${order.agentName} <${order.agentEmail}>` },
    { label: "Property", value: order.propertyAddress },
    { label: "Package", value: order.packageName },
  ];
  if (options.scheduledLabel) {
    baseDetails.push({ label: "Scheduled", value: options.scheduledLabel });
  }
  if (options.priceLabel) {
    baseDetails.push({ label: "Price", value: options.priceLabel });
  }

  if (status === "confirmed") {
    return composeEmail(
      tenant.email,
      `Shoot confirmed — ${order.propertyAddress}`,
      {
        preview: `You confirmed ${order.propertyAddress} with ${order.agentName}.`,
        greeting: `Hi ${name},`,
        intro: [
          "This shoot is confirmed on your board. A confirmation email was also sent to the agent.",
        ],
        details: baseDetails,
        cta: { label: "Open admin board", url: adminUrl },
        signoffName: platformName(),
      },
    );
  }

  if (status === "shot") {
    return composeEmail(tenant.email, `Marked shot — ${order.propertyAddress}`, {
      preview: `${order.propertyAddress} marked as shot.`,
      greeting: `Hi ${name},`,
      intro: ["Status updated to shot. The agent was notified that editing is next."],
      details: baseDetails,
      cta: { label: "Open admin board", url: adminUrl },
      signoffName: platformName(),
    });
  }

  if (status === "editing") {
    return composeEmail(
      tenant.email,
      `Editing started — ${order.propertyAddress}`,
      {
        preview: `${order.propertyAddress} is in editing.`,
        greeting: `Hi ${name},`,
        intro: ["Status updated to editing. The agent was notified."],
        details: baseDetails,
        cta: { label: "Open admin board", url: adminUrl },
        signoffName: platformName(),
      },
    );
  }

  if (status === "delivered") {
    return composeEmail(
      tenant.email,
      `Gallery delivered — ${order.propertyAddress}`,
      {
        preview: `Gallery delivered to ${order.agentName} for ${order.propertyAddress}.`,
        greeting: `Hi ${name},`,
        intro: [
          "The gallery is live for the agent. They can preview now and unlock full downloads after payment.",
        ],
        details: baseDetails,
        cta: options.galleryUrl
          ? { label: "Open gallery", url: options.galleryUrl }
          : { label: "Open admin board", url: adminUrl },
        signoffName: platformName(),
      },
    );
  }

  if (status === "paid") {
    return composeEmail(
      tenant.email,
      `Payment received — ${order.propertyAddress}`,
      {
        preview: `${order.agentName} paid for ${order.propertyAddress}. Downloads unlocked.`,
        greeting: `Hi ${name},`,
        intro: [
          "Payment cleared and the gallery is unlocked for full downloads. The agent was emailed a confirmation.",
        ],
        details: baseDetails,
        cta: options.galleryUrl
          ? { label: "Open gallery", url: options.galleryUrl }
          : { label: "Open admin board", url: adminUrl },
        signoffName: platformName(),
      },
    );
  }

  if (status === "cancelled") {
    return composeEmail(
      tenant.email,
      `Shoot cancelled — ${order.propertyAddress}`,
      {
        preview: `Cancelled: ${order.propertyAddress} (${order.agentName}).`,
        greeting: `Hi ${name},`,
        intro: [
          "This shoot was cancelled and removed from the calendar. The agent was notified.",
        ],
        details: baseDetails,
        cta: { label: "Open admin board", url: adminUrl },
        signoffName: platformName(),
      },
    );
  }

  return null;
}

export function orderPriceChangeEmail(options: {
  tenant: Tenant;
  order: Order;
  previousPriceLabel: string;
  nextPriceLabel: string;
}): OutboundEmail {
  const { tenant, order } = options;
  return composeEmail(
    order.agentEmail,
    `Updated quote — ${order.propertyAddress}`,
    {
      preview: `Your quote for ${order.propertyAddress} was updated.`,
      greeting: `Hi ${firstName(order.agentName)},`,
      intro: [
        `${tenant.studioName} updated the quote for your shoot. Details below — reply if you have questions.`,
      ],
      details: [
        { label: "Property", value: order.propertyAddress },
        { label: "Package", value: order.packageName },
        { label: "Previous", value: options.previousPriceLabel },
        { label: "Updated quote", value: options.nextPriceLabel },
      ],
      signoffName: tenant.photographerName,
      signoffLine: tenant.email,
    },
  );
}

export function photographerPriceChangeEmail(options: {
  tenant: Tenant;
  order: Order;
  previousPriceLabel: string;
  nextPriceLabel: string;
  adminUrl?: string;
}): OutboundEmail {
  const { tenant, order } = options;
  const adminUrl =
    options.adminUrl ?? `${tenant.siteUrl.replace(/\/$/, "")}/admin`;
  return composeEmail(
    tenant.email,
    `Quote updated — ${order.propertyAddress}`,
    {
      preview: `Quote for ${order.propertyAddress} changed to ${options.nextPriceLabel}.`,
      greeting: `Hi ${firstName(tenant.photographerName)},`,
      intro: [
        "You updated this booking’s quote. The agent was emailed the new amount.",
      ],
      details: [
        { label: "Order", value: order.id },
        { label: "Agent", value: `${order.agentName} <${order.agentEmail}>` },
        { label: "Property", value: order.propertyAddress },
        { label: "Previous", value: options.previousPriceLabel },
        { label: "Updated quote", value: options.nextPriceLabel },
      ],
      cta: { label: "Open admin board", url: adminUrl },
      signoffName: platformName(),
    },
  );
}

export function photographerDayBeforeReminderEmail(options: {
  tenant: Tenant;
  order: Order;
  adminUrl?: string;
}): OutboundEmail {
  const { tenant, order } = options;
  const adminUrl =
    options.adminUrl ?? `${tenant.siteUrl.replace(/\/$/, "")}/admin`;
  return composeEmail(
    tenant.email,
    `Tomorrow: ${order.propertyAddress}`,
    {
      preview: `Shoot tomorrow for ${order.propertyAddress} with ${order.agentName}.`,
      greeting: `Hi ${firstName(tenant.photographerName)},`,
      intro: [
        `Reminder: you’re scheduled to photograph ${order.propertyAddress} tomorrow. The agent also received a prep reminder.`,
      ],
      details: [
        { label: "Order", value: order.id },
        { label: "Agent", value: `${order.agentName} <${order.agentEmail}>` },
        { label: "Property", value: order.propertyAddress },
        { label: "Package", value: order.packageName },
      ],
      cta: { label: "Open admin board", url: adminUrl },
      signoffName: platformName(),
    },
  );
}

/**
 * Build agent + photographer emails for a status transition.
 */
export function orderLifecycleEmails(options: {
  tenant: Tenant;
  order: Order;
  status: OrderStatus;
  galleryUrl?: string;
  listingUrl?: string;
  listingCopyUrl?: string;
  prepUrl?: string;
  scheduledLabel?: string;
  adminUrl?: string;
  priceLabel?: string;
}): OutboundEmail[] {
  const mails: OutboundEmail[] = [];
  const agent = orderStatusEmail(options);
  if (agent) mails.push(agent);
  const photographer = photographerOrderStatusEmail(options);
  if (photographer) mails.push(photographer);
  return mails;
}

export function dayBeforeReminderEmail(options: {
  tenant: Tenant;
  order: Order;
  prepUrl: string;
}) {
  return composeEmail(
    options.order.agentEmail,
    `Reminder: shoot tomorrow — ${options.order.propertyAddress}`,
    {
      preview: `${options.tenant.studioName} photographs ${options.order.propertyAddress} tomorrow.`,
      greeting: `Hi ${firstName(options.order.agentName)},`,
      intro: [
        `This is a friendly reminder that ${options.tenant.studioName} is scheduled to photograph ${options.order.propertyAddress} tomorrow.`,
      ],
      secondaryLinks: [{ label: "Seller prep checklist", url: options.prepUrl }],
      outro: [
        "Please make sure the seller has the checklist and the home will be accessible at the confirmed time.",
      ],
      signoffName: options.tenant.photographerName,
      signoffLine: options.tenant.email,
    },
  );
}

export function passwordResetEmail(options: {
  to: string;
  resetUrl: string;
  name?: string;
}) {
  const brand = platformName();
  return composeEmail(options.to, `Reset your ${brand} password`, {
    preview: `Reset your ${brand} password. This link expires in one hour.`,
    greeting: `Hi ${firstName(options.name ?? "there")},`,
    intro: [
      `We received a request to reset the password for your ${brand} account. Use the button below to choose a new password. This link expires in one hour.`,
    ],
    cta: { label: "Reset password", url: options.resetUrl },
    outro: [
      "If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.",
    ],
    signoffName: brand,
  });
}

export function studioInviteEmail(options: {
  to: string;
  role: string;
  acceptUrl: string;
  studioName?: string;
}) {
  const brand = platformName();
  const studio = options.studioName?.trim();
  return composeEmail(
    options.to,
    studio
      ? `You're invited to join ${studio} on ${brand}`
      : `You're invited to a studio on ${brand}`,
    {
      preview: studio
        ? `Join ${studio} as ${options.role} on ${brand}.`
        : `You've been invited as ${options.role} on ${brand}.`,
      greeting: "Hi there,",
      intro: [
        studio
          ? `You've been invited to join ${studio} on ${brand} as ${options.role}.`
          : `You've been invited to join a studio on ${brand} as ${options.role}.`,
        "Accept the invitation to access the studio admin tools and collaborate with the team.",
      ],
      cta: { label: "Accept invitation", url: options.acceptUrl },
      outro: ["This invitation expires in 14 days."],
      signoffName: brand,
    },
  );
}

export function agentPortalLoginEmail(options: {
  tenant: Tenant;
  agentEmail: string;
  loginUrl: string;
}) {
  return composeEmail(
    options.agentEmail,
    `Your ${options.tenant.studioName} listings login`,
    {
      preview: "Use this link to open your listings, galleries, and invoices.",
      greeting: "Hi there,",
      intro: [
        `Here's a sign-in link for your listings with ${options.tenant.studioName}. It expires in one hour.`,
      ],
      cta: { label: "Open my listings", url: options.loginUrl },
      signoffName: options.tenant.photographerName,
      signoffLine: options.tenant.email,
    },
  );
}

export function reviewRequestEmail(options: {
  tenant: Tenant;
  agentName: string;
  agentEmail: string;
  propertyAddress: string;
  reviewUrl: string;
}) {
  return composeEmail(
    options.agentEmail,
    `How was the shoot at ${options.propertyAddress}?`,
    {
      preview: "A 30-second review helps the next agent book with confidence.",
      greeting: `Hi ${firstName(options.agentName)},`,
      intro: [
        `The photos for ${options.propertyAddress} are delivered. If the shoot went well, a short review helps other agents find ${options.tenant.studioName}.`,
      ],
      cta: { label: "Leave a review", url: options.reviewUrl },
      signoffName: options.tenant.photographerName,
      signoffLine: options.tenant.email,
    },
  );
}

export function photographerOnMyWayEmail(options: {
  tenant: Tenant;
  order: Order;
  agentEmail: string;
  agentName: string;
}) {
  return composeEmail(
    options.agentEmail,
    `On the way — ${options.order.propertyAddress}`,
    {
      preview: `${options.tenant.photographerName} is heading to the listing.`,
      greeting: `Hi ${firstName(options.agentName)},`,
      intro: [
        `${options.tenant.photographerName} is on the way to ${options.order.propertyAddress}.`,
      ],
      signoffName: options.tenant.photographerName,
      signoffLine: options.tenant.email,
    },
  );
}

export function photographerArrivedEmail(options: {
  tenant: Tenant;
  order: Order;
  agentEmail: string;
  agentName: string;
}) {
  return composeEmail(
    options.agentEmail,
    `Arrived — ${options.order.propertyAddress}`,
    {
      preview: "The photographer is on site.",
      greeting: `Hi ${firstName(options.agentName)},`,
      intro: [
        `${options.tenant.photographerName} has arrived at ${options.order.propertyAddress} and is starting the shoot.`,
      ],
      signoffName: options.tenant.photographerName,
      signoffLine: options.tenant.email,
    },
  );
}
