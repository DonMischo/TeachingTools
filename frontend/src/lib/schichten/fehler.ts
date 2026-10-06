/**
 * Fehlersuche: »Das Foto kommt nicht an.« Jeder Fall hat ein Symptom,
 * Werkzeuge mit ihrer Ausgabe (so wie unter Windows auf Deutsch) und die
 * Schicht, in der der Fehler steckt. Die Ausgaben sind gekürzt, aber echt
 * aufgebaut.
 */
import type { SchichtNr } from "./kapselung";

export interface Werkzeug {
  befehl: string;
  ausgabe: string;
}

export interface Fall {
  id: string;
  titel: string;
  symptom: string;
  werkzeuge: Werkzeug[];
  loesung: SchichtNr;
  erkl: string;
}

const IPCONFIG_OK = `Drahtlos-LAN-Adapter WLAN:

   Verbindungsspezifisches DNS-Suffix: fritz.box
   IPv4-Adresse  . . . . . . . . . . : 192.168.178.23
   Subnetzmaske  . . . . . . . . . . : 255.255.255.0
   Standardgateway . . . . . . . . . : 192.168.178.1`;

const IPCONFIG_GETRENNT = `Drahtlos-LAN-Adapter WLAN:

   Medienstatus. . . . . . . . . . . : Medium getrennt
   Verbindungsspezifisches DNS-Suffix:`;

const PING_GATEWAY_OK = `Ping wird ausgeführt für 192.168.178.1 mit 32 Bytes Daten:
Antwort von 192.168.178.1: Bytes=32 Zeit=3ms TTL=64
Antwort von 192.168.178.1: Bytes=32 Zeit=2ms TTL=64
Antwort von 192.168.178.1: Bytes=32 Zeit=4ms TTL=64
Antwort von 192.168.178.1: Bytes=32 Zeit=2ms TTL=64

Ping-Statistik für 192.168.178.1:
    Pakete: Gesendet = 4, Empfangen = 4, Verloren = 0 (0% Verlust)`;

const PING_TOKIO_OK = `Ping wird ausgeführt für 203.0.113.7 mit 32 Bytes Daten:
Antwort von 203.0.113.7: Bytes=32 Zeit=231ms TTL=52
Antwort von 203.0.113.7: Bytes=32 Zeit=229ms TTL=52
Antwort von 203.0.113.7: Bytes=32 Zeit=233ms TTL=52
Antwort von 203.0.113.7: Bytes=32 Zeit=230ms TTL=52

Ping-Statistik für 203.0.113.7:
    Pakete: Gesendet = 4, Empfangen = 4, Verloren = 0 (0% Verlust)`;

const NSLOOKUP_OK = `Server:  fritz.box
Address:  192.168.178.1

Nicht autorisierende Antwort:
Name:    tokio.katzenpost.example
Address:  203.0.113.7`;

const PING = "ping 203.0.113.7";
const PING_GW = "ping 192.168.178.1";
const NSLOOKUP = "nslookup tokio.katzenpost.example";
const PORT = "Test-NetConnection 203.0.113.7 -Port 443";

const PORT_OK = `ComputerName     : 203.0.113.7
RemoteAddress    : 203.0.113.7
RemotePort       : 443
InterfaceAlias   : WLAN
SourceAddress    : 192.168.178.23
TcpTestSucceeded : True`;

