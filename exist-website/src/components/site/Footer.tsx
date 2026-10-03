"use client";

import { usePathname, useRouter } from "next/navigation";
import { CONTACT, NAV_PAGES, whatsappLink } from "@/lib/site";
import { LoopMark } from "./BrandMark";
import SocialIcon from "./SocialIcon";
import { TLink } from "./Transition";

export default function Footer() {
  const router = useRouter();
  const pathname = usePathname();
  const replayIntro = () => {
    try {
      sessionStorage.removeItem("exist-intro-done");
    } catch {}
    if (pathname === "/") window.dispatchEvent(new Event("exist:replay-intro"));
    else router.push("/?intro=1");
  };

  return (
    <footer className="footer" data-theme="dark">
      <div className="footer-top">
        <p className="footer-tagline">
          We build digital solutions that help your business <em>exist better.</em>
        </p>

        <div className="footer-columns">
          <div>
            <h4>Explore</h4>
            {NAV_PAGES.map((page) => (
              <TLink key={page.href} href={page.href}>
                {page.label}
              </TLink>
            ))}
          </div>
          <div>
            <h4>Socials</h4>
            {CONTACT.socials
              .filter((social) => social.label !== "Email")
              .map((social) => (
                <a key={social.label} href={social.href} target="_blank" rel="noreferrer">
                  <SocialIcon name={social.label} /> {social.label}
                </a>
              ))}
          </div>
          <div>
            <h4>Say hello</h4>
            <a href={whatsappLink("Hi EXiST! I'd like to talk about a project.")} target="_blank" rel="noreferrer">
              {CONTACT.whatsappDisplay}
            </a>
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
            <button type="button" className="footer-replay" onClick={replayIntro}>
              ↺ Replay the intro
            </button>
          </div>
        </div>
      </div>

      <div className="footer-giant" aria-hidden="true">
        <LoopMark className="footer-loop" />
        <span className="footer-word">
          EX<span className="wordmark-i">ı</span>ST
        </span>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} EXiST · Excellence IT Solutions</span>
        <span>#EXiST-BETTER</span>
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="footer-top-link"
          data-cursor="Up"
        >
          Back to top ↑
        </button>
      </div>
    </footer>
  );
}
