/**
 * Gekürzte Code-Schnipsel für »Genauer hinschauen«. Sie entsprechen den
 * echten Rechenkernen in lib/spielalgo bzw. lib/regeln, nur ohne Zeichnen
 * und Sonderfälle. Achtung: keine Backslashes und kein Dollar-Klammer-Paar in
 * den Texten, sonst macht das Template-Literal etwas anderes daraus.
 */

export interface Schnipsel { name: string; text: string; datei: string }

export const CODE_LABYRINTH: Schnipsel[] = [
  {
    name: "Backtracker", datei: "lib/regeln/labyrinth.ts",
    text: `const stapel = [start];
besucht[start] = true;
while (stapel.length > 0) {
  const zelle = stapel[stapel.length - 1];     // oben auf dem Stapel
  const frei = unbesuchteNachbarn(zelle);
  if (frei.length > 0) {
    const nach = zufaellig(frei);
    wandEinreissen(zelle, nach);
    besucht[nach] = true;
    stapel.push(nach);                         // vorwärts
  } else {
    stapel.pop();                              // Sackgasse: zurück
  }
}`,
  },
  {
    name: "Prim", datei: "lib/regeln/labyrinth.ts",
    text: `nimm(start);                       // start gehört dazu, Nachbarn kommen in den Rand
while (rand.length > 0) {
  const zelle = zieheZufaellig(rand); // irgendeine Randzelle, nicht die neueste
  const alt = zufaellig(nachbarnImLabyrinth(zelle));
  wandEinreissen(zelle, alt);
  nimm(zelle);                       // ihre freien Nachbarn kommen in den Rand
}`,
  },
  {
    name: "Kruskal", datei: "lib/regeln/labyrinth.ts",
    text: `// jede Zelle ist eine eigene Insel
for (const zelle of alleZellen) insel[zelle] = zelle;

for (const wand of gemischt(alleWaende)) {
  const [a, b] = zellenAnDerWand(wand);
  if (wurzel(a) !== wurzel(b)) {   // verschiedene Inseln?
    wandEinreissen(a, b);
    vereinige(a, b);               // jetzt eine Insel
  }                                // sonst gäbe es einen Rundweg
}`,
  },
  {
    name: "Wilson", datei: "lib/regeln/labyrinth.ts",
    text: `imLabyrinth[zufallsZelle()] = true;
while (nochZellenDraussen()) {
  let pfad = [zufallsZelleDraussen()];
  // Zufallsspaziergang, bis er das Labyrinth trifft
  while (!imLabyrinth[letzte(pfad)]) {
    const nach = zufaellig(nachbarn(letzte(pfad)));
    const schonDa = pfad.indexOf(nach);
    if (schonDa >= 0) pfad = pfad.slice(0, schonDa + 1); // Schleife löschen
    else pfad.push(nach);
  }
  wegEinreissen(pfad);            // der Spaziergang wird fest
}`,
  },
  {
    name: "Growing Tree (eigener)", datei: "lib/spielalgo/wachsenderBaum.ts",
    text: `const liste = [start];
while (liste.length > 0) {
  // Regler »neueste«: 1 = Backtracker, 0 = wie Prim
  const i = zufall() < neueste ? liste.length - 1
                               : Math.floor(zufall() * liste.length);
  const zelle = liste[i];
  const frei = unbesuchteNachbarn(zelle);
  if (frei.length === 0) { liste.splice(i, 1); continue; }
  // Gewichte: geradeaus weiter? waagrecht oder senkrecht?
  const gewicht = frei.map(r =>
    (r === herkunft[zelle] ? 1 + 8 * geradeaus : 1) *
    (r.waagrecht ? 2 * waagrecht : 2 * (1 - waagrecht)));
  const nach = zieheNachGewicht(frei, gewicht);
  wandEinreissen(zelle, nach);
  liste.push(nach);
}`,
  },
];

