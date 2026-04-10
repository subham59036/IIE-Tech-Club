/**
 * app/student/layout.tsx
 * Server component — validates student session before rendering.
 */

import { redirect }   from "next/navigation";
import { getSession } from "@/lib/auth";
import type { ReactNode } from "react";

export default async function StudentLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "student") redirect("/");
  return <>{children}</>;
}
