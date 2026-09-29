import Link from "next/link";
import HelpButton from "@/components/HelpButton";

const CARDS = [
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
    <div className="flex flex-col gap-8 p-6 max-w-[var(--seite-breite)] mx-auto w-full">
      <div>
        <h1 className="text-2xl font-black tracking-tight">⚔️ Sport &amp; Spiele</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Wettkämpfe und Sportfest — alles rund um Bewegung und Wettbewerb.
        </p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-4">
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
                <div className="text-xs text-[var(--text-muted)]">
                  → öffnen
                </div>
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
