import { Capacitor } from '@capacitor/core';
import { BRAND } from './brand';

/** Réglages propres à l'application mobile (barre d'état, écran de démarrage). */
export async function initNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
    import('@capacitor/status-bar'),
    import('@capacitor/splash-screen')]
    );
    await StatusBar.setBackgroundColor({ color: BRAND.brand[700] });
    await StatusBar.setStyle({ style: Style.Dark });
    await SplashScreen.hide();
  } catch {
    // Plugin indisponible : l'application fonctionne quand même.
  }
}
