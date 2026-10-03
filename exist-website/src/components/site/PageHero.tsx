"use client";

import type { CSSProperties, ReactNode } from "react";

/*
  Hero for inner pages: the title fills with rising lime liquid inside a
  glowing outline, over drifting light orbs and reeded glass.
*/
export default function PageHero({
  kicker,
  title,
  lede,
  children,
}: {
  kicker: string;
  title: string;
  lede?: string;
  children?: ReactNode;
}) {
  return (
    <section className="ph" data-theme="dark">
      <div className="ph-orbs" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="ph-reeds" aria-hidden="true" />
      <div className="ph-inner">
        <p className="section-label ph-kicker">
          <span className="section-label-dot" /> {kicker}
        </p>
        <h1 className="ph-title" aria-label={title}>
          <span className="ph-outline" aria-hidden="true">
            {title}
          </span>
          <span className="ph-liquid" aria-hidden="true">
            {title}
          </span>
        </h1>
        {lede && (
          <p className="ph-lede" style={{ "--delay": "500ms" } as CSSProperties}>
            {lede}
          </p>
        )}
        {children}
      </div>
      <div className="ph-scroll" aria-hidden="true">
        <span />
      </div>
    </section>
  );
}
