"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

/** Nur Pfade dieser Seite: kein »//fremd.de«, keine absolute Adresse. */
export function zurueckZiel(roh: string | null | undefined): string {
  return roh && roh.startsWith("/") && !roh.startsWith("//") && !roh.startsWith("/\\") ? roh : "/aktivitaeten";
}

/** Spielerseiten, auf denen eine Lehrkraft mitspielen kann. */
export function istSpielerseite(pfad: string): boolean {
  return pfad.startsWith("/play/") || pfad.startsWith("/aktivitaeten/lueckentext/play/");
}

/** Knopf auf der Steuerungsseite: öffnet die Spielerseite im selben Tab und merkt sich den Weg zurück. */
export function SelbstSpielenKnopf({ href, className = "btn-secondary" }: { href: string; className?: string }) {
  const [pfad, setPfad] = useState<string | null>(null);
  useEffect(() => { setPfad(window.location.pathname); }, []);
  const ziel = pfad ? `${href}${href.includes("?") ? "&" : "?"}zurueck=${encodeURIComponent(pfad)}` : href;
  return (
    <Link href={ziel} className={className}
          title="Spiel selbst durch — dein Stand bleibt erhalten, für die Klasse bist du unsichtbar">
      ▶ Selbst mitspielen
    </Link>
  );
}

/** Auf Spielerseiten, nur für Lehrkräfte: zurück zur Steuerung. Der Spielstand liegt auf dem Server. */
export function LehrkraftLeiste() {
  const pfad = usePathname();
  const { auth } = useAuth();
  const [ziel, setZiel] = useState("/aktivitaeten");
  useEffect(() => {
    setZiel(zurueckZiel(new URLSearchParams(window.location.search).get("zurueck")));
  }, [pfad]);
  if (auth?.user_type !== "teacher" || !istSpielerseite(pfad)) return null;
  return (
    <Link href={ziel}
          className="fixed bottom-3 right-3 z-[60] rounded-full bg-surface/90 text-fg border border-line shadow-lg px-3 py-1.5 text-xs font-semibold backdrop-blur hover:bg-surface"
          title="Zurück zur Steuerung — dein Spielstand bleibt erhalten, hier geht es später weiter">
      ← Steuerung
    </Link>
  );
}
