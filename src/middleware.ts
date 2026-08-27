import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/login',
  },
});

export const config = {
  matcher: ['/dashboard/:path*', '/tickets/:path*', '/machines/:path*', '/inventory/:path*', '/pm/:path*', '/ehs/:path*', '/reports/:path*', '/notifications/:path*', '/settings/:path*'],
};
