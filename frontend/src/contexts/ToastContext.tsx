"use client";
import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type Toast = { id: number; message: string; type: "success" | "error" | "info" };

interface ToastCtx {
  toast: (message: string, type?: Toast["type"]) => void;
}

const Ctx = createContext<ToastCtx>({ toast: () => {} });

let _id = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = ++_id;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-[999] pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium max-w-xs animate-in fade-in slide-in-from-bottom-2 duration-200 ${
              t.type === "success" ? "bg-green-600 text-white" :
              t.type === "error"   ? "bg-red-600 text-white" :
                                     "bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
