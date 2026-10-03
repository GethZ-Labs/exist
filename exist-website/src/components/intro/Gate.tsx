"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { introSound } from "./introSound";
import { CHARGE_MIN_SECONDS } from "./timeline";

type Point = { x: number; y: number };

export type GateShared = {
  ring: [number, number, number];
  lens: number;
  success: number;
  charge: number;
  lineWidth: number;
};

export type GateApi = {
  /* During the pour: keep the tube glued to the bar in 3D and drain it. */
  setPour: (barScreenY: number, drained: number, fade: number) => void;
};

type GateState = "idle" | "drawing" | "retry" | "success" | "charge" | "done";

const TAU = Math.PI * 2;
const RESAMPLE = 180;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOut = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

function wrapAngle(a: number) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

function analyse(points: Point[], ring: [number, number, number]) {
  if (points.length < 3) {
    return {
      sweep: 0,
      start: 0,
      radius: 0,
      roundness: 1,
      center: { x: ring[0], y: ring[1] },
    };
  }
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  const nearRing =
    Math.hypot(points[0].x - ring[0], points[0].y - ring[1]) < ring[2] * 2.3;
  const center =
    nearRing && points.length < 40
      ? { x: ring[0], y: ring[1] }
      : { x: cx, y: cy };
  let sweep = 0;
  let last = Math.atan2(points[0].y - center.y, points[0].x - center.x);
  const start = last;
  for (let i = 1; i < points.length; i++) {
    const a = Math.atan2(points[i].y - center.y, points[i].x - center.x);
    sweep += wrapAngle(a - last);
    last = a;
  }
  const radii = points.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const radius = radii.reduce((s, r) => s + r, 0) / radii.length;
  const deviation = Math.sqrt(
    radii.reduce((s, r) => s + (r - radius) ** 2, 0) / radii.length,
  );
  return {
    sweep,
    start,
    radius,
    roundness: deviation / Math.max(radius, 1),
    center,
  };
}

function resample(points: Point[], count: number) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(
      lengths[i - 1] +
        Math.hypot(
          points[i].x - points[i - 1].x,
          points[i].y - points[i - 1].y,
        ),
    );
  }
  const total = lengths[lengths.length - 1] || 1;
  const out: Point[] = [];
  let j = 0;
  for (let i = 0; i < count; i++) {
    const target = (i / (count - 1)) * total;
    while (j < lengths.length - 2 && lengths[j + 1] < target) j++;
    const span = lengths[j + 1] - lengths[j] || 1;
    const k = (target - lengths[j]) / span;
    const a = points[j];
    const b = points[Math.min(points.length - 1, j + 1)];
    out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
  }
  return out;
}

