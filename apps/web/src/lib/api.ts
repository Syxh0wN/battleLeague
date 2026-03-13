function ResolveApiBaseUrl() {
  if (typeof window !== "undefined") {
    return "/api-proxy";
  }
  if (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.length > 0) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return "http://localhost:3000/battle";
}

const ApiBaseUrl = ResolveApiBaseUrl();
let RefreshInFlight: Promise<boolean> | null = null;

function ExtractResponseErrorMessage(rawBody: string, status: number): string {
  const defaultMessage = BuildDefaultApiErrorMessage(status);
  if (!rawBody) {
    return defaultMessage;
  }
  try {
    const parsedBody = JSON.parse(rawBody) as { message?: string | string[]; error?: string };
    const parsedMessage = parsedBody.message;
    if (Array.isArray(parsedMessage) && parsedMessage.length > 0) {
      return parsedMessage.join(", ");
    }
    if (typeof parsedMessage === "string" && parsedMessage.length > 0) {
      return parsedMessage;
    }
    if (typeof parsedBody.error === "string" && parsedBody.error.length > 0) {
      return parsedBody.error;
    }
    return defaultMessage;
  } catch {
    return defaultMessage;
  }
}

function BuildDefaultApiErrorMessage(status: number): string {
  if (status === 400) {
    return "Dados invalidos. Revise e tente novamente.";
  }
  if (status === 401) {
    return "Sessao expirada. Faca login novamente.";
  }
  if (status === 403) {
    return "Voce nao tem permissao para essa acao.";
  }
  if (status === 404) {
    return "Recurso nao encontrado.";
  }
  if (status === 409) {
    return "Conflito de dados. Atualize a tela e tente novamente.";
  }
  if (status >= 500) {
    return "Falha temporaria no servidor. Tente novamente em instantes.";
  }
  return `Falha na requisicao (${status}).`;
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
  try {
    const response = await fetch(`${ApiBaseUrl}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      }
    });
    if (!response.ok) {
      localStorage.removeItem("AccessToken");
      return false;
    }
    const payload = (await response.json()) as { accessToken: string };
    if (!payload.accessToken) {
      localStorage.removeItem("AccessToken");
      return false;
    }
    localStorage.setItem("AccessToken", payload.accessToken);
    return true;
  } catch {
    localStorage.removeItem("AccessToken");
    return false;
  }
}

export async function ApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${ApiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
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
        credentials: "include",
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
