/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { loginWithEmail } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await loginWithEmail(email, password);
    setLoading(false);

    if (res.error) {
      setError(res.error.message || 'Email atau kata sandi salah.');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-center px-4 py-10 overflow-hidden bg-slate-900">
      {/* Background Foto Gereja HKBP Hutaraja */}
      <div className="pointer-events-none select-none absolute inset-0 z-0">
        <img
          src="/assets/aistudio/WhatsApp_Image_2025-05-14_at_16.01.56_15be8f1f_bea9a36b.jpg"
          alt="Gereja HKBP Hutaraja"
          aria-hidden="true"
          className="w-full h-full object-cover object-center scale-[1.02]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/55 via-slate-900/35 to-slate-950/70" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-sm space-y-6">
        <div className="text-center space-y-2.5">
          <div className="w-16 h-16 rounded-2xl bg-white/95 p-2 shadow-lg border border-white/80 flex items-center justify-center mx-auto">
            <img
              src="/assets/aistudio/Logo-HKBP_02090ed7.png"
              alt="Logo HKBP"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight drop-shadow-sm">
              SISKEU HKBP Hutaraja
            </h1>
            <p className="text-xs text-slate-100 mt-0.5 font-medium drop-shadow-sm">
              Masuk dengan akun pengurus &amp; pelayan gereja
            </p>
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-md p-6 sm:p-7 rounded-2xl border border-white/80 shadow-2xl space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@hkbp-hutaraja.org"
                  autoComplete="email"
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Kata Sandi</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi"
                  autoComplete="current-password"
                  className="w-full h-11 pl-10 pr-11 rounded-xl border border-slate-200 bg-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600"
                  title={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#1E3A8A] hover:bg-[#172D6E] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs"
            >
              <span>{loading ? 'Memverifikasi...' : 'Masuk'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-slate-100 font-medium drop-shadow-sm">
          Pengelolaan akun oleh Administrator HKBP Hutaraja
        </p>
      </div>
    </div>
  );
};
