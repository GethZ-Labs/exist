"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoopMark } from "@/components/site/BrandMark";
import SoundToggle from "@/components/site/SoundToggle";
import Gate, { type GateApi, type GateShared } from "./Gate";
import { Renderer, type FrameState } from "./gl/Renderer";
import { smoothstep } from "./gl/math";
import StoryOverlay, { type StoryHandle } from "./StoryOverlay";
import { introSound } from "./introSound";
import { rasterizeText } from "./textTexture";
import {
  AWAIT_AUTO_SECONDS,
  CHAPTERS,
  FLOOD_SECONDS,
  GARDEN_SECONDS,
  noRipples,
  POUR,
  POUR_SECONDS,
  pourCamera,
  pourGeometry,
  pourRipples,
  pourState,
  pourWorld,
  gardenWorld,
  STORY_VH,
  storyFade,
  storyWorld,
  TAIL_VH,
} from "./timeline";
import "./intro.css";

type Phase = "gate" | "pour" | "await" | "garden" | "world" | "flood";

type Props = {
  onComplete: () => void;
  onSkip: () => void;
};

const LOG_LINES = [
  "Drafting the blueprint",
  "Connecting your systems",
  "Data flowing",
];

export default function Intro({ onComplete, onSkip }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const storyRef = useRef<StoryHandle>(null);
  const epiRootRef = useRef<HTMLDivElement>(null);
  const chapterRef = useRef<HTMLSpanElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>("gate");
  const phaseRef = useRef<Phase>("gate");
  const gateShared = useRef<GateShared>({
    ring: [0, 0, 120],
    lens: 1,
    success: 0,
    charge: 0,
    lineWidth: 640,
  });
  const gateApi = useRef<GateApi | null>(null);
  const fontsReady = useRef(false);
  const clock = useRef({
    origin: 0,
    pourAt: 0,
    awaitAt: 0,
    gardenAt: 0,
    floodAt: 0,
    lastFrame: 0,
  });
  const pointer = useRef({ x: 0, y: 0, sx: 0, sy: 0, energy: 0 });
  const story = useRef({ current: 0, target: 0, endIdleSince: 0 });
  const ripples = useRef<Float32Array>(noRipples());
  const doneRef = useRef(false);
  const callbacks = useRef({ onComplete, onSkip });

  useEffect(() => {
    callbacks.current = { onComplete, onSkip };
  }, [onComplete, onSkip]);

  const go = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  /* ---------------- phase transitions ---------------- */
  const startPour = useCallback(() => {
    const now = (performance.now() - clock.current.origin) / 1000;
    clock.current.pourAt = now;
    const renderer = rendererRef.current;
    const fov = renderer
      ? pourCamera(0, renderer.cssWidth / renderer.cssHeight).fov
      : 0.8;
    const { half } = pourGeometry(
      gateShared.current.lineWidth,
      window.innerHeight,
      fov,
    );
    ripples.current = pourRipples(now, half);
    introSound.pour();
    go("pour");
  }, [go]);

  const startGarden = useCallback(() => {
    if (phaseRef.current !== "await") return;
    clock.current.gardenAt = (performance.now() - clock.current.origin) / 1000;
    introSound.garden();
    go("garden");
  }, [go]);

  const enterWorld = useCallback(() => {
    window.scrollTo(0, 0);
    story.current = { current: 0, target: 0, endIdleSince: 0 };
    storyRef.current?.measure();
    introSound.world();
    go("world");
  }, [go]);

  const startFlood = useCallback(() => {
    if (phaseRef.current !== "world") return;
    const renderer = rendererRef.current;
    const root = epiRootRef.current?.querySelector<HTMLElement>(".epi");
    story.current.current = 1;
    storyRef.current?.update(1, (p) => renderer!.project(p), 1);
    if (renderer && root) {
      const canvas = rasterizeText(
        root,
        window.innerWidth,
        window.innerHeight,
        renderer.pixelRatio,
      );
      renderer.setTextCanvas(canvas);
    }
    clock.current.floodAt = (performance.now() - clock.current.origin) / 1000;
    introSound.flood();
    go("flood");
  }, [go]);

  /* ---------------- soundtrack ---------------- */
  useEffect(() => {
    introSound.reset();
    return () => introSound.stop();
  }, []);

  /* ---------------- body scroll per phase ---------------- */
  useEffect(() => {
    document.documentElement.classList.add("intro-active");
    return () => {
      document.documentElement.classList.remove("intro-active", "intro-scroll");
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle(
      "intro-scroll",
      phase === "world",
    );
  }, [phase]);

  /* ---------------- fonts ---------------- */
  useEffect(() => {
    let cancelled = false;
    const fonts = document.fonts;
    const ready = fonts ? fonts.ready : Promise.resolve();
    ready.then(() => {
      if (!cancelled) fontsReady.current = true;
    });
    const fallback = window.setTimeout(() => (fontsReady.current = true), 2500);
    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
    };
  }, []);

  /* ---------------- input ---------------- */
  useEffect(() => {
    pointer.current = {
      x: window.innerWidth * 0.62,
      y: window.innerHeight * 0.4,
      sx: window.innerWidth * 0.62,
      sy: window.innerHeight * 0.4,
      energy: 0,
    };
    const onMove = (event: PointerEvent) => {
      const p = pointer.current;
      const speed = Math.hypot(event.clientX - p.x, event.clientY - p.y);
      p.energy = Math.min(1, p.energy + speed / 260);
      p.x = event.clientX;
      p.y = event.clientY;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(() => {
    if (phase !== "await") return;
    const advance = (event?: Event) => {
      // the header buttons (sound, skip) must not dive in
      if ((event?.target as Element | null)?.closest?.(".intro-header")) return;
      startGarden();
    };
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) > 2) advance();
    };
    const onKey = (event: KeyboardEvent) => {
      if (["ArrowDown", "PageDown", " ", "Enter"].includes(event.key))
        advance(event);
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchmove", advance, { passive: true });
    window.addEventListener("pointerdown", advance);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchmove", advance);
      window.removeEventListener("pointerdown", advance);
      window.removeEventListener("keydown", onKey);
    };
  }, [phase, startGarden]);

  /* ---------------- renderer + main loop ---------------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = Renderer.create(canvas);
    if (!renderer) {
      callbacks.current.onSkip();
      return;
    }
    rendererRef.current = renderer;
    clock.current.origin = performance.now();

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    let quality = coarse ? 0.8 : 1;
    const ratio = () =>
      Math.min(window.devicePixelRatio || 1, coarse ? 1.75 : 2) * quality;
    const resize = () =>
      renderer.resize(window.innerWidth, window.innerHeight, ratio());
    resize();
    window.addEventListener("resize", resize);

    // optional deterministic preview: ?introDebug=pour:2.5 (development only)
    let debug: { phase: Phase; value: number } | null = null;
    if (process.env.NODE_ENV !== "production") {
      const raw = new URLSearchParams(window.location.search).get("introDebug");
      if (raw) {
        const [name, value] = raw.split(":");
        debug = { phase: name as Phase, value: parseFloat(value || "0") };
      }
    }
    let debugApplied = false;

    let frameAvg = 16;
    let slowFrames = 0;
    let raf = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const c = clock.current;
      let time = (now - c.origin) / 1000;
      const dt = Math.min(
        0.05,
        Math.max(0.001, (now - (c.lastFrame || now)) / 1000),
      );
      c.lastFrame = now;

      // adaptive resolution
      frameAvg += (dt * 1000 - frameAvg) * 0.05;
      if (frameAvg > 26 && quality > 0.55) {
        slowFrames++;
        if (slowFrames > 45) {
          quality = Math.max(0.55, quality * 0.85);
          slowFrames = 0;
          resize();
        }
      } else {
        slowFrames = 0;
      }

      if (debug && !debugApplied) {
        debugApplied = true;
        if (debug.phase === "pour" || debug.phase === "await") {
          c.pourAt = time - debug.value;
          ripples.current = pourRipples(c.pourAt, 1.6);
        } else if (debug.phase === "garden") {
          c.gardenAt = time - debug.value;
        } else if (debug.phase === "world") {
          story.current = {
            current: debug.value,
            target: debug.value,
            endIdleSince: 0,
          };
        }
        go(debug.phase);
        if (debug.phase === "flood") {
          phaseRef.current = "world";
          story.current = { current: 1, target: 1, endIdleSince: 0 };
          window.setTimeout(() => {
            startFlood();
            clock.current.floodAt =
              (performance.now() - clock.current.origin) / 1000 -
              (debug?.value ?? 0);
          }, 400);
        }
      }
      if (debug) {
        // freeze scene clocks so screenshots are deterministic
        if (phaseRef.current === "pour") time = c.pourAt + debug.value;
        if (phaseRef.current === "garden") time = c.gardenAt + debug.value;
        if (phaseRef.current === "flood") time = c.floodAt + debug.value;
      }

      const p = pointer.current;
      p.sx += (p.x - p.sx) * Math.min(1, dt * 4);
      p.sy += (p.y - p.sy) * Math.min(1, dt * 4);
      p.energy *= Math.pow(0.2, dt);

      const W = renderer.cssWidth;
      const H = renderer.cssHeight;
      const aspect = W / H;
      const phaseNow = phaseRef.current;
      const g = gateShared.current;
      const state: FrameState = {
        time,
        gate: null,
        world: null,
        pour: null,
        flood: null,
        bloom: 0.85,
        finalLime: 0,
        fade: 1,
      };
      let chapter = "01 — Enter";
      let hint = "";

      if (phaseNow === "gate") {
        introSound.frame("gate", 0);
        state.bloom = 0.6;
        state.gate = {
          pointer: [p.sx, p.sy],
          energy: p.energy,
          ring: g.ring,
          lens: g.lens,
          success: g.success,
          charge: g.charge,
          shatter: 0,
          origin: [W / 2, H / 2],
          fade: 1,
        };
      } else if (phaseNow === "pour" || phaseNow === "await") {
        const t = time - c.pourAt;
        introSound.frame(phaseNow, t);
        const tt = Math.min(t, POUR_SECONDS + 30);
        state.world = pourWorld(
          Math.min(tt, POUR_SECONDS),
          aspect,
          ripples.current,
        );
        if (t < POUR_SECONDS + 0.5) {
          state.pour = pourState(t, g.lineWidth, H, state.world.camera.fov);
        }
        state.bloom = 0.55;
        if (t < 2.6) {
          state.gate = {
            pointer: [p.sx, p.sy],
            energy: p.energy,
            ring: g.ring,
            lens: 0,
            success: 1,
            charge: 1 - smoothstep(0, 0.9, t),
            shatter: smoothstep(0.15, 2.3, t),
            origin: [W / 2, H / 2],
            fade: 1,
          };
        }
        // keep the DOM glass tube glued to the 3D bar as the camera tilts
        if (t < 4.2) {
          renderer.computeCamera(state.world.camera);
          const bar = renderer.project([
            0,
            state.pour?.barY ?? 3.6,
            POUR.eye[2] - POUR.dist,
          ]);
          gateApi.current?.setPour(
            bar.y,
            smoothstep(0.35, 1.9, t),
            1 - smoothstep(3.3, 4.0, t),
          );
        }
        chapter = "02 — Awakening";
        if (phaseNow === "pour" && t >= POUR_SECONDS) {
          c.awaitAt = time;
          introSound.await();
          go("await");
        }
        if (phaseNow === "await") {
          hint = "Scroll to dive in";
          if (time - c.awaitAt > AWAIT_AUTO_SECONDS && !debug) startGarden();
        }
      } else if (phaseNow === "garden") {
        const t = time - c.gardenAt;
        introSound.frame("garden", t);
        state.world = gardenWorld(t, aspect, ripples.current);
        chapter = "02 — Awakening";
        const log = logRef.current;
        if (log) {
          log.style.setProperty(
            "--log",
            String(Math.min(1, t / (GARDEN_SECONDS - 1))),
          );
          const lines = log.querySelectorAll<HTMLElement>("[data-at]");
          lines.forEach((line, i) => {
            const on = t >= parseFloat(line.dataset.at!);
            if (on && !line.classList.contains("is-on"))
              introSound.log(i, i === lines.length - 1);
            line.classList.toggle("is-on", on);
          });
        }
        if (t >= GARDEN_SECONDS && !debug) enterWorld();
      } else if (phaseNow === "world") {
        const s = story.current;
        if (!debug) {
          s.target = Math.min(
            1,
            window.scrollY / ((STORY_VH / 100) * window.innerHeight),
          );
        }
        s.current += (s.target - s.current) * (1 - Math.exp(-dt * 5.5));
        if (Math.abs(s.target - s.current) < 0.00005) s.current = s.target;
        const pr = s.current;
        introSound.story(pr);
        state.world = storyWorld(pr, aspect, [
          (p.sx / Math.max(1, W) - 0.5) * 2,
          (p.sy / Math.max(1, H) - 0.5) * 2,
        ]);
        state.fade = storyFade(pr);
        const active = CHAPTERS.findIndex(
          (ch) => pr >= ch.start && pr < ch.end + 0.0001,
        );
        chapter = `0${active + 3 > 6 ? 6 : active + 3} — ${CHAPTERS[Math.max(0, active)].label}`;
        if (pr < 0.012) hint = "Scroll to explore";
        if (pr > 0.985) hint = "Keep scrolling";
        // flood once the statement has landed and the visitor keeps going (or waits)
        // a quarter-screen past the end of the story (always reachable: TAIL_VH > 125)
        const pastEnd =
          window.scrollY >=
          (STORY_VH / 100) * window.innerHeight + window.innerHeight * 0.25;
        if (pr > 0.995) {
          s.endIdleSince = s.endIdleSince || time;
        } else {
          s.endIdleSince = 0;
        }
        if (
          !debug &&
          (pastEnd || (s.endIdleSince && time - s.endIdleSince > 3.2))
        ) {
          startFlood();
        }
      } else if (phaseNow === "flood") {
        const t = time - c.floodAt;
        introSound.frame("flood", t);
        state.flood = { t };
        state.bloom = 0.45 * (1 - smoothstep(1.8, 3.1, t));
        state.finalLime = smoothstep(5.55, 5.85, t);
        chapter = "06 — Vision";
        if (t >= FLOOD_SECONDS && !doneRef.current && !debug) {
          doneRef.current = true;
          callbacks.current.onComplete();
        }
      }

      renderer.render(state);

      if (phaseNow === "world") {
        storyRef.current?.update(
          story.current.current,
          (point) => renderer.project(point),
          state.world?.build ?? 0,
        );
      }
      if (chapterRef.current && chapterRef.current.textContent !== chapter) {
        chapterRef.current.textContent = chapter;
      }
      if (hintRef.current) {
        const label =
          hintRef.current.querySelector<HTMLElement>(".intro-hint-label");
        if (hint && label && label.textContent !== hint)
          label.textContent = hint;
        hintRef.current.classList.toggle("is-on", Boolean(hint));
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [enterWorld, go, startFlood, startGarden]);

  const isReady = useCallback(() => fontsReady.current, []);

  return (
    <div className={`intro is-${phase}`}>
      <canvas ref={canvasRef} className="intro-canvas" aria-hidden="true" />

      {(phase === "gate" || phase === "pour") && (
        <Gate
          sharedRef={gateShared}
          apiRef={gateApi}
          isReady={isReady}
          onCharged={startPour}
        />
      )}

      <div ref={epiRootRef} className="intro-story">
        <StoryOverlay ref={storyRef} />
      </div>

      {phase === "world" && (
        <div
          className="intro-scroll-space"
          style={{ height: `${STORY_VH + TAIL_VH}vh` }}
        />
      )}

      <div ref={logRef} className="intro-log" aria-hidden="true">
        {LOG_LINES.map((line, i) => (
          <p key={line} data-at={0.8 + i * 1.6}>
            <span className="intro-log-mark">{i < 2 ? ">" : "✓"}</span> {line}
          </p>
        ))}
      </div>

      <div ref={hintRef} className="intro-hint" aria-live="polite">
        <span className="intro-hint-mouse" aria-hidden="true" />
        <span className="intro-hint-label">Scroll</span>
      </div>

      <header className="intro-header">
        <span className="intro-logo" aria-label="EXiST">
          <LoopMark className="intro-logo-loop" />
          <span className="intro-logo-word">
            EX<span>ı</span>ST
          </span>
        </span>
        <span ref={chapterRef} className="intro-chapter">
          01 — Enter
        </span>
        <div className="intro-actions">
          <SoundToggle className="intro-sound" label />
          <button
            type="button"
            className="intro-skip"
            onClick={() => {
              introSound.skip();
              callbacks.current.onSkip();
            }}
          >
            Skip intro <span aria-hidden="true">→</span>
          </button>
        </div>
      </header>
    </div>
  );
}
