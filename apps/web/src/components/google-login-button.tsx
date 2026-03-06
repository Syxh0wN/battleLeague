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
    <div style={{ display: "grid", gap: 16 }}>
      <button
        onClick={handleQuickLogin}
        style={{
          border: "none",
          borderRadius: 10,
          padding: "12px 14px",
          background: "var(--PrimaryBlue)",
          color: "white",
          fontWeight: 700,
          cursor: "pointer"
        }}
      >
        Fazer Login com o Google
      </button>
      {isCheckingSession ? <small style={{ color: "var(--TextSecondary)" }}>Verificando sessao...</small> : null}
      {error ? <small style={{ color: "var(--Danger)" }}>{error}</small> : null}
    </div>
  );
}
