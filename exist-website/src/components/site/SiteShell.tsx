"use client";

import type { ReactNode } from "react";
import { Cursor, ScrollProgress, SmoothScroll, useRevealObserver } from "./effects";
import Footer from "./Footer";
import Nav from "./Nav";

function Reveals() {
  useRevealObserver();
  return null;
}

/* Shared chrome for every page: smooth scroll, cursor, grain, nav, footer. */
export default function SiteShell({ children }: { children: ReactNode }) {
  return (
    <SmoothScroll>
      <div className="site-root">
        <ScrollProgress />
        <Cursor />
        <div className="grain" aria-hidden="true" />
        <Nav />
        <main className="site">{children}</main>
        <Footer />
        <Reveals />
      </div>
    </SmoothScroll>
  );
}
