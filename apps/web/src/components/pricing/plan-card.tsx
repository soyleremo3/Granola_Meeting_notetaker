import Link from "next/link";
import { Check } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PlanCard({
  name,
  price,
  priceSuffix,
  description,
  features,
  ctaHref,
  ctaLabel,
  ctaDisabled = false,
  highlighted = false,
}: {
  name: string;
  price: string;
  priceSuffix?: string;
  description: string;
  features: string[];
  ctaHref: string;
  ctaLabel: string;
  ctaDisabled?: boolean;
  highlighted?: boolean;
}) {
  return (
    <Card className={cn("flex flex-col", highlighted && "ring-2 ring-primary")}>
      <CardHeader>
        <CardTitle className="text-lg">{name}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-3xl font-semibold tracking-tight text-foreground">{price}</span>
          {priceSuffix && <span className="text-sm text-muted-foreground">{priceSuffix}</span>}
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="flex flex-col gap-2.5 text-sm">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="border-t-0 bg-transparent">
        {ctaDisabled ? (
          <span className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full cursor-default opacity-70")}>
            {ctaLabel}
          </span>
        ) : (
          <Link
            href={ctaHref}
            className={cn(buttonVariants({ size: "lg", variant: highlighted ? "default" : "outline" }), "w-full")}
          >
            {ctaLabel}
          </Link>
        )}
      </CardFooter>
    </Card>
  );
}
