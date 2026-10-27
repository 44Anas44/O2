import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { DEFAULT_CENTER, type CenterInfo } from '../config/center';

type SettingsValue = {
  /** Coordonnées du centre (valeurs enregistrées, sinon valeurs par défaut). */
  center: CenterInfo;
  loaded: boolean;
  /** Enregistre les coordonnées ; retourne un message d'erreur ou null. */
  save: (info: CenterInfo) => Promise<string | null>;
};

const SettingsContext = createContext<SettingsValue | null>(null);

function fromRow(row: any): CenterInfo {
  const notes = String(row.appointment_notes ?? '').
  split('\n').
  map((line) => line.trim()).
  filter(Boolean);
  return {
    name: row.name || DEFAULT_CENTER.name,
    tagline: row.tagline ?? '',
    address: row.address ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    taxId: row.tax_id ?? '',
    receiptFooter: row.receipt_footer ?? '',
    appointmentNotes: notes,
    logo: row.logo_data ?? ''
  };
}

export function SettingsProvider({ children }: {children: React.ReactNode;}) {
  const { ownerId } = useAuth();
  const [center, setCenter] = useState<CenterInfo>(DEFAULT_CENTER);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!ownerId) {
      setCenter(DEFAULT_CENTER);
      setLoaded(false);
      return;
    }
    let cancelled = false;
    supabase.
    from('center_settings').
    select('*').
    eq('owner_id', ownerId).
    maybeSingle().
    then(({ data }) => {
      if (cancelled) return;
      setCenter(data ? fromRow(data) : DEFAULT_CENTER);
      setLoaded(true);
    });
    return () => {cancelled = true;};
  }, [ownerId]);

  const save = useCallback(
    async (info: CenterInfo) => {
      if (!ownerId) return 'Session invalide.';
      const { error } = await supabase.from('center_settings').upsert({
        owner_id: ownerId,
        name: info.name.trim(),
        tagline: info.tagline.trim(),
        address: info.address.trim(),
        phone: info.phone.trim(),
        email: info.email.trim(),
        tax_id: info.taxId.trim(),
        receipt_footer: info.receiptFooter.trim(),
        appointment_notes: info.appointmentNotes.join('\n'),
        logo_data: info.logo,
        updated_at: new Date().toISOString()
      });
      if (error) return error.message;
      setCenter({
        ...info,
        name: info.name.trim() || DEFAULT_CENTER.name
      });
      return null;
    },
    [ownerId]
  );

  const value = useMemo(() => ({ center, loaded, save }), [center, loaded, save]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings doit être utilisé à l’intérieur de SettingsProvider');
  return context;
}
