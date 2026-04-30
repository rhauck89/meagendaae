import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// PWA/push is disabled. Keep this small cleanup non-blocking so old service
// workers do not keep serving stale app bundles.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => registrations.forEach((r) => r.unregister()))
      .catch((err) => console.warn("[PWA] Service worker cleanup failed:", err));

    window.caches
      ?.keys()
      .then((names) => Promise.all(names.map((name) => window.caches.delete(name))))
      .catch((err) => console.warn("[PWA] Cache cleanup failed:", err));
  });
}

createRoot(document.getElementById("root")!).render(<App />);
