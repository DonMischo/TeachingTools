"use client";
/** Boss-Folie im TaskCrawler: das Challenge-Spiel, eingebettet; die Antworten laufen über den Attempt. */
import ChallengeSpiel from "@/components/challenge/ChallengeSpiel";
import { bossQuelle, type BossAntwort } from "@/lib/challenge/bossQuelle";
import type { ExitGameAttemptSummary, ExitGameFragment, ExitGameSlide } from "@/lib/api";

export default function BossArea({ slide, attemptId, onSlideSolved, onFertig }: {
  slide: ExitGameSlide; attemptId: number;
  onSlideSolved: (attempt: ExitGameAttemptSummary, frags: ExitGameFragment[]) => void;
  onFertig: () => void;
}) {
  return (
    <ChallengeSpiel key={slide.id} quelle={bossQuelle(attemptId, slide)} onFertig={onFertig}
      onAntwort={(r) => { const b = r as BossAntwort; if (b.fertig && b.attempt) onSlideSolved(b.attempt, b.code_fragments); }} />
  );
}
