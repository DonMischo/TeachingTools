"use client";
/** Zellautomat-Höhlen: Zufallsrauschen wird Runde für Runde zu runden Höhlen. */
import { useRef, useState } from "react";
import { zufall } from "@/lib/regeln/maschine";
import { HOEHLE_STANDARD, NACHBARN_MAX, anteilFrei, erzeugeHoehle, neueHoehle, regelUmrechnen, type Hoehle, type Nachbarschaft } from "@/lib/spielalgo/hoehle";
import { Buehne, Frage, Legende, Notiz, Rahmen, Regler, Steuerung, useAblauf } from "./gemeinsam";
import { Hinweis, Vertiefung, Wahl } from "./Vertiefung";
import { CODE_HOEHLE } from "./code";

const PX = 8;
const VORLAGEN: { name: string; geburt: number[]; ueberleben: number[] }[] = [
  { name: "Höhle (B5678/S45678)", geburt: [5, 6, 7, 8], ueberleben: [4, 5, 6, 7, 8] },
  { name: "Labyrinthisch (B3/S12345)", geburt: [3], ueberleben: [1, 2, 3, 4, 5] },
  { name: "Inseln (B678/S345678)", geburt: [6, 7, 8], ueberleben: [3, 4, 5, 6, 7, 8] },
  { name: "Game of Life (B3/S23)", geburt: [3], ueberleben: [2, 3] },
];

