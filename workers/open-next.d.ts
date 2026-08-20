declare module "../.open-next/worker.js" {
  type WorkerFetch = (
    request: Request,
    env: unknown,
    ctx: unknown,
  ) => Promise<Response>;

  const worker: { fetch: WorkerFetch };
  export default worker;

  export class DOQueueHandler {}
  export class DOShardedTagCache {}
  export class BucketCachePurge {}
}
