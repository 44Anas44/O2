import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { XIcon } from 'lucide-react';

/**
 * Pile des fenêtres ouvertes : seule la plus haute réagit à Échap.
 * Sans cela, une confirmation ouverte par-dessus une fenêtre fermerait les deux.
 */
const openStack: symbol[] = [];

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  width = 'max-w-lg',
  layer = 'z-50'
}: {open: boolean;onClose: () => void;title: string;description?: string;children: React.ReactNode;width?: string;layer?: string;}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dialogRef = useRef<HTMLDivElement>(null);

  // Échap, seulement pour la fenêtre la plus haute.
  useEffect(() => {
    if (!open) return;
    const id = Symbol('modal');
    openStack.push(id);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (openStack[openStack.length - 1] !== id) return;
      onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      const index = openStack.indexOf(id);
      if (index !== -1) openStack.splice(index, 1);
    };
  }, [open]);

  // Le focus est rendu à l'élément qui l'avait avant l'ouverture. Sans cela, après la
  // fermeture d'une fenêtre le focus reste sur <body> et le champ semble « bloqué ».
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Si rien dans la fenêtre n'a pris le focus (pas de champ en autoFocus), on le donne à la fenêtre.
    const frame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (dialog && !dialog.contains(document.activeElement)) dialog.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (previous && previous !== document.body && document.contains(previous)) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open ?
      <div className={`fixed inset-0 ${layer} flex items-start justify-center overflow-y-auto p-4 sm:items-center`}>
          <motion.div
          className="fixed inset-0 bg-ink-900/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
          onClick={onClose} />

          <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          className={`relative z-10 w-full ${width} rounded-xl border border-ink-100 bg-white shadow-pop focus:outline-none`}
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 4 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}>

            <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-ink-900">{title}</h2>
                {description ?
              <p className="mt-0.5 text-sm text-ink-500">{description}</p> :
              null}
              </div>
              <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="rounded-lg p-1.5 text-ink-400 transition-colors duration-150 ease-out hover:bg-ink-50 hover:text-ink-700">

                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4">{children}</div>
          </motion.div>
        </div> :
      null}
    </AnimatePresence>);

}
