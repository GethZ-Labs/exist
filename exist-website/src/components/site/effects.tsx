"use client";

import Lenis from "lenis";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

/* ====================================================== */
/* HELPERS                                                */
/* ====================================================== */

export function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/*
  Progress of an element travelling through the viewport.
  0 = its top touches the bottom of the viewport.
  1 = its bottom touches the top of the viewport.
  For sticky "pinned" sections use `pinnedProgress` instead.
*/
export function viewportProgress(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const total = rect.height + window.innerHeight;
  return clamp((window.innerHeight - rect.top) / total);
}

/* 0 when the section top reaches the viewport top, 1 when its bottom reaches the viewport bottom. */
export function pinnedProgress(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const distance = rect.height - window.innerHeight;
  return distance <= 0 ? 0 : clamp(-rect.top / distance);
}

/* Runs `callback` on every animation frame while mounted. */
export function useFrame(callback: (time: number) => void) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    let id = 0;
    const tick = (time: number) => {
      callbackRef.current(time);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
}

/* ====================================================== */
/* SMOOTH SCROLL                                          */
/* ====================================================== */

const LenisContext = createContext<RefObject<Lenis | null> | null>(null);

export function SmoothScroll({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      return;
    }

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      anchors: true,
    });

    lenisRef.current = lenis;

    let id = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      id = requestAnimationFrame(raf);
    };
    id = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(id);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return (
    <LenisContext.Provider value={lenisRef}>{children}</LenisContext.Provider>
  );
}

/* Access to the Lenis instance (e.g. to pause page scrolling under a modal). */
export function useLenis() {
  return useContext(LenisContext);
}

export function useScrollTo() {
  const lenisRef = useContext(LenisContext);

  return (target: string) => {
    const element = document.querySelector<HTMLElement>(target);
    if (!element) {
      return;
    }

    window.history.replaceState(null, "", target);

    if (lenisRef?.current) {
      lenisRef.current.scrollTo(element, { offset: 0, duration: 1.6 });
    } else {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };
}

/* ====================================================== */
/* CUSTOM CURSOR                                          */
/* ====================================================== */

export function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [enabled, setEnabled] = useState(false);

  const target = useRef({ x: -100, y: -100 });
  const ring = useRef({ x: -100, y: -100 });

  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () =>
      setEnabled(finePointer.matches && !prefersReducedMotion());
    update();
    finePointer.addEventListener("change", update);
    return () => finePointer.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    document.documentElement.classList.add("has-custom-cursor");

    const handleMove = (event: PointerEvent) => {
      target.current = { x: event.clientX, y: event.clientY };

      const hovered = (
        event.target as HTMLElement | null
      )?.closest<HTMLElement>(
        "a, button, [data-cursor], input, textarea, select, label",
      );

      const ringElement = ringRef.current;
      if (!ringElement) {
        return;
      }

      const label = hovered?.dataset.cursor ?? "";
      ringElement.classList.toggle("is-hovering", Boolean(hovered));
      ringElement.classList.toggle("has-label", Boolean(label));
      if (labelRef.current) {
        labelRef.current.textContent = label;
      }
    };

    const handleDown = () => ringRef.current?.classList.add("is-pressed");
    const handleUp = () => ringRef.current?.classList.remove("is-pressed");
    const handleLeave = () => {
      target.current = { x: -100, y: -100 };
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerdown", handleDown);
    window.addEventListener("pointerup", handleUp);
    document.addEventListener("pointerleave", handleLeave);

    return () => {
      document.documentElement.classList.remove("has-custom-cursor");
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerdown", handleDown);
      window.removeEventListener("pointerup", handleUp);
      document.removeEventListener("pointerleave", handleLeave);
    };
  }, [enabled]);

  useFrame(() => {
    if (!enabled) {
      return;
    }

    ring.current.x += (target.current.x - ring.current.x) * 0.18;
    ring.current.y += (target.current.y - ring.current.y) * 0.18;

    if (dotRef.current) {
      dotRef.current.style.transform = `translate3d(${target.current.x}px, ${target.current.y}px, 0)`;
    }
    if (ringRef.current) {
      ringRef.current.style.transform = `translate3d(${ring.current.x}px, ${ring.current.y}px, 0)`;
    }
  });

  if (!enabled) {
    return null;
  }

  // rendered on <body> so it stays above modals, page transitions and everything else
  return createPortal(
    <>
      <div ref={ringRef} className="cursor-ring" aria-hidden="true">
        <span ref={labelRef} className="cursor-label" />
      </div>
      <div ref={dotRef} className="cursor-dot" aria-hidden="true" />
    </>,
    document.body,
  );
}

/* ====================================================== */
/* MAGNETIC                                               */
/* ====================================================== */

export function Magnetic({
  children,
  strength = 0.35,
  className = "",
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (
      !element ||
      !window.matchMedia("(hover: hover)").matches ||
      prefersReducedMotion()
    ) {
      return;
    }

    const handleMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      const x = event.clientX - (rect.left + rect.width / 2);
      const y = event.clientY - (rect.top + rect.height / 2);
      element.style.transform = `translate3d(${x * strength}px, ${y * strength}px, 0)`;
    };

    const handleLeave = () => {
      element.style.transform = "translate3d(0, 0, 0)";
    };

    element.addEventListener("pointermove", handleMove);
    element.addEventListener("pointerleave", handleLeave);

    return () => {
      element.removeEventListener("pointermove", handleMove);
      element.removeEventListener("pointerleave", handleLeave);
    };
  }, [strength]);

  return (
    <span ref={ref} className={`magnetic ${className}`}>
      {children}
    </span>
  );
}

/* ====================================================== */
/* REVEAL ON SCROLL                                       */
/* ====================================================== */

/*
  Any element with `data-reveal` fades/slides in when it enters the
  viewport. `data-reveal="lines"` children animate as masked lines.
  `style={{ "--delay": "120ms" }}` staggers.
  The revealed state is a `data-revealed` attribute (not a class), so React
  re-rendering an element's className can never hide it again.
*/
export function useRevealObserver() {
  useEffect(() => {
    const reduced = prefersReducedMotion();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-revealed", "");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    const track = (element: Element) => {
      if (element.hasAttribute("data-revealed")) return;
      if (reduced) element.setAttribute("data-revealed", "");
      else observer.observe(element);
    };
    const scan = (root: ParentNode) => root.querySelectorAll("[data-reveal]").forEach(track);

    scan(document);
    // elements mounted later (a form's success panel, a remounted form…) reveal too
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.hasAttribute("data-reveal")) track(node);
          scan(node);
        });
      }
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, []);
}

/* Splits text into masked lines/words for the reveal animation. */
export function SplitWords({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  return (
    <span className={className}>
      {text.split(" ").map((word, index) => (
        <span className="split-word" key={`${word}-${index}`}>
          <span
            className="split-word-inner"
            style={{ "--i": index } as CSSProperties}
          >
            {word}
          </span>{" "}
        </span>
      ))}
    </span>
  );
}

/* ====================================================== */
/* SCROLL PROGRESS BAR                                    */
/* ====================================================== */

export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useFrame(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? window.scrollY / max : 0;
    if (barRef.current) {
      barRef.current.style.transform = `scaleX(${progress})`;
    }
  });

  return <div ref={barRef} className="scroll-progress" aria-hidden="true" />;
}
