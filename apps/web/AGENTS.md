<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# SaaS shell (auth, dashboard gating, pricing)

This app has a marketing/auth shell on top of the original dashboard:

- `(marketing)` route group: `/` (landing), `/pricing`, `/login`, `/signup` — public.
- `(app)/dashboard` route group: the original dashboard/meetings/new pages, moved here, gated by `src/proxy.ts` + `dashboard/layout.tsx` (redirects to `/login` if no Supabase session).
- Auth is Supabase (email + password only), project `granola-tr-saas` (org `soyleremo3`). Schema: `public.profiles` (id/email/plan/subscription_status), auto-created via a trigger on `auth.users` insert, RLS locked to select-own-row only. See `supabase/migrations/0001_create_profiles.sql`.
- **Payments are not implemented.** A LemonSqueezy integration (checkout links + webhook) was built and then removed — LemonSqueezy requires identity verification (legal name, address, DOB, ID) before a product can be created, even in test mode, which was too much friction for the project deadline. The `/pricing` page still exists (Free is real; Pro's CTA is a disabled "Yakında" placeholder). If payments are revisited later, either push through LemonSqueezy's KYC or consider Stripe test mode, which does not require business verification to use test API keys.
- Not deployed anywhere yet — verified locally only (`npm run dev` / the `web-dev` launch config). `apps/api` and `apps/extension` are untouched by any of this.
