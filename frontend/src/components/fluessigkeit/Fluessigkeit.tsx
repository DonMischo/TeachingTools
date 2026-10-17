"use client";
/**
 * Wirbelnde Flüssigkeit per WebGL (Shader aus dem Häuserpokal). Ohne WebGL: statischer CSS-Verlauf.
 * Bei reduzierter Bewegung läuft die Animation nur kurz nach Änderungen; im versteckten Tab steht sie still.
 */
import { useEffect, useRef, useState } from "react";
import { wenigerBewegung } from "@/lib/challenge/bewegung";
import { FRAG, VERT } from "./shader";

type Rgb = [number, number, number];
export type Zufluss = { id: number; groesse: number; teilchen: number };
type Fall = { startTime: number; edgeStart: number; blobSize: number; particleCount: number };
const MAX_FALLS = 4;
const FORMEN = { roehre: 0, kessel: 1, flasche: 2 } as const;

function hslZuRgb(h: number, s: number, l: number): Rgb {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)];
}

/** Hex (#rgb, #rrggbb), hsl(h s% l%) und rgb(r g b) → [0..1]³; sonst Grau. */
export function zuRgb(farbe: string): Rgb {
  const c = farbe.trim();
  if (c.startsWith("#")) {
    const h = c.length === 4 ? [...c.slice(1)].map((x) => x + x).join("") : c.slice(1);
    const n = parseInt(h, 16);
    return Number.isNaN(n) ? [0.5, 0.5, 0.5] : [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }
  const z = c.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  if (c.startsWith("hsl") && z.length >= 3) return hslZuRgb(((z[0] % 360) + 360) % 360, z[1] / 100, z[2] / 100);
  if (c.startsWith("rgb") && z.length >= 3) return [z[0] / 255, z[1] / 255, z[2] / 255];
  return [0.5, 0.5, 0.5];
}

const cssRgb = (c: Rgb) => `rgb(${c.map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255)).join(",")})`;

export default function Fluessigkeit({ farbe, fuellstand, breite, hoehe, form = "roehre", wirbel = 0, blasen = false, regenbogen = false, stufe = 0, zufluss = null, tempo = 1.2, className }: {
  farbe: string | Rgb; fuellstand: number; breite: number; hoehe: number;
  form?: keyof typeof FORMEN; wirbel?: number; blasen?: boolean; regenbogen?: boolean;
  /** Helligkeitsstufe des Shaders (u_level), im Häuserpokal das Level. */
  stufe?: number;
  /** Neuer Zufluss (id ändert sich): Teilchen fallen auf die Oberfläche. */
  zufluss?: Zufluss | null;
  /** Wie schnell der Füllstand dem Ziel folgt (je Sekunde); der Häuserpokal steigt gemächlich, der Kessel reagiert sofort. */
  tempo?: number; className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ohneGl, setOhneGl] = useState(false);
  const rgb = typeof farbe === "string" ? zuRgb(farbe) : farbe;
  const zustand = useRef({ farbe: rgb, regenbogen, fuell: fuellstand, anzeige: fuellstand, wirbel, wirbelAnzeige: wirbel, blasen, stufe, falls: [] as Fall[], form, tempo, kick: () => {} });
  zustand.current.farbe = rgb; zustand.current.regenbogen = regenbogen; zustand.current.fuell = Math.max(0, Math.min(1, fuellstand));
  zustand.current.wirbel = wirbel; zustand.current.blasen = blasen; zustand.current.stufe = stufe; zustand.current.form = form; zustand.current.tempo = tempo;
  const letzterZufluss = useRef<number | null>(zufluss?.id ?? null);

  useEffect(() => {
    const z = zustand.current;
    if (!zufluss || zufluss.id === letzterZufluss.current) return;
    letzterZufluss.current = zufluss.id;
    z.falls.push({ startTime: performance.now(), edgeStart: z.anzeige, blobSize: zufluss.groesse, particleCount: zufluss.teilchen });
    if (z.falls.length > MAX_FALLS) z.falls.shift();
    z.kick();
  }, [zufluss]);
  useEffect(() => { zustand.current.kick(); }, [fuellstand, wirbel, blasen, regenbogen, rgb[0], rgb[1], rgb[2]]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false });
    if (!gl) { setOhneGl(true); return; }
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(sh)); return null; }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { setOhneGl(true); return; }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); setOhneGl(true); return; }

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.useProgram(prog);
    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uTime = u("u_time"), uRes = u("u_resolution"), uProg = u("u_progress"), uColor = u("u_color"), uLevel = u("u_level");
    const uFallCount = u("u_fallCount"), uForm = u("u_form"), uWirbel = u("u_wirbel"), uBlasen = u("u_blasen");
    const feld = (n: string) => [0, 1, 2, 3].map((i) => u(`${n}[${i}]`));
    const uElapsed = feld("u_elapsed"), uEdgeStart = feld("u_edgeStart"), uBlobSize = feld("u_blobSize"), uParticleCount = feld("u_particleCount");

    const dpr = window.devicePixelRatio || 1;
    canvas.width = breite * dpr;
    canvas.height = hoehe * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);

    const z = zustand.current;
    let rafId = 0, letzte = 0, phase = 0, ruhe = 0;
    const reduziert = wenigerBewegung();

    function frame(now: number) {
      rafId = 0;
      if (document.hidden) return; // visibilitychange startet neu
      const dt = letzte > 0 ? Math.min((now - letzte) / 1000, 0.1) : 0;
      letzte = now;
      const diff = z.fuell - z.anzeige;
      z.anzeige = Math.abs(diff) > 0.002 ? z.anzeige + diff * Math.min(1, dt * z.tempo) : z.fuell;
      z.wirbelAnzeige += (z.wirbel - z.wirbelAnzeige) * Math.min(1, dt * 4);
      phase += dt * (1 + z.wirbelAnzeige * 3);
      z.falls = z.falls.filter((f) => (now - f.startTime) / 1000 < 6.0);

      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.uniform1f(uTime, phase);
      gl!.uniform1f(uProg, z.anzeige);
      gl!.uniform1f(uLevel, z.stufe);
      const [r, g, b] = z.regenbogen ? hslZuRgb((phase * 70) % 360, 0.8, 0.6) : z.farbe;
      gl!.uniform3f(uColor, r, g, b);
      gl!.uniform1i(uForm, FORMEN[z.form]);
      gl!.uniform1f(uWirbel, z.wirbelAnzeige);
      gl!.uniform1f(uBlasen, z.blasen ? 1 : 0);
      gl!.uniform1i(uFallCount, z.falls.length);
      for (let i = 0; i < MAX_FALLS; i++) {
        const f = i < z.falls.length ? z.falls[i] : null;
        gl!.uniform1f(uElapsed[i], f ? (now - f.startTime) / 1000 : -1);
        gl!.uniform1f(uEdgeStart[i], f ? f.edgeStart : 0);
        gl!.uniform1f(uBlobSize[i], f ? f.blobSize : 0);
        gl!.uniform1f(uParticleCount[i], f ? f.particleCount : 0);
      }
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);

      if (reduziert) { // nur kurz weiterlaufen, bis alles eingeschwungen ist
        ruhe = z.anzeige === z.fuell && Math.abs(z.wirbel - z.wirbelAnzeige) < 0.01 && !z.falls.length && !z.regenbogen && !z.blasen ? ruhe + dt : 0;
        if (ruhe > 0.3) return;
      }
      rafId = requestAnimationFrame(frame);
    }
    const start = () => { ruhe = 0; letzte = 0; if (!rafId && !document.hidden) rafId = requestAnimationFrame(frame); };
    z.kick = start;
    const sichtbar = () => start();
    document.addEventListener("visibilitychange", sichtbar);
    start();
    return () => {
      z.kick = () => {};
      document.removeEventListener("visibilitychange", sichtbar);
      cancelAnimationFrame(rafId);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [breite, hoehe]);

  const c = cssRgb(rgb);
  const hoch = `${Math.round(Math.max(0, Math.min(1, fuellstand)) * 100)}%`;
  const radius = form === "kessel" ? "10% 10% 50% 50% / 5% 5% 40% 40%" : form === "flasche" ? "30% 30% 25% 25%" : "8px";
  return (
    <div className={`relative ${className ?? ""}`} style={{ width: breite, height: hoehe }}>
      {ohneGl && (
        <div data-testid="fluessigkeit-fallback" className="absolute inset-x-0 bottom-0"
          style={{ height: hoch, background: `linear-gradient(to top, ${c}, ${c}aa)`, borderRadius: radius, opacity: 0.9 }} />
      )}
      <canvas ref={canvasRef} style={{ width: breite, height: hoehe, display: "block", visibility: ohneGl ? "hidden" : "visible" }} />
    </div>
  );
}
