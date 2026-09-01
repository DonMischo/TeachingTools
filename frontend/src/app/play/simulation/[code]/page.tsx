"use client";
/**
 * Beitritt zu einem zustandslosen Werkzeug (Abakus, Gleichungswaage).
 *
 * Der QR der Lehrkraft zeigt hierher. Wer angemeldet ist, kommt direkt hinein;
 * wer nicht angemeldet ist, braucht das Gast-Opt-in der Sitzung — dann gilt
 * das übliche 60-Minuten-Fenster. Die Werkzeuge selbst rechnen im Browser und
 * rufen nichts ab; der Gast-Token ist der Nachweis, dass die Lehrkraft
 * Gäste hereingelassen hat.
 */
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, type ToolSessionOut } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useGuestSession } from "@/hooks/useGuestSession";
import { GuestExpired } from "@/components/GuestExpired";
import { PlayerIdentityForm } from "@/components/PlayerIdentityForm";
import Gleichungswaage from "@/components/waage/Gleichungswaage";
import Abakus from "@/components/simulationen/Abakus";
import Bildformate from "@/components/simulationen/Bildformate";
import Vierecke from "@/components/simulationen/Vierecke";
import Binaerrechner from "@/components/simulationen/Binaerrechner";
import Funktionen from "@/components/simulationen/Funktionen";
import Tippen from "@/components/tippen/Tippen";
import { SharedTimeline } from "@/components/timeline/SharedTimeline";

const TOOLS: Record<string, { title: string; icon: string; node: React.ReactNode }> = {
  gleichungswaage: { title: "Gleichungswaage", icon: "⚖️", node: <Gleichungswaage /> },
  abacus: { title: "Abakus", icon: "🧮", node: <Abakus /> },
  bildformate: { title: "Bildformate", icon: "🖼️", node: <Bildformate /> },
  vierecke: { title: "Vierecke", icon: "📐", node: <Vierecke /> },
  binaerrechner: { title: "Binär-Rechner", icon: "◈", node: <Binaerrechner /> },
  funktionen: { title: "Funktionen", icon: "📈", node: <Funktionen /> },
  tippen: { title: "Tippen", icon: "⌨️", node: <Tippen /> },
  // Der Zeitstrahl teilt eine bestimmte Zeitleiste — die haengt am Code, nicht
  // am Werkzeug, und wird deshalb erst hier nachgeladen.
  zeitstrahl: { title: "Zeitstrahl", icon: "📏", node: null },
};

function Hinweis({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-8 max-w-md text-center">
        <div className="text-4xl mb-2">{icon}</div>
        <h1 className="text-xl font-black">{title}</h1>
        <p className="text-sm text-[var(--text-muted)] mt-2 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

export default function SimulationJoinPage() {
  const params = useParams();
  const code = String(params.code ?? "").toUpperCase();
  const { auth, ready } = useAuth();
  const guest = useGuestSession(code);

  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<ToolSessionOut | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!code) return;
    api.toolSessions.get(code).then(setSession).catch(() => setNotFound(true));
  }, [code]);

  async function handleJoin(name: string) {
    setJoining(true);
    setJoinError(null);
    try {
      await guest.join("simulation", name);
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : "Beitritt nicht möglich.");
    } finally {
      setJoining(false);
    }
  }

  if (!mounted || !ready || (!session && !notFound)) {
    return <Hinweis icon="⏳" title="Einen Moment" text="Der Code wird geprüft." />;
  }
  if (notFound || !session) {
    return <Hinweis icon="🔍" title="Diesen Code kenne ich nicht"
      text="Tippfehler? Frag deine Lehrkraft nach dem aktuellen Code oder scanne den QR noch einmal." />;
  }

  const tool = TOOLS[session.tool_slug];
  if (!tool) {
    return <Hinweis icon="🧩" title="Unbekanntes Werkzeug"
      text={`Für »${session.tool_slug}« habe ich keine Ansicht.`} />;
  }

  const body = session.tool_slug === "zeitstrahl"
    ? <SharedTimeline code={code} guestToken={guest.token} />
    : tool.node;

  // Angemeldete gehen direkt hinein — für sie gilt die Werkzeug-Freigabe.
  if (auth) return <div className="flex-1 overflow-y-auto">{body}</div>;

  if (guest.expired) return <GuestExpired gameIcon={tool.icon} onRejoin={guest.rejoin} />;

  if (!guest.token) {
    if (!session.allow_guests) {
      return <Hinweis icon="🔒" title="Gäste sind hier nicht freigeschaltet"
        text="Melde dich mit deinem Zugang an — oder bitte deine Lehrkraft, Gäste für diesen Code zu erlauben." />;
    }
    return (
      <PlayerIdentityForm
        gameCode={code}
        gameIcon={tool.icon}
        gameTitle={tool.title}
        error={joinError}
        submitting={joining}
        onJoin={name => handleJoin(name)}
      />
    );
  }

  return <div className="flex-1 overflow-y-auto">{body}</div>;
}
