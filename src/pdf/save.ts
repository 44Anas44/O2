import type { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';

/**
 * Enregistre un PDF généré.
 *  - Navigateur / application de bureau : téléchargement classique.
 *  - Application mobile (Android / iOS) : le téléchargement par lien ne fonctionne pas dans
 *    la WebView ; on écrit le fichier puis on ouvre la feuille de partage (Enregistrer,
 *    WhatsApp, Imprimer, E-mail…).
 */
export async function savePdf(doc: jsPDF, filename: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    doc.save(filename);
    return;
  }
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
  import('@capacitor/filesystem'),
  import('@capacitor/share')]
  );
  const base64 = doc.output('datauristring').split(',')[1];
  const written = await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
  await Share.share({ title: filename, url: written.uri, dialogTitle: 'Enregistrer ou partager le PDF' });
}
