"use client";
/**
 * Die im Playhub gewählte Identität, auf dem Weg zur Werkzeugseite.
 *
 * /play fragt Name (und ggf. Avatar) einmal ab und legt beides unter
 * `hp_play_<CODE>` ab; die Werkzeugseite liest es beim Ankommen und tritt
 * damit selbst bei, statt noch einmal zu fragen. Der Hub ruft also nie die
 * Beitritts-API eines einzelnen Werkzeugs auf — jedes Werkzeug behält seinen
 * eigenen Beitritt, bekommt die Antworten aber schon fertig geliefert.
 *
 * Wer einen QR direkt scannt, hat keinen Eintrag: dann fragt die Werkzeugseite
 * wie bisher selbst.
 */
export type PlayIdentity = { name: string; avatar: string };

const key = (code: string) => `hp_play_${code.toUpperCase()}`;

export function savePlayIdentity(code: string, identity: PlayIdentity) {
  try { localStorage.setItem(key(code), JSON.stringify(identity)); } catch {}
}

export function readPlayIdentity(code: string): PlayIdentity | null {
  try {
    const raw = JSON.parse(localStorage.getItem(key(code)) ?? "null") as PlayIdentity | null;
    return raw && typeof raw.name === "string" ? raw : null;
  } catch {
    return null;
  }
}

/** Nach erfolgreichem Beitritt aufräumen — ab dann gilt der Zustand des Werkzeugs. */
export function clearPlayIdentity(code: string) {
  try { localStorage.removeItem(key(code)); } catch {}
}
