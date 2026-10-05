"use client";
import { useState } from "react";
import Link from "next/link";
import { useAvailability } from "@/hooks/useAvailability";
import HelpButton from "@/components/HelpButton";
import { ToolSuche, passtZurSuche } from "@/components/ToolSuche";

const ALL_CARDS: { slug: string; href: string; icon: string; title: string; description: string; color: string }[] = [
  {
    slug: "caputh",
    href: "/aktivitaeten/caputh",
    icon: "🎲",
    title: "Caputh",
    description: "Quiz-System mit Klassisch, TÜ, Test, Wettbewerb und mehr — Schüler treten via Code bei.",
    color: "#a78bfa",
  },
  {
    slug: "bingo",
    href: "/aktivitaeten/bingo",
    icon: "🎰",
    title: "Bingo",
    description: "Lehrer erstellt Bingo-Karten mit Caller/Antwort-Paaren — Schüler erhalten individuelle Karten.",
    color: "#f59e0b",
  },
  {
    slug: "exitgame",
    href: "/aktivitaeten/taskcrawler",
    icon: "🗝️",
    title: "TaskCrawler",
    description: "Der TaskCrawler: Schüler lösen Aufgaben in ihrem eigenen Tempo, Lehrer sehen live den Fortschritt.",
    color: "#16a34a",
  },
  {
    slug: "lueckentext",
    href: "/aktivitaeten/lueckentexte",
    icon: "🧩",
    title: "Lückentext",
    description: "Lückentexte mit Wortbank, Freitext und Multiple Choice — Schüler treten via Code bei, live Rangliste.",
    color: "#c084fc",
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
    slug: "zeitstrahl",
    href: "/aktivitaeten/zeitstrahl",
    icon: "📏",
    title: "Zeitstrahl",
    description: "Zeitleisten mit parallelen Spuren und Zahlenstrahlen — anzeigen, einsortieren, Fehler finden.",
    color: "#f472b6",
  },
  {
    slug: "uebung",
    href: "/simulationen/uebung",
    icon: "📚",
    title: "Übung",
    description: "Aufgaben zum Trainieren: Thema auswählen, rechnen, prüfen lassen. Die Schwierigkeit passt sich automatisch dem Können an, der Fortschritt wird gezählt.",
    color: "#0ea5e9",
  },
];

export default function AktivitaetenPage() {
  const { can, ready } = useAvailability();
  const [suche, setSuche] = useState("");
  const ERLAUBT = ready ? ALL_CARDS.filter(c => can(c.slug, "use")) : [];
  const CARDS = ERLAUBT.filter(c => passtZurSuche(c, suche));
  return (
    <div className="flex flex-col gap-8 p-6 max-w-seite mx-auto w-full">
      <div>
        <h1 className="text-2xl font-black tracking-tight">🎮 Aktivitäten</h1>
        <p className="text-muted text-sm mt-1">
          Spiele, Wettbewerbe und Übungsformate für den Unterricht.
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
