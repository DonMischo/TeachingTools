"use client";
import { useState } from "react";
import { useAvailability } from "@/hooks/useAvailability";
import { KartenRaster, WerkzeugKarte, type Werkzeug } from "@/components/WerkzeugKarte";
import { ToolSuche, passtZurSuche } from "@/components/ToolSuche";

const ALL_CARDS: Werkzeug[] = [
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
    slug: "challenge",
    href: "/aktivitaeten/challenge",
    icon: "⚔️",
    title: "Challenge",
    description: "Leistungsüberprüfung als Minispiel: Fakten den passenden Aufgaben zuordnen, Kombos, Stufen",
    color: "#e11d48",
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
    slug: "elemon",
    href: "/aktivitaeten/elemon",
    icon: "🐾",
    title: "Elemon",
    description: "Monster-Sammelspiel aus Klikk als eigenes Spiel: Elemon im Käfig fangen, Arenen besiegen, die Klasse zum Duell fordern — per Liste oder QR-Code. Gedruckte QR-Karten verstecken wilde Elemon im Schulhaus. Energie, Werbevideos und Kaufangebote zeigen, wie solche Spiele zurückholen.",
    color: "#16a34a",
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

      <KartenRaster>
        {CARDS.map(card => <WerkzeugKarte key={card.href} karte={card} />)}
      </KartenRaster>
    </div>
  );
}
