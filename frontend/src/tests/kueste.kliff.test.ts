import { describe, expect, it } from "vitest";
import {
  MAT, abschliessen, geometrie, kBegriffe, kMassnahme, kSchritt, kWasser, kliffKante, neuesKliff, rieseln,
  spalteVon, standsicherheit, ueberhang, xVon, zVon, zeileVon, type Kliff,
} from "@/lib/kueste/kliff";
import { zonenAbstand } from "@/lib/kueste/begriffe";
import type { Wetter } from "@/lib/kueste/profil";

const STURM: Wetter = { bft: 8, auflandig: true, regen: false, frost: false };
const RUHE: Wetter = { bft: 2, auflandig: true, regen: false, frost: false };
const REGEN: Wetter = { bft: 2, auflandig: true, regen: true, frost: false };

/** Schutt und Blöcke vor der Wand wegnehmen, damit die Brandung die Wand erreicht */
function fussFrei(k: Kliff) {
  const g = geometrie(k);
  const kante = spalteVon(k, kliffKante(k));
  for (let r = zeileVon(k, -1.5); r < k.nz; r++) for (let c = Math.max(0, kante - Math.round(20 / k.dx)); c < kante + 4; c++) {
    const i = r * k.nx + c;
    if (k.mat[i] === MAT.SCHUTT || k.mat[i] === MAT.BLOCK) k.mat[i] = MAT.LUFT;
  }
  void g;
  k.version++;
}

/** Vorderste Gesteinsspalte (m) in Höhe z, Schutt nicht mitgezählt */
function front(k: Kliff, z: number) {
  const r = zeileVon(k, z);
  let c = 0;
  while (c < k.nx && (k.mat[r * k.nx + c] === MAT.LUFT || k.mat[r * k.nx + c] === MAT.SCHUTT || k.mat[r * k.nx + c] === MAT.BLOCK)) c++;
  return xVon(k, c);
}

function lauf(k: Kliff, w: Wetter, stunden: number, dt = 3) {
  for (let h = 0; h < stunden; h += dt) { kSchritt(k, w, dt); if (k.bewegungen.length) abschliessen(k); }
}

