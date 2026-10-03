"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ANCHORS } from "./gl/sigiriya";
import type { Vec3 } from "./gl/math";
import { CHAPTERS } from "./timeline";

type Projector = (point: Vec3) => {
  x: number;
  y: number;
  visible: boolean;
  depth: number;
};

export type StoryHandle = {
  update: (p: number, project: Projector, build: number) => void;
  measure: () => void;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const range = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeInOut = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* Jaro: the dotless "ı" is 0.83 as tall and 0.9 as wide as the capital "I". */
const I_SCALE_X = 0.9;
const I_SCALE_Y = 0.83;

function Words({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {text.split(" ").map((word, i) => (
        <span key={`${word}-${i}`}>
          <span className="sw">
            <span className="sw-i">{word}</span>
          </span>{" "}
        </span>
      ))}
    </span>
  );
}

/* A letter that can morph from the logo's "ı" into a capital "I". */
function Glyph({ ch, anchor }: { ch: string; anchor?: string }) {
  if (ch === "I" && anchor) {
    return (
      <span className="mc mc-anchor" data-key={anchor}>
        <span className="mc-g mc-i">I</span>
        <span className="mc-base" />
      </span>
    );
  }
  return (
    <span
      className={`mc ${anchor ? "mc-anchor" : "mc-tail"}`}
      data-key={anchor}
    >
      <span className="mc-g">{ch}</span>
      {anchor && <span className="mc-base" />}
    </span>
  );
}

function Line({
  text,
  anchors,
  className = "",
}: {
  text: string;
  anchors: Record<number, string>;
  className?: string;
}) {
  const out: ReactNode[] = [];
  text.split("").forEach((ch, i) => {
    out.push(<Glyph key={i} ch={ch} anchor={anchors[i]} />);
  });
  return <span className={`morph-line ${className}`}>{out}</span>;
}

const CALLOUTS: {
  key: keyof typeof ANCHORS;
  title: string;
  sub: string;
  dx: number;
  dy: number;
  start: number;
}[] = [
  {
    key: "gardens",
    title: "Systems",
    sub: "Automation · data flow",
    dx: 70,
    dy: 46,
    start: 0.27,
  },
  {
    key: "lion",
    title: "Development",
    sub: "Web · mobile apps",
    dx: 80,
    dy: -96,
    start: 0.29,
  },
  {
    key: "mirror",
    title: "Design",
    sub: "Brand · interface",
    dx: -250,
    dy: -54,
    start: 0.31,
  },
  {
    key: "summit",
    title: "Growth",
    sub: "SEO · social · ads",
    dx: 74,
    dy: -78,
    start: 0.33,
  },
];

type Flip = {
  el: HTMLElement;
  dx: number;
  dy: number;
  s: number;
  isI: boolean;
  baseline: number;
};

const StoryOverlay = forwardRef<StoryHandle>(function StoryOverlay(_, ref) {
  const rootRef = useRef<HTMLDivElement>(null);
  const morphRef = useRef<HTMLDivElement>(null);
  const morphRefRow = useRef<HTMLDivElement>(null);
  const epiRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<SVGSVGElement>(null);
  const flips = useRef<{ stack: Flip[]; epi: Flip[] }>({ stack: [], epi: [] });
  const scanRef = useRef<HTMLSpanElement>(null);

  const measure = useCallback(() => {
    const root = rootRef.current;
    const morph = morphRef.current;
    const refRow = morphRefRow.current;
    const epi = epiRef.current;
    if (!root || !morph || !refRow || !epi) return;

    const anchors = [
      ...morph.querySelectorAll<HTMLElement>(".mc-anchor"),
      ...epi.querySelectorAll<HTMLElement>(".mc-anchor"),
    ];
    const reset = [
      morph,
      epi,
      ...anchors,
      ...anchors.map((a) => a.firstElementChild as HTMLElement),
    ];
    const saved = reset.map((el) => el.style.transform);
    reset.forEach((el) => (el.style.transform = "none"));

    // Reference ("EXıST") glyph boxes: left edge, baseline and font size.
    const refs: Record<
      string,
      { left: number; baseline: number; size: number }
    > = {};
    refRow.querySelectorAll<HTMLElement>("[data-ref]").forEach((el) => {
      const rect = el.getBoundingClientRect();
      const probe = el.querySelector<HTMLElement>(".mc-base");
      refs[el.dataset.ref!] = {
        left: rect.left,
        baseline: probe ? probe.getBoundingClientRect().top : rect.bottom,
        size: parseFloat(getComputedStyle(el).fontSize),
      };
    });
    // FLIP: scale by the font-size ratio and line the baselines up exactly.
    const build = (els: HTMLElement[]) =>
      els.map((el) => {
        const key = el.dataset.key!;
        const a = refs[key];
        const b = el.getBoundingClientRect();
        const probe = el.querySelector<HTMLElement>(".mc-base");
        const baseline =
          (probe ? probe.getBoundingClientRect().top : b.bottom) - b.top;
        const s = a.size / parseFloat(getComputedStyle(el).fontSize);
        return {
          el,
          dx: a.left - b.left,
          dy: a.baseline - (b.top + baseline * s),
          s,
          isI: key === "ı",
          baseline,
        };
      });
    flips.current = {
      stack: build([...morph.querySelectorAll<HTMLElement>(".mc-anchor")]),
      epi: build([...epi.querySelectorAll<HTMLElement>(".mc-anchor")]),
    };
    reset.forEach((el, i) => (el.style.transform = saved[i]));
  }, []);

  useEffect(() => {
    const run = () => requestAnimationFrame(measure);
    document.fonts?.ready.then(run);
    document.fonts?.addEventListener?.("loadingdone", run);
    run();
    window.addEventListener("resize", run);
    // re-measure whenever the type reflows (e.g. when Jaro finishes loading)
    const observer = new ResizeObserver(run);
    [morphRef.current, morphRefRow.current, epiRef.current].forEach(
      (el) => el && observer.observe(el),
    );
    morphRef.current
      ?.querySelectorAll(".morph-line")
      .forEach((el) => observer.observe(el));
    epiRef.current
      ?.querySelectorAll(".epi-line")
      .forEach((el) => observer.observe(el));
    return () => {
      window.removeEventListener("resize", run);
      document.fonts?.removeEventListener?.("loadingdone", run);
      observer.disconnect();
    };
  }, [measure]);

  const update = useCallback((p: number, project: Projector, build: number) => {
    const root = rootRef.current;
    if (!root) return;

    /* ---------- word-by-word captions ---------- */
    root.querySelectorAll<HTMLElement>("[data-window]").forEach((block) => {
      const [a, b, c, d] = block.dataset.window!.split(",").map(Number);
      const enter = range(p, a, b);
      const exit = range(p, c, d);
      const visible = enter > 0 && exit < 1;
      block.style.visibility = visible ? "visible" : "hidden";
      if (!visible) return;
      const words = block.querySelectorAll<HTMLElement>(".sw-i");
      const n = Math.max(1, words.length);
      words.forEach((word, i) => {
        const inK = easeOut(enter * (1 + n * 0.06) - i * 0.06);
        const outK = easeInOut(exit * (1 + n * 0.03) - i * 0.03);
        word.style.transform = `translate3d(0, ${(1 - inK) * 105 - outK * 40}%, 0)`;
        word.style.opacity = String(inK * (1 - outK));
        word.style.filter = outK > 0.01 ? `blur(${outK * 8}px)` : "none";
      });
      block.querySelectorAll<HTMLElement>(".fade-in").forEach((el) => {
        el.style.opacity = String(
          easeOut(enter * 1.4 - 0.3) * (1 - easeInOut(exit)),
        );
      });
    });

    /* ---------- HUD frame + readout ---------- */
    const hud = clamp01(range(p, 0.03, 0.07)) * (1 - range(p, 0.42, 0.46));
    root.style.setProperty("--hud", hud.toFixed(3));
    if (scanRef.current)
      scanRef.current.textContent = `${Math.round(build * 100)}%`;

    /* ---------- call-outs anchored to the 3D model ---------- */
    const svg = linesRef.current;
    CALLOUTS.forEach((callout, index) => {
      const el = root.querySelector<HTMLElement>(
        `[data-callout="${callout.key}"]`,
      );
      const line = svg?.querySelector<SVGPolylineElement>(
        `[data-line="${callout.key}"]`,
      );
      if (!el || !line) return;
      const k =
        easeOut(range(p, callout.start, callout.start + 0.05)) *
        (1 - easeInOut(range(p, 0.41, 0.44)));
      const projected = project(ANCHORS[callout.key]);
      const show = k > 0.001 && projected.visible;
      el.style.visibility = show ? "visible" : "hidden";
      line.style.visibility = show ? "visible" : "hidden";
      if (!show) return;
      const mobile = window.innerWidth < 760;
      const dx = mobile ? Math.sign(callout.dx) * 26 : callout.dx;
      const dy = mobile ? callout.dy * 0.6 : callout.dy;
      const x = projected.x;
      const y = projected.y;
      const box = el.querySelector<HTMLElement>(".story-callout-box");
      const boxW = box?.offsetWidth ?? 180;
      let fx = dx;
      if (fx > 0 && x + fx + boxW + 16 > window.innerWidth) fx = -Math.abs(fx);
      if (fx < 0 && x + fx - boxW - 16 < 0) fx = Math.abs(fx);
      const lx = x + fx;
      const ly = y + dy;
      line.setAttribute(
        "points",
        `${x},${y} ${x + fx * 0.45},${ly} ${lx},${ly}`,
      );
      line.style.strokeDashoffset = String(1 - k);
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      el.style.setProperty("--k", k.toFixed(3));
      el.style.setProperty("--lx", `${fx}px`);
      el.style.setProperty("--ly", `${dy}px`);
      el.dataset.side = fx < 0 ? "left" : "right";
      el.style.zIndex = String(10 + index);
    });

    /* ---------- EXiST → EXCELLENCE IT SOLUTIONS ---------- */
    const morph = morphRef.current;
    if (morph) {
      const reveal = range(p, 0.45, 0.505);
      const forward = range(p, 0.5, 0.6);
      const backward = range(p, 0.66, 0.71);
      const m = p < 0.66 ? forward : 1 - backward;
      const absorb = easeInOut(range(p, 0.71, 0.755));
      const visible = reveal > 0 && absorb < 1;
      morph.style.visibility = visible ? "visible" : "hidden";
      if (visible) {
        const H = window.innerHeight;
        morph.style.transform = `translate3d(0, ${absorb * H * 0.16}px, 0) scale(${1 - absorb * 0.42})`;
        morph.style.opacity = String(1 - absorb);
        morph.style.filter = absorb > 0.01 ? `blur(${absorb * 10}px)` : "none";

        const params = [
          { sway: -60, lift: 70, rot: -8 },
          { sway: -26, lift: 110, rot: 6 },
          { sway: 40, lift: 60, rot: -4 },
          { sway: 70, lift: 95, rot: 7 },
          { sway: 20, lift: 130, rot: -6 },
        ];
        flips.current.stack.forEach((f, k) => {
          const r = easeOut(reveal * 1.6 - k * 0.12);
          const e = easeInOut(m * 1.25 - k * 0.06);
          const arc = Math.sin(Math.PI * e);
          const pr = params[k % params.length];
          const s = lerp(f.s, 1, e);
          const tx = f.dx * (1 - e) + pr.sway * arc;
          const ty = f.dy * (1 - e) - pr.lift * arc + (1 - r) * 60;
          f.el.style.transform = `translate3d(${tx}px, ${ty}px, 0) rotate(${pr.rot * arc}deg) scale(${s})`;
          f.el.style.opacity = String(r);
          f.el.style.filter =
            r < 0.99 || arc > 0.02
              ? `blur(${(1 - r) * 12 + arc * 1.4}px)`
              : "none";
          const glyph = f.el.firstElementChild as HTMLElement;
          if (f.isI) {
            glyph.style.transformOrigin = `0 ${f.baseline}px`;
            glyph.style.transform = `scale(${lerp(I_SCALE_X, 1, e)}, ${lerp(I_SCALE_Y, 1, e)})`;
          }
        });
        const tails = morph.querySelectorAll<HTMLElement>(".mc-tail");
        tails.forEach((tail, j) => {
          const t = easeOut(m * 1.9 - 0.62 - (j % 9) * 0.035);
          tail.style.opacity = String(t);
          tail.style.transform = `translate3d(0, ${(1 - t) * 34}px, 0)`;
          tail.style.filter = t < 0.99 ? `blur(${(1 - t) * 10}px)` : "none";
        });
        morph.style.setProperty(
          "--outline",
          easeInOut(m * 1.6 - 0.5).toFixed(3),
        );
        morph.style.setProperty(
          "--extra",
          easeOut(range(p, 0.585, 0.615) * (1 - backward * 2)).toFixed(3),
        );
      }
    }

    /* ---------- final statement with landing EXiST letters ---------- */
    const epi = epiRef.current;
    if (epi) {
      const on = p > 0.915;
      epi.style.visibility = on ? "visible" : "hidden";
      if (on) {
        const top = range(p, 0.92, 0.955);
        epi
          .querySelectorAll<HTMLElement>(".epi-top .sw-i")
          .forEach((word, i) => {
            const k = easeOut(top * 1.5 - i * 0.1);
            word.style.transform = `translate3d(0, ${(1 - k) * 105}%, 0)`;
            word.style.opacity = String(k);
          });
        const accent = range(p, 0.935, 0.97);
        epi
          .querySelectorAll<HTMLElement>(".epi-accent .mc-tail")
          .forEach((ch, i) => {
            const k = easeOut(accent * 2.2 - i * 0.045);
            ch.style.opacity = String(k);
            ch.style.transform = `translate3d(0, ${(1 - k) * 30}px, 0)`;
            ch.style.filter = k < 0.99 ? `blur(${(1 - k) * 8}px)` : "none";
          });
        const fly = range(p, 0.945, 0.99);
        flips.current.epi.forEach((f, k) => {
          const e = easeInOut(fly * 1.6 - k * 0.12);
          const arc = Math.sin(Math.PI * e);
          const s = lerp(f.s, 1, e);
          const tx = f.dx * (1 - e);
          const ty = f.dy * (1 - e) - arc * 40;
          f.el.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${s})`;
          f.el.style.opacity = String(clamp01(e * 5));
          f.el.style.setProperty("--flash", arc.toFixed(3));
          const glyph = f.el.firstElementChild as HTMLElement;
          if (f.isI) {
            glyph.style.transformOrigin = `0 ${f.baseline}px`;
            glyph.style.transform = `scale(${lerp(I_SCALE_X, 1, e)}, ${lerp(I_SCALE_Y, 1, e)})`;
          }
        });
        epi.querySelectorAll<HTMLElement>(".epi-fade").forEach((el) => {
          el.style.opacity = String(easeOut(range(p, 0.965, 0.995)));
        });
      }
    }

    /* ---------- chapter rail ---------- */
    root.style.setProperty("--progress", p.toFixed(4));
    CHAPTERS.forEach((chapter) => {
      root
        .querySelector(`[data-rail="${chapter.id}"]`)
        ?.classList.toggle("is-active", p >= chapter.start - 0.001);
    });
  }, []);

  useImperativeHandle(ref, () => ({ update, measure }), [update, measure]);

  return (
    <div ref={rootRef} className="story" aria-live="off">
      <div className="story-shade" aria-hidden="true" />
      <div className="story-frame" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>

      <article className="story-caption" data-window="0.06,0.11,0.19,0.235">
        <p className="story-kicker fade-in">
          <span className="story-dot" /> The question every business asks
        </p>
        <h2 className="story-title">
          <Words text="WHO CAN MAKE MY BRAND STAND OUT?" />
        </h2>
        <p className="story-body story-answer">
          <Words text="We can." className="story-answer-lead" />
          <Words text="EXiST is the best and only partner your brand will ever need." />
        </p>
      </article>

      <article className="story-caption" data-window="0.255,0.3,0.4,0.44">
        <p className="story-kicker fade-in">
          <span className="story-dot" /> Strategy · Design · Code · Growth
        </p>
        <h2 className="story-title">
          <Words text="WE BUILD. YOU GROW." />
        </h2>
        <p className="story-body">
          <Words text="Every pixel, post and line of code is crafted in-house — made to win you real customers." />
        </p>
      </article>

      <svg ref={linesRef} className="story-lines" aria-hidden="true">
        {CALLOUTS.map((c) => (
          <polyline key={c.key} data-line={c.key} pathLength={1} />
        ))}
      </svg>
      {CALLOUTS.map((c) => (
        <div key={c.key} className="story-callout" data-callout={c.key}>
          <span className="story-callout-dot" />
          <div className="story-callout-box">
            <b>{c.title}</b>
            <span>{c.sub}</span>
          </div>
        </div>
      ))}

      <div className="story-readout" aria-hidden="true">
        <span>EXiST · Build engine</span>
        <span>Idea → Launch → Growth</span>
        <span>
          Build <b ref={scanRef}>0%</b>
        </span>
      </div>

      <div
        ref={morphRef}
        className="morph"
        aria-label="EXiST — Excellence IT Solutions"
      >
        <div ref={morphRefRow} className="morph-ref" aria-hidden="true">
          {["E", "X", "ı", "S", "T"].map((ch) => (
            <span key={ch} data-ref={ch}>
              {ch}
              <span className="mc-base" />
            </span>
          ))}
        </div>
        <p className="morph-kicker">What EXiST stands for</p>
        <div className="morph-stack" aria-hidden="true">
          <Line text="EXCELLENCE" anchors={{ 0: "E", 1: "X" }} />
          <Line
            text="IT"
            anchors={{ 0: "ı", 1: "T" }}
            className="morph-outline"
          />
          <Line text="SOLUTIONS" anchors={{ 0: "S" }} />
        </div>
        <p className="morph-sub">Websites · Design · Social · SEO · Systems</p>
      </div>

      <div
        ref={epiRef}
        className="epi"
        aria-label="We turn fading brands into next-gen icons."
      >
        <p className="epi-kicker epi-fade">Rebuild · Evolve · Lead</p>
        <p className="epi-line epi-top" aria-hidden="true">
          <Words text="WE TURN FADING BRANDS INTO" />
        </p>
        <p className="epi-line epi-accent" aria-hidden="true">
          <span className="epi-word">
            <Glyph ch="N" />
            <Glyph ch="E" anchor="E" />
            <Glyph ch="X" anchor="X" />
            <Glyph ch="T" anchor="T" />
            {"-GEN".split("").map((ch, i) => (
              <Glyph key={`a${i}`} ch={ch} />
            ))}
          </span>
          <span className="epi-word">
            <Glyph ch="I" anchor="ı" />
            {"CON".split("").map((ch, i) => (
              <Glyph key={`b${i}`} ch={ch} />
            ))}
            <Glyph ch="S" anchor="S" />
            <Glyph ch="." />
          </span>
        </p>
      </div>

      <nav className="story-rail" aria-hidden="true">
        <span className="story-rail-track">
          <span className="story-rail-fill" />
        </span>
        {CHAPTERS.map((chapter, i) => (
          <span
            key={chapter.id}
            className="story-rail-node"
            data-rail={chapter.id}
            style={{ "--at": chapter.start } as CSSProperties}
          >
            <span>
              0{i + 1} {chapter.label}
            </span>
          </span>
        ))}
      </nav>
    </div>
  );
});

export default StoryOverlay;
