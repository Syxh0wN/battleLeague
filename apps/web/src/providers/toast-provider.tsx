"use client";

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";

type ToastTone = "info" | "success" | "error";

type ToastInput = {
  title: string;
  message?: string;
  tone?: ToastTone;
  durationMs?: number;
};

type ToastItem = {
  id: string;
  title: string;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  addToast: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function BuildToastToneClass(tone: ToastTone): string {
  if (tone === "success") {
    return "border-emerald-400/50 bg-emerald-500/15 text-emerald-100";
  }
  if (tone === "error") {
    return "border-rose-400/50 bg-rose-500/15 text-rose-100";
  }
  return "border-slate-500/60 bg-slate-800/90 text-slate-100";
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: ToastInput) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const durationMs = toast.durationMs ?? 2600;
      setToasts((current) => [
        ...current,
        {
          id,
          title: toast.title,
          message: toast.message ?? "",
          tone: toast.tone ?? "info"
        }
      ]);
      window.setTimeout(() => {
        removeToast(id);
      }, durationMs);
    },
    [removeToast]
  );

  const contextValue = useMemo<ToastContextValue>(() => ({ addToast }), [addToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[70] grid max-w-[92vw] gap-2 sm:max-w-sm">
        {toasts.map((toast) => (
          <article
            key={toast.id}
            className={`pointer-events-auto grid gap-1 rounded-xl border px-3 py-2 shadow-[0_12px_30px_rgba(2,6,23,0.45)] ${BuildToastToneClass(toast.tone)}`}
          >
            <strong className="text-sm font-semibold">{toast.title}</strong>
            {toast.message ? <small className="text-xs opacity-90">{toast.message}</small> : null}
          </article>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast precisa ser usado dentro de ToastProvider");
  }
  return context;
}
