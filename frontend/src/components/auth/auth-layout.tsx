import type { ReactNode } from "react";
import { DeltaLogo } from "@/components/ui/delta-logo";
import { GlassCard } from "@/components/ui/glass-card";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="ambient-bg min-h-screen p-4 sm:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-[1400px] items-center gap-8 lg:grid-cols-2">
        <section className="hidden lg:block">
          <div className="relative">
            <GlassCard className="absolute -left-6 -top-6 h-full w-full rounded-3xl opacity-40" />
            <GlassCard className="relative flex flex-col gap-8 rounded-3xl p-10">
              <div className="grid place-items-center py-6">
                <DeltaLogo size={200} />
              </div>
              <div>
                <h2 className="text-4xl font-semibold leading-tight tracking-tight">
                  Connect. Collaborate.
                  <br />
                  Anywhere.
                </h2>
                <p className="mt-4 max-w-md text-base text-muted-foreground">
                  Experience seamless, high-definition video conferencing at your fingertips.
                </p>
              </div>
            </GlassCard>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="mb-6 flex justify-center lg:hidden">
            <DeltaLogo size={56} />
          </div>
          <GlassCard className="rounded-3xl bg-card/60 p-6 sm:p-8">{children}</GlassCard>
        </section>
      </div>
    </div>
  );
}

export function SocialButtons() {
  return (
    <div className="space-y-3">
      <SocialButton label="Continue with Google" />
      <SocialButton label="Continue with GitHub" />
    </div>
  );
}

function SocialButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      title="Social sign-in requires an authentication backend"
      className="glass-soft flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium opacity-60"
    >
      {label}
    </button>
  );
}
