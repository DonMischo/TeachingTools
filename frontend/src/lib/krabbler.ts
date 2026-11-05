/* Krabbler: Bei einer falschen Antwort krabbeln kurz Drahtgitter-Käfer über
   den Bildschirm, sperren Maus und Tastatur und spucken Wörter von der Seite
   aus (Vorbild: »Crawlers« von rybinfx). Gegen blindes Durchklicken: jede
   weitere falsche Antwort kurz danach verlängert die Sperre und bringt einen
   Käfer mehr. Ab dem dritten Fehler binnen einer Minute steht in der Mitte
   ein Mutmacher mit der Fehlerzahl, und die Käfer kreisen um ihn.

   Aufruf ohne React-Gerüst, damit es überall geht:  krabbeln()  */

const SERIE_FENSTER_MS = 60_000;
const MUTMACHER_AB = 3;
const NEON = '#e040fb';
const GLUT = '#ff1744';
const MUTMACHER = [
  'Langsam ist das neue Schnell.',
  'Lies die Aufgabe noch einmal in Ruhe.',
  'Raten kostet Zeit – Nachdenken spart sie.',
  'Fehler sind Hinweise, keine Niederlagen.',
  'Tief durchatmen. Du kannst das.',
  'Erst verstehen, dann klicken.',
  'Wer genau liest, muss nicht raten.',
];

type Punkt = { x: number; y: number };
type Art = 'spinne' | 'kaefer' | 'tausendfuss' | 'skolopender';
/** Ein Bein: Hüfte am Glied `glied`, Fuß steht auf dem Boden, bis er zu weit
    hinter seiner Ruhelage zurückbleibt; dann tritt er nach vorn. */
type Bein = { glied: number; seite: 1 | -1; winkel: number; weite: number; oben: number; unten: number; fuss: Punkt; von: Punkt; nach: Punkt; tritt: number };
type Kaefer = { x: number; y: number; winkel: number; drehung: number; tempo: number; phase: number; spuckZeit: number; umlauf: number;
  art: Art; farbe: string; glut: string; beinFarbe: string; groesse: number; glieder: Punkt[]; beine: Bein[] };
type Wort = { text: string; x: number; y: number; vx: number; vy: number; dreh: number; geboren: number; vonX: number; vonY: number; farbe: string };

let serie = 0;
let letzterFehler = 0;
let laufend: { ende: number; dazu: (n: number) => void; zeigeSerie: () => void } | null = null;

/** Sperrdauer für die n-te falsche Antwort in Folge (1, 2, 3 …): 10 s bis 20 s. */
export function sperrDauer(n: number): number {
  return Math.min(10_000 + (n - 1) * 2500, 20_000);
}

function woerterSammeln(quelle?: Element | null): string[] {
  // innerText statt textContent: sonst spucken die Käfer CSS aus <style> aus
  const aus = (el: Element | null | undefined) =>
    [...new Set(((el as HTMLElement | null | undefined)?.innerText ?? '').split(/[^\p{L}\p{N}-]+/u).filter((w) => w.length >= 4 && w.length <= 18))];
  let alle = aus(quelle ?? document.querySelector('main'));
  if (alle.length < 10) alle = aus(document.body);
  return alle.length ? alle : ['falsch', 'nachdenken', 'lesen', 'raten', 'krabbel'];
}

// Strich- und Glutfarbe je Käfer
const FARBEN: [string, string][] = [
  [NEON, GLUT],
  ['#18ffff', '#2979ff'],
  ['#b2ff59', '#00c853'],
  ['#ffd740', '#ff6d00'],
  ['#ff80ab', '#d500f9'],
];

/** Bauplan je Art (Längen in px bei Größe 1): Glieder hintereinander, an
    welchen Gliedern Beine sitzen, Ruhewinkel der Füße gegen die Laufrichtung. */
