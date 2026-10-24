import type { Metadata } from "next";
import { FlatEntityPage } from "@/components/stammdaten/FlatEntityPage";

export const metadata: Metadata = { title: "Kostenträger" };

export default function KostentraegerPage() {
  return <FlatEntityPage entity="kostentraeger" />;
}
