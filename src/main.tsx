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
  // Register Service Worker in production
  registerSW({
    onNeedRefresh() {
      console.log('Nova versão disponível. Recarregando...');
      window.location.reload();
    },
    onOfflineReady() {
      console.log('App pronto para uso offline.');
    },
  });
}

// Dynamically load manifest from edge function and update meta tags
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
if (supabaseUrl && !isPreviewHost && !isInIframe) {
  // Remove static manifest link to avoid conflicts with dynamic one
  const existingManifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (existingManifest) existingManifest.remove();

  fetch(`${supabaseUrl}/functions/v1/pwa-manifest`)
    .then((r) => r.json())
    .then((manifest) => {
      // Create dynamic manifest link
      const link = document.createElement("link");
      link.rel = "manifest";
      const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
      link.href = URL.createObjectURL(blob);
      document.head.appendChild(link);

      // Update theme-color
      const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (themeMeta && manifest.theme_color) {
        themeMeta.content = manifest.theme_color;
      }

      // Update apple-touch-icon
      const appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
      if (appleIcon && manifest.icons?.[0]?.src) {
        appleIcon.href = manifest.icons[0].src;
      }

      // Update apple-mobile-web-app-title
      const appTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
      if (appTitle && manifest.name) {
        appTitle.content = manifest.name;
      }
    })
    .catch(() => {
      // Fallback: keep static manifest
    });
}

createRoot(document.getElementById("root")!).render(<App />);
