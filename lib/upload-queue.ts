"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";

export type UploadFileStatus =
  | "queued"
  | "uploading"
  | "processing"
  | "done"
  | "failed";

export type UploadQueueItem = {
  id: string;
  file: File;
  status: UploadFileStatus;
  /** 0–100 while uploading; 100 once processing/done. */
  progress: number;
  error?: string;
  previewUrl: string;
  response?: unknown;
  /** Opaque caller metadata (e.g. orderId, placeholderId). */
  meta?: Record<string, unknown>;
  batchId: string;
  /** Index within the batch (preserves drop order). */
  batchIndex: number;
};

export type UploadBatchResult = {
  id: string;
  file: File;
  ok: boolean;
  response?: unknown;
  error?: string;
  meta?: Record<string, unknown>;
};

export type UploadAccept = {
  mime?: string[];
  extensions?: string[];
};

export type UseUploadQueueOptions = {
  /** POST URL, or per-file resolver. */
  url: string | ((file: File, meta?: Record<string, unknown>) => string);
  /** FormData field name. Delivery uses `files`; portfolio uses `file`. */
  fieldName?: string;
  concurrency?: number;
  maxBytes?: number;
  accept?: UploadAccept;
  onFileDone?: (file: File, responseJson: unknown, item: UploadQueueItem) => void;
  onBatchComplete?: (results: UploadBatchResult[]) => void;
  onError?: (message: string) => void;
};

export type EnqueueOptions = {
  meta?: Record<string, unknown>;
  /** Override queue url for this batch. */
  url?: string | ((file: File, meta?: Record<string, unknown>) => string);
  fieldName?: string;
};

type QueueState = {
  items: UploadQueueItem[];
  /** batchId → expected count */
  batches: Record<string, { total: number; settled: number }>;
};

type QueueAction =
  | { type: "enqueue"; items: UploadQueueItem[] }
  | {
      type: "status";
      id: string;
      status: UploadFileStatus;
      progress?: number;
      error?: string;
      response?: unknown;
    }
  | { type: "remove"; ids: string[] }
  | { type: "clear_done" };

export const DEFAULT_ACCEPT: UploadAccept = {
  mime: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
  extensions: [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"],
};

export const DELIVERY_MAX_BYTES = 20 * 1024 * 1024;
export const PORTFOLIO_MAX_BYTES = 12 * 1024 * 1024;

let uploadIdSeq = 0;
function nextUploadId() {
  uploadIdSeq += 1;
  return `up_${Date.now().toString(36)}_${uploadIdSeq}`;
}

let batchIdSeq = 0;
function nextBatchId() {
  batchIdSeq += 1;
  return `batch_${Date.now().toString(36)}_${batchIdSeq}`;
}

export function validateUploadFile(
  file: File,
  options: { maxBytes?: number; accept?: UploadAccept } = {},
): string | null {
  const maxBytes = options.maxBytes ?? DELIVERY_MAX_BYTES;
  const accept = options.accept ?? DEFAULT_ACCEPT;
  if (file.size <= 0) return "Empty file.";
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return `“${file.name}” is over ${mb}MB.`;
  }
  const mimeOk =
    !accept.mime?.length ||
    (file.type
      ? accept.mime.some(
          (m) =>
            m === file.type ||
            (m.endsWith("/*") && file.type.startsWith(m.slice(0, -1))),
        )
      : false);
  const ext = file.name.includes(".")
    ? `.${file.name.split(".").pop()!.toLowerCase()}`
    : "";
  const extOk =
    !accept.extensions?.length ||
    (ext ? accept.extensions.map((e) => e.toLowerCase()).includes(ext) : false);
  if (!mimeOk && !extOk) {
    return `“${file.name}” is not an accepted image type.`;
  }
  return null;
}

