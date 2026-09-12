import { registerComponent } from "@ksp-gonogo/sitrep-sdk";
import { KERBCAST } from "../uplink.js";
import {
  CameraFeed,
  type CameraFeedConfig,
  cameraFeedActions,
  isPartCamera,
} from "./CameraFeed.js";
import { CameraFeedConfigPanel } from "./CameraFeedConfigPanel.js";

registerComponent<CameraFeedConfig>({
  id: "camera-feed",
  name: "Camera Feed",
  description:
    "Live camera streams from in-flight Hullcam VDS parts, with an in-widget camera picker and Next/Previous switching.",
  tags: ["camera"],
  /**
   * Down from 11x7. Eleven columns were what the aim cluster needed while it
   * was a 357px strip; it is now a 110x88 block, and the frame holds the
   * CAMERA's aspect rather than the tile's, so width past what the height can
   * use is empty panel either side of the picture.
   *
   * <p>The chrome is now 2px of width and 18px of height: the panel border and
   * the reserved delay-rail band, and nothing else, the widget having given up
   * its panel title (see `CameraFeed.tsx`) and with it the header row, the body
   * inset and the gap under it. That was 32px of width and 47px of height,
   * measured in chromium against the vendored kit. Nine columns leave 348px of
   * picture, eight rows 236px, and a 16:9 camera fills the width first, so the
   * picture is 348x194 where it was 316x176.</p>
   *
   * <p>The height is no longer what caps it: 236px of height could carry a
   * 419px-wide 16:9 picture, so a tenth or eleventh column would now be spent
   * rather than wasted. Left at nine deliberately, because widening the default
   * tile is a dashboard-layout decision rather than a chrome one, and eleven
   * columns is also where the framing preview starts to fit.</p>
   */
  defaultSize: { w: 9, h: 8 },
  /**
   * Six rows is unchanged, and still set by the kerbcast SDK's own zoom column:
   * 109px tall and bottom-anchored, so a shorter picture cuts the "+" off the
   * top of it. The 123px of picture that leaves also holds the aim cluster,
   * which is 88px plus 16px of inset.
   *
   * <p>Seven columns, down from nine. Nine was set by the aim tapes needing
   * 287px of picture in one row, and that row is gone; what is left is the
   * cluster's own 110px plus its inset, and the 219px a 16:9 camera draws into
   * 123px of height. 255px of tile, so seven columns.</p>
   *
   * <p>Both numbers held while the panel title went: the title cost height the
   * 16:9 fit was spending anyway here, so the same seven columns now draw a
   * 268x149 picture rather than 220x122.</p>
   */
  minSize: { w: 7, h: 6 },
  // On MobileDashboard a widget without this squishes to
  // `defaultSize.h * ROW_HEIGHT` (5 * 25 = 125px), far too short for a
  // 16:9 feed. Give it a proper box (mirrors the other media-ish widgets
  // and the mobile-sizing regression guarded by camera-feed-mobile.spec).
  mobileHeight: 280,
  component: CameraFeed,
  // "Show debug info" lives in the gear modal's Settings tab (paired with the
  // Inputs tab the widget's actions add): not in the in-feed camera dropdown.
  configComponent: CameraFeedConfigPanel,
  // kerbcast.cameras is pulled direct from the kerbcast DataSource via
  // custom hooks: not listed here to avoid a duplicate subscription.
  // CommNet topics are listed so the orchestrator knows to subscribe them
  // for signal strength / connection status / one-way signal delay (the
  // always-on delay + quality badges in the feed header).
  dataRequirements: ["vessel.comms", "comms.link", "comms.delay"],
  // Exposes an overlay slot, drawn over the video and passed the feed's pixel
  // dimensions and displayed camera id. No first-party augment fills it yet.
  augmentSlots: ["camera-feed.overlay"],
  defaultConfig: {
    flightId: null,
    showDebugInfo: false,
  },
  actions: cameraFeedActions,
  pushable: true,
  owner: KERBCAST,
});

export type { CameraFeedConfig };
export { CameraFeed, cameraFeedActions, isPartCamera };
