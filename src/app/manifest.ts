import type { MetadataRoute } from "next";

// Lets people install Deklarado on their phone's home screen like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Deklarado — Class Suspension Alerts",
    short_name: "Deklarado",
    description: "Class and work suspension alerts for Pampanga, from trusted sources.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f6fb",
    theme_color: "#1f3fd1",
    lang: "en-PH",
    categories: ["education", "news", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
