"use client";

import { useEffect, useRef, type RefObject } from "react";

/*
  Scroll-scrubbed vector film for the Plan → Create → Grow section:
  a website is drafted as a blueprint, brought to life, then connected
  to every channel it grows through. Drawn on canvas, crisp at any DPR.
*/

const LIME = "#dbfe01";
const PAPER = "#f1f4e6";
const INK = "#050604";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const ease = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const lime = (a: number) => `rgba(219, 254, 1, ${a})`;
const paper = (a: number) => `rgba(241, 244, 230, ${a})`;

type Fonts = { display: string; mono: string; body: string };

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/* Strokes the current path only up to `t` of its length (draw-on effect). */
function strokePartial(
  ctx: CanvasRenderingContext2D,
  length: number,
  t: number,
) {
  if (t <= 0) return;
  ctx.setLineDash([length * t, length + 1]);
  ctx.stroke();
  ctx.setLineDash([]);
}

const CODE = [
  ["const ", "brand", " = await ", "exist", ".build({"],
  ["  design: ", '"unique"', ","],
  ["  speed: ", '"3–5 days"', ","],
  ["  seo: ", "true", ","],
  ["});"],
  [""],
  ["brand", ".launch();"],
  ["brand", ".grow();"],
];

const NODES = [
  { symbol: "</>", label: "Websites", ax: -0.62, ay: -0.42 },
  { symbol: "◐", label: "Design", ax: -0.7, ay: 0.18 },
  { symbol: "@", label: "Social", ax: -0.42, ay: 0.76 },
  { symbol: "#", label: "SEO", ax: 0.62, ay: -0.52 },
  { symbol: "$", label: "Systems", ax: 0.16, ay: 0.82 },
];

