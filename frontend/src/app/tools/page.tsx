"use client";
import { useState } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAvailability } from "@/hooks/useAvailability";
import { KartenRaster, WerkzeugKarte, type Werkzeug } from "@/components/WerkzeugKarte";
import { ToolSuche, passtZurSuche } from "@/components/ToolSuche";

const ALL_CARDS: Werkzeug[] = [
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
    title: "Tafelorganizer",
    description: "Uhr, Timer und Stoppuhr als frei positionierbare Widgets auf dem Beamer.",
    color: "#60a5fa",
  },
  {
    slug: "kompendium",
    href: "/tools/kompendium",
    icon: "📚",
    title: "Methoden-Kompendium",
    description: "Methoden aus Didaktik, Pädagogik und Psychologie für Einstieg, Hauptteil und Abschluss — mit Evidenz und Quellen.",
    color: "#2a9db0",
  },
  {
    slug: "ueberblick",
    href: "/tools/ueberblick",
    icon: "🧾",
    title: "Was kann TT?",
    description: "Alle Aktivitäten, Simulationen und Werkzeuge mit ihren Funktionen: durchsuchen, aufklappen, für eine KI kopieren.",
    color: "#e07820",
  },
  {
    slug: "curriculum",
    href: "/tools/curriculum",
    icon: "🧭",
    title: "Curriculinator",
    description: "Schulcurriculum gegen alten und neuen Lehrplan: Konflikte, neue und verschobene Inhalte, Wochen je Klasse.",
    color: "#7c6ee6",
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
    slug: "main-character",
    href: "/tools/main-character",
    icon: "👑",
    title: "Main Character",
    description: "Lebenssimulation bis zum Abschluss: Fragebogen, Charakterbogen, Wochenplan, Zeugnis als PDF — per QR mit anonymer Klassenübersicht.",
    color: "#a259ec",
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

      <KartenRaster>
        {CARDS.map(card => <WerkzeugKarte key={card.href} karte={card} />)}
      </KartenRaster>
    </div>
  );
}
