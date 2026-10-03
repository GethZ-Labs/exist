"use client";

import type * as React from "react";

import { PROMISES } from "@/lib/site";

/* Three promise cards with a cursor-tracking spotlight border. */
export default function Promises() {
  const handleMove = (event: React.PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty(
      "--sx",
      `${event.clientX - rect.left}px`,
    );
    event.currentTarget.style.setProperty(
      "--sy",
      `${event.clientY - rect.top}px`,
    );
  };

  return (
    <section className="promises" data-theme="dark">
      <div className="section-head section-head-center">
        <div className="section-label" data-reveal>
          <span className="section-label-dot" /> The EXiST promise
        </div>
        <h2
          className="section-title"
          data-reveal
          style={{ "--delay": "80ms" } as React.CSSProperties}
        >
          Unique <span className="title-dot">·</span> Modern{" "}
          <span className="title-dot">·</span> Fast
        </h2>
      </div>

      <div className="promise-grid">
        {PROMISES.map((promise, index) => (
          <article
            key={promise.title}
            className="promise-card"
            data-reveal
            style={{ "--delay": `${index * 110}ms` } as React.CSSProperties}
            onPointerMove={handleMove}
          >
            <span className="promise-index">0{index + 1}</span>
            <h3>{promise.title}</h3>
            <p>{promise.copy}</p>
            {promise.title === "Fast" && (
              <div className="promise-badge">
                <strong>3–5</strong>
                <span>days to launch</span>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