export function uploadQueueReducer(
  state: QueueState,
  action: QueueAction,
): QueueState {
  switch (action.type) {
    case "enqueue": {
      const batches = { ...state.batches };
      for (const item of action.items) {
        const existing = batches[item.batchId];
        batches[item.batchId] = {
          total: (existing?.total ?? 0) + 1,
          settled: existing?.settled ?? 0,
        };
      }
      return { items: [...state.items, ...action.items], batches };
    }
    case "status": {
      const target = state.items.find((item) => item.id === action.id);
      const items = state.items.map((item) => {
        if (item.id !== action.id) return item;
        return {
          ...item,
          status: action.status,
          progress:
            action.progress !== undefined ? action.progress : item.progress,
          error: action.error !== undefined ? action.error : item.error,
          response:
            action.response !== undefined ? action.response : item.response,
        };
      });
      let batches = state.batches;
      if (target) {
        const batch = state.batches[target.batchId];
        if (batch) {
          const wasSettled =
            target.status === "done" || target.status === "failed";
          const nowSettled =
            action.status === "done" || action.status === "failed";
          let settled = batch.settled;
          if (!wasSettled && nowSettled) settled += 1;
          if (wasSettled && !nowSettled) settled = Math.max(0, settled - 1);
          batches = {
            ...state.batches,
            [target.batchId]: { ...batch, settled },
          };
        }
      }
      return { items, batches };
    }
    case "remove": {
      const idSet = new Set(action.ids);
      return {
        ...state,
        items: state.items.filter((item) => !idSet.has(item.id)),
      };
    }
    case "clear_done":
      return {
        ...state,
        items: state.items.filter(
          (item) => item.status !== "done" && item.status !== "failed",
        ),
      };
    default:
      return state;
  }
}

export function queueTrayStats(items: UploadQueueItem[]) {
  const active = items.filter(
    (item) =>
      item.status === "queued" ||
      item.status === "uploading" ||
      item.status === "processing",
  );
  const failed = items.filter((item) => item.status === "failed");
  const done = items.filter((item) => item.status === "done");
  const total = items.length;
  const completed = done.length + failed.length;
  const uploading = items.filter(
    (item) => item.status === "uploading" || item.status === "processing",
  ).length;
  return {
    activeCount: active.length,
    failedCount: failed.length,
    doneCount: done.length,
    total,
    completed,
    uploading,
    label:
      active.length > 0
        ? `Uploading ${completed + uploading} of ${total}`
        : failed.length > 0
          ? `${failed.length} upload${failed.length === 1 ? "" : "s"} failed`
          : total > 0
            ? `Uploaded ${done.length} of ${total}`
            : "",
  };
}

/** Reorder list by moving selected ids as a contiguous block before dropIndex. */
export function moveSelectionBlock<T extends { id: string }>(
  list: T[],
  selectedIds: Set<string> | string[],
  dropIndex: number,
): T[] {
  const selected = new Set(
    Array.isArray(selectedIds) ? selectedIds : [...selectedIds],
  );
  if (selected.size === 0) return list;
  const block = list.filter((item) => selected.has(item.id));
  const remaining = list.filter((item) => !selected.has(item.id));
  const removedBefore = list
    .slice(0, dropIndex)
    .filter((item) => selected.has(item.id)).length;
  const insertAt = Math.max(
    0,
    Math.min(remaining.length, dropIndex - removedBefore),
  );
  return [
    ...remaining.slice(0, insertAt),
    ...block,
    ...remaining.slice(insertAt),
  ];
}

