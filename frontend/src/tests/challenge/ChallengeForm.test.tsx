import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChallengeForm, type ChallengeJson } from "@/components/vorlagen/ChallengeForm";

const satz: ChallengeJson = {
  title: "T", stages: [{ id: 1, title: "E" }],
  facts: [{ id: "f1", text: "Echter Fakt" }, { id: "x1", text: "Falscher Ablenker", decoy: true }],
  challenges: [{ id: "c1", text: "Frage", solve: { any: [] } }],
  levels: { "1": { omit: ["c1"] } }, extra: 7,
};

describe("ChallengeForm", () => {
  it("setzt solve per Chip, zeigt keine Ablenker als Chip und erhält levels", async () => {
    const onChange = vi.fn();
    render(<ChallengeForm value={satz} onChange={onChange} upload={vi.fn()} satzId={1} />);
    expect(screen.queryAllByRole("button", { name: "Falscher Ablenker" })).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Echter Fakt" }));
    const neu = onChange.mock.calls[0][0] as ChallengeJson;
    expect(neu.challenges[0].solve).toEqual({ any: ["f1"] });
    expect(neu.levels).toEqual(satz.levels);
    expect(neu.extra).toBe(7);
  });
});
