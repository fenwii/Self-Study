export class ProviderHttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly requestId?: string,
    readonly retryable = false
  ) {
    super(message);
    this.name = 'ProviderHttpError';
  }
}

interface JsonRequestOptions {
  timeoutMs: number;
  retries?: number;
  signal?: AbortSignal;
}

const retryableStatus = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

export async function requestJson<T>(
  url: string,
  init: RequestInit,
  options: JsonRequestOptions
): Promise<{ data: T; headers: Headers }> {
  const retries = options.retries ?? 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('模型请求超时。')), options.timeoutMs);
    const abort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', abort, { once: true });

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const raw = await response.text();
      const requestId = response.headers.get('x-request-id')
        ?? response.headers.get('request-id')
        ?? response.headers.get('cf-ray')
        ?? undefined;
      let data: unknown = {};
      if (raw) {
        try { data = JSON.parse(raw); } catch { data = { raw }; }
      }

      if (!response.ok) {
        const detail = extractErrorMessage(data);
        const retryable = retryableStatus.has(response.status);
        const error = new ProviderHttpError(
          `模型接口请求失败（${response.status}）${detail ? `：${detail}` : ''}${requestId ? ` [requestId=${requestId}]` : ''}`,
          response.status,
          requestId,
          retryable
        );
        if (!retryable || attempt >= retries) throw error;
        lastError = error;
      } else {
        return { data: data as T, headers: response.headers };
      }
    } catch (error) {
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      lastError = normalizeNetworkError(error);
      const retryable = !(lastError instanceof ProviderHttpError) || lastError.retryable;
      if (!retryable || attempt >= retries) throw lastError;
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abort);
    }

    await sleep(Math.min(3_000, 300 * (2 ** attempt) + Math.round(Math.random() * 180)));
  }

  throw lastError instanceof Error ? lastError : new Error('模型接口请求失败。');
}

function extractErrorMessage(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const object = value as Record<string, unknown>;
  const error = object.error;
  if (typeof error === 'string') return error.slice(0, 800);
  if (error && typeof error === 'object') {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === 'string') return message.slice(0, 800);
  }
  const message = object.message;
  return typeof message === 'string' ? message.slice(0, 800) : '';
}

function normalizeNetworkError(error: unknown): Error {
  if (error instanceof ProviderHttpError) return error;
  if (error instanceof DOMException && error.name === 'AbortError') return new Error('模型请求已取消或超时。');
  if (error instanceof Error) return new Error(`模型网络请求失败：${error.message}`);
  return new Error('模型网络请求失败。');
}

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
