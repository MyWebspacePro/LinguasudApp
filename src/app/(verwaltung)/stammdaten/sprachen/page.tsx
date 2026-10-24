import type { Metadata } from "next";
import { FlatEntityPage } from "@/components/stammdaten/FlatEntityPage";

export const metadata: Metadata = { title: "Sprachen" };

export default function SprachenPage() {
  return <FlatEntityPage entity="sprache" />;
}
