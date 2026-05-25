export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    ...options
  });
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error || "请求失败");
  return payload.data as T;
}
