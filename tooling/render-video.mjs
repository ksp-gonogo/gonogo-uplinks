#!/usr/bin/env node
/**
 * Turn a motion scene's rendered frames into VIDEO.
 *
 * ## Why this exists
 *
 * `gonogo-uplink render` encodes a motion scene one way: GIF. That is the right
 * asset for the generated Uplink page, which is markdown rendered by GitHub, and
 * it is the wrong asset for showing a change to a person. The operator's
 * finding, 2026-09-11: a GIF pasted into the Claude app does not animate, so a
 * film of a held stick arrives as a still of one arbitrary frame and reads as if
 * nothing moves.
 *
 * The encoder lives in `@ksp-gonogo/ui-kit`, which arrives here as a vendored,
 * content-addressed tarball; nothing in this repo can change what it emits. What
 * it DOES offer is `--frames`, which keeps the numbered PNGs it encoded from. So
 * the seam is here: the harness shoots the frames, this encodes a second set of
 * assets from the same pixels, and neither one is a re-render of the other.
 *
 * ## What it does not do
 *
 * It does not run the render and it does not touch the committed page assets.
 * The GIF stays the Uplink page's asset because the page generator names it and
 * `render-shape.json` records it; the video is review output, beside the frames
 * it came from, in the gitignored `renders/` tree.
 *
 * Usage:
 *   node tooling/render-video.mjs <uplink> [--scene <name>] [--fps <n>] [--loops <n>]
 *
 * Run `gonogo-uplink render --frames` (optionally `--scene <name>`) first: with
 * no `--frames` there are no numbered PNGs and this has nothing to encode, which
 * it says rather than writing an empty file.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Frames the harness wrote for one scene, and where they came from. */
function framesOf(rendersDir) {
  if (!existsSync(rendersDir)) return [];
  return readdirSync(rendersDir)
    .filter((name) => name.endsWith(".frames"))
    .map((name) => ({
      scene: name.slice(0, -".frames".length),
      dir: join(rendersDir, name),
    }))
    .filter((entry) => statSync(entry.dir).isDirectory());
}

/**
 * The scene's own frame rate, off the fixture that declares it.
 *
 * Read rather than defaulted: the fixture is what the harness itself timed the
 * steps against, so a video encoded at anything else plays the gesture at the
 * wrong speed while looking perfectly fine.
 */
function fpsOf(clientDir, scene, override) {
  if (override !== undefined) return override;
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name === `${scene}.json`) found.push(path);
    }
  };
  const src = join(clientDir, "src");
  if (existsSync(src)) walk(src);
  for (const path of found) {
    const motion = JSON.parse(readFileSync(path, "utf8"))?._scene?.motion;
    if (typeof motion?.fps === "number") return motion.fps;
  }
  throw new Error(
    `render-video: no fixture declares a motion fps for scene "${scene}". ` +
      "Pass --fps <n> if this scene is being filmed without one.",
  );
}

function encode(framesDir, outFile, fps, loops, args) {
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      // The film runs once and a motion scene is a couple of seconds long, so
      // a viewer who looks away for one of them sees a still. A video player
      // does not loop for us the way a GIF did, so the repeats are baked in.
      "-stream_loop",
      String(Math.max(0, loops - 1)),
      "-framerate",
      String(fps),
      "-i",
      join(framesDir, "%03d.png"),
      // yuv420p needs both axes even, and a 2x device-scale shot of an odd CSS
      // box is not. Rounding down by one pixel is invisible; a hard ffmpeg
      // failure halfway through a review is not.
      "-vf",
      "scale=trunc(iw/2)*2:trunc(ih/2)*2",
      "-pix_fmt",
      "yuv420p",
      ...args,
      outFile,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
}

/** The one positional argument, past any `--flag value` pairs. */
function positional(argv) {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      i++; // every flag here takes a value
      continue;
    }
    return argv[i];
  }
  return undefined;
}

function main(argv) {
  const flag = (name) => {
    const i = argv.indexOf(name);
    return i === -1 ? undefined : argv[i + 1];
  };
  const uplink = positional(argv);
  if (!uplink) throw new Error("render-video: name an uplink, e.g. `kerbcast`");

  const clientDir = resolve(ROOT, "uplinks", uplink, "client");
  if (!existsSync(clientDir)) {
    throw new Error(`render-video: no client at ${clientDir}`);
  }
  const rendersDir = join(clientDir, "renders");
  const only = flag("--scene");
  const fpsFlag = flag("--fps");
  const loops = Number(flag("--loops") ?? 3);

  const scenes = framesOf(rendersDir).filter((s) => !only || s.scene === only);
  if (scenes.length === 0) {
    throw new Error(
      `render-video: no *.frames directory under ${rendersDir}` +
        (only ? ` for scene "${only}"` : "") +
        ". Run `gonogo-uplink render --frames` first: without it the harness " +
        "encodes its GIF and discards the numbered PNGs this reads.",
    );
  }

  for (const { scene, dir } of scenes) {
    const count = readdirSync(dir).filter((f) => f.endsWith(".png")).length;
    if (count === 0) throw new Error(`render-video: ${dir} holds no frames`);
    const fps = fpsOf(clientDir, scene, fpsFlag ? Number(fpsFlag) : undefined);
    const mp4 = join(rendersDir, `${scene}.mp4`);
    const webm = join(rendersDir, `${scene}.webm`);
    encode(dir, mp4, fps, loops, [
      "-c:v",
      "libx264",
      "-crf",
      "18",
      "-movflags",
      "+faststart",
    ]);
    encode(dir, webm, fps, loops, ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30"]);
    console.log(`  ${scene}: ${count} frames @ ${fps}fps x${loops}`);
    console.log(`    ${mp4}`);
    console.log(`    ${webm}`);
  }
}

try {
  main(process.argv.slice(2));
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}
