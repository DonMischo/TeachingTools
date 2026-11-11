"use client";
/**
 * Litfaßsäule (Berlin 1855): Plakat aussuchen, Kleister auftragen, ankleben.
 * Jede Schicht macht die Säule ein wenig dicker. Ohne WebGL: flache SVG-Säule.
 */
import { useEffect, useRef, useState } from "react";
import { rauschen, ton } from "./ton";
import { useErprobt } from "@/lib/medien/erprobt";

type Design = { titel: string; kurz: string; bg: string; fg: string; zeilen: string[]; deko: string };
const PLAKATE: Design[] = [
  { titel: "Zirkus Renz", kurz: "🎪 Zirkus", bg: "#f3d9a4", fg: "#7a1d1d", zeilen: ["ZIRKUS", "RENZ", "heute Abend!", "Pferde · Clowns", "Elefant Berta"], deko: "🎪" },
  { titel: "Bekanntmachung", kurz: "📜 Amtlich", bg: "#e9e2cf", fg: "#1f2937", zeilen: ["BEKANNTMACHUNG", "der Stadt Berlin", "Das Betreten des", "Rasens ist", "verboten!"], deko: "§" },
  { titel: "Theater: Faust", kurz: "🎭 Theater", bg: "#d8c9e6", fg: "#3b1d5e", zeilen: ["THEATER", "FAUST", "Tragödie in", "fünf Akten", "Karten ab 1 Mark"], deko: "🎭" },
  { titel: "Konzert im Tiergarten", kurz: "🎺 Konzert", bg: "#cfe3c4", fg: "#1f4d2b", zeilen: ["KONZERT", "im Tiergarten", "Sonntag 15 Uhr", "Blaskapelle", "Eintritt frei"], deko: "🎺" },
];

function zeichnePlakat(d: Design): HTMLCanvasElement | null {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 384;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = d.bg;
  g.fillRect(0, 0, 256, 384);
  g.strokeStyle = d.fg;
  g.lineWidth = 6;
  g.strokeRect(10, 10, 236, 364);
  g.lineWidth = 2;
  g.strokeRect(18, 18, 220, 348);
  g.fillStyle = d.fg;
  g.textAlign = "center";
  g.font = "bold 34px Georgia, serif";
  g.fillText(d.zeilen[0], 128, 80, 210);
  g.font = "bold 44px Georgia, serif";
  g.fillText(d.zeilen[1], 128, 134, 210);
  g.font = "64px serif";
  g.fillText(d.deko, 128, 230);
  g.font = "italic 22px Georgia, serif";
  d.zeilen.slice(2).forEach((z, i) => g.fillText(z, 128, 290 + i * 28, 210));
  return c;
}

type Api = { kleistern: () => void; ankleben: (i: number) => void; drehen: (d: number) => void };
const DICKE = 0.012;

