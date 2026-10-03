"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CONTACT, NAV_PAGES, linkTarget } from "@/lib/site";
import { sound } from "@/lib/sound";
import { Logo } from "./BrandMark";
import { Magnetic, useFrame } from "./effects";
import SocialIcon from "./SocialIcon";
import SoundToggle from "./SoundToggle";
import { TLink } from "./Transition";

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [socials, setSocials] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [onLime, setOnLime] = useState(false);
  const lastY = useRef(0);
  const socialsRef = useRef<HTMLDivElement>(null);

  useFrame(() => {
    const y = window.scrollY;
    const delta = y - lastY.current;
    if (Math.abs(delta) > 4) {
      const shouldHide = delta > 0 && y > 240 && !open && !socials;
      setHidden((current) => (current === shouldHide ? current : shouldHide));
      lastY.current = y;
    }
    // swap nav colours over lime sections so it always stays legible
    let lime = false;
    for (const section of document.querySelectorAll<HTMLElement>("[data-theme]")) {
      const rect = section.getBoundingClientRect();
      if (rect.top <= 40 && rect.bottom > 40) {
        lime = section.dataset.theme === "lime";
      }
    }
    setOnLime((current) => (current === lime ? current : lime));
  });

  useEffect(() => {
    document.documentElement.classList.toggle("menu-open", open);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setSocials(false);
      }
    };
    const handleDown = (event: PointerEvent) => {
      if (socialsRef.current && !socialsRef.current.contains(event.target as Node)) {
        setSocials(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("pointerdown", handleDown);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("pointerdown", handleDown);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setSocials(false);
  };

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <header
        className={`site-nav ${hidden ? "is-hidden" : ""} ${onLime && !open ? "on-lime" : ""}`}
      >
        <TLink href="/" className="nav-logo" aria-label="EXiST home" onNavigate={close}>
          <Logo />
        </TLink>

        <nav className="nav-links" aria-label="Main">
          {NAV_PAGES.map((page) => (
            <TLink
              key={page.href}
              href={page.href}
              className={isActive(page.href) ? "is-active" : ""}
              aria-current={isActive(page.href) ? "page" : undefined}
              onNavigate={close}
            >
              <span data-text={page.label}>{page.label}</span>
            </TLink>
          ))}
          <div ref={socialsRef} className={`nav-socials ${socials ? "is-open" : ""}`}>
            <button
              type="button"
              className="nav-socials-toggle"
              aria-expanded={socials}
              aria-haspopup="true"
              onClick={() => {
                sound.ui.tick();
                setSocials((value) => !value);
              }}
            >
              <span data-text="Socials">Socials</span>
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M3 4.5 6 7.5 9 4.5" />
              </svg>
            </button>
            <div className="nav-socials-panel" role="menu">
              {CONTACT.socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  {...linkTarget(social.href)}
                  role="menuitem"
                  tabIndex={socials ? 0 : -1}
                  onClick={() => setSocials(false)}
                >
                  <SocialIcon name={social.label} />
                  <span className="nav-socials-name">{social.label}</span>
                  <span className="nav-socials-handle">{social.handle}</span>
                  <span className="nav-socials-arrow" aria-hidden="true">
                    ↗
                  </span>
                </a>
              ))}
            </div>
          </div>
        </nav>

        <div className="nav-right">
          <SoundToggle className="nav-sound" />
          <Magnetic className="nav-cta-wrap">
            <TLink href="/#contact" className="btn btn-small nav-cta" onNavigate={close}>
              Let&apos;s talk
            </TLink>
          </Magnetic>

          <button
            type="button"
            className={`menu-toggle ${open ? "is-open" : ""}`}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => {
              sound.ui.tick();
              setOpen((value) => !value);
            }}
          >
            <span />
            <span />
          </button>
        </div>
      </header>

      <div id="mobile-menu" className={`mobile-menu ${open ? "is-open" : ""}`} aria-hidden={!open}>
        <nav aria-label="Mobile">
          {NAV_PAGES.map((page, index) => (
            <TLink
              key={page.href}
              href={page.href}
              tabIndex={open ? 0 : -1}
              className={isActive(page.href) ? "is-active" : ""}
              style={{ transitionDelay: open ? `${120 + index * 60}ms` : "0ms" }}
              onNavigate={close}
            >
              <span className="mobile-menu-index">0{index + 1}</span>
              {page.label}
            </TLink>
          ))}
        </nav>
        <div className="mobile-menu-socials" style={{ transitionDelay: open ? "420ms" : "0ms" }}>
          <p>Socials</p>
          <div>
            {CONTACT.socials.map((social) => (
              <a
                key={social.label}
                href={social.href}
                {...linkTarget(social.href)}
                tabIndex={open ? 0 : -1}
                aria-label={social.label}
              >
                <SocialIcon name={social.label} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
