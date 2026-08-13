import { useEffect } from "react";
import { ensureDemoAuth } from "@/lib/demo-auth";

export function DemoAuthBootstrap({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void ensureDemoAuth();
  }, []);

  return children;
}
