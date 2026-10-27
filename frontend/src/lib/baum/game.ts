// @ts-nocheck
/* eslint-disable */
// Baumleben: aus der eigenständigen Fassung übernommen, ungeprüftes JavaScript.
import { BL } from "./bl";
import { Dla } from "../dla/kern";
/* Sei ein Baum: Ressourcen-Spiel mit Bewohnerkarten (angelehnt an Forest Shuffle). Eine Runde = 15 Jahre. */
BL.Game = (function () {
  const YEARS = 15;
  const SPECIES = {
    buche: { name: "Rotbuche", max: 300, shade: .75, mature: 4, seedCost: 3, txt: "Schattenkünstlerin: wächst auch unter anderen Bäumen. Empfindlich bei Dürre.", drought: 1.2 },
    stieleiche: { name: "Stieleiche", max: 450, shade: .5, mature: 4, seedCost: 3, txt: "Lebt sehr lange und beherbergt die meisten Arten. Braucht Licht.", drought: .8 },
    fichte: { name: "Gemeine Fichte", max: 225, shade: .6, mature: 4, seedCost: 3, txt: "Wächst schnell, wurzelt flach. Borkenkäfer und Stürme sind gefährlich.", drought: 1.5, flat: true },
    birke: { name: "Hänge-Birke", max: 105, shade: .3, mature: 2, seedCost: 2, txt: "Pionierin: wächst rasant, bildet früh viele Samen, stirbt jung.", drought: 1, fast: true },
    waldkiefer: { name: "Waldkiefer", max: 300, shade: .35, mature: 3, seedCost: 2, txt: "Genügsam: wächst auf Sand und im Moor, wo andere hungern. Braucht viel Licht.", drought: .5, pine: true },
    schwarzerle: { name: "Schwarzerle", max: 120, shade: .45, mature: 2, seedCost: 2, txt: "Steht mit den Füßen im Wasser. Knöllchen an den Wurzeln holen Stickstoff aus der Luft.", drought: 1.4, fast: true, flood: true }
  };
  // Standorte: nur typische Arten. water verschiebt das Wasser der Ereignisse, prod die Fotosynthese (Nährstoffe),
  // capS/capW begrenzen Stamm und Wurzel, canopy = geschlossenes Kronendach über jungen Bäumen, ev ändert Ereignis-Gewichte.
  const BIOMES = {
    buchenwald: { n: "Buchenwald", sp: ["buche", "stieleiche", "fichte", "birke"], water: 0, prod: 1, capS: 8, capW: 8, canopy: true, ev: {},
      txt: "Frischer, nährstoffreicher Boden im Mittelgebirge. Unter alten Buchen ist es dunkel." },
    aue: { n: "Auwald am Fluss", sp: ["stieleiche", "schwarzerle"], water: 1, prod: 1.1, capS: 8, capW: 8, canopy: true, ev: { hochwasser: 4, duerre: -1 },
      txt: "Nährstoffreicher Schlick, im Frühjahr Hochwasser. Nur wer Überflutung verträgt, wächst hier." },
    moor: { n: "Hochmoor", sp: ["waldkiefer", "birke"], water: 1, prod: .6, capS: 3, capW: 3, canopy: false, ev: { kaefer: -1, luecke: -2 },
      txt: "Nasser, saurer Torf ohne Nährstoffe. Bäume bleiben klein und krumm, Wurzeln flach." },
    sand: { n: "Kiefernheide auf Sand", sp: ["waldkiefer", "birke", "stieleiche"], water: -1, prod: .85, capS: 7, capW: 8, canopy: false, ev: { trocken: 2, duerre: 2 },
      txt: "Trockener, armer Sandboden. Lichter Wald, oft Dürre." },
    berg: { n: "Bergwald", sp: ["fichte", "buche"], water: 1, prod: .9, capS: 7, capW: 8, canopy: true, ev: { sturm: 2, schnee: 3, hitze: -1 },
      txt: "Kalt und nass, kurze Sommer. Stürme und schwerer Schnee brechen Wipfel." }
  };
  const B = () => BIOMES[s.biome || "buchenwald"];
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
    { id: "verbiss", n: "Rehe im Revier", w: 2, light: 2, water: 2, browse: true, f: "Rehe fressen Knospen junger Bäume. Wer klein ist, verliert seine Spitze." },
    { id: "hochwasser", n: "Hochwasser", w: 0, light: 2, water: 3, flood: true, f: "Der Fluss tritt über die Ufer. Wochenlang steht Wasser im Wald, den Wurzeln fehlt Sauerstoff. Erlen und Eichen halten das aus." },
    { id: "schnee", n: "Nassschnee", w: 0, light: 2, water: 2, snow: true, f: "Schwerer, nasser Schnee bleibt auf den Ästen liegen. Breite Kronen brechen, schmale Fichtenkronen lassen ihn abrutschen." }
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
    { id: "efeu", n: "Efeu", e: "🌿", slot: "stamm", pts: 2, plant: true, req: s => s.S >= 3, rq: "Stamm 3", eff: "–", txt: "Klettert mit Haftwurzeln am Stamm hinauf, schadet dem Baum aber nicht. Blüht erst im Herbst und trägt im Spätwinter Beeren: Futter, wenn sonst nichts da ist." },
    { id: "windroeschen", n: "Buschwindröschen", e: "🌼", slot: "wurzel", pts: 1, plant: true, req: s => !["fichte", "waldkiefer"].includes(s.sp) && !["moor", "sand"].includes(s.biome), rq: "Laubbaum, frischer Boden", eff: "–", txt: "Frühblüher: blüht im März und April, bevor sich das Kronendach schließt. Lebt von Stärke im Wurzelstock." },
    { id: "heidelbeere", n: "Heidelbeere", e: "🫐", slot: "wurzel", pts: 2, plant: true, req: s => ["fichte", "waldkiefer"].includes(s.sp) || ["moor", "sand", "berg"].includes(s.biome), rq: "saurer Boden", eff: "–", txt: "Zwergstrauch auf saurem, nährstoffarmem Boden. Die Beeren fressen Vögel, Füchse und Bären." },
    { id: "farn", n: "Wurmfarn", e: "🌿", slot: "wurzel", pts: 1, plant: true, req: s => B().canopy || s.K >= 5, rq: "Schatten", eff: "–", txt: "Liebt feuchten Schatten. Vermehrt sich mit Sporen statt Samen, die Sporenhäufchen sitzen unter den Wedeln." },
    // Larven und Erwachsene: Engerlinge im Boden, Raupen und Blattkäfer je nach Baumart
    { id: "maikaefer", n: "Maikäfer", e: "🪲", slot: "krone", pts: 1, req: s => s.K >= 2 && !["fichte", "waldkiefer"].includes(s.sp), rq: "Laubbaum, Krone 2", eff: "–", txt: "Fliegt nur wenige Wochen im Mai und frisst Blätter von Eiche und Buche. Die meiste Zeit seines Lebens ist er Engerling im Boden." },
    { id: "engerling", n: "Maikäfer-Engerling", e: "🐛", slot: "wurzel", pts: 1, req: s => has(s, "maikaefer"), rq: "Maikäfer", eff: "–", txt: "Die Larve lebt drei bis vier Jahre im Boden und nagt an Feinwurzeln, dann verpuppt sie sich." },
    { id: "eichenwickler", n: "Eichenwickler-Raupe", e: "🐛", slot: "krone", pts: 1, req: s => s.sp === "stieleiche", rq: "Eiche", eff: "–", txt: "Kleine grüne Raupe, die junge Eichenblätter zusammenrollt. In manchen Jahren frisst sie ganze Kronen kahl." },
    { id: "buchenspinner", n: "Buchen-Streckfuß-Raupe", e: "🐛", slot: "krone", pts: 2, req: s => s.sp === "buche", rq: "Buche", eff: "–", txt: "Behaarte, gelbliche Raupe mit roten Haarpinseln. Frisst Buchenblätter und wird zu einem unscheinbaren Nachtfalter." },
    { id: "kiefernschwaermer", n: "Kiefernschwärmer-Raupe", e: "🐛", slot: "krone", pts: 2, req: s => ["fichte", "waldkiefer"].includes(s.sp), rq: "Nadelbaum", eff: "–", txt: "Grün-braun gestreift und gut getarnt zwischen Nadeln. Der Falter ist ein schneller Nachtflieger." },
    { id: "trauermantel", n: "Trauermantel-Raupe", e: "🐛", slot: "krone", pts: 2, req: s => s.sp === "birke", rq: "Birke", eff: "–", txt: "Schwarze, bedornte Raupen leben gesellig an Birken. Der Falter überwintert und fliegt schon im März." },
    { id: "erlenblattkaefer", n: "Blauer Erlenblattkäfer", e: "🪲", slot: "krone", pts: 1, req: s => s.sp === "schwarzerle", rq: "Erle", eff: "–", txt: "Käfer und Larven fressen Löcher in Erlenblätter. Die Erle treibt einfach neu aus." },
    { id: "falter", n: "Nachtfalter", e: "🦋", slot: "krone", pts: 1, req: s => hasRaupe(s), rq: "eine Raupe", eff: "–", txt: "Aus den Raupen werden Falter. Sie bestäuben nachts Blüten am Waldrand und sind Futter für Fledermäuse." },
    { id: "kuckuck", n: "Kuckuck", e: "🐦", slot: "krone", pts: 2, req: s => hasRaupe(s), rq: "eine Raupe", eff: "schützt vor Raupen", txt: "Frisst sogar behaarte Raupen, die andere Vögel meiden. Seine Eier legt er in fremde Nester." },
    // Säugetiere am Boden rund um den Baum
    { id: "reh", n: "Reh", e: "🦌", slot: "wurzel", pts: 1, ground: true, req: s => true, rq: "–", eff: "–", txt: "Frisst Knospen, Kräuter und Früchte. Junge Bäume verbeißt es, alte Bäume bieten ihm Deckung." },
    { id: "roetelmaus", n: "Rötelmaus", e: "🐭", slot: "wurzel", pts: 1, ground: true, req: s => s.seeds >= 1, rq: "1 Samen", eff: "–", txt: "Frisst Samen, Knospen und Pilze. In Mastjahren vermehrt sie sich stark." },
    { id: "fuchs", n: "Rotfuchs", e: "🦊", slot: "wurzel", pts: 2, ground: true, req: s => has(s, "roetelmaus"), rq: "Rötelmaus", eff: "–", txt: "Jagt Mäuse mit einem hohen Sprung, dem Mäusesprung. Gräbt seinen Bau gern zwischen Wurzeln." },
    { id: "wildschwein", n: "Wildschwein", e: "🐗", slot: "wurzel", pts: 3, ground: true, req: s => s.seeds >= 2 && ["stieleiche", "buche"].includes(s.sp), rq: "2 Samen, Eiche oder Buche", eff: "–", txt: "Kommt zur Mast: Eicheln und Bucheckern sind sein Herbstfutter. Beim Wühlen lockert es den Boden." },
    { id: "dachs", n: "Dachs", e: "🦡", slot: "wurzel", pts: 2, ground: true, req: s => s.W >= 3, rq: "Wurzel 3", eff: "–", txt: "Gräbt weitläufige Baue zwischen starken Wurzeln und frisst vor allem Regenwürmer und Engerlinge." },
    { id: "siebenschlaefer", n: "Siebenschläfer", e: "🐭", slot: "hoehle", pts: 3, req: s => s.holes > 0 && ["stieleiche", "buche"].includes(s.sp), rq: "Höhle, Eiche oder Buche", eff: "–", txt: "Frisst im Herbst Bucheckern und Eicheln und schläft dann sieben Monate in einer Baumhöhle." },
    { id: "kleiber", n: "Kleiber", e: "🐦", slot: "hoehle", pts: 2, req: s => s.holes > 0, rq: "Höhle", eff: "–", txt: "Mauert den Eingang einer Spechthöhle mit Lehm passend zu, damit kein größerer Vogel hineinpasst." },
    { id: "fledermaus", n: "Großer Abendsegler", e: "🦇", slot: "hoehle", pts: 3, req: s => s.holes > 0, rq: "Höhle", eff: "schützt vor Raupen", txt: "Fledermaus, die in Baumhöhlen überwintert und nachts Nachtfalter jagt." },
    { id: "kauz", n: "Waldkauz", e: "🦉", slot: "hoehle", pts: 4, req: s => s.bigHoles > 0, rq: "große Höhle", eff: "–", txt: "Häufigste Eule Mitteleuropas. Brütet in großen Höhlen alter Bäume." },
    { id: "taube", n: "Hohltaube", e: "🕊️", slot: "hoehle", pts: 3, req: s => s.bigHoles > 0, rq: "große Höhle", eff: "–", txt: "Die einzige heimische Taube, die in Höhlen brütet, fast nur in Schwarzspechthöhlen." }
  ];
  // Totholz zerfällt in sechs Stufen (je zwei Runden à 10 Jahre). sub = Stufen, in denen die Art einziehen kann;
  // bonus = Baumarten, an deren Holz sie besonders hängt (+2).
  const SUBS = [
    { n: "Frisch abgestorben", main: 0, txt: "Die Rinde sitzt noch fest, das Holz ist voller Zucker und Stärke. Die ersten sind Käfer und Holzwespen, die ihre Eier unter die Rinde legen, dicht gefolgt von Spechten auf Larvensuche." },
    { n: "Die Rinde löst sich", main: 0, txt: "Pilzfäden durchziehen das Holz, die Rinde blättert ab. Dahinter entstehen Verstecke für Fledermäuse und Vögel, außen wachsen Baumpilze." },
    { n: "Frisch gefallen", main: 1, txt: "Der Stamm liegt am Boden, der Wurzelteller ragt in die Luft. Unter dem feuchten Holz finden Amphibien und Kleinsäuger Verstecke." },
    { n: "Morsch und weich", main: 1, txt: "Weiß- und Braunfäule haben das Holz weich gemacht. Asseln, Schnecken und Käferlarven fressen sich hindurch." },
    { n: "Mulm", main: 2, txt: "Vom Stamm ist ein krümeliger, dunkler Mulm übrig. Bodentiere zerkleinern ihn weiter." },
    { n: "Humus", main: 2, txt: "Bakterien zerlegen den Rest zu CO₂, Wasser und Nährsalzen. Auf dem Moderholz keimen neue Bäume: Der Kreislauf schließt sich." }
  ];
  const SUB_ROUNDS = 2, SUB_YEARS = 10;
  const DEAD = [
    { n: "Borkenkäfer", sub: [0], e: "🪲", pts: 2, bonus: ["fichte"], txt: "Legt seine Brutgänge unter der Rinde frisch abgestorbener Fichten an. Im toten Baum richtet er keinen Schaden an." },
    { n: "Holzwespe", sub: [0], e: "🐝", pts: 2, bonus: ["fichte", "waldkiefer"], txt: "Bringt Pilzsporen mit ins Holz, von denen sich ihre Larven ernähren." },
    { n: "Alpenbock", sub: [0], e: "🪲", pts: 4, bonus: ["buche"], txt: "Seltener blauer Bockkäfer in besonntem Buchentotholz." },
    { n: "Rothalsbock", sub: [0, 1], e: "🪲", pts: 2, txt: "Seine Larven fressen sich zwei Jahre lang durch frisch abgestorbenes Holz." },
    { n: "Specht auf Larvensuche", sub: [0, 1], e: "🐦", pts: 2, txt: "Spechte hacken Käferlarven aus dem Holz und öffnen es so für Pilze." },
    { n: "Hallimasch", sub: [0, 1], e: "🍄", pts: 2, txt: "Seine Pilzfäden leuchten im Dunkeln schwach (Biolumineszenz)." },
    { n: "Zunderschwamm", sub: [1], e: "🍄", pts: 3, txt: "Weißfäule: baut Lignin ab, das Holz wird hell und faserig. Früher Zunder zum Feuermachen." },
    { n: "Birkenporling", sub: [1], e: "🍄", pts: 3, bonus: ["birke"], txt: "Wächst nur an Birken. Früher zog man auf ihm Rasiermesser ab." },
    { n: "Erlen-Schillerporling", sub: [1], e: "🍄", pts: 3, bonus: ["schwarzerle"], txt: "Rostbrauner Porling, der fast nur an Erlen wächst." },
    { n: "Mopsfledermaus", sub: [1], e: "🦇", pts: 3, txt: "Schläft tagsüber in schmalen Spalten hinter abstehender Rinde." },
    { n: "Baumläufer-Nest", sub: [1], e: "🐦", pts: 2, txt: "Der Waldbaumläufer baut sein Nest hinter loser Rinde." },
    { n: "Baummarder", sub: [1], e: "🦦", pts: 3, needsHole: true, txt: "Nutzt alte Spechthöhlen als Schlafplatz." },
    { n: "Zaunkönig", sub: [2], e: "🐦", pts: 2, txt: "Baut sein Nest gern im Wurzelteller umgestürzter Bäume." },
    { n: "Feuersalamander", sub: [2, 3], e: "🦎", pts: 3, txt: "Versteckt sich tagsüber unter feuchten, liegenden Stämmen." },
    { n: "Erdkröte", sub: [2], e: "🐸", pts: 2, txt: "Überwintert in Hohlräumen unter liegendem Holz." },
    { n: "Igel", sub: [2], e: "🦔", pts: 2, txt: "Baut sein Winternest aus Laub im Schutz des Stammes." },
    { n: "Schwefelporling", sub: [2], e: "🍄", pts: 2, bonus: ["stieleiche"], txt: "Leuchtend gelber Porling, oft an Eichen. Braunfäule: Das Holz zerfällt in würfelige Stücke." },
    { n: "Moose", sub: [2, 3], e: "🌱", pts: 1, txt: "Überziehen den liegenden Stamm und halten ihn feucht." },
    { n: "Asseln", sub: [3, 4], e: "🐛", pts: 2, txt: "Krebstiere an Land. Sie zerkleinern morsches Holz für Pilze und Bakterien." },
    { n: "Schleimpilz", sub: [3], e: "🟡", pts: 2, txt: "Kriecht als Plasmodium über das Holz und frisst Bakterien." },
    { n: "Hirschkäfer", sub: [3, 4], e: "🪲", pts: 4, bonus: ["stieleiche"], txt: "Die Larve lebt fünf bis acht Jahre in morschen Eichenwurzeln." },
    { n: "Tigerschnegel", sub: [3], e: "🐌", pts: 1, txt: "Gefleckte Nacktschnecke, frisst Pilze und Algen am morschen Holz." },
    { n: "Lederlaufkäfer", sub: [3], e: "🪲", pts: 2, txt: "Jagt nachts Schnecken und versteckt sich tagsüber unter Totholz." },
    { n: "Stockschwämmchen", sub: [3], e: "🍄", pts: 2, txt: "Büschel kleiner, essbarer Pilze auf morschen Laubholzstümpfen." },
    { n: "Rosenkäfer", sub: [3, 4], e: "🪲", pts: 2, txt: "Seine Engerlinge entwickeln sich im Holzmulm." },
    { n: "Springschwänze", sub: [4, 5], e: "🦗", pts: 2, txt: "Winzige Bodentiere, bis zu 100.000 pro Quadratmeter Waldboden." },
    { n: "Tausendfüßer", sub: [4], e: "🐛", pts: 2, txt: "Zerkleinern Mulm und Laub und machen es für Bakterien zugänglich." },
    { n: "Hornmilben", sub: [4], e: "🕷️", pts: 1, txt: "Winzige, gepanzerte Milben, Hunderttausende pro Quadratmeter. Sie fressen Pilzfäden." },
    { n: "Regenwürmer", sub: [4, 5], e: "🪱", pts: 2, txt: "Ziehen den Mulm in den Boden und mischen ihn mit Erde." },
    { n: "Bakterien", sub: [5], e: "🦠", pts: 2, txt: "Zerlegen den Rest zu CO₂, Wasser und Nährsalzen. Die Nährsalze nehmen die Nachbarbäume auf." },
    { n: "Maulwurf", sub: [5], e: "🐾", pts: 2, txt: "Gräbt im lockeren Humus nach Regenwürmern." },
    { n: "Pilzgeflecht", sub: [5], e: "🍄", pts: 1, txt: "Mykorrhizapilze der Nachbarbäume wachsen in den frischen Humus." },
    { n: "Neuer Keimling", sub: [5], e: "🌱", pts: 4, txt: "Rannenverjüngung: Auf dem feuchten Moderholz keimt ein neuer Baum. Der Kreislauf beginnt von vorn." }
  ];
  const bon = d => (d.bonus || []).includes(s.sp);
  const deadPts = d => d.pts + (bon(d) ? 2 : 0);
  const HELP = `<p>Du bist ein Samen im Waldboden. Jede Runde vergehen ${YEARS} Jahre. Verteile deinen Zucker auf Krone, Wurzeln und Stamm, überstehe Dürre, Stürme und Käfer und biete möglichst vielen Arten ein Zuhause. Und wenn du stirbst, geht das Spiel weiter: im Totholz.</p>
<ul>
        <li>Jede Runde bestimmt eine Ereigniskarte Licht und Wasser. Deine Blätter (Krone) machen daraus Zucker, aber nur so viel, wie die Wurzeln Wasser liefern.</li>
        <li>Die Zellatmung verbraucht Zucker, je größer du bist, desto mehr. Reicht der Zucker nicht, gehen Reserve und dann Vitalität verloren.</li>
        <li>Wachsen kostet so viel Zucker wie die jetzige Stufe (Stamm 1 mehr): Der erste Schritt ist billig, später wird es teuer. Ungenutzter Zucker wird veratmet, also lieber als Stärke speichern.</li>
        <li>Was du tun kannst, hängt vom Lebensabschnitt ab: Ein Sämling wächst nur, ein mannbarer Baum bildet Samen, ein Altbaum wächst nicht mehr in die Höhe. Im Totholz geht es in sechs Stufen weiter, je zwei Runden à 10 Jahre: frisch abgestorben, Rinde löst sich, frisch gefallen, morsch, Mulm, Humus. In jeder Stufe ziehen andere Tiere, Pilze und Zersetzer ein.</li>
        <li>Unter einem Stamm von 5 stehst du im Schatten älterer Bäume. Schattenbaumarten wie die Buche kommen damit besser zurecht. Lichtbaumarten verkümmern, wenn sie zu lange klein im Schatten stehen. Im Moor und auf der Heide gibt es kein geschlossenes Kronendach.</li>
        <li>Der Standort zählt: Im Moor bleibst du klein, auf Sand ist es trocken, in der Aue kommt Hochwasser, im Bergwald Sturm und Schnee. Zweimal abgefressene Spitzen oder ein abgebrochener Wipfel führen zu Krüppelwuchs.</li>
        <li>Mindestens 1 Zucker hast du jede Runde, auch im schlechtesten Jahr.</li>
        <li>Arten, die zusammenleben, bilden Gemeinschaften und bringen Extrapunkte (🤝): Marienkäfer fressen Blattläuse, Kleiber ziehen in Spechthöhlen, Moose und Farne lieben feuchten Schatten. Manche Arten stören sich aber auch (⚔️): Ameisen verjagen Marienkäfer.</li>
        <li>Viele Insekten leben erst als Larve bei dir: Engerlinge im Boden, Raupen in der Krone. Kommen später Maikäfer oder Falter dazu, ist die Verwandlung komplett. Rund um den Baum leben auch Säugetiere: Reh, Wildschwein, Dachs, Fuchs, Rötelmaus und Siebenschläfer.</li>
        <li>Neben Tieren und Pilzen wachsen auch Pflanzen an und unter dir: Efeu am Stamm, Frühblüher unter Laubbäumen, Heidelbeeren auf saurem Boden, Farne im Schatten.</li>
        <li>Bewohner bringen Punkte und manchmal Hilfe. Spechte zimmern Höhlen für Nachmieter, so entstehen Ketten wie im Kartenspiel Forest Shuffle.</li>
        <li>Punkte gibt es für dein Alter, deine Samen, alle Bewohner, die Vielfalt der besiedelten Bereiche und das Totholz nach deinem Tod.</li></ul>`;
  // Dialog für Anleitung und Tagebuch; liegt im .baumleben-Bereich, damit die Stile greifen
  function popup(title, html) {
    const dlg = BL.html(`<dialog class="gdlg prose" aria-label="${title}"><div class="row" style="justify-content:space-between"><h3 style="margin:0">${title}</h3><button class="btn" data-close>Schließen</button></div>${html}</dialog>`);
    root.append(dlg); dlg.showModal();
    dlg.addEventListener("click", e => { if (e.target.closest("[data-close]") || e.target === dlg) dlg.close(); });
    dlg.addEventListener("close", () => dlg.remove());
  }
  // Gemeinschaften: Arten, die zusammen mehr ergeben (wie Kartenketten in Forest Shuffle). Negative Werte sind Konkurrenz.
  const SYN = [
    { a: ["marienkaefer", "laus"], pts: 2, n: "Fressen und gefressen werden", txt: "Eine Marienkäferlarve frisst Hunderte Blattläuse." },
    { a: ["ameise", "laus"], pts: 2, n: "Honigtau-Melker", txt: "Ameisen melken Blattläuse und schützen sie dafür vor Fressfeinden." },
    { a: ["ameise", "marienkaefer"], pts: -1, n: "Konkurrenz", txt: "Ameisen verjagen Marienkäfer von ihren Blattlauskolonien." },
    { a: ["myko", "steinpilz"], pts: 2, n: "Pilz und Fruchtkörper", txt: "Der Steinpilz ist nur der Fruchtkörper, das eigentliche Lebewesen ist das Geflecht an deinen Wurzeln." },
    { a: ["wurm", "myko"], pts: 1, n: "Gesunder Boden", txt: "Regenwürmer lockern den Boden, Pilzfäden halten ihn zusammen: Wasser und Luft kommen an die Wurzeln." },
    { a: ["bunt", "kleiber"], pts: 2, n: "Höhlen-Nachmieter", txt: "Der Kleiber bezieht eine alte Buntspechthöhle und mauert den Eingang passend zu." },
    { a: ["bunt", "meise"], pts: 1, n: "Höhlen-Nachmieter", txt: "Kohlmeisen brüten gern in verlassenen Spechthöhlen." },
    { a: ["bunt", "fledermaus"], pts: 1, n: "Höhlen-Nachmieter", txt: "Abendsegler überwintern in alten Spechthöhlen." },
    { a: ["schwarz", "kauz"], pts: 2, n: "Große Höhle", txt: "Der Waldkauz brütet in der geräumigen Schwarzspechthöhle." },
    { a: ["schwarz", "taube"], pts: 2, n: "Große Höhle", txt: "Die Hohltaube ist fast ganz auf Schwarzspechthöhlen angewiesen." },
    { a: ["hoernchen", "haeher"], pts: 2, n: "Samenverstecker", txt: "Beide vergraben Vorräte und vergessen viele: So wandert der Wald." },
    { a: ["baumlaeufer", "flechte"], pts: 1, n: "Rindensucher", txt: "Zwischen Flechten und Rindenritzen findet der Baumläufer Spinnen und Insekteneier." },
    { a: ["meise", "gallwespe"], pts: 1, n: "Gallenjäger", txt: "Meisen hacken Gallen auf und fressen die Larven darin." },
    { a: ["efeu", "fledermaus"], pts: 1, n: "Versteck im Efeu", txt: "Fledermäuse ruhen tagsüber hinter dichtem Efeu." },
    { a: ["windroeschen", "wurm"], pts: 1, n: "Frühling im Laub", txt: "Regenwürmer machen aus dem Falllaub den Humus, in dem die Frühblüher wurzeln." },
    { a: ["heidelbeere", "moos"], pts: 1, n: "Teppich aus Moos und Beeren", txt: "Auf saurem Boden bilden Moose und Heidelbeeren gemeinsam die Bodendecke." },
    { a: ["farn", "moos"], pts: 1, n: "Feuchter Schatten", txt: "Farne und Moose halten den Boden feucht und kühl." },
    { a: ["maikaefer", "engerling"], pts: 2, n: "Verwandlung", txt: "Aus dem Engerling wird nach drei bis vier Jahren im Boden ein Maikäfer." },
    { a: ["wildschwein", "engerling"], pts: 2, n: "Wühlen nach Engerlingen", txt: "Wildschweine brechen den Boden um und fressen Engerlinge und Mäusenester." },
    { a: ["dachs", "engerling"], pts: 1, n: "Engerlinge ausgraben", txt: "Der Dachs gräbt Engerlinge aus dem Boden." },
    { a: ["dachs", "wurm"], pts: 1, n: "Regenwurmjäger", txt: "Regenwürmer sind die Hauptnahrung des Dachses." },
    { a: ["fledermaus", "falter"], pts: 2, n: "Nachtjäger", txt: "Abendsegler fangen Nachtfalter im Flug." },
    { a: ["roetelmaus", "fuchs"], pts: 2, n: "Jäger und Beute", txt: "Der Fuchs lebt in vielen Gegenden vor allem von Mäusen." },
    { a: ["roetelmaus", "kauz"], pts: 2, n: "Mäusejäger", txt: "Der Waldkauz jagt nachts Mäuse am Waldboden." },
    { a: ["siebenschlaefer", "bunt"], pts: 1, n: "Höhlen-Nachmieter", txt: "Der Siebenschläfer schläft in alten Spechthöhlen." },
    ...["eichenwickler", "buchenspinner", "kiefernschwaermer", "trauermantel"].flatMap(r => [
      { a: [r, "falter"], pts: 2, n: "Verwandlung", txt: "Aus der Raupe wird über die Puppe ein Falter." },
      { a: [r, "meise"], pts: 1, n: "Raupenfutter", txt: "Ein Meisenpaar verfüttert an seine Jungen Zehntausende Raupen." },
      { a: [r, "kuckuck"], pts: 2, n: "Raupenfutter", txt: "Der Kuckuck frisst sogar behaarte Raupen." }
    ]),
    { a: ["erlenblattkaefer", "meise"], pts: 1, n: "Käferfutter", txt: "Meisen sammeln Käferlarven von den Erlenblättern." }
  ];
  const synActive = () => SYN.filter(g => g.a.every(id => has(s, id)));
  // Was eine Karte im Markt zusammen mit schon vorhandenen Arten bringen würde
  const synWith = id => SYN.filter(g => g.a.includes(id) && g.a.every(x => x === id || has(s, x)));
  const nameOf = id => CARDS.find(c => c.id === id).n;
  const SLOTS = { krone: "Krone", stamm: "Stamm", hoehle: "Höhlen", wurzel: "Wurzel und Boden" };
  const RAUPEN = ["eichenwickler", "buchenspinner", "kiefernschwaermer", "trauermantel", "erlenblattkaefer"];
  const hasRaupe = s => RAUPEN.some(id => has(s, id));
  const has = (s, id) => s.cards.some(c => c.id === id);

  let root, s = null, pickBiome = null;
  const CSS = `
  .gm { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 14px; align-items: start }
  .gm .stack { gap: 10px }
  .gm-head { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between }
  .gm-head h2 { margin: 0 }
  .gdlg { margin: auto; width: min(720px, 92vw); max-height: 85vh; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); color: var(--ink); padding: 16px 18px }
  .gdlg::backdrop { background: rgba(0, 0, 0, .55) }
  .gdlg .glog { max-height: none }
  @media (max-width: 900px) { .gm { grid-template-columns: minmax(0, 1fr) } }
  .tableau { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-areas: "t t" "k s" "h w" "g g"; gap: 8px; align-items: stretch }
  .gcard b.neg { color: var(--warn) }
  .mcard .syn { font-size: .68rem; color: color-mix(in srgb, var(--leaf) 55%, var(--ink)) }
  .mcard .syn.neg { color: var(--warn) }
  .tableau .slot { border: 1px dashed var(--line); border-radius: 10px; padding: 5px; min-height: 40px; display: flex; flex-wrap: wrap; gap: 4px; align-content: flex-start; min-width: 0 }
  .tableau .slot > .label { width: 100% }
  .gcard { border: 1px solid var(--line); border-radius: 8px; background: var(--panel); padding: 2px 6px; font-size: .74rem; display: inline-flex; gap: 4px; align-items: center }
  .gcard b { font-family: var(--mono); font-size: .75rem; color: color-mix(in srgb, var(--leaf) 55%, var(--ink)) }
  .tableau .tree { grid-area: t; border: 1px solid var(--line); border-radius: 12px; background: var(--sky); overflow: hidden; min-width: 0 }
  .tableau .tree canvas { display: block }
  .market { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px }
  .mcard { border: 1px solid var(--line); border-radius: 10px; padding: 8px; background: var(--panel); display: grid; gap: 3px; align-content: start; font-size: .8rem }
  .mcard .em { font-size: 1.3rem; line-height: 1 }
  .mcard h4 { margin: 0; font-family: var(--display); font-weight: 400; font-size: .95rem }
  .mcard .meta { font-family: var(--mono); font-size: .68rem; color: var(--muted) }
  .mcard .txt { font-size: .74rem; margin: 0; line-height: 1.35 }
  .mcard h4 { hyphens: auto; overflow-wrap: anywhere }
  .mcard .top { display: flex; gap: 6px; align-items: center }
  .ev { border: 2px solid var(--phloem); border-radius: 12px; padding: 8px 10px; background: var(--panel); display: grid; gap: 4px }
  .ev h3 { margin: 0; font-size: 1.05rem }
  .ev .note { font-size: .8rem; margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden }
  .ev .last { font-size: .78rem; border-top: 1px dashed var(--line); padding-top: 4px; margin: 0 }
  .gm .panel { padding: 10px 12px }
  .gm .panel h3 { margin: 0 0 4px; font-size: 1rem }
  .alloc { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 6px }
  .alloc button { text-align: left; padding: 5px 8px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); cursor: pointer; display: grid; gap: 2px }
  .alloc button:hover:not(:disabled) { border-color: var(--border-selected) }
  .alloc button:disabled { opacity: .45; cursor: not-allowed }
  .alloc small { color: var(--muted); font-size: .7rem }
  .res { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5px }
  .res div { background: var(--leaf-soft); border-radius: 8px; padding: 3px 7px }
  .res .label { font-size: .62rem }
  .res b { display: block; font-family: var(--mono); font-size: 1rem }
  .sugar { color: color-mix(in srgb, var(--phloem) 70%, var(--ink)) }
  .glog { font-size: .85rem; display: grid; gap: 3px; max-height: 220px; overflow: auto; margin: 0; padding-left: 1.1em }
  .species-pick { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px }
  .species-pick button { text-align: left; border: 1px solid var(--line); border-radius: 10px; padding: 12px; background: var(--panel); cursor: pointer; display: grid; gap: 6px }
  .species-pick button:hover { border-color: var(--border-selected) }
  .species-pick .lf { height: 80px }
  `;
  function init(el) {
    root = el; BL.addStyle(CSS);
    s = BL.store.get("game", null);
    render();
  }
  function save() { BL.store.set("game", s); }

  function start(sp, biome) {
    s = { sp, biome, seed: 1 + Math.floor(Math.random() * 1e5), round: 0, kr: "", browsed: 0, shadeRounds: 0, age: 0, K: 1, W: 1, S: 1, A: 0, R: 2, V: 10, seeds: 0, cards: [], holes: 0, bigHoles: 0, log: [], phase: "play",
      sugar: 0, gapRounds: 0, hosted: false, seedsRound: 0, dead: [], deadRound: 0, market: [], event: null, deathCause: "" };
    newRound(); save(); render();
  }
  function pickEvent() {
    const w = e => Math.max(0, e.w + (B().ev[e.id] || 0));
    const pool = EVENTS.filter(e => !(e.browse && s.S > 2) && w(e) > 0);
    const tot = pool.reduce((a, e) => a + w(e), 0); let x = Math.random() * tot;
    for (const e of pool) { x -= w(e); if (x <= 0) return e; } return pool[0];
  }
  function newRound() {
    const Sp = SPECIES[s.sp], Bi = B(), ev = pickEvent(), young = s.S <= 2; s.event = ev.id; s.round++; s.hosted = false; s.seedsRound = 0;
    const msgs = [];
    let early = "";
    // Licht: unter dem Kronendach (Stamm < 5) Schatten; im Moor und auf der Heide gibt es kein geschlossenes Dach
    if (ev.gap) s.gapRounds = 2;
    let light = ev.light / 2;
    const shaded = Bi.canopy && s.S < 5 && s.gapRounds <= 0;
    if (shaded) light *= Sp.shade;
    if (s.gapRounds > 0) s.gapRounds--;
    // Lichtbaumarten verkümmern, wenn sie als kleiner Jungbaum zu lange unter dem Kronendach stehen
    if (shaded && Sp.shade < .6 && s.S < 2 && s.round > 1) {
      s.shadeRounds = (s.shadeRounds || 0) + 1;
      if (s.shadeRounds >= 4) early = "im Schatten der Großen verkümmert";
      else msgs.push(`Zu wenig Licht: Noch ${4 - s.shadeRounds} ${4 - s.shadeRounds === 1 ? "Runde" : "Runden"} unter Stamm 2, dann verkümmerst du`);
    } else s.shadeRounds = 0;
    // Ereignis-Schäden
    if (ev.frost && s.K > 1) { s.K--; msgs.push("Frost: Krone −1"); }
    else if (ev.frost && young) { s.V -= 2; msgs.push("Frost: Der junge Trieb erfriert, Vitalität −2"); }
    if (ev.browse) {
      if (s.K > 1) s.K--;
      s.browsed = (s.browsed || 0) + 1;
      if (s.browsed >= 2 && !s.kr) { s.kr = "Rehe haben den Leittrieb zweimal abgefressen. Seitentriebe übernehmen, der Stamm wird krumm und mehrteilig."; msgs.push("Verbiss: Leittrieb wieder weg, Krüppelwuchs"); }
      else msgs.push("Verbiss: Krone −1, Stamm kann diese Runde nicht wachsen");
    }
    if (ev.storm) {
      const risk = s.S - s.W - (Sp.flat ? 0 : 1);
      if (risk >= 2 && !s.kr) {
        s.V -= 2 + risk; s.K = Math.max(1, s.K - 1); s.S = Math.max(1, s.S - 1); s.holes++;
        s.kr = "Der Sturm hat den Wipfel abgebrochen. Ein Seitenast wird zur neuen Spitze, in der Bruchstelle fault eine Höhle.";
        msgs.push(`Sturm: Wipfelbruch, Stamm −1, Vitalität −${2 + risk}, eine Höhle entsteht. Krüppelwuchs`);
      }
      else if (risk >= 1) { s.V -= 2 + risk; s.K = Math.max(1, s.K - 1); msgs.push(`Sturm: Wurzeln zu schwach für den hohen Stamm, Vitalität −${2 + risk}`); }
      else { s.V -= 1; msgs.push("Sturm: ein paar Äste brechen, Vitalität −1"); }
    }
    if (ev.flood) {
      if (!Sp.flood && s.sp !== "stieleiche") { s.V -= 3; msgs.push("Hochwasser: Die Wurzeln ersticken, Vitalität −3"); }
      else if (young) { s.V -= 1; msgs.push("Hochwasser: Schlamm überdeckt den kleinen Baum, Vitalität −1"); }
      else msgs.push("Hochwasser: Deine Wurzeln halten den Sauerstoffmangel aus");
    }
    if (ev.snow) {
      if (s.sp !== "fichte" && s.K >= 4) { s.K--; s.V -= 1; msgs.push("Nassschnee: Äste brechen unter der Last, Krone −1, Vitalität −1"); }
      else msgs.push("Nassschnee: Der Schnee rutscht ab, kaum Schaden");
    }
    if (ev.beetle) {
      const weak = s.A < 2 || s.V < 5; const dmg = weak ? (s.sp === "fichte" ? 4 : 2) : 0;
      if (dmg) { s.V -= dmg; msgs.push(`Borkenkäfer: zu wenig Abwehr, Vitalität −${dmg}`); } else msgs.push("Borkenkäfer: mit Harz und Gerbstoffen abgewehrt");
    }
    if (ev.caterpillar) {
      const prot = has(s, "meise") || has(s, "fledermaus") || has(s, "ameise") || has(s, "kuckuck");
      if (prot) msgs.push("Raupen: Meisen, Fledermäuse oder Ameisen halten sie klein");
      else { s.K = Math.max(1, s.K - 1); s.V -= 1; msgs.push("Raupen: Krone −1, Vitalität −1"); }
    }
    // Produktion: 1 Zucker kommt immer (Stamm und junge Triebe sind grün), der Rest aus der Krone nach Licht und Wasser.
    // Große Kronen beschatten sich selbst (innen wenig Licht), deshalb bringt jede Kronenstufe etwas weniger.
    // Die Atmung wächst langsamer als die Fotosynthese, damit Wachstum sich lohnt (Werte per Simulation abgestimmt).
    // Der Standort verschiebt das Wasser und begrenzt über die Nährstoffe die Fotosynthese.
    const water = s.W * BL.clamp(ev.water + Bi.water, 0, 3) / 2 + (has(s, "myko") ? 1 : 0) + (has(s, "wurm") ? .5 : 0);
    const wf = Math.min(1, water / Math.max(1, s.K));
    const prod = 1 + Math.round((s.K * (1 - s.K / 20) * 3 * light * wf + (Sp.fast ? 1 : 0)) * Bi.prod);
    const upkeep = Math.round((s.K + s.W + s.S) / 4) + (ev.resp || 0) + (has(s, "myko") ? 1 : 0) + (has(s, "laus") && !has(s, "marienkaefer") ? 1 : 0);
    let net = prod - upkeep;
    if (wf < .5) { const d = Math.round((1 - wf) * 2 * Sp.drought); if (d) { s.V -= d; msgs.push(`Wassermangel: Vitalität −${d}`); } }
    if (net < 0) {
      const take = Math.min(s.R, -net); s.R -= take; net += take;
      // Ein hungernder Baum wirft ab, was am meisten kostet: Blätter oder Feinwurzeln. So kann er sich wieder fangen.
      if (net < 0) {
        const part = s.W > s.K ? "W" : "K"; s[part] = Math.max(1, s[part] - 1); s.V -= 2; net = 0;
        msgs.push(`Zuckermangel: Die Atmung frisst mehr, als die Blätter liefern. ${part === "W" ? "Feinwurzeln sterben ab, Wurzel" : "Krone"} −1, Vitalität −2`);
      }
      else msgs.push(`Reserve genutzt: −${take} Zucker`);
    } else if (s.V < 10 && wf >= .5 && s.age < Sp.max) s.V = Math.min(10, s.V + 1);
    // Ein bisschen bleibt immer: Rinde und Knospen machen auch in schlechten Jahren etwas Zucker
    s.sugar = Math.max(1, net); s.lastProd = prod; s.lastUpkeep = upkeep;
    // Alter
    s.age += YEARS;
    if (s.age > Sp.max) { const d = 2 + Math.floor((s.age - Sp.max) / 30); s.V -= d; msgs.push(`Alter: Pilze dringen ein, Äste sterben ab. Vitalität −${d}`); }
    s.market = []; fillMarket();
    s.log.unshift(`Jahr ${s.age}: ${ev.n}. +${prod} Zucker, −${upkeep} Atmung${msgs.length ? ". " + msgs.join(". ") : ""}`);
    if (early) die(early);
    else if (s.V <= 0) die(ev.storm ? "vom Sturm geworfen" : ev.beetle ? "von Borkenkäfern getötet" : ev.flood ? "im Hochwasser erstickt" : s.age > Sp.max ? "an Altersschwäche gestorben" : young ? "als junger Baum eingegangen" : "an Stress gestorben");
  }
  // Höchster Stamm und tiefste Wurzel, die der Standort zulässt; Krüppelwuchs hält den Stamm bei 5
  const capS = () => Math.min(B().capS, s.kr ? 5 : 8);
  const capW = () => B().capW;
  // Angeboten werden nur Arten, die jetzt einziehen könnten; wächst der Baum in der Runde, rücken neue nach.
  function fillMarket() {
    const free = CARDS.filter(c => (!has(s, c.id) || c.id === "bunt" || c.id === "schwarz") && c.req(s) && !s.market.includes(c.id));
    s.market = s.market.filter(id => CARDS.find(c => c.id === id).req(s)).concat(BL.shuffle(free).map(c => c.id)).slice(0, 3);
  }
  function die(cause) {
    // Ein dünnes Stämmchen steht nicht lange als Totholz: es fällt gleich um oder zerfällt sofort
    s.V = 0; s.phase = "dead"; s.deathCause = cause; s.deadYears = 0;
    setSub(s.S <= 1 ? 4 : s.S <= 2 ? 2 : 0); dealDead();
    s.log.unshift(`Jahr ${s.age}: Der Baum ist ${cause}. Jetzt beginnt sein zweites Leben als Totholz.`);
  }
  // Stufe setzen; deadRound bleibt die Hauptphase (0 stehend, 1 liegend, 2 Mulm) für Bild und alte Spielstände
  function setSub(n) { s.sub = n; s.subPick = 0; s.deadRound = SUBS[Math.min(n, SUBS.length - 1)].main; }
  function dealDead() {
    if (s.sub == null) setSub((s.deadRound || 0) * 2);
    const pool = DEAD.filter(d => d.sub.includes(s.sub) && !s.dead.includes(d.n) && (!d.needsHole || s.holes + s.bigHoles > 0));
    s.market = BL.shuffle(pool).slice(0, 3).map(d => d.n);
  }

  // Lebensabschnitt: bestimmt, welche Aktionen der Baum überhaupt hat
  const STAGES = { saemling: "Sämling", jung: "Jungbaum", reif: "Mannbarer Baum", alt: "Altbaum" };
  function stage() {
    const Sp = SPECIES[s.sp];
    return s.age <= YEARS ? "saemling" : s.age >= Sp.max * .7 ? "alt" : s.S < Sp.mature ? "jung" : "reif";
  }
  const ACTIONS = [
    { k: "K", n: "Krone wachsen", c: 0, d: "+1 Blätter: mehr Fotosynthese, aber mehr Wasserbedarf", ok: () => s.K < 8 },
    { k: "W", n: "Wurzeln wachsen", c: 0, d: "+1 Wasser, Halt bei Sturm", ok: () => s.W < capW() },
    { k: "S", n: "Stamm wachsen", c: 0, d: "+1 Höhe: raus aus dem Schatten, Platz für Bewohner", ok: () => s.S < capS() && !(EV().browse), st: ["saemling", "jung", "reif"] },
    { k: "A", n: "Abwehrstoffe", c: 2, d: "+1 Harz, Gerbstoffe gegen Käfer (max. 4)", ok: () => s.A < 4, st: ["jung", "reif", "alt"] },
    { k: "seed", n: "Samen bilden", c: 0, d: "+1 Nachkomme (Punkte), höchstens 2 je Runde", ok: () => (s.seedsRound || 0) < 2, st: ["reif", "alt"] },
    { k: "R", n: "Stärke speichern", c: 1, d: "Reserve für schlechte Jahre", ok: () => s.R < 3 + s.S },
    { k: "V", n: "Wunden verschließen", c: 2, d: "+1 Vitalität", ok: () => s.V < 10, st: ["jung", "reif", "alt"], hurt: true }
  ];
  // Gezeigt wird nur, was zum Lebensabschnitt passt; Wunden verschließen nur, wenn der Baum verletzt ist
  const shown = a => (!a.st || a.st.includes(stage())) && !(a.hurt && s.V >= 10) && !(a.k === "seed" && s.S < SPECIES[s.sp].mature);
  const EV = () => EVENTS.find(e => e.id === s.event);
  // Wachsen wird mit der Größe teurer: kostet die jetzige Stufe, der Stamm 1 mehr
  function cost(a) { return a.k === "seed" ? SPECIES[s.sp].seedCost : a.k === "K" || a.k === "W" ? s[a.k] : a.k === "S" ? s.S + 1 : a.c; }
  function act(k) {
    const a = ACTIONS.find(x => x.k === k), c = cost(a);
    if (s.sugar < c || !a.ok() || !shown(a)) return;
    s.sugar -= c;
    if (k === "seed") { s.seeds++; s.seedsRound = (s.seedsRound || 0) + 1; } else if (k === "R") s.R++; else if (k === "V") s.V = Math.min(10, s.V + 1); else s[k]++;
    if (!s.hosted) fillMarket();
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
    s.dead.push(n); s.subPick++; s.deadYears = (s.deadYears || 0) + SUB_YEARS;
    const d = DEAD.find(x => x.n === n);
    s.log.unshift(`${s.deadYears} Jahre nach dem Tod (${SUBS[s.sub].n}): ${d.e} ${d.n} zieht ein.`);
    if (s.subPick >= SUB_ROUNDS) setSub(s.sub + 1);
    // Stufe ohne passende Arten überspringen
    while (s.sub < SUBS.length) { dealDead(); if (s.market.length) break; setSub(s.sub + 1); }
    if (s.sub >= SUBS.length) { s.phase = "over"; s.market = []; finalize(); }
    save(); render();
  }
  function score() {
    const pts = { alter: Math.floor(s.age / YEARS), samen: s.seeds * 2, bewohner: 0, extra: 0, totholz: 0, vielfalt: 0, gemeinschaft: 0 };
    for (const g of synActive()) pts.gemeinschaft += g.pts;
    for (const c of s.cards) pts.bewohner += CARDS.find(x => x.id === c.id).pts;
    if (has(s, "hoernchen")) pts.extra += Math.floor(s.seeds / 2);
    if (has(s, "haeher")) pts.extra += Math.min(5, s.seeds);
    for (const n of s.dead) { const d = DEAD.find(x => x.n === n); pts.totholz += deadPts(d); }
    const slots = new Set(s.cards.map(c => CARDS.find(x => x.id === c.id).slot)); pts.vielfalt = slots.size * 2 + (s.dead.length ? 2 : 0);
    pts.sum = Object.values(pts).reduce((a, b) => a + b, 0);
    return pts;
  }
  function finalize() { const sc = score().sum, best = BL.store.get("gamebest", {}); if (!best[s.sp] || sc > best[s.sp]) { best[s.sp] = sc; BL.store.set("gamebest", best); } }

  // ---------- Ansicht ----------
  // ---------- Baumbild ----------
  // Krone und Äste kommen aus dem Baumgenerator des Lebenslaufs (Raumkolonisierung, Knospenschicksal als Markow-Kette),
  // Wurzeln und Pilzgeflecht aus der diffusionsbegrenzten Aggregation (DLA) der Simulation »Fraktales Wachstum«.
  // Ein DLA-Haufen wächst Teilchen für Teilchen: Die ersten n Teilchen sind eine kleinere Fassung desselben Haufens,
  // deshalb wächst das Wurzelwerk mit der Wurzelstufe einfach weiter.
  const models = {}, clusters = {};
  const model = () => { const k = s.sp + ":" + (s.seed || 1); return models[k] || (models[k] = BL.TreeGen.build(s.sp, s.seed || 1, 0)); };
  function cluster(key, n, haftung, seed) {
    if (!clusters[key]) { const d = new Dla({ dim: 2, kapazitaet: n, haftung, saat: "punkt", zufall: seed }); d.wachse(); clusters[key] = d; }
    return clusters[key];
  }
  // Teilchen 0..n-1 als Linien zum Elternteilchen, Dicke nach der Zahl der Nachfahren (wie das Pfeifenmodell)
  function drawCluster(ctx, d, n, map, col, wMul) {
    n = Math.min(n, d.anzahl);
    const cnt = new Float32Array(n).fill(1);
    for (let i = n - 1; i > 0; i--) { const e = d.eltern[i]; if (e >= 0 && e < n) cnt[e] += cnt[i]; }
    ctx.strokeStyle = col; ctx.lineCap = "round";
    for (let i = 1; i < n; i++) {
      const e = d.eltern[i]; if (e < 0) continue;
      const [x1, y1] = map(d.pos[i * 3], d.pos[i * 3 + 1]), [x0, y0] = map(d.pos[e * 3], d.pos[e * 3 + 1]);
      ctx.lineWidth = Math.min(7, .4 + Math.sqrt(cnt[i]) * .22 * wMul);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
  }
  function seasonNow() {
    const ev = EV() || {};
    return ev.frost ? .06 : ev.snow ? .9 : ev.id === "duerre" || ev.id === "hitze" ? .5 : .32;
  }
  // Liegendes Totholz: Stamm am Boden mit hochgeklapptem Wurzelteller, später ein bemooster Mulmhügel
  function drawLog(ctx, cx, gy, W, S, humus) {
    const r = BL.rng((s.seed || 1) * 17), len = W * (.35 + S * .05), th = 6 + S * 2.6, x0 = cx - len * .45, bark = s.sp === "birke" ? "#d9d6cc" : s.sp === "waldkiefer" ? "#8a5a3a" : "#5e5246";
    if (humus) {
      ctx.fillStyle = "#4a3523"; ctx.beginPath(); ctx.ellipse(cx, gy, len * .5, th * .55, 0, Math.PI, 0); ctx.fill();
      for (let i = 0; i < 40; i++) { ctx.fillStyle = r() < .6 ? "#6f8f3a" : "#8a6a42"; ctx.beginPath(); ctx.arc(cx + (r() * 2 - 1) * len * .45, gy - r() * th * .45, 1.5 + r() * 2.5, 0, 7); ctx.fill(); }
      return { half: len * .5 };
    }
    // Wurzelteller: senkrecht aufgestellte Erdscheibe mit Wurzelstümpfen
    ctx.fillStyle = "#4a3624"; ctx.beginPath(); ctx.ellipse(x0, gy - th * 1.2, th * .55, th * 1.7, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = "#7a6450"; ctx.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) { const a = r() * 6.28, l = th * (1.2 + r()); ctx.beginPath(); ctx.moveTo(x0, gy - th * 1.2); ctx.lineTo(x0 + Math.cos(a) * l * .5, gy - th * 1.2 + Math.sin(a) * l); ctx.stroke(); }
    // Stamm, zur Spitze dünner, Rinde mit Längsrissen, Aststümpfe nach oben
    ctx.fillStyle = bark; ctx.beginPath(); ctx.moveTo(x0, gy - th); ctx.lineTo(x0 + len, gy - th * .35); ctx.lineTo(x0 + len, gy); ctx.lineTo(x0, gy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) { const yy = gy - th * (.15 + i * .13); ctx.beginPath(); ctx.moveTo(x0 + 4, yy); ctx.lineTo(x0 + len * (.5 + r() * .45), yy + th * .1); ctx.stroke(); }
    ctx.strokeStyle = bark; ctx.lineWidth = Math.max(2, th * .2);
    for (let i = 0; i < 4; i++) { const x = x0 + len * (.35 + i * .15), yt = gy - th * (1 - (x - x0) / len * .65); ctx.beginPath(); ctx.moveTo(x, yt); ctx.lineTo(x + 6 + r() * 8, yt - 10 - r() * 14); ctx.stroke(); }
    // Moos auf der Oberseite
    for (let i = 0; i < 26; i++) { const x = x0 + r() * len; ctx.fillStyle = "rgba(110,150,60,.85)"; ctx.beginPath(); ctx.arc(x, gy - th * (1 - (x - x0) / len * .65) + 1, 1.5 + r() * 2.5, 0, 7); ctx.fill(); }
    return { half: len * .5 };
  }
  function paintTree(cv) {
    const W = Math.max(200, cv.parentElement.clientWidth), Hh = Math.round(Math.min(W * 1.05, Math.max(260, window.innerHeight * .5))), gy = Math.round(Hh * .66);
    const ctx = BL.fitCanvas(cv, W, Hh), Bi = B(), Sp = SPECIES[s.sp], rnd = BL.rng((s.seed || 1) * 13 + 7);
    const alive = s.phase === "play", lying = s.phase === "over" || (s.phase === "dead" && s.deadRound >= 1), humus = s.phase === "over" || (s.phase === "dead" && s.deadRound >= 2), cx = W * .5;
    const season = alive ? seasonNow() : .7, winter = season > .8;
    // Himmel und Hintergrund nach Standort
    const sky = ctx.createLinearGradient(0, 0, 0, gy);
    sky.addColorStop(0, winter ? "#b9c8d4" : "#8fc0e2"); sky.addColorStop(1, winter ? "#e6ecef" : "#e3f0e8");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, gy);
    if (s.biome === "berg") { ctx.fillStyle = "#9fb0bf"; ctx.beginPath(); ctx.moveTo(0, gy * .7); ctx.lineTo(W * .25, gy * .3); ctx.lineTo(W * .45, gy * .55); ctx.lineTo(W * .7, gy * .22); ctx.lineTo(W, gy * .6); ctx.lineTo(W, gy); ctx.lineTo(0, gy); ctx.fill();
      ctx.fillStyle = "#f4f7f9"; ctx.beginPath(); ctx.moveTo(W * .7, gy * .22); ctx.lineTo(W * .64, gy * .32); ctx.lineTo(W * .76, gy * .31); ctx.fill(); }
    // ferne Bäume: im Wald dicht und dunkel, auf Heide und Moor vereinzelt
    // Waldrand am Horizont, deckend in Dunstfarbe (hinten heller); Nadelwald als Spitzen, Laubwald als Kronenbögen
    const coniferous = s.biome === "berg" || s.biome === "moor" || s.biome === "sand";
    for (const [layer, col] of [[0, winter ? "#a9b6b4" : "#9fb8a2"], [1, winter ? "#8d9c98" : "#7f9f84"]]) {
      const top = gy * (Bi.canopy ? .62 - layer * .1 : .82 - layer * .05), n = Bi.canopy ? 14 : 6;
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, gy);
      for (let i = 0; i <= n; i++) {
        const x = i / n * W, h = (gy - top) * (.6 + rnd() * .4);
        if (!Bi.canopy && rnd() < .45) { ctx.lineTo(x, gy - h * .25); continue; }
        if (coniferous) { ctx.lineTo(x - W / n * .4, gy - h * .35); ctx.lineTo(x, gy - h); ctx.lineTo(x + W / n * .4, gy - h * .35); }
        else ctx.quadraticCurveTo(x - W / n * .5, gy - h * 1.15, x, gy - h * .75);
      }
      ctx.lineTo(W, gy); ctx.closePath(); ctx.fill();
    }
    // Boden
    const soil = { moor: ["#3e3020", "#2c2116"], sand: ["#d8c08c", "#c3a46a"], aue: ["#6b5236", "#4f3c28"] }[s.biome] || ["#6a4e33", "#4a3624"];
    const sg = ctx.createLinearGradient(0, gy, 0, Hh); sg.addColorStop(0, soil[0]); sg.addColorStop(1, soil[1]);
    ctx.fillStyle = sg; ctx.fillRect(0, gy, W, Hh - gy);
    ctx.fillStyle = winter ? "#f2f5f7" : s.biome === "sand" ? "#9c8a4c" : s.biome === "moor" ? "#7d8a3a" : "#5f8a3a"; ctx.fillRect(0, gy - 3, W, 6);
    if (s.biome === "moor" || s.biome === "aue") { ctx.fillStyle = "rgba(111,155,184,.75)"; ctx.beginPath(); ctx.ellipse(W * .82, gy + 2, W * .14, 5, 0, 0, 7); ctx.fill(); }
    if (s.biome === "moor" && !winter) for (let i = 0; i < 14; i++) { const x = rnd() * W; ctx.fillStyle = "#f4f2ea"; ctx.beginPath(); ctx.arc(x, gy - 6 - rnd() * 4, 2.2, 0, 7); ctx.fill(); }
    if (s.biome === "sand" && !winter) for (let i = 0; i < 18; i++) { ctx.fillStyle = "#9b5b9a"; ctx.fillRect(rnd() * W, gy - 4 - rnd() * 3, 3, 3); }
    // Wurzeln: DLA-Haufen, nach unten gespiegelt; Flachwurzler und Staunässe drücken ihn flach
    const flat = Sp.flat || s.biome === "moor" ? .38 : s.sp === "stieleiche" ? 1 : .75;
    const rootD = cluster("root:" + s.sp + (s.seed || 1), 1500, .9, (s.seed || 1) * 3 + 11), R = rootD.rmax || 1;
    const nRoot = 40 + s.W * 182, sxR = W * .44 / R, syR = (Hh - gy) * .92 / R * flat;
    const mapR = (x, y) => [cx + x * sxR, gy + 2 + Math.abs(y) * syR];
    if (has(s, "myko")) { const m = cluster("myko" + (s.seed || 1), 1400, .25, (s.seed || 1) * 5 + 3), mr = m.rmax || 1;
      drawCluster(ctx, m, 1400, (x, y) => [cx + x * W * .46 / mr, gy + 6 + Math.abs(y) * (Hh - gy) * .9 / mr], "rgba(245,240,225,.45)", .3); }
    if (!lying) drawCluster(ctx, rootD, nRoot, mapR, alive ? "#a07a52" : "#7a6450", 1);
    // Baum
    const S = s.S, Hpx = gy * (.1 + .105 * (S - 1)) * (lying ? .8 : 1), g = BL.clamp(.1 + .9 * (S - 1) / 7, .06, 1);
    const thin = alive ? BL.clamp((S + 1 - s.K) / 9, 0, .7) : 0;
    const v = { cx, gy, Hpx, g, season, trunkPx: 2 + S * 1.7, cb: .14 + S * .02, dead: thin, leaves: alive, snag: !alive, dark: false, real: true, sunX: -.5 };
    ctx.save();
    if (s.kr && !lying) { ctx.translate(cx, gy); ctx.rotate(.13); ctx.translate(-cx, -gy); }
    const res = lying ? drawLog(ctx, cx, gy, W, S, humus) : BL.TreeGen.render(ctx, model(), v);
    // Höhlen am Stamm
    const holes = s.holes + s.bigHoles + s.cards.filter(c => CARDS.find(x => x.id === c.id).slot === "hoehle").length;
    if (!lying) for (let i = 0; i < Math.min(3, holes); i++) { ctx.fillStyle = "#1a120b"; ctx.beginPath(); ctx.ellipse(cx + (i % 2 ? 2 : -2), gy - Hpx * (.3 + i * .12), 2.5 + S * .4, 3.5 + S * .5, 0, 0, 7); ctx.fill(); }
    ctx.restore();
    // Bewohner als Bildzeichen: Krone oben, Stamm am Stamm, Boden im Boden, Totholz am liegenden Holz
    ctx.font = "16px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const half = Math.max(20, Math.min(W * .4, res.half || Hpx * .3));
    s.cards.forEach((c, i) => {
      const d = CARDS.find(x => x.id === c.id), r2 = BL.rng(i * 97 + 5);
      const p = d.slot === "krone" ? [cx + (r2() * 2 - 1) * half * .8, gy - Hpx * (.6 + r2() * .35)]
        : d.slot === "stamm" ? [cx + (i % 2 ? 9 : -9) + S, gy - Hpx * (.15 + r2() * .35)]
        : d.slot === "hoehle" ? [cx + 14 + S, gy - Hpx * (.3 + r2() * .2)]
        : (d.plant || d.ground) && d.slot === "wurzel" ? [cx + (r2() < .5 ? -1 : 1) * W * (.12 + r2() * .3), gy - 9] : [cx + (r2() * 2 - 1) * W * .35, gy + 18 + r2() * (Hh - gy - 30)];
      if (!alive && d.slot !== "wurzel") return;
      ctx.fillText(d.e, p[0], p[1]);
    });
    s.dead.forEach((n, i) => { const d = DEAD.find(x => x.n === n); ctx.fillText(d.e, cx - W * .38 + (i % 8) * W * .1, gy - 12 - Math.floor(i / 8) * 18 - (i % 2) * 6); });
    if (has(s, "steinpilz")) { ctx.font = "18px system-ui, sans-serif"; ctx.fillText("🍄", cx - W * .3, gy - 8); }
    // Schatten der Großen: dunkles Kronendach über dem jungen Baum
    if (alive && Bi.canopy && S < 5 && !(s.gapRounds > 0 || (EV() || {}).gap)) {
      const cg = ctx.createLinearGradient(0, 0, 0, gy * .5); cg.addColorStop(0, "rgba(28,52,30,.9)"); cg.addColorStop(1, "rgba(28,52,30,0)");
      ctx.fillStyle = cg; ctx.fillRect(0, 0, W, gy * .5);
      for (let i = 0; i < 7; i++) { ctx.fillStyle = "rgba(34,62,36,.85)"; ctx.beginPath(); ctx.ellipse(i * W / 6, 0, W * .14, gy * .12, 0, 0, 7); ctx.fill(); }
    }
    // Beschriftung
    ctx.textAlign = "left"; ctx.font = "12px IBM Plex Mono, monospace"; ctx.fillStyle = "#fff"; ctx.shadowColor = "rgba(0,0,0,.7)"; ctx.shadowBlur = 3;
    ctx.fillText(`${s.age} Jahre · ${alive ? STAGES[stage()] : "Totholz"}${s.kr ? " · Krüppelwuchs" : ""}`, 8, 14);
    ctx.shadowBlur = 0;
  }
  function tableau() {
    const by = slot => s.cards.filter(c => CARDS.find(x => x.id === c.id).slot === slot).map(c => { const d = CARDS.find(x => x.id === c.id); return `<span class="gcard" title="${d.txt}">${d.e} ${d.n} <b>${d.pts}</b></span>`; }).join("");
    const deadCards = s.dead.map(n => { const d = DEAD.find(x => x.n === n); return `<span class="gcard" title="${d.txt}">${d.e} ${d.n} <b>${deadPts(d)}</b></span>`; }).join("");
    return `<div class="tableau">
      <div class="slot" style="grid-area:k"><span class="label">Krone</span>${by("krone")}</div>
      <div class="slot" style="grid-area:s"><span class="label">Stamm</span>${by("stamm")}</div>
      <div class="tree"><canvas class="gtree" role="img" aria-label="Dein Baum mit Wurzeln und Bewohnern"></canvas></div>
      <div class="slot" style="grid-area:h"><span class="label">Höhlen · frei ${s.holes} klein, ${s.bigHoles} groß</span>${by("hoehle")}</div>
      <div class="slot" style="grid-area:w"><span class="label">${s.phase === "play" ? "Wurzel und Boden" : "Totholz"}</span>${s.phase === "play" ? by("wurzel") : by("wurzel") + deadCards}</div>
      ${synActive().length ? `<div class="slot syn" style="grid-area:g"><span class="label">Gemeinschaften</span>${synActive().map(g => `<span class="gcard" title="${g.txt}">${g.pts < 0 ? "⚔️" : "🤝"} ${g.n}: ${g.a.map(nameOf).join(" + ")} <b class="${g.pts < 0 ? "neg" : ""}">${g.pts > 0 ? "+" + g.pts : "−" + -g.pts}</b></span>`).join("")}</div>` : ""}</div>`;
  }
  function render() {
    root.innerHTML = "";
    const head = BL.html(`<div class="gm-head"><h2>Sei ein Baum</h2><div class="row"><button class="btn" id="gm-help">📖 Anleitung</button>${s ? '<button class="btn" id="gm-log">📜 Tagebuch</button>' : ""}</div></div>`);
    root.append(head);
    BL.$("#gm-help", head).onclick = () => popup("So funktioniert es", HELP);
    if (s) BL.$("#gm-log", head).onclick = () => popup("Tagebuch", `<ul class="glog">${s.log.map(l => `<li>${l}</li>`).join("")}</ul>`);
    if (!s) return renderPick();
    if (s.phase === "over") return renderOver();
    const ev = EV(), Sp = SPECIES[s.sp];
    const wrap = BL.html(`<div class="gm"><div class="stack">${tableau()}</div><div class="stack" id="gm-side"></div></div>`);
    root.append(wrap);
    const side = BL.$("#gm-side", wrap);
    if (s.phase === "play") {
      const wat = BL.clamp(ev.water + B().water, 0, 3);
      side.append(BL.html(`<div class="ev"><span class="label">Runde ${s.round} · Jahr ${s.age - YEARS} bis ${s.age} · ${STAGES[stage()]} · ${B().n}</span><h3>${ev.n}</h3><p class="note" title="${ev.f}">${ev.f}</p>
        <p class="num" style="font-size:.85rem">Licht ${"●".repeat(ev.light)}${"○".repeat(3 - ev.light)} · Wasser ${"●".repeat(wat)}${"○".repeat(3 - wat)}${B().canopy && s.S < 5 && !(s.gapRounds > 0 || ev.gap) ? " · du stehst im Schatten der Großen" : ""}</p>
        ${(() => { const l = s.log.find(x => x.startsWith(`Jahr ${s.age}:`)); return l ? `<p class="last">${l}${s.sugar === 1 && s.lastProd <= s.lastUpkeep ? ". Rinde und Knospen retten dir 1 Zucker." : ""}</p>` : ""; })()}</div>`));
      side.append(BL.html(`<div class="res">
        <div><span class="label">Zucker</span><b class="sugar">${s.sugar}</b></div><div><span class="label">Reserve</span><b>${s.R}</b></div>
        <div><span class="label">Vitalität</span><b style="color:${s.V < 4 ? "var(--warn)" : "inherit"}">${s.V}/10</b></div>
        <div><span class="label">Krone</span><b>${s.K}</b></div><div><span class="label">Wurzel</span><b>${s.W}</b></div><div><span class="label">Stamm</span><b>${s.S}</b></div>
        <div><span class="label">Abwehr</span><b>${s.A}</b></div><div><span class="label">Samen</span><b>${s.seeds}</b></div></div>`));
      if (s.shadeRounds > 0) side.append(BL.html(`<p class="note" style="color:var(--warn)">Zu wenig Licht: Wächst dein Stamm nicht bald auf 2, verkümmerst du in ${4 - s.shadeRounds} ${4 - s.shadeRounds === 1 ? "Runde" : "Runden"}.</p>`));
      if (s.kr) side.append(BL.html(`<p class="note"><b>Krüppelwuchs.</b> ${s.kr} Der Stamm wird höchstens ${capS()}.</p>`));
      const st = stage();
      const later = { saemling: `Als Jungbaum kommen Abwehrstoffe dazu, Samen ab Stamm ${Sp.mature}.`, jung: `Samen bildest du erst, wenn du mannbar bist (Stamm ${Sp.mature}).`,
        reif: "", alt: "Im Alter wächst der Stamm nicht mehr in die Höhe. Jetzt zählen Samen, Abwehr und Reserven." + (s.S < Sp.mature ? ` Samen bildest du erst ab Stamm ${Sp.mature}, dafür bist du zu klein geblieben.` : "") }[st];
      side.append(BL.html(`<div class="panel stack"><h3>Zucker verteilen</h3><p class="note" style="margin:0 0 4px">Zahl = Kosten in Zucker. Zeig mit der Maus auf eine Aktion für die Erklärung.</p><div class="alloc">${ACTIONS.filter(shown).map(a => {
        const c = cost(a), ok = a.ok() && s.sugar >= c;
        const why = !a.ok() && (a.k === "seed" ? "diese Runde schon 2 Samen" : a.k === "S" && EV().browse ? "Verbiss: diese Runde nicht"
          : a.k === "S" && s.S < 8 ? (s.kr ? "Krüppelwuchs: nicht höher" : "auf diesem Standort nicht höher") : a.k === "W" && s.W < 8 ? "Staunässe: Wurzeln bleiben flach"
          : ["K", "W", "S"].includes(a.k) && s[a.k] >= 8 ? "ausgewachsen" : "");
        return `<button data-a="${a.k}" title="${a.d}" ${ok ? "" : "disabled"}><span>${a.n} <b class="sugar mono">${c}</b></span>${why ? `<small>${why}</small>` : ""}</button>`;
      }).join("")}</div>${later ? `<p class="note">${later}</p>` : ""}</div>`));
      side.append(BL.html(`<div class="panel stack"><h3>Wer möchte einziehen?</h3><p class="note" style="margin:0">🤝 = bildet mit einer Art bei dir eine Gemeinschaft (Extrapunkte).</p><p class="note">${s.hosted ? "Diese Runde ist schon jemand eingezogen." : s.market.length ? "Eine dieser Arten darf diese Runde einziehen." : "Gerade findet keine Art bei dir Platz. Wachse oder bilde Samen, dann kommen neue."}</p>
        <div class="market">${s.market.map(id => { const c = CARDS.find(x => x.id === id), ok = !s.hosted && c.req(s);
          return `<div class="mcard"><div class="top"><span class="em" aria-hidden="true">${c.e}</span><h4>${c.n}</h4></div><span class="meta">${SLOTS[c.slot]} · ${c.pts} P${c.eff !== "–" ? " · " + c.eff : ""}</span>${synWith(id).map(g => `<span class="syn ${g.pts < 0 ? "neg" : ""}" title="${g.txt}">${g.pts < 0 ? "⚔️" : "🤝"} ${g.pts > 0 ? "+" + g.pts : "−" + -g.pts} mit ${g.a.filter(x => x !== id).map(nameOf).join(", ")}</span>`).join("")}<p class="note txt">${c.txt}</p><button class="btn ${ok ? "primary" : ""}" data-h="${id}" ${ok ? "" : "disabled"}>Einziehen</button></div>`; }).join("")}</div></div>`));
      // Rundenknöpfe in die Kopfzeile, damit sie ohne Scrollen erreichbar sind
      const bar = BL.$(".gm-head .row", root);
      bar.prepend(BL.html(`<button class="btn" id="gm-restart">Neues Spiel</button>`));
      bar.prepend(BL.html(`<button class="btn primary" id="gm-next">${YEARS} Jahre weiter</button>`));
      BL.$("#gm-next", bar).onclick = endRound;
      BL.$("#gm-restart", bar).onclick = () => { s = null; save(); render(); };
    } else {
      if (s.sub == null) dealDead();
      const sb = SUBS[s.sub];
      side.append(BL.html(`<div class="ev"><span class="label">Totholz · ${["Stehendes Totholz", "Liegender Stamm", "Mulm und Humus"][sb.main]} · Stufe ${s.sub + 1} von ${SUBS.length} · Runde ${s.subPick + 1} von ${SUB_ROUNDS}</span><h3>${sb.n}</h3>
        <p class="note" title="${sb.txt}">${sb.txt}</p>
        <p class="last">Dein Baum ist ${s.deathCause}${s.deadYears ? `, das ist ${s.deadYears} Jahre her` : ""}. Ein toter Baum beherbergt oft mehr Arten als ein lebender. Wähle, wer als Nächstes einzieht.</p>
        <div class="row" style="gap:4px">${SUBS.map((x, k) => `<span class="chip" style="font-size:.68rem;${k === s.sub ? "background:var(--accent);color:var(--accent-text)" : k < s.sub ? "opacity:.5" : ""}">${x.n}</span>`).join("")}</div></div>`));
      side.append(BL.html(`<div class="market">${s.market.map(n => { const d = DEAD.find(x => x.n === n);
        return `<div class="mcard" title="${d.txt}"><div class="top"><span class="em" aria-hidden="true">${d.e}</span><h4>${d.n}</h4></div><span class="meta">${deadPts(d)} P${bon(d) ? " (Bonus für deine Art)" : ""}</span><p class="note" style="font-size:.74rem;margin:0">${d.txt}</p><button class="btn primary" data-d="${n}">Einziehen</button></div>`; }).join("")}</div>`));
    }
    paintTree(BL.$(".gtree", wrap));
    wrap.addEventListener("click", e => {
      const a = e.target.closest("[data-a]"), h = e.target.closest("[data-h]"), d = e.target.closest("[data-d]");
      if (a) act(a.dataset.a); else if (h) host(h.dataset.h); else if (d) pickDead(d.dataset.d);
    });
  }
  function renderPick() {
    const best = BL.store.get("gamebest", {});
    const biomes = `<h3>1. Wo keimst du?</h3><div class="species-pick">${Object.entries(BIOMES).map(([k, b]) =>
      `<button data-bi="${k}" aria-pressed="${pickBiome === k}" style="${pickBiome === k ? "border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)" : ""}"><b style="font-family:var(--display);font-weight:400;font-size:1.1rem">${b.n}</b><span class="note">${b.txt}</span><span class="mono" style="font-size:.75rem">${b.sp.map(x => SPECIES[x].name).join(", ")}</span></button>`).join("")}</div>`;
    const node = BL.html(`<div class="stack">${biomes}${pickBiome ? `<h3>2. Welche Baumart wächst hier?</h3><p class="note">Zur Wahl stehen nur Arten, die für diesen Standort typisch sind.</p>` : ""}<div class="species-pick">${(pickBiome ? BIOMES[pickBiome].sp : []).map(k => [k, SPECIES[k]]).map(([k, sp]) =>
      `<button data-sp="${k}"><div class="lf">${BL.leafSVG(BL.tree(k).leaf)}</div><b style="font-family:var(--display);font-weight:400;font-size:1.1rem">${sp.name}</b><span class="note">${sp.txt}</span><span class="mono" style="font-size:.75rem">wird etwa ${sp.max} Jahre alt${best[k] ? " · Rekord " + best[k] + " Punkte" : ""}</span></button>`).join("")}</div>
      <p class="note">Wie das Spiel geht, steht unter 📖 Anleitung.</p></div>`);
    node.addEventListener("click", e => {
      const bi = e.target.closest("[data-bi]"), b = e.target.closest("[data-sp]");
      if (bi) { pickBiome = bi.dataset.bi; render(); } else if (b) start(b.dataset.sp, pickBiome);
    });
    root.append(node);
  }
  function renderOver() {
    const p = score(), best = BL.store.get("gamebest", {});
    root.append(BL.html(`<div class="gm"><div class="stack">${tableau()}</div><div class="stack">
      <div class="panel stack"><h3>${p.sum} Punkte</h3><p>Deine ${SPECIES[s.sp].name} (${B().n}) wurde ${s.age} Jahre alt und ist ${s.deathCause}.${s.kr ? " Sie wuchs als Krüppel." : ""}</p>
      <table class="data"><tr><td>Alter (1 je ${YEARS} Jahre)</td><td class="num">${p.alter}</td></tr><tr><td>Samen (2 je Samen)</td><td class="num">${p.samen}</td></tr>
        <tr><td>Bewohner</td><td class="num">${p.bewohner}</td></tr><tr><td>Samenverstecker</td><td class="num">${p.extra}</td></tr>
        <tr><td>Gemeinschaften</td><td class="num">${p.gemeinschaft}</td></tr><tr><td>Vielfalt der Lebensräume</td><td class="num">${p.vielfalt}</td></tr><tr><td>Totholz-Bewohner</td><td class="num">${p.totholz}</td></tr></table>
      <p class="note">Rekord für diese Art: ${best[s.sp] || p.sum} Punkte</p>
      <div class="row"><button class="btn primary" id="gm-again">Nochmal als ${SPECIES[s.sp].name}</button><button class="btn" id="gm-other">Andere Baumart</button></div></div>
      <div class="panel prose"><h3>Was du gelernt hast</h3><p>Ein Baum muss ständig abwägen: Blätter bringen Zucker, kosten aber Wasser. Wurzeln bringen Wasser und Halt, aber kein Licht. Wer schnell in die Höhe wächst, entkommt dem Schatten, wird aber sturmanfälliger. Und nach dem Tod ist er noch Jahrzehnte lang Lebensraum und Nährstoffquelle für den Wald.</p></div></div></div>`));
    paintTree(BL.$(".gtree", root));
    BL.$("#gm-again", root).onclick = () => start(s.sp, s.biome || "buchenwald");
    BL.$("#gm-other", root).onclick = () => { s = null; save(); render(); };
  }
  return { init };
})();
