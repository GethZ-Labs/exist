import type { Metadata } from "next";
import AboutPage from "@/components/site/pages/AboutPage";

export const metadata: Metadata = {
  title: "About — EXiST",
  description:
    "EXiST — Excellence IT Solutions — is a Sri Lankan studio for websites, apps, brands and growth.",
};

export default function Page() {
  return <AboutPage />;
}