export function LitfassDemo() {
  const erprobt = useErprobt();
  const wrap = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const [fallback, setFallback] = useState(false);
  const [bereit, setBereit] = useState(false);
  const [wahl, setWahl] = useState<number | null>(null);
  const [kleister, setKleister] = useState(false);
  const [stapel, setStapel] = useState<number[]>([]);
  const schichten = stapel.length;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let stopped = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      if (stopped) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true });
      } catch {
        setFallback(true);
        return;
      }
      if (!renderer.getContext()) {
        setFallback(true);
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0xcfd8e3, 1);
      el.appendChild(renderer.domElement);
      renderer.domElement.style.cssText = "display:block;width:100%;height:100%;touch-action:none;cursor:grab";

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 4 / 3, 0.1, 100);
      camera.position.set(0, 2.6, 7);
      camera.lookAt(0, 1.5, 0);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7f6a, 1.1));
      const sonne = new THREE.DirectionalLight(0xfff1d6, 1.6);
      sonne.position.set(3, 6, 5);
      scene.add(sonne);

      // Pflaster
      const pf = document.createElement("canvas");
      pf.width = pf.height = 256;
      const pg = pf.getContext("2d");
      if (pg) {
        pg.fillStyle = "#6b655b";
        pg.fillRect(0, 0, 256, 256);
        for (let y = 0; y < 8; y++)
          for (let x = 0; x < 8; x++) {
            const l = 90 + Math.floor(Math.random() * 40);
            pg.fillStyle = `rgb(${l},${l - 6},${l - 14})`;
            pg.beginPath();
            pg.ellipse(x * 32 + 16 + (y % 2) * 8, y * 32 + 16, 13, 12, 0, 0, Math.PI * 2);
            pg.fill();
          }
      }
      const pfTex = new THREE.CanvasTexture(pf);
      pfTex.wrapS = pfTex.wrapT = THREE.RepeatWrapping;
      pfTex.repeat.set(5, 5);
      pfTex.colorSpace = THREE.SRGBColorSpace;
      const boden = new THREE.Mesh(new THREE.CircleGeometry(7, 48), new THREE.MeshStandardMaterial({ map: pfTex, roughness: 1 }));
      boden.rotation.x = -Math.PI / 2;
      scene.add(boden);

      // Säule
      const saeule = new THREE.Group();
      scene.add(saeule);
      const gruen = new THREE.MeshStandardMaterial({ color: 0x2f5d3a, roughness: 0.6 });
      const koerper = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 3, 48), gruen);
      koerper.position.y = 1.5;
      saeule.add(koerper);
      const sockel = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.3, 48), gruen);
      sockel.position.y = 0.15;
      scene.add(sockel);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.14, 48), gruen);
      ring.position.y = 3.05;
      scene.add(ring);
      const kuppel = new THREE.Mesh(new THREE.SphereGeometry(1.15, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), gruen);
      kuppel.scale.y = 0.6;
      kuppel.position.y = 3.12;
      scene.add(kuppel);
      const spitze = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.7, roughness: 0.3 }));
      spitze.position.y = 3.86;
      scene.add(spitze);

      const PH = 1.65;
      const LEN = 1.1;
      const OBEN = 2.45;
      const texturen = PLAKATE.map(d => {
        const c = zeichnePlakat(d);
        if (!c) return null;
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
      });

      let ry = 0;
      let ziel = 0;
      let n = 0;
      let flecken: { mesh: InstanceType<typeof THREE.Mesh>; c: number; y: number } | null = null;
      const anim: { m: InstanceType<typeof THREE.Mesh>; t: number; dauer: number }[] = [];
      const schnipsel: { dispose: () => void }[] = [];

      const stueck = (radius: number, c: number) => {
        const g = new THREE.CylinderGeometry(radius, radius, PH, 24, 1, true, c - LEN / 2, LEN);
        g.translate(0, -PH / 2, 0);
        schnipsel.push(g);
        return g;
      };

      api.current = {
        drehen: d => {
          ziel += d;
        },
        kleistern: () => {
          if (flecken) {
            saeule.remove(flecken.mesh);
            flecken.mesh.geometry.dispose();
            (flecken.mesh.material as { dispose: () => void }).dispose();
          }
          const c = -ry;
          const m = new THREE.Mesh(
            stueck(1 + DICKE * n + 0.003, c),
            new THREE.MeshStandardMaterial({ color: 0xe8d9a0, transparent: true, opacity: 0.6, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide }),
          );
          m.position.y = OBEN;
          m.scale.y = 0.001;
          saeule.add(m);
          flecken = { mesh: m, c, y: OBEN };
          anim.push({ m, t: 0, dauer: 0.5 });
        },
        ankleben: i => {
          const tex = texturen[i];
          const fl = flecken;
          const c = fl ? fl.c : -ry;
          n += 1;
          koerper.scale.set(1 + DICKE * n, 1, 1 + DICKE * n);
          if (fl) {
            saeule.remove(fl.mesh);
            fl.mesh.geometry.dispose();
            (fl.mesh.material as { dispose: () => void }).dispose();
            flecken = null;
          }
          const mat = new THREE.MeshStandardMaterial({
            map: tex ?? undefined,
            color: tex ? 0xffffff : parseInt(PLAKATE[i].bg.slice(1), 16),
            roughness: 0.85,
            side: THREE.DoubleSide,
          });
          schnipsel.push(mat);
          const m = new THREE.Mesh(stueck(1 + DICKE * n + 0.004, c), mat);
          m.position.y = OBEN;
          m.scale.y = 0.001;
          saeule.add(m);
          anim.push({ m, t: 0, dauer: 0.8 });
        },
      };

      // Ziehen mit Zeiger
      let zieht = false;
      let lastX = 0;
      const dom = renderer.domElement;
      const down = (e: PointerEvent) => {
        zieht = true;
        lastX = e.clientX;
        dom.style.cursor = "grabbing";
        dom.setPointerCapture?.(e.pointerId);
      };
      const move = (e: PointerEvent) => {
        if (!zieht) return;
        ziel += (e.clientX - lastX) * 0.012;
        lastX = e.clientX;
      };
      const up = () => {
        zieht = false;
        dom.style.cursor = "grab";
      };
      dom.addEventListener("pointerdown", down);
      dom.addEventListener("pointermove", move);
      dom.addEventListener("pointerup", up);
      dom.addEventListener("pointercancel", up);

      const resize = () => {
        const w = el.clientWidth || 480, h = el.clientHeight || 360;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(el);

      let raf = 0;
      let letzt = performance.now();
      const schritt = (jetzt: number) => {
        raf = requestAnimationFrame(schritt);
        const dt = Math.min(0.1, (jetzt - letzt) / 1000);
        letzt = jetzt;
        ry += (ziel - ry) * Math.min(1, dt * 8);
        saeule.rotation.y = ry;
        for (let i = anim.length - 1; i >= 0; i--) {
          const a = anim[i];
          a.t += dt;
          const p = Math.min(1, a.t / a.dauer);
          a.m.scale.y = Math.max(0.001, 1 - Math.pow(1 - p, 3));
          if (p >= 1) anim.splice(i, 1);
        }
        renderer.render(scene, camera);
      };
      raf = requestAnimationFrame(schritt);
      setBereit(true);

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        dom.removeEventListener("pointerdown", down);
        dom.removeEventListener("pointermove", move);
        dom.removeEventListener("pointerup", up);
        dom.removeEventListener("pointercancel", up);
        api.current = null;
        scene.traverse(o => {
          const m = o as unknown as { geometry?: { dispose: () => void }; material?: unknown };
          m.geometry?.dispose();
          const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
          for (const mt of mats as { map?: { dispose: () => void } | null; dispose: () => void }[]) {
            mt.map?.dispose();
            mt.dispose();
          }
        });
        for (const x of [...schnipsel, ...texturen.filter(t => t !== null), pfTex]) x!.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
      if (stopped) cleanup();
    })().catch(() => setFallback(true));

    return () => {
      stopped = true;
      cleanup();
    };
  }, []);

  const kannBedienen = bereit || fallback;
  const kleistern = () => {
    if (wahl === null || !kannBedienen) return;
    rauschen(0.5, 0, 0.05, { freq: 500, q: 0.6 });
    api.current?.kleistern();
    setKleister(true);
  };
  const ankleben = () => {
    if (wahl === null || !kleister) return;
    ton(160, 0.12, 0, "triangle", 0.12);
    api.current?.ankleben(wahl);
    setKleister(false);
    const neu = [...stapel, wahl];
    setStapel(neu);
    if (neu.length >= 3) erprobt("litfass");
  };

  const dick = 1 + DICKE * schichten;
  return (
    <div className="card space-y-3 p-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Plakat wählen">
        {PLAKATE.map((p, i) => (
          <button key={p.titel} type="button" className={wahl === i ? "chip chip-on" : "chip"} aria-pressed={wahl === i} onClick={() => { setWahl(i); setKleister(false); }}>
            {p.kurz}
          </button>
        ))}
      </div>
      {wahl !== null && <p className="text-sm text-muted">Gewählt: {PLAKATE[wahl].titel}</p>}

      {fallback ? (
        <svg viewBox="0 0 300 260" className="w-full rounded bg-surface-hover" role="img" aria-label="Flache Litfaßsäule mit Plakatstapel">
          <rect x="0" y="230" width="300" height="30" fill="#8a7f6a" />
          <path d="M 70 56 Q 150 18 230 56 Z" fill="#2f5d3a" />
          <rect x={150 - 60 * dick} y="56" width={120 * dick} height="174" fill="#2f5d3a" />
          {stapel.map((p, i) => {
            const w = 80 * (1 + DICKE * (i + 1));
            return (
              <g key={i} transform={`translate(${150 - w / 2 + (i % 2 ? 8 : -8)} ${68 + i * 4})`}>
                <rect width={w} height={110} fill={PLAKATE[p].bg} stroke={PLAKATE[p].fg} strokeWidth="2" />
                <text x={w / 2} y="34" textAnchor="middle" fontSize="12" fontWeight="bold" fill={PLAKATE[p].fg}>{PLAKATE[p].zeilen[0]}</text>
                <text x={w / 2} y="54" textAnchor="middle" fontSize="12" fontWeight="bold" fill={PLAKATE[p].fg}>{PLAKATE[p].zeilen[1]}</text>
              </g>
            );
          })}
          {kleister && <rect x="110" y="68" width="80" height="110" fill="#e8d9a0" opacity="0.5" />}
        </svg>
      ) : (
        <div ref={wrap} className="h-[320px] w-full overflow-hidden rounded bg-surface-hover sm:h-[380px]" aria-label="3D-Litfaßsäule, mit der Maus drehbar" />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-secondary" aria-label="Säule nach links drehen" disabled={!bereit} onClick={() => api.current?.drehen(-0.6)}>⟲</button>
        <button type="button" className="btn-secondary" aria-label="Säule nach rechts drehen" disabled={!bereit} onClick={() => api.current?.drehen(0.6)}>⟳</button>
        <button type="button" className="btn-secondary" disabled={wahl === null || !kannBedienen || kleister} onClick={kleistern}>🪣 Kleister</button>
        <button type="button" className="btn-primary" disabled={wahl === null || !kleister} onClick={ankleben}>Ankleben</button>
        <span className="chip chip-on">Schichten: {schichten}</span>
      </div>

      <p className="text-xs text-muted" aria-live="polite">
        {schichten === 0
          ? "Plakat wählen, Kleister auftragen, ankleben — und die Säule dabei drehen."
          : schichten < 3
            ? `Weiter so! Noch ${3 - schichten} Plakat${3 - schichten === 1 ? "" : "e"} bis zum Plakatkleber-Diplom.`
            : "Plakatkleber-Diplom! Die Säule ist schon dicker als am Morgen."}{" "}
        Die ersten Litfaßsäulen standen 1855 in Berlin — bis heute wurden die Säulen mit jeder Plakatschicht ein paar Zentimeter dicker.
      </p>
    </div>
  );
}
