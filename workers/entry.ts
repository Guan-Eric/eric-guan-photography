/**
 * Cloudflare Worker entry — wraps the OpenNext worker and adds Cron Trigger support.
 * Built after `opennextjs-cloudflare build`; see wrangler.jsonc `main`.
 */
import openNext from "../.open-next/worker.js";

export {
  DOQueueHandler,
  DOShardedTagCache,
  BucketCachePurge,
} from "../.open-next/worker.js";

type ScheduledCronContext = {
  waitUntil(promise: Promise<unknown>): void;
};

async function runScheduledReminders() {
  const { runDailyReminders } = await import("../lib/cron/reminders");
  const result = await runDailyReminders();
  console.log("[scheduled] runDailyReminders complete", result);
}

export default {
  fetch: openNext.fetch.bind(openNext),
  scheduled(
    _controller: { scheduledTime: number; cron: string },
    _env: unknown,
    ctx: ScheduledCronContext,
  ) {
    ctx.waitUntil(
      runScheduledReminders().catch((error) => {
        console.error("[scheduled] runDailyReminders failed", error);
      }),
    );
  },
};
