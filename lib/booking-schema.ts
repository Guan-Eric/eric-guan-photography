import { z } from "zod";
import { MANUAL_ORDER_STATUSES } from "@/lib/db/schema";

export const quoteRequestSchema = z.object({
  packageId: z.string().min(1),
  squareFootage: z.coerce.number().int().min(400).max(20000),
});

export const availabilityRequestSchema = z.object({
  packageId: z.string().min(1),
  squareFootage: z.coerce.number().int().min(400).max(20000),
});

export const bookingRequestSchema = z.object({
  packageId: z.string().min(1),
  squareFootage: z.coerce.number().int().min(400).max(20000),
  propertyAddress: z.string().trim().min(5).max(200),
  postalCode: z.string().trim().min(6).max(10),
  city: z.string().trim().max(80).optional(),
  placeId: z.string().trim().max(256).optional(),
  mapLat: z.string().trim().max(32).optional(),
  mapLng: z.string().trim().max(32).optional(),
  referralCode: z.string().trim().max(40).optional(),
  preferredSlots: z
    .array(
      z.object({
        start: z.string().datetime(),
        end: z.string().datetime(),
        label: z.string().min(1).max(120),
      }),
    )
    .min(1)
    .max(3),
  agentName: z.string().trim().min(2).max(100),
  agentEmail: z.string().trim().email().max(160),
  agentPhone: z.string().trim().max(40).optional(),
  brokerage: z.string().trim().max(120).optional(),
  occupancy: z.enum(["vacant", "occupied"]),
  accessType: z.enum(["lockbox", "meet", "key", "other"]),
  accessNotes: z.string().trim().max(500).optional(),
  pets: z.string().trim().max(200).optional(),
  parkingNotes: z.string().trim().max(200).optional(),
  meetingContact: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const statusUpdateSchema = z
  .object({
    status: z.enum(MANUAL_ORDER_STATUSES).optional(),
    priceCents: z.number().int().min(0).max(5_000_000).optional(),
    propertyAddress: z.string().trim().min(5).max(200).optional(),
    postalCode: z.string().trim().min(3).max(12).optional(),
    city: z.string().trim().max(80).optional(),
    placeId: z.string().trim().max(256).nullable().optional(),
    mapLat: z.string().trim().max(32).nullable().optional(),
    mapLng: z.string().trim().max(32).nullable().optional(),
  })
  .refine(
    (value) =>
      value.status != null ||
      value.priceCents != null ||
      value.propertyAddress != null,
    {
      message: "Provide a status, price, or address.",
    },
  )
  .refine(
    (value) =>
      value.propertyAddress == null ||
      (value.postalCode != null && value.postalCode.length >= 3),
    { message: "Postal or ZIP is required with an address." },
  );
