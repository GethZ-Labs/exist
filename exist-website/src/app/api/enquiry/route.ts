/*
  POST /api/enquiry — the contact form's backend.

  Validates the enquiry, filters bots (hidden honeypot field + a small
  per-visitor rate limit) and emails it to EXiST. Delivery, first match wins:

    1. SMTP (e.g. Gmail with an App Password)   SMTP_USER + SMTP_PASS
    2. Resend (HTTPS email API)                 RESEND_API_KEY

  With neither configured it answers 503 "not-configured", and the browser
  falls back to Web3Forms (NEXT_PUBLIC_WEB3FORMS_KEY) — see src/lib/enquiry.ts.
  Setup steps are in README.md.
*/

import nodemailer from "nodemailer";
import { CONTACT, SERVICES } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const recent = new Map<string, number[]>();

type Mail = {
  subject: string;
  text: string;
  html: string;
  name: string;
  email: string;
};

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.replace(/\s+\n/g, "\n").trim().slice(0, max) : "";

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function rateLimited(key: string) {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recent.set(key, hits);
  if (recent.size > 5000) recent.clear();
  return hits.length > MAX_PER_WINDOW;
}

const reply = (status: number, body: Record<string, unknown>) => Response.json(body, { status });

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return reply(400, { ok: false, error: "That request couldn't be read." });
  }

  // bots fill every field; people never see this one
  if (clean(body.company, 200)) return reply(200, { ok: true });

  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const business = clean(body.business, 160);
  const message = clean(body.message, 5000);
  const services = Array.isArray(body.services)
    ? body.services.filter(
        (item): item is string =>
          typeof item === "string" && SERVICES.some((service) => service.title === item),
      )
    : [];

  if (!name || !EMAIL_RE.test(email)) {
    return reply(422, { ok: false, error: "Please add your name and a valid email address." });
  }

  const visitor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(visitor)) {
    return reply(429, {
      ok: false,
      error: "That's a lot of enquiries in a few minutes — please try again shortly, or message us on WhatsApp.",
    });
  }

  const subject = `New website enquiry — ${business || name}`;
  const rows: [string, string][] = [
    ["Name", name],
    ["Email", email],
    ["Business", business || "—"],
    ["Interested in", services.length ? services.join(", ") : "—"],
  ];
  const text = [
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    message || "(no message)",
    "",
    "— Sent from the EXiST website contact form",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;color:#0b0c08">
      <h2 style="margin:0 0 16px">New website enquiry</h2>
      <table style="border-collapse:collapse;width:100%">
        ${rows
          .map(
            ([label, value]) =>
              `<tr><td style="padding:6px 12px 6px 0;color:#666;white-space:nowrap">${label}</td><td style="padding:6px 0"><b>${escapeHtml(value)}</b></td></tr>`,
          )
          .join("")}
      </table>
      <p style="white-space:pre-wrap;line-height:1.5;padding:14px;background:#f4f7e4;border-radius:10px">${escapeHtml(message || "(no message)")}</p>
      <p style="color:#888;font-size:12px">Reply to this email to answer ${escapeHtml(name)} directly.</p>
    </div>`;

  try {
    const delivered = await deliver({ subject, text, html, name, email });
    if (!delivered) return reply(503, { ok: false, error: "not-configured" });
    return reply(200, { ok: true });
  } catch (error) {
    console.error("[enquiry] delivery failed:", error);
    return reply(502, { ok: false, error: "We couldn't send that just now." });
  }
}

async function deliver(mail: Mail) {
  const to = process.env.ENQUIRY_TO || CONTACT.email;

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (user && pass) {
    const port = Number(process.env.SMTP_PORT || 465);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure: (process.env.SMTP_SECURE ?? String(port === 465)) === "true",
      auth: { user, pass },
      connectionTimeout: 10_000,
      socketTimeout: 15_000,
    });
    await transport.sendMail({
      from: `"EXiST Website" <${user}>`,
      to,
      replyTo: `"${mail.name.replace(/"/g, "")}" <${mail.email}>`,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    return true;
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "EXiST Website <onboarding@resend.dev>",
        to: [to],
        reply_to: mail.email,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      }),
    });
    if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`);
    return true;
  }

  return false;
}
