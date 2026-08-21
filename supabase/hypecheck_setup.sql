-- HypeCheck Supabase setup
-- Run this entire file once in the connected Supabase project's SQL Editor.
-- It is idempotent: re-running it preserves existing data and policies.
-- The mobile app never receives a service-role key; it uses authenticated API
-- requests and short-lived signed Storage upload URLs.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(10, 2) not null check (price >= 0),
  category text not null,
  image_url text,
  store_url text,
  retailer text,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  worth_it boolean not null,
  review_text text not null check (char_length(trim(review_text)) > 0),
  video_url text,
  photo_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.wants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  review_id uuid not null references public.reviews(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, review_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  review_id uuid not null references public.reviews(id) on delete cascade,
  comment_text text not null check (char_length(trim(comment_text)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (follower_id <> following_id),
  unique (follower_id, following_id)
);

create index if not exists reviews_product_created_at_idx on public.reviews(product_id, created_at desc);
create index if not exists reviews_user_created_at_idx on public.reviews(user_id, created_at desc);
create index if not exists wants_user_created_at_idx on public.wants(user_id, created_at desc);
create index if not exists likes_review_idx on public.likes(review_id);
create index if not exists comments_review_created_at_idx on public.comments(review_id, created_at asc);
create index if not exists follows_follower_idx on public.follows(follower_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    -- The UUID suffix makes two people with the same email local-part
    -- collision-safe while retaining a readable username.
    concat(
      coalesce(nullif(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]+', '-', 'g'), ''), 'hypecheck-user'),
      '-',
      substr(new.id::text, 1, 8)
    ),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Aggregate data returned to the app. A product without reviews is intentionally
-- left unrated so the UI can show "Not rated yet".
create or replace view public.product_summaries
with (security_invoker = true)
as
select
  p.id,
  p.name,
  p.description,
  p.price,
  p.category,
  p.image_url,
  p.store_url,
  p.retailer,
  p.created_at,
  round(avg(r.rating)::numeric, 1) as rating,
  count(r.id)::integer as review_count,
  case
    when count(r.id) = 0 then null
    else round(100.0 * count(r.id) filter (where r.worth_it) / count(r.id))::integer
  end as worth_the_hype
from public.products p
left join public.reviews r on r.product_id = p.id
group by p.id;

-- Seed catalog IDs are stable UUIDs so relationships survive frontend updates.
insert into public.products (id, name, description, price, category, image_url, retailer)
values
  ('0ecdd7d2-67e8-4a52-bb75-64312e68dc01', 'Portable Mini Projector', 'A pocket-sized projector that turns any wall into movie night.', 34.99, 'Tech', null, 'HypeCheck Demo'),
  ('da1efefc-6ce7-4c22-9f75-3444071788bc', 'Cloud Skin Barrier Cream', 'A cushiony daily moisturizer for a soft, dewy finish.', 18.00, 'Beauty', null, 'HypeCheck Demo'),
  ('76908b4e-9a38-4b17-a2cc-882515cc4ff9', 'Everyday Sling Bag', 'The tiny crossbody that fits more than it should.', 24.99, 'Fashion', null, 'HypeCheck Demo'),
  ('74f840e9-a4da-425c-b344-5fe8e2c51f92', 'Sunset LED Strip Kit', 'Warm ambient lighting for your desk, shelf, or bedroom.', 16.49, 'Home', null, 'HypeCheck Demo'),
  ('425bb0b4-948b-42b2-98a3-21f7703c2e63', 'FlexFit Resistance Set', 'Five resistance bands with a carry pouch for workouts anywhere.', 21.99, 'Fitness', null, 'HypeCheck Demo')
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  category = excluded.category,
  retailer = excluded.retailer;

insert into storage.buckets (id, name, public)
values
  ('review-videos', 'review-videos', true),
  ('review-images', 'review-images', true),
  ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.reviews enable row level security;
alter table public.wants enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;

drop policy if exists "Public profiles are readable" on public.profiles;
create policy "Public profiles are readable" on public.profiles for select using (true);
drop policy if exists "Users manage their own profile" on public.profiles;
create policy "Users manage their own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Products are readable" on public.products;
create policy "Products are readable" on public.products for select using (true);
drop policy if exists "Reviews are readable" on public.reviews;
create policy "Reviews are readable" on public.reviews for select using (true);
drop policy if exists "Users manage their own reviews" on public.reviews;
create policy "Users manage their own reviews" on public.reviews for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage their own wants" on public.wants;
create policy "Users manage their own wants" on public.wants for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Likes are readable" on public.likes;
create policy "Likes are readable" on public.likes for select using (true);
drop policy if exists "Users manage their own likes" on public.likes;
create policy "Users manage their own likes" on public.likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Comments are readable" on public.comments;
create policy "Comments are readable" on public.comments for select using (true);
drop policy if exists "Users manage their own comments" on public.comments;
create policy "Users manage their own comments" on public.comments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Follows are readable" on public.follows;
create policy "Follows are readable" on public.follows for select using (true);
drop policy if exists "Users manage their own follows" on public.follows;
create policy "Users manage their own follows" on public.follows for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

drop policy if exists "Public review media is readable" on storage.objects;
create policy "Public review media is readable" on storage.objects for select
  using (bucket_id in ('review-videos', 'review-images', 'avatars'));
drop policy if exists "Users upload own review media" on storage.objects;
create policy "Users upload own review media" on storage.objects for insert to authenticated
  with check (
    bucket_id in ('review-videos', 'review-images', 'avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "Users update own review media" on storage.objects;
create policy "Users update own review media" on storage.objects for update to authenticated
  using ((storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users delete own review media" on storage.objects;
create policy "Users delete own review media" on storage.objects for delete to authenticated
  using ((storage.foldername(name))[1] = auth.uid()::text);