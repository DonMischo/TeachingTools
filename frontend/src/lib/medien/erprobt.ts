/**
 * Mitmach-Demos und Spiele, die man »erproben« kann: Wer die Aufgabe einer
 * Demo löst, bekommt den Eintrag in `Fortschritt.erprobt` — daraus werden
 * Erfolge (lib/medien/erfolge.ts). Die Demos melden das über `useErprobt()`.
 */
import { createContext, useContext } from "react";

export const ERPROBT = [
  { id: "hoehlenwand", icon: "🖐️", name: "Höhlenmaler", text: "Mal ein Bild an die Höhlenwand (Station Höhlenmalerei)." },
  { id: "keilschrift", icon: "🧱", name: "Tontafel gebrannt", text: "Drück mindestens 8 Keile in den Ton und brenn die Tafel." },
  { id: "hieroglyphen", icon: "𓂀", name: "Schreiberlehrling", text: "Mal eine Hieroglyphe mit drei Sternen nach." },
  { id: "kartusche", icon: "👑", name: "Eigene Kartusche", text: "Mal alle Zeichen deines Namens nach." },
  { id: "quipu", icon: "🪢", name: "Knotenzähler", text: "Knüpf beim Quipu die gesuchte Zahl." },
  { id: "leuchtfeuer", icon: "🔥", name: "Troja ist gefallen", text: "Schick die Feuerkette bis nach Argos." },
  { id: "boten", icon: "🏇", name: "Königsstraße", text: "Schick eine Staffel los, die in weniger als 10 Tagen in Susa ist." },
  { id: "setzkasten", icon: "🔠", name: "Gedruckt!", text: "Setz ein Wort und druck drei Abzüge." },
  { id: "chappe", icon: "🗼", name: "Flügeltelegraf", text: "Stell am Chappe-Telegrafen fünf Zeichen ein." },
  { id: "belichtung", icon: "📷", name: "Stillgehalten", text: "Halt bei der Belichtung so still, dass das Foto scharf wird." },
  { id: "morse", icon: "⚡", name: "SOS gefunkt", text: "Morse SOS mit der Taste." },
  { id: "fax", icon: "📠", name: "Gefaxt", text: "Fax ein Bild Zeile für Zeile." },
  { id: "waehlscheibe", icon: "☎️", name: "Durchgewählt", text: "Wähl eine vierstellige Nummer mit der Wählscheibe." },
  { id: "platte", icon: "🎶", name: "Richtige Drehzahl", text: "Spiel die Schellackplatte von 1904 mit 78 Umdrehungen." },
  { id: "satellit", icon: "🛰️", name: "Funk über den Himmel", text: "Schick ein Signal über die Satelliten." },
  { id: "kassette", icon: "📼", name: "Lieblingslied gefunden", text: "Spul die Kassette zum Lieblingslied." },
  { id: "diskette", icon: "💾", name: "Diskettenturm", text: "Rechne aus, wie viele Disketten ein großes Videospiel bräuchte." },
  { id: "sms", icon: "💬", name: "T9-Profi", text: "Schreib eine SMS mit T9." },
  { id: "modem", icon: "📞", name: "Online!", text: "Wähl dich mit dem Modem ins Internet ein." },
  { id: "pager", icon: "📟", name: "Piep piep", text: "Schick eine Pager-Nachricht." },
  { id: "dia", icon: "📽️", name: "Diaabend", text: "Leg drei Dias richtig herum ein." },
  { id: "rohrpost", icon: "📨", name: "Rohrpostmeister", text: "Stell die Weichen so, dass drei Büchsen beim richtigen Postamt ankommen." },
  { id: "litfass", icon: "🗞️", name: "Plakatkleber", text: "Kleb drei Plakate an die Litfaßsäule." },
  { id: "kino", icon: "🎞️", name: "Daumenkino", text: "Find heraus, ab wie vielen Bildern pro Sekunde die Bewegung flüssig wirkt." },
  { id: "radio", icon: "📻", name: "Am Drehknopf", text: "Stell drei Sender am Radio ein." },
  { id: "fernsehen", icon: "📺", name: "Zeile für Zeile", text: "Sieh dem Elektronenstrahl zu und dreh dann auf 625 Zeilen und 25 Bilder pro Sekunde." },
  { id: "cd", icon: "💿", name: "Laser liest", text: "Lass den Laser eine ganze Spur lesen und das Wort entschlüsseln." },
  { id: "videotext", icon: "📟", name: "Seite 100", text: "Ruf im Videotext drei verschiedene Seiten auf." },
  { id: "tonband", icon: "✂️", name: "Bandschnitt", text: "Schneid eine Aufnahme sauber zurecht." },
  { id: "overhead", icon: "🔦", name: "Scharf gestellt", text: "Schreib auf die Folie und stell das Bild scharf." },
  { id: "polaroid", icon: "🖼️", name: "Sofortbild", text: "Mach ein Sofortbild und warte, bis es fertig ist." },
  { id: "email", icon: "📧", name: "Post ohne Briefträger", text: "Schick eine E-Mail." },
  { id: "diskettenlaufwerk", icon: "💾", name: "Klack — eingelegt", text: "Leg die Diskette ins Laufwerk und speichere eine Datei." },
  { id: "qrcode", icon: "🔲", name: "Code geknackt", text: "Lies einen QR-Code mit dem Handy und trag den Text richtig ein — einen geschickten oder den Geheimcode." },
  { id: "nachricht", icon: "📬", name: "Post für dich", text: "Schick in einer Sitzung jemandem eine Nachricht mit einem alten Medium." },
] as const;
export type ErprobtId = (typeof ERPROBT)[number]["id"];
export const ERPROBT_IDS = new Set<string>(ERPROBT.map(e => e.id));

/** Meldet: diese Demo ist gelöst. Ohne Medien drumherum (Tests, Einzelaufruf) passiert nichts. */
export const ErprobtKontext = createContext<(id: ErprobtId) => void>(() => {});
export const useErprobt = () => useContext(ErprobtKontext);
