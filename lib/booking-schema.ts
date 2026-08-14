import { z } from "zod";

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

export const statusUpdateSchema = z.object({
  status: z.enum([
    "requested",
    "confirmed",
    "shot",
    "editing",
    "delivered",
    "paid",
    "cancelled",
  ]),
});
