import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Primitives';

/**
 * Remplace window.confirm / window.alert.
 *
 * Les boîtes natives bloquent le processus de rendu : dans Electron (Windows) la fenêtre
 * perd ensuite le focus clavier et les champs n'acceptent plus de texte. Ces boîtes-ci
 * sont de simples fenêtres de l'application, le focus n'en sort jamais.
 */

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** « danger » : le bouton d'annulation a le focus par défaut (action destructive). */
  tone?: 'default' | 'danger';
};

type Request = ConfirmOptions & {alertOnly: boolean;};

type ConfirmApi = {
  /** Résout `true` si l'utilisateur confirme, `false` s'il annule (bouton, Échap ou clic à côté). */
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  /** Message d'information avec un seul bouton. */
  notify: (message: string, title?: string) => Promise<void>;
};

const ConfirmContext = createContext<ConfirmApi | null>(null);

export function ConfirmProvider({ children }: {children: React.ReactNode;}) {
  const [open, setOpen] = useState(false);
  // La demande reste en mémoire après la fermeture pour que le texte ne disparaisse pas pendant l'animation de sortie.
  const [request, setRequest] = useState<Request | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const ask = useCallback((next: Request): Promise<boolean> => {
    // Une seule boîte à la fois : une deuxième demande (double clic, double Échap) vaut « non ».
    if (resolver.current) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setRequest(next);
      setOpen(true);
    });
  }, []);

  const finish = useCallback((value: boolean) => {
    const resolve = resolver.current;
    resolver.current = null;
    setOpen(false);
    resolve?.(value);
  }, []);

  const api = useMemo<ConfirmApi>(() => ({
    confirm: (options) => ask({ ...(typeof options === 'string' ? { message: options } : options), alertOnly: false }),
    notify: async (message, title) => {
      await ask({ message, title, alertOnly: true, confirmLabel: 'OK' });
    }
  }), [ask]);

  const danger = request?.tone === 'danger';

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      <Modal
        open={open}
        onClose={() => finish(false)}
        title={request?.title ?? (request?.alertOnly ? 'Information' : 'Confirmation')}
        width="max-w-sm"
        layer="z-[60]">
        <p className="whitespace-pre-line text-sm text-ink-700">{request?.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          {request?.alertOnly ? null :
          <Button type="button" variant="secondary" autoFocus={danger} onClick={() => finish(false)}>
              {request?.cancelLabel ?? 'Annuler'}
            </Button>}
          <Button type="button" variant={danger ? 'danger' : 'primary'} autoFocus={!danger} onClick={() => finish(true)}>
            {request?.confirmLabel ?? (request?.alertOnly ? 'OK' : 'Confirmer')}
          </Button>
        </div>
      </Modal>
    </ConfirmContext.Provider>);

}

export function useConfirm(): ConfirmApi {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm doit être utilisé dans <ConfirmProvider>.');
  return context;
}
