/**
 * Smoke-test Places autocomplete. Prints status + body snippet only (not the key).
 *   node scripts/test-places.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(filename) {
  const full = path.join(root, filename);
  if (!fs.existsSync(full)) return;
  for (const line of fs.readFileSync(full, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv(".env.local");
loadEnv(".env");

const key = process.env.GOOGLE_PLACES_API_KEY?.trim() ?? "";
console.log(`KEY_PRESENT=${Boolean(key)} KEY_LEN=${key.length}`);
if (!key) process.exit(1);

const sessionToken = crypto.randomUUID();

async function tryAutocomplete(label, body) {
  const res = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
      },
      body: JSON.stringify(body),
    },
  );
  const text = await res.text();
  console.log(`\n=== ${label} STATUS=${res.status} ===`);
  console.log(text.slice(0, 1000));
}

await tryAutocomplete("strict_types", {
  input: "350 King St W Toronto",
  sessionToken,
  includedPrimaryTypes: ["street_address", "premise", "subpremise"],
});

await tryAutocomplete("no_types", {
  input: "350 King St W Toronto",
  sessionToken: crypto.randomUUID(),
});

await tryAutocomplete("geocode_type", {
  input: "350 King St W Toronto",
  sessionToken: crypto.randomUUID(),
  includedPrimaryTypes: ["geocode"],
});
