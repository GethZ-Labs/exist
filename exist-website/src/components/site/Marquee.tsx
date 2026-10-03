"use client";

import { useRef } from "react";
import { useFrame } from "./effects";

/*
  Infinite ticker whose speed and skew react to scroll velocity.
  `direction` flips it; `tone` picks lime-on-black or black-on-lime.
*/
export default function Marquee({
  items,
  direction = 1,
  tone = "lime",
  speed = 0.045,
}: {
  items: string[];
  direction?: 1 | -1;
  tone?: "lime" | "dark";
  speed?: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const offset = useRef(0);
  const lastScroll = useRef(0);
  const lastTime = useRef(0);
  const velocity = useRef(0);

  useFrame((time) => {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    const delta = lastTime.current ? Math.min(64, time - lastTime.current) : 16;
    lastTime.current = time;

    const scrollDelta = window.scrollY - lastScroll.current;
    lastScroll.current = window.scrollY;
    velocity.current += (scrollDelta - velocity.current) * 0.12;

    const boost = 1 + Math.min(6, Math.abs(velocity.current) * 0.25);
    offset.current +=
      direction * speed * delta * boost * (velocity.current < -0.5 ? -1 : 1);

    const half = track.scrollWidth / 2;
    if (half > 0) {
      offset.current = ((offset.current % half) + half) % half;
    }

    const skew = Math.max(-8, Math.min(8, velocity.current * 0.35));
    track.style.transform = `translate3d(${-offset.current}px, 0, 0) skewX(${-skew}deg)`;
  });

  const row = [...items, ...items];

  return (
    <div className={`marquee marquee-${tone}`} aria-hidden="true">
      <div ref={trackRef} className="marquee-track">
        {[0, 1].map((copy) => (
          <div className="marquee-group" key={copy}>
            {row.map((item, index) => (
              <span className="marquee-item" key={`${copy}-${index}`}>
                {item}
                <svg viewBox="0 0 24 24" className="marquee-star">
                  <path d="M12 0 L14.6 9.4 L24 12 L14.6 14.6 L12 24 L9.4 14.6 L0 12 L9.4 9.4 Z" />
                </svg>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
