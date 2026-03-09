"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../providers/toast-provider";

type LoginResponse = {
  accessToken: string;
};

function ResolveApiUrl() {
  if (typeof window !== "undefined") {
    return "/api-proxy";
  }
  if (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.length > 0) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return "http://localhost:3000/api";
}

export function GoogleLoginButton() {
  const BuildLocalProfileLabel = (profile: "a" | "b") => {
    return profile === "a" ? "principal" : "secundario";
  };

  const router = useRouter();
  const { addToast } = useToast();
  const [error, setError] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const detectLocalProfile = (): "a" | "b" => {
    if (typeof window === "undefined") {
      return "a";
    }
    const hostName = window.location.hostname.toLowerCase();
    if (hostName === "localhost" || hostName === "127.0.0.1") {
      return "a";
    }
    if (hostName.startsWith("192.168.")) {
      return "b";
    }
    return "a";
  };

  const doLocalAutoLogin = async (profile: "a" | "b") => {
    const apiUrl = ResolveApiUrl();
    const response = await fetch(`${apiUrl}/auth/local-auto?profile=${profile}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      }
    });
    if (!response.ok) {
      throw new Error("Falha no login local");
    }
    const data = (await response.json()) as Partial<LoginResponse>;
    if (!data.accessToken) {
      throw new Error("Resposta invalida do servidor");
    }
    localStorage.setItem("AccessToken", data.accessToken);
    localStorage.setItem("BattleLeagueLocalProfile", profile);
    addToast({
      title: "Login realizado",
      message: `Perfil local ${BuildLocalProfileLabel(profile)} conectado.`,
      tone: "success"
    });
    router.replace("/dashboard");
  };

  useEffect(() => {
    const tryRestoreSession = async (): Promise<boolean> => {
      const expectedProfile = detectLocalProfile();
      const currentProfile = localStorage.getItem("BattleLeagueLocalProfile");
      if (currentProfile && currentProfile !== expectedProfile) {
        localStorage.removeItem("AccessToken");
        return false;
      }
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
        localStorage.setItem("BattleLeagueLocalProfile", expectedProfile);
        router.replace("/dashboard");
        return true;
      } catch {
        localStorage.removeItem("AccessToken");
        return false;
      }
    };

    const bootstrapAuth = async () => {
      setError("");
      setIsSubmitting(true);
      const restored = await tryRestoreSession();
      if (restored) {
        return;
      }
      try {
        await doLocalAutoLogin(detectLocalProfile());
      } catch (err) {
        const message = err instanceof Error ? err.message : "Falha no login local";
        setError(message);
        addToast({ title: "Falha no login", message, tone: "error" });
        setIsCheckingSession(false);
      } finally {
        setIsSubmitting(false);
      }
    };

    void bootstrapAuth();
  }, [router]);

  return (
    <div className="grid gap-4">
      <button
        type="button"
        onClick={() => {
          setError("");
          setIsSubmitting(true);
          void doLocalAutoLogin(detectLocalProfile())
            .catch((err) => {
              const message = err instanceof Error ? err.message : "Falha no login local";
              setError(message);
              addToast({ title: "Falha no login", message, tone: "error" });
            })
            .finally(() => {
              setIsSubmitting(false);
            });
        }}
        disabled={isSubmitting}
        className="inline-flex items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-800/35 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-blue-400/60 hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span>{isSubmitting ? "Entrando..." : "Entrar no perfil local"}</span>
      </button>
      <small className="text-slate-400">Login com Google desativado no momento.</small>
      {isCheckingSession ? <small className="text-slate-400">Verificando sessao...</small> : null}
      {error ? <small className="text-red-400">{error}</small> : null}
    </div>
  );
}
