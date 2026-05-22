import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
  "https://transkripin.app";

const description =
  "Transkripin: ubah suara jadi teks dalam Bahasa Indonesia, Inggris, dan 4 bahasa lain. Upload audio, server self-hosted memproses dengan Whisper open-source. Gratis, tanpa API berbayar.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Transkripin — Ubah Suara Jadi Teks Gratis (Whisper Self-Hosted)",
    template: "%s · Transkripin",
  },
  description,
  applicationName: "Transkripin",
  keywords: [
    "transkripsi audio",
    "speech to text",
    "audio to text indonesia",
    "whisper open source",
    "transcription gratis",
    "faster-whisper",
    "transkrip suara online",
  ],
  authors: [{ name: "Transkripin" }],
  creator: "Transkripin",
  publisher: "Transkripin",
  category: "productivity",
  alternates: { canonical: "/" },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: siteUrl,
    siteName: "Transkripin",
    title: "Transkripin — Ubah Suara Jadi Teks Gratis",
    description,
    images: [
      {
        url: "/og.svg",
        width: 1200,
        height: 630,
        alt: "Transkripin — Server-side speech to text",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Transkripin — Ubah Suara Jadi Teks Gratis",
    description,
    images: ["/og.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b10" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen`}>
        <Providers>
          <Navbar />
          <main>{children}</main>
          <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Transkripin · 100% gratis · Tanpa API berbayar
          </footer>
        </Providers>
      </body>
    </html>
  );
}
