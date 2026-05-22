import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Home, FileQuestion } from "lucide-react";

export const metadata: Metadata = {
  title: "Halaman tidak ditemukan",
  description:
    "Halaman yang kamu cari tidak tersedia. Kembali ke halaman utama Transkripin.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <section className="container flex min-h-[70vh] items-center justify-center py-16">
      <div className="mx-auto max-w-xl text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 text-white shadow-lg">
          <FileQuestion className="h-8 w-8" />
        </div>
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
          Error 404
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
          Halaman tidak ditemukan
        </h1>
        <p className="mx-auto mt-4 max-w-md text-muted-foreground">
          URL yang kamu buka mungkin sudah dipindah atau tidak pernah ada.
          Coba kembali ke beranda dan mulai transkripsi audio dari sana.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href="/">
              <Home className="h-4 w-4" />
              Kembali ke beranda
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/#workspace">Mulai transkripsi</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
