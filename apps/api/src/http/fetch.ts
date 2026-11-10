export type FetchResponse = { ok: boolean; status: number; json(): Promise<unknown> };
export type FetchInit = { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal };

export const fetchJson = async (url: string, init: FetchInit = {}): Promise<FetchResponse> =>
  (await fetch(url, init)) as unknown as FetchResponse;
