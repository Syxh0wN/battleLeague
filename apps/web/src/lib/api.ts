const ApiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";
let RefreshInFlight: Promise<boolean> | null = null;

function ExtractResponseErrorMessage(rawBody: string, status: number): string {
  if (!rawBody) {
    return `RequestFailed:${status}`;
  }
  try {
    const parsedBody = JSON.parse(rawBody) as { message?: string | string[]; error?: string };
    const parsedMessage = parsedBody.message;
    if (Array.isArray(parsedMessage) && parsedMessage.length > 0) {
      return parsedMessage.join(" | ");
    }
    if (typeof parsedMessage === "string" && parsedMessage.length > 0) {
      return parsedMessage;
    }
    if (typeof parsedBody.error === "string" && parsedBody.error.length > 0) {
      return parsedBody.error;
    }
    return rawBody;
  } catch {
    return rawBody;
  }
}

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

async function TryRefreshSession(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }
  const refreshToken = localStorage.getItem("RefreshToken");
  if (!refreshToken) {
    localStorage.removeItem("AccessToken");
    return false;
  }
  try {
    const response = await fetch(`${ApiBaseUrl}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ refreshToken })
    });
    if (!response.ok) {
      localStorage.removeItem("AccessToken");
      localStorage.removeItem("RefreshToken");
      return false;
    }
    const payload = (await response.json()) as { accessToken: string; refreshToken?: string };
    if (!payload.accessToken) {
      localStorage.removeItem("AccessToken");
      localStorage.removeItem("RefreshToken");
      return false;
    }
    localStorage.setItem("AccessToken", payload.accessToken);
    if (payload.refreshToken) {
      localStorage.setItem("RefreshToken", payload.refreshToken);
    }
    return true;
  } catch {
    localStorage.removeItem("AccessToken");
    localStorage.removeItem("RefreshToken");
    return false;
  }
}

export async function ApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${ApiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...GetAuthHeaders(),
      ...(init?.headers ?? {})
    }
  });
  if (response.status === 401 && path !== "/auth/refresh") {
    if (!RefreshInFlight) {
      RefreshInFlight = TryRefreshSession().finally(() => {
        RefreshInFlight = null;
      });
    }
    const refreshed = await RefreshInFlight;
    if (refreshed) {
      const retryResponse = await fetch(`${ApiBaseUrl}${path}`, {
        ...init,
        headers: {
          ...GetAuthHeaders(),
          ...(init?.headers ?? {})
        }
      });
      if (!retryResponse.ok) {
        const retryBody = await retryResponse.text();
        throw new Error(ExtractResponseErrorMessage(retryBody, retryResponse.status));
      }
      return (await retryResponse.json()) as T;
    }
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(ExtractResponseErrorMessage(body, response.status));
  }
  return (await response.json()) as T;
}
