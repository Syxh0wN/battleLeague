const ApiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

export function GetAuthHeaders(): Record<string, string> {
  const accessToken = typeof window !== "undefined" ? localStorage.getItem("AccessToken") : null;
  if (!accessToken) {
    return {
      "Content-Type": "application/json"
    };
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`
  };
}

export async function ApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${ApiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...GetAuthHeaders(),
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `RequestFailed:${response.status}`);
  }
  return (await response.json()) as T;
}
