"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function SportfestPage() {
  const { auth } = useAuth();
  const isTeacher = auth?.role === "teacher" || auth?.role === "admin";

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto w-full">
      <div>
        <Link href="/games" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">← Spiele</Link>
        <h1 className="text-2xl font-black tracking-tight mt-1">🏃 Sportfest</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">DLV Nationale Punktwertung</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link href="/games/sportfest/ranking"
          className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors">
          <div className="text-2xl mb-2">🏆</div>
          <div className="font-semibold">Gesamtranking</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Punkteübersicht aller Schüler</div>
        </Link>
        <Link href="/games/sportfest/disziplinen"
          className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors">
          <div className="text-2xl mb-2">📊</div>
          <div className="font-semibold">Disziplinranking</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Sprint · Ausdauer · Weitsprung · Ballwurf</div>
        </Link>
        {isTeacher && (
          <Link href="/games/sportfest/ergebnisse"
            className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors">
            <div className="text-2xl mb-2">✏️</div>
            <div className="font-semibold">Ergebnisse erfassen</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Leistungen pro Klasse eintragen</div>
          </Link>
        )}
        {auth?.role === "admin" && (
          <Link href="/games/sportfest/setup"
            className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors">
            <div className="text-2xl mb-2">⚙️</div>
            <div className="font-semibold">Setup</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Disziplinen aktivieren</div>
          </Link>
        )}
      </div>
    </div>
  );
}
