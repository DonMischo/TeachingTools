"use client";
/**
 * Die Pixi-Bühne der Verkehrs-Simulation. Liest die Tasten, bewegt die Figur,
 * führt die Kamera nach. Wird per React.lazy geladen — Pixi ist groß.
 */
import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Text } from "pixi.js";
import { stadt, startpunkt, type Untergrund } from "@/lib/verkehr/stadt";
import { eingabeAusTasten, schritt, type Figur } from "@/lib/verkehr/bewegung";
import { zeichneFigur, zeichneStadt } from "@/lib/verkehr/zeichnen";
import { gestenDeckkraft, gesteZuTaste, type Geste } from "@/lib/verkehr/gesten";

/** Pixel je Meter: etwa 80 m Stadt über die Breite eines Laptops. */
const ZOOM = 14;
/** Figuren zeichnen wir 1,8-mal so groß wie echt; gerechnet wird mit echter Größe. */
const FIGUR_GROESSER = 1.8;

export type SpielfeldProps = {
  farbe?: number;
  onUntergrund?: (u: Untergrund["art"]) => void;
  onGeste?: (g: Geste) => void;
};

export default function Spielfeld({ farbe = 0x2f6fd6, onUntergrund, onGeste }: SpielfeldProps) {
  const huelle = useRef<HTMLDivElement>(null);
  const rueckruf = useRef({ onUntergrund, onGeste });
  useEffect(() => { rueckruf.current = { onUntergrund, onGeste }; });

  useEffect(() => {
    const el = huelle.current!;
    const app = new Application();
    let aus = false;
    let bereit = false;
    const gedrueckt = new Set<string>();

    const unten = (e: KeyboardEvent) => {
      // Nur wenn die Bühne den Fokus hat — sonst tippt niemand mehr in ein Textfeld.
      if (!el.contains(document.activeElement)) return;
      const geste = gesteZuTaste(e.code);
      if (geste && !e.repeat) { zeigeGeste?.(geste); rueckruf.current.onGeste?.(geste); }
      gedrueckt.add(e.code);
      if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
    };
    const oben = (e: KeyboardEvent) => gedrueckt.delete(e.code);
    const weg = () => gedrueckt.clear();
    window.addEventListener("keydown", unten);
    window.addEventListener("keyup", oben);
    window.addEventListener("blur", weg);

    let zeigeGeste: ((g: Geste) => void) | null = null;

    (async () => {
      await app.init({ resizeTo: el, background: 0x3c4a2c, antialias: true, autoDensity: true, resolution: window.devicePixelRatio || 1 });
      if (aus) { app.destroy(true); return; }
      bereit = true;
      el.appendChild(app.canvas);

      const s = stadt();
      const welt = new Container();
      welt.scale.set(ZOOM);
      const { boden, oben: kronen } = zeichneStadt(s);
      const figuren = new Container();
      welt.addChild(boden, figuren, kronen);
      app.stage.addChild(welt);

      const [sx, sy] = startpunkt(s);
      let ich: Figur = { x: sx, y: sy, winkel: 0, tempo: 0 };
      const figur = zeichneFigur(farbe);
      // Wie im ersten GTA größer als maßstäblich — sonst ist das Kind ein Punkt.
      figur.scale.set(FIGUR_GROESSER);
      figuren.addChild(figur);

      // Gestenblase: weißer Kreis mit Emoji, hängt über der Figur (dreht nicht mit).
      const blase = new Container();
      const kreis = new Graphics().circle(0, 0, 1.1).fill(0xffffff).stroke({ width: 0.08, color: 0x333333 });
      const emoji = new Text({ text: "", style: { fontSize: 64 } });
      emoji.anchor.set(0.5);
      emoji.scale.set(1.3 / 64);
      blase.addChild(kreis, emoji);
      blase.visible = false;
      figuren.addChild(blase);
      let gesteSeit = -Infinity;
      zeigeGeste = (g) => { emoji.text = g.emoji; gesteSeit = performance.now() / 1000; };

      let letzterUntergrund = "";
      app.ticker.add((t) => {
        const dt = Math.min(t.deltaMS / 1000, 0.1);
        ich = schritt(ich, eingabeAusTasten(gedrueckt), dt, s);
        figur.position.set(ich.x, ich.y);
        if (ich.tempo) figur.rotation = ich.winkel;

        const alter = performance.now() / 1000 - gesteSeit;
        blase.alpha = gestenDeckkraft(alter);
        blase.visible = blase.alpha > 0;
        blase.position.set(ich.x, ich.y - 2);

        welt.position.set(app.screen.width / 2 - ich.x * ZOOM, app.screen.height / 2 - ich.y * ZOOM);

        const u = s.untergrund(ich.x, ich.y).art;
        if (u !== letzterUntergrund) { letzterUntergrund = u; rueckruf.current.onUntergrund?.(u); }
      });
    })();

    return () => {
      aus = true;
      window.removeEventListener("keydown", unten);
      window.removeEventListener("keyup", oben);
      window.removeEventListener("blur", weg);
      if (bereit) app.destroy(true, { children: true });
    };
  }, [farbe]);

  return (
    <div
      ref={huelle}
      tabIndex={0}
      aria-label="Spielfeld — mit Pfeiltasten oder WASD laufen"
      className="absolute inset-0 outline-none"
      onPointerDown={() => huelle.current?.focus()}
    />
  );
}
