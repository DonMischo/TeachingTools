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
import { useEffect, useState, type ReactNode } from "react";
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
import FunktionenWerkzeug from "@/components/simulationen/FunktionenWerkzeug";
import Rechenregeln from "@/components/simulationen/Rechenregeln";
import Groessen from "@/components/groessen/Groessen";
import Rechenzeichen from "@/components/rechenzeichen/Rechenzeichen";
import Uebung from "@/components/simulationen/Uebung";
import KiWerkstatt from "@/components/ki/KiWerkstatt";
import Sonnensystem from "@/components/sonnensystem/Sonnensystem";
import Verkehr from "@/components/verkehr/Verkehr";
import RockYourLife from "@/components/leben/RockYourLife";
import Leviathan from "@/components/leviathan/Leviathan";
import Kueste from "@/components/kueste/Kueste";
import ErdAufbau from "@/components/erde/ErdAufbau";
import WilsonZyklus from "@/components/wilson/WilsonZyklus";
import RegelLabor from "@/components/regeln/RegelLabor";
import Wellenkollaps from "@/components/wfc/Wellenkollaps";
import Wachstum from "@/components/dla/Wachstum";
import Schichtenmodell from "@/components/schichten/Schichtenmodell";
import Tippen from "@/components/tippen/Tippen";
import MausFuehrerschein, { schluesselFuerGast, schluesselFuerGastName } from "@/components/maus/MausFuehrerschein";
import { SharedTimeline } from "@/components/timeline/SharedTimeline";
import KartenQuizSpiel from "@/components/karten/KartenQuizSpiel";
import Algorithmen from "@/components/algo/Algorithmen";
import Periodensystem from "@/components/pse/Periodensystem";
import Strukturformeln from "@/components/struktur/Strukturformeln";

const TOOLS: Record<string, { title: string; icon: string; node: React.ReactNode }> = {
  gleichungswaage: { title: "Gleichungswaage", icon: "⚖️", node: <Gleichungswaage /> },
  abacus: { title: "Abakus", icon: "🧮", node: <Abakus /> },
  bildformate: { title: "Bildformate", icon: "🖼️", node: <Bildformate /> },
  vierecke: { title: "Vierecke", icon: "📐", node: <Vierecke /> },
  binaerrechner: { title: "Binär-Rechner", icon: "◈", node: <Binaerrechner /> },
  funktionen: { title: "Funktionen und Koordinatensystem", icon: "📈", node: <FunktionenWerkzeug /> },
  rechenregeln: { title: "Rechenregeln", icon: "🍎", node: <Rechenregeln /> },
  groessen: { title: "Größen & Einheiten", icon: "🪜", node: <Groessen /> },
  rechenzeichen: { title: "Rechenzeichen", icon: "➗", node: <Rechenzeichen /> },
  tippen: { title: "Tippen", icon: "⌨️", node: <Tippen /> },
  kueste: { title: "Küstendynamik", icon: "🌊", node: <Kueste /> },
  erdaufbau: { title: "Aufbau der Erde", icon: "🌍", node: <ErdAufbau /> },
  wilson: { title: "Wilson-Zyklus", icon: "🌋", node: <WilsonZyklus /> },
  regeln: { title: "Regel-Labor", icon: "🧬", node: <RegelLabor /> },
  wfc: { title: "Wellenfunktionskollaps", icon: "🧩", node: <Wellenkollaps /> },
  dla: { title: "Fraktales Wachstum", icon: "🪸", node: <Wachstum /> },
  schichten: { title: "Schichtenmodell", icon: "📶", node: <Schichtenmodell /> },
  pse: { title: "Periodensystem", icon: "🧪", node: <Periodensystem /> },
  atommodelle: { title: "Atommodelle", icon: "⚛️", node: <Periodensystem nur="modelle" /> },
  strukturformeln: { title: "Strukturformeln", icon: "⬡", node: <Strukturformeln /> },
  // Der Führerschein trägt in die Bestenliste ein — dafür braucht er Code und Gast-Token.
  maus: { title: "Maus-Führerschein", icon: "🐭", node: null },
  // Der Flug merkt sich Erforschtes je Code bzw. Konto — dafür braucht er den Code.
  sonnensystem: { title: "Sonnensystem", icon: "🪐", node: null },
  // Die Stadt ist ein Live-Raum je Code — dafür braucht sie Code und Gast-Token.
  verkehr: { title: "GTA – Ganztagsaufmerksamkeit im Verkehr – zu Fuß", icon: "🚦", node: null },
  // Die Lebenssimulation meldet Stand und Protokoll an die Lehrkraft — dafür braucht sie Code und Gast-Token.
  leben: { title: "Rock your Life", icon: "🎸", node: null },
  // Der Leviathan liest die Einstellungen der Lehrkraft über den Code.
  leviathan: { title: "Leviathan", icon: "🐋", node: null },
  // Die KI-Werkstatt braucht den Code: an ihm hängt die gemeinsame Tafel.
  ki: { title: "KI-Werkstatt", icon: "🤖", node: null },
  // Übung holt ihre Aufgaben vom Server und braucht dafür Code und Gast-Token.
  uebung: { title: "Übung", icon: "📚", node: null },
  // Der Zeitstrahl teilt eine bestimmte Zeitleiste — die haengt am Code, nicht
  // am Werkzeug, und wird deshalb erst hier nachgeladen.
  zeitstrahl: { title: "Zeitstrahl", icon: "📏", node: null },
  // Das Kartenquiz teilt einen Kartensatz und prüft auf dem Server — Code und Gast-Token.
  karten: { title: "Kartenquiz", icon: "🗺️", node: null },
  // Die Werkstatt meldet ihren Fortschritt an die Klassenübersicht — dafür braucht sie Code und Gast-Token.
  algo: { title: "Algorithmen-Werkstatt", icon: "🔀", node: null },
};

