import type { Metadata } from "next";
import { FlatEntityPage } from "@/components/stammdaten/FlatEntityPage";

export const metadata: Metadata = { title: "Niveaus" };

export default function NiveausPage() {
  return <FlatEntityPage entity="niveau" />;
}
