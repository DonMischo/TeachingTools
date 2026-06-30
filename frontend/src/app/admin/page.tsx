"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

export default function AdminPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const [showTheme, setShowTheme] = useState(false);

  useEffect(() => {
    if (auth !== null && auth.role !== "admin") router.replace("/");
  }, [auth, router]);

  if (!auth || auth.role !== "admin") return null;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-black tracking-tight">⚙️ Admin</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">Verwaltung nur für Administratoren</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link href="/admin/students"
          className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors">
          <div className="text-2xl mb-2">👥</div>
          <div className="font-semibold">Schülerdaten</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">CSV-Import · Zugänge generieren · Exportieren</div>
        </Link>
        <Link href="/admin/students/cards"
          className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors">
          <div className="text-2xl mb-2">🪪</div>
          <div className="font-semibold">Schülerkarten</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Zugangskarten drucken · Felder wählen · PDF</div>
        </Link>
        <Link href="/sportfest/setup"
          className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors">
          <div className="text-2xl mb-2">🏃</div>
          <div className="font-semibold">Sportfest Setup</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Disziplinen aktivieren</div>
        </Link>
        <button
          onClick={() => setShowTheme(true)}
          className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors text-left"
        >
          <div className="text-2xl mb-2">🎨</div>
          <div className="font-semibold">Darstellung</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Farbschema · Icon-Stil · Theme wechseln</div>
        </button>
        <Link href="/admin/style"
          className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors">
          <div className="text-2xl mb-2">📦</div>
          <div className="font-semibold">Style Pack</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Logo · Icons · Farbanpassung als ZIP hochladen</div>
        </Link>
      </div>

      {showTheme && <ThemeSwitcher onClose={() => setShowTheme(false)} />}
    </div>
  );
}