/**
 * Der scrollende Rahmen um das Werkzeug.
 *
 * `h-full` ist hier keine Zierde: auf den Vollbildrouten ist `<main>` ein
 * Block-Container mit `overflow-hidden`, kein Flex-Container. Ein `flex-1`
 * wäre also wirkungslos, das Werkzeug bekäme seine Inhaltshöhe, `overflow-y`
 * hätte nichts zu scrollen — und alles unterhalb des Sichtfelds wäre
 * abgeschnitten und mit keiner Geste erreichbar. Auf dem Telefon ist das die
 * halbe Simulation. `app-scroll` bringt dazu die iOS-Behandlung aus
 * globals.css (Momentum-Scrolling, kein Gummiband nach außen).
 */
function Buehne({ children }: { children: ReactNode }) {
  return <div className="h-full app-scroll">{children}</div>;
}

function Hinweis({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    // h-full statt flex-1 aus demselben Grund wie in `Buehne`: sonst ist die
    // Karte nur innerhalb ihrer eigenen Inhaltshöhe zentriert, klebt also oben.
    <div className="h-full flex items-center justify-center p-6">
      <div className="card px-6 py-8 max-w-md text-center">
        <div className="text-4xl mb-2">{icon}</div>
        <h1 className="text-xl font-black">{title}</h1>
        <p className="text-sm text-muted mt-2 leading-relaxed">{text}</p>
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
    : session.tool_slug === "karten"
      ? <KartenQuizSpiel code={code} token={auth ? null : guest.token} />
    : session.tool_slug === "uebung"
      ? <Uebung zugang={guest.token ? { code, token: guest.token } : undefined} />
      : session.tool_slug === "ki"
        // Angemeldete brauchen kein Token, den Code aber beide: die Tafel
        // sammelt je Sitzung, nicht je Werkzeug.
        ? <KiWerkstatt zugang={{ code, token: guest.token, name: guest.session?.name }} />
        : session.tool_slug === "sonnensystem"
          ? <Sonnensystem speicherSchluessel={auth
              ? `konto-${auth.user_type}-${auth.student?.id ?? auth.teacher?.id ?? 0}`
              : `gast-${code}`}
              lehrkraft={auth?.role === "teacher" || auth?.role === "admin"} />
        : session.tool_slug === "verkehr"
          ? <Verkehr zugang={{ code, token: guest.token }}
              // Wie beim Maus-Führerschein: Angemeldete je Konto, Gäste je Code und Gast-Id.
              speicherSchluessel={auth
                ? `konto-${auth.user_type}-${auth.student?.id ?? auth.teacher?.id ?? 0}`
                : guest.token ? schluesselFuerGast(code, guest.token) : `gast-${code}`}
              konto={auth?.user_type === "student"} />
        : session.tool_slug === "leben"
          ? <RockYourLife zugang={{ code, token: guest.token }}
              name={auth?.student?.display_name ?? guest.session?.name}
              // Wie beim Maus-Führerschein: Angemeldete je Konto, Gäste je Code und Gast-Id.
              speicherSchluessel={auth
                ? `konto-${auth.user_type}-${auth.student?.id ?? auth.teacher?.id ?? 0}`
                : guest.token ? schluesselFuerGast(code, guest.token) : `gast-${code}`} />
        : session.tool_slug === "leviathan"
          ? <Leviathan code={code}
              speicherSchluessel={auth
                ? `konto-${auth.user_type}-${auth.student?.id ?? auth.teacher?.id ?? 0}`
                : guest.token ? schluesselFuerGast(code, guest.token) : `gast-${code}`} />
        : session.tool_slug === "algo"
          ? <Algorithmen
              // Angemeldete je Konto, Gäste je Namen (wie beim Maus-Führerschein)
              speicherSchluessel={auth
                ? `hp_algo_stand_konto-${auth.user_type}-${auth.student?.id ?? auth.teacher?.id ?? 0}`
                : `hp_algo_stand_gast-${(guest.session?.name ?? code).trim().toLowerCase().replace(/\s+/g, " ")}`}
              onStand={s => { api.algo.fortschritt({ code, token: guest.token }, s).catch(() => { /* nur für die Übersicht */ }); }} />
        : session.tool_slug === "maus"
          ? <MausFuehrerschein
              zugang={{ code, token: guest.token }}
              name={auth?.student?.display_name ?? guest.session?.name}
              // Angemeldete behalten ihren Stand je Konto, Gäste je Namen (über
              // Codes und Gast-Tokens hinweg); ein Stand unter der alten
              // Gast-Id wird beim ersten Mal übernommen.
              speicherSchluessel={auth
                ? `konto-${auth.user_type}-${auth.student?.id ?? auth.teacher?.id ?? 0}`
                : schluesselFuerGastName(guest.session?.name ?? "")
                  ?? (guest.token ? schluesselFuerGast(code, guest.token) : `gast-${code}`)}
              ersatzSchluessel={!auth && guest.token ? schluesselFuerGast(code, guest.token) : undefined}
              konto={auth ? { typ: auth.user_type === "student" ? "student" : "teacher" } : undefined}
              klasse={auth?.student?.klasse ?? null}
            />
          : tool.node;

  // Angemeldete gehen direkt hinein — für sie gilt die Werkzeug-Freigabe.
  if (auth) return <Buehne>{body}</Buehne>;

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

  return <Buehne>{body}</Buehne>;
}
