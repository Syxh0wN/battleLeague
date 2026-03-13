"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../providers/toast-provider";

type LoginResponse = {
  accessToken: string;
};

type UserPokemonSummary = {
  id: string;
};

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleAccountsId = {
  initialize: (options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      shape?: "rectangular" | "pill" | "circle" | "square";
      width?: number;
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
    }
  ) => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleAccountsId;
      };
    };
  }
}

function ResolveApiUrl() {
  if (typeof window !== "undefined") {
    return "/api-proxy";
  }
  if (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.length > 0) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return "http://localhost:3000/battle";
}

export function GoogleLoginButton() {
  const router = useRouter();
  const { addToast } = useToast();
  const [error, setError] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const [isGoogleRendered, setIsGoogleRendered] = useState(false);

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

  const GetGoogleButtonWidth = (buttonElement: HTMLElement) => {
    const containerWidth = buttonElement.parentElement?.clientWidth ?? buttonElement.clientWidth ?? 320;
    return Math.max(220, Math.min(380, containerWidth - 4));
  };
  const ResolvePostLoginPath = async (accessToken: string) => {
    const apiUrl = ResolveApiUrl();
    try {
      const response = await fetch(`${apiUrl}/pokemon/my`, {
        method: "GET",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      if (!response.ok) {
        return "/dashboard";
      }
      const data = (await response.json()) as UserPokemonSummary[];
      if (Array.isArray(data) && data.length === 0) {
        return "/pokemon";
      }
      return "/dashboard";
    } catch {
      return "/dashboard";
    }
  };

  const LoginWithGoogleCredential = async (idToken: string) => {
    const apiUrl = ResolveApiUrl();
    const response = await fetch(`${apiUrl}/auth/google`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ idToken })
    });
    if (!response.ok) {
      throw new Error("Falha no login Google");
    }
    const data = (await response.json()) as Partial<LoginResponse>;
    if (!data.accessToken) {
      throw new Error("Resposta invalida do servidor");
    }
    localStorage.setItem("AccessToken", data.accessToken);
    addToast({
      title: "Login realizado",
      message: "Conta Google conectada com sucesso.",
      tone: "success"
    });
    const nextPath = await ResolvePostLoginPath(data.accessToken);
    router.replace(nextPath);
  };

  const RenderGoogleButton = () => {
    if (typeof window === "undefined" || !window.google || !googleClientId) {
      return;
    }
    const buttonElement = document.getElementById("GoogleSignInButton");
    if (!buttonElement || isGoogleRendered) {
      return;
    }
    buttonElement.innerHTML = "";
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      auto_select: false,
      cancel_on_tap_outside: true,
      callback: (response) => {
        const credential = response.credential;
        if (!credential) {
          setError("Falha ao receber token da conta Google.");
          return;
        }
        setError("");
        setIsSubmitting(true);
        void LoginWithGoogleCredential(credential)
          .catch((loginError) => {
            const message = loginError instanceof Error ? loginError.message : "Falha no login Google";
            setError(message);
            addToast({ title: "Falha no login", message, tone: "error" });
          })
          .finally(() => {
            setIsSubmitting(false);
          });
      }
    });
    const buttonWidth = GetGoogleButtonWidth(buttonElement);
    window.google.accounts.id.renderButton(buttonElement, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
      width: buttonWidth
    });
    setIsGoogleRendered(true);
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!googleClientId) {
      setError("NEXT_PUBLIC_GOOGLE_CLIENT_ID nao configurado.");
      setIsCheckingSession(false);
      return;
    }
    const existingScript = document.getElementById("GoogleIdentityScript");
    if (existingScript) {
      setIsGoogleReady(true);
      return;
    }
    const script = document.createElement("script");
    script.id = "GoogleIdentityScript";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setIsGoogleReady(true);
    };
    script.onerror = () => {
      setError("Nao foi possivel carregar login Google.");
      setIsCheckingSession(false);
    };
    document.head.appendChild(script);
  }, [googleClientId]);

  useEffect(() => {
    if (!isGoogleReady) {
      return;
    }
    RenderGoogleButton();
  }, [isGoogleReady, isGoogleRendered]);

  useEffect(() => {
    const tryRestoreSession = async (): Promise<boolean> => {
      const apiUrl = ResolveApiUrl();
      try {
        const response = await fetch(`${apiUrl}/auth/refresh`, {
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
        const data = (await response.json()) as Partial<LoginResponse>;
        if (!data.accessToken) {
          localStorage.removeItem("AccessToken");
          return false;
        }
        localStorage.setItem("AccessToken", data.accessToken);
        const nextPath = await ResolvePostLoginPath(data.accessToken);
        router.replace(nextPath);
        return true;
      } catch {
        localStorage.removeItem("AccessToken");
        return false;
      }
    };

    const bootstrapAuth = async () => {
      setError("");
      const restored = await tryRestoreSession();
      if (restored) {
        return;
      }
      setIsCheckingSession(false);
    };

    void bootstrapAuth();
  }, [router]);

  return (
    <div className="grid w-full gap-4">
      <div id="GoogleSignInButton" className="grid min-h-[44px] w-full place-items-center" />
      {isSubmitting ? <small className="text-slate-400">Entrando com Google...</small> : null}
      {isCheckingSession ? <small className="text-slate-400">Verificando sessao...</small> : null}
      {error ? <small className="text-red-400">{error}</small> : null}
    </div>
  );
}
