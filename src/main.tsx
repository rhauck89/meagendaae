import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";
import { ENABLE_PUSH_NOTIFICATIONS } from "@/lib/constants";

// Prevent SW issues in Lovable preview/iframe or if manually disabled
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

const shouldDisableSW = isPreviewHost || isInIframe || !ENABLE_PUSH_NOTIFICATIONS;

if (shouldDisableSW) {
  // Actively unregister any service worker if it shouldn't be here
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((r) => {
        console.log('[PWA] Unregistering service worker:', r.scope);
        r.unregister();
      });
    });
    
    // Also clear caches to prevent stale files if we're disabling PWA
    if (!ENABLE_PUSH_NOTIFICATIONS) {
      window.caches?.keys().then((names) => {
        for (const name of names) {
          console.log('[PWA] Clearing cache:', name);
          window.caches.delete(name);
        }
      });
    }
  }
} else {
  // Register Service Worker in production - non-blocking
  window.addEventListener('load', () => {
    registerSW({
      onNeedRefresh() {
        console.log('Nova versão disponível. Recarregando...');
        if (!window.location.pathname.includes('/auth')) {
          window.location.reload();
        }
      },
      onOfflineReady() {
        console.log('App pronto para uso offline.');
      },
    });
  });
}

// Dynamically load manifest from edge function and update meta tags
const initializePWA = async () => {
  if (shouldDisableSW) return;
  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) return;

  try {
    const existingManifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (existingManifest) existingManifest.remove();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const r = await fetch(`${supabaseUrl}/functions/v1/pwa-manifest`, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!r.ok) return;
    const manifest = await r.json();

    const link = document.createElement("link");
    link.rel = "manifest";
    const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
    link.href = URL.createObjectURL(blob);
    document.head.appendChild(link);

    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeMeta && manifest.theme_color) themeMeta.content = manifest.theme_color;

    const appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (appleIcon && manifest.icons?.[0]?.src) appleIcon.href = manifest.icons[0].src;

    const appTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    if (appTitle && manifest.name) appTitle.content = manifest.name;
  } catch (err) {
    console.warn('[PWA] Dynamic manifest failed:', err);
  }
};

if (typeof window !== 'undefined' && !shouldDisableSW) {
  if (document.readyState === 'complete') {
    initializePWA();
  } else {
    window.addEventListener('load', initializePWA);
  }
}

createRoot(document.getElementById("root")!).render(<App />);

