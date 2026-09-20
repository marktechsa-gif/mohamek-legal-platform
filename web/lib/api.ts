const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("smart_mro_token");
}

export function setToken(token: string) {
  window.localStorage.setItem("smart_mro_token", token);
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (options.auth !== false) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error || `Request failed: ${response.status}`);
  }

  return data as T;
}

export async function uploadDamagePhoto(workOrderId: string, file: File) {
  const token = getToken();
  const formData = new FormData();
  formData.append("photo", file);

  const response = await fetch(`${API_URL}/work-orders/${workOrderId}/damage-photos`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.error || "فشل رفع الصورة");
  }

  return response.json();
}