export default function Hoehlen() {
  const [seed, setSeed] = useState(1);
  const [fels, setFels] = useState(HOEHLE_STANDARD.fels);
  const [runden, setRunden] = useState(HOEHLE_STANDARD.runden);
  const [geburt, setGeburt] = useState(HOEHLE_STANDARD.geburt);
  const [ueberleben, setUeberleben] = useState(HOEHLE_STANDARD.ueberleben);
  const [groesste, setGroesste] = useState(true);
  const [nachbarschaft, setNachbarschaftRoh] = useState<Nachbarschaft>("moore");
  const [randFels, setRandFels] = useState(true);
  const max = NACHBARN_MAX[nachbarschaft];
  // Beim Wechsel der Nachbarschaft die Regel anteilig mitnehmen
  const setNachbarschaft = (n: Nachbarschaft) => {
    setGeburt(regelUmrechnen(geburt, nachbarschaft, n));
    setUeberleben(regelUmrechnen(ueberleben, nachbarschaft, n));
    setNachbarschaftRoh(n);
  };
  const o = { ...HOEHLE_STANDARD, fels, runden, geburt, ueberleben, groessteBehalten: groesste, nachbarschaft, randFels };
  const stand = useRef<{ hz: Hoehle }>({ hz: neueHoehle(o.b, o.h, 0, zufall(0)) });

  const ablauf = useAblauf(() => erzeugeHoehle(stand.current, o, zufall(seed)),
    [seed, fels, runden, geburt.join(), ueberleben.join(), groesste, nachbarschaft, randFels], 0.25);

  const zeichne = (ctx: CanvasRenderingContext2D) => {
    const { hz } = stand.current;
    for (let y = 0; y < hz.h; y++) for (let x = 0; x < hz.b; x++) {
      const i = y * hz.b + x;
      if (hz.z[i]) ctx.fillStyle = "#3f2f22";
      else if (hz.region && hz.region[i] > 0) ctx.fillStyle = `hsl(${(hz.region[i] * 67) % 360} 70% 62%)`;
      else ctx.fillStyle = hz.region ? "#e8d9b5" : "#d9c8a0";
      ctx.fillRect(x * PX, y * PX, PX, PX);
    }
  };

  const umschalten = (liste: number[], setListe: (l: number[]) => void, n: number) =>
    setListe(liste.includes(n) ? liste.filter(v => v !== n) : [...liste, n].sort((a, b) => a - b));
  const Kaestchen = ({ liste, setListe, label }: { liste: number[]; setListe: (l: number[]) => void; label: string }) => (
    <span className="flex items-center gap-1 flex-wrap">
      <span className="w-24">{label}</span>
      {Array.from({ length: max + 1 }, (_, n) => n).map(n => (
        <button key={n} onClick={() => umschalten(liste, setListe, n)}
          className={`w-6 h-6 rounded-sm text-xs font-bold border ${liste.includes(n) ? "bg-accent text-accent-fg border-accent" : "border-line bg-surface text-muted"}`}>{n}</button>
      ))}
    </span>
  );

  return (
    <Rahmen
      einstellungen={<>
        <Regler label="Fels am Anfang" wert={fels} min={0.3} max={0.65} schritt={0.01} setWert={setFels} anzeige={`${Math.round(fels * 100)} %`} />
        <Regler label="Runden" wert={runden} min={0} max={15} setWert={setRunden} />
        <label className="flex items-center gap-1"><input type="checkbox" checked={groesste} onChange={e => setGroesste(e.target.checked)} /> nur größte Höhle behalten</label>
        <div className="flex flex-col gap-1 w-full sm:w-auto">
          <Kaestchen liste={geburt} setListe={setGeburt} label="Fels entsteht bei" />
          <Kaestchen liste={ueberleben} setListe={setUeberleben} label="Fels bleibt bei" />
        </div>
        <select className="rounded-lg border border-line bg-surface px-2 py-1" value=""
          onChange={e => { const v = VORLAGEN[+e.target.value]; if (v) { setNachbarschaftRoh("moore"); setGeburt(v.geburt); setUeberleben(v.ueberleben); } }}>
          <option value="">Regel-Vorlage …</option>
          {VORLAGEN.map((v, i) => <option key={v.name} value={i}>{v.name}</option>)}
        </select>
      </>}
      vertiefung={
        <Vertiefung
          code={CODE_HOEHLE}
          hintergrund={<>
            <p>
              Ein <b>Zellautomat</b> kennt nur Nachbarn zählen und eine Tabelle. Wichtig ist »alle gleichzeitig«: Erst werden für alle Zellen
              die Nachbarn gezählt, dann wird alles auf einmal umgestellt. Wer beim Zählen schon umschreibt, bekommt schräge Schlieren.
            </p>
            <p>
              Die Schreibweise <b>B5678/S45678</b> kommt vom berühmten »Game of Life« (B3/S23): B wie <i>born</i> (entsteht), S wie <i>survives</i> (bleibt).
              Hier ist »lebendig« der Fels.
            </p>
            <p>Die <b>Nachbarschaft</b> legt fest, wer mitzählt: die 8 Zellen rundum (Moore), nur die 4 im Kreuz (von Neumann) oder zwei Ringe mit 24 Zellen. Größere Nachbarschaften glätten stärker.</p>
          </>}
          stellschrauben={<>
            <Wahl label="Nachbarschaft" wert={nachbarschaft} setWert={setNachbarschaft}
              optionen={[["moore", "8 rundum (Moore)"], ["neumann", "4 im Kreuz (von Neumann)"], ["moore2", "24 in zwei Ringen"]]} />
            <Hinweis>Die Regel wird anteilig umgerechnet; die Kästchen oben zeigen jetzt 0 bis {max}.</Hinweis>
            <label className="flex items-center gap-1"><input type="checkbox" checked={randFels} onChange={e => setRandFels(e.target.checked)} /> Rand zählt als Fels</label>
            <Hinweis>aus: Die Höhle darf zum Rand hin offen sein – gut für endlose, aneinandergesetzte Karten</Hinweis>
            <p className="text-xs">Regel jetzt: <b className="font-mono">B{geburt.join("")}/S{ueberleben.join("")}</b> {max > 9 && <span className="text-muted">(Zahlen ab 10 ohne Trenner)</span>}</p>
          </>}
        />
      }
      buehne={<>
        <Buehne b={o.b * PX} h={o.h * PX} takt={ablauf.takt} zeichne={zeichne} klasse="[image-rendering:pixelated]" data-hoehle />
        <Notiz ablauf={ablauf} />
        <Steuerung ablauf={ablauf} seed={seed} setSeed={setSeed} />
      </>}
      erklaerung={<>
        <h3 className="font-black text-lg">Zellautomat: Nachbarn zählen</h3>
        <p>Am Anfang ist jede Zelle zufällig <b>Fels</b> oder <b>frei</b>. Dann schaut jede Zelle gleichzeitig auf ihre acht Nachbarn und zählt, wie viele davon Fels sind:</p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>Eine freie Zelle wird Fels, wenn die Zahl in »Fels entsteht bei« markiert ist.</li>
          <li>Ein Fels bleibt Fels, wenn die Zahl in »Fels bleibt bei« markiert ist, sonst bröckelt er weg.</li>
          <li>Der Rand zählt als Fels, darum ist die Höhle ringsum geschlossen.</li>
        </ul>
        <p>Weil jede Zelle sich ihrer Nachbarschaft anpasst, verschwinden einzelne Steine und kleine Löcher. Nach 4–5 Runden ändert sich kaum noch etwas.</p>
        <p>Zum Schluss sucht eine <b>Flutfüllung</b> die getrennten Höhlen (bunt). Bleibt nur die größte, kommt man überall hin.</p>
        <Legende eintraege={[["#3f2f22", "Fels"], ["#d9c8a0", "frei"], ["hsl(67 70% 62%)", "abgetrennte Höhle"]]} />
        <p className="text-xs text-muted">Freie Fläche jetzt: {Math.round(anteilFrei(stand.current.hz) * 100)} %</p>
        <Frage>Verändere »Fels am Anfang« in kleinen Schritten von 40 % bis 55 %. Ab wann zerfällt die Höhle in viele kleine Kammern? Und was macht die Regel »Game of Life« daraus?</Frage>
      </>}
    />
  );
}
