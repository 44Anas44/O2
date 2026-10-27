import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button, Field, inputClass } from '../components/ui/Primitives';
import { BRAND } from '../brand';
import { BrandLogo } from '../brand/BrandLogo';

export function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const result = mode === 'in' ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (mode === 'up') {
      setNotice(
        'Compte créé. Si la confirmation par e-mail est activée, vérifiez votre boîte mail avant de vous connecter.'
      );
      setMode('in');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <BrandLogo size={52} />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-ink-900">{BRAND.name}</p>
            <p className="text-xs text-ink-500">{BRAND.tagline}</p>
          </div>
        </div>
        <h1 className="text-lg font-semibold text-ink-900">
          {mode === 'in' ? 'Connexion' : 'Créer un compte'}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Accès réservé à l’équipe du centre. Pour créer votre compte, utilisez l’adresse e-mail avec laquelle l’administrateur vous a invité.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
          <Field label="E-mail">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="vous@exemple.com" />

          </Field>
          <Field label="Mot de passe">
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="••••••••" />

          </Field>

          {error ?
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> :
          null}
          {notice ?
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{notice}</p> :
          null}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Veuillez patienter…' : mode === 'in' ? 'Se connecter' : "S'inscrire"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'in' ? 'up' : 'in');
            setError(null);
            setNotice(null);
          }}
          className="mt-4 w-full text-center text-sm text-ink-500 hover:text-ink-800">

          {mode === 'in' ?
          "Première connexion ? Créer mon compte" :
          'Déjà un compte ? Se connecter'}
        </button>
      </div>
    </div>);

}
