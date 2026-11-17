import { render, screen } from "@ksp-gonogo/sitrep-sdk/testing";
import { describe, expect, it } from "vitest";
import type { KosLogEntry } from "../__generated__/contract.js";
import { LOG_KEPT, LogStream, withEntry } from "./LogStream.js";

const entry = (seq: number, value: unknown): KosLogEntry => ({
  coreId: 7,
  requestId: "r",
  seq,
  value,
});

describe("withEntry", () => {
  it("keeps entries in seq order whatever order they arrive in", () => {
    let held: KosLogEntry[] = [];
    for (const seq of [2, 0, 1]) held = withEntry(held, entry(seq, seq));

    expect(held.map((e) => e.seq)).toEqual([0, 1, 2]);
  });

  it("does not add an entry twice", () => {
    const held = withEntry(withEntry([], entry(0, 1)), entry(0, 1));

    expect(held).toHaveLength(1);
  });

  it("drops the oldest past the limit", () => {
    let held: KosLogEntry[] = [];
    for (let i = 0; i < LOG_KEPT + 5; i++) held = withEntry(held, entry(i, i));

    expect(held).toHaveLength(LOG_KEPT);
    expect(held[0].seq).toBe(5);
  });
});

describe("LogStream", () => {
  it("draws nothing before the first entry", () => {
    const { container } = render(<LogStream entries={[]} dropped={0} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the latest value in full and the last few as lines, newest first", () => {
    const entries = [
      entry(0, 10),
      entry(1, "two"),
      entry(2, { kind: "vector", x: 1, y: 2, z: 3, magnitude: 3.7417 }),
    ];

    render(<LogStream entries={entries} dropped={0} />);

    expect(screen.getByText("3 values")).toBeInTheDocument();
    expect(screen.getByText("mag")).toBeInTheDocument();
    const lines = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(lines).toEqual(["#2V(1, 2, 3)", "#1two", "#010"]);
  });

  it("says how many entries the cap dropped", () => {
    render(<LogStream entries={[entry(0, 1)]} dropped={4} />);

    expect(screen.getByText("4 dropped")).toBeInTheDocument();
  });
});
