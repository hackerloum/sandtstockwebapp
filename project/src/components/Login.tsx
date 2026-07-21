import React, { useState } from 'react';
import { AlertCircle, BarChart3, Lock, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const success = await login(username, password);
      if (!success) setError('Invalid username or password');
    } catch {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-md bg-gray-950 text-white">
            <BarChart3 className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-gray-950">S&amp;T Stock</h1>
            <p className="text-sm text-gray-500">Stock and sales management</p>
          </div>
        </div>

        <section className="rounded-md border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-xl font-semibold text-gray-950">Sign in</h2>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Username</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="h-12 w-full rounded-md border border-gray-300 pl-11 pr-4 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 w-full rounded-md border border-gray-300 pl-11 pr-4 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm font-medium text-red-700">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={isLoading} className="h-12 w-full rounded-md bg-gray-950 text-sm font-semibold text-white hover:bg-gray-800 disabled:bg-gray-400">
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </section>

        <p className="mt-4 text-center text-xs text-gray-500">Admin demo: admin / admin</p>
      </div>
    </main>
  );
};
