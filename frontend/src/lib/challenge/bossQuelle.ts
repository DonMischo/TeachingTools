/** Challenge-Quelle einer Boss-Folie im TaskCrawler: Lauf und Antworten liegen im Attempt (api/routers/exitgame.py). */
import { api, type ExitGameSlide } from "@/lib/api";
import type { ChallengeQuelle } from "./useChallengeLauf";

export type BossAntwort = Awaited<ReturnType<typeof api.exitgame.attempts.boss.antwort>>;

export const bossQuelle = (attemptId: number, slide: ExitGameSlide): ChallengeQuelle => ({
  schluessel: `boss:${attemptId}:${slide.id}`,
  direkt: true,
  info: async () => ({
    title: slide.title ?? "Boss", subject: null, stand: null,
    settings: { spiele: slide.spiele ?? ["boss"], theme: slide.theme ?? "klassisch", skin: slide.skin, startstufe: slide.startstufe ?? 2 },
  }),
  start: (spiel) => api.exitgame.attempts.boss.start(attemptId, slide.id, spiel),
  antwort: (body) => api.exitgame.attempts.boss.antwort(attemptId, slide.id, body),
  deck: (ids) => api.exitgame.attempts.boss.deck(attemptId, slide.id, ids),
});
