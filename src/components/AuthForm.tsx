import { useState, useEffect, type ReactNode } from 'react';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signIn, getProviders, type AuthProvider } from '@/lib/auth-client';
import GoogleIcon from './GoogleIcon';
import OktaIcon from './OktaIcon';

const oauthProviders: Record<string, { icon: ReactNode; label: string; path: string }> = {
  google: { icon: <GoogleIcon />, label: 'Continue with Google', path: '/api/auth/google' },
  keycloak: { icon: <KeyRound size={20} />, label: 'Continue with Keycloak', path: '/api/auth/keycloak' },
  okta: { icon: <OktaIcon />, label: 'Continue with Okta', path: '/api/auth/okta' },
};

interface AuthFormProps {
  onSuccess: () => void;
}

export default function AuthForm({ onSuccess }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<AuthProvider[]>([]);

  useEffect(() => {
    getProviders().then(setProviders);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const err = await signIn(email, password);
    setLoading(false);

    if (err) {
      setError(err);
      return;
    }
    onSuccess();
  };

  const hasBasic = providers.some((p) => p.name === 'basic');
  const oauthEntries = providers
    .filter((p) => p.name !== 'basic' && p.name in oauthProviders)
    .map((p) => ({ key: p.name, requiredPlan: p.requiredPlan, ...oauthProviders[p.name] }));
  const hasOAuth = oauthEntries.length > 0;

  if (providers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {oauthEntries.map(({ key, icon, label, path, requiredPlan }) => (
        <div key={key}>
          <Button
            onClick={() => { if (!requiredPlan) window.location.href = path; }}
            variant="outline"
            className="w-full"
            size="lg"
            disabled={!!requiredPlan}
          >
            {icon}
            <span className="ml-2">{label}</span>
          </Button>
          {requiredPlan && (
            <p className="mt-1 text-center text-xs text-muted-foreground">
              Requires {requiredPlan} plan — <a href="https://docs.pgconsole.com/configuration/license#purchasing-a-license" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Get a license</a>
            </p>
          )}
        </div>
      ))}

      {hasOAuth && hasBasic && (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-muted-foreground">or</span>
          </div>
        </div>
      )}

      {hasBasic && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      )}
    </div>
  );
}
