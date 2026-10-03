"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";
import { installSoundUnlock, sound } from "@/lib/sound";
import { LoopMark } from "./BrandMark";

/*
  Cinematic page changes: a lime liquid rises over the screen carrying the
  EXiST loop, the route changes underneath, then the liquid drains away.
*/

type Stage = "idle" | "cover" | "covered" | "reveal";

const TransitionContext = createContext<{ navigate: (href: string) => void }>({
  navigate: (href) => window.location.assign(href),
});

export const useNavigate = () => useContext(TransitionContext).navigate;

function scrollToHash(hash: string) {
  const target = document.querySelector<HTMLElement>(hash);
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", hash);
  }
}

export function TransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [stage, setStage] = useState<Stage>("idle");
  const stageRef = useRef<Stage>("idle");
  const timers = useRef<number[]>([]);

  const go = (next: Stage) => {
    stageRef.current = next;
    setStage(next);
  };

  const navigate = useCallback(
    (href: string) => {
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) {
        window.open(url.href, "_blank", "noopener");
        return;
      }
      if (url.pathname === window.location.pathname && !url.search) {
        if (url.hash) scrollToHash(url.hash);
        else window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (stageRef.current !== "idle") return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        router.push(url.pathname + url.search + url.hash);
        return;
      }
      sound.ui.transitionOut();
      go("cover");
      timers.current.push(
        window.setTimeout(() => {
          go("covered");
          router.push(url.pathname + url.search + url.hash);
        }, 640),
        // safety net: never leave the screen covered
        window.setTimeout(() => {
          if (stageRef.current === "covered") {
            go("reveal");
            window.setTimeout(() => go("idle"), 900);
          }
        }, 2600),
      );
    },
    [router],
  );

  // the new route has rendered underneath the liquid: drain it away
  useEffect(() => {
    if (stageRef.current !== "covered") return;
    window.scrollTo(0, 0);
    timers.current.push(
      window.setTimeout(() => {
        if (window.location.hash) scrollToHash(window.location.hash);
        sound.ui.transitionIn();
        go("reveal");
      }, 180),
      window.setTimeout(() => go("idle"), 180 + 900),
    );
  }, [pathname]);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((id) => window.clearTimeout(id));
  }, []);

  // the first click, tap or key press anywhere may start the sound
  useEffect(() => installSoundUnlock(), []);

  return (
    <TransitionContext.Provider value={{ navigate }}>
      {children}
      <div className={`pt pt-${stage}`} aria-hidden="true">
        <div className="pt-liquid">
          <svg className="pt-wave pt-wave-top" viewBox="0 0 1440 120" preserveAspectRatio="none">
            <path d="M0 60 C 180 10 360 110 540 60 C 720 10 900 110 1080 60 C 1260 10 1440 110 1620 60 C 1800 10 1980 110 2160 60 C 2340 10 2520 110 2700 60 C 2880 10 3060 110 3240 60 V 120 H 0 Z" />
          </svg>
          <div className="pt-body">
            <div className="pt-mark">
              <LoopMark className="pt-loop" draw />
              <span className="pt-word">
                EX<span>ı</span>ST
              </span>
            </div>
          </div>
          <svg className="pt-wave pt-wave-bottom" viewBox="0 0 1440 120" preserveAspectRatio="none">
            <path d="M0 60 C 180 110 360 10 540 60 C 720 110 900 10 1080 60 C 1260 110 1440 10 1620 60 C 1800 110 1980 10 2160 60 C 2340 110 2520 10 2700 60 C 2880 110 3060 10 3240 60 V 0 H 0 Z" />
          </svg>
        </div>
      </div>
    </TransitionContext.Provider>
  );
}

/* An internal link that plays the liquid transition. */
export function TLink({
  href,
  className,
  children,
  onNavigate,
  ...rest
}: {
  href: string;
  className?: string;
  children: ReactNode;
  onNavigate?: () => void;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick">) {
  const navigate = useNavigate();
  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        onNavigate?.();
        navigate(href);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
