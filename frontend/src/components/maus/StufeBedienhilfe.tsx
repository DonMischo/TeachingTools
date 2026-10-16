"use client";
/**
 * Stufe »Zeiger & Text«: Mauszeiger vergrößern und einfärben, Textgröße
 * erhöhen — die Barrierefreiheits-Seiten der Einstellungen.
 */
import { useEffect, useRef, useState } from "react";
import { Stufenkopf } from "./Stufenkopf";
import { Hinweiszeile, useAufgabenStufe } from "./aufgabenStufe";
import { DemoBuehne, mitte, useDemo, type DemoSchritt } from "./Demo";
import { useMausKontext } from "./MausKontext";
import { useWindows } from "./windows/WindowsKontext";
import { WindowsDesktop } from "./windows/WindowsDesktop";
import { AppSymbol } from "./windows/AppSymbol";
import { Einstellungen } from "./windows/Einstellungen";
import { type Aussehen, type EinstellungId, type ZeigerFarbe } from "@/lib/maus/windows";
import { zeigerFarbeGewaehlt, zeigerGroesseGenug, zielZeigerFarbe } from "@/lib/maus/einstellungen";
import type { StufenErgebnis } from "@/lib/maus/ergebnis";

const ANZAHL_AUFGABEN = 3;
const ZEIGER_NAME: Record<ZeigerFarbe, string> = { weiss: "Weiß", schwarz: "Schwarz", gelb: "Gelb", bunt: "Bunt" };

