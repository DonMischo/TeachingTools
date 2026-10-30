/**
 * Erfolge in Klikk — gute und schlechte. Die guten belohnen, was im echten
 * Leben hilft; die »Schattenseiten« sind die Abzeichen, die eine echte App
 * stolz verleihen würde. Gelesen von /erfolge (lib/erfolge/register.ts).
 */
import { SIGNALE, istGewaehlt, jonasGeschrieben, taeterPunkte } from "./geschichte";
import { trendNachId } from "./trends";
import type { Stand } from "./typen";

export interface KlikkErfolg { id: string; icon: string; name: string; text: string; gut: boolean; erreicht: (s: Stand) => boolean }

export const KLIKK_ERFOLGE: KlikkErfolg[] = [
  // ── Gute ──
  { id: "leseratte", icon: "📖", name: "Leseratte", text: "Ein ganzes Buch gelesen, ohne einmal aufs Handy zu schauen.", gut: true,
    erreicht: s => Object.keys(s.flags).some(k => k.startsWith("gelesen_") && s.freizeit.filter(f => f.art === "lesen" && f.id === k.slice(8)).every(f => f.unterbrochen === 0)) },
  { id: "jonas", icon: "🫂", name: "Für Jonas da", text: "Jonas mindestens zweimal geschrieben.", gut: true, erreicht: s => jonasGeschrieben(s).length >= 2 },
  { id: "hingesehen", icon: "👁️", name: "Hingesehen", text: "Alle Warnsignale bei Jonas bemerkt.", gut: true, erreicht: s => Object.keys(s.bemerkt).length >= SIGNALE.length },
  { id: "nein", icon: "✋", name: "Nein gesagt", text: "Mo vom #GleisSelfie abgehalten.", gut: true, erreicht: s => istGewaehlt(s, "gleis") === "stopp" },
  { id: "mutig", icon: "🚨", name: "Mutig gemeldet", text: "Einem Erwachsenen Bescheid gesagt (Umfrage, Emmas Foto oder leon.16).", gut: true,
    erreicht: s => istGewaehlt(s, "umfrage") === "screenshot" || istGewaehlt(s, "emmaFoto") === "melden" || !!s.flags.leonGemeldet },
  { id: "faktencheck", icon: "🔎", name: "Faktenchecker·in", text: "Drei Meldungen richtig geprüft.", gut: true, erreicht: s => Object.values(s.checks).filter(c => c.richtig).length >= 3 },
  { id: "datenschutz", icon: "🛡️", name: "Datenschützer·in", text: "App-Tracking verboten und die Werbe-ID zurückgesetzt.", gut: true, erreicht: s => s.trackingAus && s.werbeIdNeu },
  { id: "schlaf", icon: "😴", name: "Ausgeschlafen", text: "Jede Nacht mindestens 8 Stunden geschlafen.", gut: true, erreicht: s => s.schlaf.length >= 4 && s.schlaf.every(h => h >= 8) },
  { id: "agb", icon: "📜", name: "AGB gelesen (ernsthaft?)", text: "Mindestens eine Minute in den Nutzungsbedingungen verbracht.", gut: true, erreicht: s => s.agbSekunden >= 60 },
  { id: "offline", icon: "🌳", name: "Offline-Held·in", text: "Fünf Stunden Freizeit ohne Handy in der Woche.", gut: true, erreicht: s => s.freizeit.reduce((a, f) => a + f.minuten, 0) >= 300 },
  { id: "familie", icon: "👨‍👩‍👧", name: "Familienmensch", text: "Drei Bitten der Familie freiwillig zugesagt.", gut: true, erreicht: s => s.famZusagen.length >= 3 },
  { id: "freundschaft", icon: "🌸", name: "Ausgesprochen", text: "Den Streit mit Lea persönlich geklärt.", gut: true, erreicht: s => istGewaehlt(s, "leaStreit") === "reden" },
  // ── Schattenseiten ──
  { id: "doomscroller", icon: "🧟", name: "Doomscroller", text: "Über 120 Beiträge angesehen.", gut: false, erreicht: s => s.gesehen.length >= 120 },
  { id: "nachteule", icon: "🦉", name: "Nachteule", text: "Zweimal nach 23 Uhr am Handy.", gut: false, erreicht: s => s.nachtOeffnungen.length >= 2 },
  { id: "mitlaeufer", icon: "🤡", name: "Mitläufer·in", text: "Beim Mobbing gegen Jonas mitgemacht.", gut: false, erreicht: s => taeterPunkte(s) >= 2 },
  { id: "weiterleiter", icon: "📤", name: "Weiterleiter·in", text: "Ein heimliches Foto oder ein KI-Fake weitergeschickt.", gut: false,
    erreicht: s => istGewaehlt(s, "emmaFoto") === "weiter" || istGewaehlt(s, "deepfake") === "weiter" },
  { id: "likes", icon: "🎢", name: "Für Likes alles", text: "Ein lebensgefährliches Challenge-Video echt gedreht.", gut: false,
    erreicht: s => s.videos.some(v => !v.fake && trendNachId(v.trend)?.risiko === "gefaehrlich") },
  { id: "clickbait", icon: "🎰", name: "Reingefallen", text: "Bei einer Anzeige auf »Bestellen« gedrückt.", gut: false, erreicht: s => s.werbungKlicks.some(k => k.stufe === "bestellt") },
  { id: "gewinnspiel", icon: "💸", name: "Gewinnspiel-Fan", text: "Die Handynummer an ein »Gewinnspiel« geschickt.", gut: false, erreicht: s => istGewaehlt(s, "gewinn") === "nummer" },
  { id: "streak", icon: "⛓️", name: "Streak-Sklave", text: "Die Streak nachts gerettet.", gut: false, erreicht: s => s.nachtOeffnungen.length > 0 && s.streak >= 14 },
  { id: "weggeschaut", icon: "🙈", name: "Weggeschaut", text: "Kein Warnsignal bemerkt, Jonas nie geschrieben.", gut: false,
    erreicht: s => s.tag >= 4 && Object.keys(s.bemerkt).length === 0 && jonasGeschrieben(s).length === 0 },
  { id: "binge", icon: "📺", name: "Nur noch eine Folge", text: "Eine ganze Serie an einem Tag geschaut.", gut: false,
    erreicht: s => s.freizeit.some(f => f.art === "serie" && f.minuten >= 170) },
];
