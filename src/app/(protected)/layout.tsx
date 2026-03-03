import { ProtectedLayout } from '@/components/layout/ProtectedLayout';

export default function ProtectedRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedLayout>{children}</ProtectedLayout>;
}
