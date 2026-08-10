# ✅ My To-Do List (super simple)

Things **I** (the owner) need to do. Claude did all the code. Tick each box as you go.

---

## 🟢 PART 1 — Make the new changes live

Do these 3 in order. This is all it takes to go live.

- [ ] **1. Merge the pull request** on GitHub — click the green **Merge** button on PR #194.
      _(Nothing happens until you do this.)_
- [ ] **2. Put the app online** — in the terminal, run:
      `npm run deploy`
- [ ] **3. Update the database** — in the terminal, run:
      `npx supabase db push`

✅ That's it. The new sign-up screen, updated Terms/Privacy, and fixes are now live.

---

## 🟡 PART 2 — At launch (when strangers can join) — optional for now

- [ ] **4. Lock the notifications (the "cron secret")** so no stranger can spam your users:
  - Terminal: `supabase secrets set CRON_SECRET=` **+ a long random password**
  - Supabase website → each scheduled job → add a header:
    `x-cron-secret` = **the same password**
  - _(Ask Claude: "walk me through the cron secret" and it'll help.)_
- [ ] **5. Deploy the notification functions** (only needed if you did step 4):
      `npx supabase functions deploy daily-joke bill-due-reminder chore-due-reminder grocery-reminder-check`

_(If you skip Part 2, notifications still work exactly the same. It's just extra safety.)_

---

## 🔵 PART 3 — Before the App Store (the big stuff, later)

- [ ] **6.** Make an **Apple Developer** account (~$99/year).
- [ ] **7.** Set up the email inboxes: **support@ · privacy@ · safety@ · legal@** housemates.app
      _(Your Terms/Privacy promise these work — even simple forwards are fine.)_
- [ ] **8.** Pick the final name: **HouseMates** or **Nestiq**, and check it's free on the App Store.
- [ ] **9.** Leave **Premium & Ads OFF** (already off — don't touch until Claude sets up payments).

---

### 🔑 Do I need to set any secrets right now?

**No.** The only secret is the optional `CRON_SECRET` in **Part 2**, and you can skip it for now.

### 💬 Two terminal commands you'll use again and again

- `npm run deploy` → puts app changes online
- `npx supabase db push` → applies database changes
