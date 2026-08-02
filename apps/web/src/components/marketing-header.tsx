import Link from "next/link";
import { NotebookPen } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <NotebookPen className="h-4.5 w-4.5" />
          </span>
          <span className="text-base sm:text-lg">Not Defteri</span>
        </Link>

        <nav aria-label="Ana gezinme" className="flex items-center gap-2">
          <Link href="/pricing" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "sm:h-9 sm:px-4")}>
            Fiyatlandırma
          </Link>
          <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "sm:h-9 sm:px-4")}>
            Giriş Yap
          </Link>
          <Link href="/signup" className={cn(buttonVariants({ size: "sm" }), "sm:h-9 sm:px-4")}>
            Ücretsiz Başla
          </Link>
        </nav>
      </div>
    </header>
  );
}
