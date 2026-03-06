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
      }) => void;
      renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
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

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId || !window.google) {
        setError("GoogleConfigMissing");
        return;
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
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
            router.push("/dashboard");
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
    };
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, [router]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div id="GoogleLoginContainer" />
      {error ? <small style={{ color: "var(--Danger)" }}>{error}</small> : null}
    </div>
  );
}
