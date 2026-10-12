import {
  catalogSchema,
  mediaSearchResultSchema,
  trackSchema,
  type ApiHealth,
  type Catalog,
  type ImportMediaRequest,
  type MediaSearchResult,
  type Track,
} from "@miusix/contracts";

export function createMiusixClient(baseUrl: string) {
  const apiBase = baseUrl.replace(/\/$/, "");

  async function request<T>(
    path: string,
    parse: (input: unknown) => T,
    init?: RequestInit,
  ): Promise<T> {
    const response = await fetch(`${apiBase}${path}`, init);
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { message?: string } | null;
      throw new Error(body?.message ?? `Miusix API request failed: ${response.status}`);
    }
    return parse(await response.json());
  }

  return {
    health: () => request<ApiHealth>("/health", (value) => value as ApiHealth),
    catalog: (): Promise<Catalog> =>
      request("/v1/catalog", (value) => catalogSchema.parse(value)),
    tracks: (): Promise<Track[]> =>
      request("/v1/tracks", (value) => trackSchema.array().parse(value)),
    track: (id: string): Promise<Track> =>
      request(`/v1/tracks/${encodeURIComponent(id)}`, (value) => trackSchema.parse(value)),
    search: (query: string): Promise<MediaSearchResult[]> =>
      request(
        `/v1/search?q=${encodeURIComponent(query)}`,
        (value) => mediaSearchResultSchema.array().parse(value),
      ),
    importMedia: (input: ImportMediaRequest): Promise<Track> =>
      request("/v1/imports", (value) => trackSchema.parse(value), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
  };
}
