/**
 * Zeichnet den Querschnitt des Wilson-Zyklus auf ein Canvas.
 *
 * Senkrecht ist die Achse stückweise gestaucht (Gebirge und Ozean sonst
 * unsichtbar neben 700 km Mantel) — die Tiefenskala links zeigt das ehrlich.
 */
import {
  ANFANG_RIFT, AUFBRUCH, KOLLISION, RUECKEN_WEG, SUBDUKTION, GIPFEL,
  bogenAbstand, gebirge, randAusduennung, geschwindigkeit, kanteA, kanteB, kontinentHoehe, krustenDicke,
  lithoDicke, ozeanTiefe, plattenBahn, riftGrad, rinneAktiv, rueckenAktiv, rueckenX, streifen, type Streifen,
} from "@/lib/wilson/modell";

export interface ZeichenOptionen {
  beschriftung: boolean;
  konvektion: boolean;
  magnet: boolean;
  beben: boolean;
  /** Echtzeit in Sekunden, für Flimmern und Strömung. */
  uhr: number;
}

export const X_MIN = -4800, X_MAX = 4800;

/** Tiefe z in km (nach unten positiv, Höhen negativ) → Anteil der Bildhöhe. */
const Y_STUETZEN: [number, number][] = [[-10, 0.02], [0, 0.2], [15, 0.37], [160, 0.66], [720, 0.995]];

export function yAnteil(z: number): number {
  const s = Y_STUETZEN;
  if (z <= s[0][0]) return s[0][1] + (z - s[0][0]) * ((s[1][1] - s[0][1]) / (s[1][0] - s[0][0]));
  for (let i = 1; i < s.length; i++) {
    if (z <= s[i][0]) return s[i - 1][1] + ((z - s[i - 1][0]) / (s[i][0] - s[i - 1][0])) * (s[i][1] - s[i - 1][1]);
  }
  return s[s.length - 1][1];
}

interface Spalte {
  x: number;
  art: "A" | "B" | "ozean";
  /** Oberkante (z, km), Krustenunterkante, Lithosphärenunterkante. */
  oben: number;
  kruste: number;
  litho: number;
  sediment: number;
  streifen?: Streifen;
  /** Vor dem Aufbruch liegt im Graben ein See statt Meer. */
  see?: boolean;
}

const SCHRITT = 12;

