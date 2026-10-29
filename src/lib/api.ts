"use client";

export type ApiErrorBody = { code: string; message: string; details?: { path: string; message: string }[] };

export class ApiClientError extends Error {
  constructor(public status: number, public body: ApiErrorBody) {
    super(body.message);
  }
  /** Field-level messages keyed by path, for showing next to form inputs. */
  fieldErrors(): Record<string, string> {
    return Object.fromEntries((this.body.details ?? []).map((d) => [d.path, d.message]));
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(`/api/v1${path}`, {
    ...rest,
    headers: { ...(json !== undefined && { "Content-Type": "application/json" }), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
  if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/auth/login")) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({ error: { code: "INTERNAL", message: "Unexpected response from server" } }));
  if (!res.ok) throw new ApiClientError(res.status, body.error);
  return (body.data ?? body) as T;
}