export default function StufeBedienhilfe({
  onFertig, onWeiter,
}: { avatar: string; onFertig: (e: StufenErgebnis) => void; onWeiter: () => void }) {
  const { hilfe } = useMausKontext();
  const { aussehen, setAussehen, benutzer } = useWindows();

  const startGroesse = useRef(aussehen.zeigerGroesse);
  const zielFarbe = useRef(zielZeigerFarbe(aussehen));

  const { schritt, setFehler, hinweis, fertig, weiterMit, punkte } = useAufgabenStufe("bedienhilfe", ANZAHL_AUFGABEN, onFertig);
  const [fensterOffen, setFensterOffen] = useState(false);
  const [seite, setSeite] = useState<EinstellungId>("mauszeiger");
  const rahmenRef = useRef<HTMLDivElement>(null);
  const einstellungenRef = useRef<HTMLDivElement>(null);

  const vorDemo = useRef<{ aussehen: Aussehen; fensterOffen: boolean; seite: EinstellungId } | null>(null);
  const demo = useDemo(() => {
    if (!vorDemo.current) return;
    setAussehen(vorDemo.current.aussehen);
    setFensterOffen(vorDemo.current.fensterOffen);
    setSeite(vorDemo.current.seite);
    vorDemo.current = null;
  });

  function oeffnen() {
    if (demo.aktiv) return;
    setFensterOffen(true);
    setSeite(schritt === 2 ? "textgroesse" : "mauszeiger");
  }

  function schliessen() {
    setFensterOffen(false);
  }

  // Zeigergröße/-farbe wirken sofort auf `aussehen` — hier reicht ein Effekt
  // statt onAuswahl, weil beide Schritte am selben Regler-Paar hängen.
  useEffect(() => {
    if (demo.aktiv || fertig) return;
    if (schritt === 0 && zeigerGroesseGenug(aussehen, startGroesse.current)) {
      weiterMit(true, "Größer geht's — sehr gut!");
    } else if (schritt === 2 && aussehen.textGroesse >= 150) {
      weiterMit(true, "Prima — gut lesbar!");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aussehen.zeigerGroesse, aussehen.textGroesse, schritt]);

  function aufAuswahl(feld: keyof Aussehen, wert: unknown) {
    if (demo.aktiv || fertig) return;
    if (schritt === 1 && feld === "zeigerFarbe") {
      if (zeigerFarbeGewaehlt(aussehen, zielFarbe.current) || wert === zielFarbe.current) {
        weiterMit(true, "Genau die richtige Farbe!");
      } else {
        setFehler(f => f + 1);
        weiterMit(false, "Das ist noch nicht die gesuchte Farbe.");
      }
    }
  }

  const desktopSymbole = aussehen.taskleiste.includes("einstellungen")
    ? aussehen.desktop
    : [...aussehen.desktop.filter(id => id !== "einstellungen"), "einstellungen" as const];

  const aufgabenTexte = [
    <>Mach den <b>Mauszeiger größer</b>.</>,
    <>Gib dem Mauszeiger die Farbe <b>»{ZEIGER_NAME[zielFarbe.current]}«</b>.</>,
    <>Stell die <b>Textgröße</b> auf mindestens <b>150&nbsp;%</b>.</>,
  ];

  function vorfuehren() {
    vorDemo.current = { aussehen, fensterOffen, seite };
    const schritte: DemoSchritt[] = [];
    if (!fensterOffen) {
      schritte.push({ text: "Klicke auf »Einstellungen« in der Taskleiste.", zu: () => mitte(rahmenRef.current?.querySelector('[data-taskleiste="einstellungen"]') ?? null), taste: "links", aktion: () => { setFensterOffen(true); setSeite("mauszeiger"); } });
    }
    if (schritt === 0) {
      schritte.push({ text: "Ziehe den Regler bei »Zeigergröße« nach rechts.", zu: () => mitte(einstellungenRef.current?.querySelector('[data-testid="zeigergroesse"]') ?? null), taste: "links", aktion: () => setAussehen(a => ({ ...a, zeigerGroesse: 4 })) });
    } else if (schritt === 1) {
      schritte.push({ text: `Klicke auf die Zeigerfarbe »${ZEIGER_NAME[zielFarbe.current]}«.`, zu: () => mitte(einstellungenRef.current?.querySelector(`[data-zeigerfarbe="${zielFarbe.current}"]`) ?? null), taste: "links", aktion: () => setAussehen(a => ({ ...a, zeigerFarbe: zielFarbe.current })) });
    } else if (schritt === 2) {
      schritte.push(
        { text: "Öffne die Seite »Textgröße«.", zu: () => mitte(einstellungenRef.current?.querySelector('[data-einstellung-nav="textgroesse"]') ?? null), taste: "links", aktion: () => setSeite("textgroesse") },
        { text: "Ziehe den Regler bis mindestens 150 %.", zu: () => mitte(einstellungenRef.current?.querySelector('[data-testid="textgroesse"]') ?? null), taste: "links", aktion: () => setAussehen(a => ({ ...a, textGroesse: 150 })) },
      );
    }
    demo.abspielen(schritte);
  }

  return (
    <div className="flex flex-col gap-3">
      <Stufenkopf
        titel="🔎 Teil 3 · Zeiger & Text"
        auftrag={fertig ? <>Klasse — Zeiger und Text sind jetzt viel besser zu sehen!</> : aufgabenTexte[schritt]}
        punkte={punkte()}
        onDemo={fertig ? undefined : vorfuehren}
        onWeiter={onWeiter}
        hervor={fertig}
      />

      <Hinweiszeile hinweis={hinweis} />

      <WindowsDesktop
        aussehen={aussehen}
        symbole={desktopSymbole}
        offen={fensterOffen ? ["einstellungen"] : []}
        aktiv={fensterOffen ? "einstellungen" : null}
        onSymbol={id => { if (id === "einstellungen") oeffnen(); }}
        onTaskleiste={id => { if (id === "einstellungen") (fensterOffen ? schliessen() : oeffnen()); }}
        rahmenRef={rahmenRef}
      >
        {fensterOffen && (
          <div
            ref={einstellungenRef}
            className="pointer-events-auto absolute rounded-xl shadow-xl overflow-hidden flex flex-col"
            style={{ left: "8%", top: "6%", width: "84%", height: "82%", background: aussehen.dunkel ? "#202020" : "#f3f3f3" }}
          >
            <div className="flex items-center gap-2 px-2 shrink-0" style={{ height: 32, background: aussehen.dunkel ? "#2b2b2b" : "#ffffff", borderBottom: `1px solid ${aussehen.dunkel ? "#ffffff1a" : "#0000001a"}` }}>
              <AppSymbol id="einstellungen" groesse={18} titel={false} />
              <span className="text-sm font-bold flex-1" style={{ color: aussehen.dunkel ? "#fff" : "#1a1a1a" }}>Einstellungen</span>
              <button type="button" onClick={schliessen} aria-label="Schließen" className="rounded-sm hover:bg-red-500 hover:text-white w-6 h-6" style={{ color: aussehen.dunkel ? "#fff" : "#1a1a1a" }}>✕</button>
            </div>
            <div className="flex-1 overflow-hidden">
              <Einstellungen
                aussehen={aussehen}
                onAussehen={setAussehen}
                seite={seite}
                onSeite={setSeite}
                benutzer={benutzer}
                hilfe={hilfe}
                onAuswahl={aufAuswahl}
              />
            </div>
          </div>
        )}
      </WindowsDesktop>

      <DemoBuehne demo={demo} />
    </div>
  );
}
