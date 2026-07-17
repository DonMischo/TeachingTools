"use client";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

const ALL_CARDS: { href: string; icon: string; title: string; description: string; color: string; teacherOnly: boolean }[] = [
  {
    href: "/schreibraum",
    icon: "📝",
    title: "Schreibraum",
    description: "Kollaborativer Schreibraum für die Klasse — gemeinsam schreiben, Zeilen vergeben.",
    color: "#a78bfa",
    teacherOnly: false,
  },
  {
    href: "/tools/barometer",
    icon: "🧭",
    title: "Meinungsbarometer",
    description: "Anonyme Abstimmungen und Meinungsbilder live in der Klasse durchführen.",
    color: "#f59e0b",
    teacherOnly: false,
  },
  {
    href: "/tools/exit-ticket",
    icon: "🎫",
    title: "Exit Ticket",
    description: "Anonymes Schnell-Feedback am Ende einer Stunde einholen.",
    color: "#34d399",
    teacherOnly: false,
  },
  {
    href: "/tools/auction",
    icon: "🏷️",
    title: "Auktion",
    description: "Lehrer legt Items auf, Schüler geben Gebote ab — Wartend, offen, abgeschlossen.",
    color: "#34d399",
    teacherOnly: true,
  },
  {
    href: "/tools/zeitstrahl",
    icon: "📏",
    title: "Zeitstrahl",
    description: "Zeitleisten mit parallelen Spuren und Zahlenstrahlen — anzeigen, einsortieren, Fehler finden.",
    color: "#f472b6",
    teacherOnly: true,
  },
  {
    href: "/classroom",
    icon: "🖥️",
    title: "Classroom Screen",
    description: "Uhr, Timer und Stoppuhr als frei positionierbare Widgets auf dem Beamer.",
    color: "#60a5fa",
    teacherOnly: false,
  },
  {
    href: "/stundenplaner",
    icon: "📋",
    title: "Stundenplaner",
    description: "Verlaufsplanungen erstellen, Phasen strukturieren und mit Kolleg·innen teilen.",
    color: "#a3e635",
    teacherOnly: true,
  },
];

export default function ToolsPage() {
  const { auth } = useAuth();
  const isTeacher = auth?.user_type === "teacher";
  const CARDS = ALL_CARDS.filter(c => !c.teacherOnly || isTeacher);
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
