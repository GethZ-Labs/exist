"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { whatsappLink, type Project } from "@/lib/site";
import { sound } from "@/lib/sound";
import { useLenis } from "./effects";

/*
  Project folders. Hover: the folder lifts and the work peeks out.
  Click: the folder flies to centre stage, the lid swings open and every
  poster / screenshot flies out of it into the gallery (FLIP animation).
*/

type FolderProps = {
  project: Project;
  index: number;
  isOpen: boolean;
  onOpen: (project: Project, el: HTMLButtonElement) => void;
};

function FolderVisual({ project }: { project: Project }) {
  const papers = project.media.slice(0, 3);
  return (
    <>
      <span className="folder-shadow" />
      <span className="folder-back">
        <span className="folder-tab">{project.index}</span>
      </span>
      <span className="folder-papers">
        {papers.map((media, i) => (
          <span key={media.src} className={`folder-paper folder-paper-${i}`}>
            <Image src={media.src} alt="" fill sizes="240px" />
          </span>
        ))}
      </span>
      <span className="folder-front">
        <span className="folder-front-meta">
          <span>{project.index}</span>
          <span>{project.category}</span>
        </span>
        <span className="folder-front-title">{project.title}</span>
        <span className="folder-front-kind">{project.kind}</span>
        <span className="folder-front-cta">
          Open folder <span aria-hidden="true">↗</span>
        </span>
      </span>
    </>
  );
}

function FolderCard({ project, index, isOpen, onOpen }: FolderProps) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={ref}
      type="button"
      className="folder"
      data-open={isOpen || undefined}
      style={{ "--i": index } as CSSProperties}
      data-cursor="Open"
      data-reveal
      aria-label={`Open project: ${project.title} — ${project.kind}`}
      onClick={() => ref.current && onOpen(project, ref.current)}
    >
      <FolderVisual project={project} />
    </button>
  );
}

const SPRING = "cubic-bezier(0.2, 1.15, 0.3, 1)";
const EASE = "cubic-bezier(0.7, 0, 0.2, 1)";

