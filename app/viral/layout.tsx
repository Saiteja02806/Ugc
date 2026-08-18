import type { ReactNode } from "react";

import { AuthGuard } from "@/components/auth/auth-guard";
import { ViralAccessGuard } from "@/components/viral/viral-access-guard";

export default function ViralLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard requireBusinessProfile={false}>
      <ViralAccessGuard>{children}</ViralAccessGuard>
    </AuthGuard>
  );
}
