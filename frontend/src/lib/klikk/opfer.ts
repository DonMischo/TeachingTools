/**
 * Die Woche aus Sicht der Betroffenen: Jonas (Mobbing) und Emma (heimliches
 * Foto). Jede Szene zeigt, was ankommt, was im Kopf passiert und wie es sich
 * anfühlt. »Jemandem erzählen« kostet Überwindung — der Scham-Regler springt
 * zurück, und die Gedanken dazu sind die, die Betroffene wirklich haben.
 */

export interface Eingang { von: string; text: string; bild?: string }

export interface OpferOption {
  id: string;
  text: string;
  /** öffnet den Scham-Regler; bei Erfolg gilt »erzählt« (an wen) */
  erzaehlen?: "Mama" | "Papa" | "Frau Yilmaz" | "Ole" | "Lea";
  /** was danach passiert (sofort angezeigt) */
  folge: string;
  /** neuer innerer Gedanke danach */
  danach?: string;
}

export interface OpferSzene {
  tag: number;
  uhr: string;
  ort: string;
  eingang: Eingang[];
  gedanke: string;
  gefuehl: { emoji: string; name: string; staerke: number }[];
  optionen: OpferOption[];
}

export interface OpferRolle {
  id: "jonas" | "emma";
  name: string;
  emoji: string;
  intro: string;
  szenen: OpferSzene[];
  /** Ende: erzählt (an wen, an welchem Tag) oder nicht */
  ende: (erzaehlt: { wem: string; tag: number }[]) => { titel: string; text: string };
}

/** Was einem durch den Kopf geht, wenn man es jemandem sagen will. */
export const SCHAM_GEDANKEN = [
  "Dann bin ich der Petzer.",
  "Die lachen dann noch mehr.",
  "Vielleicht übertreibe ich ja.",
  "Was, wenn sie es weitererzählen?",
  "Mama macht sich sowieso schon so viele Sorgen.",
  "Das ist so peinlich. Ich kann das nicht aussprechen.",
  "Die Lehrer machen es nur schlimmer.",
  "Ich bin selbst schuld. Ich hätte nicht einschlafen sollen.",
  "Morgen ist es bestimmt vorbei.",
  "Wenn ich nichts sage, merkt es vielleicht keiner.",
  "Die sagen dann: Stell dich nicht so an.",
  "Und wenn die dann noch fieser werden?",
  "Ich will nicht, dass alle wissen, dass es mir schlecht geht.",
  "Ich müsste das Foto zeigen. Das schaff ich nicht.",
  "Was denken die dann von mir?",
  "Es ist ja nur Internet.",
  "Ich krieg das schon alleine hin.",
  "Was, wenn mir keiner glaubt?",
  "Jetzt ist es zu spät, das hätte ich früher sagen müssen.",
  "Dann gibt's richtig Ärger. Für alle.",
];