function zufall(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

export function spalten(t: number): Spalte[] {
  const xA = kanteA(t), xB = kanteB(t);
  const offen = t >= AUFBRUCH && t < KOLLISION;
  const alle = streifen(t).filter(s => s.abgetaucht === 0).sort((a, b) => a.x - b.x);
  const aus: Spalte[] = [];
  const rinne = rinneAktiv(t) && t < KOLLISION ? xB : null;
  const bogen = rinne != null ? rinne + bogenAbstand() : null;
  const bogenAn = t >= SUBDUKTION + 8 && t < KOLLISION;
  const rift = t < AUFBRUCH ? riftGrad(t) : 0;
  for (let x = X_MIN; x <= X_MAX; x += SCHRITT) {
    const imOzean = offen && x > xA && x < xB;
    if (!imOzean) {
      const art: "A" | "B" = x <= (t < AUFBRUCH ? 0 : xA) ? "A" : "B";
      const d = t < AUFBRUCH ? 1e9 : art === "A" ? xA - x : x - xB;
      const dicke = krustenDicke(t, d, x);
      let h = kontinentHoehe(t, dicke, x);
      if (bogen != null && bogenAn && art === "B") h += 2.2 * Math.min(1, (t - SUBDUKTION - 8) / 15) * Math.exp(-(((x - bogen) / 70) ** 2));
      const oben = -h;
      // Passiver Rand: Schelf mit Sedimenten auffüllen.
      let sediment = 0;
      const passiv = t >= AUFBRUCH && (art === "A" ? t < KOLLISION : t < SUBDUKTION + 30);
      if (passiv && d < 260) {
        const ziel = 0.15 + 3.2 * Math.max(0, 1 - d / 240) ** 2;
        const alter = Math.min(1, (t - AUFBRUCH) / 60);
        sediment = Math.max(0, (oben - ziel) * 0.85 * alter);
      }
      const litho = 150 - (t < AUFBRUCH + 30 ? 90 * Math.max(rift, t >= AUFBRUCH ? 1 - (t - AUFBRUCH) / 30 : 0) * Math.exp(-(((t < AUFBRUCH ? x : d) / 260) ** 2)) : 0);
      // Am Kontinentrand dünnt die Lithosphäre aus und geht in die ozeanische über.
      const randLitho = t >= AUFBRUCH ? 75 * randAusduennung(t) * Math.exp(-Math.max(0, d) / 300) : 0;
      aus.push({ x, art, oben: oben - sediment, kruste: oben + dicke, litho: litho - randLitho, sediment, see: rift > 0.4 && Math.abs(x) < 200 && oben > 0 });
      continue;
    }
    // Ozean: welcher Streifen liegt hier?
    let s: Streifen | undefined;
    let lo = 0, hi = alle.length - 1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (alle[m].x + alle[m].breite / 2 < x) lo = m + 1;
      else if (alle[m].x - alle[m].breite / 2 > x) hi = m - 1;
      else { s = alle[m]; break; }
    }
    const alter = s ? s.alter : 0;
    let tiefe = ozeanTiefe(alter);
    if (rinne != null) {
      const abstand = rinne - x;
      if (abstand < 90) tiefe += 3 * (1 - abstand / 90) ** 2;
    }
    // Sedimente am Kontinentfuß (passive Ränder).
    const vomRand = Math.min(x - xA, t < SUBDUKTION ? xB - x : Infinity);
    const sediment = Math.min(2.5, alter / 40) * Math.exp(-vomRand / 220) + Math.min(0.4, alter / 150);
    aus.push({ x, art: "ozean", oben: tiefe - sediment, kruste: tiefe + 7, litho: tiefe + lithoDicke(alter), sediment, streifen: s });
  }
  return aus;
}

