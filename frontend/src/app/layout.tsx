import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "./AppShell";

export const metadata: Metadata = {
  title: "Hauspunkte",
  description: "Hauspunkte-App",
};

// Inline script to apply saved theme before React hydration (prevents flash)
const themeScript = `(function(){try{var t=localStorage.getItem('hp_color_theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers><AppShell>{children}</AppShell></Providers>
      </body>
    </html>
  );
}