const JONAS: OpferRolle = {
  id: "jonas", name: "Jonas", emoji: "🎸",
  intro: "Du bist Jonas, 14, 8b. Du spielst seit zwei Jahren Gitarre, bist eher ruhig und schläfst im Bus manchmal ein, weil du früh raus musst. Diese Woche wird anders.",
  szenen: [
    {
      tag: 0, uhr: "15:10", ort: "Zu Hause, Schreibtisch",
      eingang: [
        { von: "8b · Finn", text: "😂😂😂 guckt mal wer im bus pennt", bild: "🚌 Ein Foto von dir. Mund offen, Kopf am Fenster." },
        { von: "8b · Emma", text: "LMAOOO" }, { von: "8b · Ben", text: "💀💀" },
        { von: "8b", text: "👁️ Gelesen von 24" },
      ],
      gedanke: "Ich hab das nicht mal gemerkt. Wer hat das gemacht? 24 haben es gesehen. Morgen sehen mich alle so an.",
      gefuehl: [{ emoji: "😳", name: "Scham", staerke: 80 }, { emoji: "😠", name: "Wut", staerke: 40 }],
      optionen: [
        { id: "mitlachen", text: "Mitlachen: »haha ja war müde 😅«", folge: "Finn: »schnarchnase 😂«. Es hört nicht auf. Es wird ein Spitzname.", danach: "Wenn ich mitlache, merkt keiner, dass es wehtut. Hoffe ich." },
        { id: "bitten", text: "»Löscht das bitte.«", folge: "Finn: »uiii empfindlich 😂«. Ben schickt drei Lach-Smileys.", danach: "Jetzt bin ich auch noch der Empfindliche." },
        { id: "nichts", text: "Nichts schreiben. Handy weglegen.", folge: "Das Handy vibriert noch zwölfmal. Du schaust trotzdem nach.", danach: "Vielleicht ist es morgen vergessen." },
        { id: "mama", text: "Mama beim Abendessen davon erzählen", erzaehlen: "Mama", folge: "Mama hört zu, ohne dich zu unterbrechen. »Das ist nicht okay. Willst du, dass ich was mache, oder sollen wir erst mal überlegen?«", danach: "Es ist nicht weg. Aber ich bin nicht mehr allein damit." },
      ],
    },
    {
      tag: 1, uhr: "15:45", ort: "Bus nach Hause",
      eingang: [
        { von: "8b · Ben", text: "hab nen sticker gemacht", bild: "💤 Dein Gesicht mit »ZZZ«" },
        { von: "Klikk", text: "@jonas_schnarcht hat dich in einem Beitrag erwähnt" },
        { von: "@jonas_schnarcht", text: "31 Follower" },
      ],
      gedanke: "31. Das ist fast die ganze Klasse. Auch Leute, mit denen ich mal gut war. Jemand hat einen Account gemacht, der ICH sein soll.",
      gefuehl: [{ emoji: "😶", name: "Ohnmacht", staerke: 85 }, { emoji: "😔", name: "Einsamkeit", staerke: 60 }],
      optionen: [
        { id: "melden", text: "Den Fake-Account bei Klikk melden", folge: "Klikk: »Wir haben keinen Verstoß gegen unsere Richtlinien festgestellt.«", danach: "Nicht mal die App glaubt mir." },
        { id: "bild", text: "Mein Profilbild löschen", folge: "Weg. Jetzt bist du ein grauer Kreis.", danach: "Wenn sie mich nicht sehen, können sie mich nicht auslachen." },
        { id: "ole", text: "Ole aus dem Fußball schreiben", erzaehlen: "Ole", folge: "Ole: »Alter, was für Idioten. Willst du morgen nach der Schule zocken?« Du sagst ja.", danach: "Wenigstens einer." },
        { id: "yilmaz", text: "Zu Frau Yilmaz gehen (Vertrauenslehrerin)", erzaehlen: "Frau Yilmaz", folge: "Frau Yilmaz nimmt sich Zeit, macht Notizen, fragt, was du dir wünschst. »Wir machen nichts über deinen Kopf hinweg.«", danach: "Jemand, der weiß, was man da machen kann." },
      ],
    },
    {
      tag: 2, uhr: "22:30", ort: "Bett",
      eingang: [
        { von: "Klikk", text: "14 neue Kommentare zu deinem Video 🎸" },
        { von: "Kommentar", text: "schnarch 💤" }, { von: "Kommentar", text: "sticker > lied" }, { von: "Kommentar", text: "geh schlafen" },
        { von: "Unbekannt aus der 8b", text: "Hey, alles okay bei dir? Das in der Gruppe ist echt daneben." },
      ],
      gedanke: "Ich spiel seit zwei Jahren. Das Video hat drei Wochen gedauert. Jetzt will ich nie wieder spielen. Aber einer hat geschrieben. Einer.",
      gefuehl: [{ emoji: "💔", name: "Verletzt", staerke: 90 }, { emoji: "🥺", name: "Hoffnung", staerke: 25 }],
      optionen: [
        { id: "loeschen", text: "Das Video löschen. Alle Videos.", folge: "Leer. Zwei Jahre Gitarre, in zehn Sekunden.", danach: "Jetzt haben sie gewonnen." },
        { id: "lesen", text: "Alle Kommentare lesen. Auch die alten.", folge: "Es ist 3:12 Uhr. Du hast jeden einzelnen gelesen. Zweimal.", danach: "Vielleicht haben sie ja recht." },
        { id: "antwort", text: "Der Person ehrlich antworten", erzaehlen: "Lea", folge: "»danke. ich weiß nicht mal, was ich denen getan hab.« — »Nichts. Gar nichts.«", danach: "Es gibt Leute, die es auch nicht lustig finden." },
        { id: "papa", text: "Papa wecken und es ihm zeigen", erzaehlen: "Papa", folge: "Papa liest alles, ganz still. Dann umarmt er dich, das erste Mal seit Jahren. »Morgen rufen wir in der Schule an. Zusammen.«", danach: "Ich hätte nicht gedacht, dass er so reagiert." },
      ],
    },
    {
      tag: 3, uhr: "16:20", ort: "Zimmer",
      eingang: [
        { von: "8b · Sara", text: "UMFRAGE 📊 wer ist der größte loser der 8b?", bild: "📊 Jonas 14 · Ben 2 · Finn 1" },
        { von: "8b · Finn", text: "eindeutig 😂 stimmt alle ab" },
      ],
      gedanke: "14. Die zählen das. Die machen Statistik daraus. Ich will da morgen nicht hin. Ich will nirgends hin.",
      gefuehl: [{ emoji: "🕳️", name: "Leere", staerke: 85 }, { emoji: "😰", name: "Angst vor morgen", staerke: 90 }],
      optionen: [
        { id: "verlassen", text: "Die Gruppe verlassen", folge: "»Jonas hat die Gruppe verlassen.« Finn: »rage quit 😂«. Emma schickt es dir trotzdem per Screenshot.", danach: "Man kann nicht einfach gehen. Es kommt trotzdem an." },
        { id: "krank", text: "Mama sagen, dass mir morgen schlecht ist", folge: "Mama glaubt es. Du bleibst morgen zu Hause. Und übermorgen?", danach: "Wegrennen hilft heute. Morgen nicht." },
        { id: "yilmaz2", text: "Frau Yilmaz die Umfrage zeigen", erzaehlen: "Frau Yilmaz", folge: "»Danke, dass du kommst. Das ist kein Streit mehr, das ist Mobbing. Darum kümmert sich ab morgen die Schule – und du sagst, was du brauchst.«", danach: "Ich musste es nicht allein tragen. Ich hätte früher gehen sollen. Aber jetzt ist auch okay." },
      ],
    },
  ],
  ende: erzaehlt => erzaehlt.some(e => e.wem === "Frau Yilmaz" || e.wem === "Mama" || e.wem === "Papa")
    ? { titel: "Freitag: Es hört auf", text: `Am Freitag spricht die Schule mit der Klasse. Der Fake-Account ist weg, Finn und Ben müssen zur Schulleitung. Es ist nicht alles gut – aber es ist nicht mehr dein Geheimnis. Du hast es ${erzaehlt.map(e => e.wem).join(", ")} erzählt. Jedes Mal war es schwer.` }
    : erzaehlt.length
      ? { titel: "Freitag: Nicht ganz allein", text: `Du hast es ${erzaehlt.map(e => e.wem).join(", ")} gesagt. Das hilft. Aber die Gruppe macht weiter, bis ein Erwachsener eingreift. Freund·innen können zuhören – stoppen können es oft nur Erwachsene.` }
      : { titel: "Freitag: Allein", text: "Du bleibst zu Hause. Niemand weiß, warum. Im Chat geht es weiter, auch ohne dich. Das Schwerste war nicht das Foto – sondern es allein auszuhalten." },
};

