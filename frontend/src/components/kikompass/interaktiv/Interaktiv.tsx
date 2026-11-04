"use client";
/**
 * Verteiler für die interaktiven Teile einer Station. Ein Teil der Spiele
 * stammt aus der KI-Werkstatt (Raten, Zeichnen) und wird hier unverändert
 * eingebettet. Sie werden erst geladen, wenn die Station sie braucht.
 */
import dynamic from "next/dynamic";
import type { InteraktivId } from "@/lib/kikompass/stationen";
import { SORTIERSPIELE } from "@/lib/kikompass/interaktiv";
import { Sortieren } from "./Sortieren";
import { Schwaerzen } from "./Schwaerzen";
import { PromptBaukasten } from "./PromptBaukasten";
import { Fehlerjagd } from "./Fehlerjagd";
import { EchtOderKiText } from "./EchtOderKiText";
import { HundOderWolf } from "./HundOderWolf";

const Laden = () => <p className="text-sm text-muted">Lade …</p>;
const Raten = dynamic(() => import("@/components/ki/Raten").then(m => m.Raten), { ssr: false, loading: Laden });
const Zeichnen = dynamic(() => import("@/components/ki/Zeichnen").then(m => m.Zeichnen), { ssr: false, loading: Laden });

export function Interaktiv({ id, onFertig }: { id: InteraktivId; onFertig?: () => void }) {
  if (id.startsWith("sortieren:")) {
    const spiel = SORTIERSPIELE[id.slice("sortieren:".length)];
    return spiel ? <Sortieren spiel={spiel} onFertig={onFertig} /> : null;
  }
  switch (id) {
    case "schwaerzen": return <Schwaerzen onFertig={onFertig} />;
    case "prompt-baukasten": return <PromptBaukasten onFertig={onFertig} />;
    case "fehlerjagd": return <Fehlerjagd onFertig={onFertig} />;
    case "echt-oder-ki": return <EchtOderKiText onFertig={onFertig} />;
    case "hund-oder-wolf": return <HundOderWolf onFertig={onFertig} />;
    case "werkstatt:raten":
      return (
        <div className="flex flex-col gap-2">
          <p className="font-semibold">Mensch gegen Maschine: das nächste Wort raten</p>
          <p className="text-sm text-muted">Aus der KI-Werkstatt. Du und ein kleines Sprachmodell ratet abwechselnd das nächste Wort. Genau das tut ein Chatbot den ganzen Tag.</p>
          <Raten />
        </div>
      );
    case "werkstatt:zeichnen":
      return (
        <div className="flex flex-col gap-2">
          <p className="font-semibold">Zeichnen & Erkennen: eine Maschine anlernen</p>
          <p className="text-sm text-muted">Aus der KI-Werkstatt. Male Formen, sag dazu, was es ist, und teste die Maschine. Was passiert mit nur einem Beispiel? Und mit fünf?</p>
          <Zeichnen />
        </div>
      );
  }
}
