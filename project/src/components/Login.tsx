import React, { useState } from 'react';
import { AlertCircle, ArrowRight, BarChart3, Lock, Package, ShoppingCart, User, WalletCards } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const highlights = [
  {
    icon: Package,
    title: 'Live inventory',
    copy: 'Track bottles, oils, and packaging by owner with stock that stays accurate after every sale.'
  },
  {
    icon: ShoppingCart,
    title: 'Sales desk',
    copy: 'Record store and pickup sales, print invoices, and keep customer orders in one place.'
  },
  {
    icon: WalletCards,
    title: 'Daily close',
    copy: 'Reconcile cash, expenses, and purchasing so the day ends balanced.'
  }
];

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
    <main className="relative min-h-screen overflow-hidden bg-[#f4efe6] text-[#1c1915]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(28, 25, 21, 0.06) 1px, transparent 0)',
          backgroundSize: '22px 22px'
        }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-[-8rem] h-[28rem] w-[28rem] rounded-full bg-[#0f3d32]/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 bottom-[-10rem] h-[24rem] w-[24rem] rounded-full bg-[#c4a574]/20 blur-3xl" />

      <div className="relative mx-auto grid min-h-screen max-w-6xl lg:grid-cols-[1.15fr_0.85fr]">
        <section className="flex flex-col justify-between px-6 py-8 sm:px-10 lg:px-14 lg:py-12">
          <header className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-md bg-[#10231d] text-[#e8dcc8]">
              <BarChart3 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-semibold tracking-tight">S&amp;T Stock</p>
              <p className="text-sm text-[#6b6258]">Inventory operations</p>
            </div>
          </header>

          <div className="max-w-xl py-12 lg:py-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6b6258]">Fragrance house control</p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight text-[#14110e] sm:text-5xl">
              Stock, sales, and closing — kept in one calm workspace.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-[#5c534b]">
              Sign in to manage products, owner stock, purchasing, and the till. Built for the S&amp;T floor, not a generic dashboard.
            </p>

            <ul className="mt-10 space-y-5">
              {highlights.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.title} className="flex gap-4">
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#d9cfc2] bg-white/70 text-[#0f3d32]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[#14110e]">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-[#6b6258]">{item.copy}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="hidden text-xs text-[#8a8176] lg:block">Authorized staff only. Sessions end after five minutes of inactivity.</p>
        </section>

        <section className="flex items-end px-6 pb-8 sm:px-10 lg:items-center lg:px-8 lg:py-12">
          <div className="w-full rounded-md border border-[#d9cfc2] bg-[#fffaf3] p-6 shadow-[0_24px_60px_rgba(28,25,21,0.08)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6b6258]">Staff access</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#14110e]">Sign in</h2>
            <p className="mt-2 text-sm leading-6 text-[#6b6258]">Use your S&amp;T Stock account to continue.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#3f3a34]" htmlFor="username">Username</label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8a8176]" />
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="h-12 w-full rounded-md border border-[#d9cfc2] bg-white pl-11 pr-4 text-base text-[#14110e] outline-none transition focus:border-[#0f3d32] focus:ring-2 focus:ring-[#0f3d32]/15"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#3f3a34]" htmlFor="password">Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8a8176]" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 w-full rounded-md border border-[#d9cfc2] bg-white pl-11 pr-4 text-base text-[#14110e] outline-none transition focus:border-[#0f3d32] focus:ring-2 focus:ring-[#0f3d32]/15"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#10231d] text-sm font-semibold text-[#f4efe6] transition hover:bg-[#0c1b16] disabled:bg-[#9aa39e]"
              >
                {isLoading ? 'Signing in…' : 'Continue'}
                {!isLoading && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>

            <p className="mt-6 text-xs leading-5 text-[#8a8176] lg:hidden">Authorized staff only. Sessions end after five minutes of inactivity.</p>
          </div>
        </section>
      </div>
    </main>
  );
};
