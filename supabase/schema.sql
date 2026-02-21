create extension if not exists "pgcrypto";

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  url text not null check (char_length(trim(url)) > 0),
  created_at timestamptz not null default now()
);

alter table public.bookmarks replica identity full;

alter table public.bookmarks enable row level security;

drop policy if exists "Users can read own bookmarks" on public.bookmarks;
create policy "Users can read own bookmarks"
on public.bookmarks
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create own bookmarks" on public.bookmarks;
create policy "Users can create own bookmarks"
on public.bookmarks
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own bookmarks" on public.bookmarks;
create policy "Users can delete own bookmarks"
on public.bookmarks
for delete
to authenticated
using (auth.uid() = user_id);

alter publication supabase_realtime add table public.bookmarks;
