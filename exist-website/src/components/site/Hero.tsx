"use client";

import type * as React from "react";

import { useEffect, useRef } from "react";
import { LoopMark } from "./BrandMark";
import { TLink } from "./Transition";
import {
  Magnetic,
  prefersReducedMotion,
  useFrame,
  useScrollTo,
  viewportProgress,
} from "./effects";

const LETTERS = [
  { char: "E", depth: 0.6 },
  { char: "X", depth: 1.1 },
  { char: "ı", depth: 1.6, small: true },
  { char: "S", depth: 0.9 },
  { char: "T", depth: 1.3 },
];

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const lettersRef = useRef<(HTMLSpanElement | null)[]>([]);
  const pointer = useRef({ x: 0, y: 0 });
  const eased = useRef({ x: 0, y: 0 });
  const scrollTo = useScrollTo();

  useEffect(() => {
    if (prefersReducedMotion()) {
      return;
    }
    const handleMove = (event: PointerEvent) => {
      pointer.current = {
        x: event.clientX / window.innerWidth - 0.5,
        y: event.clientY / window.innerHeight - 0.5,
      };
    };
    window.addEventListener("pointermove", handleMove);
    return () => window.removeEventListener("pointermove", handleMove);
  }, []);

  useFrame(() => {
    const section = sectionRef.current;
    if (!section) {
      return;
    }

    eased.current.x += (pointer.current.x - eased.current.x) * 0.06;
    eased.current.y += (pointer.current.y - eased.current.y) * 0.06;

    lettersRef.current.forEach((letter, index) => {
      if (!letter) {
        return;
      }
      const depth = LETTERS[index].depth;
      letter.style.setProperty("--mx", `${eased.current.x * depth * 46}px`);
      letter.style.setProperty("--my", `${eased.current.y * depth * 30}px`);
    });

    // As the hero scrolls away it sinks back and dims.
    const progress = viewportProgress(section);
    const away = Math.max(0, (progress - 0.5) * 2);
    if (innerRef.current) {
      innerRef.current.style.transform = `translate3d(0, ${away * 18}vh, 0) scale(${1 - away * 0.12})`;
      innerRef.current.style.opacity = String(1 - away * 0.9);
    }
  });

  return (
    <section id="top" ref={sectionRef} className="hero" data-theme="lime">
      <div ref={innerRef} className="hero-inner">
        <div className="hero-meta">
          <span>Digital studio</span>
          <span className="hero-meta-center">
            Websites · Design · Social · SEO · Systems
          </span>
          <span>Sri Lanka → World</span>
        </div>

        <div className="hero-mark">
          <LoopMark draw className="hero-loop" />

          <h1 className="hero-word" aria-label="EXiST">
            {LETTERS.map((letter, index) => (
              <span
                key={letter.char}
                ref={(element) => {
                  lettersRef.current[index] = element;
                }}
                className={`hero-letter ${letter.small ? "hero-letter-i" : ""}`}
                style={{ "--i": index } as React.CSSProperties}
                aria-hidden="true"
              >
                <span>{letter.char}</span>
              </span>
            ))}
          </h1>
        </div>

        <div className="hero-bottom">
          <p className="hero-lede">
            We build digital solutions that help your business{" "}
            <strong>exist better.</strong>
          </p>

          <div className="hero-actions">
            <Magnetic>
              <a
                href="#contact"
                className="btn btn-dark"
                onClick={(event) => {
                  event.preventDefault();
                  scrollTo("#contact");
                }}
              >
                Start a project <span aria-hidden="true">↗</span>
              </a>
            </Magnetic>
            <Magnetic>
              <TLink href="/projects" className="btn btn-outline-dark">
                See our work
              </TLink>
            </Magnetic>
          </div>
        </div>

        <div className="hero-scroll" aria-hidden="true">
          <span className="hero-scroll-line" />
          Scroll
        </div>
      </div>
    </section>
  );
}
