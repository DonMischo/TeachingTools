"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useAvailability } from "@/hooks/useAvailability";

export default function SportfestPage() {
  const { auth } = useAuth();
  const isTeacher = auth?.role === "teacher" || auth?.role === "admin";
  const { can } = useAvailability();

  return (
    <div className="page">
      <div>
        <Link href="/tools" className="text-sm text-muted hover:text-fg">← Tools</Link>
        <h1 className="text-2xl font-black tracking-tight mt-1">🏃 Sportfest</h1>
        <p className="text-muted text-sm mt-1">DLV Nationale Punktwertung</p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3">
        <Link href="/tools/sportfest/ranking"
          className="card p-4 hover:bg-surface-hover transition-colors">
          <div className="text-2xl mb-2">🏆</div>
          <div className="font-semibold">Gesamtranking</div>
          <div className="text-xs text-muted mt-1">Punkteübersicht aller Schüler</div>
        </Link>
        <Link href="/tools/sportfest/disziplinen"
          className="card p-4 hover:bg-surface-hover transition-colors">
          <div className="text-2xl mb-2">📊</div>
          <div className="font-semibold">Disziplinranking</div>
          <div className="text-xs text-muted mt-1">Sprint · Ausdauer · Weitsprung · Ballwurf</div>
        </Link>
        {isTeacher && can("sportfest", "create") && (
          <Link href="/tools/sportfest/ergebnisse"
            className="card p-4 hover:bg-surface-hover transition-colors">
            <div className="text-2xl mb-2">✏️</div>
            <div className="font-semibold">Ergebnisse erfassen</div>
            <div className="text-xs text-muted mt-1">Leistungen pro Klasse eintragen</div>
          </Link>
        )}
        {auth?.role === "admin" && (
          <Link href="/tools/sportfest/setup"
            className="card p-4 hover:bg-surface-hover transition-colors">
            <div className="text-2xl mb-2">⚙️</div>
            <div className="font-semibold">Setup</div>
            <div className="text-xs text-muted mt-1">Disziplinen aktivieren</div>
          </Link>
        )}
      </div>
    </div>
  );
}
