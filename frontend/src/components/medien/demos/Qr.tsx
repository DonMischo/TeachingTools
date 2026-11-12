"use client";
/**
 * QR-Code selbst bauen: höchstens 16 Zeichen Text — der Code enthält nur
 * diesen Text (keinen Link), die Handykamera zeigt also genau ihn an.
 * In einer Sitzung lässt er sich an andere schicken.
 */
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useErprobt } from "@/lib/medien/erprobt";
import { QrLesen, SendenLeiste } from "./Live";

export const QR_MAX = 16;
/** Geheimcodes zum Üben, wenn niemand einen schickt */
const GEHEIM = ["Rohrpost", "Morsetaste", "Wachstafel", "Brieftaube", "Litfaßsäule", "Telegraf", "Diskette", "Walkman", "Pager", "Quipu"];

export function QrDemo({ an, antwortAuf }: { an?: string; antwortAuf?: string } = {}) {
  const erprobt = useErprobt();
  const [text, setText] = useState("Hallo Klasse!");
  const [geheim, setGeheim] = useState(() => GEHEIM[Math.floor(Math.random() * GEHEIM.length)]);
  const [runde, setRunde] = useState(0);
  const inhalt = text.slice(0, QR_MAX);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div className="bg-white p-3 rounded-xl shadow-md shrink-0" aria-label={`QR-Code mit dem Text ${inhalt}`} role="img">
          <QRCodeSVG value={inhalt || " "} size={200} level="M" />
        </div>
        <div className="flex flex-col gap-2 text-sm flex-1 min-w-0">
          <label className="flex flex-col gap-1">
            <span className="font-bold">Dein Text (höchstens {QR_MAX} Zeichen)</span>
            <input className="input font-mono" value={text} maxLength={QR_MAX} onChange={e => setText(e.target.value)} />
            <span className="text-xs text-muted">{inhalt.length} / {QR_MAX} Zeichen — der Code wächst mit, wenn mehr drinsteht.</span>
          </label>
          <p className="text-xs">Die drei großen Quadrate in den Ecken sind die Suchmuster: Daran erkennt die Kamera Lage, Größe und Richtung des Codes.</p>
          <p className="text-xs text-muted">Halt die Handykamera drauf: Weil nur Text im Code steckt und keine Internetadresse, zeigt das Handy einfach deinen Text an. Bei echten QR-Codes steckt oft ein Link dahinter — darum erst lesen, dann tippen.</p>
        </div>
      </div>
      <SendenLeiste art="qr" inhalt={() => ({ text: inhalt })} bereit={inhalt.trim().length > 0} an={an} antwortAuf={antwortAuf} />
      <div className="card p-3 flex flex-col gap-2">
        <div className="font-black">🎯 Geheimcode knacken</div>
        <p className="text-xs text-muted">Wer dir einen QR-Code schickt, findet ihn im 📬 Posteingang — den liest du genauso. Ohne Post: Hier ist einer zum Üben.</p>
        <QrLesen key={runde} inhalt={geheim} groesse={120} onRichtig={() => erprobt("qrcode")} />
        <button className="btn-secondary self-start text-xs" onClick={() => { setGeheim(g => GEHEIM.filter(x => x !== g)[Math.floor(Math.random() * (GEHEIM.length - 1))]); setRunde(r => r + 1); }}>Neuer Geheimcode</button>
      </div>
    </div>
  );
}
