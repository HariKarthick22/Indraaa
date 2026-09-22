import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cancelLocalModelDownload,
  deleteLocalModel,
  downloadHfModel,
  getLocalModelDownloadProgress,
  listLocalModels,
  type DownloadProgress,
  type LocalModelResponse,
} from '../acp/local-inference';
import type { ModelInstallRow } from '../components/indra-shell/ModelInstall';

/**
 * crates/indra-local-inference's list_models() (behind the existing
 * _goose/unstable/local-inference/models/list ACP method) calls
 * hf_models::cached_local_models(), which runs client.scan_cache() against
 * the real Hugging Face cache directory on every call - it is not a manifest
 * of what this UI downloaded. A GGUF file previously downloaded by this app,
 * by `huggingface-cli download`, or by any tool that populates the standard
 * HF hub cache layout is already Downloaded the first time this list loads,
 * with zero extra plumbing. (A raw .gguf file dropped in an arbitrary folder
 * outside that cache layout is the one case this does not cover - out of
 * scope here, since it would need a new backend scan, not a frontend change.)
 */
function toRow(model: LocalModelResponse): ModelInstallRow {
  const state = model.status.state;
  return {
    id: model.id,
    label: model.id,
    sizeBytes: model.sizeBytes,
    quantization: model.quantization,
    visionCapable: model.visionCapable,
    recommended: model.recommended,
    installed: state === 'Downloaded',
    downloading: state === 'Downloading',
    failed: false,
    progress:
      state === 'Downloading'
        ? {
            percent: model.status.progressPercent ?? 0,
            bytesDownloaded: model.status.bytesDownloaded ?? 0,
            totalBytes: model.status.totalBytes ?? model.sizeBytes,
            speedBps: model.status.speedBps ?? null,
          }
        : null,
  };
}

function messageFor(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

const PROGRESS_POLL_MS = 500;
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);

export interface UseLocalModelsResult {
  models: ModelInstallRow[];
  loading: boolean;
  /** Set when the initial/most recent list refresh itself failed. */
  loadError: string | null;
  /** Set when the most recent install request itself was rejected (bad spec, etc). */
  installError: string | null;
  install: (spec: string) => Promise<void>;
  cancel: (modelId: string) => Promise<void>;
  /** Deletes an installed model, or - for a failed download - just clears its row. */
  remove: (modelId: string) => Promise<void>;
  dismiss: (modelId: string) => void;
  refresh: () => Promise<void>;
}

/**
 * ACP calls behind a small hook, per convention - ModelInstall.tsx itself
 * stays presentational (props in, callbacks out). This hook owns the two
 * different refresh rates that make the download bar feel smooth without
 * hammering the backend: getLocalModelDownloadProgress (cheap, a single
 * download's counters) polls every 500ms while something is downloading,
 * while listLocalModels (a real HF-cache directory scan) is only called on
 * mount and after a mutation settles.
 */
