import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "@fontsource-variable/fraunces";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "maplibre-gl/dist/maplibre-gl.css";

import { AppShell } from "@/components/app-shell/app-shell";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Field Atlas",
    template: "%s · Field Atlas",
  },
  description: "Put live GPS on any map you can find.",
  applicationName: "Field Atlas",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Field Atlas",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f3efe4",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <AppShell>{children}</AppShell>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
