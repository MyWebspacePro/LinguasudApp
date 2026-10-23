import "server-only";

import { headers } from "next/headers";

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

/**
 * IP und User-Agent des aktuellen Requests (hinter Coolify-Traefik gilt
 * die erste Adresse in x-forwarded-for als Client).
 */
export async function getRequestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || null;
  const userAgent = h.get("user-agent");
  return { ip, userAgent: userAgent ?? null };
}
