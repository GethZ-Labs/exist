"use client";

import { useRef } from "react";
import { PROCESS } from "@/lib/site";
import { clamp, pinnedProgress, useFrame } from "./effects";
import BuildStory from "./BuildStory";

/*
  Pinned section: a vector film of a website being planned, created and
  grown scrubs with scroll while Plan → Create → Grow step through.
*/
export default function Process() {
  const sectionRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  const stepsRef = useRef<(HTMLDivElement | null)[]>([]);
  const barRef = useRef<HTMLSpanElement>(null);
  const nodesRef = useRef<(HTMLSpanElement | null)[]>([]);

  useFrame(() => {
    const section = sectionRef.current;
    if (!section) {
      return;
    }

    const progress = pinnedProgress(section);
    progressRef.current = progress;

    const count = PROCESS.length;
    stepsRef.current.forEach((step, index) => {
      if (!step) {
        return;
      }
      // Each step owns a third of the scroll; fade in, hold, fade out.
      const local = progress * count - index;
      const isLast = index === count - 1;
      const visibility =
        clamp(local * 4) * (isLast ? 1 : clamp((1 - local) * 4));
      step.style.opacity = String(visibility);
      step.style.transform = `translate3d(0, ${(1 - visibility) * (local < 0.5 ? 40 : -40)}px, 0)`;
      step.style.filter = `blur(${(1 - visibility) * 8}px)`;
      nodesRef.current[index]?.classList.toggle("is-active", local >= 0);
    });

    if (barRef.current) {
      barRef.current.style.transform = `scaleY(${progress})`;
    }
  });

  return (
    <section
      id="process"
      ref={sectionRef}
      className="process"
      data-theme="dark"
    >
      <div className="process-sticky">
        <BuildStory progressRef={progressRef} className="process-video" />
        <div className="process-shade" aria-hidden="true" />

        <div className="process-header">
          <div className="section-label">
            <span className="section-label-dot" /> How we work
          </div>
          <p className="process-kicker">Small steps. Big dreams.</p>
        </div>

        <div className="process-steps">
          {PROCESS.map((step, index) => (
            <div
              key={step.step}
              ref={(element) => {
                stepsRef.current[index] = element;
              }}
              className="process-step"
            >
              <span className="process-step-number">{step.step}</span>
              <h3 className="process-step-title">{step.title}</h3>
              <p className="process-step-copy">{step.copy}</p>
            </div>
          ))}
        </div>

        <div className="process-rail" aria-hidden="true">
          <span ref={barRef} className="process-rail-fill" />
          {PROCESS.map((step, index) => (
            <span
              key={step.step}
              ref={(element) => {
                nodesRef.current[index] = element;
              }}
              className="process-rail-node"
              style={{ top: `${(index / (PROCESS.length - 1)) * 100}%` }}
            >
              <span>{step.title}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