const BAU: Record<Art, { glieder: number; abstand: number; beine: { glied: number; winkel: number; lang?: number }[]; weite: number; oben: number; unten: number; schritt: number }> = {
  spinne: {
    glieder: 2, abstand: 26, weite: 72, oben: 50, unten: 52, schritt: 0.12,
    beine: [40, 75, 110, 145].map((w) => ({ glied: 0, winkel: w })),
  },
  kaefer: {
    glieder: 3, abstand: 16, weite: 42, oben: 26, unten: 28, schritt: 0.1,
    beine: [{ glied: 1, winkel: 50 }, { glied: 1, winkel: 95 }, { glied: 2, winkel: 125 }],
  },
  tausendfuss: {
    glieder: 12, abstand: 12, weite: 28, oben: 16, unten: 17, schritt: 0.08,
    beine: Array.from({ length: 11 }, (_, i) => ({ glied: i + 1, winkel: 95 })),
  },
  // Spinnenläufer-artig: lange Beine mit drei Gelenken, nach hinten
  // gespreizt, das letzte Paar als lange Schleppbeine
  skolopender: {
    glieder: 14, abstand: 16, weite: 70, oben: 38, unten: 46, schritt: 0.1,
    beine: Array.from({ length: 13 }, (_, i) =>
      i === 12 ? { glied: 13, winkel: 160, lang: 1.6 } : { glied: i + 1, winkel: 70 + i * 4 }),
  },
};
const ARTEN = Object.keys(BAU) as Art[];

const richtung = (k: Kaefer, i: number) =>
  i === 0 ? k.winkel : Math.atan2(k.glieder[i - 1].y - k.glieder[i].y, k.glieder[i - 1].x - k.glieder[i].x);

function ruheLage(k: Kaefer, bein: Bein): Punkt {
  const g = k.glieder[bein.glied];
  const a = richtung(k, bein.glied) + bein.seite * bein.winkel;
  return { x: g.x + Math.cos(a) * bein.weite, y: g.y + Math.sin(a) * bein.weite };
}

function neuerKaefer(b: number, h: number): Kaefer {
  const art = ARTEN[Math.floor(Math.random() * ARTEN.length)];
  // der Skolopender trägt immer Gelb mit grünen Beinen wie sein Vorbild
  const [farbe, glut] = art === 'skolopender' ? ['#ffee58', '#76ff03'] : FARBEN[Math.floor(Math.random() * FARBEN.length)];
  const beinFarbe = art === 'skolopender' ? '#76ff03' : farbe;
  const bau = BAU[art];
  const groesse = 1 + Math.random() * 0.4;
  const winkel = Math.random() * Math.PI * 2;
  const glieder = Array.from({ length: bau.glieder }, (_, i) => ({
    x: b / 2 - Math.cos(winkel) * i * bau.abstand * groesse,
    y: h / 2 - Math.sin(winkel) * i * bau.abstand * groesse,
  }));
  const k: Kaefer = {
    x: b / 2, y: h / 2, winkel, drehung: 0, tempo: 110 + Math.random() * 70,
    phase: Math.random() * 6, spuckZeit: 0, umlauf: Math.random() * Math.PI * 2,
    art, farbe, glut, beinFarbe, groesse, glieder, beine: [],
  };
  for (const seite of [1, -1] as const) {
    for (const bb of bau.beine) {
      const bein: Bein = {
        glied: bb.glied, seite, winkel: (bb.winkel * Math.PI) / 180,
        weite: bau.weite * groesse * (bb.lang ?? 1), oben: bau.oben * groesse * (bb.lang ?? 1), unten: bau.unten * groesse * (bb.lang ?? 1),
        fuss: { x: 0, y: 0 }, von: { x: 0, y: 0 }, nach: { x: 0, y: 0 }, tritt: 0,
      };
      bein.fuss = ruheLage(k, bein);
      k.beine.push(bein);
    }
  }
  return k;
}

