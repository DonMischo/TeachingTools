"use client";
import { useState } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAvailability } from "@/hooks/useAvailability";
import HelpButton from "@/components/HelpButton";
import { ToolSuche, passtZurSuche } from "@/components/ToolSuche";

const ALL_CARDS: { slug: string; href: string; icon: string; title: string; description: string; color: string }[] = [
  {
    slug: "schreibraum",
    href: "/schreibraum",
    icon: "📝",
    title: "Schreibraum",
    description: "Kollaborativer Schreibraum für die Klasse — gemeinsam schreiben, Zeilen vergeben.",
    color: "#a78bfa",
  },
  {
    slug: "karten",
    href: "/aktivitaeten/karten",
    icon: "🗺️",
    title: "Karten",
    description: "Atlas für Deutschland, Europa und die Welt: politisch, topographisch, Wirtschaft — Objekte nummerieren, Arbeitsblätter exportieren, Kartenquiz per Code.",
    color: "#0d9488",
  },
  {
    slug: "barometer",
    href: "/tools/barometer",
    icon: "🧭",
    title: "Umfrage",
    description: "Anonyme Abstimmungen und Meinungsbilder live in der Klasse durchführen.",
    color: "#f59e0b",
  },
  {
    slug: "exit-ticket",
    href: "/tools/exit-ticket",
    icon: "🎫",
    title: "Exit Ticket",
    description: "Anonymes Schnell-Feedback am Ende einer Stunde einholen.",
    color: "#34d399",
  },
  {
    slug: "auktion",
    href: "/tools/auction",
    icon: "🏷️",
    title: "Auktion",
    description: "Lehrer legt Items auf, Schüler geben Gebote ab — Wartend, offen, abgeschlossen.",
    color: "#34d399",
  },
  {
    slug: "classroom",
    href: "/classroom",
    icon: "🖥️",
    title: "Classroom Screen",
    description: "Uhr, Timer und Stoppuhr als frei positionierbare Widgets auf dem Beamer.",
    color: "#60a5fa",
  },
  {
    slug: "stundenplaner",
    href: "/stundenplaner",
    icon: "📋",
    title: "Stundenplaner",
    description: "Verlaufsplanungen erstellen, Phasen strukturieren und mit Kolleg·innen teilen.",
    color: "#a3e635",
  },
  {
    slug: "wettkampf",
    href: "/tools/wettkampf",
    icon: "🏆",
    title: "Wettkämpfe",
    description: "Turniere erstellen, Spielpläne verwalten und Ergebnisse eintragen.",
    color: "#e8821a",
  },
  {
    slug: "sportfest",
    href: "/tools/sportfest",
    icon: "🏃",
    title: "Sportfest",
    description: "Sportfest-Disziplinen, Anmeldungen und Punktevergabe.",
    color: "#1878a8",
  },
  {
    slug: "fragmente",
    href: "/fragmente",
    icon: "🗂️",
    title: "Fragmente",
    description: "Pinnwände mit Karten & Clippings — teilbar mit Klassen und per QR-Gastzugang.",
    color: "#8b5cf6",
  },
  {
    slug: "snap",
    href: "/tools/snap",
    icon: "🧱",
    title: "Snap!",
    description: "Blockbasiertes Programmieren — läuft lokal, Programme liegen in TT.",
    color: "#22d3ee",
  },
];

export default function ToolsPage() {
  const router = useRouter();
  const { can, ready } = useAvailability();
  const [suche, setSuche] = useState("");
  const ERLAUBT = ready ? ALL_CARDS.filter(c => can(c.slug, "use")) : [];
  const CARDS = ERLAUBT.filter(c => passtZurSuche(c, suche));

  // Once resolved, a user with no available Tools (the default for students)
  // is sent to Games rather than shown an empty page.
  useEffect(() => {
    if (ready && CARDS.length === 0) router.replace("/aktivitaeten");
  }, [ready, CARDS.length, router]);

  return (
    <div className="flex flex-col gap-8 p-6 max-w-seite mx-auto w-full">
      <div>
        <h1 className="text-2xl font-black tracking-tight">🔨 Tools</h1>
        <p className="text-muted text-sm mt-1">
          Unterrichtstools — direkt im Unterricht einsetzen.
        </p>
      </div>

      <ToolSuche wert={suche} setzen={setSuche} treffer={CARDS.length} gesamt={ERLAUBT.length} />

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-4">
        {CARDS.map(card => (
          <Link
            key={card.href}
            href={card.href}
            className="group relative flex flex-col gap-4 p-6 rounded-2xl border border-line
              bg-surface hover:bg-surface-hover transition-all
              hover:border-accent hover:shadow-lg"
          >
            <HelpButton slug={card.slug} className="absolute top-3 right-3" />
            <div className="flex items-center gap-3">
              <span style={{
                fontSize: 40, lineHeight: 1,
                filter: `drop-shadow(0 2px 6px ${card.color}66)`,
              }}>
                {card.icon}
              </span>
              <div>
                <div className="font-black text-lg" style={{ color: card.color }}>
                  {card.title}
                </div>
                <div className="text-xs text-muted">→ öffnen</div>
              </div>
            </div>
            <p className="text-sm text-muted leading-relaxed">
              {card.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
