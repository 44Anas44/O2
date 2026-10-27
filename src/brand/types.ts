export type Scale = Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, string>;

/** Coordonnées imprimées sur les PDF (modifiables ensuite dans Paramètres). */
export type CenterInfo = {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  /** Matricule fiscal. */
  taxId: string;
  receiptFooter: string;
  /** Consignes du bon de rendez-vous (une ligne = une puce). */
  appointmentNotes: string[];
  /** Logo importé dans Paramètres (image PNG en data URL) ; vide = logo par défaut de la marque. */
  logo: string;
};

/** Identité (brands.json) : partagée avec les scripts d'empaquetage. */
export type BrandIdentity = {
  appId: string;
  productName: string;
  name: string;
  initials: string;
  tagline: string;
};

/** Habillage visuel d'une marque. */
export type BrandTheme = {
  /** Couleur principale (50 = très clair ... 900 = très foncé). */
  brand: Scale;
  /** Neutres : fonds, bordures, textes. */
  ink: Scale;
  font: {
    family: string;
    /** URL Google Fonts (facultatif ; hors-ligne la police système prend le relais). */
    googleUrl?: string;
  };
  /** Menu latéral sombre ou clair. */
  sidebar: 'dark' | 'light';
  /** Arrondi des cartes et boutons. */
  radius: 'soft' | 'sharp';
  /** Valeurs par défaut des coordonnées du centre. */
  center: Omit<CenterInfo, 'name' | 'tagline' | 'logo'>;
};

export type Brand = BrandIdentity &
BrandTheme & {
  id: string;
  /** Logo PNG (data URL) si `logo.png` existe dans le dossier de la marque. */
  logo?: string;
};
