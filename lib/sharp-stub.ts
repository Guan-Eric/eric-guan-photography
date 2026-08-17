/**
 * Cloudflare Workers cannot load the native `sharp` binary.
 * OpenNext may still resolve `sharp` as an external; this stub prevents
 * cold-start crashes when the module graph is evaluated.
 */
function sharpUnavailable(): never {
  throw new Error(
    "sharp is not available on Cloudflare Workers. Use a Node runtime or Cloudflare Images.",
  );
}

const sharpStub = Object.assign(sharpUnavailable, {
  // Mimic common static props so accidental property access does not throw differently.
  cache: false,
  concurrency: () => 1,
  counters: () => ({ queue: 0, process: 0 }),
  simd: () => false,
  format: {},
  versions: {},
}) as unknown as typeof import("sharp").default;

export default sharpStub;