/** Glieder ziehen dem Kopf nach, Füße treten, wenn sie zu weit zurückliegen. */
function bewege(k: Kaefer, dt: number) {
  const bau = BAU[k.art];
  const abstand = bau.abstand * k.groesse;
  k.glieder[0] = { x: k.x, y: k.y };
  for (let i = 1; i < k.glieder.length; i++) {
    const vor = k.glieder[i - 1], g = k.glieder[i];
    const d = Math.hypot(g.x - vor.x, g.y - vor.y) || 1;
    g.x = vor.x + ((g.x - vor.x) / d) * abstand;
    g.y = vor.y + ((g.y - vor.y) / d) * abstand;
  }
  const proSeite = bau.beine.length;
  k.beine.forEach((bein, i) => {
    if (bein.tritt > 0) {
      bein.tritt = Math.min(1, bein.tritt + dt / bau.schritt);
      const f = bein.tritt;
      bein.fuss = { x: bein.von.x + (bein.nach.x - bein.von.x) * f, y: bein.von.y + (bein.nach.y - bein.von.y) * f };
      if (f >= 1) bein.tritt = 0;
      return;
    }
    const ruhe = ruheLage(k, bein);
    if (Math.hypot(bein.fuss.x - ruhe.x, bein.fuss.y - ruhe.y) < bein.weite * 0.4) return;
    // Nachbarn auf derselben Seite und das Gegenbein bleiben stehen, solange dieses tritt
    const seite = Math.floor(i / proSeite);
    const gegen = (1 - seite) * proSeite + (i % proSeite);
    const nachbarn = [i - 1, i + 1].filter((n) => n >= 0 && Math.floor(n / proSeite) === seite).concat(gegen);
    if (nachbarn.some((n) => k.beine[n].tritt > 0)) return;
    bein.von = { ...bein.fuss };
    bein.nach = { x: ruhe.x + Math.cos(k.winkel) * bein.weite * 0.3, y: ruhe.y + Math.sin(k.winkel) * bein.weite * 0.3 };
    bein.tritt = 0.001;
  });
}

/** Knie per Zwei-Gelenk-IK; von beiden Lösungen die, die vom Körper wegzeigt. */
function knie(huefte: Punkt, fuss: Punkt, oben: number, unten: number, mitte: Punkt): Punkt {
  const dx = fuss.x - huefte.x, dy = fuss.y - huefte.y;
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(oben - unten) + 0.01), oben + unten - 0.01);
  const a = Math.acos((oben * oben + d * d - unten * unten) / (2 * oben * d));
  const zum = Math.atan2(dy, dx);
  const k1 = { x: huefte.x + Math.cos(zum + a) * oben, y: huefte.y + Math.sin(zum + a) * oben };
  const k2 = { x: huefte.x + Math.cos(zum - a) * oben, y: huefte.y + Math.sin(zum - a) * oben };
  return Math.hypot(k1.x - mitte.x, k1.y - mitte.y) > Math.hypot(k2.x - mitte.x, k2.y - mitte.y) ? k1 : k2;
}

function gelenk(ctx: CanvasRenderingContext2D, p: Punkt, r: number) {
  ctx.strokeRect(p.x - r, p.y - r, r * 2, r * 2);
}

function punkt(ctx: CanvasRenderingContext2D, p: Punkt, r: number) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Glied als gedrehter Gitterkasten. */
function kasten(ctx: CanvasRenderingContext2D, p: Punkt, w: number, breite: number, laenge: number, linien: number) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(w);
  ctx.strokeRect(-laenge / 2, -breite / 2, laenge, breite);
  ctx.beginPath();
  for (let i = 1; i < linien; i++) {
    const x = -laenge / 2 + (laenge * i) / linien;
    ctx.moveTo(x, -breite / 2); ctx.lineTo(x, breite / 2);
  }
  if (linien > 1) { ctx.moveTo(-laenge / 2, 0); ctx.lineTo(laenge / 2, 0); }
  ctx.stroke();
  ctx.restore();
}

