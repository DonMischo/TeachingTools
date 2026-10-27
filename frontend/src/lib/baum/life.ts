// @ts-nocheck
/* eslint-disable */
// Baumleben: aus der eigenständigen Fassung übernommen, ungeprüftes JavaScript.
import { BL } from "./bl";
/* Lebenslauf: das ganze Baumleben wird beim Ändern der Parameter vorausberechnet; die Zeitleiste spielt es ab. */
BL.Life = (function () {
  const SPECIES = {
    buche: { name: "Rotbuche", Hmax: 38, Dmax: 95, k: .022, p: 1.25, life: 300, shade: .9, drought: .7, fruit: 50, decay: 45, conifer: false, heart: false, root: "herz", interc: .18, seedling: "epigäisch", germ: "Bucheckern keimen epigäisch: zwei breite, nierenförmige Keimblätter kommen ans Licht." },
    stieleiche: { name: "Stieleiche", Hmax: 35, Dmax: 150, k: .016, p: 1.2, life: 600, shade: .3, drought: .4, fruit: 60, decay: 90, conifer: false, heart: true, root: "pfahl", interc: .15, seedling: "hypogäisch", germ: "Eicheln keimen hypogäisch: Die Keimblätter bleiben als Nahrungsvorrat in der Eichel im Boden." },
    fichte: { name: "Gemeine Fichte", Hmax: 42, Dmax: 80, k: .028, p: 1.3, life: 250, shade: .7, drought: 1, fruit: 40, decay: 35, conifer: true, heart: false, root: "flach", interc: .3, seedling: "epigäisch", germ: "Fichtensamen keimen mit einem Kranz aus 6–9 nadelförmigen Keimblättern." },
    waldkiefer: { name: "Waldkiefer", Hmax: 30, Dmax: 70, k: .03, p: 1.15, life: 320, shade: .15, drought: .3, fruit: 25, decay: 45, conifer: true, heart: true, root: "pfahl", interc: .25, seedling: "epigäisch", pine: true, germ: "Kiefernsamen keimen mit einem Kranz aus 4–7 Keimnadeln. Kiefern brauchen viel Licht." },
    birke: { name: "Hänge-Birke", Hmax: 26, Dmax: 45, k: .06, p: 1.1, life: 110, shade: .1, drought: .6, fruit: 15, decay: 15, conifer: false, heart: false, root: "herz", interc: .12, seedling: "epigäisch", birch: true, germ: "Die winzigen Birkensamen keimen nur auf offenem Boden mit viel Licht." }
  };
  const STAGES = [
    { n: "Samen", d: "Der Samen enthält einen Embryo und Speicherstoffe (Stärke, Fette, Eiweiße). Über den Winter ruht er. Kälte baut keimhemmende Stoffe ab (Stratifikation), so keimt er erst im Frühjahr." },
    { n: "Keimling", d: "Der Samen nimmt Wasser auf und quillt. Enzyme bauen die Speicherstoffe ab. Zuerst wächst die Keimwurzel nach unten (positiver Gravitropismus), dann der Spross zum Licht." },
    { n: "Sämling", d: "Die ersten echten Blätter übernehmen die Fotosynthese, die Speicherstoffe sind verbraucht. Größte Gefahren: Schatten, Trockenheit, Mäuse und Rehe, die Knospen abbeißen (Verbiss)." },
    { n: "Jungbaum", d: "Das Höhenwachstum hat Vorrang, es geht um Licht. Im dichten Wald sterben dabei die meisten Jungbäume ab (Selbstdurchforstung). Unten sterben beschattete Äste ab, der Stamm wird astfrei." },
    { n: "Reifer Baum", d: "Der Baum ist mannbar: Er blüht und bildet Samen. In Mastjahren fruchten alle Bäume einer Art gleichzeitig sehr stark. Dann fehlt Zucker für das Dickenwachstum, der Jahresring bleibt schmal." },
    { n: "Altbaum", d: "Das Wachstum lässt nach, die Krone lichtet sich, Äste sterben ab. Über Wunden dringen Pilze ein, Spechte zimmern Höhlen. Ökologisch ist das die wertvollste Phase: ein Biotopbaum." },
    { n: "Totholz, stehend", d: "Der Baum ist tot und doch voller Leben. Pilze bauen Cellulose und Lignin ab, Käferlarven fressen Gänge, Spechte suchen nach ihnen." },
    { n: "Totholz, liegend", d: "Der Stamm liegt am Boden und speichert Wasser wie ein Schwamm. Etwa ein Fünftel aller Waldarten ist auf Totholz angewiesen: Käfer, Pilze, Moose, Amphibien." },
    { n: "Humus", d: "Destruenten wie Pilze, Bakterien, Regenwürmer und Springschwänze zerlegen den Rest zu Humus und Mineralstoffen. Die Nährstoffe nutzen neue Pflanzen: Der Kreislauf schließt sich." }
  ];
  // Bewohner: Stufen-Bereich [von, bis], Zone, optional nur für bestimmte Arten
  const DWELLERS = [
    { n: "Rötelmaus", e: "🐭", z: "boden", s: [0, 2], r: "frisst Samen und Keimlinge" },
    { n: "Eichelhäher", e: "🐦", z: "boden", s: [0, 0], sp: ["stieleiche", "buche"], r: "versteckt Samen im Boden und pflanzt so neue Bäume" },
    { n: "Mykorrhizapilze", e: "🍄", z: "wurzel", s: [1, 5], r: "Partner: liefern Wasser und Nährsalze, bekommen Zucker" },
    { n: "Reh", e: "🦌", z: "boden", s: [2, 3], r: "verbeißt Knospen junger Bäume" },
    { n: "Regenwürmer", e: "🪱", z: "wurzel", s: [1, 8], r: "lockern den Boden, ziehen Laub in die Erde" },
    { n: "Blattläuse", e: "🐜", z: "krone", s: [3, 5], r: "saugen Zuckersaft aus dem Phloem" },
    { n: "Marienkäfer", e: "🐞", z: "krone", s: [3, 5], r: "frisst Blattläuse" },
    { n: "Raupen von Nachtfaltern", e: "🐛", z: "krone", s: [3, 5], r: "fressen Blätter, Futter für Meisen" },
    { n: "Buchfink", e: "🐦", z: "krone", s: [3, 5], r: "nistet in der Krone" },
    { n: "Eichhörnchen", e: "🐿️", z: "krone", s: [4, 5], r: "baut Kobel, frisst und versteckt Samen" },
    { n: "Wildschwein", e: "🐗", z: "boden", s: [4, 5], sp: ["stieleiche", "buche"], r: "frisst in Mastjahren Eicheln und Bucheckern" },
    { n: "Fichtenkreuzschnabel", e: "🐦", z: "krone", s: [4, 5], sp: ["fichte", "waldkiefer"], r: "holt mit gekreuztem Schnabel Samen aus Zapfen" },
    { n: "Rote Waldameise", e: "🐜", z: "boden", s: [4, 6], sp: ["fichte", "waldkiefer"], r: "baut Hügel aus Nadeln, frisst Schadinsekten" },
    { n: "Flechten und Moose", e: "🌿", z: "stamm", s: [4, 7], r: "wachsen auf der Rinde, Zeiger für saubere Luft" },
    { n: "Buntspecht", e: "🐦", z: "stamm", s: [4, 6], r: "zimmert Höhlen, sucht Larven" },
    { n: "Kleiber", e: "🐦", z: "hoehle", s: [5, 6], r: "nutzt Spechthöhlen, verklebt den Eingang mit Lehm" },
    { n: "Schwarzspecht", e: "🐦", z: "stamm", s: [5, 6], sp: ["buche", "waldkiefer", "fichte"], r: "zimmert große Höhlen für viele Nachmieter" },
    { n: "Hohltaube", e: "🕊️", z: "hoehle", s: [5, 6], sp: ["buche"], r: "brütet in Schwarzspechthöhlen" },
    { n: "Waldkauz", e: "🦉", z: "hoehle", s: [5, 6], r: "brütet in großen Baumhöhlen" },
    { n: "Fledermäuse", e: "🦇", z: "hoehle", s: [5, 6], r: "schlafen tagsüber in Höhlen und Rindenspalten" },
    { n: "Buchdrucker (Borkenkäfer)", e: "🪲", z: "stamm", s: [5, 6], sp: ["fichte"], r: "frisst unter der Rinde, tötet geschwächte Fichten" },
    { n: "Zunderschwamm", e: "🍄", z: "stamm", s: [5, 7], sp: ["buche", "birke"], r: "Weißfäule-Pilz, zersetzt Holz" },
    { n: "Schwefelporling", e: "🍄", z: "stamm", s: [5, 7], sp: ["stieleiche"], r: "Braunfäule-Pilz am Stamm" },
    { n: "Birkenporling", e: "🍄", z: "stamm", s: [5, 7], sp: ["birke"], r: "zersetzt kranke und tote Birken" },
    { n: "Hallimasch", e: "🍄", z: "wurzel", s: [5, 7], r: "befällt Wurzeln geschwächter Bäume" },
    { n: "Alpenbock", e: "🪲", z: "stamm", s: [6, 7], sp: ["buche"], r: "Larven leben in besonntem Buchentotholz" },
    { n: "Hirschkäfer-Larve", e: "🪲", z: "wurzel", s: [6, 7], sp: ["stieleiche"], r: "lebt bis zu 5–8 Jahre im morschen Holz" },
    { n: "Holzwespen", e: "🐝", z: "stamm", s: [6, 6], sp: ["fichte", "waldkiefer"], r: "Larven bohren im Nadelholz" },
    { n: "Feuersalamander", e: "🦎", z: "totholz", s: [7, 7], r: "versteckt sich unter feuchtem Totholz" },
    { n: "Asseln und Tausendfüßer", e: "🐛", z: "totholz", s: [7, 8], r: "zerkleinern morsches Holz" },
    { n: "Schleimpilze", e: "🟡", z: "totholz", s: [7, 7], r: "fressen Bakterien auf feuchtem Holz" },
    { n: "Springschwänze und Bakterien", e: "🦠", z: "boden", s: [8, 8], r: "machen aus Resten Humus" }
  ];
  const EVENT_TXT = {
    duerre: "Dürrejahr: Spaltöffnungen bleiben geschlossen, wenig Fotosynthese, schmaler Jahresring",
    nass: "Feuchtes Jahr: gute Wasserversorgung, breiter Jahresring",
    frost: "Spätfrost: junge Blätter erfrieren, der Baum muss neu austreiben",
    mast: "Mastjahr: sehr viele Samen, wenig Zucker bleibt fürs Holz",
    kaefer: "Borkenkäferbefall nach Trockenheit",
    sturm: "Sturm: Äste brechen ab",
    verbiss: "Reh verbeißt die Endknospe: Höhenwachstum verzögert",
    nachbar: "Ein Nachbarbaum fällt: plötzlich mehr Licht"
  };

  let root, cv, ctx, ringCv, ringCtx, sparkCv, sparkCtx, W = 600, Hc = 460;
  let params = BL.store.get("lifeParams", { sp: "buche", rain: 800, soil: 1, light: 1, seed: 7 });
  let sim, skel, t = -0.6, playing = false, last = 0, showFlow = true, showMyc = true, colors = {};
  // speed 0 = Jahreszeiten (ein Jahr dauert YEAR_S Sekunden), sonst Jahre pro Sekunde bei fester Jahreszeit
  let speed = BL.store.get("lifeSpeed", 0), real = BL.store.get("lifeReal", true), dayOn = BL.store.get("lifeDay", true);
  let dayT = 10 / 24, acc = 0, sFix = 0, sunXNow = -.6, fgCv, fgCtx, phX = 0, phP = 0, lastFlow = 0;
  const YEAR_S = 20, DAY_S = 36, SEASON_AT = [.1, .35, .63, .85];
  const frac = x => ((x % 1) + 1) % 1;
  // Beim Springen über Jahre und beim Ziehen am Regler bleibt die Jahreszeit stehen
  const holdSeason = () => { acc = Math.floor(t); sFix = frac(t); };

  // ---------- Modell ----------
  function simulate() {
    const S = SPECIES[params.sp], r = BL.rng(params.seed * 97 + params.sp.length);
    const soilF = [.75, .92, 1.05][params.soil];
    const rainF = BL.clamp(1 - S.drought * Math.max(0, (800 - params.rain) / 800) * 1.4 + Math.max(0, params.rain - 800) / 4000, .25, 1.12);
    const years = []; let ae = 0, V = 1, D = 0, Hh = 0, alive = true, deathAge = null, cause = "", neighborGap = 0;
    const lifeEnd = S.life * (.9 + r() * .25);
    for (let a = 0; a < 1200 && alive; a++) {
      let ev = null, f = rainF * soilF;
      const x = r();
      if (x < .08 + Math.max(0, (700 - params.rain) / 2500)) ev = "duerre";
      else if (x < .16) ev = "nass";
      else if (x < .2 && !S.conifer) ev = "frost";
      else if (x < .24 && a > 30) ev = "sturm";
      if (a >= S.fruit && !ev && r() < (S.conifer ? .18 : .15)) ev = "mast";
      if (a >= 2 && a < 12 && !ev && r() < .12) ev = "verbiss";
      if (params.light === 2 && !ev && a > 5 && r() < .03) { ev = "nachbar"; neighborGap = 12; }
      // Licht: im Wald unter dem Kronendach stark gedämpft, je nach Schattentoleranz
      let light = 1;
      if (params.light === 1) light = .85;
      if (params.light === 2) {
        const under = BL.clamp(1 - Hh / 26, 0, 1);
        light = 1 - under * (1 - (.18 + .6 * S.shade));
        if (neighborGap > 0) { light = Math.max(light, .85); neighborGap--; }
      }
      if (ev === "duerre") f *= .45; if (ev === "nass") f *= 1.12; if (ev === "frost") f *= .75;
      if (ev === "mast") f *= .65; if (ev === "verbiss") f *= .5;
      f *= light * (.4 + .6 * V);
      // Vitalität
      let stress = 0;
      if (ev === "duerre") stress += .22 * S.drought + (a > 40 ? .05 : 0);
      if (light < .4) stress += .06 * (.4 - light) / .4;
      if (ev === "sturm") stress += S.conifer && S.root === "flach" ? .25 : .12;
      if (S.conifer && !S.pine && ev === "duerre" && a > 40 && r() < .45) { ev = "kaefer"; stress += .45; }
      if (a > lifeEnd * .75) stress += .02 + .25 * Math.pow((a - lifeEnd * .75) / (lifeEnd * .25), 3);
      V = BL.clamp(V - stress + .07, 0, 1);
      ae += BL.clamp(f, .05, 1.2);
      const Hn = S.Hmax * Math.pow(1 - Math.exp(-S.k * ae), S.p) * (.75 + .25 * soilF);
      const Dn = S.Dmax * Math.pow(1 - Math.exp(-S.k * .75 * ae), S.p * 1.05) * (.7 + .3 * soilF) + .2 * Math.min(1, a / 3);
      const ring = Math.max(.15, (Dn - D) / 2 * 10); // mm
      D = D + ring / 5; Hh = Math.max(Hh, Hn);
      const LA = (S.conifer ? 1.2 : .9) * Math.pow(D, 1.6) * (.5 + .5 * V);
      const crownR = Math.max(.08, .15 * Math.pow(D, .9) * (params.light === 0 ? 1.25 : params.light === 1 ? 1 : .8));
      const bioAbove = .12 * Math.pow(D, 2.4), bio = bioAbove * 1.25;
      const leafMass = LA * (S.conifer ? .15 : .06);
      const prev = years[years.length - 1];
      const dBio = Math.max(0, bio - (prev ? prev.bio : 0));
      const litter = S.conifer ? leafMass / 5 : leafMass;
      const fruitMass = ev === "mast" ? leafMass * .35 : a >= S.fruit ? leafMass * .05 : 0;
      const npp = dBio + litter * 2 + fruitMass;
      const seasonDays = S.conifer ? 200 : 150;
      const transp = LA * .5 * seasonDays * (ev === "duerre" ? .55 : 1) * Math.min(1, rainF);
      const co2net = npp * 1.83, co2gross = co2net * 2;
      const N = dBio * 2 + litter * 25 * .5 + fruitMass * 15;
      years.push({
        a, ev, H: Hh, D, ring, V, LA, crownR, bio, co2: bio * .5 * 3.67, npp, co2gross, co2net, o2: co2net * 32 / 44,
        transp, rainCrown: params.rain * Math.PI * crownR * crownR, h2oPs: co2gross * 18 / 44,
        nut: { N, P: N * .1, K: N * .55, Ca: N * .6, Mg: N * .1 }, litterN: litter * 25 * .5, light
      });
      if (V <= 0 || a >= lifeEnd) {
        alive = false; deathAge = a;
        cause = V <= 0 ? (ev === "kaefer" ? "Borkenkäfer nach Dürre" : ev === "sturm" ? "Sturmschaden" : light < .4 ? "Lichtmangel im Unterstand" : "Stress durch Trockenheit") : "Altersschwäche, Pilze im Holz";
        if (S.conifer && S.root === "flach" && ev === "sturm" && V <= 0) cause = "Windwurf (Flachwurzler)";
      }
    }
    const S2 = SPECIES[params.sp];
    return { years, deathAge, cause, decay: S2.decay, end: deathAge + S2.decay + 4, S: S2 };
  }

  function stageAt(tt) {
    if (tt < 0) return 0;
    if (tt < 1) return 1;
    const a = Math.floor(tt), d = sim.deathAge;
    if (a > d) { const s = (tt - d) / sim.decay; return s < .3 ? 6 : s < 1 ? 7 : 8; }
    const y = sim.years[Math.min(a, sim.years.length - 1)];
    if (y.H < 1.3 && a < 15) return 2;
    if (a < sim.S.fruit) return 3;
    if (a < sim.S.life * .6 && a < d - 25) return 4;
    return 5;
  }
  const seasonName = f => ["Frühling", "Sommer", "Herbst", "Winter"][Math.floor(((f % 1) + 1) % 1 * 4)];

  // ---------- Baumgerüst (Einheitshöhe 1) ----------
  function buildSkeleton() {
    const S = SPECIES[params.sp], r = BL.rng(params.seed * 31 + 5);
    const model = BL.TreeGen.build(params.sp, params.seed, params.light);
    // Wurzeln (Einheit: Baumhöhe)
    // Jede Wurzel ist eine geschwungene, sich verjüngende Linie. Winkel a: 0 = senkrecht nach unten, ±π/2 = waagerecht.
    // y ist negativ (Tiefe); keine Wurzel darf über die Bodenoberfläche wachsen.
    const roots = [], RT = S.root;
    const grow = (x, y, a, len, w, d, target, grav, kind) => {
      const pts = [[x, y]], steps = Math.max(5, Math.round(len / .005)), st = len / steps;
      roots.push({ pts, w, d, kind });
      for (let i = 1; i <= steps; i++) {
        a += (target - a) * grav + (r() - .5) * .22;
        a = BL.clamp(a, -1.52, 1.52);
        x += Math.sin(a) * st; y -= Math.cos(a) * st;
        if (y > -.004) { y = -.004; a = Math.sign(a || 1) * 1.45; }
        pts.push([x, y]);
        const f = i / steps, wNow = w * (1 - f * .75);
        if (d >= 3 || i >= steps - 1) continue;
        const side = r() < .5 ? -1 : 1;
        if (kind === "tap" && r() < .3) {
          // Seitenwurzeln der Pfahlwurzel: oben lang und flach, nach unten kürzer
          const ca = side * (1.05 + r() * .4);
          grow(x, y, ca, (.22 * (1 - f * .8)) * (.6 + r() * .5), wNow * .45, d + 1, side * 1.15, .06, "lat");
        } else if (kind === "heart" && r() < .14) {
          grow(x, y, a + side * (.55 + r() * .3), len * (1 - f) * (.35 + r() * .3), wNow * .5, d + 1, a + side * .3, .05, "lat");
        } else if (kind === "plate" && r() < .09) {
          // Senkerwurzeln hängen vom Tellerrand senkrecht nach unten
          grow(x, y, (r() - .5) * .3, .025 + r() * .035, wNow * .4, d + 1, 0, .3, "sink");
        } else if ((kind === "plate" || kind === "lat") && r() < .1) {
          grow(x, y, a + side * (.5 + r() * .4), len * (1 - f) * (.3 + r() * .3), wNow * .5, d + 1, a + side * .25, .04, "lat");
        }
      }
    };
    if (RT === "pfahl") {
      const deep = S.pine ? .2 : .26;
      grow(0, -.002, 0, deep, 1, 0, 0, .25, "tap");
      for (const sd of [-1, 1]) grow(sd * .01, -.004, sd * 1.3, .2, .5, 1, sd * 1.3, .05, "lat");
    }
    if (RT === "herz") {
      const k = S.birch ? .75 : 1;
      for (const a of [-1.2, -.8, -.4, 0, .4, .8, 1.2]) grow(a * .015, -.003, a + (r() - .5) * .15, (.15 - Math.abs(a) * .02) * k * (.85 + r() * .3), Math.abs(a) < .1 ? .7 : .55, 0, a * 1.05, .06, "heart");
    }
    if (RT === "flach") {
      for (const a of [-1.47, -1.4, -1.32, 1.32, 1.4, 1.47]) grow(Math.sign(a) * .012, -.004, a, .2 + r() * .1, .6, 0, Math.sign(a) * 1.48, .1, "plate");
      grow(0, -.004, 0, .03, .4, 0, 0, .3, "sink");
    }
    let rMinY = 0, rMaxX = 0;
    for (const rt of roots) for (const [px, py] of rt.pts) { rMinY = Math.min(rMinY, py); rMaxX = Math.max(rMaxX, Math.abs(px)); }
    return { model, roots, rMinY, rMaxX };
  }

  // ---------- Zeichnen ----------
  function readColors() {
    colors = { sky: BL.css("--sky"), paper: BL.css("--paper"), ink: BL.css("--ink"), muted: BL.css("--muted"), soil: BL.css("--soil"),
      leaf: BL.css("--leaf"), xylem: BL.css("--xylem"), phloem: BL.css("--phloem"), gas: BL.css("--gas"), warn: BL.css("--warn"), line: BL.css("--line") };
    colors.dark = true; // alle Farbthemen der TeachingTools sind dunkel
  }
  function draw() {
    if (!ctx) return;
    const S = sim.S, st = stageAt(t), a = Math.max(0, Math.floor(t)), y = sim.years[Math.min(a, sim.years.length - 1)];
    const season = frac(t), groundY = Hc * .72;
    // Maßstab: kleine Pflanzen groß zeigen, große Bäume ganz
    const viewH = Math.max(st <= 2 ? .25 + (y ? y.H : 0) * 1.4 : 2, (y ? y.H : 0) * 1.12, st >= 6 ? sim.years[sim.deathAge].H * .8 : 0);
    const sc = (groundY - 24) / viewH; // px pro m
    const cx = W * .42;
    const sun = sunState(season);
    sunXNow = sun.day ? Math.round((sun.f - .5) * 4) / 2 : -.5;
    const scene = () => {
      // Mensch als Größenvergleich
      if (sc * 1.75 < groundY - 30 && sc * 1.75 > 18) drawPerson(cx + Math.max(60, (y ? y.crownR : 1) * sc + 40), groundY, sc * 1.75);
      if (st === 0) drawSeed(cx, groundY, sc);
      else if (st === 1) drawGerm(cx, groundY, sc, t);
      else if (st <= 5) drawTree(cx, groundY, sc, y, season, st);
      else drawDead(cx, groundY, sc, st);
      if (st >= 1 && st <= 5) drawRoots(cx, groundY, sc, y, st);
    };
    if (real) {
      // Natürlich: Himmel nach Sonnenstand, Landschaft und Baum in einer eigenen Ebene, die nachts abgedunkelt wird
      const horizon = drawSkyReal(groundY, season, y, sun);
      const main = ctx; ctx = fgCtx; ctx.clearRect(0, 0, W, Hc);
      drawLandReal(groundY, season, horizon);
      drawGroundReal(groundY, season, y, cx, st);
      if (st >= 2 && st <= 5 && tRes) {
        ctx.fillStyle = `rgba(20,30,15,${.32 * sun.light})`;
        ctx.beginPath(); ctx.ellipse(cx - sunXNow * 20, groundY + 1, Math.max(14, tRes.half * 1.05), Math.max(3, tRes.half * .08), 0, 0, 7); ctx.fill();
      }
      scene();
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = `rgba(10,18,46,${.68 * (1 - sun.light)})`; ctx.fillRect(0, 0, W, groundY + 4);
      if (sun.dusk > .05) { ctx.fillStyle = `rgba(255,130,60,${.15 * sun.dusk})`; ctx.fillRect(0, 0, W, groundY + 4); }
      ctx.globalCompositeOperation = "source-over";
      ctx = main; ctx.drawImage(fgCv, 0, 0, W, Hc);
      // Beschriftungen bleiben auf hellem Himmel lesbar
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,.65)"; ctx.shadowBlur = 3;
    } else {
      // Schema: Himmel und Boden
      const g = ctx.createLinearGradient(0, 0, 0, groundY);
      const winter = season >= .75, dry = y && y.ev === "duerre" && season >= .25 && season < .6;
      g.addColorStop(0, colors.dark ? "#0f1a24" : dry ? "#e9e1c9" : winter ? "#d9e0e6" : "#cfe3ef");
      g.addColorStop(1, colors.dark ? "#1b2a26" : dry ? "#f2ead3" : "#eef4ea");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, groundY);
      const sg = ctx.createLinearGradient(0, groundY, 0, Hc);
      sg.addColorStop(0, colors.dark ? "#3a2c20" : "#7a5c40"); sg.addColorStop(1, colors.dark ? "#211912" : "#4e3a28");
      ctx.fillStyle = sg; ctx.fillRect(0, groundY, W, Hc - groundY);
      ctx.fillStyle = colors.dark ? "#2d3b22" : winter ? "#c9cfc2" : "#7aa05a"; ctx.fillRect(0, groundY - 3, W, 5);
      ctx.save();
      scene();
    }
    drawRuler(groundY, sc);
    if (showFlow && st >= 2 && st <= 5) drawFlows(cx, groundY, sc, y, season, sun);
    drawDwellers(cx, groundY, sc, st, y);
    if (real && dayOn) {
      const hh = Math.floor(sun.hour), mm = Math.floor((sun.hour - hh) * 6) * 10;
      ctx.font = "600 12px " + BL.css("--mono"); ctx.textAlign = "right"; ctx.fillStyle = "#f4f1e8";
      ctx.fillText(`${sun.day ? "☀" : "☾"} ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")} Uhr`, W - 12, 24);
      ctx.textAlign = "left";
    }
    ctx.restore();
    // Ereignis-Hinweis
    if (y && y.ev && t >= 0 && st <= 5) {
      ctx.font = "600 13px " + BL.css("--body"); const txt = EVENT_TXT[y.ev].split(":")[0];
      const w = ctx.measureText(txt).width + 16;
      ctx.fillStyle = colors.dark ? "rgba(0,0,0,.55)" : "rgba(255,255,255,.8)"; ctx.fillRect(10, 10, w, 24);
      ctx.fillStyle = y.ev === "nass" || y.ev === "nachbar" ? colors.xylem : colors.warn; ctx.fillText(txt, 18, 27);
    }
  }
  // ---------- Natürliche Darstellung: Sonnenstand, Himmel, Landschaft, Boden ----------
  // Der Tag läuft auf eigener Uhr, unabhängig vom Wachstum. Tageslänge 8 h im Winter bis 16 h im Sommer.
  function sunState(season) {
    const d = real && dayOn ? dayT : .45;
    const dl = .5 + .167 * Math.sin(season * 2 * Math.PI), u = frac(d - (.5 - dl / 2));
    const day = u < dl, f = day ? u / dl : (u - dl) / (1 - dl);
    const alt = (day ? 1 : -1) * Math.sin(Math.PI * f);
    return { day, f, alt, light: BL.clamp((alt + .06) / .3, 0, 1), dusk: Math.exp(-Math.pow(alt / .15, 2)), peak: .5 + 1.4 * (dl - .333), hour: d * 24 };
  }
  const mixC = (a, b, k) => a.map((x, i) => Math.round(x + (b[i] - x) * k));
  const rgbS = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  function drawSkyReal(groundY, season, y, sun) {
    const winter = season >= .75, dry = y && y.ev === "duerre" && season >= .25 && season < .6;
    let top = mixC([8, 12, 32], winter ? [104, 146, 190] : [58, 124, 200], sun.light);
    let bot = mixC([26, 34, 64], winter ? [206, 220, 232] : [176, 212, 236], sun.light);
    top = mixC(top, [78, 82, 138], sun.dusk * .45); bot = mixC(bot, [246, 164, 96], sun.dusk * .75);
    if (dry) bot = mixC(bot, [236, 214, 170], .4 * sun.light);
    const g = ctx.createLinearGradient(0, 0, 0, groundY);
    g.addColorStop(0, rgbS(top)); g.addColorStop(1, rgbS(bot));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, groundY + 4);
    if (sun.light < .7) {
      const r = BL.rng(3), a0 = 1 - sun.light / .7, now = performance.now() / 700;
      for (let i = 0; i < 110; i++) {
        const x = r() * W, yy = r() * groundY * .85, s = r();
        ctx.fillStyle = `rgba(255,252,236,${a0 * (.3 + .6 * s) * (.8 + .2 * Math.sin(now + i * 1.7))})`;
        ctx.fillRect(x, yy, s > .92 ? 2 : 1, s > .92 ? 2 : 1);
      }
    }
    // Sonne bzw. Mond wandern auf einem Bogen über den Himmel
    const px = W * (.06 + .88 * sun.f), py = groundY + 6 - (groundY - 30) * Math.abs(sun.alt) * (sun.day ? sun.peak : .75);
    if (sun.day) {
      const c = mixC([255, 248, 226], [255, 168, 88], sun.dusk);
      const gl = ctx.createRadialGradient(px, py, 0, px, py, 90);
      gl.addColorStop(0, rgbS(c, .6)); gl.addColorStop(1, rgbS(c, 0));
      ctx.fillStyle = gl; ctx.fillRect(px - 90, py - 90, 180, 180);
      ctx.fillStyle = rgbS(c); ctx.beginPath(); ctx.arc(px, py, 13, 0, 7); ctx.fill();
    } else {
      const gl = ctx.createRadialGradient(px, py, 0, px, py, 50);
      gl.addColorStop(0, "rgba(220,228,255,.25)"); gl.addColorStop(1, "rgba(220,228,255,0)");
      ctx.fillStyle = gl; ctx.fillRect(px - 50, py - 50, 100, 100);
      ctx.fillStyle = "#e9edf4"; ctx.beginPath(); ctx.arc(px, py, 10, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(150,160,180,.45)";
      for (const [mx, my, mr] of [[-3, -2, 2.4], [3, 3, 1.8], [2, -4, 1.2]]) { ctx.beginPath(); ctx.arc(px + mx, py + my, mr, 0, 7); ctx.fill(); }
    }
    return bot;
  }
  function drawLandReal(groundY, season, horizon) {
    const winter = season >= .78 && season < .97;
    // Hügel in Luftperspektive: je weiter weg, desto mehr Himmelsfarbe
    for (const [hh, m, col] of [[.2, .45, [86, 112, 92]], [.11, .7, [56, 92, 58]]]) {
      ctx.fillStyle = rgbS(mixC(horizon, winter ? mixC(col, [214, 222, 230], .65) : col, m));
      ctx.beginPath(); ctx.moveTo(0, groundY + 2);
      for (let x = 0; x <= W + 8; x += 8) ctx.lineTo(x, groundY - groundY * hh * (.55 + .25 * Math.sin(x / W * 5.3 + hh * 40) + .2 * Math.sin(x / W * 13.1 + hh * 9)));
      ctx.lineTo(W, groundY + 2); ctx.fill();
    }
    // Nachbarbäume im Wald oder am Waldrand, als dunstige Silhouetten im Hintergrund
    if (!params.light) return;
    const r = BL.rng(params.seed + 77), n = params.light === 2 ? 9 : 4, conif = sim.S.conifer;
    const crown = season < .12 ? [118, 168, 82] : season < .55 ? [58, 98, 50] : season < .75 ? [164, 112, 52] : null;
    for (let i = 0; i < n; i++) {
      const x = params.light === 2 ? W * (i + .5) / n + (r() - .5) * W / n * .6 : W * (.7 + i * .085 + r() * .04);
      const H = groundY * (.55 + r() * .35), tw = Math.max(3, H * .028), m = .45 + r() * .15;
      if (Math.abs(x - W * .42) < 30) continue;
      ctx.fillStyle = rgbS(mixC(horizon, [58, 46, 36], m));
      ctx.fillRect(x - tw / 2, groundY - H * .75, tw, H * .75 + 2);
      if (conif) {
        ctx.fillStyle = rgbS(mixC(horizon, [36, 66, 44], m));
        ctx.beginPath(); ctx.moveTo(x, groundY - H); ctx.lineTo(x - H * .2, groundY - H * .3); ctx.lineTo(x + H * .2, groundY - H * .3); ctx.fill();
      } else if (crown) {
        ctx.fillStyle = rgbS(mixC(horizon, crown, m));
        for (const [ox, oy, rx] of [[0, .78, .2], [-.11, .66, .15], [.12, .64, .14]]) { ctx.beginPath(); ctx.ellipse(x + ox * H, groundY - oy * H, rx * H, rx * H * .85, 0, 0, 7); ctx.fill(); }
      } else {
        ctx.strokeStyle = rgbS(mixC(horizon, [70, 56, 44], m)); ctx.lineWidth = Math.max(1, tw * .3);
        for (const a of [-.7, -.35, .3, .65]) { ctx.beginPath(); ctx.moveTo(x, groundY - H * .55); ctx.lineTo(x + Math.sin(a) * H * .25, groundY - H * .55 - Math.cos(a) * H * .35); ctx.stroke(); }
      }
    }
  }
  const HORIZONS = [[0, [46, 34, 24], "Humusauflage"], [.07, [84, 60, 40], "Oberboden"], [.38, [126, 92, 60], "Unterboden"], [.76, [146, 126, 100], "Ausgangsgestein"]];
  function drawGroundReal(groundY, season, y, cx, st) {
    const winter = season >= .8 && season < .97, dry = y && y.ev === "duerre" && season >= .25 && season < .6;
    // Bodenprofil im Anschnitt
    const D = Hc - groundY, g = ctx.createLinearGradient(0, groundY, 0, Hc);
    HORIZONS.forEach(([f, c], i) => { g.addColorStop(f, rgbS(c)); g.addColorStop(i < 3 ? HORIZONS[i + 1][0] - .03 : 1, rgbS(c)); });
    ctx.fillStyle = g; ctx.fillRect(0, groundY, W, D);
    const r = BL.rng(9);
    for (let i = 0; i < 70; i++) {
      const f = .3 + r() * .7, x = r() * W, yy = groundY + D * f, s = 1 + r() * (f > .7 ? 5 : 2.5);
      ctx.fillStyle = rgbS(mixC([126, 112, 96], [168, 156, 140], r()), .7);
      ctx.beginPath(); ctx.ellipse(x, yy, s * 1.3, s, r() * 3, 0, 7); ctx.fill();
    }
    ctx.font = "10px " + BL.css("--body"); ctx.textAlign = "right"; ctx.fillStyle = "rgba(255,240,220,.5)";
    HORIZONS.forEach(([f, , n], i) => { if (i) ctx.fillText(n, W - 8, groundY + D * f + 12); });
    ctx.textAlign = "left";
    // Grasnarbe bzw. Schneedecke
    const grass = dry ? [158, 146, 86] : season < .12 ? [104, 156, 64] : season < .55 ? [78, 128, 52] : [128, 118, 58];
    if (winter) {
      ctx.fillStyle = "#eef2f6"; ctx.beginPath(); ctx.moveTo(0, groundY + 3);
      for (let x = 0; x <= W + 10; x += 10) ctx.lineTo(x, groundY - 4 - 1.5 * Math.sin(x * .07));
      ctx.lineTo(W, groundY + 3); ctx.fill();
      return;
    }
    ctx.fillStyle = rgbS(mixC(grass, [40, 30, 20], .35)); ctx.fillRect(0, groundY - 2, W, 6);
    const rg = BL.rng(4); ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 2.5) {
      ctx.strokeStyle = rgbS(mixC(grass, [210, 220, 150], rg() * .3), .9);
      const h = 3 + rg() * 6; ctx.beginPath(); ctx.moveTo(x, groundY + 2); ctx.lineTo(x + (rg() - .5) * 4, groundY + 2 - h); ctx.stroke();
    }
    // Falllaub unter dem Baum
    if (season >= .55 && st >= 3 && st <= 5 && !sim.S.conifer && tRes) {
      const rl = BL.rng(12), w = tRes.half * 1.2;
      for (let i = 0; i < Math.min(160, w); i++) {
        ctx.fillStyle = rgbS([[160, 92, 34], [196, 140, 52], [126, 82, 40]][i % 3], .9);
        ctx.beginPath(); ctx.ellipse(cx + (rl() - .5) * 2 * w, groundY + rl() * 3, 2.2, 1.2, rl() * 3, 0, 7); ctx.fill();
      }
    }
  }
  function drawPerson(x, gy, h) {
    ctx.save(); ctx.strokeStyle = colors.muted; ctx.fillStyle = colors.muted; ctx.globalAlpha = .55; ctx.lineWidth = Math.max(1.5, h * .06);
    ctx.beginPath(); ctx.arc(x, gy - h * .9, h * .08, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, gy - h * .8); ctx.lineTo(x, gy - h * .42); ctx.moveTo(x, gy - h * .42); ctx.lineTo(x - h * .1, gy); ctx.moveTo(x, gy - h * .42); ctx.lineTo(x + h * .1, gy);
    ctx.moveTo(x - h * .16, gy - h * .62); ctx.lineTo(x, gy - h * .74); ctx.lineTo(x + h * .16, gy - h * .62); ctx.stroke();
    ctx.globalAlpha = 1; ctx.font = "11px " + BL.css("--mono"); ctx.fillText("1,75 m", x - 18, gy - h - 6); ctx.restore();
  }
  function drawRuler(gy, sc) {
    const steps = [.01, .02, .05, .1, .2, .5, 1, 2, 5, 10, 20];
    const m = steps.find(s => s * sc > 50) || 20;
    const x = W - 20; ctx.save(); ctx.strokeStyle = colors.ink; ctx.fillStyle = colors.ink; ctx.lineWidth = 1.5; ctx.globalAlpha = .7;
    ctx.beginPath(); ctx.moveTo(x, gy - 8); ctx.lineTo(x, gy - 8 - m * sc); ctx.moveTo(x - 5, gy - 8); ctx.lineTo(x + 5, gy - 8); ctx.moveTo(x - 5, gy - 8 - m * sc); ctx.lineTo(x + 5, gy - 8 - m * sc); ctx.stroke();
    ctx.font = "11px " + BL.css("--mono"); ctx.textAlign = "right";
    ctx.fillText(m >= 1 ? BL.fmt(m) + " m" : BL.fmt(m * 100) + " cm", x - 8, gy - 12 - m * sc / 2); ctx.restore();
  }
  function drawSeed(cx, gy, sc) {
    const S = sim.S, s = Math.max(6, sc * .02);
    ctx.save(); ctx.translate(cx, gy + s * .6);
    ctx.fillStyle = S.id === "stieleiche" || params.sp === "stieleiche" ? "#9a6b2f" : params.sp === "buche" ? "#7a4b2a" : "#6b5a3a";
    ctx.beginPath();
    if (params.sp === "stieleiche") { ctx.ellipse(0, 0, s * .7, s, 0, 0, 7); ctx.fill(); ctx.fillStyle = "#6e5432"; ctx.beginPath(); ctx.ellipse(0, -s * .75, s * .75, s * .35, 0, 0, 7); }
    else if (params.sp === "buche") { ctx.moveTo(0, -s); ctx.lineTo(s * .6, s * .6); ctx.lineTo(-s * .6, s * .6); ctx.closePath(); }
    else { ctx.ellipse(0, 0, s * .4, s * .25, 0, 0, 7); ctx.fill(); ctx.fillStyle = "rgba(200,180,140,.7)"; ctx.beginPath(); ctx.ellipse(s * .6, -s * .3, s * .7, s * .3, -.5, 0, 7); }
    ctx.fill(); ctx.restore();
    label(cx + 30, gy + 30, "Samen in Keimruhe (Winter)");
  }
  function drawGerm(cx, gy, sc, tt) {
    const p = BL.clamp(tt, 0, 1), S = sim.S;
    ctx.save(); ctx.strokeStyle = "#e8e0c8"; ctx.lineWidth = Math.max(2, sc * .003);
    ctx.beginPath(); ctx.moveTo(cx, gy); ctx.lineTo(cx, gy + sc * .08 * Math.min(1, p * 2)); ctx.stroke(); // Keimwurzel
    const h = sc * .07 * BL.clamp(p * 1.5 - .2, 0, 1);
    ctx.strokeStyle = "#7da35a"; ctx.lineWidth = Math.max(2, sc * .004);
    ctx.beginPath(); ctx.moveTo(cx, gy); ctx.lineTo(cx, gy - h); ctx.stroke();
    if (h > 4) {
      ctx.fillStyle = "#86b85c";
      if (S.conifer) for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * .35; ctx.strokeStyle = "#5c8f45"; ctx.beginPath(); ctx.moveTo(cx, gy - h); ctx.lineTo(cx + Math.cos(a) * sc * .02, gy - h + Math.sin(a) * sc * .02); ctx.stroke(); }
      else if (S.seedling === "hypogäisch") { ctx.beginPath(); ctx.ellipse(cx + sc * .008, gy - h, sc * .012, sc * .006, -.4, 0, 7); ctx.ellipse(cx - sc * .008, gy - h * .85, sc * .012, sc * .006, .4, 0, 7); ctx.fill(); ctx.fillStyle = "#9a6b2f"; ctx.beginPath(); ctx.ellipse(cx + 4, gy + 6, 8, 11, .3, 0, 7); ctx.fill(); }
      else { ctx.beginPath(); ctx.ellipse(cx + sc * .016, gy - h, sc * .016, sc * .009, -.15, 0, 7); ctx.ellipse(cx - sc * .016, gy - h, sc * .016, sc * .009, .15, 0, 7); ctx.fill(); }
    }
    ctx.restore();
    label(cx + 30, gy - h - 10, p < .3 ? "Quellung, Keimwurzel wächst" : S.seedling === "hypogäisch" ? "hypogäische Keimung" : "Keimblätter entfalten sich");
  }
  function label(x, y, txt) {
    ctx.save(); ctx.font = "12px " + BL.css("--body"); ctx.fillStyle = colors.ink; ctx.globalAlpha = .8; ctx.fillText(txt, Math.min(x, W - ctx.measureText(txt).width - 8), y); ctx.restore();
  }
  // Der Baum wird in eine Zwischenleinwand gezeichnet und nur neu berechnet, wenn sich Alter, Jahreszeit oder Ansicht ändern.
  let tcv = null, tKey = "", tRes = null, tTime = 0;
  const growthFrac = y => BL.clamp(y.H / (sim.S.Hmax * .97), .004, 1);
  const crownBase = y => [.16, .26, .45][params.light] * BL.clamp(y.a / 60, .2, 1);
  function blitTree(v) {
    const M = skel.model;
    if (M.pruneFor !== sim) {
      const last = sim.deathAge ?? sim.years.length - 1;
      BL.TreeGen.pruneHistory(M, sim.years.slice(0, last + 1).map(y => ({ g: growthFrac(y), cb: crownBase(y) })));
      M.pruneFor = sim; tKey = "";
    }
    const key = [W, Hc, Math.round(v.Hpx), v.g.toFixed(4), Math.round(v.season * 48), Math.round(v.trunkPx), v.cb.toFixed(2), (v.dead || 0).toFixed(2), v.snag ? 1 : 0, v.step, colors.dark, v.real ? 1 : 0, v.sunX, params.sp, params.seed, params.light].join("|");
    const now = performance.now();
    if (key !== tKey && (!playing || now - tTime > 45 || !tRes)) {
      const dpr = cv.width / W;
      if (!tcv) tcv = document.createElement("canvas");
      if (tcv.width !== cv.width || tcv.height !== cv.height) { tcv.width = cv.width; tcv.height = cv.height; }
      const tc = tcv.getContext("2d"); tc.setTransform(1, 0, 0, 1, 0, 0); tc.clearRect(0, 0, tcv.width, tcv.height); tc.setTransform(dpr, 0, 0, dpr, 0, 0);
      tRes = BL.TreeGen.render(tc, skel.model, v); tRes.v = v; tKey = key; tTime = now;
    }
    ctx.drawImage(tcv, 0, 0, W, Hc);
    return tRes;
  }
  function drawTree(cx, gy, sc, y, season, st) {
    const S = sim.S, Hpx = y.H * sc, trunkPx = Math.max(1.5, y.D / 100 * sc * 1.4);
    const dead = st === 5 ? BL.clamp((y.a - S.life * .6) / (S.life * .4), 0, .6) : 0;
    blitTree({ cx, gy, Hpx, g: growthFrac(y), season, trunkPx, cb: crownBase(y), dead, leaves: true, dark: colors.dark, real, sunX: sunXNow, step: Math.round(y.a) });
    // Höhle im Altbaum
    if (st === 5 && trunkPx > 10) { ctx.fillStyle = "#1a120b"; ctx.beginPath(); ctx.ellipse(cx, gy - Hpx * .3, trunkPx * .18, trunkPx * .24, 0, 0, 7); ctx.fill(); }
  }
  // Wurzeln in Pixel umrechnen. Sämlinge haben bei allen Arten zuerst eine Pfahlwurzel,
  // die artspezifische Form (Pfahl-, Herz-, Flachwurzel) entsteht erst mit dem Alter.
  function rootLayout(cx, gy, sc, y, st) {
    const Hpx = Math.max(y ? y.H : .05, .05) * sc, maxDepth = Hc - gy - 10, trunkPx = Math.max(1.5, (y ? y.D : .5) / 100 * sc * 1.4);
    const out = [];
    if (st <= 2) {
      const r = BL.rng(11), depth = BL.clamp(Hpx * 1.5, 24, maxDepth), pts = [[cx, gy]];
      for (let i = 1; i <= 24; i++) pts.push([cx + Math.sin(i * .7) * 1.5 + (r() - .5), gy + depth * i / 24]);
      out.push({ pts, w: Math.max(1.6, trunkPx), d: 0 });
      for (let k = 0; k < 7; k++) {
        const [bx, by] = pts[3 + k * 3], side = k % 2 ? 1 : -1, len = depth * (.35 - k * .035), lp = [[bx, by]];
        for (let i = 1; i <= 8; i++) lp.push([bx + side * len * i / 8, by + len * .45 * Math.pow(i / 8, 1.4)]);
        out.push({ pts: lp, w: Math.max(.8, trunkPx * .4), d: 2 });
      }
      return { list: out, trunkPx };
    }
    const a = y ? y.a : 0, visD = a < 12 ? 1 : a < 30 ? 2 : 3;
    // Die Ansicht zoomt mit dem Baum mit, deshalb wächst das Wurzelwerk hier eigens mit dem Alter:
    // jung ein knappes Drittel, ausgewachsen (doppeltes Mannbarkeitsalter) die volle Ausdehnung.
    // Breite bis etwa zur Kronentraufe; Tiefe je nach Wurzeltyp (Flachwurzler bleiben flach, Pfahlwurzeln füllen den Boden).
    const grow = BL.clamp(.3 + .7 * a / (sim.S.fruit * 2), .3, 1);
    const rsY = Math.min(Hpx * 2.5, maxDepth * .9 / Math.max(.02, -skel.rMinY)) * grow;
    const reach = tRes && tRes.half > 4 ? tRes.half : Hpx * .3;
    const rsX = Math.min(W * .46, Math.max(reach, rsY * skel.rMaxX)) / Math.max(.02, skel.rMaxX) * grow;
    for (const rt of skel.roots) {
      if (rt.d > visD) continue;
      out.push({ pts: rt.pts.map(([x, yy]) => [cx + x * rsX, gy - yy * rsY]), w: Math.max(.8, trunkPx * .55 * rt.w), d: rt.d });
    }
    return { list: out, trunkPx };
  }
  function drawRoots(cx, gy, sc, y, st) {
    if (st < 2) return; // der Keimling zeichnet seine Keimwurzel selbst
    const { list } = rootLayout(cx, gy, sc, y, st);
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
    const col = real ? "#a8845f" : colors.dark ? "#c7a27a" : "#d9bf98";
    ctx.strokeStyle = col;
    for (const rt of list) {
      const n = rt.pts.length - 1;
      for (let i = 0; i < n; i++) {
        ctx.lineWidth = Math.max(.6, rt.w * (1 - i / n * .8));
        ctx.beginPath(); ctx.moveTo(rt.pts[i][0], rt.pts[i][1]); ctx.lineTo(rt.pts[i + 1][0], rt.pts[i + 1][1]); ctx.stroke();
      }
    }
    // Feinwurzeln und Wurzelhaare an den Spitzen
    const rr = BL.rng(5);
    ctx.lineWidth = .6; ctx.globalAlpha = .7;
    for (const rt of list) {
      if (rt.d < 1 && list.length > 1) continue;
      const [ex, ey] = rt.pts[rt.pts.length - 1];
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + (rr() - .5) * 10, ey + rr() * 7); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
    const rname = st <= 2 ? "Pfahlwurzel des Sämlings" : { pfahl: "Pfahlwurzel: tief verankert", herz: "Herzwurzel: Hauptwurzeln schräg nach unten", flach: "Flachwurzel (Teller): flach, mit Senkern" }[sim.S.root];
    ctx.font = "12px " + BL.css("--body"); ctx.fillStyle = colors.dark ? "#e8d9c0" : "#f4ead8"; ctx.fillText(rname, 12, Hc - 12);
    if (showMyc) {
      ctx.strokeStyle = colors.dark ? "#f2e7a6" : "#fff6c8"; ctx.globalAlpha = .4; ctx.lineWidth = .5;
      for (const rt of list) {
        if (rt.d < 1) continue;
        const [ex, ey] = rt.pts[rt.pts.length - 1];
        for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.moveTo(ex, ey); ctx.quadraticCurveTo(ex + (rr() - .5) * 18, ey + (rr() - .2) * 10, ex + (rr() - .5) * 30, ey + rr() * 14); ctx.stroke(); }
      }
    }
    ctx.restore();
  }
  function drawFlows(cx, gy, sc, y, season, sun) {
    const S = sim.S, active = S.conifer ? (season < .75 ? 1 : .15) : (season >= .05 && season < .62 ? 1 : 0);
    if (!active) return;
    const Hpx = y.H * sc, now = performance.now() / 1000, trunkPx = Math.max(1.5, y.D / 100 * sc * 1.4);
    // Nachts sind die Spaltöffnungen zu: kaum Transpiration, der Wasserstrom wird langsam; Zucker wandert weiter
    const dtf = Math.min(.1, now - lastFlow); lastFlow = now;
    phX = (phX + dtf * .12 * (.12 + .88 * sun.light)) % 1; phP = (phP + dtf * .07) % 1;
    const night = sun.light < .3;
    // Routen: Wurzelspitze → Stammfuß → Stamm → Äste → Blatt (Wasser) und umgekehrt (Zucker)
    const rl = rootLayout(cx, gy, sc, y, stageAt(t)).list;
    const rootEnds = rl.filter(rt => rt.d === 0 || rl.length === 1).map(rt => rt.pts);
    const leafEnds = tRes ? BL.TreeGen.flowPaths(skel.model, tRes.v, tRes, 16) : [];
    if (!rootEnds.length || !leafEnds.length) return;
    const along = (pts, u) => {
      const L = []; let tot = 0;
      for (let k = 1; k < pts.length; k++) { const d = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); L.push(d); tot += d; }
      let s = u * tot;
      for (let k = 0; k < L.length; k++) { if (s <= L[k]) { const f = s / (L[k] || 1); return [BL.lerp(pts[k][0], pts[k + 1][0], f), BL.lerp(pts[k][1], pts[k + 1][1], f)]; } s -= L[k]; }
      return pts[pts.length - 1];
    };
    const n = 18;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const rE = rootEnds[(i * 7) % rootEnds.length], lE = leafEnds[(i * 13) % leafEnds.length];
      const off = trunkPx * .18 + 1;
      const up = [...rE.slice().reverse(), ...lE.map(([x, yy]) => [x - off * .5, yy])];
      const down = [...lE.map(([x, yy]) => [x + off * .5, yy]).reverse(), ...rE];
      ctx.globalAlpha = active * .9;
      let p = along(up, (phX + i / n) % 1);
      ctx.fillStyle = colors.xylem; ctx.beginPath(); ctx.arc(p[0], p[1], 2.3, 0, 7); ctx.fill();
      p = along(down, (phP + i / n + .5) % 1);
      ctx.fillStyle = colors.phloem; ctx.beginPath(); ctx.arc(p[0], p[1], 2.3, 0, 7); ctx.fill();
    }
    // Gase an der Krone
    ctx.font = "600 11px " + BL.css("--mono"); ctx.globalAlpha = .9 * active;
    const half = Math.max(26, (tRes ? tRes.half : 20) + 10);
    const kx = cx + half, ky = gy - Hpx * .72, bob = Math.sin(now * 2) * 3;
    if (night) {
      ctx.fillStyle = colors.leaf; ctx.textAlign = "right"; ctx.fillText("O₂ →", cx - half - 4, ky + bob); ctx.textAlign = "left";
      ctx.fillStyle = colors.gas; ctx.fillText("→ CO₂", kx + 8, ky + 4 + bob);
      ctx.font = "11px " + BL.css("--body"); ctx.fillStyle = "#e8e4d8"; ctx.fillText("Nacht: keine Fotosynthese, nur Zellatmung", Math.min(kx + 8, W - 250), ky + 22 + bob);
    } else {
      ctx.fillStyle = colors.gas; ctx.textAlign = "right"; ctx.fillText("CO₂ →", cx - half - 4, ky + bob); ctx.textAlign = "left";
      ctx.fillStyle = colors.xylem; ctx.fillText("→ H₂O", kx + 8, ky - 14 - bob);
      ctx.fillStyle = colors.leaf; ctx.fillText("→ O₂", kx + 8, ky + 4 + bob);
    }
    ctx.restore();
  }
  function drawDead(cx, gy, sc, st) {
    const yd = sim.years[sim.deathAge], H = yd.H * sc, D = Math.max(3, yd.D / 100 * sc * 1.4);
    const prog = BL.clamp((t - sim.deathAge) / sim.decay, 0, 1);
    ctx.save(); ctx.lineCap = "round";
    if (st === 6) {
      blitTree({ cx, gy, Hpx: H, g: growthFrac(yd), season: .9, trunkPx: D, cb: crownBase(yd), snag: true, leaves: false, dark: colors.dark, real, sunX: sunXNow, step: sim.deathAge });
      bracket(cx + D * .5, gy - H * .22, D); bracket(cx - D * .5, gy - H * .32, D * .8, true);
      ctx.fillStyle = "#1a120b"; ctx.beginPath(); ctx.ellipse(cx, gy - H * .42, D * .18, D * .24, 0, 0, 7); ctx.fill();
    } else if (st === 7) {
      const L = H * .55, shrink = 1 - (prog - .3) / .7 * .75;
      ctx.fillStyle = "#6b5a48"; ctx.globalAlpha = .4 + .6 * shrink;
      ctx.beginPath(); ctx.ellipse(cx + L * .2, gy - D * .45 * shrink, L / 2, D * .5 * shrink, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#6f9a3f"; ctx.globalAlpha = .7 * (1 - shrink * .5);
      ctx.beginPath(); ctx.ellipse(cx + L * .2, gy - D * .85 * shrink, L / 2 * .9, D * .18, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1; mushrooms(cx + L * .2, gy - D * shrink * .9, L);
      // Wurzelteller bei Windwurf
      if (/Windwurf/.test(sim.cause)) { ctx.fillStyle = "#5a4330"; ctx.beginPath(); ctx.ellipse(cx - L * .32, gy - D, D * .4, D * 1.8, 0, 0, 7); ctx.fill(); }
    } else {
      ctx.fillStyle = colors.dark ? "#2a1e14" : "#3d2c1d"; ctx.beginPath(); ctx.ellipse(cx + H * .1, gy, H * .3, Math.max(4, D * .25), 0, Math.PI, 0); ctx.fill();
      // neuer Keimling: der Kreislauf beginnt neu
      ctx.strokeStyle = "#7da35a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + H * .1, gy - 4); ctx.lineTo(cx + H * .1, gy - 22); ctx.stroke();
      ctx.fillStyle = "#86b85c"; ctx.beginPath(); ctx.ellipse(cx + H * .1 + 7, gy - 22, 7, 4, -.2, 0, 7); ctx.ellipse(cx + H * .1 - 7, gy - 22, 7, 4, .2, 0, 7); ctx.fill();
      label(cx + H * .1 + 20, gy - 30, "Ein neuer Keimling im Humus");
    }
    ctx.restore();
  }
  function bracket(x, y, s, left) { ctx.fillStyle = "#a8957a"; ctx.beginPath(); ctx.ellipse(x + (left ? -s * .25 : s * .25), y, s * .35, s * .14, 0, 0, 7); ctx.fill(); ctx.fillStyle = "#7d6a52"; ctx.fillRect(x + (left ? -s * .55 : 0), y + s * .08, s * .55, 2); }
  function mushrooms(x, y, L) {
    for (let i = 0; i < 4; i++) { const mx = x - L * .3 + i * L * .18; ctx.fillStyle = "#e8dcc4"; ctx.fillRect(mx - 1.5, y - 8, 3, 8); ctx.fillStyle = i % 2 ? "#c46b3c" : "#b89a6a"; ctx.beginPath(); ctx.ellipse(mx, y - 8, 7, 4, 0, Math.PI, 0); ctx.fill(); }
  }
  function currentDwellers(st) {
    return DWELLERS.filter(d => st >= d.s[0] && st <= d.s[1] && (!d.sp || d.sp.includes(params.sp)));
  }
  function drawDwellers(cx, gy, sc, st, y) {
    const list = currentDwellers(st), H = (st >= 6 ? sim.years[sim.deathAge].H : y ? y.H : .1) * sc;
    const cr = tRes && st >= 2 && st <= 5 ? Math.max(20, tRes.half) : 20;
    const pos = { krone: 0, stamm: 0, hoehle: 0, boden: 0, wurzel: 0, totholz: 0 };
    ctx.save(); ctx.font = "18px system-ui, 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif"; ctx.textAlign = "center";
    for (const d of list) {
      const k = pos[d.z]++; let x, yy;
      if (d.z === "krone") { x = cx + Math.cos(k * 2.1) * cr * .7; yy = gy - H * (.68 + .12 * Math.sin(k * 1.7)); }
      else if (d.z === "stamm") { x = cx + (k % 2 ? 14 : -14); yy = gy - H * (.12 + .1 * k); }
      else if (d.z === "hoehle") { x = cx + 18 + k * 18; yy = gy - H * .38; }
      else if (d.z === "boden") { x = cx - 70 - k * 34; yy = gy - 4; }
      else if (d.z === "wurzel") { x = cx - 50 + k * 50; yy = gy + 36 + (k % 2) * 22; }
      else { x = cx + 40 + k * 30; yy = gy - 12; }
      if (st <= 1 && d.z !== "boden" && d.z !== "wurzel") continue;
      ctx.fillText(d.e, BL.clamp(x, 14, W - 14), BL.clamp(yy, 20, Hc - 6));
    }
    ctx.restore();
  }

  // ---------- Jahresringe ----------
  function drawRings() {
    const a = Math.min(Math.floor(t), sim.deathAge), size = ringCv._w;
    ringCtx.clearRect(0, 0, size, size);
    if (a < 1) { ringCtx.fillStyle = colors.muted; ringCtx.font = "12px " + BL.css("--body"); ringCtx.fillText("Noch kein Holz", 12, size / 2); return; }
    const ys = sim.years.slice(0, a + 1), total = ys.reduce((s, y) => s + y.ring, 0), c = size / 2, R = c - 8;
    const k = R / (total * 1.06);
    // Rinde
    ringCtx.fillStyle = "#5e4a38"; ringCtx.beginPath(); ringCtx.arc(c, c, R, 0, 7); ringCtx.fill();
    let r = total * k;
    const heartN = sim.S.heart ? Math.max(0, a - 20) : 0;
    for (let i = ys.length - 1; i >= 0; i--) {
      const y = ys[i], w = y.ring * k;
      const heart = i < heartN;
      ringCtx.fillStyle = heart ? "#b5814a" : "#e9cf9c"; ringCtx.beginPath(); ringCtx.arc(c, c, r, 0, 7); ringCtx.fill(); // Frühholz
      ringCtx.fillStyle = heart ? "#8a5a2c" : "#c79a5b"; ringCtx.beginPath(); ringCtx.arc(c, c, r, 0, Math.PI * 2); const ri = Math.max(0, r - Math.max(.6, w * .3)); ringCtx.moveTo(c + ri, c); ringCtx.arc(c, c, ri, 0, Math.PI * 2, true); ringCtx.fill(); // Spätholz
      if (y.ev === "duerre" && w > 1.2) { ringCtx.strokeStyle = colors.warn; ringCtx.lineWidth = 1; ringCtx.beginPath(); ringCtx.arc(c, c, r - w * .5, 0, 7); ringCtx.stroke(); }
      r -= w;
    }
    ringCtx.fillStyle = "#6b4a2a"; ringCtx.beginPath(); ringCtx.arc(c, c, 1.5, 0, 7); ringCtx.fill();
    // Ringbreiten-Kurve
    const sw = sparkCv._w, sh = sparkCv._h; sparkCtx.clearRect(0, 0, sw, sh);
    const maxR = Math.max(...sim.years.map(y => y.ring)), n = sim.years.length;
    sparkCtx.strokeStyle = colors.line; sparkCtx.beginPath(); sparkCtx.moveTo(0, sh - 1); sparkCtx.lineTo(sw, sh - 1); sparkCtx.stroke();
    for (let i = 0; i <= a; i++) {
      const y = sim.years[i], bh = y.ring / maxR * (sh - 4), x = i / n * sw;
      sparkCtx.fillStyle = y.ev === "duerre" || y.ev === "kaefer" ? colors.warn : y.ev === "mast" ? colors.phloem : colors.leaf;
      sparkCtx.fillRect(x, sh - 1 - bh, Math.max(1, sw / n - .3), bh);
    }
  }

  // ---------- Seitenleiste ----------
  function updatePanel() {
    const st = stageAt(t), a = Math.max(0, Math.floor(t)), y = sim.years[Math.min(a, sim.deathAge)], S = sim.S;
    const alive = st >= 1 && st <= 5, dead = st >= 6;
    const timeTxt = t < 0 ? "Herbst vor der Keimung" : dead ? `${Math.floor(t - sim.deathAge)} Jahre nach dem Tod` : `Jahr ${a} · ${seasonName(t)}`;
    BL.$("#lf-time").textContent = timeTxt;
    BL.$("#lf-stage").textContent = STAGES[st].n;
    BL.$("#lf-stagetxt").textContent = st === 1 ? STAGES[1].d + " " + S.germ : st === 6 && a === sim.deathAge + 0 ? STAGES[6].d : STAGES[st].d;
    BL.$("#lf-death").textContent = sim.deathAge != null ? `Stirbt mit ${sim.deathAge} Jahren: ${sim.cause}.` : "";
    BL.$$("#lf-stages i").forEach((el, i) => { el.dataset.on = i === st; el.dataset.past = i < st; });
    const m = BL.$("#lf-metrics");
    if (alive && t >= 1) {
      m.innerHTML = [
        ["Höhe", y.H < 2 ? BL.fmt(y.H * 100) + " cm" : BL.fmt(y.H, 1) + " m"],
        ["Stammdurchmesser", y.D < 2 ? BL.fmt(y.D * 10) + " mm" : BL.fmt(y.D) + " cm"],
        [S.conifer ? "Nadelfläche" : "Blattfläche", BL.fmt(y.LA, y.LA < 10 ? 2 : 0) + " m²"],
        ["Trockenmasse", y.bio < 10 ? BL.fmt(y.bio * 1000) + " g" : BL.fmt(y.bio) + " kg"],
        ["CO₂ im Holz gespeichert", y.co2 < 10 ? BL.fmt(y.co2 * 1000) + " g" : y.co2 > 1000 ? BL.fmt(y.co2 / 1000, 1) + " t" : BL.fmt(y.co2) + " kg"],
        ["Jahresring", BL.fmt(y.ring, 1) + " mm"]
      ].map(([k, v]) => `<div><span class="label">${k}</span><b class="num">${v}</b></div>`).join("") +
        `<div style="grid-column:1/-1"><span class="label">Vitalität</span><div class="meter"><i style="width:${Math.round(y.V * 100)}%;background:${y.V < .35 ? "var(--warn)" : "var(--leaf)"}"></i></div></div>`;
    } else if (dead) {
      const left = BL.clamp(1 - (t - sim.deathAge) / sim.decay, 0, 1), yd = sim.years[sim.deathAge];
      m.innerHTML = `<div><span class="label">Holz übrig</span><b class="num">${BL.fmt(left * 100)} %</b></div><div><span class="label">Kohlenstoff zurück in Luft und Boden</span><b class="num">${BL.fmt((1 - left) * yd.co2 / (yd.co2 > 1000 ? 1000 : 1), 1)} ${yd.co2 > 1000 ? "t" : "kg"} CO₂</b></div>`;
    } else m.innerHTML = `<p class="note">Speicherstoffe im Samen: Stärke, Fette und Eiweiße für die ersten Tage.</p>`;
    // Wasser
    const wb = BL.$("#lf-water");
    if (alive && t >= 1) {
      const inter = y.rainCrown * S.interc, uptake = y.transp + y.h2oPs;
      const rows = [["Regen auf die Kronenfläche", y.rainCrown, "var(--sky)"], ["verdunstet direkt von Blättern (Interzeption)", inter, "var(--gas)"],
        ["über die Wurzeln aufgenommen", uptake, "var(--xylem)"], ["über Spaltöffnungen verdunstet (Transpiration)", y.transp, "var(--xylem)"],
        ["in der Fotosynthese gespalten", y.h2oPs, "var(--leaf)"]];
      const mx = Math.max(...rows.map(r => r[1]));
      wb.innerHTML = rows.map(([k, v, c]) => `<div class="wrow"><span>${k}</span><b class="num">${fmtL(v)}</b><div class="meter"><i style="width:${Math.max(.5, v / mx * 100)}%;background:${c}"></i></div></div>`).join("") +
        `<p class="note">An einem heißen Sommertag verdunstet dieser Baum etwa ${fmtL(y.LA * .5)}. Nur ${BL.fmt(y.h2oPs / uptake * 100, 1)} % des aufgenommenen Wassers werden in der Fotosynthese gespalten, der Rest zieht als Transpirationsstrom Nährsalze nach oben.</p>`;
    } else wb.innerHTML = `<p class="note">${dead ? "Totholz speichert Regenwasser und gibt es langsam ab. Für Pilze und Amphibien ist das lebenswichtig." : "Der Samen nimmt beim Quellen Wasser auf, bis zum Doppelten seines Gewichts."}</p>`;
    // Nährstoffe und Gase
    const nb = BL.$("#lf-nut");
    if (alive && t >= 1) {
      const g = v => v < 1 ? BL.fmt(v * 1000) + " mg" : v > 1000 ? BL.fmt(v / 1000, 1) + " kg" : BL.fmt(v) + " g";
      nb.innerHTML = `<table class="data"><tr><th>Nährelement</th><th>Aufnahme pro Jahr</th><th>wofür</th></tr>
        <tr><td>N Stickstoff</td><td class="num">${g(y.nut.N)}</td><td>Eiweiße, Chlorophyll, DNA</td></tr>
        <tr><td>P Phosphor</td><td class="num">${g(y.nut.P)}</td><td>ATP, DNA, Zellmembranen</td></tr>
        <tr><td>K Kalium</td><td class="num">${g(y.nut.K)}</td><td>Wasserhaushalt, Schließzellen</td></tr>
        <tr><td>Ca Calcium</td><td class="num">${g(y.nut.Ca)}</td><td>Zellwände</td></tr>
        <tr><td>Mg Magnesium</td><td class="num">${g(y.nut.Mg)}</td><td>Zentralatom im Chlorophyll</td></tr></table>
        <p class="note">${S.conifer ? "Nadeln bleiben mehrere Jahre am Baum." : "Vor dem Laubfall holt der Baum etwa die Hälfte des Stickstoffs aus den Blättern zurück."} Mit der Streu gelangen rund ${g(y.litterN)} Stickstoff zurück in den Boden.</p>
        <div class="gasrow"><div><span class="label">CO₂ aufgenommen</span><b class="num">${fmtKg(y.co2gross)}</b></div><div><span class="label">davon veratmet</span><b class="num">${fmtKg(y.co2gross - y.co2net)}</b></div><div><span class="label">O₂ netto abgegeben</span><b class="num">${fmtKg(y.o2)}</b></div></div>`;
    } else nb.innerHTML = `<p class="note">${dead ? "Beim Zersetzen werden Stickstoff, Phosphor und die übrigen Nährelemente wieder freigesetzt (Mineralisierung)." : "Noch keine Aufnahme aus dem Boden."}</p>`;
    // Bewohner
    const list = currentDwellers(st), zones = { krone: "Krone", stamm: "Stamm und Rinde", hoehle: "Baumhöhlen", boden: "Boden", wurzel: "Wurzelraum", totholz: "im Totholz" };
    BL.$("#lf-dwell").innerHTML = Object.keys(zones).map(z => {
      const ds = list.filter(d => d.z === z); if (!ds.length) return "";
      return `<div><p class="label">${zones[z]}</p><ul>${ds.map(d => `<li><span aria-hidden="true">${d.e}</span> <b>${d.n}</b> <span class="note">${d.r}</span></li>`).join("")}</ul></div>`;
    }).join("");
    // Ereignisse bis jetzt
    const evs = sim.years.filter(y2 => y2.ev && y2.a <= Math.min(a, sim.deathAge)).slice(-6).reverse();
    BL.$("#lf-events").innerHTML = evs.length ? evs.map(e => `<li><span class="num">Jahr ${e.a}</span> ${EVENT_TXT[e.ev]}</li>`).join("") : `<li class="note">Noch keine besonderen Jahre.</li>`;
    BL.$("#lf-slider").value = Math.floor(t);
    const si = Math.floor(frac(t) * 4);
    BL.$$("#lf-season button").forEach((b, i) => b.setAttribute("aria-pressed", String(i === si)));
    BL.$$("#lf-style button").forEach(b => b.setAttribute("aria-pressed", String((b.dataset.r === "1") === real)));
    BL.$("#lf-day").disabled = !real;
  }
  const fmtL = v => v > 10000 ? BL.fmt(v / 1000, 0) + " m³" : v > 1000 ? BL.fmt(v / 1000, 1) + " m³" : BL.fmt(v, v < 10 ? 2 : 0) + " L";
  const fmtKg = v => v < 1 ? BL.fmt(v * 1000) + " g" : v > 1000 ? BL.fmt(v / 1000, 2) + " t" : BL.fmt(v, 1) + " kg";

  // ---------- Aufbau ----------
  const CSS = `
  .life-ctrl { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center }
  .life-ctrl select { padding: 5px 8px; border-radius: 6px; border: 1px solid var(--line); background: var(--panel) }
  .timeline { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 10px; align-items: center }
  #lf-stages { display: grid; grid-template-columns: repeat(9, minmax(0, 1fr)); gap: 3px; font-size: .68rem; color: var(--muted) }
  #lf-stages i { font-style: normal; border-top: 4px solid var(--line); padding-top: 3px; line-height: 1.2; overflow-wrap: anywhere }
  #lf-stages i[data-past="true"] { border-color: color-mix(in srgb, var(--accent) 45%, var(--line)) }
  #lf-stages i[data-on="true"] { border-color: var(--accent); color: var(--ink); font-weight: 700 }
  #lf-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px }
  #lf-metrics b { display: block; font-size: 1.05rem }
  .wrow { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 10px; font-size: .85rem; margin-bottom: 6px }
  .wrow .meter { grid-column: 1 / -1 }
  .gasrow { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 8px }
  .gasrow b { display: block }
  #lf-dwell { display: grid; gap: 8px } #lf-dwell ul, #lf-events { margin: 0; padding-left: 0; list-style: none; display: grid; gap: 3px; font-size: .9rem }
  .rings { display: grid; grid-template-columns: 170px minmax(0, 1fr); gap: 14px; align-items: center }
  @media (max-width: 480px) { .rings { grid-template-columns: minmax(0, 1fr) } }
  details.panel > summary { cursor: pointer; font-family: var(--display); font-size: 1.1rem }
  details.panel[open] > summary { margin-bottom: 10px }
  `;
  function init(el) {
    root = el; readColors();
    BL.addStyle(CSS);
    root.innerHTML = `
      <div class="stack"><h2>Lebenslauf eines Baumes</h2>
        <p class="lead">Vom Samen bis zum Humus: Wähle Baumart und Standort und lass ein ganzes Baumleben ablaufen. Dürrejahre, Mastjahre und Stürme sind im Jahresring abzulesen. Blaue Punkte zeigen Wasser im Xylem, gelbe Punkte Zucker im Phloem.</p></div>
      <div class="panel life-ctrl">
        <label>Baumart <select id="lf-sp">${Object.entries(SPECIES).map(([k, s]) => `<option value="${k}">${s.name}</option>`).join("")}</select></label>
        <label>Standort <select id="lf-light"><option value="0">Freistand</option><option value="1">Waldrand</option><option value="2">im Wald (Unterstand)</option></select></label>
        <label>Boden <select id="lf-soil"><option value="0">nährstoffarm (Sand)</option><option value="1">mittel</option><option value="2">nährstoffreich (Lehm)</option></select></label>
        <label class="slider" style="min-width:min(100%,330px)">Niederschlag <input type="range" id="lf-rain" min="400" max="1400" step="50"><output id="lf-rain-o"></output></label>
        <button class="btn" id="lf-seed" title="Andere Wetterabfolge">Neues Wetter</button>
      </div>
      <div class="bench">
        <div class="stack">
          <div class="canvas-box" id="lf-box"><canvas id="lf-cv" aria-label="Baum im Zeitverlauf"></canvas></div>
          <div class="timeline"><button class="btn primary" id="lf-play">Abspielen</button><input type="range" id="lf-slider" step="1" aria-label="Jahr"><div class="seg" id="lf-speed">${[[0, "Jahreszeiten"], [1, "1 J/s"], [4, "4 J/s"], [15, "15 J/s"]].map(([s, l]) => `<button data-s="${s}" aria-pressed="${s === speed}" title="${s ? "Jahre überspringen, die Jahreszeit bleibt stehen" : "Ein Jahr in " + YEAR_S + " Sekunden, mit allen Jahreszeiten"}">${l}</button>`).join("")}</div></div>
          <div id="lf-stages">${STAGES.map(s => `<i>${s.n}</i>`).join("")}</div>
          <div class="row"><div class="seg" id="lf-season" aria-label="Jahreszeit">${["Frühling", "Sommer", "Herbst", "Winter"].map((n, i) => `<button data-i="${i}">${n}</button>`).join("")}</div>
            <div class="seg" id="lf-style" aria-label="Darstellung"><button data-r="1">Natürlich</button><button data-r="0">Schema</button></div>
            <label title="Die Tageszeit läuft auf eigener Uhr, unabhängig vom Wachstum"><input type="checkbox" id="lf-day"> Tag und Nacht</label></div>
          <div class="row"><label><input type="checkbox" id="lf-flow" checked> Stoffströme</label><label><input type="checkbox" id="lf-myc" checked> Pilzgeflecht (Mykorrhiza)</label></div>
          <div class="panel rings"><canvas id="lf-rings" aria-label="Stammquerschnitt"></canvas>
            <div class="stack"><h3>Jahresringe</h3><p class="note">Jedes Jahr legt das Kambium eine Schicht helles Frühholz (weite Gefäße für viel Wasser) und dunkles Spätholz (dickwandig, stabil) an. ${"In Dürrejahren (rot) und Mastjahren (gelb) bleiben die Ringe schmal."}</p><canvas id="lf-spark" aria-label="Ringbreite je Jahr"></canvas><p class="note">Ringbreite je Jahr</p></div></div>
        </div>
        <div class="stack">
          <div class="panel stack"><span class="label" id="lf-time"></span><h3 id="lf-stage"></h3><p id="lf-stagetxt"></p><p class="note" id="lf-death"></p><div id="lf-metrics"></div></div>
          <details class="panel" open><summary>Wasserhaushalt pro Jahr</summary><div id="lf-water"></div></details>
          <details class="panel"><summary>Nährsalze und Gase pro Jahr</summary><div id="lf-nut"></div></details>
          <details class="panel" open><summary>Wer lebt jetzt hier?</summary><div id="lf-dwell"></div></details>
          <details class="panel"><summary>Besondere Jahre</summary><ul id="lf-events"></ul></details>
        </div>
      </div>`;
    cv = BL.$("#lf-cv"); ringCv = BL.$("#lf-rings"); sparkCv = BL.$("#lf-spark");
    BL.$("#lf-sp").value = params.sp; BL.$("#lf-light").value = params.light; BL.$("#lf-soil").value = params.soil; BL.$("#lf-rain").value = params.rain;
    const change = () => {
      params = { ...params, sp: BL.$("#lf-sp").value, light: +BL.$("#lf-light").value, soil: +BL.$("#lf-soil").value, rain: +BL.$("#lf-rain").value };
      BL.store.set("lifeParams", params); recompute(false);
    };
    ["#lf-sp", "#lf-light", "#lf-soil"].forEach(s => BL.$(s).addEventListener("change", () => { change(); }));
    BL.$("#lf-sp").addEventListener("change", () => { skel = buildSkeleton(); t = -0.6; render(); });
    BL.$("#lf-light").addEventListener("change", () => { skel = buildSkeleton(); render(); });
    BL.$("#lf-rain").addEventListener("input", change);
    BL.$("#lf-seed").onclick = () => { params.seed = Math.floor(Math.random() * 1e6); change(); skel = buildSkeleton(); };
    BL.$("#lf-play").onclick = () => { playing = !playing; if (playing && t >= sim.end - .01) t = -1 + frac(t); holdSeason(); syncPlay(); };
    // Der Regler springt in ganzen Jahren, die Jahreszeit bleibt
    BL.$("#lf-slider").addEventListener("input", e => { t = Math.min(sim.end, +e.target.value + frac(t)); holdSeason(); render(); });
    BL.$("#lf-speed").addEventListener("click", e => { const b = e.target.closest("[data-s]"); if (!b) return; speed = +b.dataset.s; BL.store.set("lifeSpeed", speed); holdSeason(); BL.$$("[data-s]", BL.$("#lf-speed")).forEach(x => x.setAttribute("aria-pressed", x === b)); });
    BL.$("#lf-season").addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (!b) return; t = Math.min(sim.end, Math.floor(t) + SEASON_AT[+b.dataset.i]); holdSeason(); render(); });
    BL.$("#lf-style").addEventListener("click", e => { const b = e.target.closest("[data-r]"); if (!b) return; real = b.dataset.r === "1"; BL.store.set("lifeReal", real); render(); });
    BL.$("#lf-day").checked = dayOn;
    BL.$("#lf-day").onchange = e => { dayOn = e.target.checked; BL.store.set("lifeDay", dayOn); render(); };
    BL.$("#lf-flow").onchange = e => { showFlow = e.target.checked; render(); };
    BL.$("#lf-myc").onchange = e => { showMyc = e.target.checked; render(); };
    new ResizeObserver(resize).observe(BL.$("#lf-box"));
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { readColors(); render(); });
    skel = buildSkeleton(); recompute(true);
    t = BL.store.get("lifeT", 35.35); if (t > sim.end) t = 35.35;
    holdSeason();
    resize(); requestAnimationFrame(loop);
  }
  function recompute() {
    sim = simulate();
    const s = BL.$("#lf-slider"); s.min = -1; s.max = Math.floor(sim.end); if (t > sim.end) t = sim.end;
    BL.$("#lf-rain-o").textContent = params.rain + " mm";
    render();
  }
  function resize() {
    const box = BL.$("#lf-box"); if (!box.clientWidth) return; W = box.clientWidth; Hc = Math.round(BL.clamp(W * .78, 340, 560));
    ctx = BL.fitCanvas(cv, W, Hc);
    if (!fgCv) fgCv = document.createElement("canvas");
    fgCtx = BL.fitCanvas(fgCv, W, Hc);
    const rs = 170; ringCtx = BL.fitCanvas(ringCv, rs, rs); ringCv._w = rs;
    const sw = Math.max(120, sparkCv.parentElement.clientWidth); sparkCtx = BL.fitCanvas(sparkCv, sw, 48); sparkCv._w = sw; sparkCv._h = 48;
    render();
  }
  function render() { if (!sim || !ctx || !W || !cv.width) return; draw(); drawRings(); updatePanel(); }
  function syncPlay() { BL.$("#lf-play").textContent = playing ? "Pause" : t >= sim.end - .01 ? "Nochmal" : "Abspielen"; }
  let lastPanel = 0;
  function loop(ts) {
    if (!root.isConnected) return;
    const dt = Math.min(.1, (ts - last) / 1000 || 0); last = ts;
    if (!root.hidden) {
      if (real && dayOn) dayT = frac(dayT + dt / DAY_S);
      if (playing) {
        if (!speed || t < 1) {
          // Jahreszeiten: ein Jahr in YEAR_S Sekunden. Samen und Keimung laufen immer so, damit man sie sieht;
          // beim Jahressprung geht es danach in der gewählten Jahreszeit weiter.
          const was = t; t += dt / (t < 1 ? 8 : YEAR_S);
          if (speed && was < 1 && t >= 1) t = 1 + sFix;
          if (!speed || t >= 1) { acc = Math.floor(t); if (!speed) sFix = frac(t); }
        } else {
          acc += dt * speed; t = Math.floor(acc) + sFix;
        }
        if (t >= sim.end) { t = sim.end; playing = false; syncPlay(); }
      }
      draw();
      if (playing && ts - lastPanel > 120) { lastPanel = ts; drawRings(); updatePanel(); BL.store.set("lifeT", t); }
    }
    requestAnimationFrame(loop);
  }
  return { init, onHide() { playing = false; if (root) syncPlay(); } };
})();
