/*
  Rasterises live DOM text (exact glyph positions via Range rects) into a
  canvas, so the WebGL flood can melt and refract the very same sentence.
*/

function effectiveOpacity(el: Element, stop: Element) {
  let opacity = 1;
  let node: Element | null = el;
  while (node && node !== stop.parentElement) {
    opacity *= parseFloat(getComputedStyle(node).opacity || "1");
    node = node.parentElement;
  }
  return opacity;
}

function baselineOf(el: HTMLElement) {
  const probe = document.createElement("span");
  probe.style.cssText =
    "display:inline-block;width:0;height:0;vertical-align:baseline;";
  el.appendChild(probe);
  const y = probe.getBoundingClientRect().bottom;
  probe.remove();
  return y;
}

export function rasterizeText(
  root: HTMLElement,
  width: number,
  height: number,
  ratio: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(ratio, ratio);
  ctx.textBaseline = "alphabetic";

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  const baselines = new Map<HTMLElement, number>();
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.textContent ?? "";
    const parent = node.parentElement;
    if (!parent || !text.trim()) continue;
    const style = getComputedStyle(parent);
    if (style.visibility === "hidden") continue;
    const alpha = effectiveOpacity(parent, root);
    if (alpha < 0.02) continue;
    // a glyph's own line: the closest block-ish container
    const line =
      (parent.closest(".epi-line, .epi-kicker, .epi-sub") as HTMLElement) ??
      parent;
    if (!baselines.has(parent)) {
      baselines.set(parent, baselineOf(parent));
    }
    const baseline = baselines.get(parent)!;
    ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ctx.fillStyle = style.color;
    const glow = line.classList.contains("epi-accent");
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === " " || ch === " ") continue;
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const rect = range.getBoundingClientRect();
      if (!rect.width) continue;
      const parentRect = parent.getBoundingClientRect();
      // honour per-glyph scale transforms (e.g. the morphing I)
      const scaleX = parent.offsetWidth
        ? parentRect.width / parent.offsetWidth
        : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(rect.left, baseline);
      ctx.scale(scaleX || 1, 1);
      if (glow) {
        ctx.shadowColor = "rgba(219, 254, 1, 0.55)";
        ctx.shadowBlur = 26;
        ctx.fillText(ch, 0, 0);
        ctx.shadowBlur = 0;
      }
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    }
  }
  return canvas;
}
