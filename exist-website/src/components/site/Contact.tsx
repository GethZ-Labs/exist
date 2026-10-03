"use client";

import type * as React from "react";

import { useState } from "react";
import { sendEnquiry } from "@/lib/enquiry";
import { CONTACT, SERVICES, whatsappLink } from "@/lib/site";
import { sound } from "@/lib/sound";
import { LoopMark } from "./BrandMark";
import { Magnetic } from "./effects";

type Status = "idle" | "sending" | "sent" | "error";

const EMPTY = { name: "", email: "", business: "", message: "" };

/*
  The enquiry form posts to /api/enquiry, which emails it to EXiST
  (see src/app/api/enquiry/route.ts). WhatsApp is always one tap away.
*/
export default function Contact() {
  const [services, setServices] = useState<string[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [sentName, setSentName] = useState("");

  const toggle = (title: string) =>
    setServices((current) =>
      current.includes(title)
        ? current.filter((item) => item !== title)
        : [...current, title],
    );

  const composeMessage = () =>
    [
      `Hi EXiST, I'm ${form.name || "—"}${form.business ? ` from ${form.business}` : ""}.`,
      services.length ? `I'm interested in: ${services.join(", ")}.` : "",
      form.message,
      form.email ? `You can reach me at ${form.email}.` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

  const send = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError("");
    const result = await sendEnquiry({ ...form, services, company });
    if (result.ok) {
      sound.ui.bloop();
      setSentName(form.name.split(" ")[0] ?? "");
      setStatus("sent");
      setForm(EMPTY);
      setServices([]);
    } else {
      setStatus("error");
      setError(result.error);
    }
  };

  const whatsappHref = whatsappLink(composeMessage());
  const mailHref = `mailto:${CONTACT.email}?subject=${encodeURIComponent(
    `New project enquiry — ${form.business || form.name}`,
  )}&body=${encodeURIComponent(composeMessage())}`;

  return (
    <section id="contact" className="contact" data-theme="lime">
      <LoopMark className="contact-loop" draw strokeWidth={60} />

      <div className="contact-grid">
        <div className="contact-pitch">
          <div className="section-label section-label-dark" data-reveal>
            <span className="section-label-dot" /> Start a project
          </div>
          <h2 className="contact-title" data-reveal>
            Let&apos;s build first.
            <span>Thank later.</span>
          </h2>
          <p className="contact-sub" data-reveal>
            Your brand. Your business. <strong>Our responsibility.</strong>
          </p>

          <ul className="contact-direct" data-reveal>
            <li>
              <span>Email</span>
              <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
            </li>
            <li>
              <span>WhatsApp</span>
              <a href={whatsappLink()} target="_blank" rel="noreferrer">
                {CONTACT.whatsappDisplay} ↗
              </a>
            </li>
            <li>
              <span>Based in</span>
              <p>{CONTACT.location} — working worldwide</p>
            </li>
          </ul>
        </div>

        {status === "sent" ? (
          <div className="contact-form contact-done" role="status">
            <span className="contact-done-icon" aria-hidden="true">
              ✓
            </span>
            <h3>Thank you{sentName ? `, ${sentName}` : ""}!</h3>
            <p>
              Your enquiry is in our inbox. We&apos;ll get back to you soon. Need us
              sooner? We&apos;re on WhatsApp.
            </p>
            <div className="contact-actions">
              <a className="btn btn-outline-dark" href={whatsappLink()} target="_blank" rel="noreferrer">
                Chat on WhatsApp
              </a>
              <button type="button" className="btn btn-dark" onClick={() => setStatus("idle")}>
                Send another
              </button>
            </div>
          </div>
        ) : (
          <form className="contact-form" onSubmit={send} data-reveal>
            <fieldset className="contact-services">
              <legend>I need help with</legend>
              <div className="chip-row">
                {SERVICES.map((service) => (
                  <button
                    type="button"
                    key={service.id}
                    className={`chip ${services.includes(service.title) ? "is-on" : ""}`}
                    aria-pressed={services.includes(service.title)}
                    onClick={() => toggle(service.title)}
                  >
                    {service.title}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="field-row">
              <label className="field">
                <input
                  required
                  name="name"
                  placeholder=" "
                  autoComplete="name"
                  maxLength={120}
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
                <span>Your name</span>
              </label>
              <label className="field">
                <input
                  required
                  type="email"
                  name="email"
                  placeholder=" "
                  autoComplete="email"
                  maxLength={200}
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
                <span>Email</span>
              </label>
            </div>

            <label className="field">
              <input
                name="business"
                placeholder=" "
                autoComplete="organization"
                maxLength={160}
                value={form.business}
                onChange={(event) => setForm({ ...form, business: event.target.value })}
              />
              <span>Business name</span>
            </label>

            <label className="field">
              <textarea
                name="message"
                rows={4}
                placeholder=" "
                maxLength={5000}
                value={form.message}
                onChange={(event) => setForm({ ...form, message: event.target.value })}
              />
              <span>Tell us about your goals</span>
            </label>

            {/* honeypot for bots — hidden from people and screen readers */}
            <label className="contact-trap" aria-hidden="true">
              Company
              <input
                tabIndex={-1}
                autoComplete="off"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
              />
            </label>

            <div className="contact-actions">
              <Magnetic>
                <button type="submit" className="btn btn-dark" disabled={status === "sending"}>
                  {status === "sending" ? (
                    <>
                      Sending <span className="contact-spinner" aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      Send enquiry <span aria-hidden="true">↗</span>
                    </>
                  )}
                </button>
              </Magnetic>
              <a className="btn btn-outline-dark" href={whatsappHref} target="_blank" rel="noreferrer">
                Send on WhatsApp
              </a>
            </div>

            {status === "error" && (
              <div className="contact-error" role="alert">
                <p>
                  {error} Your message is still here — send it on{" "}
                  <a href={whatsappHref} target="_blank" rel="noreferrer">
                    WhatsApp
                  </a>{" "}
                  or by <a href={mailHref}>email</a> instead.
                </p>
              </div>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
