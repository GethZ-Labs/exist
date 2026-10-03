"use client";

import { useEffect, useId, useRef } from "react";
import { LOOP_PATH } from "./BrandMark";

/*
  The EXiST loop as a glass tube with lime liquid flowing through it:
  a gooey stream + droplets travel along the path, with glints on the glass.
*/
export default function LiquidLoop({ className = "" }: { className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const uid = useId().replace(/:/g, "");

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const guide = svg.querySelector<SVGPathElement>("[data-guide]");
    const stream = svg.querySelector<SVGPathElement>("[data-stream]");
    const sheen = svg.querySelector<SVGPathElement>("[data-sheen]");
    const glints = svg.querySelector<SVGPathElement>("[data-glints]");
    const drops = [...svg.querySelectorAll<SVGCircleElement>("[data-drop]")];
    const bubbles = [...svg.querySelectorAll<SVGCircleElement>("[data-bubble]")];
    if (!guide || !stream || !sheen || !glints) return;
    const length = guide.getTotalLength();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let visible = true;
    const observer = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    observer.observe(svg);

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      const t = reduced ? 0 : (now - start) / 1000;
      const flow = t * 260;
      stream.style.strokeDashoffset = String(-flow);
      sheen.style.strokeDashoffset = String(-flow);
      glints.style.strokeDashoffset = String(t * 120);
      drops.forEach((drop, i) => {
        const d = (flow * 1.08 + (i / drops.length) * length) % length;
        const p = guide.getPointAtLength(d);
        drop.setAttribute("cx", p.x.toFixed(1));
        drop.setAttribute("cy", p.y.toFixed(1));
        drop.setAttribute("r", String(30 + 16 * Math.sin(t * 2 + i * 1.7)));
      });
      bubbles.forEach((bubble, i) => {
        const d = (flow * 1.3 + (i / bubbles.length) * length + i * 37) % length;
        const p = guide.getPointAtLength(d);
        const wobble = Math.sin(t * 3 + i) * 18;
        bubble.setAttribute("cx", (p.x + wobble).toFixed(1));
        bubble.setAttribute("cy", (p.y - wobble * 0.6).toFixed(1));
      });
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return (
    <svg ref={svgRef} className={`liquid-loop ${className}`} viewBox="-60 -40 1720 980" aria-hidden="true">
      <defs>
        <filter id={`goo-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -11" />
        </filter>
        <filter id={`glow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="34" />
        </filter>
        <linearGradient id={`liquid-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e9ff6b" />
          <stop offset="0.5" stopColor="#dbfe01" />
          <stop offset="1" stopColor="#9bbc00" />
        </linearGradient>
      </defs>

      {/* outer glow */}
      <path d={LOOP_PATH} stroke="#dbfe01" strokeOpacity="0.28" strokeWidth="190" fill="none" filter={`url(#glow-${uid})`} />

      {/* glass tube */}
      <path d={LOOP_PATH} stroke="rgba(241,244,230,0.16)" strokeWidth="172" fill="none" strokeLinecap="round" />
      <path d={LOOP_PATH} stroke="#0a0b07" strokeOpacity="0.88" strokeWidth="160" fill="none" strokeLinecap="round" />

      {/* liquid stream + drops, merged by the goo filter */}
      <g filter={`url(#goo-${uid})`}>
        <path
          data-stream
          d={LOOP_PATH}
          stroke={`url(#liquid-${uid})`}
          strokeWidth="92"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="720 260 420 220"
        />
        {Array.from({ length: 7 }, (_, i) => (
          <circle key={i} data-drop r="34" fill="#dbfe01" />
        ))}
      </g>
      <path
        data-sheen
        d={LOOP_PATH}
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="14"
        fill="none"
        strokeLinecap="round"
        strokeDasharray="720 260 420 220"
      />
      {Array.from({ length: 9 }, (_, i) => (
        <circle key={i} data-bubble r={4 + (i % 3) * 3} fill="rgba(255,255,255,0.55)" />
      ))}

      {/* glass glints */}
      <path d={LOOP_PATH} data-guide stroke="none" fill="none" />
      <path
        data-glints
        d={LOOP_PATH}
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
        strokeDasharray="2 180 60 520"
      />
    </svg>
  );
}
