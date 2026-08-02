export function buildCheckoutUrl(opts: { variantId: string; userId: string; email: string }) {
  const store = process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_SLUG;
  const url = new URL(`https://${store}.lemonsqueezy.com/checkout/buy/${opts.variantId}`);
  url.searchParams.set("checkout[email]", opts.email);
  url.searchParams.set("checkout[custom][user_id]", opts.userId);
  return url.toString();
}
