import { AuthGuard } from "@/components/auth/auth-guard";

export default function VideoGenLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AuthGuard>{children}</AuthGuard>;
}
