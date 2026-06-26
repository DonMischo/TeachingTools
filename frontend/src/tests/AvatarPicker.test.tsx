import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AvatarPicker } from "@/components/AvatarPicker";

describe("AvatarPicker", () => {
  it("renders all avatars", () => {
    render(<AvatarPicker selected={null} onSelect={vi.fn()} />);
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });

  it("calls onSelect with the avatar id when clicked", async () => {
    const onSelect = vi.fn();
    render(<AvatarPicker selected={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByTitle("cat"));
    expect(onSelect).toHaveBeenCalledWith("cat");
  });

  it("calls onSelect via touch (fireEvent.click)", () => {
    const onSelect = vi.fn();
    render(<AvatarPicker selected={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByTitle("dog"));
    expect(onSelect).toHaveBeenCalledWith("dog");
  });

  it("marks the selected avatar with a checkmark", () => {
    render(<AvatarPicker selected="fox" onSelect={vi.fn()} />);
    expect(screen.getByTitle("fox").querySelector(".avatar-check")).toBeTruthy();
  });

  it("does not mark unselected avatars", () => {
    render(<AvatarPicker selected="fox" onSelect={vi.fn()} />);
    expect(screen.getByTitle("cat").querySelector(".avatar-check")).toBeNull();
  });

  it("only animates the selected avatar", () => {
    render(<AvatarPicker selected="cat" onSelect={vi.fn()} />);
    const catEmoji = screen.getByTitle("cat").querySelector("span");
    const dogEmoji = screen.getByTitle("dog").querySelector("span");
    expect(catEmoji?.className).not.toBe("");
    expect(dogEmoji?.className).toBe("");
  });

  it("calls onSelect when a different avatar is clicked while one is already selected", async () => {
    const onSelect = vi.fn();
    render(<AvatarPicker selected="cat" onSelect={onSelect} />);
    await userEvent.click(screen.getByTitle("dog"));
    expect(onSelect).toHaveBeenCalledWith("dog");
  });
});
