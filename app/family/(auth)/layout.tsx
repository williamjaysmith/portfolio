import type { ReactNode } from "react";

/**
 * Chrome for the signed-out surface: sign-in and not-authorized.
 * Deliberately NO FamilyProvider / AppShell — a visitor without
 * a session must never construct the household app (FR-001), and the (auth)
 * group imports nothing from (app).
 */
export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-(--fam-sidebar-bg) p-(--fam-edge-inset)">
      <div className="w-full max-w-md rounded-(--fam-radius-modal) bg-(--fam-app-bg) px-8 py-10 shadow-sm">
        {children}
      </div>
    </main>
  );
}
