# Smart Bookmark App

Simple bookmark manager built with:
- Next.js (App Router)
- Supabase (Auth + Postgres + Realtime)
- Tailwind CSS

## Features Implemented

1. Google OAuth login only (no email/password flow)
2. Logged-in users can add bookmarks (title + URL)
3. Bookmarks are private per user (RLS policies)
4. Bookmark list updates in real time across tabs
5. Users can delete only their own bookmarks
6. Ready for Vercel deployment

## Local Setup

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env.local
```

3. Add values in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

4. In Supabase SQL editor, run `supabase/schema.sql`.

5. Configure Google provider in Supabase:
- Go to `Authentication -> Providers -> Google`
- Add Google Client ID and Secret from Google Cloud Console
- Enable the provider

Google Cloud Console checklist:
- Create OAuth consent screen
- Create OAuth 2.0 Client ID (Web application)
- Authorized redirect URI must include:
  - `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`

6. Add Supabase auth URLs:
- Go to `Authentication -> URL Configuration`
- Site URL: `http://localhost:3000`
- Redirect URLs:
  - `http://localhost:3000`
  - your Vercel domain (after deployment), for example `https://your-app.vercel.app`

7. Run locally:
```bash
npm run dev
```

## Database Design

`bookmarks` table:
- `id` (uuid, PK)
- `user_id` (uuid, references `auth.users.id`)
- `title` (text)
- `url` (text)
- `created_at` (timestamptz)

RLS policies ensure users can only:
- read their own bookmarks
- insert their own bookmarks
- delete their own bookmarks

Realtime is enabled by adding `public.bookmarks` to `supabase_realtime` publication.
`REPLICA IDENTITY FULL` is set so delete events also carry full row data for filtering.

## Deploy to Vercel

1. Push this project to a public GitHub repo.
2. Import the repo in Vercel.
3. Add environment variables in Vercel project settings:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy.
5. Copy deployed URL and add it to Supabase `URL Configuration`:
- Site URL = Vercel URL
- Redirect URL includes Vercel URL

## Assignment Mapping

- Requirement 1: Google OAuth implemented via `supabase.auth.signInWithOAuth({ provider: "google" })`
- Requirement 2: Add bookmark form in UI
- Requirement 3: RLS + `user_id` filter
- Requirement 4: Supabase Realtime subscription on `bookmarks` changes
- Requirement 5: Delete button with row-level delete policy
- Requirement 6: Vercel deployment steps provided above

## Problems Faced and How They Were Solved

1. OAuth redirect mismatch:
- Problem: login succeeds in Google but returns error in app.
- Solution: updated Supabase `Site URL` and `Redirect URLs` for both localhost and Vercel URL.

2. Users seeing each other's data:
- Problem: without strict RLS, data can leak between users.
- Solution: enabled RLS and added `auth.uid() = user_id` policies for `select`, `insert`, and `delete`.

3. Realtime events not firing:
- Problem: bookmark list did not refresh live across tabs.
- Solution: added `bookmarks` table to `supabase_realtime` publication and subscribed to `postgres_changes`.

4. URL input validation:
- Problem: users can submit invalid URLs or missing protocol.
- Solution: normalized input by auto-prefixing `https://` and validating with `new URL(...)` before insert.
