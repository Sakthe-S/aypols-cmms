'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wrench, Shield } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError('Invalid email or password');
      setLoading(false);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 bg-gradient-to-br from-primary-600 to-primary-800 lg:flex lg:flex-col lg:items-center lg:justify-center">
        <div className="text-center text-white">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20">
            <Wrench className="h-10 w-10" />
          </div>
          <h1 className="text-4xl font-bold">Aypols CMMS</h1>
          <p className="mt-3 text-lg text-primary-100">Maintenance & EHS Management System</p>
          <p className="mt-6 max-w-md text-primary-200">
            Streamline your factory maintenance, spare parts inventory, and EHS compliance
            with our comprehensive CMMS platform.
          </p>
        </div>
      </div>
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600 text-white">
              <Wrench className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold text-gray-900">Aypols CMMS</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
          <p className="mt-2 text-sm text-gray-600">Sign in to your account to continue</p>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@aypols.com"
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Enter your password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-8 rounded-lg bg-gray-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Shield className="h-4 w-4" />
              Demo Credentials
            </div>
            <div className="mt-2 space-y-1 text-xs text-gray-500">
              <p>Admin: admin@aypols.com / password123</p>
              <p>Supervisor: rajesh@aypols.com / password123</p>
              <p>Technician: kumar@aypols.com / password123</p>
              <p>Store Admin: murugan@aypols.com / password123</p>
              <p>EHS Officer: priya@aypols.com / password123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
