import type { ReactNode } from "react";
import { MobileNav, Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="ambient-bg min-h-screen p-3 sm:p-4 lg:p-5">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1600px] gap-4 lg:min-h-[calc(100vh-2.5rem)]">
        <Sidebar />
        <main className="glass-panel min-w-0 flex-1 overflow-hidden rounded-3xl px-4 pb-24 pt-5 sm:px-6 sm:pt-6 lg:pb-6">
          <Topbar title={title} />
          <div className="mt-5 sm:mt-6">{children}</div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
