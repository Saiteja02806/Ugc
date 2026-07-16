import { AuthGuard } from "@/components/auth/auth-guard";

export default function SchedulingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AuthGuard>{children}</AuthGuard>;
}
