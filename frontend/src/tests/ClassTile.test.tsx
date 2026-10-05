import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClassTile } from "@/components/ClassTile";
import { makeClass } from "./helpers";

describe("ClassTile", () => {
  it("displays the class code", () => {
    render(<ClassTile cls={makeClass({ code: "7b" })} selected={false} onClick={vi.fn()} />);
    expect(screen.getByText("7b")).toBeInTheDocument();
  });

  it("shows the point count", () => {
    render(<ClassTile cls={makeClass({ total_points: 42 })} selected={false} onClick={vi.fn()} />);
    expect(screen.getByText("42 Punkte")).toBeInTheDocument();
  });

  it("shows an emoji symbol when one is set", () => {
    render(<ClassTile cls={makeClass({ symbol_emoji: "🦁" })} selected={false} onClick={vi.fn()} />);
    expect(screen.getByText("🦁")).toBeInTheDocument();
  });

  it("renders an image when no emoji is set", () => {
    render(<ClassTile cls={makeClass({ code: "5a" })} selected={false} onClick={vi.fn()} />);
    const img = screen.getByRole("img", { name: "5a" });
    expect(img).toBeInTheDocument();
  });

  it("uses a custom image URL when symbol_image is set", () => {
    render(
      <ClassTile
        cls={makeClass({ symbol_image: "/uploads/gfx/custom_abc.png" })}
        selected={false}
        onClick={vi.fn()}
      />
    );
    expect(screen.getByRole("img")).toHaveAttribute("src", "/uploads/gfx/custom_abc.png");
  });

  it("calls onClick when the tile is clicked", async () => {
    const handleClick = vi.fn();
    render(<ClassTile cls={makeClass()} selected={false} onClick={handleClick} />);
    await userEvent.click(screen.getAllByRole("button")[0]);
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("applies a yellow border when selected", () => {
    const { container } = render(
      <ClassTile cls={makeClass()} selected={true} onClick={vi.fn()} />
    );
    const button = container.querySelector("button");
    expect(button?.className).toContain("border-(--border-selected)");
  });

  it("does not apply the selected border when not selected", () => {
    const { container } = render(
      <ClassTile cls={makeClass()} selected={false} onClick={vi.fn()} />
    );
    const button = container.querySelector("button");
    expect(button?.className).not.toContain("border-(--border-selected)");
  });
});
