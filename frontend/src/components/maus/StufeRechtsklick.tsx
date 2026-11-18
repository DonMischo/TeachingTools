"use client";
/**
 * Stufe 3: Rechtsklick. Das Kind sucht sich sein Tier über ein Kontextmenü
 * aus — das Tier begleitet es durch die übrigen Stufen und steht auf dem
 * Führerschein.
 *
 * Das Menü ist nachgebaut (Kontextmenue.tsx) und gilt nur auf den Tieren.
 * Überall sonst bleibt das Menü des Browsers — das braucht Stufe 7 zum
 * Speichern.
 */
import { useRef, useState } from "react";
import { AVATARS, AvatarDisplay } from "@/components/AvatarPicker";
import { PUNKTE_RECHTSKLICK, type StufenErgebnis } from "@/lib/maus/ergebnis";
import { tierName } from "@/lib/maus/tiere";
import { Kontextmenue, SYMBOLE, type Eintrag } from "./Kontextmenue";
import { mitTasten } from "./Taste";
import { useWindows } from "./windows/WindowsKontext";
import { Stufenkopf } from "./Stufenkopf";
import { DemoBuehne, mitte, useDemo } from "./Demo";

const DEMO_TIER = "panda";

export default function StufeRechtsklick({
  avatar, onAvatar, onFertig, onWeiter,
}: {
  avatar: string | null;
  onAvatar: (id: string) => void;
  onFertig: (e: StufenErgebnis) => void;
  onWeiter: () => void;
}) {
  const { system, sys } = useWindows();
  const mac = system === "macos";
  const ubuntu = system === "ubuntu";
  const kurz = (k: string) => k.replace(/\[\[|\]\]/g, "").replace(/\+/g, mac ? "" : "+");
  const [menue, setMenue] = useState<{ x: number; y: number; id: string } | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [wackelt, setWackelt] = useState<{ id: string; nr: number } | null>(null);
  const [gewaehlt, setGewaehlt] = useState(false);
  const start = useRef(performance.now());
  const rasterRef = useRef<HTMLDivElement>(null);
  const demo = useDemo(() => setMenue(null));

  function waehlen(id: string) {
    onAvatar(id);
    setHinweis(null);
    if (!gewaehlt) {
      setGewaehlt(true);
      onFertig({
        punkte: PUNKTE_RECHTSKLICK,
        dauerMs: Math.round(performance.now() - start.current),
        details: [`Gewähltes Tier: ${tierName(id)}`],
      });
    }
  }

  function vorfuehren() {
    const zelle = () => rasterRef.current?.querySelector(`[data-zelle="${DEMO_TIER}"]`) ?? null;
    demo.abspielen([
      { text: "Zeige mit der Maus auf ein Tier.", zu: () => mitte(zelle()) },
      {
        text: "Drücke die rechte Taste.", taste: "rechts",
        aktion: () => {
          const ort = mitte(zelle());
          if (ort) setMenue({ x: ort.x, y: ort.y, id: DEMO_TIER });
        },
      },
      { text: "Ein Menü geht auf. Fahre zu »Als mein Tier wählen«.", zu: () => mitte(document.querySelector('[role="menuitem"]')) },
      { text: "Wähle es mit der linken Taste aus.", taste: "links" },
      { text: "Grau geschriebene Einträge gehen gerade nicht. Jetzt du!", aktion: () => setMenue(null) },
    ]);
  }

  return (
    <div className="flex flex-col gap-4">
      <Stufenkopf
        titel="📋 Stufe 3 · Rechtsklick"
        auftrag={
          gewaehlt && avatar
            ? <>Dein Tier: <b>{tierName(avatar)}</b>. Es begleitet dich durch die nächsten Stufen. Umentscheiden? Einfach nochmal rechts klicken.</>
            : <>Such dir dein Tier aus: Klicke mit der <b>rechten</b> Maustaste auf ein Tier und wähle <b>»Als mein Tier wählen«</b>.</>
        }
        punkte={gewaehlt ? PUNKTE_RECHTSKLICK : 0}
        onDemo={vorfuehren}
        onWeiter={onWeiter}
        hervor={gewaehlt}
      >
        {gewaehlt && avatar && <AvatarDisplay avatarId={avatar} size="lg" />}
      </Stufenkopf>

      {sys.rechtsklickHinweis && (
        <p className="text-center text-sm text-muted">💡 {mitTasten(sys.rechtsklickHinweis)}</p>
      )}

      <div className="min-h-6 text-center text-sm font-bold text-muted" aria-live="polite">
        {hinweis}
      </div>

      <div ref={rasterRef} className="grid grid-cols-6 gap-2 w-full mx-auto" style={{ maxWidth: "min(640px, calc((100vh - 400px) * 1.2))" }}>
        {AVATARS.map(a => (
          <button
            key={a.id}
            type="button"
            data-zelle={a.id}
            aria-label={tierName(a.id)}
            onClick={() => {
              setWackelt({ id: a.id, nr: Date.now() });
              setHinweis("Das war die linke Taste. Die rechte Taste öffnet ein Menü!");
            }}
            onContextMenu={e => {
              e.preventDefault();
              if (demo.aktiv) return;
              setMenue({ x: e.clientX, y: e.clientY, id: a.id });
            }}
            className={
              "aspect-square rounded-2xl flex items-center justify-center text-3xl sm:text-4xl select-none " +
              (avatar === a.id && gewaehlt ? "ring-4 ring-accent " : "") +
              (wackelt?.id === a.id ? "maus-wackeln" : "")
            }
            style={{ backgroundColor: a.bg }}
          >
            <span key={wackelt?.id === a.id ? wackelt.nr : undefined} className={avatar === a.id && gewaehlt ? a.anim : ""}>{a.emoji}</span>
          </button>
        ))}
      </div>

      {menue && (
        <Kontextmenue
          x={menue.x}
          y={menue.y}
          system={system}
          onZu={() => { if (!demo.aktiv) setMenue(null); }}
          eintraege={[
            { text: "Als mein Tier wählen", symbol: SYMBOLE.tier, onWahl: () => { if (!demo.aktiv) waehlen(menue.id); } },
            "trenner",
            { text: "Ausschneiden", symbol: SYMBOLE.ausschneiden, kuerzel: kurz(sys.kuerzel.ausschneiden), aus: true },
            { text: "Kopieren", symbol: SYMBOLE.kopieren, kuerzel: kurz(sys.kuerzel.kopieren), aus: true },
            ...(system === "windows" ? [] : [{ text: mac ? "Einsetzen" : "Einfügen", symbol: SYMBOLE.kopieren, kuerzel: kurz(sys.kuerzel.einfuegen), aus: true } as Eintrag]),
            { text: ubuntu ? "Umbenennen …" : "Umbenennen", symbol: SYMBOLE.umbenennen, kuerzel: kurz(sys.kuerzel.umbenennen), aus: true },
            {
              text: mac ? "In den Papierkorb legen" : ubuntu ? "In den Papierkorb verschieben" : "Löschen",
              symbol: SYMBOLE.loeschen, kuerzel: kurz(sys.kuerzel.loeschen), aus: true,
            },
            "trenner",
            { text: mac ? "Informationen" : "Eigenschaften", symbol: SYMBOLE.eigenschaften, kuerzel: mac ? "⌘I" : "Alt+Eingabe", aus: true },
          ]}
        />
      )}

      <DemoBuehne demo={demo} />
    </div>
  );
}
