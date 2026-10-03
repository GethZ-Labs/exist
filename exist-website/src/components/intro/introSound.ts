/*
  The intro's soundtrack: every phase and scroll moment of the intro mapped to
  cues from the shared, fully synthesised sound engine (src/lib/sound.ts).
*/

import { sound } from "@/lib/sound";
import { smoothstep } from "./gl/math";
import { pourImpacts } from "./timeline";

/* Seconds into the flood when the lime takes over the screen. */
const FLOOD_RESOLVE = 5.25;

/* One-shot cues along the scroll story (fire when crossed going forward). */
const STORY_CUES: [number, () => void][] = [
  [0.045, () => sound.whoosh({ from: 220, to: 1900, dur: 1.2, gain: 0.05 })],
  [0.2, () => sound.chime([1318.51, 1760], 0.018)],
  [0.24, () => sound.boom(0.22)],
  [0.258, () => sound.whoosh({ from: 260, to: 2200, dur: 1, gain: 0.045, pan: -0.3, panTo: 0.3 })],
  [0.272, () => sound.blip(1046.5, 0.03, 0.35)],
  [0.292, () => sound.blip(1174.66, 0.03, 0.4)],
  [0.312, () => sound.blip(1318.51, 0.03, -0.45)],
  [0.332, () => sound.blip(1567.98, 0.03, 0.3)],
  [0.442, () => sound.boom(0.3)],
  [0.455, () => sound.shimmer(1.3, 0.8)],
  [0.505, () => sound.whoosh({ from: 300, to: 3200, dur: 1.1, gain: 0.05 })],
  [0.592, () => sound.impact(0.85)],
  [0.665, () => sound.whoosh({ from: 2600, to: 320, dur: 0.9, gain: 0.04 })],
  [0.715, () => sound.whoosh({ from: 3200, to: 180, dur: 0.8, gain: 0.05 })],
  [0.765, () => sound.whoosh({ from: 180, to: 1600, dur: 1.6, gain: 0.05, pan: 0.4, panTo: -0.4 })],
  [0.89, () => sound.boom(0.2)],
  [0.925, () => sound.shimmer(1.1, 0.6)],
  [0.952, () => sound.whoosh({ from: 400, to: 2800, dur: 0.7, gain: 0.04 })],
  [0.988, () => sound.impact(1)],
];

type Cue = { at: number; fire: () => void; armed: boolean };

let cues: Cue[] = [];
let lastP = 0;
let stopCharge: (() => void) | null = null;

export const introSound = {
  reset() {
    cues = STORY_CUES.map(([at, fire]) => ({ at, fire, armed: true }));
    lastP = 0;
    stopCharge = null;
  },

  /* Continuous layers for the current phase; called every frame. */
  frame(phase: string, t: number) {
    if (phase === "gate") {
      sound.ambient(0.6, 0.04);
    } else if (phase === "pour" || phase === "await") {
      sound.ambient(0.85, 0.12);
      sound.water(t > 1.9 ? 0.5 : 0);
    } else if (phase === "garden") {
      sound.ambient(0.9, 0.12 + 0.25 * smoothstep(0, 6, t));
      sound.water(0.5 + 0.3 * smoothstep(3, 4.2, t));
    } else if (phase === "flood") {
      sound.ambient(t < FLOOD_RESOLVE - 0.4 ? 0.7 : 0, 0.3, 1.2);
      sound.water(0, 1.5);
    }
  },

  draw: (progress: number, speed: number) => sound.draw(progress, speed),

  retry() {
    sound.drawEnd();
    sound.retry();
  },

  success() {
    sound.drawEnd(0.25);
    sound.success();
  },

  charge() {
    stopCharge?.();
    stopCharge = sound.charge();
  },

  pour() {
    stopCharge?.();
    stopCharge = null;
    sound.burst();
    sound.pour(pourImpacts());
  },

  await() {
    sound.ping();
  },

  garden() {
    sound.garden();
  },

  log(index: number, last: boolean) {
    if (last) sound.confirm();
    else sound.blip(index ? 1174.66 : 987.77, 0.026, 0.2);
  },

  world() {
    sound.boom(0.16);
  },

  /* Scroll story: one-shot cues, chatter while the model builds, layer levels. */
  story(p: number) {
    const dp = p - lastP;
    lastP = p;
    for (const cue of cues) {
      if (cue.armed && p >= cue.at) {
        cue.armed = false;
        // skip cues when the story jumps (debug previews)
        if (dp > 0 && dp < 0.05) cue.fire();
      } else if (!cue.armed && p < cue.at - 0.02) {
        cue.armed = true;
      }
    }
    const speed = Math.abs(dp);
    const building = p > 0.035 && p < 0.2;
    const scanning = p > 0.24 && p < 0.44;
    if (building || scanning) sound.chatter(speed * 240);
    sound.scan(
      scanning ? 0.05 + Math.min(1, speed * 160) : 0,
      scanning ? (((p - 0.24) / 0.2) * 2) % 1 : 0,
    );
    const lit = 1 - smoothstep(0.885, 0.94, p);
    sound.ambient(0.55 + 0.45 * lit, (0.15 + 0.5 * smoothstep(0, 0.6, p)) * lit);
    sound.water(0.55 * (1 - smoothstep(0.7, 0.86, p)));
  },

  flood() {
    sound.flood(FLOOD_RESOLVE);
  },

  skip() {
    sound.whoosh({ from: 2400, to: 300, dur: 0.6, gain: 0.045 });
    stopCharge?.();
    stopCharge = null;
    sound.stopLayers(0.5);
  },

  stop() {
    stopCharge?.();
    stopCharge = null;
    sound.stopLayers(2.2);
  },
};
