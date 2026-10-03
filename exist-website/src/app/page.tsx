"use client";

import { useCallback, useEffect, useState } from "react";
import Intro from "@/components/intro/Intro";
import Home from "@/components/site/Home";
import SiteShell from "@/components/site/SiteShell";

type Stage = "checking" | "intro" | "site";

const INTRO_DONE = "exist-intro-done";

export default function Page() {
  const [stage, setStage] = useState<Stage>("checking");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seen = false;
    try {
      seen = sessionStorage.getItem(INTRO_DONE) === "1";
    } catch {}
    const forced = params.get("intro") === "1";
    const skip =
      !forced &&
      (params.get("intro") === "0" || window.location.hash.length > 1 || seen || reducedMotion);

    // Deferred so the first client render matches the server render.
    const id = requestAnimationFrame(() => {
      if (forced) {
        params.delete("intro");
        const rest = params.toString();
        window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
      }
      setStage(skip ? "site" : "intro");
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // "Replay the intro" from the footer while already on the homepage
  useEffect(() => {
    const replay = () => {
      window.scrollTo(0, 0);
      setStage("intro");
    };
    window.addEventListener("exist:replay-intro", replay);
    return () => window.removeEventListener("exist:replay-intro", replay);
  }, []);

  const enterSite = useCallback(() => {
    try {
      sessionStorage.setItem(INTRO_DONE, "1");
    } catch {}
    document.body.style.overflowY = "";
    window.scrollTo(0, 0);
    setStage("site");
  }, []);

  if (stage === "checking") {
    return <div className="boot-screen" />;
  }

  if (stage === "intro") {
    return <Intro onComplete={enterSite} onSkip={enterSite} />;
  }

  return (
    <SiteShell>
      <Home />
    </SiteShell>
  );
}
