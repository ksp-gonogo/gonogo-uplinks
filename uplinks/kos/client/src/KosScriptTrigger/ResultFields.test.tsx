import { render, screen, within } from "@ksp-gonogo/sitrep-sdk/testing";
import { expectNoA11yViolations } from "@ksp-gonogo/ui-kit/testing";
import { describe, expect, it } from "vitest";
import type { KosData, KosDataValue } from "../shared/kos-data.js";
import { formatNumber, ResultFields } from "./ResultFields.js";

function draw(data: KosData) {
  return render(<ResultFields data={data} />);
}

/** The reading beside a key: the `dd` that follows the `dt` carrying it. */
function reading(key: string): HTMLElement {
  const term = screen.getByText(key, { selector: "dt" });
  const detail = term.nextElementSibling;
  if (!(detail instanceof HTMLElement))
    throw new Error(`no reading for ${key}`);
  return detail;
}

const list = (
  type: string,
  items: KosDataValue[],
  omitted = 0,
): KosDataValue => ({
  kind: "list",
  type,
  items,
  omitted,
});

describe("ResultFields", () => {
  it("draws a number, a string, a boolean and a null as rows", () => {
    draw({ dv: 1234.5, name: "Kerbal X", ok: true, off: false, nothing: null });

    expect(reading("dv")).toHaveTextContent("1234.5");
    expect(reading("name")).toHaveTextContent("Kerbal X");
    expect(reading("ok")).toHaveTextContent("TRUE");
    expect(reading("off")).toHaveTextContent("FALSE");
    expect(reading("nothing")).not.toHaveTextContent("undefined");
  });

  it("marks an empty string rather than drawing nothing", () => {
    draw({ text: "" });

    expect(reading("text")).toHaveTextContent('""');
  });

  it("says so when no fields came back", () => {
    draw({});

    expect(screen.getByText("No fields returned.")).toBeInTheDocument();
  });

  it("draws a list as indexed rows under its type", () => {
    draw({ items: list("List", [10, "two", true]) });

    const block = reading("items");
    expect(within(block).getByText("List")).toBeInTheDocument();
    expect(within(block).getByText("3 items")).toBeInTheDocument();
    expect(within(block).getByText("[0]")).toBeInTheDocument();
    expect(within(block).getByText("[1]")).toBeInTheDocument();
    expect(within(block).getByText("[2]")).toBeInTheDocument();
    expect(within(block).getByText("10")).toBeInTheDocument();
    expect(within(block).getByText("two")).toBeInTheDocument();
  });

  it("names the other collection types", () => {
    draw({ q: list("Queue", [1]) });

    expect(within(reading("q")).getByText("Queue")).toBeInTheDocument();
  });

  it("counts the items a long list left off", () => {
    draw({ big: list("List", [1, 2], 3) });

    expect(within(reading("big")).getByText("5 items")).toBeInTheDocument();
    expect(within(reading("big")).getByText("+3 more")).toBeInTheDocument();
  });

  it("draws an empty list as empty", () => {
    draw({ none: list("List", []) });

    expect(within(reading("none")).getByText("empty")).toBeInTheDocument();
  });

  it("draws a nested lexicon as rows of its own, keeping its key text", () => {
    draw({
      inner: {
        kind: "lexicon",
        omitted: 0,
        entries: [
          { key: "a", value: 1 },
          {
            key: "2",
            value: {
              kind: "lexicon",
              omitted: 0,
              entries: [{ key: "deep", value: "x" }],
            },
          },
        ],
      },
    });

    const outer = reading("inner");
    expect(within(outer).getByText("2 entries")).toBeInTheDocument();
    expect(within(outer).getByText("a")).toBeInTheDocument();
    expect(within(outer).getByText("deep")).toBeInTheDocument();
    expect(within(outer).getByText("x")).toBeInTheDocument();
  });

  it("draws a list inside a lexicon inside a list", () => {
    draw({
      outer: list("List", [
        {
          kind: "lexicon",
          omitted: 0,
          entries: [{ key: "leaf", value: list("List", [7]) }],
        },
      ]),
    });

    const block = reading("outer");
    expect(within(block).getByText("leaf")).toBeInTheDocument();
    expect(within(block).getByText("7")).toBeInTheDocument();
  });

  it("draws a vector with its components and length", () => {
    draw({ v: { kind: "vector", x: 3, y: 4, z: 12, magnitude: 13 } });

    const block = reading("v");
    expect(within(block).getByText("vector")).toBeInTheDocument();
    for (const [label, figure] of [
      ["x", "3"],
      ["y", "4"],
      ["z", "12"],
      ["mag", "13"],
    ]) {
      expect(within(block).getByText(label)).toBeInTheDocument();
      expect(within(block).getByText(figure)).toBeInTheDocument();
    }
  });

  it("draws a direction as pitch, yaw and roll in degrees", () => {
    draw({ d: { kind: "direction", pitch: 90, yaw: 270, roll: 0 } });

    const block = reading("d");
    expect(within(block).getByText("pitch")).toBeInTheDocument();
    expect(within(block).getByText("yaw")).toBeInTheDocument();
    expect(within(block).getByText("roll")).toBeInTheDocument();
    expect(block.textContent).toContain("90");
    expect(block.textContent).toContain("270");
    expect(block.textContent).toContain("°");
  });

  it("draws a timespan as a duration with its unit", () => {
    draw({ span: { kind: "timespan", seconds: 125.5 } });

    const block = reading("span");
    expect(within(block).getByText("timespan")).toBeInTheDocument();
    expect(block.textContent).toMatch(/\d/);
    expect(block.textContent).not.toContain("[object");
  });

  it("draws a timestamp as a game date", () => {
    draw({ at: { kind: "timestamp", seconds: 3600 } });

    const block = reading("at");
    expect(within(block).getByText("timestamp")).toBeInTheDocument();
    expect(block.textContent).toMatch(/Y1|D1|01:00:00/);
  });

  it("draws a position as latitude and longitude", () => {
    draw({ g: { kind: "geo", latitude: -0.0972, longitude: -74.5577 } });

    const block = reading("g");
    expect(within(block).getByText("geo")).toBeInTheDocument();
    expect(within(block).getByText("lat")).toBeInTheDocument();
    expect(within(block).getByText("lng")).toBeInTheDocument();
    expect(block.textContent).toContain("-0.0972");
    expect(block.textContent).toContain("-74.5577");
  });

  it("draws a part and a vessel by name and id", () => {
    draw({
      p: { kind: "part", name: "fuelTank", id: "42" },
      s: { kind: "vessel", name: "Kerbal X", id: "abc-123" },
    });

    expect(within(reading("p")).getByText("part")).toBeInTheDocument();
    expect(within(reading("p")).getByText("fuelTank")).toBeInTheDocument();
    expect(within(reading("p")).getByText("42")).toBeInTheDocument();
    expect(within(reading("s")).getByText("vessel")).toBeInTheDocument();
    expect(within(reading("s")).getByText("Kerbal X")).toBeInTheDocument();
    expect(within(reading("s")).getByText("abc-123")).toBeInTheDocument();
  });

  it("draws any other kOS value as its type and text", () => {
    draw({ pid: { kind: "other", type: "PIDLoop", text: "PIDLoop(kp=1)" } });

    expect(within(reading("pid")).getByText("PIDLoop")).toBeInTheDocument();
    expect(
      within(reading("pid")).getByText("PIDLoop(kp=1)"),
    ).toBeInTheDocument();
  });

  it("formats a number without float noise", () => {
    expect(formatNumber(0.1 + 0.2)).toBe("0.3");
    expect(formatNumber(1234.56789)).toBe("1234.5679");
    expect(formatNumber(4)).toBe("4");
    expect(formatNumber(Number.NaN)).toBe("NaN");
  });

  it("has no accessibility violations on a result holding every kind", async () => {
    const { container } = draw({
      n: 1,
      list: list("List", [1]),
      v: { kind: "vector", x: 1, y: 2, z: 3, magnitude: 3.7417 },
      d: { kind: "direction", pitch: 1, yaw: 2, roll: 3 },
      span: { kind: "timespan", seconds: 60 },
      at: { kind: "timestamp", seconds: 60 },
      g: { kind: "geo", latitude: 1, longitude: 2 },
      p: { kind: "part", name: "a", id: "1" },
      o: { kind: "other", type: "T", text: "t" },
    });

    await expectNoA11yViolations(container);
  });
});
