import type { ManualOrderStatus, Order, OrderStatus } from "@/lib/db/schema";
import { parsePreferredSlotsJson } from "@/lib/preferred-slots";

/**
 * Photographer-set statuses follow this graph. Delivered/paid are set by
 * Publish / Unlock (or Stripe). Cancel is allowed until delivery.
 */
export function allowedManualStatuses(
  status: OrderStatus,
): ManualOrderStatus[] {
  switch (status) {
    case "requested":
      return ["confirmed", "cancelled"];
    case "confirmed":
      return ["shot", "cancelled"];
    case "shot":
      return ["editing", "cancelled"];
    case "editing":
      return ["cancelled"];
    default:
      return [];
  }
}

export function canSetManualStatus(
  from: OrderStatus,
  to: ManualOrderStatus,
): boolean {
  return allowedManualStatuses(from).includes(to);
}

export function confirmBlockers(
  order: Pick<
    Order,
    | "propertyAddress"
    | "postalCode"
    | "city"
    | "priceCents"
    | "preferredStart"
    | "preferredSlotsJson"
  >,
  selectedSlotStart?: string | null,
): string[] {
  const blockers: string[] = [];
  if (order.propertyAddress.trim().length < 5) {
    blockers.push("Confirm the property address.");
  }
  if (order.postalCode.trim().length < 3) {
    blockers.push("Confirm the postal or ZIP code.");
  }
  if (!order.city?.trim()) {
    blockers.push("Confirm the city.");
  }
  if (order.priceCents <= 0) {
    blockers.push("Set a price before confirming.");
  }

  const slots = parsePreferredSlotsJson(order.preferredSlotsJson);
  const start = selectedSlotStart?.trim() || "";
  if (slots.length > 1 && !start) {
    blockers.push("Pick which preferred time to book.");
  } else if (slots.length > 0 && start && !slots.some((slot) => slot.start === start)) {
    blockers.push("Pick one of the agent's preferred times.");
  } else if (slots.length === 0 && !(start || order.preferredStart)) {
    blockers.push("Pick a shoot time.");
  }

  return blockers;
}