const EMMA: OpferRolle = {
  id: "emma", name: "Emma", emoji: "🌻",
  intro: "Du bist Emma, 14, 8b. Du machst Leichtathletik, lachst viel, auch mal über andere. Am Donnerstagabend kommt eine Nachricht, die alles verändert.",
  szenen: [
    {
      tag: 3, uhr: "20:20", ort: "Wohnzimmer, Familie schaut Fernsehen",
      eingang: [
        { von: "8b · Ben", text: "😏 ratet mal wer das ist", bild: "🚫 Ein Foto von dir. In der Umkleide. Nach dem Sport. Du hast es nie gesehen." },
        { von: "8b · Sara", text: "OMG 💀💀 schickt das weiter" },
        { von: "Unbekannt", text: "bist du das 😏" },
      ],
      gedanke: "Wer hat das gemacht? Wann? Wie viele haben das? Wird das gerade weitergeschickt, jetzt, in diesem Moment? Ich kann nicht atmen.",
      gefuehl: [{ emoji: "😱", name: "Panik", staerke: 95 }, { emoji: "😳", name: "Scham", staerke: 95 }],
      optionen: [
        { id: "ben", text: "Ben schreiben: »Lösch das SOFORT!!«", folge: "Ben: »chill, ist doch nur spaß 😂«. Zwei Minuten später hat es jemand in eine andere Gruppe gestellt.", danach: "Er hört nicht auf mich. Warum sollte er." },
        { id: "zimmer", text: "Ins Zimmer gehen, Tür zu, nichts sagen", folge: "Du sitzt auf dem Boden, das Handy in der Hand. 27 neue Nachrichten. Du öffnest keine. Du öffnest alle.", danach: "Wenn ich nichts sage, ist es vielleicht nicht wahr." },
        { id: "mama", text: "Zurück ins Wohnzimmer und Mama das Handy zeigen", erzaehlen: "Mama", folge: "Mama schaut, wird blass, macht den Fernseher aus. »Das ist eine Straftat. Nicht deine. Wir machen Screenshots von den Nachrichten – nicht vom Bild – und gehen morgen zur Polizei.«", danach: "Ich dachte, sie wäre sauer auf mich. Sie ist sauer für mich." },
      ],
    },
    {
      tag: 4, uhr: "07:10", ort: "Küche, vor der Schule",
      eingang: [
        { von: "Unbekannt", text: "hab dich gesehen 😏" },
        { von: "8b (privat) · jemand", text: "Da geht ein Foto von dir rum. Ich hab's nicht weitergeschickt. Kann ich dir helfen?" },
      ],
      gedanke: "Ich will da nicht hin. Alle wissen es. Jeder Blick wird heißen: Ich hab dich gesehen. Aber einer hat geschrieben, dass er hilft.",
      gefuehl: [{ emoji: "😰", name: "Angst", staerke: 90 }, { emoji: "🫥", name: "Unsichtbar sein wollen", staerke: 80 }],
      optionen: [
        { id: "zuhause", text: "Zu Hause bleiben, Handy aus", folge: "Der Tag zieht sich. Das Handy liegt umgedreht auf dem Tisch. Du schaust trotzdem jede Stunde.", danach: "Weglaufen fühlt sich sicher an. Ist es nicht." },
        { id: "hilfe", text: "Der Person antworten: »Ja. Kommst du mit zu Frau Yilmaz?«", erzaehlen: "Frau Yilmaz", folge: "Ihr geht zusammen. Frau Yilmaz ruft sofort die Schulleitung und deine Eltern an. Ben muss sein Handy abgeben, die Polizei ermittelt.", danach: "Ich musste es nicht allein sagen. Das hat den Unterschied gemacht." },
      ],
    },
  ],
  ende: erzaehlt => erzaehlt.length
    ? { titel: "Danach", text: `Du hast es ${erzaehlt.map(e => e.wem).join(" und ")} gesagt. Das Foto wird überall gelöscht, gegen Ben wird ermittelt (§ 201a StGB). Die Scham bleibt eine Weile. Aber sie gehört nicht dir – sondern dem, der fotografiert hat, und allen, die es weitergeleitet haben.` }
    : { titel: "Danach", text: "Niemand Erwachsenes weiß Bescheid. Das Foto ist noch da, auf Handys, die du nicht kennst. Je früher ein Erwachsener eingreift, desto mehr lässt sich löschen und stoppen." },
};

export const ROLLEN: OpferRolle[] = [JONAS, EMMA];
