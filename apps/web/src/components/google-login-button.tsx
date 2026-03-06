"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiFetch } from "../lib/api";

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
};

export function GoogleLoginButton() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
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

    const bootstrapAuth = async () => {
      const restored = await tryRestoreSession();
      if (restored) {
        return;
      }
      setIsCheckingSession(false);
    };

    void bootstrapAuth();
  }, [router]);

  const handleQuickLogin = async () => {
    try {
      const data = await ApiFetch<LoginResponse>("/auth/quick", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      localStorage.setItem("AccessToken", data.accessToken);
      localStorage.setItem("RefreshToken", data.refreshToken);
      router.replace("/dashboard");
    } catch {
      setError("QuickLoginFailed");
    }
  };

  return (
    <div className="grid gap-4">
      <button
        onClick={handleQuickLogin}
        className="inline-flex items-center justify-center rounded-xl border border-blue-400/70 bg-blue-500/30 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:-translate-y-px hover:bg-blue-500/45"
      >
        Fazer Login com o Google
      </button>
      {isCheckingSession ? <small className="text-slate-400">Verificando sessao...</small> : null}
      {error ? <small className="text-red-400">{error}</small> : null}
    </div>
  );
}