function ProjectModal({
  project,
  originEl,
  onClosed,
}: {
  project: Project;
  originEl: HTMLElement;
  onClosed: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const flyerRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const timers = useRef<number[]>([]);
  const [phase, setPhase] = useState<"in" | "open" | "ready" | "out">("in");
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [entered, setEntered] = useState(false);
  const [lidOpen, setLidOpen] = useState(false);
  const [flyerGone, setFlyerGone] = useState(false);
  const lenisRef = useLenis();
  const origin = useRef<DOMRect | null>(null);

  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  const flyerTarget = () => {
    const o = origin.current!;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const width = Math.min(W * 0.78, 560, (H * 0.5) / (o.height / o.width));
    const scale = width / o.width;
    const tx = W / 2 - (o.left + o.width / 2);
    const ty = H * 0.52 - (o.top + o.height / 2);
    return { tx, ty, scale };
  };

  const items = () => [...(galleryRef.current?.querySelectorAll<HTMLElement>(".pm-item") ?? [])];

  /* Opening sequence */
  useLayoutEffect(() => {
    const flyer = flyerRef.current;
    if (!flyer) return;
    origin.current = originEl.getBoundingClientRect();
    const o = origin.current;
    Object.assign(flyer.style, {
      left: `${o.left}px`,
      top: `${o.top}px`,
      width: `${o.width}px`,
      height: `${o.height}px`,
    });
    items().forEach((item) => {
      item.style.opacity = "0";
    });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lenis = lenisRef?.current;
    lenis?.stop();
    document.documentElement.classList.add("modal-open");
    sound.ui.folderOpen();

    requestAnimationFrame(() => {
      const { tx, ty, scale } = flyerTarget();
      flyer.style.transition = `transform ${reduced ? 1 : 620}ms ${EASE}`;
      flyer.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
      setEntered(true);
    });

    later(reduced ? 10 : 520, () => {
      setPhase("open");
      setLidOpen(true);
    });
    later(reduced ? 20 : 820, () => {
      // papers fly out of the folder into the gallery
      const f = flyer.getBoundingClientRect();
      const fx = f.left + f.width / 2;
      const fy = f.top + f.height * 0.45;
      items().forEach((item, i) => {
        const r = item.getBoundingClientRect();
        const dx = fx - (r.left + r.width / 2);
        const dy = fy - (r.top + r.height / 2);
        const s = Math.min(0.32, (f.width * 0.5) / r.width);
        const rot = (i % 2 === 0 ? -1 : 1) * (8 + (i % 3) * 4);
        item.style.transition = "none";
        item.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${s}) rotate(${rot}deg)`;
        item.style.opacity = "0";
        void item.offsetWidth;
        item.style.transition = `transform 880ms ${SPRING} ${i * 85}ms, opacity 260ms linear ${i * 85}ms`;
        item.style.transform = "none";
        item.style.opacity = "1";
      });
      setPhase("ready");
    });
    later(reduced ? 30 : 1300, () => setFlyerGone(true));
    later(reduced ? 40 : 1500, () => closeRef.current?.focus({ preventScroll: true }));

    const list = timers.current;
    return () => {
      list.forEach((id) => window.clearTimeout(id));
      lenis?.start();
      document.documentElement.classList.remove("modal-open");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Closing sequence (reverse) */
  const close = useCallback(() => {
    if (phase === "out") return;
    const flyer = flyerRef.current;
    const root = rootRef.current;
    if (!flyer || !root) return;
    setPhase("out");
    setLightbox(null);
    sound.ui.folderClose();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setFlyerGone(false);
    const f = flyer.getBoundingClientRect();
    const fx = f.left + f.width / 2;
    const fy = f.top + f.height * 0.45;
    items().forEach((item, i, all) => {
      const r = item.getBoundingClientRect();
      const dx = fx - (r.left + r.width / 2);
      const dy = fy - (r.top + r.height / 2);
      const s = Math.min(0.3, (f.width * 0.5) / r.width);
      const delay = (all.length - 1 - i) * 45;
      item.style.transition = `transform 460ms ${EASE} ${delay}ms, opacity 200ms linear ${delay + 260}ms`;
      item.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${s}) rotate(${i % 2 ? 6 : -6}deg)`;
      item.style.opacity = "0";
    });
    const base = reduced ? 0 : 560;
    later(base, () => setLidOpen(false));
    later(reduced ? 0 : 860, () => {
      // fly home to the card's current position
      const now = originEl.getBoundingClientRect();
      const o = origin.current!;
      flyer.style.transition = `transform ${reduced ? 1 : 520}ms ${EASE}`;
      flyer.style.transform = `translate3d(${now.left - o.left}px, ${now.top - o.top}px, 0) scale(${now.width / o.width})`;
      setEntered(false);
    });
    later(reduced ? 40 : 1420, onClosed);
  }, [onClosed, originEl, phase]);

  // lightbox: a pop when it opens, a tick per step
  const shownRef = useRef<number | null>(null);
  useEffect(() => {
    if (lightbox !== null) {
      if (shownRef.current === null) sound.ui.pop();
      else sound.ui.tick();
    }
    shownRef.current = lightbox;
  }, [lightbox]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (lightbox !== null) setLightbox(null);
        else close();
      }
      if (lightbox !== null && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
        const n = project.media.length;
        setLightbox((i) => ((i ?? 0) + (event.key === "ArrowRight" ? 1 : n - 1)) % n);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, lightbox, project.media.length]);

  const flyerClass = `pm-flyer folder ${lidOpen ? "is-open" : ""} ${flyerGone ? "is-gone" : ""}`;
  const shape = (w: number, h: number) => {
    const ratio = w / h;
    if (h / w > 2.6) return "is-page";
    if (ratio > 1.3) return "is-wide";
    if (ratio < 0.8) return "is-tall";
    return "is-square";
  };

  return createPortal(
    <div
      ref={rootRef}
      className={`pm pm-${phase} ${entered ? "is-in" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`pm-title-${project.id}`}
    >
      <div className="pm-backdrop" onClick={close} />
      <div ref={flyerRef} className={flyerClass} aria-hidden="true">
        <FolderVisual project={project} />
      </div>

      <div
        className="pm-scroll"
        data-lenis-prevent
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (target.matches(".pm-scroll, .pm-layout, .pm-gallery")) close();
        }}
      >
        <div className="pm-layout">
          <div className="pm-details">
            <p className="pm-kicker">
              <span className="pm-index">{project.index}</span> {project.category} · {project.year}
            </p>
            <h2 id={`pm-title-${project.id}`} className="pm-title">
              {project.title}
            </h2>
            <p className="pm-kind">{project.kind}</p>
            <p className="pm-summary">{project.summary}</p>
            <ul className="pm-tags">
              {project.deliverables.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="pm-actions">
              {project.url && (
                <a className="btn btn-lime" href={project.url} target="_blank" rel="noreferrer">
                  Visit live site <span aria-hidden="true">↗</span>
                </a>
              )}
              <a
                className="btn pm-btn-ghost"
                href={whatsappLink(`Hi EXiST! I saw ${project.title} and I'd like something similar.`)}
                target="_blank"
                rel="noreferrer"
              >
                Start something similar
              </a>
            </div>
            {project.urlLabel && <p className="pm-url">{project.urlLabel}</p>}
            <button type="button" className="pm-back" onClick={close}>
              <span aria-hidden="true">←</span> Back to all projects
            </button>
          </div>

          <div ref={galleryRef} className="pm-gallery">
            {project.media.map((media, i) => (
              <button
                key={media.src}
                type="button"
                className={`pm-item ${shape(media.width, media.height)}`}
                style={{ "--ar": `${media.width} / ${media.height}` } as CSSProperties}
                onClick={() => setLightbox(i)}
                data-cursor="View"
                aria-label={`View ${media.alt}`}
              >
                <Image src={media.src} alt={media.alt} fill sizes="(max-width: 760px) 90vw, 40vw" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <button ref={closeRef} type="button" className="pm-close" onClick={close}>
        Close <span aria-hidden="true">✕</span>
      </button>

      {lightbox !== null && (
        <div className="pm-lightbox" onClick={() => setLightbox(null)}>
          <div className="pm-lightbox-frame" onClick={(event) => event.stopPropagation()}>
            <Image
              src={project.media[lightbox].src}
              alt={project.media[lightbox].alt}
              fill
              sizes="100vw"
              priority
            />
          </div>
          {project.media.length > 1 && (
            <div className="pm-lightbox-nav" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                aria-label="Previous"
                onClick={() =>
                  setLightbox((i) => ((i ?? 0) + project.media.length - 1) % project.media.length)
                }
              >
                ←
              </button>
              <span>
                {lightbox + 1} / {project.media.length}
              </span>
              <button
                type="button"
                aria-label="Next"
                onClick={() => setLightbox((i) => ((i ?? 0) + 1) % project.media.length)}
              >
                →
              </button>
            </div>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}

export default function ProjectFolders({
  projects,
  variant = "full",
}: {
  projects: Project[];
  variant?: "full" | "teaser";
}) {
  const [open, setOpen] = useState<{ project: Project; el: HTMLElement } | null>(null);

  return (
    <>
      <div className={`folders folders-${variant}`}>
        {projects.map((project, index) => (
          <FolderCard
            key={project.id}
            project={project}
            index={index}
            isOpen={open?.project.id === project.id}
            onOpen={(p, el) => setOpen({ project: p, el })}
          />
        ))}
      </div>
      {open && <ProjectModal project={open.project} originEl={open.el} onClosed={() => setOpen(null)} />}
    </>
  );
}
