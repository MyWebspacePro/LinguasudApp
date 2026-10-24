import type { Metadata } from "next";
import { FlatEntityPage } from "@/components/stammdaten/FlatEntityPage";

export const metadata: Metadata = { title: "Lektionsdauern" };

export default function DauernPage() {
  return <FlatEntityPage entity="dauer" />;
}
