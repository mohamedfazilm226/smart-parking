import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Car, ShieldCheck, Mail, Lock, Loader2, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { insforge, isInsForgeConfigured } from '../lib/insforge';
import { User } from '../types';

async function insertProfile(userId: string, uiRole: 'customer' | 'admin') {
  const dbRole = uiRole === 'admin' ? 'incharger' : 'customer';
  const { error } = await insforge.database.from('profiles').insert([{ user_id: userId, role: dbRole }]);
  if (error) throw error;
}

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const initialRole = (searchParams.get('role') as 'customer' | 'admin') || 'customer';

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'customer' | 'admin'>(initialRole);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsOtp, setNeedsOtp] = useState(false);
  const [otp, setOtp] = useState('');

  const { refreshSession } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (initialRole) setRole(initialRole);
  }, [initialRole]);

  const navigateFromProfile = async () => {
    await refreshSession();
    const { data: cur } = await insforge.auth.getCurrentUser();
    const uid = cur?.user?.id;
    if (!uid) return;
    const { data: prof } = await insforge.database.from('profiles').select('role').eq('user_id', uid).maybeSingle();
    const uiRole: User['role'] = prof?.role === 'incharger' ? 'admin' : 'customer';
    navigate(uiRole === 'admin' ? '/admin' : '/dashboard');
  };

  const finishSignUp = async (uiRole: 'customer' | 'admin') => {
    await refreshSession();
    navigate(uiRole === 'admin' ? '/admin' : '/dashboard');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isInsForgeConfigured()) {
      setError('Configure VITE_INSFORGE_URL and VITE_INSFORGE_ANON_KEY in .env');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (needsOtp) {
        const { data, error: vErr } = await insforge.auth.verifyEmail({
          email,
          otp: otp.trim(),
        });
        if (vErr) throw vErr;
        if (!data?.user?.id) throw new Error('Verification failed');
        await insertProfile(data.user.id, role);
        await finishSignUp(role);
        return;
      }

      if (isLogin) {
        const { error: sErr } = await insforge.auth.signInWithPassword({ email, password });
        if (sErr) throw sErr;
        await navigateFromProfile();
        return;
      }

      const { data, error: suErr } = await insforge.auth.signUp({
        email,
        password,
        name: email.split('@')[0] || 'User',
      });
      if (suErr) throw suErr;

      if (data?.requireEmailVerification) {
        setNeedsOtp(true);
        setError('');
        return;
      }

      const uid = data?.user?.id;
      if (!uid) throw new Error('Sign up did not return a user');
      await insertProfile(uid, role);
      await finishSignUp(role);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center p-4 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden"
      >
        <div className="p-8">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-zinc-400 hover:text-zinc-600 text-sm font-medium mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>

          <div className="flex justify-center mb-8">
            <div className="bg-emerald-500 p-3 rounded-2xl shadow-lg shadow-emerald-200">
              <Car className="w-8 h-8 text-white" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-center text-zinc-900 mb-2">
            {needsOtp ? 'Verify email' : isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-center text-zinc-500 mb-8">
            {needsOtp
              ? 'Enter the 6-digit code sent to your email'
              : isLogin
                ? 'Enter your credentials to access your account'
                : 'Sign up to start booking your parking slots'}
          </p>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm mb-6 border border-red-100">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {!needsOtp && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-700 ml-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      placeholder="name@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-700 ml-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-700 ml-1">I am a</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setRole('customer')}
                      className={`py-3 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                        role === 'customer'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'
                      }`}
                    >
                      <Car className="w-4 h-4" />
                      Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('admin')}
                      className={`py-3 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                        role === 'admin'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      In-charger
                    </button>
                  </div>
                </div>
              </>
            )}

            {needsOtp && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-zinc-700 ml-1">6-digit code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-center text-2xl tracking-[0.5em] font-mono"
                  placeholder="000000"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-4 rounded-xl shadow-lg shadow-zinc-200 transition-all flex items-center justify-center disabled:opacity-70"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : needsOtp ? 'Verify & continue' : isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-8 text-center space-y-2">
            {!needsOtp && (
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-emerald-600 font-semibold hover:text-emerald-700 transition-colors"
              >
                {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
              </button>
            )}
            {needsOtp && (
              <button
                type="button"
                onClick={() => {
                  setNeedsOtp(false);
                  setOtp('');
                }}
                className="block w-full text-sm text-zinc-500 hover:text-zinc-700"
              >
                Back to sign up
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
