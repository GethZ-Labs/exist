"use client";

import type { CSSProperties } from "react";
import { PROJECTS, whatsappLink } from "@/lib/site";
import PageHero from "../PageHero";
import ProjectFolders from "../ProjectFolders";
import SiteShell from "../SiteShell";

export default function ProjectsPage() {
  return (
    <SiteShell>
      <PageHero
        kicker="Selected work"
        title="PROJECTS"
        lede="Websites, campaigns and identities we've designed and built. Tap a folder to open it."
      />
      <section className="projects-page" data-theme="dark">
        <ProjectFolders projects={PROJECTS} />
      </section>
      <section className="cta-band" data-theme="dark">
        <div className="cta-band-glass" data-reveal>
          <p className="section-label">
            <span className="section-label-dot" /> Your brand could be next
          </p>
          <h2 className="section-title" style={{ "--delay": "80ms" } as CSSProperties}>
            Let&apos;s build <em>your</em> folder.
          </h2>
          <a
            className="btn btn-lime"
            href={whatsappLink("Hi EXiST! I'd like to start a project.")}
            target="_blank"
            rel="noreferrer"
          >
            Start a project on WhatsApp <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>
    </SiteShell>
  );
}
