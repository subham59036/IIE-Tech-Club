/**
 * app/admin/layout.tsx
 * Server component — validates session server-side before rendering.
 * Middleware also guards this route, but this provides a server-side fallback.
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import type { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/");
  return <>{children}</>;
}
