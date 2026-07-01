import Link from "next/link";

const CARDS = [
  {
    href: "/capuths",
    icon: "🎲",
    title: "Caputh",
    description: "Quiz-System mit Klassisch, TÜ, Test, Wettbewerb und mehr — Schüler treten via Code bei.",
    color: "#a78bfa",
  },
  {
    href: "/bingo",
    icon: "🎰",
    title: "Bingo",
    description: "Lehrer erstellt Bingo-Karten mit Caller/Antwort-Paaren — Schüler erhalten individuelle Karten.",
    color: "#f59e0b",
  },
  {
    href: "/auction",
    icon: "🏷️",
    title: "Auktion",
    description: "Lehrer legt Items auf, Schüler geben Gebote ab — Wartend, offen, abgeschlossen.",
    color: "#34d399",
  },
];

export default function GamesPage() {
  return (
    <div className="flex flex-col gap-8 p-6 max-w-3xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-black tracking-tight">🎮 Spiele</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Interaktive Spiele und Wettbewerbe für den Unterricht.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CARDS.map(card => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex flex-col gap-4 p-6 rounded-2xl border border-[var(--border)]
              bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-all
              hover:border-[var(--accent)] hover:shadow-lg"
          >
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
