import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Transkripin — Ubah Suara Jadi Teks Gratis",
  description:
    "Rekam suara, upload audio, dan dapatkan teks transkripsi langsung dari browser tanpa API berbayar.",
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
