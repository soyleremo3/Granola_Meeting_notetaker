"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, ListChecks, NotebookPen, Plus, User } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AiSettingsDialog } from "@/components/ai-settings-dialog";
import { SignOutButton } from "@/components/sign-out-button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <NotebookPen className="h-4.5 w-4.5" />
          </span>
          <span className="text-base sm:text-lg">Not Defteri</span>
        </Link>

        <nav aria-label="Ana gezinme" className="flex items-center gap-2">
          <AiSettingsDialog />
          <Link
            href="/dashboard/meetings"
            aria-label="Toplantılar"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "sm:h-9 sm:px-4")}
          >
            <ListChecks className="h-4 w-4 sm:hidden" />
            <span className="hidden sm:inline">Toplantılar</span>
          </Link>
          <Link href="/dashboard/new" className={cn(buttonVariants({ size: "sm" }), "sm:h-9 sm:px-4")}>
            <Plus className="h-4 w-4" />
            Yeni Toplantı
          </Link>

          {email && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Hesap menüsü" />}>
                <User className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href="/dashboard/account" />}>
                  <CreditCard className="h-4 w-4" />
                  Hesap ve Abonelik
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <SignOutButton />
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>
      </div>
    </header>
  );
}
