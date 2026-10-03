import type { Metadata } from "next";
import ProjectsPage from "@/components/site/pages/ProjectsPage";

export const metadata: Metadata = {
  title: "Projects — EXiST",
  description:
    "Websites, campaigns and identities by EXiST — Union Home, Lenz & Line, Quality Science and EXiST 26.",
};

export default function Page() {
  return <ProjectsPage />;
}