export default function BuildStory({
  progressRef,
  className = "",
}: {
  progressRef: RefObject<number>;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let W = 1;
    let H = 1;
    let dpr = 1;
    let raf = 0;
    let visible = true;
    let eased = 0;
    let last = performance.now();
    const fonts: Fonts = {
      display: "sans-serif",
      mono: "monospace",
      body: "sans-serif",
    };

    const readFonts = () => {
      const style = getComputedStyle(document.documentElement);
      fonts.display =
        style.getPropertyValue("--font-display").trim() || "sans-serif";
      fonts.mono = style.getPropertyValue("--font-mono").trim() || "monospace";
      fonts.body = style.getPropertyValue("--font-body").trim() || "sans-serif";
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, rect.width);
      H = Math.max(1, rect.height);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    };

    const observer = new IntersectionObserver(
      ([entry]) => (visible = entry.isIntersecting),
      {
        rootMargin: "100px",
      },
    );
    observer.observe(canvas);
    readFonts();
    document.fonts?.ready.then(readFonts);
    resize();
    window.addEventListener("resize", resize);

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible) return;
      eased += ((progressRef.current ?? 0) - eased) * (1 - Math.exp(-dt * 8));
      const p = eased;
      const time = now / 1000;
      const mobile = W < 900;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      /* ---------- layout ---------- */
      const growK = ease(seg(p, 0.66, 0.76));
      const baseW = mobile ? W * 0.86 : Math.min(W * 0.46, 720);
      const scale = 1 - growK * 0.2;
      const bw = baseW * scale;
      const bh = bw * 0.64;
      const cx = mobile ? W / 2 : W * (0.7 - growK * 0.05);
      const cy = mobile ? H * 0.34 : H * 0.52;
      const bx = cx - bw / 2;
      const by = cy - bh / 2;
      const r = 14 * scale;
      const u = bw / 720; // unit: scales detail with the browser

      /* ---------- blueprint grid ---------- */
      const gridK =
        ease(seg(p, 0.0, 0.08)) * (1 - 0.7 * ease(seg(p, 0.36, 0.5)));
      if (gridK > 0.001) {
        ctx.lineWidth = 1;
        const step = 32;
        ctx.strokeStyle = lime(0.05 * gridK);
        ctx.beginPath();
        for (let x = (W / 2) % step; x < W; x += step) {
          ctx.moveTo(Math.round(x) + 0.5, 0);
          ctx.lineTo(Math.round(x) + 0.5, H);
        }
        for (let y = (H / 2) % step; y < H; y += step) {
          ctx.moveTo(0, Math.round(y) + 0.5);
          ctx.lineTo(W, Math.round(y) + 0.5);
        }
        ctx.stroke();
        ctx.strokeStyle = lime(0.1 * gridK);
        ctx.beginPath();
        for (let x = (W / 2) % (step * 4); x < W; x += step * 4) {
          ctx.moveTo(Math.round(x) + 0.5, 0);
          ctx.lineTo(Math.round(x) + 0.5, H);
        }
        for (let y = (H / 2) % (step * 4); y < H; y += step * 4) {
          ctx.moveTo(0, Math.round(y) + 0.5);
          ctx.lineTo(W, Math.round(y) + 0.5);
        }
        ctx.stroke();
      }

      /* ---------- GROW: channel network behind the browser ---------- */
      const netK = ease(seg(p, 0.7, 0.82));
      if (netK > 0.001) {
        NODES.forEach((node, i) => {
          const k = ease(seg(p, 0.7 + i * 0.02, 0.8 + i * 0.02));
          if (k <= 0) return;
          const reach = mobile ? 0.62 : 1;
          const nx = cx + node.ax * bw * 0.92 * reach;
          const ny = cy + node.ay * bh * (mobile ? 1.15 : 1.2);
          const tx = cx + node.ax * bw * 0.32;
          const ty = cy + node.ay * bh * 0.32;
          const mx = (nx + tx) / 2;
          const my = Math.min(ny, ty) - 40 * u;
          // connection
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = lime(0.5 * k);
          ctx.beginPath();
          ctx.moveTo(nx, ny);
          ctx.quadraticCurveTo(mx, my, tx, ty);
          strokePartial(ctx, 900, k);
          // traffic pulses flowing into the brand
          for (let j = 0; j < 3; j++) {
            const t = (time * 0.45 + j / 3 + i * 0.13) % 1;
            const a = 1 - t;
            const px = a * a * nx + 2 * a * t * mx + t * t * tx;
            const py = a * a * ny + 2 * a * t * my + t * t * ty;
            const glow = ctx.createRadialGradient(
              px,
              py,
              0,
              px,
              py,
              10 * u + 4,
            );
            glow.addColorStop(0, lime(0.9 * k));
            glow.addColorStop(1, lime(0));
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(px, py, 10 * u + 4, 0, Math.PI * 2);
            ctx.fill();
          }
          // node
          const nr = 26 * Math.max(0.75, u) * easeOut(k);
          ctx.fillStyle = "rgba(14, 16, 11, 0.95)";
          ctx.beginPath();
          ctx.arc(nx, ny, nr, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = lime(0.85 * k);
          ctx.stroke();
          ctx.fillStyle = lime(k);
          ctx.font = `600 ${Math.round(13 * Math.max(0.8, u))}px ${fonts.mono}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(node.symbol, nx, ny + 1);
          ctx.fillStyle = paper(0.7 * k);
          ctx.font = `500 ${Math.round(10 * Math.max(0.85, u))}px ${fonts.mono}`;
          ctx.fillText(node.label.toUpperCase(), nx, ny + nr + 14);
        });
      }

      /* ---------- browser frame ---------- */
      const frameK = ease(seg(p, 0.03, 0.15));
      const lifeK = ease(seg(p, 0.36, 0.46));
      if (frameK > 0.001) {
        ctx.save();
        // body
        if (lifeK > 0) {
          ctx.shadowColor = "rgba(0,0,0,0.6)";
          ctx.shadowBlur = 50 * lifeK;
          ctx.shadowOffsetY = 24 * lifeK;
          roundRect(ctx, bx, by, bw, bh, r);
          ctx.fillStyle = `rgba(11, 12, 8, ${0.96 * lifeK})`;
          ctx.fill();
          ctx.shadowColor = "transparent";
        }
        roundRect(ctx, bx, by, bw, bh, r);
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = lifeK > 0.5 ? paper(0.16) : lime(0.85);
        strokePartial(ctx, (bw + bh) * 2, frameK);
        // top bar
        const barK = ease(seg(p, 0.1, 0.17));
        const barH = 34 * u;
        if (barK > 0) {
          ctx.globalAlpha = barK;
          ctx.strokeStyle = lifeK > 0.5 ? paper(0.12) : lime(0.6);
          ctx.beginPath();
          ctx.moveTo(bx, by + barH);
          ctx.lineTo(bx + bw, by + barH);
          ctx.stroke();
          ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => {
            ctx.beginPath();
            ctx.arc(
              bx + 18 * u + i * 16 * u,
              by + barH / 2,
              4.5 * u,
              0,
              Math.PI * 2,
            );
            if (lifeK > 0.3) {
              ctx.fillStyle = c;
              ctx.globalAlpha = barK * lifeK;
              ctx.fill();
              ctx.globalAlpha = barK;
            } else {
              ctx.strokeStyle = lime(0.6);
              ctx.stroke();
            }
          });
          roundRect(
            ctx,
            bx + bw * 0.3,
            by + barH * 0.22,
            bw * 0.4,
            barH * 0.56,
            barH * 0.28,
          );
          ctx.strokeStyle = lifeK > 0.5 ? paper(0.12) : lime(0.4);
          ctx.stroke();
          ctx.fillStyle = paper(0.55);
          ctx.font = `500 ${Math.round(10 * Math.max(0.8, u))}px ${fonts.mono}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("yourbrand.com", bx + bw / 2, by + barH / 2 + 0.5);
          ctx.globalAlpha = 1;
        }

        // page regions (shared by wireframe and finished UI)
        const pad = 26 * u;
        const top = by + barH;
        const navY = top + 16 * u;
        const heroX = bx + pad;
        const heroY = top + 44 * u;
        const heroW = bw - pad * 2;
        const heroH = bh * 0.42;
        const cardsY = heroY + heroH + 18 * u;
        const cardW = (heroW - 2 * 14 * u) / 3;
        const cardH = by + bh - cardsY - 22 * u;

        ctx.save();
        roundRect(ctx, bx, by, bw, bh, r);
        ctx.clip();

        /* wireframe (PLAN) */
        const wire = 1 - ease(seg(p, 0.4, 0.5));
        if (wire > 0.001) {
          ctx.lineWidth = 1;
          ctx.strokeStyle = lime(0.7 * wire);
          // nav
          const navK = ease(seg(p, 0.14, 0.19));
          ctx.beginPath();
          ctx.moveTo(heroX, navY);
          ctx.lineTo(heroX + 70 * u, navY);
          strokePartial(ctx, 70 * u, navK);
          for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(bx + bw - pad - (4 - i) * 48 * u, navY);
            ctx.lineTo(bx + bw - pad - (4 - i) * 48 * u + 32 * u, navY);
            strokePartial(ctx, 32 * u, navK);
          }
          // hero placeholder with cross
          const heroK = ease(seg(p, 0.16, 0.23));
          roundRect(ctx, heroX, heroY, heroW, heroH, 10 * u);
          strokePartial(ctx, (heroW + heroH) * 2, heroK);
          ctx.beginPath();
          ctx.moveTo(heroX + heroW * 0.55, heroY);
          ctx.lineTo(heroX + heroW, heroY + heroH);
          ctx.moveTo(heroX + heroW, heroY);
          ctx.lineTo(heroX + heroW * 0.55, heroY + heroH);
          strokePartial(ctx, heroW * 2, ease(seg(p, 0.2, 0.25)));
          // headline + copy bars
          const textK = ease(seg(p, 0.2, 0.27));
          [0.36, 0.28, 0.2, 0.24].forEach((w, i) => {
            ctx.beginPath();
            const y =
              heroY +
              30 * u +
              i * (i < 2 ? 22 : 14) * u +
              (i >= 2 ? 16 * u : 0);
            ctx.moveTo(heroX + 22 * u, y);
            ctx.lineTo(heroX + 22 * u + heroW * w, y);
            ctx.lineWidth = i < 2 ? 3 : 1;
            strokePartial(ctx, heroW * w, textK);
          });
          ctx.lineWidth = 1;
          roundRect(
            ctx,
            heroX + 22 * u,
            heroY + heroH - 46 * u,
            110 * u,
            28 * u,
            14 * u,
          );
          strokePartial(ctx, 280 * u, ease(seg(p, 0.23, 0.28)));
          // cards
          for (let i = 0; i < 3; i++) {
            roundRect(
              ctx,
              heroX + i * (cardW + 14 * u),
              cardsY,
              cardW,
              cardH,
              8 * u,
            );
            strokePartial(
              ctx,
              (cardW + cardH) * 2,
              ease(seg(p, 0.25 + i * 0.02, 0.31 + i * 0.02)),
            );
          }
          // 12-column grid overlay
          const colsK = ease(seg(p, 0.2, 0.27)) * (1 - ease(seg(p, 0.33, 0.4)));
          if (colsK > 0) {
            const colW = heroW / 12;
            ctx.fillStyle = lime(0.05 * colsK);
            for (let i = 0; i < 12; i += 2) {
              ctx.fillRect(heroX + i * colW, top, colW, bh - barH);
            }
          }
          // scan line
          const scan = seg(p, 0.1, 0.34);
          if (scan > 0 && scan < 1) {
            const sy = top + (bh - barH) * scan;
            const g = ctx.createLinearGradient(0, sy - 24 * u, 0, sy);
            g.addColorStop(0, lime(0));
            g.addColorStop(1, lime(0.22 * wire));
            ctx.fillStyle = g;
            ctx.fillRect(bx, sy - 24 * u, bw, 24 * u);
            ctx.fillStyle = lime(0.9 * wire);
            ctx.fillRect(bx, sy, bw, 1.2);
          }
        }

        /* finished UI (CREATE) */
        if (lifeK > 0.001) {
          ctx.globalAlpha = lifeK;
          // nav
          ctx.fillStyle = PAPER;
          ctx.font = `400 ${Math.round(14 * u)}px ${fonts.display}`;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText("YOUR BRAND", heroX, navY);
          ctx.fillStyle = paper(0.5);
          ctx.font = `500 ${Math.max(8, Math.round(9 * u))}px ${fonts.mono}`;
          if (mobile) {
            ctx.textAlign = "right";
            ctx.fillText("MENU  ≡", bx + bw - pad, navY);
            ctx.textAlign = "left";
          } else {
            ["WORK", "ABOUT", "SHOP", "CONTACT"].forEach((item, i) => {
              ctx.fillText(item, bx + bw - pad - (4 - i) * 48 * u, navY);
            });
          }
          ctx.globalAlpha = 1;

          // hero image: lime light + loop of rings
          const heroFill = ease(seg(p, 0.38, 0.46));
          ctx.save();
          roundRect(ctx, heroX, heroY, heroW, heroH, 10 * u);
          ctx.clip();
          const hg = ctx.createLinearGradient(
            heroX,
            heroY,
            heroX + heroW,
            heroY + heroH,
          );
          hg.addColorStop(0, `rgba(20, 24, 12, ${heroFill})`);
          hg.addColorStop(1, `rgba(40, 50, 6, ${heroFill})`);
          ctx.fillStyle = hg;
          ctx.fillRect(heroX, heroY, heroW, heroH);
          const ox = heroX + heroW * 0.78;
          const oy = heroY + heroH * 0.5;
          for (let i = 0; i < 6; i++) {
            const rr =
              (heroH * 0.12 + i * heroH * 0.1) *
              (0.9 + 0.1 * Math.sin(time * 1.4 - i));
            ctx.beginPath();
            ctx.arc(ox, oy, rr, 0, Math.PI * 2);
            ctx.strokeStyle = lime((0.5 - i * 0.07) * heroFill);
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
          const orb = ctx.createRadialGradient(ox, oy, 0, ox, oy, heroH * 0.3);
          orb.addColorStop(0, lime(0.95 * heroFill));
          orb.addColorStop(1, lime(0));
          ctx.fillStyle = orb;
          ctx.beginPath();
          ctx.arc(ox, oy, heroH * 0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // headline types in
          const headline = "BUILT TO GROW.";
          const typed = Math.floor(
            seg(p, 0.4, 0.48) * headline.length + 0.0001,
          );
          ctx.fillStyle = PAPER;
          ctx.font = `400 ${Math.round(38 * u)}px ${fonts.display}`;
          ctx.textBaseline = "alphabetic";
          ctx.fillText(
            headline.slice(0, typed),
            heroX + 22 * u,
            heroY + 62 * u,
          );
          if (
            typed < headline.length &&
            typed > 0 &&
            Math.floor(time * 3) % 2 === 0
          ) {
            const tw = ctx.measureText(headline.slice(0, typed)).width;
            ctx.fillStyle = LIME;
            ctx.fillRect(heroX + 24 * u + tw, heroY + 34 * u, 3 * u, 32 * u);
          }
          const copyK = ease(seg(p, 0.45, 0.51));
          ctx.fillStyle = paper(0.35 * copyK);
          ctx.fillRect(
            heroX + 22 * u,
            heroY + 80 * u,
            heroW * 0.3 * copyK,
            5 * u,
          );
          ctx.fillRect(
            heroX + 22 * u,
            heroY + 92 * u,
            heroW * 0.24 * copyK,
            5 * u,
          );
          // button
          const btnK = ease(seg(p, 0.48, 0.53));
          roundRect(
            ctx,
            heroX + 22 * u,
            heroY + heroH - 46 * u,
            110 * u,
            28 * u,
            14 * u,
          );
          ctx.fillStyle = lime(btnK);
          ctx.fill();
          ctx.fillStyle = INK;
          ctx.globalAlpha = btnK;
          ctx.font = `600 ${Math.max(8, Math.round(9.5 * u))}px ${fonts.mono}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("GET STARTED", heroX + 77 * u, heroY + heroH - 32 * u);
          ctx.globalAlpha = 1;

          // service cards
          const symbols = ["</>", "◐", "#"];
          const titles = ["Websites", "Design", "SEO"];
          for (let i = 0; i < 3; i++) {
            const k = ease(seg(p, 0.5 + i * 0.025, 0.57 + i * 0.025));
            if (k <= 0) continue;
            const x = heroX + i * (cardW + 14 * u);
            const y = cardsY + (1 - k) * 16 * u;
            roundRect(ctx, x, y, cardW, cardH, 8 * u);
            ctx.fillStyle = `rgba(241, 244, 230, ${0.05 * k})`;
            ctx.fill();
            ctx.strokeStyle = paper(0.14 * k);
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = lime(k);
            ctx.font = `600 ${Math.round(12 * Math.max(0.8, u))}px ${fonts.mono}`;
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.fillText(symbols[i], x + 12 * u, y + 12 * u);
            ctx.fillStyle = paper(0.8 * k);
            ctx.font = `600 ${Math.round(12 * Math.max(0.8, u))}px ${fonts.body}`;
            ctx.fillText(titles[i], x + 12 * u, y + cardH - 26 * u);
          }

          // cursor glides to the button and clicks
          const curK = ease(seg(p, 0.55, 0.62));
          if (curK > 0 && p < 0.7) {
            const tx = heroX + 70 * u;
            const ty = heroY + heroH - 30 * u;
            const sx = bx + bw * 0.9;
            const sy = by + bh * 0.92;
            const px = sx + (tx - sx) * curK;
            const py =
              sy + (ty - sy) * curK - Math.sin(Math.PI * curK) * 40 * u;
            const click = seg(p, 0.62, 0.67);
            if (click > 0 && click < 1) {
              ctx.beginPath();
              ctx.arc(tx, ty, 6 * u + click * 40 * u, 0, Math.PI * 2);
              ctx.strokeStyle = lime(1 - click);
              ctx.lineWidth = 2;
              ctx.stroke();
            }
            ctx.save();
            ctx.translate(px, py);
            ctx.scale(Math.max(0.8, u), Math.max(0.8, u));
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, 18);
            ctx.lineTo(5, 13.5);
            ctx.lineTo(9, 21);
            ctx.lineTo(12, 19.5);
            ctx.lineTo(8, 12);
            ctx.lineTo(14, 12);
            ctx.closePath();
            ctx.fillStyle = PAPER;
            ctx.strokeStyle = INK;
            ctx.lineWidth = 1.2;
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }
        }
        ctx.restore(); // clip

        // dimension annotations (PLAN)
        const dimK = ease(seg(p, 0.18, 0.24)) * (1 - ease(seg(p, 0.34, 0.4)));
        if (dimK > 0.001) {
          ctx.globalAlpha = dimK;
          ctx.strokeStyle = lime(0.8);
          ctx.fillStyle = lime(0.9);
          ctx.lineWidth = 1;
          const ay = by - 22;
          ctx.beginPath();
          ctx.moveTo(bx, ay);
          ctx.lineTo(bx + bw, ay);
          ctx.moveTo(bx, ay - 5);
          ctx.lineTo(bx, ay + 5);
          ctx.moveTo(bx + bw, ay - 5);
          ctx.lineTo(bx + bw, ay + 5);
          ctx.stroke();
          ctx.fillStyle = INK;
          ctx.fillRect(bx + bw / 2 - 44, ay - 8, 88, 16);
          ctx.fillStyle = lime(0.95);
          ctx.font = `500 10px ${fonts.mono}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("1440 PX · 12 COL", bx + bw / 2, ay + 0.5);
          if (!mobile) {
            const lx = bx + bw + 18;
            ctx.beginPath();
            ctx.moveTo(lx, by);
            ctx.lineTo(lx, by + bh);
            ctx.moveTo(lx - 5, by);
            ctx.lineTo(lx + 5, by);
            ctx.moveTo(lx - 5, by + bh);
            ctx.lineTo(lx + 5, by + bh);
            ctx.stroke();
            ctx.save();
            ctx.translate(lx + 14, by + bh / 2);
            ctx.rotate(Math.PI / 2);
            ctx.fillText("RESPONSIVE", 0, 0);
            ctx.restore();
          }
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      }

      /* ---------- code panel (CREATE) ---------- */
      const codeIn = ease(seg(p, 0.38, 0.46));
      const codeOut = ease(seg(p, 0.66, 0.72));
      const codeK = codeIn * (1 - codeOut);
      if (codeK > 0.001 && !mobile) {
        const pw = bw * 0.46;
        const ph = bh * 0.62;
        const px = bx - pw * 0.42 - (1 - codeK) * 60;
        const py = by + bh * 0.46;
        ctx.save();
        ctx.globalAlpha = codeK;
        ctx.shadowColor = "rgba(0,0,0,0.65)";
        ctx.shadowBlur = 40;
        ctx.shadowOffsetY = 18;
        roundRect(ctx, px, py, pw, ph, 12 * u);
        ctx.fillStyle = "rgba(9, 10, 7, 0.96)";
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.strokeStyle = lime(0.35);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.font = `500 ${Math.max(9, Math.round(11 * u))}px ${fonts.mono}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        const typed = seg(p, 0.42, 0.62) * CODE.length;
        CODE.forEach((tokens, line) => {
          const lk = clamp01(typed - line);
          if (lk <= 0) return;
          let x = px + 16 * u;
          const y = py + 16 * u + line * 17 * u;
          ctx.fillStyle = paper(0.3);
          ctx.fillText(String(line + 1).padStart(2, " "), x, y);
          x += 24 * u;
          const full = tokens.join("");
          const visibleChars = Math.floor(full.length * lk);
          let count = 0;
          tokens.forEach((token, ti) => {
            const show = token.slice(0, Math.max(0, visibleChars - count));
            count += token.length;
            ctx.fillStyle = ti % 2 === 1 ? LIME : paper(0.82);
            ctx.fillText(show, x, y);
            x += ctx.measureText(token).width;
          });
        });
        ctx.restore();
      }

      /* ---------- growth chart + signals (GROW) ---------- */
      const chartK = ease(seg(p, 0.76, 0.9));
      if (chartK > 0.001) {
        const gw = mobile ? W * 0.78 : bw * 0.62;
        const gh = gw * 0.46;
        const gx = mobile ? (W - gw) / 2 : bx + bw - gw * 0.72;
        const gy = mobile ? by + bh + 70 : by + bh - 22;
        ctx.save();
        ctx.globalAlpha = easeOut(chartK * 1.4);
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 36;
        ctx.shadowOffsetY = 16;
        roundRect(ctx, gx, gy, gw, gh, 12);
        ctx.fillStyle = "rgba(12, 14, 9, 0.95)";
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.strokeStyle = paper(0.14);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = paper(0.55);
        ctx.font = `500 10px ${fonts.mono}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("GROWTH", gx + 14, gy + 12);
        const left = gx + 14;
        const right = gx + gw - 14;
        const bottom = gy + gh - 16;
        const topY = gy + 34;
        const pts: [number, number][] = [];
        const n = 24;
        for (let i = 0; i <= n; i++) {
          const k = i / n;
          const v =
            Math.pow(k, 1.7) * 0.92 +
            0.06 * Math.sin(k * 9) * (1 - k * 0.6) +
            0.04;
          pts.push([
            left + (right - left) * k,
            bottom - (bottom - topY) * Math.min(1, v),
          ]);
        }
        const drawn = Math.max(2, Math.floor(chartK * n) + 1);
        const area = ctx.createLinearGradient(0, topY, 0, bottom);
        area.addColorStop(0, lime(0.32));
        area.addColorStop(1, lime(0));
        ctx.beginPath();
        ctx.moveTo(pts[0][0], bottom);
        for (let i = 0; i < drawn && i < pts.length; i++)
          ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.lineTo(pts[Math.min(drawn, pts.length) - 1][0], bottom);
        ctx.closePath();
        ctx.fillStyle = area;
        ctx.fill();
        ctx.beginPath();
        for (let i = 0; i < drawn && i < pts.length; i++) {
          if (i === 0) ctx.moveTo(pts[i][0], pts[i][1]);
          else ctx.lineTo(pts[i][0], pts[i][1]);
        }
        ctx.strokeStyle = LIME;
        ctx.lineWidth = 2;
        ctx.stroke();
        const end = pts[Math.min(drawn, pts.length) - 1];
        const pulse = 6 + 3 * Math.sin(time * 4);
        const eg = ctx.createRadialGradient(
          end[0],
          end[1],
          0,
          end[0],
          end[1],
          pulse * 3,
        );
        eg.addColorStop(0, lime(1));
        eg.addColorStop(1, lime(0));
        ctx.fillStyle = eg;
        ctx.beginPath();
        ctx.arc(end[0], end[1], pulse * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // signal chips, right-aligned in the chart header
        ctx.font = `600 9px ${fonts.mono}`;
        const chips = ["TRAFFIC ↑", "LEADS ↑", "SALES ↑"];
        const widths = chips.map((chip) => ctx.measureText(chip).width + 16);
        const total =
          widths.reduce((sum, w) => sum + w, 0) + 6 * (widths.length - 1);
        let cursor = gx + gw - 12 - total;
        const chipX = widths.map((w) => {
          const x = cursor;
          cursor += w + 6;
          return x;
        });
        chips.forEach((chip, i) => {
          const k = easeOut(seg(p, 0.84 + i * 0.03, 0.9 + i * 0.03));
          if (k <= 0) return;
          ctx.save();
          ctx.globalAlpha = k;
          ctx.font = `600 9px ${fonts.mono}`;
          const tw = widths[i];
          const x = chipX[i];
          const y = gy + 8 + (1 - k) * 6;
          roundRect(ctx, x, y, tw, 20, 10);
          ctx.fillStyle = "rgba(14, 16, 11, 0.94)";
          ctx.fill();
          ctx.strokeStyle = lime(0.55);
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = LIME;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(chip, x + 8, y + 10.5);
          ctx.restore();
        });
      }

      // notifications landing on the site
      ["New enquiry", "New order"].forEach((note, i) => {
        const k = easeOut(seg(p, 0.86 + i * 0.05, 0.92 + i * 0.05));
        if (k <= 0 || mobile) return;
        ctx.save();
        ctx.globalAlpha = k;
        const tw = 168;
        const x = bx + bw - tw - 18;
        const y = by + 48 * u + i * 44 - (1 - k) * 14;
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 24;
        roundRect(ctx, x, y, tw, 36, 12);
        ctx.fillStyle = "rgba(20, 22, 15, 0.96)";
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.strokeStyle = paper(0.14);
        ctx.stroke();
        ctx.fillStyle = LIME;
        ctx.beginPath();
        ctx.arc(x + 18, y + 18, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PAPER;
        ctx.font = `600 12px ${fonts.body}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(note, x + 32, y + 18.5);
        ctx.restore();
      });
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [progressRef]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
