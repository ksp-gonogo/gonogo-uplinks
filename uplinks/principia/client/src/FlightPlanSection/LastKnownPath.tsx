import type { LastKnownPathReply } from "@ksp-gonogo/sitrep-sdk";
import {
  PropagationCertification,
  TrajectoryKind,
  useLastKnownPath,
  value,
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge,
  Button,
  Cluster,
  Countdown,
  magnitudeOr,
  NULL_DISPLAY,
  Row,
  RowName,
  Stack,
  Text,
} from "@ksp-gonogo/ui-kit";

/** How far ahead the plot reaches: an hour is a manoeuvre's worth of context. */
const ONE_HOUR_SECONDS = 3600;

const PATH_POINTS = 128;

const PLOT_SIZE = 160;

/** The path seen from above the body it orbits, with the body as a dot at the centre. */
function PathPlot({
  states,
}: Readonly<{
  states: NonNullable<LastKnownPathReply["path"]>["states"];
}>) {
  const points = states.map((s) => [s.x.magnitude, s.y.magnitude] as const);
  const reach = Math.max(
    1,
    ...points.map(([x, y]) => Math.max(Math.abs(x), Math.abs(y))),
  );
  const scale = (PLOT_SIZE / 2 - 8) / reach;
  const line = points
    .map(([x, y]) => `${x * scale},${-y * scale}`)
    .join(" ");
  const half = PLOT_SIZE / 2;
  return (
    <svg
      role="img"
      aria-label="The craft's path, seen from above the body it orbits"
      width={PLOT_SIZE}
      height={PLOT_SIZE}
      viewBox={`${-half} ${-half} ${PLOT_SIZE} ${PLOT_SIZE}`}
      data-last-known-path=""
    >
      <circle r={3} fill="currentColor" />
      <polyline points={line} fill="none" stroke="currentColor" />
    </svg>
  );
}

/** What a finished ask says, or why there is no path. */
export function LastKnownPathResult({
  reply,
  viewUt,
}: Readonly<{ reply: LastKnownPathReply | null; viewUt: number | null }>) {
  if (reply === null) {
    return null;
  }
  const path = reply.path;
  if (!reply.solved || !path) {
    // An ordinary state of a distant mission, so the reason is shown plainly.
    return (
      <Text level="faint" size="sm">
        {reply.refusal ?? NULL_DISPLAY}
      </Text>
    );
  }
  return (
    <Stack>
      <PathPlot states={path.states} />
      <Row as="div">
        <RowName>PATH</RowName>
        <Badge tone="neutral">
          {path.kind === TrajectoryKind.Integrated ? "INTEGRATED" : "CONIC"}
        </Badge>
      </Row>
      <Row as="div">
        <RowName>COMPUTED BY</RowName>
        <Text size="sm">{path.basis ?? path.providerId ?? NULL_DISPLAY}</Text>
      </Row>
      <Row as="div">
        <RowName>COMPUTED FROM STATE OF</RowName>
        {reply.seededAtUt == null || viewUt === null ? (
          <Text>{NULL_DISPLAY}</Text>
        ) : (
          <Text>
            <Countdown value={viewUt - magnitudeOr(reply.seededAtUt, viewUt)} />{" "}
            ago
          </Text>
        )}
      </Row>
    </Stack>
  );
}

/**
 * Plots where the craft goes in the next hour, from what this command centre last
 * heard. Asked on a press, since it crosses to the game and back.
 */
export function LastKnownPathRow({
  viewUt,
}: Readonly<{ viewUt: number | null }>) {
  const { solve, reply, pending } = useLastKnownPath();
  return (
    <Stack>
      <Cluster justify="start" gap="related-dense">
        <Button
          onClick={() => {
            if (viewUt !== null) {
              void solve({
                toUt: value("ut", viewUt + ONE_HOUR_SECONDS),
                maxPoints: value("count", PATH_POINTS),
                certification: PropagationCertification.Accurate,
              });
            }
          }}
          disabled={pending || viewUt === null}
        >
          {pending ? "WORKING" : "PLOT NEXT HOUR FROM HERE"}
        </Button>
      </Cluster>
      <LastKnownPathResult reply={reply} viewUt={viewUt} />
    </Stack>
  );
}
