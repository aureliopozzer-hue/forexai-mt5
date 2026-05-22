import NextAuth, { type NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 dias
  },

  pages: {
    signIn: '/',
    error: '/',
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub     = user.id;
        token.email   = user.email;
        token.name    = user.name;
        token.picture = user.image;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        session.user.email       = token.email as string;
        session.user.name        = token.name as string;
        session.user.image       = token.picture as string;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      // Handle callbackUrl from signIn('google', { callbackUrl: '/app' })
      if (url.startsWith('/')) return `${baseUrl}${url}`;

      // If the URL is on the same origin, allow it
      try {
        const urlObj = new URL(url);
        if (urlObj.origin === baseUrl) return url;
      } catch {}

      // IMPORTANT: On Vercel, if the callback URL comes from a different
      // subdomain (e.g., forexaiproelite.vercel.app vs forexaipro.vercel.app),
      // redirect to the callback URL's path on the current baseUrl instead
      try {
        const urlObj = new URL(url);
        // If it's a Vercel deployment, keep the path but use current baseUrl
        if (urlObj.hostname.endsWith('.vercel.app') && baseUrl.includes('.vercel.app')) {
          return `${baseUrl}${urlObj.pathname}${urlObj.search}`;
        }
      } catch {}

      return baseUrl;
    },
  },

  // Debug mode — remove after fixing
  debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