function format429Message(retryAfterHeader: string | null, bodyError?: string) {
  if (bodyError && /limit/i.test(bodyError) && /minute|hour|later/i.test(bodyError)) {
    return bodyError;
  }
  let minutes = 60;
  if (retryAfterHeader) {
    const asNum = Number(retryAfterHeader);
    if (Number.isFinite(asNum) && asNum > 0) {
      minutes = Math.max(1, Math.ceil(asNum / 60));
    }
  }
  return `Upload limit reached, try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

export function xhrUploadFile(options: {
  url: string;
  file: File;
  fieldName: string;
  signal?: AbortSignal;
  onProgress: (percent: number, phase: "send" | "process") => void;
}): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const { url, file, fieldName, signal, onProgress } = options;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.timeout = 90_000;
    const form = new FormData();
    form.append(fieldName, file);

    const abort = () => {
      xhr.abort();
      reject(new Error("Upload cancelled."));
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
      onProgress(percent, "send");
    };
    xhr.upload.onload = () => onProgress(100, "process");
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.ontimeout = () =>
      reject(new Error("Upload timed out. Try a smaller image."));
    xhr.onload = () => {
      let json: Record<string, unknown> = {};
      try {
        json = JSON.parse(xhr.responseText) as Record<string, unknown>;
      } catch {
        json = {};
      }
      if (xhr.status === 429) {
        const retryAfter = xhr.getResponseHeader("Retry-After");
        const bodyError =
          typeof json.error === "string" ? json.error : undefined;
        reject(new Error(format429Message(retryAfter, bodyError)));
        return;
      }
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300 && Boolean(json.ok),
        status: xhr.status,
        json,
      });
    };
    xhr.send(form);
  });
}

const initialState: QueueState = { items: [], batches: {} };

export function useUploadQueue(options: UseUploadQueueOptions) {
  const {
    url,
    fieldName = "files",
    concurrency = 3,
    maxBytes = DELIVERY_MAX_BYTES,
    accept = DEFAULT_ACCEPT,
    onFileDone,
    onBatchComplete,
    onError,
  } = options;

  const [state, dispatch] = useReducer(uploadQueueReducer, initialState);
  const abortMap = useRef(new Map<string, AbortController>());
  const running = useRef(new Set<string>());
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const enqueueOptsRef = useRef(
    new Map<
      string,
      {
        url: string | ((file: File, meta?: Record<string, unknown>) => string);
        fieldName: string;
      }
    >(),
  );

  const completedBatches = useRef(new Set<string>());

  const startUpload = useCallback(
    async (item: UploadQueueItem) => {
      if (running.current.has(item.id)) return;
      running.current.add(item.id);
      const controller = new AbortController();
      abortMap.current.set(item.id, controller);

      const perItem = enqueueOptsRef.current.get(item.id);
      const resolveUrl = perItem?.url ?? optionsRef.current.url;
      const itemField = perItem?.fieldName ?? optionsRef.current.fieldName ?? "files";
      const targetUrl =
        typeof resolveUrl === "function"
          ? resolveUrl(item.file, item.meta)
          : resolveUrl;

      dispatch({
        type: "status",
        id: item.id,
        status: "uploading",
        progress: 0,
      });

      try {
        const result = await xhrUploadFile({
          url: targetUrl,
          file: item.file,
          fieldName: itemField,
          signal: controller.signal,
          onProgress: (percent, phase) => {
            dispatch({
              type: "status",
              id: item.id,
              status: phase === "process" ? "processing" : "uploading",
              progress: percent,
            });
          },
        });

        if (!result.ok) {
          const message =
            typeof result.json.error === "string"
              ? result.json.error
              : `Upload failed (${result.status}).`;
          dispatch({
            type: "status",
            id: item.id,
            status: "failed",
            error: message,
            response: result.json,
          });
          optionsRef.current.onError?.(message);
        } else {
          dispatch({
            type: "status",
            id: item.id,
            status: "done",
            progress: 100,
            response: result.json,
          });
          const doneItem: UploadQueueItem = {
            ...item,
            status: "done",
            progress: 100,
            response: result.json,
          };
          optionsRef.current.onFileDone?.(item.file, result.json, doneItem);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed.";
        const cancelled = /cancelled/i.test(message);
        dispatch({
          type: "status",
          id: item.id,
          status: "failed",
          error: cancelled ? "Cancelled." : message,
        });
        if (!cancelled) optionsRef.current.onError?.(message);
      } finally {
        running.current.delete(item.id);
        abortMap.current.delete(item.id);
        enqueueOptsRef.current.delete(item.id);
      }
    },
    [],
  );

  useEffect(() => {
    const slots = concurrency - running.current.size;
    if (slots <= 0) return;
    const next = state.items
      .filter((item) => item.status === "queued" && !running.current.has(item.id))
      .slice(0, slots);
    for (const item of next) {
      void startUpload(item);
    }
  }, [state.items, concurrency, startUpload]);

  useEffect(() => {
    for (const [batchId, info] of Object.entries(state.batches)) {
      if (info.settled < info.total || info.total === 0) continue;
      if (completedBatches.current.has(batchId)) continue;
      const batchItems = state.items.filter((item) => item.batchId === batchId);
      if (
        batchItems.some(
          (item) => item.status !== "done" && item.status !== "failed",
        )
      ) {
        continue;
      }
      completedBatches.current.add(batchId);
      const results: UploadBatchResult[] = batchItems
        .sort((a, b) => a.batchIndex - b.batchIndex)
        .map((item) => ({
          id: item.id,
          file: item.file,
          ok: item.status === "done",
          response: item.response,
          error: item.error,
          meta: item.meta,
        }));
      optionsRef.current.onBatchComplete?.(results);
    }
  }, [state.batches, state.items]);

  const enqueue = useCallback(
    (files: File[], enqueueOptions: EnqueueOptions = {}) => {
      const batchId = nextBatchId();
      const accepted: UploadQueueItem[] = [];
      const errors: string[] = [];

      files.forEach((file, index) => {
        const validationError = validateUploadFile(file, { maxBytes, accept });
        if (validationError) {
          errors.push(validationError);
          return;
        }
        const id = nextUploadId();
        enqueueOptsRef.current.set(id, {
          url: enqueueOptions.url ?? url,
          fieldName: enqueueOptions.fieldName ?? fieldName,
        });
        accepted.push({
          id,
          file,
          status: "queued",
          progress: 0,
          previewUrl: URL.createObjectURL(file),
          meta: enqueueOptions.meta,
          batchId,
          batchIndex: index,
        });
      });

      if (errors.length > 0) {
        onError?.(errors[0]!);
      }
      if (accepted.length === 0) return [];
      dispatch({ type: "enqueue", items: accepted });
      return accepted;
    },
    [url, fieldName, maxBytes, accept, onError],
  );

  const retry = useCallback((id: string) => {
    const item = state.items.find((row) => row.id === id);
    if (!item || item.status !== "failed") return;
    completedBatches.current.delete(item.batchId);
    // Re-register upload opts if cleared after failure
    if (!enqueueOptsRef.current.has(id)) {
      enqueueOptsRef.current.set(id, {
        url: optionsRef.current.url,
        fieldName: optionsRef.current.fieldName ?? "files",
      });
    }
    dispatch({
      type: "status",
      id,
      status: "queued",
      progress: 0,
      error: "",
    });
  }, [state.items]);

  const retryAllFailed = useCallback(() => {
    for (const item of state.items) {
      if (item.status === "failed") {
        completedBatches.current.delete(item.batchId);
        if (!enqueueOptsRef.current.has(item.id)) {
          enqueueOptsRef.current.set(item.id, {
            url: optionsRef.current.url,
            fieldName: optionsRef.current.fieldName ?? "files",
          });
        }
        dispatch({
          type: "status",
          id: item.id,
          status: "queued",
          progress: 0,
          error: "",
        });
      }
    }
  }, [state.items]);

  const cancel = useCallback((id: string) => {
    abortMap.current.get(id)?.abort();
    dispatch({
      type: "status",
      id,
      status: "failed",
      error: "Cancelled.",
    });
  }, []);

  const cancelAll = useCallback(() => {
    for (const [id, controller] of abortMap.current) {
      controller.abort();
      dispatch({
        type: "status",
        id,
        status: "failed",
        error: "Cancelled.",
      });
    }
  }, []);

  const remove = useCallback((ids: string[]) => {
    for (const id of ids) {
      abortMap.current.get(id)?.abort();
      const item = state.items.find((row) => row.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    }
    dispatch({ type: "remove", ids });
  }, [state.items]);

  const clearDone = useCallback(() => {
    for (const item of state.items) {
      if (
        (item.status === "done" || item.status === "failed") &&
        item.previewUrl
      ) {
        URL.revokeObjectURL(item.previewUrl);
      }
    }
    dispatch({ type: "clear_done" });
  }, [state.items]);

  useEffect(() => {
    return () => {
      for (const controller of abortMap.current.values()) controller.abort();
      for (const item of state.items) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup on unmount only
  }, []);

  const stats = queueTrayStats(state.items);

  return {
    items: state.items,
    stats,
    enqueue,
    retry,
    retryAllFailed,
    cancel,
    cancelAll,
    remove,
    clearDone,
  };
}
