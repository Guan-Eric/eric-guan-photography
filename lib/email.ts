import { customAlphabet } from "nanoid";
import type { Order, OrderStatus } from "@/lib/db/schema";
import { platformEmailFrom } from "@/lib/platform";
import type { Tenant } from "@/lib/tenant-schema";

const nanoid = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 10);
const tokenId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 24);

export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

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
      html: message.html ?? `<pre>${message.text}</pre>`,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("[email] Resend failed", response.status, body);
    return { ok: false as const, error: "Email provider rejected the message." };
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
  const text = [
    `Hi ${options.agentName},`,
    "",
    `Your shoot request with ${tenant.studioName} is in.`,
    "",
    `Property: ${options.propertyAddress}`,
    `Package: ${options.packageName}`,
    `Quote: ${options.priceLabel}`,
    `Preferred times: ${options.slotLabel}`,
    "",
    `I'll confirm one of these shortly. Before the shoot, send this checklist to your seller:`,
    `${tenant.siteUrl}/prep`,
    "",
    `Your request summary: ${options.confirmationUrl}`,
    "",
    `— ${tenant.photographerName}`,
    tenant.email,
  ].join("\n");

  return {
    to: options.agentEmail,
    subject: `Shoot request received — ${options.propertyAddress}`,
    text,
  } satisfies OutboundEmail;
}

export function photographerNotifyEmail(options: {
  tenant: Tenant;
  orderId: string;
  agentName: string;
  agentEmail: string;
  propertyAddress: string;
  packageName: string;
  priceLabel: string;
  slotLabel: string;
  adminUrl: string;
}) {
  const text = [
    `New booking request`,
    "",
    `Order: ${options.orderId}`,
    `Agent: ${options.agentName} <${options.agentEmail}>`,
    `Property: ${options.propertyAddress}`,
    `Package: ${options.packageName}`,
    `Quote: ${options.priceLabel}`,
    `Preferred times: ${options.slotLabel}`,
    "",
    `Admin: ${options.adminUrl}`,
  ].join("\n");

  return {
    to: options.tenant.email,
    subject: `New shoot request — ${options.propertyAddress}`,
    text,
  } satisfies OutboundEmail;
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
  prepUrl?: string;
}) {
  const { tenant, order, status } = options;
  const signoff = `\n\n— ${tenant.photographerName}\n${tenant.email}`;

  if (status === "confirmed") {
    return {
      to: order.agentEmail,
      subject: `Shoot confirmed — ${order.propertyAddress}`,
      text:
        `Hi ${order.agentName},\n\nYour shoot is confirmed.\n\nProperty: ${order.propertyAddress}\nPackage: ${order.packageName}\n\nSend this checklist to your seller:\n${options.prepUrl ?? `${tenant.siteUrl}/prep`}` +
        signoff,
    } satisfies OutboundEmail;
  }

  if (status === "delivered") {
    return {
      to: order.agentEmail,
      subject: `Photos ready — ${order.propertyAddress}`,
      text:
        `Hi ${order.agentName},\n\nYour gallery is ready.\n\n${options.galleryUrl ?? ""}\n` +
        (options.listingUrl ? `\nListing page: ${options.listingUrl}\n` : "") +
        `\nPay on the gallery link to unlock full-resolution + MLS downloads.` +
        signoff,
    } satisfies OutboundEmail;
  }

  if (status === "paid") {
    return {
      to: order.agentEmail,
      subject: `Unlocked — ${order.propertyAddress}`,
      text:
        `Hi ${order.agentName},\n\nPayment received. Full downloads are live on your gallery link.\n\n${options.galleryUrl ?? ""}\n\nIf this listing went well, a short review or referral means a lot.` +
        signoff,
    } satisfies OutboundEmail;
  }

  if (status === "cancelled") {
    return {
      to: order.agentEmail,
      subject: `Shoot cancelled — ${order.propertyAddress}`,
      text: `Hi ${order.agentName},\n\nThe shoot for ${order.propertyAddress} has been cancelled. Email ${tenant.email} if you need to rebook.` + signoff,
    } satisfies OutboundEmail;
  }

  return null;
}

export function dayBeforeReminderEmail(options: {
  tenant: Tenant;
  order: Order;
  prepUrl: string;
}) {
  return {
    to: options.order.agentEmail,
    subject: `Tomorrow: ${options.order.propertyAddress}`,
    text: [
      `Hi ${options.order.agentName},`,
      "",
      `Reminder: ${options.tenant.studioName} is photographing ${options.order.propertyAddress} tomorrow.`,
      "",
      `Seller prep checklist: ${options.prepUrl}`,
      "",
      `— ${options.tenant.photographerName}`,
    ].join("\n"),
  } satisfies OutboundEmail;
}
