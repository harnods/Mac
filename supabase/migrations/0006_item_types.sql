create type item_type as enum ('ingredient', 'supply', 'product', 'prep_item');
create type category_type as enum ('ingredient', 'supply', 'product');

alter table public.items
  add column type item_type not null default 'ingredient';

alter table public.categories
  add column type category_type not null default 'ingredient';

-- Replace global name uniqueness with per-type uniqueness
alter table public.categories drop constraint if exists categories_name_key;
create unique index if not exists categories_name_type_unique
  on public.categories (name, type);

drop index if exists categories_is_default_unique;
drop index if exists categories_one_default;
create unique index categories_is_default_unique
  on public.categories (type) where (is_default = true);

insert into public.categories (name, is_default, type)
values
  ('Uncategorized', true, 'supply'),
  ('Uncategorized', true, 'product');

create or replace function before_category_delete()
returns trigger language plpgsql security definer as $$
declare
  default_id uuid;
begin
  if old.is_default then
    raise exception 'Cannot delete the default category';
  end if;
  select id into default_id
  from public.categories
  where is_default = true and type = old.type
  limit 1;
  if default_id is not null then
    update public.items
    set category_id = default_id, updated_at = now()
    where category_id = old.id;
  end if;
  return old;
end;
$$;