describe("Steilküste im Zellmodell", () => {
  it("die Oberkante ist gerundet, nicht rechtwinklig", () => {
    const k = neuesKliff("kreide");
    const oben = zVon(k, geometrie(k).top[k.nx - 1]);
    // Knapp unter der Kante liegt die Wand deutlich weiter landeinwärts als tiefer unten
    expect(front(k, oben - 0.5) - front(k, oben - 6)).toBeGreaterThan(1.5);
  });

  it("eine frische, scharfe Abbruchkante rundet sich mit der Zeit ab", () => {
    const k = neuesKliff("kreide");
    const g = geometrie(k);
    const oben = zVon(k, g.top[k.nx - 1]);
    // Frischer Abbruch: alles seewärts von x0 über 5 m Höhe weg — eine rechtwinklige Kante
    const x0 = kliffKante(k) + 8;
    for (let r = zeileVon(k, 5); r < k.nz; r++) for (let c = 0; c < spalteVon(k, x0); c++) k.mat[r * k.nx + c] = MAT.LUFT;
    k.version++;
    k.risse = 0;
    expect(front(k, oben - 0.4)).toBeLessThan(x0 + 0.3);
    lauf(k, REGEN, 8766 * 2, 12);
    // Oben ist die Kante zurückgewichen, tiefer unten kaum: sie ist rund
    expect(front(k, oben - 0.4) - x0).toBeGreaterThan(0.75);
    expect(front(k, oben - 8) - x0).toBeLessThan(0.75);
  });

  it("die Brandung frisst eine Hohlkehle knapp über dem Wasserspiegel", () => {
    const k = neuesKliff("kreide");
    fussFrei(k);
    k.risse = 0; // kein Abbruch während des Tests
    lauf(k, STURM, 1500);
    const u = ueberhang(k, 0.1);
    expect(u.kehle).toBeGreaterThan(0.5);
    expect(zVon(k, u.rN)).toBeGreaterThan(-0.5);
    expect(zVon(k, u.rN)).toBeLessThan(2);
  });

  it("ein zu tiefer Überhang bricht ab und die Kante weicht zurück", () => {
    const k = neuesKliff("kreide");
    fussFrei(k);
    const vorher = kliffKante(k);
    // Hohlkehle von 3,5 m Tiefe zwischen 0 und 1,5 m Höhe
    const f = spalteVon(k, front(k, 0.8));
    for (let r = zeileVon(k, 0.1); r <= zeileVon(k, 1.5); r++) for (let c = f; c < f + Math.round(3.5 / k.dx); c++) k.mat[r * k.nx + c] = MAT.LUFT;
    k.version++;
    kSchritt(k, RUHE, 1);
    expect(k.analyse.spannung).toBeGreaterThanOrEqual(1);
    expect(k.bilanz.ereignisse).toBeGreaterThan(0);
    abschliessen(k);
    expect(kliffKante(k)).toBeGreaterThan(vorher + 1);
  });

  it("ein Deckwerk am Fuß verhindert die Hohlkehle", () => {
    const k = neuesKliff("kreide");
    fussFrei(k);
    kMassnahme(k, "deckwerk");
    k.risse = 0;
    lauf(k, STURM, 1500);
    expect(ueberhang(k, 0.1).kehle).toBeLessThan(0.3);
  });

  it("Grundwasser senkt die Standsicherheit, Drainage deckelt es", () => {
    const k = neuesKliff("mergel");
    k.saettigung = 0.2;
    const trocken = standsicherheit(k, 0, false);
    k.saettigung = 1;
    const nass = standsicherheit(k, 0, false);
    expect(nass).toBeLessThan(trocken);
    const d = neuesKliff("mergel");
    kMassnahme(d, "drainage");
    lauf(d, REGEN, 24 * 30, 6);
    expect(d.saettigung).toBeLessThanOrEqual(0.45);
  });

  it("auf der Kliffhalde reichert sich Feuerstein an, wenn das Feine ausgespült wird", () => {
    const k = neuesKliff("kreide");
    const anteil = () => {
      let block = 0, schutt = 0;
      const kante = spalteVon(k, kliffKante(k));
      for (let r = zeileVon(k, -1); r < zeileVon(k, 8); r++) for (let c = kante - Math.round(15 / k.dx); c < kante + 4; c++) {
        const m = k.mat[r * k.nx + c];
        if (m === MAT.BLOCK) block++; else if (m === MAT.SCHUTT) schutt++;
      }
      return block / Math.max(1, block + schutt);
    };
    const vorher = anteil();
    k.risse = 0;
    lauf(k, { bft: 6, auflandig: true, regen: true, frost: false }, 8766, 6);
    expect(anteil()).toBeGreaterThan(vorher * 1.5);
  });

  it("Schutt rieselt bis zum Schüttwinkel ab", () => {
    const k = neuesKliff("kreide");
    // Eine Säule aus Schutt mitten in die Luft über der Plattform stellen
    const c = spalteVon(k, 30);
    for (let r = zeileVon(k, 0); r < zeileVon(k, 8); r++) { k.mat[r * k.nx + c] = MAT.SCHUTT; k.herk[r * k.nx + c] = MAT.KREIDE; }
    k.aktiv = { c0: 0, c1: k.nx - 1, r0: 1, r1: k.nz - 1 };
    for (let s = 0; s < 400 && rieseln(k) > 0; s++);
    const g = geometrie(k);
    // keine Stufe steiler als 45° (eine Zelle je Zelle)
    for (let q = c - 20; q < c + 20; q++) expect(Math.abs(g.top[q + 1] - g.top[q])).toBeLessThanOrEqual(2);
  });
  it("nach einer Rutschung hängt kein verrutschtes Gestein in der Luft", () => {
    for (const typ of ["kreide", "moen", "mergel", "sand"] as const) {
      const k = neuesKliff(typ);
      k.saettigung = 1; k.risse = 1; k.festFaktor *= 0.3;
      expect(standsicherheit(k, kWasser(k, REGEN), true), typ).toBeLessThan(1);
      expect(k.bewegungen.length, typ).toBeGreaterThan(0);
      abschliessen(k);
      const luft = Math.round(1 / k.dx);
      for (let r = luft + 1; r < k.nz; r++) for (let c = 0; c < k.nx; c++) {
        const i = r * k.nx + c;
        if (!k.gestoert[i] || k.mat[i] === MAT.LUFT || k.mat[i] === MAT.SCHUTT || k.mat[i] === MAT.BLOCK) continue;
        let frei = true;
        for (let q = 1; q <= luft; q++) if (k.mat[i - q * k.nx] !== MAT.LUFT) frei = false;
        expect(frei, `${typ}: Zelle ${c}/${r} schwebt`).toBe(false);
      }
    }
  });

  it("Gleitflächen zählen nur, wo sie an der Wand frei ausstreichen", () => {
    const k = neuesKliff("moen");
    for (const e of k.ebenen) e.c *= 0.1;
    k.saettigung = 1;
    standsicherheit(k, 0, true);
    const b = k.bewegungen[0];
    expect(b?.art).toBe("gleit");
    // Die Masse beginnt an der Wand, nicht tief im Fels dahinter
    expect(b.ausX).toBeLessThan(kliffKante(k) + 1);
  });
});

