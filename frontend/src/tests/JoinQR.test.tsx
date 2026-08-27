/**
 * QR-Codes lassen sich zum Abscannen groß über die Seite legen.
 *
 * Die QR-Codes sitzen in schmalen Panels; aus der letzten Reihe sind sie nicht
 * zu treffen. Ein Klick vergrößert sie deshalb bildschirmfüllend.
 *
 * Wichtig ist dabei zweierlei: das Overlay hängt per Portal an <body> (sonst
 * beschneidet es der nächste Vorfahr mit overflow/transform), und es lässt sich
 * ohne Mausweg wieder schließen.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { JoinQR } from "@/components/JoinQR";

const URL = "http://192.168.1.5:1339/play/ABC123";

describe("JoinQR", () => {
  it("zeigt ohne URL gar nichts", () => {
    const { container } = render(<JoinQR url={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("vergrößert den QR auf Klick und zeigt die URL dazu", async () => {
    const user = userEvent.setup();
    render(<JoinQR url={URL} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "QR-Code vergrößern" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(URL);
    // Am <body>, nicht im Panel — sonst schneidet ein overflow-Vorfahr ab.
    expect(dialog.parentElement).toBe(document.body);
  });

  it("schließt per Escape und per Schließen-Knopf", async () => {
    const user = userEvent.setup();
    render(<JoinQR url={URL} />);

    await user.click(screen.getByRole("button", { name: "QR-Code vergrößern" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "QR-Code vergrößern" }));
    await user.click(screen.getByRole("button", { name: "Schließen" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("gibt die Seite nach dem Schließen wieder zum Scrollen frei", async () => {
    const user = userEvent.setup();
    render(<JoinQR url={URL} />);

    await user.click(screen.getByRole("button", { name: "QR-Code vergrößern" }));
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("bleibt ohne Lupe, wo der QR schon in einem Button steckt", async () => {
    const onOuter = vi.fn();
    const user = userEvent.setup();
    render(
      <button onClick={onOuter}>
        <JoinQR url={URL} size={28} zoomable={false} />
      </button>,
    );

    // Kein eigener Knopf — sonst wären es verschachtelte Buttons.
    expect(screen.queryByRole("button", { name: "QR-Code vergrößern" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button"));
    expect(onOuter).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