export const FAELLE: Fall[] = [
  {
    id: "wlan-aus",
    titel: "Funkstille",
    symptom: "Lena tippt auf Senden — nichts passiert, die App zeigt »Keine Verbindung«. Oben in der Leiste fehlt das WLAN-Symbol.",
    werkzeuge: [
      { befehl: "ipconfig", ausgabe: IPCONFIG_GETRENNT },
      { befehl: PING_GW, ausgabe: "PING: Fehler bei der Übertragung. Allgemeiner Fehler." },
      { befehl: "WLAN-Liste", ausgabe: "Keine Netzwerke gefunden.\n(Flugmodus ist eingeschaltet.)" },
    ],
    loesung: 1,
    erkl: "Es geht gar kein Signal hinaus: Flugmodus. Ohne Funkwellen, Strom oder Licht hilft keine höhere Schicht — Schicht 1 ist die Grundlage für alles.",
  },
  {
    id: "kabel",
    titel: "Lose Verbindung",
    symptom: "Am Schul-PC lädt Lena das Foto hoch. Gestern ging es, heute: »Kein Internet«. Unter dem Tisch hat jemand gestaubsaugt.",
    werkzeuge: [
      { befehl: "ipconfig", ausgabe: "Ethernet-Adapter Ethernet:\n\n   Medienstatus. . . . . . . . . . . : Medium getrennt" },
      { befehl: PING_GW, ausgabe: "PING: Fehler bei der Übertragung. Allgemeiner Fehler." },
      { befehl: "Blick auf die Buchse", ausgabe: "Die grüne Lampe an der Netzwerkbuchse ist aus. Das Kabel hängt halb heraus." },
    ],
    loesung: 1,
    erkl: "Das Kabel steckt nicht richtig — keine Spannungspulse, kein Signal. »Medium getrennt« ist die Meldung von Schicht 1.",
  },
  {
    id: "mac-filter",
    titel: "Nicht auf der Liste",
    symptom: "Lena ist bei ihrer Freundin. Das WLAN hat volle Balken, das Passwort stimmt — trotzdem: »Verbindung mit diesem Netzwerk nicht möglich«. Alle anderen Handys sind drin.",
    werkzeuge: [
      { befehl: "WLAN-Liste", ausgabe: "FRITZ!Box 7590 ZX   ▂▄▆█  gesichert\n→ Verbindung mit diesem Netzwerk nicht möglich." },
      { befehl: "ipconfig", ausgabe: IPCONFIG_GETRENNT },
      { befehl: "Routereinstellungen (Freundin)", ausgabe: "WLAN → Sicherheit → Zugang:\n☑ Nur bekannte WLAN-Geräte zulassen (MAC-Adressfilter)\n   Bekannt: 3 Geräte — 5a:3c:91:2e:47:b8 ist nicht dabei." },
    ],
    loesung: 2,
    erkl: "Das Signal ist da (Schicht 1 in Ordnung), aber der Router nimmt keine Rahmen von Lenas MAC-Adresse an. Wer im lokalen Netz mitreden darf, entscheidet Schicht 2.",
  },
  {
    id: "gateway",
    titel: "Falscher Ausgang",
    symptom: "Lenas Bruder hat am Laptop »etwas eingestellt«. Drucker und Router im Heimnetz gehen, aber keine einzige Seite im Internet.",
    werkzeuge: [
      { befehl: "ipconfig", ausgabe: IPCONFIG_OK.replace("192.168.178.1", "192.168.178.254") },
      { befehl: PING_GW, ausgabe: PING_GATEWAY_OK },
      { befehl: PING, ausgabe: "Ping wird ausgeführt für 203.0.113.7 mit 32 Bytes Daten:\nAntwort von 192.168.178.23: Zielhost nicht erreichbar.\nAntwort von 192.168.178.23: Zielhost nicht erreichbar.\n\nPakete: Gesendet = 4, Empfangen = 4, Verloren = 0 (0% Verlust)" },
    ],
    loesung: 3,
    erkl: "Das Standardgateway zeigt auf 192.168.178.254 — dort steht kein Router. Pakete für fremde Netze wissen nicht, wohin. Wege zwischen Netzen sind Sache von Schicht 3 (Vermittlung).",
  },
  {
    id: "schleife",
    titel: "Im Kreis",
    symptom: "Seit einer Bauarbeit beim Anbieter kommt nichts mehr in Tokio an. Andere Seiten gehen.",
    werkzeuge: [
      { befehl: PING, ausgabe: "Ping wird ausgeführt für 203.0.113.7 mit 32 Bytes Daten:\nAntwort von 198.18.4.2: TTL beim Transit abgelaufen.\nAntwort von 198.18.4.2: TTL beim Transit abgelaufen." },
      { befehl: "tracert 203.0.113.7", ausgabe: "Routenverfolgung zu 203.0.113.7 über maximal 30 Hops\n\n  1     3 ms  fritz.box [192.168.178.1]\n  2    11 ms  198.18.0.1\n  3    14 ms  198.18.4.1\n  4    15 ms  198.18.4.2\n  5    16 ms  198.18.4.1\n  6    17 ms  198.18.4.2\n  7    18 ms  198.18.4.1\n  …" },
    ],
    loesung: 3,
    erkl: "Zwei Router schicken sich das Paket gegenseitig zu (Routing-Schleife). Die TTL zählt bei jedem Hop herunter, bis sie 0 ist — dann wird das Paket weggeworfen. Wegwahl ist Schicht 3.",
  },
  {
    id: "firewall",
    titel: "Tür zu",
    symptom: "Im Schulnetz klappt »ping« nach Tokio, aber die Foto-App meldet nach 20 Sekunden »Zeitüberschreitung«.",
    werkzeuge: [
      { befehl: PING, ausgabe: PING_TOKIO_OK },
      { befehl: PORT, ausgabe: PORT_OK.replace("True", "False") + "\nWARNUNG: TCP connect to 203.0.113.7:443 failed" },
      { befehl: NSLOOKUP, ausgabe: NSLOOKUP_OK },
    ],
    loesung: 4,
    erkl: "Der Server ist erreichbar (Schicht 3 in Ordnung), aber an Port 443 kommt keine TCP-Verbindung zustande — die Schul-Firewall lässt den Handschlag (SYN) nicht durch. Ports und Verbindungen gehören zu Schicht 4.",
  },
  {
    id: "verlust",
    titel: "Stückwerk",
    symptom: "Das Foto wird hochgeladen — aber quälend langsam, der Balken stockt immer wieder. Im Hintergrund lädt jemand ein riesiges Spiel herunter.",
    werkzeuge: [
      { befehl: "ping -n 10 203.0.113.7", ausgabe: "Antwort von 203.0.113.7: Bytes=32 Zeit=412ms TTL=52\nZeitüberschreitung der Anforderung.\nAntwort von 203.0.113.7: Bytes=32 Zeit=980ms TTL=52\nZeitüberschreitung der Anforderung.\nZeitüberschreitung der Anforderung.\n…\nPakete: Gesendet = 10, Empfangen = 6, Verloren = 4 (40% Verlust)" },
      { befehl: "netstat -s -p tcp", ausgabe: "TCP-Statistik für IPv4\n  Gesendete Segmente          = 4123\n  Erneut übertragene Segmente = 1388" },
    ],
    loesung: 4,
    erkl: "Die Leitung ist überfüllt, viele Pakete gehen verloren. TCP (Schicht 4) merkt es an fehlenden Bestätigungen, schickt die Stücke noch einmal und bremst — deshalb kommt das Foto an, nur langsam. Fehlende Stücke? Schicht 4.",
  },
  {
    id: "sitzung",
    titel: "Abgemeldet",
    symptom: "Lena lässt die App eine Stunde offen, dann tippt sie auf Senden: »Sitzung abgelaufen — bitte erneut anmelden«. Das Netz ist in Ordnung.",
    werkzeuge: [
      { befehl: PING, ausgabe: PING_TOKIO_OK },
      { befehl: PORT, ausgabe: PORT_OK },
      { befehl: "App-Protokoll", ausgabe: "POST /v1/fotos → 401 Unauthorized\nGrund: session_expired (Sitzung seit 61 min ohne Aktivität)" },
    ],
    loesung: 5,
    erkl: "Verbindung und Server sind da, aber das »Gespräch« zwischen App und Server ist beendet: Die Sitzung lief ab. Gespräche aufbauen, halten und beenden ist die Aufgabe von Schicht 5.",
  },
  {
    id: "uhrzeit",
    titel: "Zeitreise",
    symptom: "Nach einem Akkuwechsel steht auf Lenas altem Tablet der 1. Januar 2009. Keine App bekommt eine sichere Verbindung.",
    werkzeuge: [
      { befehl: PORT, ausgabe: PORT_OK },
      { befehl: "Browser", ausgabe: "Ihre Verbindung ist nicht privat\nNET::ERR_CERT_DATE_INVALID\nDas Zertifikat von tokio.katzenpost.example ist erst ab 12.03.2026 gültig." },
    ],
    loesung: 6,
    erkl: "TCP steht, aber die Verschlüsselung scheitert: Mit falscher Uhrzeit hält das Tablet das Zertifikat für ungültig und baut keinen TLS-Schlüssel auf. Verschlüsseln gehört im OSI-Modell zur Darstellungsschicht (6).",
  },
  {
    id: "zeichen",
    titel: "Zeichensalat",
    symptom: "Das Foto kommt an, aber die Bildunterschrift lautet beim Bruder »GrÃ¼ÃŸe aus Erfurt ðŸ±«.",
    werkzeuge: [
      { befehl: "App-Protokoll (Tokio)", ausgabe: "empfangen: 47 72 c3 bc c3 9f 65 …\ngelesen als: Windows-1252\nerwartet:    UTF-8" },
    ],
    loesung: 6,
    erkl: "Die Bytes sind vollständig und richtig angekommen — sie werden nur in der falschen Zeichencodierung gelesen: c3 bc ist in UTF-8 ein »ü«, in Windows-1252 »Ã¼«. Wie Daten dargestellt und codiert werden, regelt Schicht 6.",
  },
  {
    id: "format",
    titel: "Unbekanntes Format",
    symptom: "Lenas neues Handy speichert Fotos platzsparend. Beim Bruder (altes Handy) erscheint nur ein graues Kästchen mit Fragezeichen.",
    werkzeuge: [
      { befehl: "Dateiinfo", ausgabe: "katze.heic — 1,9 MB — Typ: image/heic (HEIF)" },
      { befehl: "App-Protokoll (Tokio)", ausgabe: "Bild empfangen, 1 954 112 Byte, Prüfsummen in Ordnung\nAnzeige: Format image/heic wird nicht unterstützt" },
    ],
    loesung: 6,
    erkl: "Alles kam an, aber das Bildformat versteht das alte Gerät nicht. Komprimieren und Formate (JPEG, HEIC, UTF-8 …) sind Darstellung — Schicht 6. Lösung: beim Senden in JPEG umwandeln.",
  },
  {
    id: "dns",
    titel: "Name unbekannt",
    symptom: "»Server nicht gefunden«. Mit der Zahlenadresse 203.0.113.7 kommt man aber durch.",
    werkzeuge: [
      { befehl: NSLOOKUP, ausgabe: "Server:  fritz.box\nAddress:  192.168.178.1\n\n*** tokio.katzenpost.example wurde von fritz.box nicht gefunden: Non-existent domain" },
      { befehl: PING, ausgabe: PING_TOKIO_OK },
      { befehl: "ping tokio.katzenpost.example", ausgabe: "Ping-Anforderung konnte Host \"tokio.katzenpost.example\" nicht finden. Überprüfen Sie den Namen, und versuchen Sie es erneut." },
    ],
    loesung: 7,
    erkl: "Die Leitung bis Tokio funktioniert, nur das Nachschlagen des Namens (DNS) scheitert — z. B. ein Tippfehler in der App-Einstellung. DNS ist ein Dienst der Anwendungsschicht (7).",
  },
  {
    id: "http",
    titel: "Falsche Tür im Server",
    symptom: "Nach einem App-Update: »Hochladen fehlgeschlagen (Fehler 404)«. Alle anderen Apps funktionieren.",
    werkzeuge: [
      { befehl: NSLOOKUP, ausgabe: NSLOOKUP_OK },
      { befehl: PORT, ausgabe: PORT_OK },
      { befehl: "App-Protokoll", ausgabe: "POST /v2/fotos HTTP/1.1 → HTTP/1.1 404 Not Found\n(der Server kennt nur /v1/fotos)" },
    ],
    loesung: 7,
    erkl: "Netz, Verbindung und Verschlüsselung stehen. Aber die App fragt nach einer Adresse, die der Server nicht kennt. HTTP-Anfragen und ihre Antworten sind Schicht 7.",
  },
];