export function useLocalModels(): UseLocalModelsResult {
  const [models, setModels] = useState<ModelInstallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingIdsRef = useRef<Set<string>>(new Set());
  const failedRef = useRef<Map<string, { errorMessage?: string; progress: ModelInstallRow['progress'] }>>(
    new Map()
  );

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const applyFailedOverlay = useCallback((rows: ModelInstallRow[]): ModelInstallRow[] => {
    if (failedRef.current.size === 0) return rows;

    // A failed download never lands in the HF cache and is dropped from the
    // download manager's Downloading-filtered list, so listLocalModels()
    // simply omits it - there is no row to overlay onto. Keep it visible
    // (built from the last known progress snapshot) until the user dismisses
    // it or retries, rather than letting it vanish silently on refresh.
    const seenIds = new Set(rows.map((row) => row.id));
    const overlaid = rows.map((row) => {
      const failed = failedRef.current.get(row.id);
      if (!failed) return row;
      return { ...row, failed: true, downloading: false, errorMessage: failed.errorMessage, progress: failed.progress };
    });
    const injected: ModelInstallRow[] = [];
    failedRef.current.forEach((failed, id) => {
      if (seenIds.has(id)) return;
      injected.push({
        id,
        label: id,
        sizeBytes: failed.progress?.totalBytes ?? 0,
        quantization: '',
        visionCapable: false,
        recommended: false,
        installed: false,
        downloading: false,
        failed: true,
        errorMessage: failed.errorMessage,
        progress: failed.progress,
      });
    });
    return [...overlaid, ...injected];
  }, []);

  const refresh = useCallback(async () => {
    try {
      const list = await listLocalModels();
      setModels(applyFailedOverlay(list.map(toRow)));
      setLoadError(null);
    } catch (error) {
      setLoadError(messageFor(error, 'Failed to load models'));
    } finally {
      setLoading(false);
    }
  }, [applyFailedOverlay]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => stopPolling, [stopPolling]);

  const pollOnce = useCallback(async () => {
    const ids = Array.from(pollingIdsRef.current);
    if (ids.length === 0) {
      stopPolling();
      return;
    }

    await Promise.all(
      ids.map(async (modelId) => {
        let progress: DownloadProgress | null;
        try {
          progress = await getLocalModelDownloadProgress(modelId);
        } catch {
          pollingIdsRef.current.delete(modelId);
          return;
        }

        if (!progress) {
          pollingIdsRef.current.delete(modelId);
          return;
        }

        if (progress.status === 'failed') {
          pollingIdsRef.current.delete(modelId);
          failedRef.current.set(modelId, {
            errorMessage: progress.error ?? undefined,
            progress: {
              percent: progress.progressPercent,
              bytesDownloaded: progress.bytesDownloaded,
              totalBytes: progress.totalBytes,
              speedBps: progress.speedBps ?? null,
            },
          });
          setModels((prev) =>
            prev.map((row) =>
              row.id === modelId
                ? {
                    ...row,
                    downloading: false,
                    failed: true,
                    errorMessage: progress!.error ?? undefined,
                  }
                : row
            )
          );
          return;
        }

        if (TERMINAL_STATUSES.has(progress.status)) {
          pollingIdsRef.current.delete(modelId);
          return;
        }

        setModels((prev) =>
          prev.map((row) =>
            row.id === modelId
              ? {
                  ...row,
                  downloading: true,
                  progress: {
                    percent: progress!.progressPercent,
                    bytesDownloaded: progress!.bytesDownloaded,
                    totalBytes: progress!.totalBytes,
                    speedBps: progress!.speedBps ?? null,
                  },
                }
              : row
          )
        );
      })
    );

    const anyTerminal = ids.some((id) => !pollingIdsRef.current.has(id));
    if (anyTerminal) {
      await refresh();
    }
  }, [refresh, stopPolling]);

  const ensurePolling = useCallback(
    (modelId: string) => {
      pollingIdsRef.current.add(modelId);
      if (pollRef.current) return;
      pollRef.current = setInterval(() => {
        pollOnce();
      }, PROGRESS_POLL_MS);
    },
    [pollOnce]
  );

  // Covers both a freshly started download and one already in flight when
  // this hook first mounts (e.g. the app restarted mid-download).
  useEffect(() => {
    models.forEach((row) => {
      if (row.downloading && !pollingIdsRef.current.has(row.id)) {
        ensurePolling(row.id);
      }
    });
  }, [models, ensurePolling]);

  const install = useCallback(
    async (spec: string) => {
      setInstallError(null);
      try {
        const modelId = await downloadHfModel({ spec });
        // Clear any stale failed overlay for the *resolved* id (which a
        // retried spec may or may not match verbatim) before refreshing, or
        // applyFailedOverlay would immediately mark the new attempt failed.
        failedRef.current.delete(modelId);
        await refresh();
      } catch (error) {
        setInstallError(messageFor(error, 'Failed to start download'));
        throw error;
      }
    },
    [refresh]
  );

  const cancel = useCallback(async (modelId: string) => {
    pollingIdsRef.current.delete(modelId);
    await cancelLocalModelDownload(modelId);
    await refresh();
  }, [refresh]);

  const remove = useCallback(
    async (modelId: string) => {
      if (failedRef.current.has(modelId)) {
        failedRef.current.delete(modelId);
        setModels((prev) => prev.filter((row) => row.id !== modelId));
        return;
      }
      await deleteLocalModel(modelId);
      await refresh();
    },
    [refresh]
  );

  const dismiss = useCallback((modelId: string) => {
    failedRef.current.delete(modelId);
    setModels((prev) => prev.filter((row) => row.id !== modelId));
  }, []);

  return { models, loading, loadError, installError, install, cancel, remove, dismiss, refresh };
}
