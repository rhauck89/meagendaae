import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";

// Prevent SW issues in Lovable preview/iframe
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

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
} else {
  // Register Service Worker in production - non-blocking
  window.addEventListener('load', () => {
    registerSW({
      onNeedRefresh() {
        console.log('Nova versão disponível. Recarregando...');
        // Only reload if we're not in the middle of a critical action
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
// Moved inside a safe check to never block app execution
const initializePWA = async () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl || isPreviewHost || isInIframe) return;

  try {
    // Remove static manifest link to avoid conflicts with dynamic one
    const existingManifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (existingManifest) existingManifest.remove();

    // Use a timeout for the fetch to ensure it doesn't hang the app
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const r = await fetch(`${supabaseUrl}/functions/v1/pwa-manifest`, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!r.ok) return;
    const manifest = await r.json();

    // Create dynamic manifest link
    const link = document.createElement("link");
    link.rel = "manifest";
    const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
    link.href = URL.createObjectURL(blob);
    document.head.appendChild(link);

    // Update meta tags
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

// Run PWA initialization without blocking main thread
if (typeof window !== 'undefined') {
  if (document.readyState === 'complete') {
    initializePWA();
  } else {
    window.addEventListener('load', initializePWA);
  }
}

createRoot(document.getElementById("root")!).render(<App />);
