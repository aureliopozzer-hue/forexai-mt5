'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import {
  SessionProvider,
  useSession,
  signIn as nextAuthSignIn,
  signOut as nextAuthSignOut,
} from 'next-auth/react';
import { toast } from 'sonner';

interface AuthUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  isPro: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  isPro: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

function AuthContextProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [user, setUser]   = useState<AuthUser | null>(null);
  const [isPro, setIsPro] = useState(false);

  const loading = status === 'loading';

  // Sincroniza sessão → estado local + banco
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const u = session.user as any;
      const userData: AuthUser = {
        id:    u.id ?? u.email ?? '',
        name:  u.name  ?? null,
        email: u.email ?? null,
        image: u.image ?? null,
      };
      setUser(userData);

      // Sincroniza com o banco e busca isPro + créditos
      fetch('/api/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: u.email, name: u.name, image: u.image }),
      })
        .then(r => r.json())
        .then(data => {
          if (data?.isPro) setIsPro(true);
          // Notifica o sistema de créditos que o login aconteceu
          try { localStorage.setItem('forexai-auth-login', Date.now().toString()); } catch {}
          // Dispatch custom event for SAME-TAB notification (StorageEvent only fires in other tabs)
          window.dispatchEvent(new CustomEvent('forexai-credits-refresh'));
        })
        .catch(() => {});

    } else if (status === 'unauthenticated') {
      setUser(null);
      setIsPro(false);
    }
  }, [session, status]);

  const signInWithGoogle = useCallback(async () => {
    try {
      await nextAuthSignIn('google', { callbackUrl: '/app' });
    } catch {
      toast.error('Erro ao entrar com Google. Tente novamente.');
    }
  }, []);

  const signOut = useCallback(async () => {
    setUser(null);
    setIsPro(false);
    toast.success('Sessão encerrada');
    await nextAuthSignOut({ callbackUrl: '/' });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut, isPro }}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthContextProvider>
        {children}
      </AuthContextProvider>
    </SessionProvider>
  );
}
