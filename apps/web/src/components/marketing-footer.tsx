import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>&copy; {new Date().getFullYear()} Not Defteri. Tüm hakları saklıdır.</p>
        <nav className="flex items-center gap-4">
          <Link href="/pricing" className="hover:text-foreground">
            Fiyatlandırma
          </Link>
          <Link href="/login" className="hover:text-foreground">
            Giriş Yap
          </Link>
          <Link href="/signup" className="hover:text-foreground">
            Kaydol
          </Link>
        </nav>
      </div>
    </footer>
  );
}
