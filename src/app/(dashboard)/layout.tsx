import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import WhatsAppSender from '@/components/WhatsAppSender';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <>
      <WhatsAppSender />
      <Sidebar>{children}</Sidebar>
    </>
  );
}
