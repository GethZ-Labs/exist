"use client";

import { useRef } from "react";
import { pinnedProgress, useFrame } from "./effects";

const STATEMENT =
  "We make small businesses look like industry giants. Your customers are already online — we make sure they find you, trust you and choose you.";

const HIGHLIGHT = new Set(["industry", "giants.", "find", "trust", "choose"]);

/* Pinned section where each word lights up as you scroll through it. */
export default function Manifesto() {
  const sectionRef = useRef<HTMLElement>(null);
  const wordsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const words = STATEMENT.split(" ");

  useFrame(() => {
    const section = sectionRef.current;
    if (!section) {
      return;
    }

    const progress = pinnedProgress(section);
    const lit = progress * 1.15 * words.length;

    wordsRef.current.forEach((word, index) => {
      if (word) {
        word.style.setProperty(
          "--lit",
          String(Math.max(0, Math.min(1, lit - index))),
        );
      }
    });
  });

  return (
    <section
      ref={sectionRef}
      className="manifesto"
      data-theme="dark"
      aria-label="Manifesto"
    >
      <div className="manifesto-sticky">
        <div className="section-label">
          <span className="section-label-dot" /> Why EXiST
        </div>

        <p className="manifesto-text">
          {words.map((word, index) => (
            <span
              key={`${word}-${index}`}
              ref={(element) => {
                wordsRef.current[index] = element;
              }}
              className={`manifesto-word ${HIGHLIGHT.has(word) ? "is-accent" : ""}`}
            >
              {word}{" "}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
