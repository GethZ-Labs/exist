"use client";

import type { CSSProperties } from "react";
import { CONTACT, ROLES, whatsappLink } from "@/lib/site";
import PageHero from "../PageHero";
import SiteShell from "../SiteShell";
import SocialIcon from "../SocialIcon";

export default function CareersPage() {
  const cvLink = whatsappLink(
    "Hi EXiST! I'd like to share my CV. Role I'm interested in: ",
  );

  return (
    <SiteShell>
      <PageHero
        kicker="Careers"
        title="JOIN EXiST"
        lede="We're not hiring right now — but great people are always welcome. Send your CV and we'll reach out when a role opens."
      />

      <section className="careers" data-theme="dark">
        <div className="careers-status" data-reveal>
          <span className="careers-pulse" aria-hidden="true" />
          Applications closed · We&apos;ll reopen soon
        </div>

        <div className="careers-grid">
          {ROLES.map((role, i) => (
            <article
              key={role.title}
              className="role"
              data-reveal
              style={{ "--delay": `${i * 90}ms` } as CSSProperties}
              aria-label={`${role.title} — not hiring right now`}
            >
              <div className="role-content" aria-hidden="true">
                <p className="role-type">{role.type}</p>
                <h3>{role.title}</h3>
                <p>{role.copy}</p>
                <ul>
                  {role.skills.map((skill) => (
                    <li key={skill}>{skill}</li>
                  ))}
                </ul>
              </div>
              <div className="role-lock">
                <span className="role-lock-badge">Not hiring right now</span>
                <span className="role-lock-title">{role.title}</span>
              </div>
            </article>
          ))}
        </div>

        <div className="careers-cta" data-reveal>
          <div>
            <p className="section-label">
              <span className="section-label-dot" /> Send your CV
            </p>
            <h2 className="section-title">
              Drop your CV on <em>WhatsApp</em>.
            </h2>
            <p className="careers-cta-copy">
              Editors, developers and growth people — tell us what you do best and share your CV or
              portfolio. We keep every application on file.
            </p>
          </div>
          <div className="careers-cta-actions">
            <a className="btn btn-lime careers-cta-btn" href={cvLink} target="_blank" rel="noreferrer">
              <SocialIcon name="WhatsApp" /> {CONTACT.whatsappDisplay}
            </a>
            <a className="careers-cta-mail" href={`mailto:${CONTACT.email}?subject=${encodeURIComponent("CV — EXiST")}`}>
              or email <span>{CONTACT.email}</span>
            </a>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