function zeichneKaefer(ctx: CanvasRenderingContext2D, k: Kaefer) {
  const g = k.groesse;
  ctx.save();
  ctx.strokeStyle = k.farbe;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = k.glut;
  ctx.shadowBlur = 12;
  const breite = { spinne: 22, kaefer: 26, tausendfuss: 12, skolopender: 16 }[k.art] * g;
  const lang3 = k.art === 'skolopender';
  ctx.strokeStyle = k.beinFarbe;
  ctx.fillStyle = k.farbe;

  // Beine: Hüfte – Knie – Fuß, Gelenke als kleine Quadrate
  for (const bein of k.beine) {
    const gl = k.glieder[bein.glied];
    const w = richtung(k, bein.glied) + bein.seite * Math.PI / 2;
    const huefte = { x: gl.x + Math.cos(w) * breite / 2, y: gl.y + Math.sin(w) * breite / 2 };
    // im Schritt hebt sich der Fuß: Bein zieht sich an, das Knie steigt
    const hub = bein.tritt > 0 ? Math.sin(bein.tritt * Math.PI) * 0.25 : 0;
    const fuss = { x: bein.fuss.x + (huefte.x - bein.fuss.x) * hub, y: bein.fuss.y + (huefte.y - bein.fuss.y) * hub };
    const kn = knie(huefte, fuss, bein.oben, bein.unten, gl);
    const punkte = [huefte, kn];
    if (lang3) {
      // drittes Gelenk: auf dem Unterschenkel, leicht nach außen geknickt
      const dx = fuss.x - kn.x, dy = fuss.y - kn.y;
      const n = Math.hypot(dx, dy) || 1;
      let nx = -dy / n, ny = dx / n;
      const mx = kn.x + dx * 0.55, my = kn.y + dy * 0.55;
      if ((mx + nx - gl.x) ** 2 + (my + ny - gl.y) ** 2 < (mx - gl.x) ** 2 + (my - gl.y) ** 2) { nx = -nx; ny = -ny; }
      punkte.push({ x: mx + nx * n * 0.15, y: my + ny * n * 0.15 });
    }
    punkte.push(fuss);
    ctx.beginPath();
    punkte.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    if (lang3) punkte.slice(1).forEach((p) => punkt(ctx, p, 2.2 * g));
    else {
      gelenk(ctx, kn, 2 * g);
      if (k.art === 'spinne') gelenk(ctx, fuss, 1.2 * g);
    }
  }
  ctx.strokeStyle = k.farbe;

  // Körper
  if (k.art === 'spinne') {
    kasten(ctx, k.glieder[0], richtung(k, 0), breite, 20 * g, 2);
    kasten(ctx, k.glieder[1], richtung(k, 1), breite * 1.3, 34 * g, 4);
  } else if (k.art === 'kaefer') {
    ctx.save();
    ctx.translate((k.glieder[1].x + k.glieder[2].x) / 2, (k.glieder[1].y + k.glieder[2].y) / 2);
    ctx.rotate(richtung(k, 1));
    ctx.beginPath();
    ctx.ellipse(0, 0, 24 * g, breite / 2, 0, 0, Math.PI * 2);
    ctx.moveTo(-24 * g, 0); ctx.lineTo(16 * g, 0);
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(k.glieder[0].x, k.glieder[0].y, 7 * g, 0, Math.PI * 2);
    ctx.stroke();
  } else if (k.art === 'skolopender') {
    // Glieder als Kästen mit gefülltem Kern, Farben im Wechsel
    k.glieder.forEach((p, i) => {
      const w = richtung(k, i);
      kasten(ctx, p, w, breite, 14 * g, 1);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(w);
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = i % 3 === 1 ? k.beinFarbe : k.farbe;
      ctx.fillRect(-4 * g, -5 * g, 8 * g, 10 * g);
      ctx.restore();
    });
  } else {
    k.glieder.forEach((p, i) => kasten(ctx, p, richtung(k, i), breite, 10 * g, 1));
  }

  // Kieferzangen bzw. Fühler am Kopf
  const kopf = k.glieder[0];
  if (lang3) {
    // lange Fühler aus vier Gliedern, die sich wellen
    ctx.strokeStyle = k.beinFarbe;
    for (const s of [-1, 1]) {
      let p = kopf, a = k.winkel + s * 0.4;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      const knoten: Punkt[] = [];
      for (let i = 0; i < 4; i++) {
        a += s * (0.12 + Math.sin(k.phase * 0.8 + i + s) * 0.18);
        p = { x: p.x + Math.cos(a) * 22 * g, y: p.y + Math.sin(a) * 22 * g };
        ctx.lineTo(p.x, p.y);
        knoten.push(p);
      }
      ctx.stroke();
      knoten.forEach((q) => punkt(ctx, q, 2 * g));
    }
    ctx.restore();
    return;
  }
  const lang = (k.art === 'spinne' ? 14 : 26) * g;
  ctx.beginPath();
  for (const s of [-1, 1]) {
    const a = k.winkel + s * (0.35 + Math.sin(k.phase + s) * 0.12);
    ctx.moveTo(kopf.x + Math.cos(k.winkel) * 6 * g, kopf.y + Math.sin(k.winkel) * 6 * g);
    ctx.quadraticCurveTo(
      kopf.x + Math.cos(a) * lang * 0.5, kopf.y + Math.sin(a) * lang * 0.5,
      kopf.x + Math.cos(a - s * 0.2) * lang, kopf.y + Math.sin(a - s * 0.2) * lang,
    );
  }
  ctx.stroke();
  ctx.restore();
}