export const CODE_BSP: Schnipsel[] = [{
  name: "Teilen, füllen, verbinden", datei: "lib/spielalgo/bsp.ts",
  text: `// 1. Teilen (Ebene für Ebene)
for (const stueck of warteschlange) {
  if (stueck.tiefe >= maxTiefe || zuKlein(stueck)) continue;
  const senkrecht = regel === "laenger" ? stueck.b > stueck.h
                  : regel === "abwechselnd" ? stueck.tiefe % 2 === 0
                  : zufall() < 0.5;
  const pos = mitte(stueck) +/- streuung;   // wo geschnitten wird
  stueck.kinder = schneide(stueck, senkrecht, pos);
  warteschlange.push(...stueck.kinder);
}
// 2. Füllen: in jedes Blatt ein Raum mit 1 Feld Rand
for (const blatt of blaetter) blatt.raum = zufallsRechteck(blatt, fuellung);
// 3. Verbinden: von unten nach oben die beiden Kinder
for (const knoten of innereKnotenTiefsteZuerst) {
  const [a, b] = naechstesRaumpaar(knoten.kinder[0], knoten.kinder[1]);
  gaenge.push(gangForm === "L" ? lGang(a, b) : zGang(a, b));
}
// 4. Rundgänge: ein paar nahe Räume zusätzlich verbinden
for (let i = 0; i < rundgaenge; i++) gaenge.push(gang(...naechstesFreiesPaar()));`,
}];

export const CODE_HOEHLE: Schnipsel[] = [{
  name: "Eine Runde", datei: "lib/spielalgo/hoehle.ts",
  text: `function runde(feld, geburt, ueberleben) {
  const neu = new Feld();               // alle gleichzeitig: erst lesen, dann schreiben
  for (const zelle of feld) {
    const n = zaehleFelsNachbarn(zelle); // 8, 4 oder 24 Nachbarn
    if (feld[zelle] === FELS) neu[zelle] = ueberleben.includes(n) ? FELS : FREI;
    else                      neu[zelle] = geburt.includes(n)     ? FELS : FREI;
  }
  return neu;
}

// danach: Flutfüllung findet getrennte Höhlen
for (const zelle of freieZellen)
  if (!nummer[zelle]) fuelle(zelle, naechsteNummer++); // alles Erreichbare bekommt dieselbe Nummer`,
}];

export const CODE_VERTEILEN: Schnipsel[] = [
  {
    name: "Poisson-Disc (Bridson)", datei: "lib/spielalgo/verteilen.ts",
    text: `setze(zufallsPunkt());                     // auch: aktiv.push(...)
while (aktiv.length > 0) {
  const mitte = zufaellig(aktiv);
  let gefunden = false;
  for (let versuch = 0; versuch < k; versuch++) {          // k = 30
    const winkel = zufall() * 2 * Math.PI;
    const abstand = r * (1 + zufall() * (ring - 1));     // zwischen r und ring·r
    const p = mitte + richtung(winkel) * abstand;
    if (genugPlatz(p)) { setze(p); gefunden = true; break; }
  }
  if (!gefunden) entferne(aktiv, mitte);  // umzingelt: inaktiv
}

function genugPlatz(p) {
  // nur die Nachbarkästchen im Hilfsgitter prüfen, nicht alle Punkte
  return nahePunkte(p).every(q => abstand(p, q) >= Math.max(r(p), r(q)));
}`,
  },
  {
    name: "Voronoi und Lloyd", datei: "lib/spielalgo/verteilen.ts",
    text: `// Voronoi: jedes Pixel gehört dem nächsten Punkt
for (const pixel of bild)
  besitzer[pixel] = minIndex(punkte, p => abstand(p, pixel)); // euklid, manhattan, ...

// Lloyd: jeden Punkt in den Schwerpunkt seiner Zelle schieben
const summe = punkte.map(() => ({ x: 0, y: 0, n: 0 }));
for (const pixel of bild) summe[besitzer[pixel]] += pixel;
punkte = summe.map(s => ({ x: s.x / s.n, y: s.y / s.n }));`,
  },
];

export const CODE_GELAENDE: Schnipsel[] = [{
  name: "Oktaven und Warping", datei: "lib/spielalgo/rauschen.ts",
  text: `function fbm(x, y) {
  let summe = 0, staerke = 1, feinheit = 1, norm = 0;
  for (let o = 0; o < oktaven; o++) {
    let n = rauschen(x * feinheit, y * feinheit);   // −1 .. 1
    if (form === "grat")   n = 1 - 2 * Math.abs(n); // scharfe Bergrücken
    if (form === "wolken") n = 2 * Math.abs(n) - 1; // runde Kuppen
    summe += staerke * n;
    norm += staerke;
    staerke *= persistenz;      // z. B. 0,5: jede Oktave halb so stark
    feinheit *= lakunaritaet;   // z. B. 2:   jede Oktave doppelt so fein
  }
  return summe / norm;
}

function hoehe(x, y) {
  // Domain Warping: erst die Koordinaten verbiegen, dann nachschauen
  const qx = fbm(x + 5.2, y + 1.3), qy = fbm(x + 9.7, y + 2.8);
  let h = (fbm(x + warp * qx, y + warp * qy) + 1) / 2;
  if (insel) h = h * (1 - d * d) + ...;  // d = Abstand zur Mitte
  return h;
}`,
}];

