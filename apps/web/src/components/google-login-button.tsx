"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiFetch } from "../lib/api";

type GoogleCredentialResponse = {
  credential: string;
};

type GoogleApi = {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        auto_select?: boolean;
        itp_support?: boolean;
      }) => void;
      renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
      prompt: () => void;
    };
  };
};

declare global {
  interface Window {
    google: GoogleApi;
  }
}

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
};

export function GoogleLoginButton() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let script: HTMLScriptElement | null = null;

    const tryRestoreSession = async (): Promise<boolean> => {
      const refreshToken = localStorage.getItem("RefreshToken");
      if (!refreshToken) {
        return false;
      }
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";
      try {
        const response = await fetch(`${apiUrl}/auth/refresh`, {
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
        const data = (await response.json()) as Partial<LoginResponse>;
        if (!data.accessToken) {
          localStorage.removeItem("AccessToken");
          localStorage.removeItem("RefreshToken");
          return false;
        }
        localStorage.setItem("AccessToken", data.accessToken);
        if (data.refreshToken) {
          localStorage.setItem("RefreshToken", data.refreshToken);
        }
        router.replace("/dashboard");
        return true;
      } catch {
        localStorage.removeItem("AccessToken");
        localStorage.removeItem("RefreshToken");
        return false;
      }
    };

    const initializeGoogleSignIn = () => {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId || !window.google) {
        setError("GoogleConfigMissing");
        setIsCheckingSession(false);
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        auto_select: true,
        itp_support: true,
        callback: async (response: GoogleCredentialResponse) => {
          try {
            const data = await ApiFetch<LoginResponse>("/auth/google", {
              method: "POST",
              body: JSON.stringify({ idToken: response.credential }),
              headers: {
                "Content-Type": "application/json"
              }
            });
            localStorage.setItem("AccessToken", data.accessToken);
            localStorage.setItem("RefreshToken", data.refreshToken);
            router.replace("/dashboard");
          } catch {
            setError("GoogleLoginFailed");
          }
        }
      });

      const parent = document.getElementById("GoogleLoginContainer");
      if (parent) {
        window.google.accounts.id.renderButton(parent, {
          theme: "filled_blue",
          size: "large",
          text: "signin_with"
        });
      }
      window.google.accounts.id.prompt();
      setIsCheckingSession(false);
    };

    const bootstrapAuth = async () => {
      const restored = await tryRestoreSession();
      if (restored) {
        return;
      }

      script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogleSignIn;
      document.body.appendChild(script);
    };

    void bootstrapAuth();

    return () => {
      if (script && document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [router]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div id="GoogleLoginContainer" />
      {isCheckingSession ? <small style={{ color: "var(--TextSecondary)" }}>Verificando sessao...</small> : null}
      {error ? <small style={{ color: "var(--Danger)" }}>{error}</small> : null}
    </div>
  );
}
