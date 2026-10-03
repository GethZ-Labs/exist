import type { Metadata } from "next";
import CareersPage from "@/components/site/pages/CareersPage";

export const metadata: Metadata = {
  title: "Careers — EXiST",
  description: "Join EXiST. We're not hiring right now — send your CV on WhatsApp and we'll reach out when a role opens.",
};

export default function Page() {
  return <CareersPage />;
}