export const CODE_WEGE: Schnipsel[] = [
  {
    name: "A* (Dijkstra, Greedy)", datei: "lib/spielalgo/wege.ts",
    text: `g[start] = 0;
offen.rein(start, prio(start));
while (offen.laenge > 0) {
  const feld = offen.raus();              // kleinste Priorität zuerst
  if (feld === ziel) return wegZurueck(ziel);
  fertig[feld] = true;
  for (const [nb, schritt] of nachbarn(feld, diagonal)) {
    if (wand(nb) || fertig[nb]) continue;
    const neuG = g[feld] + kosten[nb] * schritt;   // schräg: ×1,4
    if (neuG < g[nb]) { g[nb] = neuG; vorher[nb] = feld; offen.rein(nb, prio(nb)); }
  }
}

// nur hier unterscheiden sich die drei:
const prio = feld =>
  art === "dijkstra" ? g[feld]
  : art === "greedy" ? h(feld)
  : g[feld] + gewicht * h(feld);    // A*: gewicht 1 = klassisch`,
  },
  {
    name: "Flowfield", datei: "lib/spielalgo/wege.ts",
    text: `// 1. Dijkstra rückwärts: vom Ziel aus über das ganze Feld
abstand.fill(Infinity);
abstand[ziel] = 0;
dijkstraVon(ziel);                 // jedes Feld kennt jetzt seine Kosten bis zum Ziel

// 2. In jedes Feld einen Pfeil zum billigsten Nachbarn
for (const feld of alleFelder)
  pfeil[feld] = argmin(achtNachbarn(feld), nb => abstand[nb]);

// 3. Jede Figur schaut nur auf den Pfeil unter sich
figur.position += richtung(pfeil[feldUnter(figur)]) * tempo / kosten;`,
  },
];

export const CODE_ZYKLUS: Schnipsel[] = [
  {
    name: "Regeln als Ersetzungen", datei: "lib/spielalgo/zyklisch.ts",
    text: `// Graph-Grammatik: jede Regel ersetzt ein Muster durch ein größeres
Regel 1:  (leer)        →  Start      Ziel
Regel 2:  Start  Ziel   →  Start ─ A ─ Ziel        (langer Bogen)
                           Start ─ B ─ Ziel        (kurzer Bogen, z. B. mit 🔒)
Regel 3:  X ─ Y         →  X ─ neu ─ Y             (Weg verlängern)
Regel 4:  X ─ Y         →  X ─ Y  und  X ┄ 💎 ─ Y   (Nebenschleife, ┄ = nur Sicht)
Regel 5:  Raum          →  🌿 / 🧩 / ⚔️             (Tempo nach Abstand vom Start)

// Prüfen: Breitensuche, erst ohne, dann mit Schlüssel
const ohne = erreichbar(start, { tuerOffen: false });
const mit  = erreichbar(start, { tuerOffen: true });
lösbar = ohne.has(ziel) || (ohne.has(schluessel) && mit.has(ziel));`,
  },
  {
    name: "Graph → Karte", datei: "lib/spielalgo/zyklisch.ts",
    text: `// 1. Knoten auf das Raster legen, Räume nicht überlappen lassen
for (const knoten of graph.knoten) {
  let raum = rechteckUm(rasterLage(knoten), groesse);
  while (stoesstAn(raum)) raum = kleinerOderDaneben(raum);
}
// 2. Jede Kante wird ein Gang: A* sucht einen Weg,
//    fremde Räume und Gänge (mit 1 Feld Abstand) sind tabu
for (const kante of graph.kanten) {
  const gang = aStern(raum[kante.a], raum[kante.b], tabu);
  if (kante.art === "tuer")  setzeAmEnde(gang, TUER);
  if (kante.art === "sicht") setzeAmEnde(gang, GITTER);
}
// 3. Höhlenform: Fels mit wenig Fels rundum wird frei –
//    aber nie, wenn er zwei getrennte Bereiche verbinden würde
for (let r = 0; r < runden; r++) annagen();`,
  },
];
