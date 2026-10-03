"use client";

import { useEffect, type CSSProperties } from "react";
import { PROJECTS, SERVICES } from "@/lib/site";
import Contact from "./Contact";
import Hero from "./Hero";
import Manifesto from "./Manifesto";
import Marquee from "./Marquee";
import Process from "./Process";
import ProjectFolders from "./ProjectFolders";
import ServiceDeck from "./ServiceDeck";
import { TLink } from "./Transition";
import WhoWeAre from "./WhoWeAre";

/* The homepage: a short, cinematic story from "who we help" to "let's build". */
export default function Home() {
  // arriving with a #hash (e.g. /#contact from another page)
  useEffect(() => {
    if (!window.location.hash) return;
    const id = window.setTimeout(() => {
      document.querySelector(window.location.hash)?.scrollIntoView({ behavior: "smooth" });
    }, 350);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <>
      <Hero />
      <div className="marquee-band">
        <Marquee items={SERVICES.map((service) => service.title)} tone="dark" />
      </div>
      <Manifesto />
      <ServiceDeck />
      <Process />

      <section id="projects" className="home-projects" data-theme="dark">
        <div className="home-projects-head">
          <div>
            <div className="section-label" data-reveal>
              <span className="section-label-dot" /> Selected projects
            </div>
            <h2 className="section-title" data-reveal style={{ "--delay": "80ms" } as CSSProperties}>
              Open a folder. <em>See the work.</em>
            </h2>
          </div>
          <TLink href="/projects" className="home-projects-all" data-reveal>
            All projects <span aria-hidden="true">→</span>
          </TLink>
        </div>
        <ProjectFolders projects={PROJECTS.slice(0, 4)} variant="teaser" />
      </section>

      <WhoWeAre />
      <Contact />
    </>
  );
}