/** Lässt die Krabbler los. Wörter kommen aus `quelle` (sonst <main>). */
export function krabbeln(opts: { quelle?: Element | null } = {}): void {
  if (typeof document === 'undefined') return;
  const jetzt = performance.now();
  serie = jetzt - letzterFehler < SERIE_FENSTER_MS ? serie + 1 : 1;
  letzterFehler = jetzt;
  const dauer = sperrDauer(serie);

  if (laufend) {
    laufend.ende = Math.max(laufend.ende, jetzt + dauer);
    laufend.dazu(1);
    laufend.zeigeSerie();
    return;
  }

  // ohne Canvas (alte Browser, jsdom) keine Käfer und keine Sperre
  const leinwand = document.createElement('canvas');
  let ctx: CanvasRenderingContext2D | null = null;
  try { ctx = leinwand.getContext('2d'); } catch { /* jsdom: nicht implementiert */ }
  if (!ctx) return;

  const woerter = woerterSammeln(opts.quelle);
  (document.activeElement as HTMLElement | null)?.blur?.();

  const huelle = document.createElement('div');
  huelle.setAttribute('role', 'alert');
  huelle.style.cssText = 'position:fixed;inset:0;z-index:2147483000;cursor:not-allowed;background:rgba(0,0,0,.3);transition:opacity .3s';
  leinwand.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  const hinweis = document.createElement('div');
  hinweis.style.cssText = `position:absolute;left:50%;bottom:24px;transform:translateX(-50%);padding:6px 14px;border:1px solid ${NEON};background:rgba(0,0,0,.75);color:#fff;font:600 14px system-ui,sans-serif;border-radius:6px;white-space:nowrap`;
  // Mutmacher in der Mitte, erst ab dem dritten Fehler sichtbar
  const mut = document.createElement('div');
  mut.style.cssText = `position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);max-width:min(420px,80vw);padding:20px 28px;border:2px solid ${NEON};box-shadow:0 0 24px ${GLUT};background:rgba(10,0,20,.9);color:#fff;font:600 20px system-ui,sans-serif;text-align:center;border-radius:12px;display:none`;
  const mutText = document.createElement('div');
  const mutZahl = document.createElement('div');
  mutZahl.style.cssText = `margin-top:10px;font-size:15px;color:${NEON}`;
  mut.append(mutText, mutZahl);
  huelle.append(leinwand, mut, hinweis);
  document.body.append(huelle);

  const schlucken = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
  const tastenEvents = ['keydown', 'keypress', 'keyup'] as const;
  for (const t of tastenEvents) window.addEventListener(t, schlucken, true);
  for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart', 'wheel', 'contextmenu']) huelle.addEventListener(t, schlucken);

  let b = 0, h = 0;
  const groesse = () => {
    const dpr = window.devicePixelRatio || 1;
    b = window.innerWidth; h = window.innerHeight;
    leinwand.width = b * dpr; leinwand.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  groesse();
  window.addEventListener('resize', groesse);

  const kaefer: Kaefer[] = [];
  const fliegende: Wort[] = [];
  const zustand = {
    ende: jetzt + dauer,
    dazu: (n: number) => { for (let i = 0; i < n && kaefer.length < 5; i++) kaefer.push(neuerKaefer(b, h)); },
    zeigeSerie: () => {
      if (serie < MUTMACHER_AB) return;
      if (serie === 42) mutText.textContent = 'DON’T PANIC. 42 ist die Antwort auf alles – nur nicht auf diese Aufgabe.';
      else if (mut.style.display === 'none') mutText.textContent = MUTMACHER[Math.floor(Math.random() * MUTMACHER.length)];
      mut.style.display = 'block';
      // die Serie reißt erst nach einer Minute ohne Fehler ab, kann also länger laufen
      mutZahl.textContent = `${serie} Fehler in Folge`;
    },
  };
  laufend = zustand;
  zustand.dazu(Math.min(serie, 3));
  zustand.zeigeSerie();

  let vorher = jetzt;
  let schluss = 0;
  const schritt = (t: number) => {
    const dt = Math.min((t - vorher) / 1000, 0.05);
    vorher = t;
    ctx.clearRect(0, 0, b, h);

    const kasten = mut.style.display === 'none' ? null : mut.getBoundingClientRect();
    for (const k of kaefer) {
      k.drehung += (Math.random() - 0.5) * 6 * dt;
      k.drehung *= 0.97;
      if (kasten) {
        // um den Mutmacher kreisen: einem Punkt auf der Ellipse um ihn nachlaufen
        k.umlauf += dt * k.tempo / 260;
        const zx = b / 2 + Math.cos(k.umlauf) * (kasten.width / 2 + 80);
        const zy = h / 2 + Math.sin(k.umlauf) * (kasten.height / 2 + 80);
        k.winkel += Math.sin(Math.atan2(zy - k.y, zx - k.x) - k.winkel) * 5 * dt;
      } else {
        // sanft zurück zur Mitte, wenn ein Käfer zum Rand will
        const zurMitte = Math.atan2(h / 2 - k.y, b / 2 - k.x);
        const ausserhalb = k.x < 100 || k.x > b - 100 || k.y < 100 || k.y > h - 100;
        if (ausserhalb) k.winkel += Math.sin(zurMitte - k.winkel) * 2 * dt;
      }
      k.winkel += k.drehung * dt;
      k.x += Math.cos(k.winkel) * k.tempo * dt;
      k.y += Math.sin(k.winkel) * k.tempo * dt;
      k.phase += k.tempo * dt * 0.12;
      bewege(k, dt);
      k.spuckZeit -= dt;
      if (k.spuckZeit <= 0 && t < zustand.ende) {
        k.spuckZeit = 0.15 + Math.random() * 0.25;
        const a = k.winkel + (Math.random() - 0.5) * 2.4;
        const v = 120 + Math.random() * 180;
        fliegende.push({ text: woerter[Math.floor(Math.random() * woerter.length)], x: k.x, y: k.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, dreh: (Math.random() - 0.5) * 0.4, geboren: t, vonX: k.x, vonY: k.y, farbe: k.glut });
      }
    }

    ctx.font = '600 14px system-ui,sans-serif';
    ctx.textBaseline = 'middle';
    for (let i = fliegende.length - 1; i >= 0; i--) {
      const w = fliegende[i];
      const alter = (t - w.geboren) / 1000;
      if (alter > 1.8) { fliegende.splice(i, 1); continue; }
      w.x += w.vx * dt; w.y += w.vy * dt;
      w.vx *= 0.94; w.vy *= 0.94;
      const alpha = Math.min(1, 1.8 - alter);
      if (alter < 0.6) {
        ctx.strokeStyle = `rgba(255,255,255,${0.35 * (1 - alter / 0.6)})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(w.vonX, w.vonY); ctx.lineTo(w.x, w.y); ctx.stroke();
      }
      ctx.save();
      ctx.globalAlpha = alpha * 0.8;
      ctx.translate(w.x, w.y);
      ctx.rotate(w.dreh * alter);
      const breite = ctx.measureText(w.text).width + 10;
      ctx.fillStyle = w.farbe;
      ctx.fillRect(-breite / 2, -11, breite, 22);
      ctx.fillStyle = '#fff';
      ctx.fillText(w.text, -breite / 2 + 5, 0);
      ctx.restore();
    }

    for (const k of kaefer) zeichneKaefer(ctx, k);

    const rest = Math.max(0, Math.ceil((zustand.ende - t) / 1000));
    hinweis.textContent = `🐞 Falsch – erst lesen, dann klicken · ${rest} s`;

    if (t >= zustand.ende) {
      if (!schluss) { schluss = t; huelle.style.opacity = '0'; }
      if (t - schluss > 300) { aufraeumen(); return; }
    }
    requestAnimationFrame(schritt);
  };

  const aufraeumen = () => {
    for (const ev of tastenEvents) window.removeEventListener(ev, schlucken, true);
    window.removeEventListener('resize', groesse);
    huelle.remove();
    laufend = null;
  };

  requestAnimationFrame(schritt);
}
