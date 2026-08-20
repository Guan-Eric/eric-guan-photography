/**
 * Prepare Studiofront icon/logo for Stripe Dashboard branding.
 * Platform brand colours cannot be set via API (Dashboard only).
 *
 * Usage:
 *   node scripts/setup-stripe-branding.mjs
 *   npm run setup:stripe:branding
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "scripts/stripe-brand");

/** Site `--accent` — Brand colour (receipts, portal, invoices). */
const PRIMARY = "#2f5d50";
/** Site `--accent-soft` — Accent colour (Checkout buttons, email wash). */
const SECONDARY = "#3f7a69";
const CHECKOUT_BG = "#e8ebe6";

fs.mkdirSync(outDir, { recursive: true });
const iconOut = path.join(outDir, "icon.png");
const logoOut = path.join(outDir, "logo.png");
fs.copyFileSync(path.join(root, "public/studiofront-icon.png"), iconOut);
fs.copyFileSync(path.join(root, "public/studiofront-lockup.png"), logoOut);

console.log(`ICON=${iconOut}`);
console.log(`LOGO=${logoOut}`);
console.log(`
Stripe Dashboard → Settings → Branding
https://dashboard.stripe.com/settings/branding
(Use Live / Test to match the mode you are editing.)

Icon:                    ${iconOut}
Logo:                    ${logoOut}
Prefer logo over icon:   On
Brand colour:            ${PRIMARY}
Accent colour:           ${SECONDARY}

Checkout & Payment Links tab → Stripe-hosted → Customise
  Background:            ${CHECKOUT_BG}
  Button:                ${PRIMARY}
  Corners:               Rectangular
  Font:                  Inter or Source Sans Pro

Add your domain:         checkout.studiofront.ca
  CNAME (DNS only, not proxied) to the host Stripe shows.

Connect → apply platform branding to connected accounts.
Gallery Pay & unlock already uses this platform brand
(destination charge, no on_behalf_of).
`);

if (process.platform === "darwin") {
  spawn("open", [outDir]);
}
