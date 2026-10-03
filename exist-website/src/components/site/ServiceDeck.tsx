"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { SERVICES, whatsappLink } from "@/lib/site";
import { sound } from "@/lib/sound";

/*
  Compact, cinematic services: lime liquid in a glass chamber re-forms for
  each service while a frosted card tells its story. Auto-plays like a reel.
*/

const AUTOPLAY_MS = 5200;

/* Blob layouts (x, y, r in a 0–400 box) — one "shape of liquid" per service. */
const SHAPES: [number, number, number][][] = [
  [[200, 200, 104], [120, 128, 46], [292, 120, 38], [300, 290, 50], [96, 286, 34], [210, 318, 30]],
  [[150, 190, 92], [260, 214, 98], [206, 96, 40], [96, 300, 36], [318, 318, 30], [210, 330, 26]],
  [[200, 140, 70], [200, 256, 90], [94, 200, 44], [306, 200, 44], [140, 330, 30], [262, 330, 30]],
  [[130, 140, 62], [270, 140, 62], [130, 270, 62], [270, 270, 62], [200, 206, 52], [200, 206, 30]],
  [[200, 206, 118], [86, 110, 30], [316, 108, 34], [324, 302, 30], [80, 306, 34], [200, 56, 24]],
];

export default function ServiceDeck() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const blobsRef = useRef<(SVGCircleElement | null)[]>([]);
  const activeRef = useRef(0);
  const uid = useId().replace(/:/g, "");

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  // only play while on screen
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.35,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || paused) return;
    const id = window.setTimeout(() => setActive((i) => (i + 1) % SERVICES.length), AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [active, inView, paused]);

  // liquid: blobs ease toward the active shape and keep wobbling
  useEffect(() => {
    const state = SHAPES[0].map(([x, y, r]) => ({ x, y, r }));
    let raf = 0;
    let last = performance.now();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const target = SHAPES[activeRef.current];
      state.forEach((blob, i) => {
        const [tx, ty, tr] = target[i];
        const k = 1 - Math.exp(-dt * (2.2 + i * 0.25));
        blob.x += (tx - blob.x) * k;
        blob.y += (ty - blob.y) * k;
        blob.r += (tr - blob.r) * k;
        const wobble = reduced ? 0 : 1;
        const el = blobsRef.current[i];
        if (el) {
          el.setAttribute("cx", (blob.x + Math.sin(t * 0.9 + i * 1.9) * 10 * wobble).toFixed(1));
          el.setAttribute("cy", (blob.y + Math.cos(t * 0.7 + i * 1.3) * 12 * wobble).toFixed(1));
          el.setAttribute("r", (blob.r * (1 + Math.sin(t * 1.3 + i) * 0.05 * wobble)).toFixed(1));
        }
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const service = SERVICES[active];

  return (
    <section
      id="services"
      ref={sectionRef}
      className="deck"
      data-theme="dark"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <div className="deck-inner">
        <div className="deck-copy">
          <div className="section-label" data-reveal>
            <span className="section-label-dot" /> What we do
          </div>
          <h2 className="section-title" data-reveal style={{ "--delay": "80ms" } as CSSProperties}>
            Everything your business needs to <em>grow</em>.
          </h2>
          <ol className="deck-tabs" data-reveal style={{ "--delay": "160ms" } as CSSProperties}>
            {SERVICES.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={index === active ? "is-active" : ""}
                  aria-pressed={index === active}
                  onClick={() => {
                    if (index !== active) sound.ui.bloop();
                    setActive(index);
                  }}
                >
                  <span className="deck-tab-index">0{index + 1}</span>
                  <span className="deck-tab-title">{item.title}</span>
                  <span className="deck-tab-symbol" aria-hidden="true">
                    {item.symbol}
                  </span>
                  <span className="deck-tab-bar" aria-hidden="true">
                    <span
                      key={`${active}-${inView}-${paused}`}
                      style={{
                        animationDuration: `${AUTOPLAY_MS}ms`,
                        animationPlayState: index === active && inView && !paused ? "running" : "paused",
                      }}
                    />
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="deck-stage" data-reveal style={{ "--delay": "120ms" } as CSSProperties}>
          <svg className="deck-liquid" viewBox="0 0 400 400" aria-hidden="true">
            <defs>
              <filter id={`deck-goo-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="14" result="blur" />
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10" />
              </filter>
              <radialGradient id={`deck-fill-${uid}`} cx="40%" cy="30%" r="80%">
                <stop offset="0" stopColor="#f3ffa3" />
                <stop offset="0.35" stopColor="#dbfe01" />
                <stop offset="1" stopColor="#8fae00" />
              </radialGradient>
            </defs>
            <g filter={`url(#deck-goo-${uid})`} fill={`url(#deck-fill-${uid})`}>
              {SHAPES[0].map((_, i) => (
                <circle
                  key={i}
                  ref={(el) => {
                    blobsRef.current[i] = el;
                  }}
                  cx="200"
                  cy="200"
                  r="40"
                />
              ))}
            </g>
          </svg>
          <div className="deck-reeds" aria-hidden="true" />
          <div className="deck-symbol" aria-hidden="true" key={`sym-${active}`}>
            {service.symbol}
          </div>

          <article className="deck-card" key={service.id} aria-live="polite">
            <p className="deck-card-index">
              0{active + 1} <span>/ 0{SERVICES.length}</span>
            </p>
            <h3 className="deck-card-title">{service.title}</h3>
            <p className="deck-card-copy">{service.summary}</p>
            <ul className="deck-card-tags">
              {service.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
            <a
              className="deck-card-link"
              href={whatsappLink(`Hi EXiST! I'd like to talk about ${service.title.toLowerCase()}.`)}
              target="_blank"
              rel="noreferrer"
            >
              Talk about {service.title.toLowerCase()} <span aria-hidden="true">↗</span>
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}
