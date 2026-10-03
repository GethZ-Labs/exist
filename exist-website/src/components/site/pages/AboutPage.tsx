"use client";

import type { CSSProperties } from "react";
import { SERVICES, whatsappLink } from "@/lib/site";
import { LoopMark } from "../BrandMark";
import LiquidLoop from "../LiquidLoop";
import PageHero from "../PageHero";
import Promises from "../Promises";
import SiteShell from "../SiteShell";
import { TLink } from "../Transition";

const CHAPTERS = [
  {
    no: "01",
    title: "Why we exist",
    copy: "Too many great Sri Lankan businesses look small online. We give them the websites, brands and systems of industry leaders — without the industry-leader price tag.",
  },
  {
    no: "02",
    title: "How we work",
    copy: "One team for strategy, design, development and growth. You get a single partner who understands your brand from the logo to the code — and replies fast.",
  },
  {
    no: "03",
    title: "Where we're going",
    copy: "From Sri Lanka to the world: building digital products that help businesses rebuild, evolve and lead in their markets.",
  },
];

const PRICE_POINTS = [
  {
    no: "01",
    title: "Flexible packages",
    copy: "Shaped around your budget and goals — start small and grow with us.",
  },
  {
    no: "02",
    title: "Honest, reliable quotes",
    copy: "A clear price before we begin, and no surprises along the way.",
  },
  {
    no: "03",
    title: "Premium at every budget",
    copy: "Whatever you invest, you get our full craft, care and creativity.",
  },
];

const TICKER = ["Premium work", "Fair prices", "Flexible packages", "Built with passion"];

export default function AboutPage() {
  return (
    <SiteShell>
      <PageHero
        kicker="About EXiST"
        title="WE ARE EXiST"
        lede="Excellence IT Solutions — premium websites, apps, brands and growth, at prices that fit your business."
      />

      <section className="about-story" data-theme="dark">
        {CHAPTERS.map((chapter, i) => (
          <article
            key={chapter.no}
            className="about-chapter"
            data-reveal
            style={{ "--delay": `${i * 90}ms` } as CSSProperties}
          >
            <span className="about-chapter-no">{chapter.no}</span>
            <h2>{chapter.title}</h2>
            <p>{chapter.copy}</p>
          </article>
        ))}
      </section>

      <section className="price" data-theme="lime" aria-labelledby="price-title">
        <LoopMark className="price-loop" strokeWidth={60} />
        <div className="price-grid">
          <div className="price-copy">
            <p className="section-label section-label-dark" data-reveal>
              <span className="section-label-dot" /> Honest pricing
            </p>
            <h2 id="price-title" className="price-title" data-reveal>
              Premium work.
              <span>Prices that fit.</span>
            </h2>
            <p className="price-story" data-reveal>
              Creating for our clients is our passion, not just our business. So we never let price
              stand between a good business and a great brand: our work is built to the highest
              standard, and our prices stay flexible, fair and reliable for every customer.
            </p>
            <div className="price-actions" data-reveal>
              <a
                className="btn btn-dark"
                href={whatsappLink("Hi EXiST! I'd like a quote for my project.")}
                target="_blank"
                rel="noreferrer"
              >
                Get your quote on WhatsApp <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
          <ul className="price-points">
            {PRICE_POINTS.map((point, i) => (
              <li
                key={point.no}
                className="price-point"
                data-reveal
                style={{ "--delay": `${120 + i * 90}ms` } as CSSProperties}
              >
                <span className="price-point-no">{point.no}</span>
                <h3>{point.title}</h3>
                <p>{point.copy}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="price-ticker" aria-hidden="true">
          <div className="price-ticker-track">
            {[0, 1].map((copy) => (
              <span key={copy} className="price-ticker-group">
                {TICKER.map((word) => (
                  <span key={word}>
                    {word} <i>✦</i>{" "}
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="about-loop" data-theme="dark">
        <div className="about-loop-visual" data-reveal>
          <div className="who-orb who-orb-a" aria-hidden="true" />
          <div className="who-orb who-orb-b" aria-hidden="true" />
          <LiquidLoop />
        </div>
        <div className="about-loop-copy">
          <p className="section-label" data-reveal>
            <span className="section-label-dot" /> Rebuild · Evolve · Lead
          </p>
          <h2 className="section-title" data-reveal style={{ "--delay": "80ms" } as CSSProperties}>
            Born in Sri Lanka. <em>Built for the world.</em>
          </h2>
          <p data-reveal style={{ "--delay": "160ms" } as CSSProperties}>
            Our loop is a single line that never breaks — the way we work with you: one continuous
            thread from the first idea to the day your business outgrows its old self.
          </p>
        </div>
      </section>

      <Promises />

      <section className="about-services" data-theme="dark">
        <p className="section-label" data-reveal>
          <span className="section-label-dot" /> What we do
        </p>
        <div className="about-services-grid">
          {SERVICES.map((service, i) => (
            <div
              key={service.id}
              className="about-service"
              data-reveal
              style={{ "--delay": `${i * 70}ms` } as CSSProperties}
            >
              <span className="about-service-symbol">{service.symbol}</span>
              <h3>{service.title}</h3>
              <p>{service.summary}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-band" data-theme="dark">
        <div className="cta-band-glass" data-reveal>
          <p className="section-label">
            <span className="section-label-dot" /> Next step
          </p>
          <h2 className="section-title">
            Let&apos;s build first. <em>Thank later.</em>
          </h2>
          <div className="cta-band-actions">
            <a
              className="btn btn-lime"
              href={whatsappLink("Hi EXiST! I'd like to start a project.")}
              target="_blank"
              rel="noreferrer"
            >
              Chat on WhatsApp <span aria-hidden="true">↗</span>
            </a>
            <TLink href="/projects" className="btn pm-btn-ghost">
              See our projects
            </TLink>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
