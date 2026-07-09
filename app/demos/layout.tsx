import { AuthGuard } from "@/components/auth/auth-guard";

export default function DemosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AuthGuard>{children}</AuthGuard>;
}
