import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { landingRoute } from "@/lib/auth/permissions";
import { roleList } from "@/lib/db";

// Session-abhängige Weiterleitung: bewusst blockierend statt Instant-Navigation.
export const instant = false;

/**
 * Einstiegsseite: leitet angemeldete Personen zu ihrer Startseite
 * (Verwaltung bzw. Teilnehmer-Portal), alle anderen zum Login.
 */
export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeRouter />
    </Suspense>
  );
}

async function HomeRouter() {
  const ctx = await getAuthContext();
  if (!ctx) {
    redirect("/login");
  }
  if (ctx.user.mustChangePassword) {
    redirect("/passwort-aendern");
  }
  redirect(landingRoute(roleList(ctx.user.roles)));
  // redirect() wirft — dieser Punkt wird nie erreicht, TypeScript braucht ihn aber.
  return null;
}