describe("Bäume an der Kante", () => {
  it("ein Baum ohne Boden fällt zum Meer hinab und bleibt unten liegen", () => {
    const k = neuesKliff("kreide");
    const g = geometrie(k);
    const t = k.baeume.find(b => !b.weg)!;
    const oben = zVon(k, t.r);
    // Den Boden unter dem Baum bis zum Wasser wegnehmen (Abbruch)
    for (let c = 0; c <= t.c + 2; c++) for (let r = zeileVon(k, 2); r < k.nz; r++) k.mat[r * k.nx + c] = MAT.LUFT;
    k.version++;
    void g;
    kSchritt(k, RUHE, 1);
    expect(t.fall).toBeDefined();
    abschliessen(k);
    expect(t.fall).toBeUndefined();
    expect(t.liegt || t.weg).toBe(true);
    if (!t.weg) {
      // unten am Fuß, nahe dem Meeresspiegel — nicht mitten am Hang hängen geblieben
      expect(zVon(k, t.r)).toBeLessThan(oben - 20);
      expect(zVon(k, t.r)).toBeLessThan(6);
      expect(t.neigung).toBeGreaterThan(0); // Krone zum Meer
    }
  });

  it("wird der Schutt unter einem liegenden Stamm weggespült, fällt er weiter", () => {
    const k = neuesKliff("kreide");
    const t = k.baeume[0];
    // Stamm auf einem Schuttsockel in 4 m Höhe vor der Wand
    const c = spalteVon(k, 50);
    for (let r = 0; r <= zeileVon(k, 4); r++) { k.mat[r * k.nx + c] = MAT.SCHUTT; k.herk[r * k.nx + c] = MAT.KREIDE; }
    t.c = c; t.r = zeileVon(k, 4); t.liegt = true; t.tot = k.stunde; t.neigung = 1.4;
    // Sockel weg (Brandung), ohne dass Schutt nachrutscht
    for (let r = zeileVon(k, 0.5); r <= zeileVon(k, 4); r++) k.mat[r * k.nx + c] = MAT.LUFT;
    k.version++;
    kSchritt(k, RUHE, 1);
    expect(t.fall).toBeDefined();
    abschliessen(k);
    expect(t.weg || zVon(k, t.r) < 1.5).toBe(true);
  });

  it("umgestürzte Bäume verrotten nach einigen Jahren", () => {
    const k = neuesKliff("kreide");
    const t = k.baeume[0];
    t.liegt = true;
    t.tot = k.stunde - 5 * 8766;
    kSchritt(k, RUHE, 1);
    expect(t.weg).toBe(true);
  });
});

describe("Trefferzonen der Begriffe", () => {
  it("die Kreide-Zone deckt die weiße Wand ab, die Abbruchkante den oberen Teil", () => {
    const k = neuesKliff("kreide");
    const liste = kBegriffe(k, 0);
    const kreide = liste.find(b => b.id === "s" + MAT.KREIDE)!;
    const kante = liste.find(b => b.id === "kante")!;
    const x = kliffKante(k);
    // 10 m hinter der Wand auf halber Höhe: das ist Kreide
    expect(zonenAbstand(kreide, x + 10, 20)).toBeLessThanOrEqual(1);
    expect(zonenAbstand(kreide, x + 3, 8)).toBeLessThanOrEqual(1);
    // 4 m unter der Kante, dicht an der Wand: das ist die Abbruchkante
    const oben = zVon(k, geometrie(k).top[spalteVon(k, x) + 4]);
    expect(zonenAbstand(kante, x + 1, oben - 4)).toBeLessThanOrEqual(1);
  });
});
