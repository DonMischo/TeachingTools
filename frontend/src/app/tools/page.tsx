"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAvailability } from "@/hooks/useAvailability";
import HelpButton from "@/components/HelpButton";

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
];

export default function ToolsPage() {
  const router = useRouter();
  const { can, ready } = useAvailability();
  const CARDS = ready ? ALL_CARDS.filter(c => can(c.slug, "use")) : [];

  // Once resolved, a user with no available Tools (the default for students)
  // is sent to Games rather than shown an empty page.
  useEffect(() => {
    if (ready && CARDS.length === 0) router.replace("/games");
  }, [ready, CARDS.length, router]);

  return (
    <div className="flex flex-col gap-8 p-6 max-w-3xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-black tracking-tight">🔨 Tools</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Unterrichtstools — direkt im Unterricht einsetzen.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CARDS.map(card => (
          <Link
            key={card.href}
            href={card.href}
            className="group relative flex flex-col gap-4 p-6 rounded-2xl border border-[var(--border)]
              bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-all
              hover:border-[var(--accent)] hover:shadow-lg"
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
                <div className="text-xs text-[var(--text-muted)]">→ öffnen</div>
              </div>
            </div>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              {card.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
