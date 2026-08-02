import { Suspense } from "react";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata = {
  title: "Kaydol — Not Defteri",
};

export default function SignupPage() {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-16 sm:px-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Ücretsiz Hesap Oluştur</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kredi kartı gerekmez, hemen kullanmaya başlayın.
        </p>
      </div>
      <Suspense>
        <SignupForm />
      </Suspense>
    </div>
  );
}
