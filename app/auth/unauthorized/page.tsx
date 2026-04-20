"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const ROLE_DEFAULT: Record<string, string> = {
  admin: "/",
  employee: "/",
  contractor_admin: "/my-organization",
  contractor_employee: "/my-organization",
  department_approver: "/",
};

export default function UnauthorizedPage() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const role = data?.user?.role;
        const target = role ? ROLE_DEFAULT[role] ?? "/" : "/";
        router.replace(target);
      })
      .catch(() => router.replace("/"));
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
    </div>
  );
}
