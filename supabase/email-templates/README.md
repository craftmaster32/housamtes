# Email verification setup (HouseMates)

Signup now uses a **6-digit code** — the same reliable flow the password-reset
screen already uses. New users type the code from their email into the verify
screen; no fragile "click the link" step. This works identically on web and
phone.

The code side is already built and deployed. To turn it on and brand the email,
you do three quick things in the Supabase dashboard. **None of this needs the
terminal.**

---

## 1. Turn email confirmation ON (required)

Supabase Dashboard → **Authentication → Providers → Email**

- Turn **"Confirm email"** ON.
- Save.

That's the switch that makes new users verify before they're let in. With it
off, accounts are created already-verified and the code screen never appears.

> **Heads up for real launch:** Supabase's built-in email sender is meant for
> testing and low volume — it has a small hourly cap and shared deliverability.
> Before a public App Store launch, set up your own sender (Step 3) so
> verification emails always arrive.

While you're there (the two owner-only security items from the playbook):
Dashboard → **Authentication → Policies / Settings** → turn on
**"Leaked password protection"** and confirm **email confirmations are required**.

---

## 2. Paste the branded email (recommended)

Supabase Dashboard → **Authentication → Email Templates → "Confirm signup"**

- **Subject:** `Your HouseMates verification code`
- **Message body (HTML):** open `confirm-signup.html` in this folder, copy
  everything, and paste it into the body box (switch the editor to source/HTML
  if needed).
- Save, then use the **"Send test email"** button to see it land in your inbox.

The template shows the `{{ .Token }}` code big and on-brand. Do **not** remove
the `{{ .Token }}` placeholder — that's what Supabase swaps for the real code.

---

## 3. Make it come from "HouseMates" (later — needs a domain)

Right now emails send from Supabase's shared address
(`noreply@mail.app.supabase.io`, shown as "Supabase Auth"). The **subject and
body are branded HouseMates**, but the _sender name/address_ can only be changed
by connecting your own email service (custom SMTP). That needs a domain you own.

When you have a domain, the easiest path (~15 min):

1. Sign up at **resend.com** (free tier covers this app's volume).
2. Add your domain and add the DNS records Resend gives you (SPF/DKIM) at your
   domain registrar.
3. In Resend, create an **SMTP** credential.
4. Supabase Dashboard → **Authentication → SMTP Settings** → enable custom SMTP
   and fill in:
   - Host: `smtp.resend.com`, Port: `465`
   - Username / Password: from the Resend SMTP credential
   - **Sender name:** `HouseMates`
   - **Sender email:** e.g. `noreply@yourdomain.com`
5. Save and send a test — it now arrives from **HouseMates**.

Ping me when you have the domain and I'll walk through it with you.

---

### How the pieces fit (for reference)

- `stores/authStore.ts` → `verifyEmailOtp()` verifies the code and signs the user in.
- `app/(auth)/verify-email.tsx` → the screen where the code is entered.
- `app/(auth)/signup.tsx` → on signup, routes to the verify screen when
  confirmation is required.
- The template's `{{ .Token }}` is the same code `verifyEmailOtp` checks.
