// @ts-nocheck
/* eslint-disable */
// Baumleben: aus der eigenständigen Fassung übernommen, ungeprüftes JavaScript.
import { BL } from "./bl";
/* Sei ein Baum: Ressourcen-Spiel mit Bewohnerkarten (angelehnt an Forest Shuffle). Eine Runde = 15 Jahre. */
BL.Game = (function () {
  const YEARS = 15;
  const SPECIES = {
    buche: { name: "Rotbuche", max: 300, shade: .75, mature: 4, seedCost: 3, txt: "Schattenkünstlerin: wächst auch unter anderen Bäumen. Empfindlich bei Dürre.", drought: 1.2 },
    stieleiche: { name: "Stieleiche", max: 450, shade: .4, mature: 4, seedCost: 3, txt: "Lebt sehr lange und beherbergt die meisten Arten. Braucht Licht.", drought: .8 },
    fichte: { name: "Gemeine Fichte", max: 225, shade: .6, mature: 4, seedCost: 3, txt: "Wächst schnell, wurzelt flach. Borkenkäfer und Stürme sind gefährlich.", drought: 1.5, flat: true },
    birke: { name: "Hänge-Birke", max: 105, shade: .3, mature: 2, seedCost: 2, txt: "Pionierin: wächst rasant, bildet früh viele Samen, stirbt jung.", drought: 1, fast: true }
  };
  const EVENTS = [
    { id: "gut", n: "Gutes Jahr", w: 3, light: 3, water: 3, f: "Warm, sonnig und genug Regen: Die Spaltöffnungen bleiben lange offen, die Fotosynthese läuft auf Hochtouren." },
    { id: "normal", n: "Normales Jahr", w: 4, light: 2, water: 2, f: "Ein durchschnittliches Jahr. Der Jahresring wird mittelbreit." },
    { id: "trocken", n: "Trockener Sommer", w: 3, light: 3, water: 1, f: "Wenig Regen: Der Baum schließt mittags die Spaltöffnungen und spart Wasser, gewinnt aber weniger Zucker." },
    { id: "duerre", n: "Dürre", w: 2, light: 3, water: 0, f: "Monatelang kein Regen. In den Leitungsbahnen reißen Wassersäulen (Embolie). Geschwächte Bäume sind leichte Beute für Käfer." },
    { id: "hitze", n: "Hitzesommer", w: 2, light: 3, water: 1, resp: 2, f: "Über 35 °C steigt die Atmung stark, die Fotosynthese sinkt. Der Baum verbraucht seine Reserven." },
    { id: "frost", n: "Spätfrost", w: 2, light: 2, water: 2, frost: true, f: "Frost im Mai lässt frisch ausgetriebene Blätter erfrieren. Der Baum muss aus Reserveknospen neu austreiben." },
    { id: "sturm", n: "Herbststurm", w: 2, light: 2, water: 2, storm: true, f: "Hohe Bäume mit schwachen Wurzeln werden geworfen. Tiefe Wurzeln und ein gutes Verhältnis von Wurzel zu Stamm schützen." },
    { id: "kaefer", n: "Borkenkäfer schwärmen", w: 2, light: 2, water: 2, beetle: true, f: "Borkenkäfer bohren sich in die Rinde. Gesunde Bäume wehren sie mit Harz oder Gerbstoffen ab." },
    { id: "raupen", n: "Raupenfraß", w: 2, light: 2, water: 2, caterpillar: true, f: "Massenhaft Raupen fressen Blätter. Meisen, Fledermäuse und Ameisen sind die Gegenspieler. Viele Bäume treiben im Juni ein zweites Mal aus (Johannistrieb)." },
    { id: "luecke", n: "Nachbarbaum fällt", w: 2, light: 3, water: 2, gap: true, f: "Eine Lücke im Kronendach: Plötzlich fällt Licht bis auf den Boden. Wer jetzt schnell nach oben wächst, gewinnt." },
    { id: "verbiss", n: "Rehe im Revier", w: 2, light: 2, water: 2, browse: true, f: "Rehe fressen Knospen junger Bäume. Wer klein ist, verliert seine Spitze." }
  ];
  const CARDS = [
    { id: "myko", n: "Mykorrhiza-Pilz", e: "🍄", slot: "wurzel", pts: 2, req: s => true, rq: "–", eff: "+1 Wasser, kostet 1 Zucker je Runde", txt: "Pilzfäden umhüllen die Feinwurzeln. Tausch: Wasser und Phosphat gegen Zucker." },
    { id: "steinpilz", n: "Steinpilz", e: "🍄", slot: "wurzel", pts: 3, req: s => has(s, "myko"), rq: "Mykorrhiza", eff: "–", txt: "Fruchtkörper eines Mykorrhizapilzes. Das eigentliche Lebewesen ist das Geflecht im Boden." },
    { id: "wurm", n: "Regenwürmer", e: "🪱", slot: "wurzel", pts: 1, req: s => true, rq: "–", eff: "+½ Wasser", txt: "Lockern den Boden, ziehen Laub hinein und machen daraus Humus." },
    { id: "ameise", n: "Rote Waldameise", e: "🐜", slot: "wurzel", pts: 2, req: s => has(s, "laus"), rq: "Blattläuse", eff: "schützt vor Raupen", txt: "Melkt Blattläuse und jagt Raupen. Ein Volk frisst täglich tausende Insekten." },
    { id: "laus", n: "Blattläuse", e: "🐜", slot: "krone", pts: 1, req: s => s.K >= 2, rq: "Krone 2", eff: "kostet 1 Zucker je Runde", txt: "Saugen Phloemsaft. Den Überschuss scheiden sie als zuckrigen Honigtau aus." },
    { id: "marienkaefer", n: "Marienkäfer", e: "🐞", slot: "krone", pts: 2, req: s => has(s, "laus"), rq: "Blattläuse", eff: "Blattläuse kosten nichts mehr", txt: "Eine Larve frisst in ihrer Entwicklung Hunderte Blattläuse." },
    { id: "meise", n: "Kohlmeise", e: "🐦", slot: "krone", pts: 2, req: s => s.S >= 3, rq: "Stamm 3", eff: "schützt vor Raupen", txt: "Ein Meisenpaar verfüttert an seine Jungen zehntausende Raupen." },
    { id: "hoernchen", n: "Eichhörnchen", e: "🐿️", slot: "krone", pts: 2, req: s => s.seeds >= 1, rq: "1 Samen", eff: "Ende: +1 je 2 Samen", txt: "Versteckt Samen als Wintervorrat und vergisst viele davon: So keimen neue Bäume." },
    { id: "haeher", n: "Eichelhäher", e: "🐦", slot: "krone", pts: 2, req: s => s.seeds >= 1 && ["stieleiche", "buche"].includes(s.sp), rq: "1 Samen, Eiche oder Buche", eff: "Ende: +1 je Samen (max. 5)", txt: "Versteckt pro Herbst einige tausend Eicheln, oft kilometerweit vom Mutterbaum." },
    { id: "kreuzschnabel", n: "Fichtenkreuzschnabel", e: "🐦", slot: "krone", pts: 3, req: s => s.seeds >= 1 && s.sp === "fichte", rq: "1 Samen, Fichte", eff: "–", txt: "Hebelt mit dem gekreuzten Schnabel Zapfenschuppen auf. Brütet sogar im Winter, wenn es Samen gibt." },
    { id: "zeisig", n: "Birkenzeisig", e: "🐦", slot: "krone", pts: 3, req: s => s.seeds >= 1 && s.sp === "birke", rq: "1 Samen, Birke", eff: "–", txt: "Kleiner Finkenvogel, der im Winter Birkensamen aus den Kätzchen pickt." },
    { id: "gallwespe", n: "Gallwespe", e: "🐝", slot: "krone", pts: 1, req: s => s.sp === "stieleiche", rq: "Eiche", eff: "–", txt: "Ihre Larve lässt das Eichenblatt einen kugeligen Gallapfel wachsen, ihr Kinderzimmer." },
    { id: "baumlaeufer", n: "Waldbaumläufer", e: "🐦", slot: "stamm", pts: 2, req: s => s.S >= 4, rq: "Stamm 4", eff: "–", txt: "Klettert spiralig den Stamm hinauf und stochert Insekten aus Rindenritzen." },
    { id: "bunt", n: "Buntspecht", e: "🐦", slot: "stamm", pts: 2, req: s => s.S >= 4, rq: "Stamm 4", eff: "zimmert 1 Höhle", txt: "Zimmert jedes Jahr eine neue Bruthöhle. Die alten nutzen Nachmieter." },
    { id: "schwarz", n: "Schwarzspecht", e: "🐦", slot: "stamm", pts: 3, req: s => s.S >= 6 && s.sp !== "birke", rq: "Stamm 6", eff: "zimmert 1 große Höhle", txt: "Größter Specht Europas. Seine Höhlen sind Wohnraum für über 50 Tierarten." },
    { id: "flechte", n: "Flechten", e: "🌿", slot: "stamm", pts: 1, req: s => s.age >= 45, rq: "Alter 45", eff: "–", txt: "Lebensgemeinschaft aus Pilz und Alge. Viele Arten wachsen nur bei sauberer Luft." },
    { id: "moos", n: "Moospolster", e: "🌱", slot: "stamm", pts: 1, req: s => true, rq: "–", eff: "–", txt: "Wächst auf der Wetterseite am Stammfuß und speichert Regenwasser." },
    { id: "kleiber", n: "Kleiber", e: "🐦", slot: "hoehle", pts: 2, req: s => s.holes > 0, rq: "Höhle", eff: "–", txt: "Mauert den Eingang einer Spechthöhle mit Lehm passend zu, damit kein größerer Vogel hineinpasst." },
    { id: "fledermaus", n: "Großer Abendsegler", e: "🦇", slot: "hoehle", pts: 3, req: s => s.holes > 0, rq: "Höhle", eff: "schützt vor Raupen", txt: "Fledermaus, die in Baumhöhlen überwintert und nachts Nachtfalter jagt." },
    { id: "kauz", n: "Waldkauz", e: "🦉", slot: "hoehle", pts: 4, req: s => s.bigHoles > 0, rq: "große Höhle", eff: "–", txt: "Häufigste Eule Mitteleuropas. Brütet in großen Höhlen alter Bäume." },
    { id: "taube", n: "Hohltaube", e: "🕊️", slot: "hoehle", pts: 3, req: s => s.bigHoles > 0, rq: "große Höhle", eff: "–", txt: "Die einzige heimische Taube, die in Höhlen brütet, fast nur in Schwarzspechthöhlen." }
  ];
  const DEAD = [
    { n: "Zunderschwamm", e: "🍄", pts: 3, txt: "Weißfäule: baut Lignin ab, das Holz wird hell und faserig. Früher Zunder zum Feuermachen." },
    { n: "Hirschkäfer", e: "🪲", pts: 4, bonus: "stieleiche", txt: "Die Larve lebt fünf bis acht Jahre in morschen Eichenwurzeln." },
    { n: "Alpenbock", e: "🪲", pts: 4, bonus: "buche", txt: "Seltener blauer Bockkäfer in besonntem Buchentotholz." },
    { n: "Holzwespe", e: "🐝", pts: 2, bonus: "fichte", txt: "Bringt Pilzsporen mit ins Holz, von denen sich ihre Larven ernähren." },
    { n: "Feuersalamander", e: "🦎", pts: 3, txt: "Versteckt sich tagsüber unter feuchten, liegenden Stämmen." },
    { n: "Asseln", e: "🐛", pts: 2, txt: "Krebstiere an Land. Sie zerkleinern morsches Holz für Pilze und Bakterien." },
    { n: "Schleimpilz", e: "🟡", pts: 2, txt: "Kriecht als Plasmodium über das Holz und frisst Bakterien." },
    { n: "Zaunkönig", e: "🐦", pts: 2, txt: "Baut sein Nest gern im Wurzelteller umgestürzter Bäume." },
    { n: "Baummarder", e: "🦦", pts: 3, needsHole: true, txt: "Nutzt alte Spechthöhlen als Schlafplatz." },
    { n: "Springschwänze", e: "🦗", pts: 2, txt: "Winzige Bodentiere, bis zu 100.000 pro Quadratmeter Waldboden." },
    { n: "Moose", e: "🌱", pts: 1, txt: "Überziehen den liegenden Stamm und halten ihn feucht." },
    { n: "Hallimasch", e: "🍄", pts: 2, txt: "Seine Pilzfäden leuchten im Dunkeln schwach (Biolumineszenz)." }
  ];
  const SLOTS = { krone: "Krone", stamm: "Stamm", hoehle: "Höhlen", wurzel: "Wurzel und Boden" };
  const has = (s, id) => s.cards.some(c => c.id === id);

  let root, s = null;
  const CSS = `
  .gm { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 20px; align-items: start }
  @media (max-width: 900px) { .gm { grid-template-columns: minmax(0, 1fr) } }
  .tableau { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1fr); grid-template-areas: ". k ." "s t h" ". w ."; gap: 8px; align-items: center }
  .tableau .slot { border: 1px dashed var(--line); border-radius: 10px; padding: 6px; min-height: 64px; display: flex; flex-wrap: wrap; gap: 4px; align-content: flex-start; min-width: 0 }
  .tableau .slot > .label { width: 100% }
  .gcard { border: 1px solid var(--line); border-radius: 8px; background: var(--panel); padding: 4px 6px; font-size: .78rem; display: inline-flex; gap: 4px; align-items: center }
  .gcard b { font-family: var(--mono); font-size: .75rem; color: var(--leaf) }
  .tableau .tree { grid-area: t; border: 1px solid var(--line); border-radius: 12px; background: var(--sky); overflow: hidden }
  .market { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px }
  .mcard { border: 1px solid var(--line); border-radius: 10px; padding: 10px; background: var(--panel); display: grid; gap: 4px; align-content: start; font-size: .85rem }
  .mcard .em { font-size: 1.6rem; line-height: 1 }
  .mcard h4 { margin: 0; font-family: var(--display); font-weight: 400; font-size: 1rem }
  .mcard .meta { font-family: var(--mono); font-size: .72rem; color: var(--muted) }
  .ev { border: 2px solid var(--phloem); border-radius: 12px; padding: 12px; background: var(--panel); display: grid; gap: 6px }
  .alloc { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px }
  .alloc button { text-align: left; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); cursor: pointer; display: grid; gap: 2px }
  .alloc button:hover:not(:disabled) { border-color: var(--leaf) }
  .alloc button:disabled { opacity: .45; cursor: not-allowed }
  .alloc small { color: var(--muted); font-size: .75rem }
  .res { display: grid; grid-template-columns: repeat(auto-fit, minmax(92px, 1fr)); gap: 8px }
  .res div { background: var(--leaf-soft); border-radius: 8px; padding: 6px 8px }
  .res b { display: block; font-family: var(--mono); font-size: 1.15rem }
  .sugar { color: var(--phloem) }
  .glog { font-size: .85rem; display: grid; gap: 3px; max-height: 220px; overflow: auto; margin: 0; padding-left: 1.1em }
  .species-pick { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px }
  .species-pick button { text-align: left; border: 1px solid var(--line); border-radius: 10px; padding: 12px; background: var(--panel); cursor: pointer; display: grid; gap: 6px }
  .species-pick button:hover { border-color: var(--leaf) }
  .species-pick .lf { height: 80px }
  `;
  function init(el) {
    root = el; BL.addStyle(CSS);
    s = BL.store.get("game", null);
    render();
  }
  function save() { BL.store.set("game", s); }

  function start(sp) {
    s = { sp, round: 0, age: 0, K: 1, W: 1, S: 1, A: 0, R: 2, V: 10, seeds: 0, cards: [], holes: 0, bigHoles: 0, log: [], phase: "play",
      sugar: 0, gapRounds: 0, hosted: false, dead: [], deadRound: 0, market: [], event: null, deathCause: "" };
    newRound(); save(); render();
  }
  function pickEvent() {
    const pool = EVENTS.filter(e => !(e.browse && s.S > 2));
    const tot = pool.reduce((a, e) => a + e.w, 0); let x = Math.random() * tot;
    for (const e of pool) { x -= e.w; if (x <= 0) return e; } return pool[0];
  }
  function newRound() {
    const Sp = SPECIES[s.sp], ev = pickEvent(); s.event = ev.id; s.round++; s.hosted = false;
    const msgs = [];
    // Licht: unter dem Kronendach (Stamm < 5) Schatten
    if (ev.gap) s.gapRounds = 2;
    let light = ev.light / 2;
    if (s.S < 5 && s.gapRounds <= 0) light *= Sp.shade;
    if (s.gapRounds > 0) s.gapRounds--;
    // Ereignis-Schäden
    if (ev.frost && s.K > 1) { s.K--; msgs.push("Frost: Krone −1"); }
    if (ev.browse) { if (s.K > 1) s.K--; msgs.push("Verbiss: Krone −1, Stamm kann diese Runde nicht wachsen"); }
    if (ev.storm) {
      const risk = s.S - s.W - (Sp.flat ? 0 : 1);
      if (risk >= 1) { s.V -= 2 + risk; s.K = Math.max(1, s.K - 1); msgs.push(`Sturm: Wurzeln zu schwach für den hohen Stamm, Vitalität −${2 + risk}`); }
      else { s.V -= 1; msgs.push("Sturm: ein paar Äste brechen, Vitalität −1"); }
    }
    if (ev.beetle) {
      const weak = s.A < 2 || s.V < 5; const dmg = weak ? (s.sp === "fichte" ? 4 : 2) : 0;
      if (dmg) { s.V -= dmg; msgs.push(`Borkenkäfer: zu wenig Abwehr, Vitalität −${dmg}`); } else msgs.push("Borkenkäfer: mit Harz und Gerbstoffen abgewehrt");
    }
    if (ev.caterpillar) {
      const prot = has(s, "meise") || has(s, "fledermaus") || has(s, "ameise");
      if (prot) msgs.push("Raupen: Meisen, Fledermäuse oder Ameisen halten sie klein");
      else { s.K = Math.max(1, s.K - 1); s.V -= 1; msgs.push("Raupen: Krone −1, Vitalität −1"); }
    }
    // Produktion
    const water = s.W * ev.water / 2 + (has(s, "myko") ? 1 : 0) + (has(s, "wurm") ? .5 : 0);
    const wf = Math.min(1, water / Math.max(1, s.K));
    const prod = Math.round(s.K * 2 * light * wf + (Sp.fast ? 1 : 0));
    const upkeep = Math.ceil((s.K + s.W + s.S) / 3) + (ev.resp || 0) + (has(s, "myko") ? 1 : 0) + (has(s, "laus") && !has(s, "marienkaefer") ? 1 : 0);
    let net = prod - upkeep;
    if (wf < .5) { const d = Math.round((1 - wf) * 2 * Sp.drought); if (d) { s.V -= d; msgs.push(`Wassermangel: Vitalität −${d}`); } }
    if (net < 0) {
      const take = Math.min(s.R, -net); s.R -= take; net += take;
      if (net < 0) { s.V -= 2; s.K = Math.max(1, s.K - 1); msgs.push("Zuckermangel: Die Atmung frisst mehr, als die Blätter liefern. Krone −1, Vitalität −2"); net = 0; }
      else msgs.push(`Reserve genutzt: −${take} Zucker`);
    } else if (s.V < 10 && wf >= .5) s.V = Math.min(10, s.V + 1);
    s.sugar = net; s.lastProd = prod; s.lastUpkeep = upkeep;
    // Alter
    s.age += YEARS;
    if (s.age > Sp.max) { const d = 2 + Math.floor((s.age - Sp.max) / 30); s.V -= d; msgs.push(`Alter: Pilze dringen ein, Äste sterben ab. Vitalität −${d}`); }
    s.market = BL.shuffle(CARDS.filter(c => !has(s, c.id) || c.id === "bunt" || c.id === "schwarz")).slice(0, 3).map(c => c.id);
    s.log.unshift(`Jahr ${s.age}: ${ev.n}. +${prod} Zucker, −${upkeep} Atmung${msgs.length ? ". " + msgs.join(". ") : ""}`);
    if (s.V <= 0) die(ev.storm ? "vom Sturm geworfen" : ev.beetle ? "von Borkenkäfern getötet" : s.age > Sp.max ? "an Altersschwäche gestorben" : "an Stress gestorben");
  }
  function die(cause) {
    s.V = 0; s.phase = "dead"; s.deathCause = cause; s.deadRound = 0; dealDead();
    s.log.unshift(`Jahr ${s.age}: Der Baum ist ${cause}. Jetzt beginnt sein zweites Leben als Totholz.`);
  }
  function dealDead() {
    const pool = DEAD.filter(d => !s.dead.includes(d.n) && (!d.needsHole || s.holes + s.bigHoles > 0));
    s.market = BL.shuffle(pool).slice(0, 3).map(d => d.n);
  }

  const ACTIONS = [
    { k: "K", n: "Krone wachsen", c: 2, d: "+1 Blätter: mehr Fotosynthese, aber mehr Wasserbedarf", ok: () => true },
    { k: "W", n: "Wurzeln wachsen", c: 2, d: "+1 Wasser, Halt bei Sturm", ok: () => true },
    { k: "S", n: "Stamm wachsen", c: 3, d: "+1 Höhe: raus aus dem Schatten, Platz für Bewohner", ok: () => !(EV().browse) },
    { k: "A", n: "Abwehrstoffe", c: 2, d: "+1 Harz, Gerbstoffe gegen Käfer (max. 4)", ok: () => s.A < 4 },
    { k: "seed", n: "Samen bilden", c: 0, d: "+1 Nachkomme (Punkte)", ok: () => s.S >= SPECIES[s.sp].mature },
    { k: "R", n: "Stärke speichern", c: 1, d: "Reserve für schlechte Jahre", ok: () => s.R < 3 + s.S },
    { k: "V", n: "Wunden verschließen", c: 2, d: "+1 Vitalität", ok: () => s.V < 10 }
  ];
  const EV = () => EVENTS.find(e => e.id === s.event);
  function cost(a) { return a.k === "seed" ? SPECIES[s.sp].seedCost : a.c; }
  function act(k) {
    const a = ACTIONS.find(x => x.k === k), c = cost(a);
    if (s.sugar < c || !a.ok()) return;
    s.sugar -= c;
    if (k === "seed") s.seeds++; else if (k === "R") s.R++; else if (k === "V") s.V = Math.min(10, s.V + 1); else s[k]++;
    save(); render();
  }
  function host(id) {
    const c = CARDS.find(x => x.id === id);
    if (s.hosted || !c.req(s)) return;
    if (c.slot === "hoehle") { if (c.id === "kauz" || c.id === "taube") s.bigHoles--; else s.holes--; }
    s.cards.push({ id: c.id }); s.hosted = true;
    if (c.id === "bunt") s.holes++; if (c.id === "schwarz") s.bigHoles++;
    s.market = s.market.filter(m => m !== id);
    s.log.unshift(`${c.e} ${c.n} zieht ein.`); save(); render();
  }
  function endRound() {
    if (s.sugar > 0) s.log.unshift(`${s.sugar} Zucker ungenutzt: veratmet.`);
    newRound(); save(); render();
  }
  function pickDead(n) {
    s.dead.push(n); s.deadRound++;
    if (s.deadRound >= 3) { s.phase = "over"; finalize(); } else dealDead();
    save(); render();
  }
  function score() {
    const pts = { alter: Math.floor(s.age / YEARS), samen: s.seeds * 2, bewohner: 0, extra: 0, totholz: 0, vielfalt: 0 };
    for (const c of s.cards) pts.bewohner += CARDS.find(x => x.id === c.id).pts;
    if (has(s, "hoernchen")) pts.extra += Math.floor(s.seeds / 2);
    if (has(s, "haeher")) pts.extra += Math.min(5, s.seeds);
    for (const n of s.dead) { const d = DEAD.find(x => x.n === n); pts.totholz += d.pts + (d.bonus === s.sp ? 2 : 0); }
    const slots = new Set(s.cards.map(c => CARDS.find(x => x.id === c.id).slot)); pts.vielfalt = slots.size * 2 + (s.dead.length ? 2 : 0);
    pts.sum = Object.values(pts).reduce((a, b) => a + b, 0);
    return pts;
  }
  function finalize() { const sc = score().sum, best = BL.store.get("gamebest", {}); if (!best[s.sp] || sc > best[s.sp]) { best[s.sp] = sc; BL.store.set("gamebest", best); } }

  // ---------- Ansicht ----------
  function treeSVG() {
    const dead = s.phase !== "play", H = 40 + s.S * 16, cr = 14 + s.K * 7, rw = 10 + s.W * 9, gy = 200;
    const conifer = s.sp === "fichte", col = dead ? "#8a7a62" : s.sp === "birke" ? "#7fb24f" : conifer ? "#2c5a33" : "#3f7f34";
    let crown = "";
    if (!dead) crown = conifer ? `<path d="M110 ${gy - H - 16}L${110 + cr} ${gy - H * .35}L${110 - cr} ${gy - H * .35}Z" fill="${col}"/>`
      : `<ellipse cx="110" cy="${gy - H}" rx="${cr * 1.1}" ry="${cr * .85}" fill="${col}" opacity=".9"/><ellipse cx="${110 - cr * .5}" cy="${gy - H + 8}" rx="${cr * .6}" ry="${cr * .5}" fill="${col}"/><ellipse cx="${110 + cr * .5}" cy="${gy - H + 6}" rx="${cr * .6}" ry="${cr * .5}" fill="${col}"/>`;
    const trunk = s.phase === "over" ? `<ellipse cx="120" cy="${gy - 6}" rx="${H * .45}" ry="8" fill="#6b5a48"/>`
      : `<rect x="${110 - 3 - s.S * .9}" y="${gy - (dead ? H * .6 : H)}" width="${6 + s.S * 1.8}" height="${dead ? H * .6 : H}" fill="${s.sp === "birke" ? "#e9e9e4" : "#6b5444"}"/>`;
    const roots = Array.from({ length: 5 }, (_, i) => `<path d="M110 ${gy}Q${110 + (i - 2) * rw * .6} ${gy + 14 + (s.sp === "fichte" ? 0 : i % 2 * 10)} ${110 + (i - 2) * rw} ${gy + (s.sp === "fichte" ? 14 : 30 + (i % 2) * 10)}" stroke="#a88a66" stroke-width="2" fill="none"/>`).join("");
    const holes = s.holes + s.bigHoles + s.cards.filter(c => CARDS.find(x => x.id === c.id).slot === "hoehle").length;
    const holeSvg = holes && s.phase !== "over" ? `<ellipse cx="110" cy="${gy - H * .45}" rx="4" ry="6" fill="#1a120b"/>` : "";
    return `<svg viewBox="0 0 220 260" style="width:100%;height:auto;display:block" role="img" aria-label="Dein Baum">
      <rect y="${gy}" width="220" height="60" fill="var(--soil)" opacity=".35"/>${roots}${trunk}${crown}${holeSvg}
      <text x="8" y="16" font-family="IBM Plex Mono, monospace" font-size="11" fill="var(--ink)">${s.age} Jahre</text></svg>`;
  }
  function tableau() {
    const by = slot => s.cards.filter(c => CARDS.find(x => x.id === c.id).slot === slot).map(c => { const d = CARDS.find(x => x.id === c.id); return `<span class="gcard" title="${d.txt}">${d.e} ${d.n} <b>${d.pts}</b></span>`; }).join("");
    const deadCards = s.dead.map(n => { const d = DEAD.find(x => x.n === n); return `<span class="gcard" title="${d.txt}">${d.e} ${d.n} <b>${d.pts + (d.bonus === s.sp ? 2 : 0)}</b></span>`; }).join("");
    return `<div class="tableau">
      <div class="slot" style="grid-area:k"><span class="label">Krone</span>${by("krone")}</div>
      <div class="slot" style="grid-area:s"><span class="label">Stamm</span>${by("stamm")}</div>
      <div class="tree">${treeSVG()}</div>
      <div class="slot" style="grid-area:h"><span class="label">Höhlen · frei ${s.holes} klein, ${s.bigHoles} groß</span>${by("hoehle")}</div>
      <div class="slot" style="grid-area:w"><span class="label">${s.phase === "play" ? "Wurzel und Boden" : "Totholz"}</span>${s.phase === "play" ? by("wurzel") : by("wurzel") + deadCards}</div></div>`;
  }
  function render() {
    root.innerHTML = "";
    root.append(BL.html(`<div class="stack"><h2>Sei ein Baum</h2><p class="lead">Du bist ein Samen im Waldboden. Jede Runde vergehen ${YEARS} Jahre. Verteile deinen Zucker auf Krone, Wurzeln und Stamm, überstehe Dürre, Stürme und Käfer und biete möglichst vielen Arten ein Zuhause. Und wenn du stirbst, geht das Spiel weiter: im Totholz.</p></div>`));
    if (!s) return renderPick();
    if (s.phase === "over") return renderOver();
    const ev = EV(), Sp = SPECIES[s.sp];
    const wrap = BL.html(`<div class="gm"><div class="stack">${tableau()}<div class="panel"><h3>Tagebuch</h3><ul class="glog">${s.log.slice(0, 30).map(l => `<li>${l}</li>`).join("")}</ul></div></div><div class="stack" id="gm-side"></div></div>`);
    root.append(wrap);
    const side = BL.$("#gm-side", wrap);
    if (s.phase === "play") {
      side.append(BL.html(`<div class="ev"><span class="label">Runde ${s.round} · Jahr ${s.age - YEARS} bis ${s.age}</span><h3>${ev.n}</h3><p class="note">${ev.f}</p>
        <p class="num" style="font-size:.85rem">Licht ${"●".repeat(ev.light)}${"○".repeat(3 - ev.light)} · Wasser ${"●".repeat(ev.water)}${"○".repeat(3 - ev.water)}${s.S < 5 && !(s.gapRounds > 0 || ev.gap) ? " · du stehst im Schatten der Großen" : ""}</p></div>`));
      side.append(BL.html(`<div class="res">
        <div><span class="label">Zucker</span><b class="sugar">${s.sugar}</b></div><div><span class="label">Reserve</span><b>${s.R}</b></div>
        <div><span class="label">Vitalität</span><b style="color:${s.V < 4 ? "var(--warn)" : "inherit"}">${s.V}/10</b></div>
        <div><span class="label">Krone</span><b>${s.K}</b></div><div><span class="label">Wurzel</span><b>${s.W}</b></div><div><span class="label">Stamm</span><b>${s.S}</b></div>
        <div><span class="label">Abwehr</span><b>${s.A}</b></div><div><span class="label">Samen</span><b>${s.seeds}</b></div></div>`));
      side.append(BL.html(`<p class="note">Diese Runde: ${s.lastProd} Zucker durch Fotosynthese, ${s.lastUpkeep} verbraucht die Zellatmung (sie wächst mit deiner Größe).</p>`));
      side.append(BL.html(`<div class="panel stack"><h3>Zucker verteilen</h3><div class="alloc">${ACTIONS.map(a => {
        const c = cost(a), ok = a.ok() && s.sugar >= c;
        return `<button data-a="${a.k}" ${ok ? "" : "disabled"}><span>${a.n} <b class="sugar mono">${c}</b></span><small>${a.k === "seed" && !a.ok() ? `erst ab Stamm ${Sp.mature}` : a.d}</small></button>`;
      }).join("")}</div></div>`));
      side.append(BL.html(`<div class="panel stack"><h3>Wer möchte einziehen?</h3><p class="note">${s.hosted ? "Diese Runde ist schon jemand eingezogen." : "Eine Art pro Runde darf einziehen, wenn dein Baum die Bedingung erfüllt."}</p>
        <div class="market">${s.market.map(id => { const c = CARDS.find(x => x.id === id), ok = !s.hosted && c.req(s);
          return `<div class="mcard"><span class="em" aria-hidden="true">${c.e}</span><h4>${c.n}</h4><span class="meta">${SLOTS[c.slot]} · ${c.pts} Punkte</span><span class="meta">braucht: ${c.rq}</span><span class="meta">Wirkung: ${c.eff}</span><p class="note">${c.txt}</p><button class="btn ${ok ? "primary" : ""}" data-h="${id}" ${ok ? "" : "disabled"}>Einziehen lassen</button></div>`; }).join("")}</div></div>`));
      side.append(BL.html(`<div class="row"><button class="btn primary" id="gm-next">${YEARS} Jahre weiter</button><button class="btn" id="gm-restart">Neues Spiel</button></div>`));
    } else {
      side.append(BL.html(`<div class="ev"><span class="label">Totholz · Phase ${s.deadRound + 1} von 3</span><h3>${["Stehendes Totholz", "Der Stamm liegt am Boden", "Fast schon Humus"][s.deadRound]}</h3>
        <p class="note">Dein Baum ist ${s.deathCause}. Ein toter Baum beherbergt oft mehr Arten als ein lebender. Wähle, wer als Nächstes einzieht.</p></div>`));
      side.append(BL.html(`<div class="market">${s.market.map(n => { const d = DEAD.find(x => x.n === n);
        return `<div class="mcard"><span class="em" aria-hidden="true">${d.e}</span><h4>${d.n}</h4><span class="meta">${d.pts + (d.bonus === s.sp ? 2 : 0)} Punkte${d.bonus === s.sp ? " (Bonus für deine Art)" : ""}</span><p class="note">${d.txt}</p><button class="btn primary" data-d="${n}">Einziehen lassen</button></div>`; }).join("")}</div>`));
    }
    wrap.addEventListener("click", e => {
      const a = e.target.closest("[data-a]"), h = e.target.closest("[data-h]"), d = e.target.closest("[data-d]");
      if (a) act(a.dataset.a); else if (h) host(h.dataset.h); else if (d) pickDead(d.dataset.d);
      else if (e.target.id === "gm-next") endRound(); else if (e.target.id === "gm-restart") { s = null; save(); render(); }
    });
  }
  function renderPick() {
    const best = BL.store.get("gamebest", {});
    const node = BL.html(`<div class="stack"><h3>Wähle deine Baumart</h3><div class="species-pick">${Object.entries(SPECIES).map(([k, sp]) =>
      `<button data-sp="${k}"><div class="lf">${BL.leafSVG(BL.tree(k).leaf)}</div><b style="font-family:var(--display);font-weight:400;font-size:1.1rem">${sp.name}</b><span class="note">${sp.txt}</span><span class="mono" style="font-size:.75rem">wird etwa ${sp.max} Jahre alt${best[k] ? " · Rekord " + best[k] + " Punkte" : ""}</span></button>`).join("")}</div>
      <div class="panel prose"><h3>So funktioniert es</h3><ul>
        <li>Jede Runde bestimmt eine Ereigniskarte Licht und Wasser. Deine Blätter (Krone) machen daraus Zucker, aber nur so viel, wie die Wurzeln Wasser liefern.</li>
        <li>Die Zellatmung verbraucht Zucker, je größer du bist, desto mehr. Reicht der Zucker nicht, gehen Reserve und dann Vitalität verloren.</li>
        <li>Unter einem Stamm von 5 stehst du im Schatten älterer Bäume. Schattenbaumarten wie die Buche kommen damit besser zurecht.</li>
        <li>Bewohner bringen Punkte und manchmal Hilfe. Spechte zimmern Höhlen für Nachmieter, so entstehen Ketten wie im Kartenspiel Forest Shuffle.</li>
        <li>Punkte gibt es für dein Alter, deine Samen, alle Bewohner, die Vielfalt der besiedelten Bereiche und das Totholz nach deinem Tod.</li></ul></div></div>`);
    node.addEventListener("click", e => { const b = e.target.closest("[data-sp]"); if (b) start(b.dataset.sp); });
    root.append(node);
  }
  function renderOver() {
    const p = score(), best = BL.store.get("gamebest", {});
    root.append(BL.html(`<div class="gm"><div class="stack">${tableau()}</div><div class="stack">
      <div class="panel stack"><h3>${p.sum} Punkte</h3><p>Deine ${SPECIES[s.sp].name} wurde ${s.age} Jahre alt und ist ${s.deathCause}.</p>
      <table class="data"><tr><td>Alter (1 je ${YEARS} Jahre)</td><td class="num">${p.alter}</td></tr><tr><td>Samen (2 je Samen)</td><td class="num">${p.samen}</td></tr>
        <tr><td>Bewohner</td><td class="num">${p.bewohner}</td></tr><tr><td>Samenverstecker</td><td class="num">${p.extra}</td></tr>
        <tr><td>Vielfalt der Lebensräume</td><td class="num">${p.vielfalt}</td></tr><tr><td>Totholz-Bewohner</td><td class="num">${p.totholz}</td></tr></table>
      <p class="note">Rekord für diese Art: ${best[s.sp] || p.sum} Punkte</p>
      <div class="row"><button class="btn primary" id="gm-again">Nochmal als ${SPECIES[s.sp].name}</button><button class="btn" id="gm-other">Andere Baumart</button></div></div>
      <div class="panel prose"><h3>Was du gelernt hast</h3><p>Ein Baum muss ständig abwägen: Blätter bringen Zucker, kosten aber Wasser. Wurzeln bringen Wasser und Halt, aber kein Licht. Wer schnell in die Höhe wächst, entkommt dem Schatten, wird aber sturmanfälliger. Und nach dem Tod ist er noch Jahrzehnte lang Lebensraum und Nährstoffquelle für den Wald.</p></div>
      <div class="panel"><h3>Tagebuch</h3><ul class="glog">${s.log.map(l => `<li>${l}</li>`).join("")}</ul></div></div></div>`));
    BL.$("#gm-again", root).onclick = () => start(s.sp);
    BL.$("#gm-other", root).onclick = () => { s = null; save(); render(); };
  }
  return { init };
})();
