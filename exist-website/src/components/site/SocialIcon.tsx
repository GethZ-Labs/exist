/* Minimal line icons for the social channels (inherit currentColor). */

export default function SocialIcon({ name, className = "" }: { name: string; className?: string }) {
  const common = {
    className: `social-icon ${className}`,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "Facebook":
      return (
        <svg {...common}>
          <path d="M14.5 8.5h2V5h-2.6C11.6 5 10.5 6.4 10.5 8.8V11H8v3.4h2.5V21h3.4v-6.6h2.6l.5-3.4h-3.1V9.3c0-.5.2-.8.6-.8Z" />
        </svg>
      );
    case "Instagram":
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.3" cy="6.7" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      );
    case "LinkedIn":
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
          <path d="M8 10.5V16.5M8 7.6v.1M11.5 16.5v-3.6c0-1.4.9-2.4 2.1-2.4s1.9.9 1.9 2.4v3.6M11.5 10.5v6" />
        </svg>
      );
    case "WhatsApp":
      return (
        <svg {...common}>
          <path d="M4.5 19.5l1.2-3.6A8 8 0 1 1 8.4 18.6Z" />
          <path d="M9.2 8.6c.2-.5.5-.5.8-.5h.5c.2 0 .4.1.5.4l.7 1.6c.1.2 0 .5-.1.6l-.5.6c-.1.1-.1.3 0 .5.5.9 1.2 1.6 2.1 2.1.2.1.4.1.5 0l.6-.6c.2-.1.4-.2.6-.1l1.6.7c.3.1.4.3.4.5v.5c0 .3-.1.6-.5.8-.6.3-1.4.4-2.4 0a8.6 8.6 0 0 1-4.2-4.2c-.4-1-.3-1.8 0-2.4Z" />
        </svg>
      );
    case "Email":
      return (
        <svg {...common}>
          <rect x="3.5" y="5.5" width="17" height="13" rx="3" />
          <path d="m4.5 7.5 7.5 5.5 7.5-5.5" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}
