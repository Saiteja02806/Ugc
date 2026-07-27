import { AuthGuard } from "@/components/auth/auth-guard";

export default function AIStudioLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AuthGuard>{children}</AuthGuard>;
}
