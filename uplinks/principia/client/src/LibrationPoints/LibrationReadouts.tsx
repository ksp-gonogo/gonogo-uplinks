import { staticValue, type Tone, value } from "@ksp-gonogo/sitrep-sdk";
import type {
  LibrationAnswer,
} from "@ksp-gonogo/sitrep-sdk/frames";
import {
  type EphemerisFigure,
  type ReckoningMarking,
  Row,
  RowName,
  Text,
  Unit,
} from "@ksp-gonogo/ui-kit";
import type { CraftOffset, LibrationStationKeeping } from "./pairResolution.js";

/** Not stationkeeping carries no state, so it recedes through the `muted` level the rows pass alongside. */
const KEEPING_TONE: Record<LibrationStationKeeping, Tone> = {
  "on-station": "go",
  drifting: "warn",
  elsewhere: "neutral",
};

const KEEPING_WORDS = {
  "on-station": "holding",
  drifting: "drifting off",
  elsewhere: "not held",
} as const;

const SUPERSCRIPT_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/**
 * The pair's mass ratio as a percentage, or as a power of ten once the
 * percentage would round to zero at three decimals (the Sun and Kerbin sit near
 * three millionths).
 */
function MassRatio({ ratio }: Readonly<{ ratio: number }>) {
  if (!(ratio > 0) || ratio >= 1e-5) {
    return <Unit value={staticValue("%", ratio * 100)} decimals={3} />;
  }
  const [mantissa, exponent] = ratio.toExponential(1).split("e");
  const power = Number(exponent)
    .toString()
    .replace("-", "⁻")
    .replace(/\d/g, (d) => SUPERSCRIPT_DIGITS[Number(d)]);
  return <>{`${mantissa} × 10${power}`}</>;
}

/** The pair's separation and mass ratio, then where the craft sits against its nearest point. */
export function LibrationReadouts({
  answer,
  offset,
  hasCraft,
  craftMarking,
  ephemerisFigure,
}: Readonly<{
  answer: LibrationAnswer;
  offset: CraftOffset | null;
  /** Whether there is a craft orbit of now at all, observed or modelled. */
  hasCraft: boolean;
  /** The mark the craft's orbit gives the figures derived from it. */
  craftMarking: ReckoningMarking | null;
  /** The pair's separation follows the secondary's orbit alone, so it is exact where that orbit is and as old as the catalogue where it is not. */
  ephemerisFigure: EphemerisFigure;
}>) {
  return (
    <>
      <Row>
        <RowName>Separation</RowName>
        <Text>
          <Unit
            value={ephemerisFigure(value("m", answer.frame?.unitLength ?? 0))}
          />
        </Text>
      </Row>
      <Row>
        <RowName>Mass ratio</RowName>
        <Text>
          {/* The only parameter the five positions depend on, and a function of two body masses alone. */}
          <MassRatio ratio={answer.massRatio} />
        </Text>
      </Row>
      {/* With no orbit of now there is no craft to place, so there is nothing to say about one. */}
      {hasCraft && <CraftOffsetRows offset={offset} marking={craftMarking} />}
    </>
  );
}

function CraftOffsetRows({
  offset,
  marking,
}: Readonly<{
  offset: CraftOffset | null;
  marking: ReckoningMarking | null;
}>) {
  if (offset === null) {
    return (
      <Row>
        <RowName>Craft</RowName>
        <Text level="muted">not placeable in this frame</Text>
      </Row>
    );
  }
  return (
    <>
      <Row>
        <RowName>Nearest</RowName>
        <Text level="muted">{offset.nearest}</Text>
      </Row>
      <Row>
        <RowName>Station</RowName>
        <Text tone={KEEPING_TONE[offset.keeping]} level="muted">
          {KEEPING_WORDS[offset.keeping]}
        </Text>
      </Row>
      <Row>
        <RowName>Off station</RowName>
        <Text tone={KEEPING_TONE[offset.keeping]} level="muted">
          <Unit value={value("m", offset.distanceMetres)} marked={marking} />
        </Text>
      </Row>
    </>
  );
}
