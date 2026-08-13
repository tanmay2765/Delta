import { useEffect, useState } from "react";
import { ensureDemoAuth } from "@/lib/demo-auth";

export function DemoAuthBootstrap({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void ensureDemoAuth().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading Delta Meet...
      </div>
    );
  }

  return children;
}
