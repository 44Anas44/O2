import type { BrandTheme } from '../types';

/** Habillage de l'application : vert, menu clair, angles nets. À personnaliser. */
export const theme: BrandTheme = {
  brand: {
    50: '#edfbf3', 100: '#d3f5e1', 200: '#a8eac6', 300: '#71d8a4', 400: '#3cbe80',
    500: '#17a063', 600: '#0c8150', 700: '#0a6742', 800: '#0b5237', 900: '#0a442f'
  },
  ink: {
    50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8',
    500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a'
  },
  font: {
    family: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
    googleUrl: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap'
  },
  sidebar: 'light',
  radius: 'sharp',
  center: {
    address: '',
    phone: '',
    email: '',
    taxId: '',
    receiptFooter: 'Merci de votre confiance.',
    appointmentNotes: ['Merci de vous présenter quelques minutes avant l’heure du rendez-vous.']
  }
};
