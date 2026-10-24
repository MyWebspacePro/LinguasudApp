import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { ALL_ROLES, ROLE_LABELS, canViewUsers, hasRole } from "@/lib/auth/permissions";
import { RoleBadge } from "@/components/RoleBadge";

export const metadata: Metadata = {
  title: "Benutzer",
};

const PAGE_SIZE = 20;

/** Benutzerliste: Admin/Büro verwalten, Chef sieht lesend (Pflichtenheft). */
export default function UsersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-lg bg-slate-100" />}>
      <UsersContent searchParams={searchParams} />
    </Suspense>
  );
}

async function UsersContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user: actor } = await requireStaff();
  const actorRoles = actor.roles as Role[];
  if (!canViewUsers(actorRoles)) {
    redirect("/dashboard");
  }

  const params = searchParams ? await searchParams : {};
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const roleFilter = ALL_ROLES.includes(params.rolle as Role) ? (params.rolle as Role) : null;
  const status = params.status === "aktiv" || params.status === "inaktiv" ? params.status : null;
  const page = Math.max(1, Number.parseInt(typeof params.seite === "string" ? params.seite : "1", 10) || 1);

  const where: Prisma.UserWhereInput = {
    ...(q && {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(roleFilter && { roles: { has: roleFilter } }),
    ...(status === "aktiv" && { isActive: true }),
    ...(status === "inaktiv" && { isActive: false }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canCreate = hasRole(actorRoles, "ADMIN") || hasRole(actorRoles, "BUERO");

  const pageHref = (seite: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (roleFilter) sp.set("rolle", roleFilter);
    if (status) sp.set("status", status);
    if (seite > 1) sp.set("seite", String(seite));
    const qs = sp.toString();
    return qs ? `/benutzer?${qs}` : "/benutzer";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Benutzer</h1>
        {canCreate && (
          <Link href="/benutzer/neu" className="btn-primary">
            Neues Konto
          </Link>
        )}
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-4" method="get">
        <div className="min-w-44 flex-1">
          <label htmlFor="filter-q" className="label">
            Suche
          </label>
          <input
            id="filter-q"
            name="q"
            defaultValue={q}
            placeholder="Name oder E-Mail …"
            className="input"
          />
        </div>
        <div>
          <label htmlFor="filter-rolle" className="label">
            Rolle
          </label>
          <select id="filter-rolle" name="rolle" defaultValue={roleFilter ?? ""} className="input">
            <option value="">Alle</option>
            {ALL_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-status" className="label">
            Status
          </label>
          <select id="filter-status" name="status" defaultValue={status ?? ""} className="input">
            <option value="">Alle</option>
            <option value="aktiv">Aktiv</option>
            <option value="inaktiv">Inaktiv</option>
          </select>
        </div>
        <button type="submit" className="btn-secondary">
          Filtern
        </button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-160">
          <thead className="border-b border-line bg-surface/60">
            <tr>
              <th className="th">Name</th>
              <th className="th">E-Mail</th>
              <th className="th">Rollen</th>
              <th className="th">Status</th>
              <th className="th">Letzte Anmeldung</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id} className={u.isActive ? "" : "text-slate-500"}>
                <td className="td font-medium">
                  {u.firstName} {u.lastName}
                  {u.id === actor.id && <span className="ml-1.5 text-xs text-slate-500">(Sie)</span>}
                </td>
                <td className="td">{u.email}</td>
                <td className="td">
                  <span className="flex flex-wrap gap-1">
                    {(u.roles as Role[]).map((role) => (
                      <RoleBadge key={role} role={role} />
                    ))}
                  </span>
                </td>
                <td className="td">
                  {u.isActive ? (
                    <span className="font-medium text-emerald-700">aktiv</span>
                  ) : (
                    <span>inaktiv</span>
                  )}
                </td>
                <td className="td text-slate-600">
                  {u.lastLoginAt ? u.lastLoginAt.toLocaleString("de-CH") : "—"}
                </td>
                <td className="td text-right">
                  <Link
                    href={`/benutzer/${u.id}`}
                    className="text-sm font-medium text-brand-700 hover:text-brand-800"
                  >
                    Öffnen
                  </Link>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td className="td py-8 text-center text-slate-600" colSpan={6}>
                  Keine Konten gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          {total} Konto{total === 1 ? "" : "konten"} · Seite {page} von {pageCount}
        </span>
        {pageCount > 1 && (
          <span className="flex gap-2">
            {page > 1 && (
              <Link href={pageHref(page - 1)} className="font-medium text-brand-700">
                ← Zurück
              </Link>
            )}
            {page < pageCount && (
              <Link href={pageHref(page + 1)} className="font-medium text-brand-700">
                Weiter →
              </Link>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
