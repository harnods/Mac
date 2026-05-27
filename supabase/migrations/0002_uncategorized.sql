-- Add is_default flag to categories and seed the Uncategorized category.
-- Run in Supabase SQL Editor after 0001_init.sql.

begin;

-- 1. Add is_default column
alter table public.categories
  add column if not exists is_default boolean not null default false;

-- 2. Only one default allowed
create unique index if not exists categories_one_default
  on public.categories (is_default)
  where is_default = true;

-- 3. Insert Uncategorized (skip if already exists)
insert into public.categories (name, is_default)
values ('Uncategorized', true)
on conflict (name) do update set is_default = true;

-- 4. Migrate existing items with null category_id to Uncategorized
update public.items
set category_id = (select id from public.categories where is_default = true)
where category_id is null;

-- 5. Trigger: when any non-default category is deleted,
--    reassign its items to the default category before the delete.
create or replace function public.reassign_items_on_category_delete()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  default_id uuid;
begin
  if old.is_default then
    raise exception 'Cannot delete the default category.';
  end if;
  select id into default_id from public.categories where is_default = true;
  if default_id is not null then
    update public.items set category_id = default_id where category_id = old.id;
  end if;
  return old;
end $$;

drop trigger if exists before_category_delete on public.categories;
create trigger before_category_delete
before delete on public.categories
for each row execute function public.reassign_items_on_category_delete();

commit;
