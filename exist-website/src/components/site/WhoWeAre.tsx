"use client";

import type { CSSProperties } from "react";
import LiquidLoop from "./LiquidLoop";
import { TLink } from "./Transition";

/* Short "who we are" chapter for the homepage — our loop, filled with liquid light. */
export default function WhoWeAre() {
  return (
    <section id="about" className="who" data-theme="dark">
      <div className="who-grid">
        <div className="who-copy">
          <div className="section-label" data-reveal>
            <span className="section-label-dot" /> Who we are
          </div>
          <h2 className="section-title" data-reveal style={{ "--delay": "80ms" } as CSSProperties}>
            Born in Sri Lanka. <em>Built for the world.</em>
          </h2>
          <p className="who-text" data-reveal style={{ "--delay": "160ms" } as CSSProperties}>
            EXiST — Excellence IT Solutions — is one team for strategy, design, code and growth. We
            give ambitious local businesses the digital presence of global brands.
          </p>
          <div className="who-values" data-reveal style={{ "--delay": "220ms" } as CSSProperties}>
            <span>Rebuild</span>
            <span>Evolve</span>
            <span>Lead</span>
          </div>
          <div data-reveal style={{ "--delay": "280ms" } as CSSProperties}>
            <TLink href="/about" className="btn btn-lime who-link">
              About EXiST <span aria-hidden="true">→</span>
            </TLink>
          </div>
        </div>

        <div className="who-visual" data-reveal style={{ "--delay": "120ms" } as CSSProperties}>
          <div className="who-orb who-orb-a" aria-hidden="true" />
          <div className="who-orb who-orb-b" aria-hidden="true" />
          <div className="who-glass" aria-hidden="true">
            <LiquidLoop />
          </div>
          <div className="who-stat" aria-hidden="true">
            <span>Excellence IT Solutions</span>
            <b>EXıST</b>
            <span>Sri Lanka → World</span>
          </div>
        </div>
      </div>
    </section>
  );
}
