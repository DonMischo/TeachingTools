import { KartenRaster, WerkzeugKarte, type Werkzeug } from "@/components/WerkzeugKarte";

const CARDS: Werkzeug[] = [
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
];

export default function SportUndSpielePage() {
  return (
    <div className="flex flex-col gap-8 p-6 max-w-seite mx-auto w-full">
      <div>
        <h1 className="text-2xl font-black tracking-tight">⚔️ Sport &amp; Spiele</h1>
        <p className="text-muted text-sm mt-1">
          Wettkämpfe und Sportfest — alles rund um Bewegung und Wettbewerb.
        </p>
      </div>

      <KartenRaster>
        {CARDS.map(card => <WerkzeugKarte key={card.href} karte={card} />)}
      </KartenRaster>
    </div>
  );
}
