/*
  Sends a contact-form enquiry to EXiST's inbox.

  1. The site's own backend, /api/enquiry (SMTP or Resend, see the route).
  2. If the backend has no email service configured (or the site is served
     without a backend), the browser posts straight to Web3Forms when a public
     access key is set in NEXT_PUBLIC_WEB3FORMS_KEY.
*/

export type Enquiry = {
  name: string;
  email: string;
  business: string;
  message: string;
  services: string[];
  /* honeypot: hidden from people, filled in by bots */
  company: string;
};

export type EnquiryResult = { ok: true } | { ok: false; error: string };

const FAILED = "We couldn't send that just now.";

export async function sendEnquiry(enquiry: Enquiry): Promise<EnquiryResult> {
  if (enquiry.company) return { ok: true };

  try {
    const response = await fetch("/api/enquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enquiry),
    });
    const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (response.ok && data.ok) return { ok: true };
    if (!(response.status === 503 && data.error === "not-configured") && response.status !== 404) {
      return { ok: false, error: data.error || FAILED };
    }
  } catch {
    // offline or no backend: try the browser fallback below
  }

  const key = process.env.NEXT_PUBLIC_WEB3FORMS_KEY;
  if (key) {
    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: key,
          subject: `New website enquiry — ${enquiry.business || enquiry.name}`,
          from_name: "EXiST Website",
          replyto: enquiry.email,
          name: enquiry.name,
          email: enquiry.email,
          business: enquiry.business || "—",
          interested_in: enquiry.services.join(", ") || "—",
          message: enquiry.message || "(no message)",
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { success?: boolean };
      if (response.ok && data.success) return { ok: true };
    } catch {}
    return { ok: false, error: FAILED };
  }

  return { ok: false, error: "Online enquiries aren't switched on yet." };
}
