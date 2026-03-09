const API_BASE = "/api/proxy";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: {
    method?: string;
    body?: string | FormData;
    token?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  const { method = "GET", body, token, headers = {} } = options;

  const finalHeaders: Record<string, string> = { ...headers };
  const authToken = token || getToken();
  if (authToken) {
    finalHeaders["Authorization"] = `Bearer ${authToken}`;
  }
  if (body && typeof body === "string" && !finalHeaders["Content-Type"]) {
    finalHeaders["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: finalHeaders,
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = `HTTP ${res.status}`;
    try {
      const json = JSON.parse(text);
      message = json.detail || json.message || message;
    } catch {
      if (text) message = text;
    }
    throw new ApiError(res.status, message);
  }

  return res.json() as Promise<T>;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}