function toPoints(points: Point[]) {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  from: number,
  sweep: number,
) {
  const steps = Math.max(2, Math.ceil((Math.abs(sweep) / TAU) * 120));
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const a = from + (sweep * i) / steps;
    d += `${i === 0 ? "M" : "L"}${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
  }
  return d;
}

function Chars({ text, offset = 0 }: { text: string; offset?: number }) {
  return (
    <>
      {text.split("").map((ch, i) => (
        <span className="gate-char" key={`${ch}-${i}`} aria-hidden="true">
          <span style={{ "--i": i + offset } as CSSProperties}>
            {ch === " " ? " " : ch}
          </span>
        </span>
      ))}
    </>
  );
}

const HINTS: Record<GateState, string> = {
  idle: "Trace the glass ring with your mouse or finger.",
  drawing: "Keep going — all the way around.",
  retry: "Almost there. Try one full loop.",
  success: "Welcome to EXiST.",
  charge: "Charging the experience…",
  done: "",
};

export default function Gate({
  sharedRef,
  apiRef,
  isReady,
  onCharged,
}: {
  sharedRef: MutableRefObject<GateShared>;
  apiRef: MutableRefObject<GateApi | null>;
  isReady: () => boolean;
  onCharged: () => void;
}) {
  const [state, setState] = useState<GateState>("idle");
  const stateRef = useRef<GateState>("idle");
  const slotRef = useRef<HTMLDivElement>(null);
  const ringGroupRef = useRef<SVGGElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const ticksRef = useRef<SVGGElement>(null);
  const progressRef = useRef<SVGPathElement>(null);
  const ghostRef = useRef<SVGGElement>(null);
  const ghostTrailRef = useRef<SVGPathElement>(null);
  const ghostDotRef = useRef<SVGCircleElement>(null);
  const strokeRef = useRef<SVGPolylineElement>(null);
  const glowRef = useRef<SVGPolylineElement>(null);
  const chargeRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);

  const points = useRef<Point[]>([]);
  const drawing = useRef(false);
  const sequence = useRef<{
    start: number;
    from: Point[];
    dir: number;
    startAngle: number;
  } | null>(null);
  const chargeStart = useRef(0);
  const ghostClock = useRef(0);
  const autoDraw = useRef<{ start: number } | null>(null);
  const charged = useRef(false);
  const lastMove = useRef({ t: 0, x: 0, y: 0, progress: 0, still: true });
  const onChargedRef = useRef(onCharged);

  useEffect(() => {
    onChargedRef.current = onCharged;
  }, [onCharged]);

  const go = useCallback((next: GateState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  /* ---------------- layout: ring geometry shared with the GL lens ---------------- */
  const layout = useCallback(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const rect = slot.getBoundingClientRect();
    const r = rect.width / 2;
    const cx = rect.left + r;
    const cy = rect.top + rect.height / 2;
    sharedRef.current.ring = [cx, cy, r];
    sharedRef.current.lineWidth = Math.min(window.innerWidth * 0.62, 820);
    ringRef.current?.setAttribute("cx", String(cx));
    ringRef.current?.setAttribute("cy", String(cy));
    ringRef.current?.setAttribute("r", String(r));
    const ticks = ticksRef.current;
    if (ticks) {
      let d = "";
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * TAU;
        const major = i % 18 === 0;
        const r0 = r + 9;
        const r1 = r + (major ? 19 : 13);
        d += `M${(cx + Math.cos(a) * r0).toFixed(1)},${(cy + Math.sin(a) * r0).toFixed(1)}L${(cx + Math.cos(a) * r1).toFixed(1)},${(cy + Math.sin(a) * r1).toFixed(1)}`;
      }
      ticks.querySelector("path")?.setAttribute("d", d);
    }
    if (ringGroupRef.current) {
      ringGroupRef.current.style.transformOrigin = `${cx}px ${cy}px`;
    }
  }, [sharedRef]);

  useEffect(() => {
    layout();
    window.addEventListener("resize", layout);
    return () => window.removeEventListener("resize", layout);
  }, [layout]);

  /* ---------------- success → snap → unroll → charge ---------------- */
  const succeed = useCallback(
    (stroke: Point[]) => {
      const ring = sharedRef.current.ring;
      const info = analyse(stroke, ring);
      const sampled = resample(stroke, RESAMPLE);
      const dir = info.sweep >= 0 ? 1 : -1;
      // rotate the stroke so it begins nearest the top of the ring
      let best = 0;
      let bestD = Infinity;
      sampled.forEach((p, i) => {
        const d = Math.abs(
          wrapAngle(Math.atan2(p.y - ring[1], p.x - ring[0]) + Math.PI / 2),
        );
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      const ordered = [...sampled.slice(best), ...sampled.slice(0, best)];
      sequence.current = {
        start: performance.now(),
        from: ordered,
        dir,
        startAngle: -Math.PI / 2,
      };
      progressRef.current?.setAttribute("d", "");
      introSound.success();
      go("success");
    },
    [go, sharedRef],
  );

  const startAutoDraw = useCallback(() => {
    if (stateRef.current !== "idle" && stateRef.current !== "retry") return;
    points.current = [];
    autoDraw.current = { start: performance.now() };
    go("drawing");
  }, [go]);

  /* ---------------- animation loop ---------------- */
  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const s = stateRef.current;
      const ring = sharedRef.current.ring;
      const [cx, cy, r] = ring;

      // auto-draw for "tap to enter" / keyboard users
      if (autoDraw.current) {
        const k = clamp01((now - autoDraw.current.start) / 950);
        const count = Math.floor(k * 120);
        const pts: Point[] = [];
        for (let i = 0; i <= count; i++) {
          const a = -Math.PI / 2 + (i / 120) * TAU * 1.02;
          const wobble = 1 + Math.sin(i * 0.31) * 0.012;
          pts.push({
            x: cx + Math.cos(a) * r * wobble,
            y: cy + Math.sin(a) * r * wobble,
          });
        }
        points.current = pts;
        const svgPoints = toPoints(pts);
        strokeRef.current?.setAttribute("points", svgPoints);
        glowRef.current?.setAttribute("points", svgPoints);
        progressRef.current?.setAttribute(
          "d",
          arcPath(cx, cy, r, -Math.PI / 2, k * TAU),
        );
        introSound.draw(k, 650);
        if (k >= 1) {
          autoDraw.current = null;
          succeed(pts);
        }
      }

      // pointer resting mid-stroke: let the glass tone settle
      const move = lastMove.current;
      if (drawing.current && !move.still && now - move.t > 90) {
        move.still = true;
        introSound.draw(move.progress, 0);
      }

      // ghost demo while idle
      const ghost = ghostRef.current;
      if (ghost) {
        const show = s === "idle" || s === "retry";
        if (show) {
          ghostClock.current += 1 / 60;
          const cycle = 3.4;
          const local = (ghostClock.current % cycle) / cycle;
          const move = easeInOut(clamp01((local - 0.12) / 0.72));
          const a = -Math.PI / 2 + move * TAU * 0.98;
          const alpha = Math.sin(clamp01((local - 0.06) / 0.86) * Math.PI);
          ghost.style.opacity = String(alpha * 0.95);
          ghostDotRef.current?.setAttribute("cx", String(cx + Math.cos(a) * r));
          ghostDotRef.current?.setAttribute("cy", String(cy + Math.sin(a) * r));
          ghostTrailRef.current?.setAttribute(
            "d",
            arcPath(
              cx,
              cy,
              r,
              Math.max(-Math.PI / 2, a - 1.3),
              Math.min(1.3, a + Math.PI / 2),
            ),
          );
        } else {
          ghost.style.opacity = "0";
        }
      }

      const seq = sequence.current;
      if (seq && (s === "success" || s === "charge")) {
        const t = now - seq.start;
        sharedRef.current.success = clamp01(t / 1150);
        const lineW = sharedRef.current.lineWidth;
        const W = window.innerWidth;
        const H = window.innerHeight;
        const x0 = (W - lineW) / 2;
        const snap = easeOut(t / 380);
        const open = easeInOut((t - 380) / 680);
        const pts = seq.from.map((p, i) => {
          const k = i / (RESAMPLE - 1);
          const a = seq.startAngle + seq.dir * TAU * k;
          const ringPoint = {
            x: cx + Math.cos(a) * r,
            y: cy + Math.sin(a) * r,
          };
          const sx = p.x + (ringPoint.x - p.x) * snap;
          const sy = p.y + (ringPoint.y - p.y) * snap;
          // the ring opens at the top: each half swings down into the horizontal tube
          const side = seq.dir > 0 ? -1 : 1;
          const line = { x: W / 2 + side * (k - 0.5) * lineW, y: H / 2 };
          const swing =
            Math.sin(Math.PI * open) * (1 - Math.abs(k - 0.5) * 2) * r * 0.35;
          return {
            x: sx + (line.x - sx) * open,
            y: sy + (line.y - sy) * open + swing,
          };
        });
        const svgPoints = toPoints(pts);
        strokeRef.current?.setAttribute("points", svgPoints);
        glowRef.current?.setAttribute("points", svgPoints);
        sharedRef.current.lens = 1 - easeInOut((t - 300) / 600);
        const strokeFade = 1 - clamp01((t - 1120) / 240);
        if (strokeRef.current)
          strokeRef.current.style.opacity = String(strokeFade);
        if (glowRef.current) glowRef.current.style.opacity = String(strokeFade);

        const charge = chargeRef.current;
        if (charge) {
          charge.style.left = `${x0}px`;
          charge.style.width = `${lineW}px`;
          charge.style.opacity = String(clamp01((t - 1000) / 260));
        }
        if (t > 1150 && s === "success") {
          chargeStart.current = now;
          introSound.charge();
          go("charge");
        }
      }

      if (s === "charge" && !charged.current) {
        const elapsed = (now - chargeStart.current) / 1000;
        const timeK = clamp01(elapsed / CHARGE_MIN_SECONDS);
        const ready = isReady();
        const target = ready ? timeK : Math.min(timeK, 0.92);
        const current = parseFloat(fillRef.current?.dataset.value ?? "0");
        const next = current + (target - current) * 0.12;
        const value = target >= 1 && next > 0.995 ? 1 : next;
        if (fillRef.current) {
          fillRef.current.dataset.value = String(value);
          fillRef.current.style.transform = `scaleX(${value})`;
        }
        if (pctRef.current)
          pctRef.current.textContent = `${Math.round(value * 100)}%`;
        sharedRef.current.charge = value;
        if (value >= 1) {
          charged.current = true;
          window.setTimeout(() => {
            go("done");
            onChargedRef.current();
          }, 180);
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [go, isReady, sharedRef, succeed]);

  /* ---------------- pour hand-off: tube follows the bar, then drains ---------------- */
  useEffect(() => {
    apiRef.current = {
      setPour(barScreenY, drained, fade) {
        const charge = chargeRef.current;
        if (!charge) return;
        const H = window.innerHeight;
        charge.style.transform = `translate3d(0, ${barScreenY - H / 2}px, 0)`;
        charge.style.opacity = String(fade);
        charge.style.setProperty("--drain", `${(drained * 50).toFixed(2)}%`);
        charge.classList.add("is-pouring");
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef]);

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        startAutoDraw();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startAutoDraw]);

  /* ---------------- drawing ---------------- */
  const pointFrom = (event: ReactPointerEvent) => ({
    x: event.clientX,
    y: event.clientY,
  });

  const onDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    const s = stateRef.current;
    if (s !== "idle" && s !== "retry") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    points.current = [pointFrom(event)];
    lastMove.current = {
      t: performance.now(),
      x: event.clientX,
      y: event.clientY,
      progress: 0,
      still: true,
    };
    introSound.draw(0, 0);
    if (strokeRef.current) strokeRef.current.style.opacity = "1";
    if (glowRef.current) glowRef.current.style.opacity = "1";
    go("drawing");
  };

  const onMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drawing.current) return;
    const p = pointFrom(event);
    const last = points.current[points.current.length - 1];
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < 2.5) return;
    points.current.push(p);
    const move = lastMove.current;
    const moveNow = performance.now();
    const speed =
      (Math.hypot(p.x - move.x, p.y - move.y) / Math.max(8, moveNow - move.t)) *
      1000;
    const svgPoints = toPoints(points.current);
    strokeRef.current?.setAttribute("points", svgPoints);
    glowRef.current?.setAttribute("points", svgPoints);
    const ring = sharedRef.current.ring;
    const info = analyse(points.current, ring);
    const ringStart = Math.atan2(
      points.current[0].y - info.center.y,
      points.current[0].x - info.center.x,
    );
    progressRef.current?.setAttribute(
      "d",
      arcPath(
        ring[0],
        ring[1],
        ring[2],
        ringStart,
        Math.max(-TAU, Math.min(TAU, info.sweep)),
      ),
    );
    const progress = Math.min(1, Math.abs(info.sweep) / TAU);
    lastMove.current = { t: moveNow, x: p.x, y: p.y, progress, still: false };
    introSound.draw(progress, speed);
    if (
      Math.abs(info.sweep) >= TAU * 0.9 &&
      info.radius > 22 &&
      points.current.length > 14
    ) {
      drawing.current = false;
      succeed(points.current);
    }
  };

  const onUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {}
    const info = analyse(points.current, sharedRef.current.ring);
    if (
      Math.abs(info.sweep) >= Math.PI * 1.45 &&
      info.roundness < 0.45 &&
      info.radius > 22
    ) {
      succeed(points.current);
      return;
    }
    introSound.retry();
    go("retry");
    if (strokeRef.current) strokeRef.current.style.opacity = "0";
    if (glowRef.current) glowRef.current.style.opacity = "0";
    progressRef.current?.setAttribute("d", "");
    ringGroupRef.current?.classList.remove("is-shaking");
    void ringGroupRef.current?.getBoundingClientRect();
    ringGroupRef.current?.classList.add("is-shaking");
  };

  return (
    <section className={`gate is-${state}`} aria-label="Enter EXiST">
      <div className="gate-stage">
        <div className="gate-copy gate-copy-top">
          <p className="gate-kicker">
            <span className="gate-dot" /> Welcome to EXiST
          </p>
          <h1 className="gate-title" aria-label="Draw a circle to exist">
            <span className="gate-line">
              <Chars text="DRAW A CIRCLE" />
            </span>
            <span className="gate-line">
              <Chars text="TO " offset={13} />
              <span className="gate-accent">
                <Chars text="EXıST" offset={16} />
              </span>
            </span>
          </h1>
        </div>

        <div ref={slotRef} className="gate-ring-slot" aria-hidden="true" />

        <div className="gate-copy gate-copy-bottom">
          <p className="gate-hint" aria-live="polite">
            {HINTS[state]}
          </p>
          <button type="button" className="gate-enter" onClick={startAutoDraw}>
            <span>Or tap to enter</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      <svg
        className="gate-svg"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <defs>
          <filter id="gate-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <linearGradient id="gate-trail" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#dbfe01" stopOpacity="0" />
            <stop offset="1" stopColor="#dbfe01" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <g ref={ringGroupRef} className="gate-ring-group">
          <circle ref={ringRef} className="gate-ring" />
          <g ref={ticksRef} className="gate-ticks">
            <path />
          </g>
        </g>
        <path ref={progressRef} className="gate-progress" />
        <g ref={ghostRef} className="gate-ghost">
          <path ref={ghostTrailRef} className="gate-ghost-trail" />
          <circle ref={ghostDotRef} className="gate-ghost-dot" r="5" />
        </g>
        <polyline
          ref={glowRef}
          className="gate-stroke-glow"
          filter="url(#gate-glow)"
        />
        <polyline ref={strokeRef} className="gate-stroke" />
      </svg>

      <div
        ref={chargeRef}
        className="gate-charge"
        aria-hidden={state !== "charge"}
      >
        <div className="gate-charge-tube">
          <div ref={fillRef} className="gate-charge-fill" data-value="0" />
          <div className="gate-charge-shine" />
        </div>
        <div className="gate-charge-meta">
          <span>Charging EXiST</span>
          <span ref={pctRef} className="gate-charge-pct">
            0%
          </span>
        </div>
      </div>
    </section>
  );
}
