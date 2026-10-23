import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Linguasud Verwaltung",
    template: "%s · Linguasud",
  },
  description: "Verwaltungs-App der Sprachschule linguasud.com",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
