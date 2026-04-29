"use client";

import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastTone = "success" | "danger" | "info";

type Toast = {
  id: number;
  title: string;
  message?: string;
  tone: ToastTone;
};

type ToastInput = {
  title: string;
  message?: string;
  tone?: ToastTone;
  durationMs?: number;
};

const ToastContext = createContext<{ notify: (toast: ToastInput) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((input: ToastInput) => {
    const id = nextId.current++;
    const toast = { id, tone: input.tone ?? "info", title: input.title, message: input.message };
    setToasts((current) => [toast, ...current].slice(0, 4));

    const timer = window.setTimeout(() => dismiss(id), input.durationMs ?? 4200);
    timers.current.set(id, timer);
  }, [dismiss]);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => {
          const Icon = toast.tone === "success" ? CheckCircle2 : toast.tone === "danger" ? AlertCircle : Info;
          return (
            <div key={toast.id} className={`toast toast-${toast.tone}`} role={toast.tone === "danger" ? "alert" : "status"}>
              <Icon size={18} />
              <div className="toast-copy">
                <strong>{toast.title}</strong>
                {toast.message && <span>{toast.message}</span>}
              </div>
              <button type="button" className="toast-close" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification">
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Something went wrong.";
}
