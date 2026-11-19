"use client";
/** BSP-Raumteilung: schneiden, Räume setzen, Geschwister verbinden — mit Baum daneben. */
import { useRef, useState } from "react";
import { zufall } from "@/lib/regeln/maschine";
import { BSP_STANDARD, erzeugeBsp, neuerBsp, type Bsp, type BspOptionen } from "@/lib/spielalgo/bsp";
import { Buehne, Frage, Legende, Notiz, Rahmen, Regler, Steuerung, useAblauf } from "./gemeinsam";
import { Hinweis, Vertiefung, Wahl } from "./Vertiefung";
import { CODE_BSP } from "./code";

const PX = 10;
const TIEFENFARBE = ["#64748b", "#0ea5e9", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#14b8a6"];

export default function BspRaeume() {
  const [seed, setSeed] = useState(1);
  const [min, setMin] = useState(BSP_STANDARD.min);
  const [tiefe, setTiefe] = useState(BSP_STANDARD.tiefe);
  const [fuellung, setFuellung] = useState(BSP_STANDARD.fuellung);
  const [schnitt, setSchnitt] = useState<NonNullable<BspOptionen["schnitt"]>>("laenger");
  const [streuung, setStreuung] = useState(1);
  const [gang, setGang] = useState<NonNullable<BspOptionen["gang"]>>("L");
  const [rundgaenge, setRundgaenge] = useState(0);
  const o: BspOptionen = { ...BSP_STANDARD, min, tiefe, fuellung, schnitt, streuung, gang, rundgaenge };
  const s = useRef<Bsp>(neuerBsp(o));

  const ablauf = useAblauf(() => {
    s.current = neuerBsp(o);
    return erzeugeBsp(s.current, zufall(seed));
  }, [seed, min, tiefe, fuellung, schnitt, streuung, gang, rundgaenge], 1);

  const zeichne = (ctx: CanvasRenderingContext2D) => {
    const st = s.current;
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(0, 0, o.b * PX, o.h * PX);
    // Teilstücke leicht getönt nach Tiefe
    st.knoten.forEach((k) => {
      if (k.kinder) return;
      ctx.fillStyle = TIEFENFARBE[k.tiefe % TIEFENFARBE.length] + "33";
      ctx.fillRect(k.r.x * PX, k.r.y * PX, k.r.b * PX, k.r.h * PX);
    });
    // Gänge
    ctx.fillStyle = "#d6c7a1";
    for (const g of st.gaenge) for (const [x, y] of g) ctx.fillRect(x * PX, y * PX, PX, PX);
    // Räume
    for (const k of st.knoten) if (k.raum) {
      ctx.fillStyle = "#f5efe6";
      ctx.fillRect(k.raum.x * PX, k.raum.y * PX, k.raum.b * PX, k.raum.h * PX);
    }
    // Schnittlinien, frühe dick
    st.knoten.forEach(k => {
      if (!k.schnitt) return;
      ctx.strokeStyle = TIEFENFARBE[k.tiefe % TIEFENFARBE.length];
      ctx.lineWidth = Math.max(1, 4 - k.tiefe * 0.6);
      ctx.beginPath();
      if (k.schnitt.senkrecht) { ctx.moveTo(k.schnitt.pos * PX, k.r.y * PX); ctx.lineTo(k.schnitt.pos * PX, (k.r.y + k.r.h) * PX); }
      else { ctx.moveTo(k.r.x * PX, k.schnitt.pos * PX); ctx.lineTo((k.r.x + k.r.b) * PX, k.schnitt.pos * PX); }
      ctx.stroke();
    });
    const a = st.knoten[st.aktiv];
    if (a && !ablauf.fertig) {
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 3;
      ctx.strokeRect(a.r.x * PX + 1.5, a.r.y * PX + 1.5, a.r.b * PX - 3, a.r.h * PX - 3);
    }
  };

  return (
    <Rahmen
      einstellungen={<>
        <Regler label="kleinstes Stück" wert={min} min={5} max={16} setWert={setMin} />
        <Regler label="Tiefe" wert={tiefe} min={1} max={7} setWert={setTiefe} />
        <Regler label="Raumgröße" wert={fuellung} min={0.3} max={1} schritt={0.05} setWert={setFuellung} anzeige={`${Math.round(fuellung * 100)} %`} />
      </>}
      vertiefung={
        <Vertiefung
          code={CODE_BSP}
          hintergrund={<>
            <p>
              Der Baum ist der Trick: Weil jedes Stück genau zwei Kinder hat, muss man beim Verbinden nur Geschwister verbinden.
              Von unten nach oben entsteht so immer ein zusammenhängender Plan, ohne dass man irgendwo prüfen muss, ob alles erreichbar ist.
            </p>
            <p>
              Der Nachteil: Das Ergebnis ist wieder ein <b>Baum</b> – von jedem Raum führt genau ein Weg zum anderen.
              Mit »Rundgänge« kommen zusätzliche Gänge dazu, dann kann man Gegnern ausweichen oder im Kreis laufen.
            </p>
            <p>Ähnlich rechnen Rogue-artige Spiele seit den 1980ern. In Doom (1993) diente ein BSP-Baum dagegen zum schnellen Zeichnen: Er sagt, welche Wand vor welcher liegt.</p>
          </>}
          stellschrauben={<>
            <Wahl label="Schnittrichtung" wert={schnitt} setWert={setSchnitt}
              optionen={[["laenger", "quer zur längeren Seite"], ["abwechselnd", "abwechselnd senkrecht/waagrecht"], ["zufall", "Münzwurf"]]} />
            <Hinweis>»Münzwurf« macht schmale Handtuch-Räume, »abwechselnd« ein Schachbrett-Gefühl</Hinweis>
            <Regler label="Schnitt-Streuung" wert={streuung} min={0} max={1} schritt={0.05} setWert={setStreuung} anzeige={`${Math.round(streuung * 100)} %`} />
            <Hinweis>0 % = immer genau in der Mitte (gleich große Räume), 100 % = irgendwo</Hinweis>
            <Wahl label="Gangform" wert={gang} setWert={setGang} optionen={[["L", "L-Form (ein Knick)"], ["Z", "Z-Form (Knick in der Mitte)"]]} />
            <Regler label="Rundgänge" wert={rundgaenge} min={0} max={8} setWert={setRundgaenge} />
            <Hinweis>zusätzliche Gänge zwischen nahen Räumen – aus dem Baum wird ein Netz</Hinweis>
          </>}
        />
      }
      buehne={<>
        <Buehne b={o.b * PX} h={o.h * PX} takt={ablauf.takt} zeichne={zeichne} data-bsp />
        <Notiz ablauf={ablauf} />
        <Steuerung ablauf={ablauf} seed={seed} setSeed={setSeed} />
      </>}
      erklaerung={<>
        <h3 className="font-black text-lg">BSP: teilen, füllen, verbinden</h3>
        <ol className="list-decimal pl-5 flex flex-col gap-1">
          <li><b>Teilen:</b> Die Fläche wird mit einem Schnitt in zwei Stücke geteilt, jedes Stück wieder, und so weiter. Lange Stücke werden quer geschnitten. Es hört auf, wenn ein Stück zu klein ist oder die Tiefe erreicht ist.</li>
          <li><b>Füllen:</b> In jedes Endstück kommt ein Raum mit etwas Abstand zum Rand. Darum überlappen sich Räume nie.</li>
          <li><b>Verbinden:</b> Von unten nach oben im Baum bekommen zwei Geschwister einen Gang. Am Ende hängt alles zusammen.</li>
        </ol>
        <BspBaum s={s.current} takt={ablauf.takt} />
        <Legende eintraege={[["#f5efe6", "Raum"], ["#d6c7a1", "Gang"], ["#facc15", "gerade bearbeitet"]]} />
        <p>Der Name heißt »binäre Raumteilung«: Jeder Schnitt macht aus einem Stück zwei. So haben schon die Level von <i>Doom</i> (1993) gerechnet, welche Wand man sieht.</p>
        <Frage>Stelle die Tiefe auf 1, 3 und 7. Wie viele Räume entstehen höchstens? (Tipp: Jede Ebene verdoppelt.) Warum wirken BSP-Karten trotzdem oft »wie aus dem Bürokatalog«?</Frage>
      </>}
    />
  );
}

/** Der BSP-Baum als kleines SVG: Wurzel oben, Blätter unten. */
function BspBaum({ s, takt }: { s: Bsp; takt: number }) {
  const pos = new Map<number, [number, number]>();
  let blatt = 0;
  const maxT = Math.max(1, ...s.knoten.map(k => k.tiefe));
  const lege = (i: number): number => {
    const k = s.knoten[i];
    let x: number;
    if (!k.kinder) x = blatt++;
    else x = (lege(k.kinder[0]) + lege(k.kinder[1])) / 2;
    pos.set(i, [x, k.tiefe]);
    return x;
  };
  lege(0);
  const B = 340, H = 110, sx = B / Math.max(1, blatt), sy = (H - 16) / maxT;
  const p = (i: number) => { const [x, y] = pos.get(i)!; return [sx * (x + 0.5), 8 + y * sy] as const; };
  return (
    <svg viewBox={`0 0 ${B} ${H}`} className="w-full" data-takt={takt} aria-label="BSP-Baum">
      {s.knoten.map((k, i) => k.kinder?.map(c => {
        const [x1, y1] = p(i), [x2, y2] = p(c);
        return <line key={`${i}-${c}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeOpacity={0.35} />;
      }))}
      {s.knoten.map((k, i) => {
        const [x, y] = p(i);
        return <circle key={i} cx={x} cy={y} r={i === s.aktiv ? 5 : 3.5} fill={k.raum ? "#f5efe6" : TIEFENFARBE[k.tiefe % TIEFENFARBE.length]}
          stroke={i === s.aktiv ? "#facc15" : "currentColor"} strokeOpacity={i === s.aktiv ? 1 : 0.4} strokeWidth={i === s.aktiv ? 2 : 1} />;
      })}
    </svg>
  );
}
