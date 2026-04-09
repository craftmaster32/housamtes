# Spec: Auth & House System

**Phase:** 1
**Status:** Ready to build
**Depends on:** Phase 0 (Environment Setup) complete

---

## Context

Three housemates need individual accounts linked to a shared "house".
The first person creates the house, gets an invite code, and shares it.
The others use the invite code to join. All data in the app is scoped to the house.

---

## Data Model

```
-- Extends Supabase's built-in auth.users table
user_profiles
  id: uuid PK (same as auth.users.id)
  full_name: text NOT NULL
  avatar_color: text NOT NULL DEFAULT '#6366f1' (hex color)
  push_token: text nullable (set when notifications enabled)
  notification_prefs: jsonb DEFAULT all_enabled
  created_at: timestamptz DEFAULT now()
  updated_at: timestamptz DEFAULT now()

houses
  id: uuid PK
  name: text NOT NULL (2–50 chars)
  address: text nullable
  invite_code: text UNIQUE NOT NULL (8 chars, e.g. 'NEST4821')
  parking_advance_days: integer DEFAULT 2 (1–14)
  parking_approval_type: enum (all_members, any_one_member) DEFAULT all_members
  created_by_user_id: uuid FK → auth.users
  created_at: timestamptz DEFAULT now()
  updated_at: timestamptz DEFAULT now()

house_members
  id: uuid PK
  house_id: uuid FK → houses ON DELETE CASCADE
  user_id: uuid FK → auth.users ON DELETE CASCADE
  role: enum (admin, member) DEFAULT member
  joined_at: timestamptz DEFAULT now()
  UNIQUE(house_id, user_id)
```

---

## Screens

### Screen 1: Welcome (`app/index.tsx`)
- App logo + tagline
- "Get Started" button → Sign Up
- "Already have an account? Log In" link
- Auto-redirects to Dashboard if session exists (app reopen)

### Screen 2: Sign Up (`app/(auth)/signup.tsx`)
- Full name input
- Email input
- Password input (with show/hide toggle)
- Confirm password input
- "Create Account" button
- "Already have an account? Log In" link
- Inline validation on all fields (shown on blur, not on keystroke)
- Loading state on button while submitting

### Screen 3: Email Verification (`app/(auth)/verify-email.tsx`)
- Message: "Check your email — we sent a link to [email]"
- "Resend email" link (debounced — 60 second cooldown)
- "Wrong email? Go back" link
- Auto-advances to next screen when email is verified (polling or deep link)

### Screen 4: Login (`app/(auth)/login.tsx`)
- Email input
- Password input (with show/hide toggle)
- "Log In" button
- "Forgot Password?" link
- "Don't have an account? Sign Up" link
- Loading state on button

### Screen 5: Forgot Password (`app/(auth)/forgot-password.tsx`)
- Email input
- "Send Reset Link" button
- Confirmation message: "Reset link sent to [email]"
- "Back to Login" link

### Screen 6: Onboarding — No House (`app/(auth)/onboarding.tsx`)
- Shown after first login if user has no house
- Two options:
  - "Create a House" (large button)
  - "Join a House" (large button)

### Screen 7: Create House (`app/(auth)/create-house.tsx`)
- House name input (2–50 chars)
- Address input (optional)
- "Create House" button
- After creation: show invite code prominently
  - Large code display: "NEST-4821"
  - "Copy Code" button (copies to clipboard)
  - "Share" button (opens iOS share sheet with pre-written message)
  - "Go to Dashboard" button

### Screen 8: Join House (`app/(auth)/join-house.tsx`)
- Invite code input (auto-formats with dash: XXXX-XXXX)
- "Find House" button
- After valid code: shows house name + member count
  - "Join [House Name]?" with member count
  - "Confirm" and "Cancel" buttons
- Error if invalid code: "Invalid code. Ask your housemate for the correct code."

### Screen 9: House Settings (`app/(tabs)/more/settings.tsx`)
- Members section: list of all members with name, avatar, role, joined date
  - Admin can remove member (confirmation required)
  - Admin can change member role
- House section:
  - Edit house name (admin only)
  - Regenerate invite code (admin only, confirmation: "Old code will stop working")
  - View + copy current invite code
- Parking settings:
  - Advance booking window (slider: 1–14 days, shows "X days")
  - Approval type (toggle: All members / Any one member)
- My account section:
  - Edit display name
  - Edit avatar color
  - Push notification preferences (per event type)
- Danger zone:
  - "Leave House" (with confirmation — admin cannot leave if they are the only admin)
  - "Sign Out"

---

## Acceptance Scenarios

### Scenario A — New user sign up
```
GIVEN I open the app for the first time
WHEN I enter my name, a valid email, and a password (8+ chars)
AND tap "Create Account"
THEN I receive a verification email
AND see the "Check your email" screen

WHEN I click the link in the email
THEN my account is verified
AND the app navigates to the onboarding screen (create or join house)
```

### Scenario B — Duplicate email
```
GIVEN an account already exists with "alex@email.com"
WHEN I try to sign up with the same email
THEN I see: "This email is already registered. Try logging in instead."
AND no new account is created
```

### Scenario C — Password too short
```
GIVEN I type a password with 5 characters
WHEN I move to the next field
THEN I immediately see: "Password must be at least 8 characters"
AND the Create Account button remains disabled
```

### Scenario D — Create house and invite housemates
```
GIVEN I am logged in with no house
WHEN I tap "Create a House" and enter "The Flat"
THEN the house is created
AND I see the invite code "NEST-4821" (example)
AND I can copy it or share it

WHEN Housemate 2 enters "NEST-4821"
THEN they see: "Join The Flat? 1 member already inside"
WHEN they confirm
THEN they join the house
AND I see them appear in the members list immediately
```

### Scenario E — Invalid invite code
```
GIVEN I enter invite code "XXXX-0000"
THEN I see: "Invalid code. Ask your housemate for the correct code."
AND I am not added to any house
```

### Scenario F — Session persistence
```
GIVEN I am logged in and close the app
WHEN I reopen the app within 30 days
THEN I am automatically taken to the Dashboard
AND no login is required

GIVEN I have been inactive for more than 30 days
WHEN I open the app
THEN I am taken to the Login screen
```

### Scenario G — House settings: parking window
```
GIVEN I am admin and open House Settings
WHEN I change the advance booking window from 2 days to 7 days
THEN the change saves immediately
AND the parking reservation form now allows bookings up to 7 days ahead
```

---

## Edge Cases to Handle

- User creates house, gives code to housemate, then regenerates code → old code stops working, new code works
- Admin tries to leave house while being the only admin → must first promote another member to admin, then can leave
- User tries to join a house they are already in → "You're already in this house"
- Email verification link expires (after 24 hours) → show "Link expired. Request a new verification email." with button
- Invalid email format entered → shown immediately: "Please enter a valid email address"

---

## Security Notes

- Passwords handled entirely by Supabase Auth — never stored or logged by the app
- Session tokens stored in `expo-secure-store` (encrypted on device)
- Invite codes are 8 characters alphanumeric — not guessable by brute force in reasonable time
- RLS ensures a user in House A cannot access any data from House B, even if they somehow obtain a valid House B `house_id`
