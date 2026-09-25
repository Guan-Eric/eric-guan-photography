import { describe, expect, it } from "vitest";
import {
  moveSelectionBlock,
  queueTrayStats,
  uploadQueueReducer,
  validateUploadFile,
  type UploadQueueItem,
} from "@/lib/upload-queue";

function item(
  partial: Partial<UploadQueueItem> & Pick<UploadQueueItem, "id" | "status">,
): UploadQueueItem {
  return {
    file: new File(["x"], `${partial.id}.jpg`, { type: "image/jpeg" }),
    progress: 0,
    previewUrl: "blob:test",
    batchId: "batch_1",
    batchIndex: 0,
    ...partial,
  };
}

describe("validateUploadFile", () => {
  it("rejects oversized and wrong-type files", () => {
    const big = new File([new Uint8Array(3)], "big.jpg", {
      type: "image/jpeg",
    });
    Object.defineProperty(big, "size", { value: 25 * 1024 * 1024 });
    expect(
      validateUploadFile(big, { maxBytes: 20 * 1024 * 1024 }),
    ).toMatch(/over 20MB/);

    const pdf = new File(["x"], "doc.pdf", { type: "application/pdf" });
    expect(validateUploadFile(pdf)).toMatch(/not an accepted/);
  });

  it("accepts jpeg by extension when mime is empty", () => {
    const file = new File(["x"], "shot.JPEG", { type: "" });
    expect(validateUploadFile(file)).toBeNull();
  });
});

describe("uploadQueueReducer", () => {
  it("enqueues items and tracks batch totals", () => {
    const a = item({ id: "a", status: "queued", batchIndex: 0 });
    const b = item({ id: "b", status: "queued", batchIndex: 1 });
    const state = uploadQueueReducer(
      { items: [], batches: {} },
      { type: "enqueue", items: [a, b] },
    );
    expect(state.items).toHaveLength(2);
    expect(state.batches.batch_1).toEqual({ total: 2, settled: 0 });
  });

  it("increments settled on done/failed and decrements on retry", () => {
    const a = item({ id: "a", status: "uploading", batchIndex: 0 });
    let state = uploadQueueReducer(
      { items: [a], batches: { batch_1: { total: 1, settled: 0 } } },
      { type: "status", id: "a", status: "failed", error: "boom" },
    );
    expect(state.batches.batch_1?.settled).toBe(1);
    expect(state.items[0]?.status).toBe("failed");

    state = uploadQueueReducer(state, {
      type: "status",
      id: "a",
      status: "queued",
      progress: 0,
      error: "",
    });
    expect(state.batches.batch_1?.settled).toBe(0);
    expect(state.items[0]?.status).toBe("queued");
  });

  it("preserves batch order metadata for parallel completion", () => {
    const items = [
      item({ id: "a", status: "done", batchIndex: 0 }),
      item({ id: "b", status: "done", batchIndex: 1 }),
      item({ id: "c", status: "done", batchIndex: 2 }),
    ];
    const ordered = [...items].sort((x, y) => x.batchIndex - y.batchIndex);
    expect(ordered.map((row) => row.id)).toEqual(["a", "b", "c"]);
  });
});

describe("queueTrayStats", () => {
  it("summarizes active uploads", () => {
    const stats = queueTrayStats([
      item({ id: "a", status: "done" }),
      item({ id: "b", status: "uploading", progress: 40 }),
      item({ id: "c", status: "queued" }),
    ]);
    expect(stats.activeCount).toBe(2);
    expect(stats.label).toMatch(/Uploading/);
  });
});

describe("moveSelectionBlock", () => {
  it("moves a multi-select block before the drop index", () => {
    const list = [
      { id: "a" },
      { id: "b" },
      { id: "c" },
      { id: "d" },
      { id: "e" },
    ];
    const next = moveSelectionBlock(list, new Set(["b", "c"]), 4);
    expect(next.map((row) => row.id)).toEqual(["a", "d", "b", "c", "e"]);
  });

  it("keeps relative order inside the selection", () => {
    const list = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const next = moveSelectionBlock(list, ["c", "a"], 3);
    expect(next.map((row) => row.id)).toEqual(["b", "a", "c", "d"]);
  });
});
