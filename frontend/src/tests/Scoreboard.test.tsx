import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Scoreboard } from "@/components/Scoreboard";
import { makeClass } from "./helpers";

describe("Scoreboard", () => {
  it("lists every class", () => {
    const classes = [makeClass({ code: "5a" }), makeClass({ id: 2, code: "6b" })];
    render(<Scoreboard classes={classes} />);
    expect(screen.getByText("5a")).toBeInTheDocument();
    expect(screen.getByText("6b")).toBeInTheDocument();
  });

  it("ranks the class with the most points first", () => {
    const classes = [
      makeClass({ id: 1, code: "5a", total_points: 10 }),
      makeClass({ id: 2, code: "6b", total_points: 99 }),
      makeClass({ id: 3, code: "7c", total_points: 50 }),
    ];
    render(<Scoreboard classes={classes} />);

    const rows = screen.getAllByRole("row").slice(1); // skip header
    expect(within(rows[0]).getByText("6b")).toBeInTheDocument();
    expect(within(rows[1]).getByText("7c")).toBeInTheDocument();
    expect(within(rows[2]).getByText("5a")).toBeInTheDocument();
  });

  it("breaks ties alphabetically by class code", () => {
    const classes = [
      makeClass({ id: 1, code: "9c", total_points: 50 }),
      makeClass({ id: 2, code: "5a", total_points: 50 }),
      makeClass({ id: 3, code: "7b", total_points: 50 }),
    ];
    render(<Scoreboard classes={classes} />);

    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("5a")).toBeInTheDocument();
    expect(within(rows[1]).getByText("7b")).toBeInTheDocument();
    expect(within(rows[2]).getByText("9c")).toBeInTheDocument();
  });

  it("shows the rank number for each class", () => {
    const classes = [
      makeClass({ id: 1, code: "5a", total_points: 20 }),
      makeClass({ id: 2, code: "6b", total_points: 10 }),
    ];
    render(<Scoreboard classes={classes} />);

    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("1")).toBeInTheDocument();
    expect(within(rows[1]).getByText("2")).toBeInTheDocument();
  });

  it("shows zero points for a class with no transactions", () => {
    render(<Scoreboard classes={[makeClass({ total_points: 0 })]} />);
    expect(screen.getByRole("cell", { name: "0" })).toBeInTheDocument();
  });

  it("handles negative point totals", () => {
    render(<Scoreboard classes={[makeClass({ total_points: -15 })]} />);
    expect(screen.getByRole("cell", { name: "-15" })).toBeInTheDocument();
  });

  it("renders an empty table body when no classes are given", () => {
    render(<Scoreboard classes={[]} />);
    const rows = screen.getAllByRole("row");
    // only the header row
    expect(rows).toHaveLength(1);
  });
});