export function zeichne(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, o: ZeichenOptionen) {
  const X = (x: number) => ((x - X_MIN) / (X_MAX - X_MIN)) * W;
  const Y = (z: number) => yAnteil(z) * H;
  const sp = spalten(t);
  const dx = (SCHRITT / (X_MAX - X_MIN)) * W + 0.6;

  // Himmel und Mantel.
  const himmel = ctx.createLinearGradient(0, 0, 0, Y(0));
  himmel.addColorStop(0, "#9cc9ec");
  himmel.addColorStop(1, "#e3f1fb");
  ctx.fillStyle = himmel;
  ctx.fillRect(0, 0, W, Y(0));
  const mantel = ctx.createLinearGradient(0, Y(60), 0, H);
  mantel.addColorStop(0, "#e9894a");
  mantel.addColorStop(0.35, "#d8622e");
  mantel.addColorStop(0.7, "#b8431f");
  mantel.addColorStop(1, "#8f2c17");
  ctx.fillStyle = mantel;
  ctx.fillRect(0, Y(0), W, H - Y(0));
  // 410/660-km-Grenzen.
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.setLineDash([6, 6]);
  for (const z of [410, 660]) { ctx.beginPath(); ctx.moveTo(0, Y(z)); ctx.lineTo(W, Y(z)); ctx.stroke(); }
  ctx.setLineDash([]);

  if (o.konvektion) zeichneStroemung(ctx, t, X, Y, o.uhr);

  // Wasser.
  for (const s of sp) {
    if (s.oben > 0) {
      ctx.fillStyle = s.see ? "#4fa3b8" : s.art === "ozean" ? "#1e5fa8" : "#3b82c4";
      ctx.fillRect(X(s.x) - dx / 2, Y(0), dx, Y(s.oben) - Y(0));
    }
  }

  // Lithosphärischer Mantel, Kruste, Sedimente.
  for (const s of sp) {
    const x0 = X(s.x) - dx / 2;
    ctx.fillStyle = s.art === "ozean" ? "#5b4a3c" : "#6d5640";
    ctx.fillRect(x0, Y(s.kruste), dx, Y(s.litho) - Y(s.kruste));
    if (s.art === "ozean") {
      ctx.fillStyle = "#3f5a55";
      ctx.fillRect(x0, Y(s.oben + s.sediment), dx, Y(s.kruste) - Y(s.oben + s.sediment));
      if (o.magnet && s.streifen) {
        ctx.fillStyle = s.streifen.normal ? "#e2e8f0" : "#1f2937";
        ctx.fillRect(x0, Y(s.oben + s.sediment), dx, Math.max(3, (Y(s.kruste) - Y(s.oben + s.sediment)) * 0.35));
      }
    } else {
      // Oberkruste (Granit) und Unterkruste.
      const mitte = (s.oben + s.sediment + s.kruste) / 2;
      ctx.fillStyle = "#c9967a";
      ctx.fillRect(x0, Y(s.oben + s.sediment), dx, Y(mitte) - Y(s.oben + s.sediment));
      ctx.fillStyle = "#9c7462";
      ctx.fillRect(x0, Y(mitte), dx, Y(s.kruste) - Y(mitte));
      if (s.oben + s.sediment < 0.3) {
        ctx.fillStyle = s.oben < -2.5 ? "#8b8f7a" : "#6f9a4f";
        ctx.fillRect(x0, Y(s.oben) - 1.5, dx, 2.5);
      }
    }
    if (s.sediment > 0.05) {
      ctx.fillStyle = "#e8c77d";
      ctx.fillRect(x0, Y(s.oben), dx, Y(s.oben + s.sediment) - Y(s.oben));
    }
  }

  // Sutur: die Naht, an der zwei Kontinente zusammengeschweißt sind — auch die
  // des vorigen Zyklus, an der der Superkontinent später wieder aufreißt.
  if (t >= KOLLISION || t < AUFBRUCH) {
    const mitte = sp[Math.round((0 - X_MIN) / SCHRITT)];
    if (mitte && mitte.art !== "ozean") {
      ctx.strokeStyle = "rgba(34,120,90,0.9)";
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(X(-15), Y(mitte.oben + mitte.sediment)); ctx.lineTo(X(40), Y(mitte.kruste)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
    }
  }

  zeichnePlatte(ctx, t, X, Y);
  zeichneRiftUndRuecken(ctx, t, X, Y);
  if (o.beben) zeichneBeben(ctx, t, X, Y, o.uhr);
  zeichnePfeile(ctx, t, X, Y);
  if (o.beschriftung) zeichneNamen(ctx, t, X, Y, sp);
  zeichneSkala(ctx, W, H, Y);
}

/** Die abtauchende Platte, Streifen für Streifen entlang ihrer Bahn. */
function zeichnePlatte(ctx: CanvasRenderingContext2D, t: number, X: (x: number) => number, Y: (z: number) => number) {
  if (t < SUBDUKTION) return;
  const rinne = kanteB(Math.min(t, KOLLISION));
  const abriss = t > KOLLISION + 15 ? (t - KOLLISION - 15) * 4 : 0;
  if (abriss > 700) return;
  const alle = streifen(t).filter(s => s.abgetaucht > 0 && s.abgetaucht < 1500);
  const zRinne = 8;
  for (const s of alle) {
    const a = plattenBahn(s.abgetaucht - s.breite / 2);
    const b = plattenBahn(s.abgetaucht + s.breite / 2);
    const dick = lithoDicke(s.alter - s.abgetaucht / 40);
    const oben = (p: { dx: number; z: number }) => [rinne + p.dx, zRinne + p.z + abriss] as const;
    const unten = (p: { dx: number; z: number; winkel: number }) =>
      [rinne + p.dx - Math.sin(p.winkel) * dick, zRinne + p.z + Math.cos(p.winkel) * dick + abriss] as const;
    const pa = oben(a), pb = oben(b), qa = unten(a), qb = unten(b);
    const verblassen = Math.max(0.15, 1 - s.abgetaucht / 1600 - abriss / 700);
    ctx.globalAlpha = verblassen;
    ctx.fillStyle = "#4a3b31";
    ctx.beginPath();
    ctx.moveTo(X(pa[0]), Y(pa[1])); ctx.lineTo(X(pb[0]), Y(pb[1])); ctx.lineTo(X(qb[0]), Y(qb[1])); ctx.lineTo(X(qa[0]), Y(qa[1]));
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#3f5a55";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(X(pa[0]), Y(pa[1])); ctx.lineTo(X(pb[0]), Y(pb[1])); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
  // Magma zum Vulkanbogen.
  if (t >= SUBDUKTION + 8 && t < KOLLISION) {
    const xb = rinne + bogenAbstand();
    ctx.strokeStyle = "rgba(255,120,30,0.9)";
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(X(xb - 20), Y(115)); ctx.bezierCurveTo(X(xb + 10), Y(60), X(xb - 10), Y(20), X(xb), Y(-1.5)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    ctx.fillStyle = "#ff7a1a";
    ctx.beginPath(); ctx.ellipse(X(xb), Y(12), 8, 5, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function zeichneRiftUndRuecken(ctx: CanvasRenderingContext2D, t: number, X: (x: number) => number, Y: (z: number) => number) {
  // Plume: steigt vor dem Rift auf.
  if (t < AUFBRUCH + 50) {
    const kopf = t < ANFANG_RIFT ? 700 - 520 * (t / ANFANG_RIFT) : 180;
    const staerke = t < AUFBRUCH ? 1 : Math.max(0, 1 - (t - AUFBRUCH) / 50);
    const g = ctx.createRadialGradient(X(0), Y(kopf), 2, X(0), Y(kopf), 60);
    g.addColorStop(0, `rgba(255,230,120,${0.9 * staerke})`);
    g.addColorStop(1, "rgba(255,160,40,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(X(0), Y(kopf), 70, 34, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,200,80,${0.5 * staerke})`;
    ctx.fillRect(X(0) - 7, Y(kopf), 14, Y(720) - Y(kopf));
  }
  // Abschiebungen im Graben.
  const r = riftGrad(t);
  if (r > 0 && t < AUFBRUCH + 5) {
    ctx.strokeStyle = "rgba(60,30,20,0.8)";
    ctx.lineWidth = 1.5;
    for (const x of [-260, -140, 140, 260]) {
      const kz = krustenDicke(t, 1e9, x);
      const oben = -kontinentHoehe(t, kz, x);
      ctx.beginPath(); ctx.moveTo(X(x), Y(oben)); ctx.lineTo(X(x * 0.8), Y(oben + 14)); ctx.stroke();
    }
    ctx.lineWidth = 1;
    if (r > 0.3) vulkan(ctx, X(-35), Y(-kontinentHoehe(t, krustenDicke(t, 1e9, -35), -35)), 9);
  }
  // Mittelozeanischer Rücken: Magmakammer.
  if (rueckenAktiv(t) && t >= AUFBRUCH + 3) {
    const xr = rueckenX(t);
    ctx.fillStyle = "#ff6a1a";
    ctx.beginPath(); ctx.ellipse(X(xr), Y(ozeanTiefe(0) + 9), 7, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,120,30,0.8)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(X(xr), Y(60)); ctx.lineTo(X(xr), Y(ozeanTiefe(0) + 9)); ctx.stroke();
    ctx.setLineDash([]);
  }
  // Vulkane am Bogen.
  if (t >= SUBDUKTION + 8 && t < KOLLISION) {
    const xb = kanteB(Math.min(t, KOLLISION)) + bogenAbstand();
    const h = kontinentHoehe(t, krustenDicke(t, xb - kanteB(t), xb), xb) + 2.2 * Math.min(1, (t - SUBDUKTION - 8) / 15);
    vulkan(ctx, X(xb), Y(-h), 13);
  }
}

function vulkan(ctx: CanvasRenderingContext2D, x: number, y: number, g: number) {
  ctx.fillStyle = "#5b4636";
  ctx.beginPath(); ctx.moveTo(x - g, y + 3); ctx.lineTo(x - 2, y - g); ctx.lineTo(x + 2, y - g); ctx.lineTo(x + g, y + 3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#ff5a1a";
  ctx.beginPath(); ctx.arc(x, y - g, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(120,120,120,0.5)";
  ctx.beginPath(); ctx.arc(x + 4, y - g - 7, 4, 0, Math.PI * 2); ctx.arc(x + 9, y - g - 13, 5, 0, Math.PI * 2); ctx.fill();
}

/** Strömung im Mantel: gebogene Pfeile, die sich bewegen. */
function zeichneStroemung(ctx: CanvasRenderingContext2D, t: number, X: (x: number) => number, Y: (z: number) => number, uhr: number) {
  const zellen: { mitte: number; breite: number; dreh: 1 | -1 }[] = [];
  if (t >= AUFBRUCH && t < RUECKEN_WEG) {
    const xr = rueckenAktiv(t) ? rueckenX(t) : 0;
    zellen.push({ mitte: xr - 1500, breite: 1400, dreh: -1 });
    // Nach Subduktionsbeginn übernimmt die Zelle an der Platte die rechte Seite.
    if (t < SUBDUKTION) zellen.push({ mitte: xr + 1500, breite: 1400, dreh: 1 });
  } else if (t < AUFBRUCH) {
    zellen.push({ mitte: -1300, breite: 1200, dreh: -1 }, { mitte: 1300, breite: 1200, dreh: 1 });
  }
  if (t >= SUBDUKTION && t < KOLLISION + 20) {
    const xr = kanteB(Math.min(t, KOLLISION));
    zellen.push({ mitte: xr + 1300, breite: 1200, dreh: -1 });
  }
  ctx.strokeStyle = "rgba(255,240,210,0.55)";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 12]);
  ctx.lineDashOffset = -uhr * 30;
  for (const z of zellen) {
    // Ellipse zwischen 200 und 650 km Tiefe; dreh = +1 heißt im Uhrzeigersinn.
    const cx = X(z.mitte), cy = Y(420), rx = X(z.mitte + z.breite / 2) - cx, ry = (Y(660) - Y(200)) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2, z.dreh < 0);
    ctx.stroke();
    // Pfeilspitze oben: Strömung zeigt vom Aufstieg weg.
    const ax = cx, ay = cy - ry, r = z.dreh;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(ax + 8 * r, ay); ctx.lineTo(ax - 4 * r, ay - 6); ctx.moveTo(ax + 8 * r, ay); ctx.lineTo(ax - 4 * r, ay + 6);
    ctx.stroke();
    ctx.setLineDash([10, 12]);
  }
  ctx.setLineDash([]);
  ctx.lineWidth = 1;
}

function zeichneBeben(ctx: CanvasRenderingContext2D, t: number, X: (x: number) => number, Y: (z: number) => number, uhr: number) {
  const punkte: [number, number][] = [];
  const r = zufall(11);
  const takt = Math.floor(uhr * 3);
  if (t >= ANFANG_RIFT && t < AUFBRUCH + 10) for (let i = 0; i < 14; i++) punkte.push([(r() - 0.5) * 260, 3 + r() * 15]);
  if (rueckenAktiv(t) && t > AUFBRUCH) for (let i = 0; i < 8; i++) punkte.push([rueckenX(t) + (r() - 0.5) * 60, ozeanTiefe(0) + r() * 8]);
  if (rinneAktiv(t) && t < KOLLISION) {
    const xr = kanteB(t);
    for (let i = 0; i < 40; i++) {
      const p = plattenBahn(r() * 1100);
      if (p.z > 690) continue;
      punkte.push([xr + p.dx - r() * 25, 8 + p.z + r() * 15]);
    }
  }
  if (t >= KOLLISION && t < GIPFEL + 30) for (let i = 0; i < 26; i++) punkte.push([-250 + r() * 700, 5 + r() * 60]);
  punkte.forEach(([x, z], i) => {
    const an = (i * 7 + takt) % 5 === 0;
    ctx.fillStyle = an ? "rgba(255,255,80,1)" : "rgba(255,255,120,0.4)";
    ctx.beginPath(); ctx.arc(X(x), Y(z), an ? 3.5 : 2, 0, Math.PI * 2); ctx.fill();
  });
}

function pfeil(ctx: CanvasRenderingContext2D, x: number, y: number, v: number) {
  if (Math.abs(v) < 0.5) return;
  const l = Math.min(70, 18 + Math.abs(v) * 1.8) * Math.sign(v);
  ctx.strokeStyle = "#111827";
  ctx.fillStyle = "#111827";
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(x - l / 2, y); ctx.lineTo(x + l / 2, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + l / 2 + 6 * Math.sign(v), y); ctx.lineTo(x + l / 2 - 3 * Math.sign(v), y - 6); ctx.lineTo(x + l / 2 - 3 * Math.sign(v), y + 6); ctx.fill();
  ctx.lineWidth = 1;
  ctx.font = "bold 11px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(`${(Math.abs(v) / 10).toLocaleString("de-DE", { maximumFractionDigits: 1 })} cm/J`, x, y - 9);
}

function zeichnePfeile(ctx: CanvasRenderingContext2D, t: number, X: (x: number) => number, Y: (z: number) => number) {
  const y = Y(-8.2);
  if (t < AUFBRUCH) {
    if (t >= ANFANG_RIFT) { pfeil(ctx, X(-900), y, -3); pfeil(ctx, X(900), y, 3); }
    return;
  }
  if (t >= KOLLISION + 50) return;
  const vA = t >= KOLLISION ? 8 : geschwindigkeit("A", t);
  const vB = t >= KOLLISION ? -8 : geschwindigkeit("B", t);
  pfeil(ctx, X(Math.max(X_MIN + 1500, kanteA(t) - 1000)), y, vA);
  pfeil(ctx, X(Math.min(X_MAX - 1500, kanteB(t) + 1000)), y, vB);
}

function schild(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, zu?: [number, number]) {
  ctx.font = "bold 12px system-ui";
  const w = ctx.measureText(text).width + 10;
  if (zu) {
    ctx.strokeStyle = "rgba(17,24,39,0.7)";
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(zu[0], zu[1]); ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillRect(x - w / 2, y - 9, w, 17);
  ctx.fillStyle = "#111827";
  ctx.textAlign = "center";
  ctx.fillText(text, x, y + 4);
}

function zeichneNamen(ctx: CanvasRenderingContext2D, t: number, X: (x: number) => number, Y: (z: number) => number, sp: Spalte[]) {
  const oben = (x: number) => sp[Math.max(0, Math.min(sp.length - 1, Math.round((x - X_MIN) / SCHRITT)))]?.oben ?? 0;
  const xA = kanteA(t), xB = kanteB(t);
  const reihe = Y(-9.2);
  schild(ctx, "Asthenosphäre", X(X_MIN + 900), Y(230));
  schild(ctx, "Lithosphäre", X(X_MIN + 900), Y(95));
  schild(ctx, "Kontinentale Kruste", X(Math.max(X_MIN + 1100, Math.min(xA, 0) - 1800)), Y(22));
  if (t < ANFANG_RIFT) {
    schild(ctx, "Superkontinent", X(0), reihe);
    schild(ctx, "alte Naht (Sutur)", X(-1100), Y(40), [X(10), Y(25)]);
    if (t > 8) schild(ctx, "Manteldiapir (Plume)", X(700), Y(420), [X(60), Y(700 - 520 * (t / ANFANG_RIFT))]);
    if (t > 12) schild(ctx, "Aufwölbung", X(-600), Y(-6.5), [X(-300), Y(oben(-300))]);
    return;
  }
  if (t < AUFBRUCH) {
    schild(ctx, "Grabenbruch", X(0), reihe, [X(0), Y(oben(0))]);
    schild(ctx, "Grabenschulter", X(-1000), Y(-6.5), [X(-330), Y(oben(-330))]);
    schild(ctx, "Plume", X(700), Y(300), [X(40), Y(190)]);
    return;
  }
  if (t < KOLLISION) {
    schild(ctx, "Kontinent A", X(Math.max(X_MIN + 600, xA - 2300)), reihe);
    schild(ctx, "Kontinent B", X(Math.min(X_MAX - 600, xB + 2300)), reihe);
    if (rueckenAktiv(t)) schild(ctx, t < 90 ? "junger Ozeanboden" : "Mittelozeanischer Rücken", X(rueckenX(t)), Y(-5.5), [X(rueckenX(t)), Y(ozeanTiefe(0))]);
    if (xB - xA > 2000) {
      const mitteA = (xA + (rueckenAktiv(t) ? rueckenX(t) : xB)) / 2;
      schild(ctx, "Tiefseeebene", X(mitteA), Y(9.5));
    }
    if (t > 80) schild(ctx, t < SUBDUKTION ? "Schelf (passiver Rand)" : "Schelf", X(xA - 450), Y(-3.8), [X(xA - 150), Y(oben(xA - 150))]);
    if (t > AUFBRUCH + 20) schild(ctx, "Ozeanische Kruste", X(Math.max(xA + 350, (xA + xB) / 2 - 900)), Y(40), [X(Math.max(xA + 350, (xA + xB) / 2 - 900)), Y(oben((xA + xB) / 2 - 900) + 4)]);
    if (rinneAktiv(t)) {
      schild(ctx, "Tiefseerinne", X(xB - 500), Y(13.5), [X(xB - 20), Y(oben(xB - 20))]);
      if (t > SUBDUKTION + 10) schild(ctx, "Vulkanbogen", X(xB + bogenAbstand() + 450), Y(-6.8), [X(xB + bogenAbstand() + 10), Y(-4)]);
      if (t > SUBDUKTION + 15) {
        const p = plattenBahn(420);
        schild(ctx, "abtauchende Platte", X(xB + p.dx + 420), Y(p.z - 30), [X(xB + p.dx + 20), Y(p.z)]);
      }
    }
    return;
  }
  const g = gebirge(t);
  schild(ctx, t < GIPFEL ? "Gebirge wächst" : g > 0.5 ? "Hochgebirge" : "Rumpfgebirge", X(120), reihe, [X(120), Y(oben(120)) - 4]);
  if (g > 0.3) schild(ctx, "Gebirgswurzel", X(900), Y(75), [X(160), Y(35 + 35 * g)]);
  schild(ctx, "Sutur (alte Naht)", X(-900), Y(40), [X(0), Y(20)]);
  if (t < KOLLISION + 60) schild(ctx, "abreißende Platte", X(900), Y(420), [X(250), Y(380)]);
}

function zeichneSkala(ctx: CanvasRenderingContext2D, W: number, H: number, Y: (z: number) => number) {
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillRect(0, 0, 44, H);
  ctx.fillStyle = "#111827";
  ctx.strokeStyle = "#111827";
  ctx.font = "10px system-ui";
  ctx.textAlign = "right";
  for (const [z, t] of [[-5, "+5 km"], [0, "0"], [10, "10"], [50, "50"], [100, "100"], [410, "410"], [660, "660"]] as [number, string][]) {
    ctx.beginPath(); ctx.moveTo(38, Y(z)); ctx.lineTo(44, Y(z)); ctx.stroke();
    ctx.fillText(t, 36, Y(z) + 3);
  }
  ctx.save();
  ctx.translate(10, H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("Tiefe in km (gestaucht)", 0, 0);
  ctx.restore();
  // 1000 km Maßstab.
  const l = (1000 / (X_MAX - X_MIN)) * W;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(W - l - 24, H - 26, l + 16, 20);
  ctx.fillStyle = "#111827";
  ctx.fillRect(W - l - 16, H - 14, l, 3);
  ctx.textAlign = "center";
  ctx.fillText("1000 km", W - l / 2 - 16, H - 17);
}
