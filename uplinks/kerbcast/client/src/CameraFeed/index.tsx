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
   * Eleven columns is what the WHOLE delayed-aim cluster needs: the tapes and
   * the commit are 287px, the framing tile beside them another 68px, and the
   * insets 16px, so 371px of picture and 407px of tile. At the minimum below,
   * the tile is dropped and the numbers stay; this is the size at which the
   * operator gets the review of them as well.
   */
  defaultSize: { w: 11, h: 7 },
  /**
   * Nine columns and six rows is what is left over once `Panel`'s chrome has
   * taken its share, measured on the render harness: 36px of width to the body
   * padding and the frame border, and 67px of height to the panel border, the
   * reserved delay-rail band, the title row and the body padding. A 6x4 tile,
   * which is what this said while the widget was a bare `FramedDisplay`, leaves
   * a 196x40 picture, and nothing in this widget works at that size.
   *
   * <p>Nine columns is set by the widest thing that must ALWAYS be drawn over
   * the picture, the tapes and their commit at 287px: 303px of picture plus the
   * chrome. Six rows is set by the kerbcast SDK's own zoom column, which is
   * 109px tall and bottom-anchored, so a shorter picture cuts the "+" off the
   * top of it.</p>
   *
   * <p>The old note about the feed's own title needing six columns still holds
   * and is no longer the binding constraint: the title is drawn inside the
   * picture, which is now 36px narrower than the tile, and nine columns clears
   * it comfortably.</p>
   */
  minSize: { w: 9, h: 6 },
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
