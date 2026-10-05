"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AvatarPicker, AvatarDisplay, AVATARS } from "@/components/AvatarPicker";

export type Team = { id: number; name: string; color: string | null };

/** Eine der Klassen, aus denen ein Kurs/WPF besteht. */
export type ScopeClassOption = { id: number; code: string; display_name: string };

interface Props {
  gameCode: string;
  gameIcon?: string;
  gameTitle?: string;
  error?: string | null;
  submitting?: boolean;
  onJoin: (name: string, avatar: string, teamId?: number | null, classId?: number | null) => void;
  /** Optional team selection (Caputh team mode). Selection required when non-empty. */
  teams?: Team[];
  /**
   * Klassen einer klassenübergreifenden Runde (Kurs/WPF). Wird nur Gästen
   * gezeigt — angemeldete Schüler bringen ihre Klasse selbst mit. Ohne Wahl
   * zählt die Leistung für keine Klasse, deshalb ist sie dann Pflicht.
   */
  classes?: ScopeClassOption[];
  /** Saved session from a previous visit — renders a rejoin card first. */
  savedSession?: { name: string; avatar: string } | null;
  onRejoin?: () => void;
  /** Werkzeug verwirft den Avatar — dann gar nicht erst danach fragen. */
  showAvatar?: boolean;
  /** Im Playhub bereits gewählt: Name und Avatar stehen fest, es bleibt nur der Rest (Teams). */
  identity?: { name: string; avatar: string } | null;
}

export function PlayerIdentityForm({
  gameCode, gameIcon = "🎮", gameTitle, error, submitting, onJoin,
  teams = [], classes = [], savedSession = null, onRejoin, showAvatar = true, identity = null,
}: Props) {
  const { auth } = useAuth();
  const [nameInput, setNameInput] = useState("");
  const [avatar, setAvatar] = useState<string>(
    () => identity?.avatar ?? AVATARS[Math.floor(Math.random() * AVATARS.length)].id,
  );
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const lockedName = identity?.name ?? (auth?.student
    ? (auth.student.username ?? auth.student.display_name)
    : null);

  const needsTeam = teams.length > 0 && selectedTeamId === null;
  // Angemeldete Schüler haben ihre Klasse schon — gefragt wird nur, wer keine mitbringt.
  const asksClass = classes.length > 0 && !auth?.student;
  const needsClass = asksClass && selectedClassId === null;

  function handleSubmit() {
    const n = lockedName ?? nameInput.trim();
    if (!n || needsTeam || needsClass) return;
    onJoin(n, avatar, teams.length > 0 ? selectedTeamId : undefined,
           asksClass ? selectedClassId : undefined);
  }

  if (!mounted) return null;

  const shell = (children: React.ReactNode) => (
    // Eigener Scroll-Rahmen, wie bei den Simulationen (f8d3648): auf den
    // /play-Routen ist <main> overflow-hidden, also war alles unterhalb des
    // Sichtfelds — Avatar-Raster, »Beitreten« — auf dem iPhone unerreichbar.
    <div
      className="h-full app-scroll"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)" }}
    >
      <div style={{ minHeight: "100svh" }} className="flex flex-col items-center justify-center gap-6 p-6">
        <div className="text-5xl">{gameIcon}</div>
        {gameTitle && <h1 className="text-xl font-black tracking-tight text-center text-white">{gameTitle}</h1>}
        <p className="font-mono tracking-widest text-indigo-300 text-sm">{gameCode}</p>

        {error && (
          <p className="text-red-400 text-sm text-center bg-red-400/10 rounded-xl px-4 py-2">{error}</p>
        )}

        <div className="w-full max-w-xs flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );

  // ── Rejoin card (saved session, user hasn't asked for a new identity) ──
  if (savedSession && onRejoin && !showNewForm) {
    return shell(
      <>
        <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <AvatarDisplay avatarId={savedSession.avatar} size="lg" />
          <div>
            <p className="text-white font-bold text-lg leading-tight">{savedSession.name}</p>
            <p className="text-white/50 text-sm">Gespeicherte Sitzung</p>
          </div>
        </div>

        <button
          onClick={onRejoin}
          disabled={submitting}
          className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
        >
          {submitting ? "Verbinde…" : `Weiter als ${savedSession.name} →`}
        </button>

        <button
          onClick={() => setShowNewForm(true)}
          className="w-full py-2 text-white/50 text-sm hover:text-white/80 transition-colors"
        >
          Neuer Spieler
        </button>
      </>
    );
  }

  // ── New-player form ─────────────────────────────────────────────────
  return shell(
    <>
      {lockedName ? (
        <div className="flex flex-col items-center gap-3">
          {showAvatar && <AvatarDisplay avatarId={avatar} size="lg" />}
          <div className="flex items-center gap-2 rounded-xl px-4 py-2 border border-white/20 bg-white/10">
            <span className="text-white font-semibold">{lockedName}</span>
            {!identity && <span className="text-white/40 text-xs">eingeloggt</span>}
          </div>
        </div>
      ) : (
        <input
          autoFocus
          className="w-full rounded-xl px-4 py-3 text-center text-lg font-semibold outline-hidden border border-white/20 bg-white/10 text-white placeholder-white/40 focus:border-indigo-400"
          placeholder="Dein Name"
          maxLength={30}
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
        />
      )}

      {showAvatar && !identity && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs text-white/50 mb-2 text-center">Avatar wählen</p>
          <AvatarPicker selected={avatar} onSelect={(id) => setAvatar(id)} />
        </div>
      )}

      {teams.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-white/70 text-sm text-center">Team wählen</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {teams.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTeamId(t.id)}
                className={`px-3 py-1.5 rounded-xl text-sm font-semibold border-2 transition-all ${selectedTeamId === t.id ? "border-yellow-400 bg-yellow-400/20 text-yellow-200" : "border-white/20 text-white/70 hover:border-white/50"}`}
                style={t.color ? { borderColor: selectedTeamId === t.id ? undefined : t.color + "88" } : undefined}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {asksClass && (
        <div className="flex flex-col gap-2">
          <p className="text-white/70 text-sm text-center">Für welche Klasse spielst du?</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {classes.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedClassId(c.id)}
                className={`px-3 py-1.5 rounded-xl text-sm font-semibold border-2 transition-all ${selectedClassId === c.id ? "border-yellow-400 bg-yellow-400/20 text-yellow-200" : "border-white/20 text-white/70 hover:border-white/50"}`}
              >
                {c.code}
              </button>
            ))}
          </div>
          <p className="text-white/40 text-xs text-center">
            Deine Punkte gehen an diese Klasse.
          </p>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || (!lockedName && !nameInput.trim()) || needsTeam || needsClass}
        className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
        style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
      >
        {submitting ? "Verbinde…" : "Beitreten"}
      </button>

      {savedSession && onRejoin && (
        <button
          onClick={() => setShowNewForm(false)}
          className="w-full py-2 text-white/50 text-sm hover:text-white/80 transition-colors"
        >
          ← Zurück
        </button>
      )}
    </>
  );
}
