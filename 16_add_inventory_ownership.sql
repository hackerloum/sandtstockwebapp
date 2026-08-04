-- Split product inventory by owner while keeping products.current_stock as total stock.
create extension if not exists "uuid-ossp";

create table if not exists inventory_owners (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  owner_type text not null default 'person' check (owner_type in ('company', 'person')),
  is_default boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create unique index if not exists one_default_inventory_owner
  on inventory_owners (is_default)
  where is_default;

insert into inventory_owners (name, owner_type, is_default, is_active)
values ('Company', 'company', true, true)
on conflict (name) do update
set owner_type = 'company',
    is_default = true,
    is_active = true,
    updated_at = now();

create table if not exists product_owner_stocks (
  product_id uuid not null references products(id) on delete cascade,
  owner_id uuid not null references inventory_owners(id),
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamp with time zone default now(),
  primary key (product_id, owner_id)
);

alter table stock_movements
  add column if not exists owner_id uuid references inventory_owners(id);

alter table order_items
  add column if not exists owner_id uuid references inventory_owners(id);

alter table purchase_order_items
  add column if not exists owner_id uuid references inventory_owners(id);

create or replace function get_default_inventory_owner_id()
returns uuid as $$
  select id from inventory_owners where is_default = true order by created_at limit 1;
$$ language sql stable;

update stock_movements
set owner_id = get_default_inventory_owner_id()
where owner_id is null;

update order_items
set owner_id = get_default_inventory_owner_id()
where owner_id is null;

update purchase_order_items
set owner_id = get_default_inventory_owner_id()
where owner_id is null;

insert into product_owner_stocks (product_id, owner_id, quantity)
select id, get_default_inventory_owner_id(), greatest(current_stock, 0)
from products
where current_stock > 0
on conflict (product_id, owner_id) do update
set quantity = excluded.quantity,
    updated_at = now();

create or replace function update_product_owner_stock()
returns trigger as $$
declare
  resolved_owner_id uuid;
  current_owner_quantity integer;
begin
  if TG_OP = 'INSERT' then
    resolved_owner_id := coalesce(new.owner_id, get_default_inventory_owner_id());

    if resolved_owner_id is null then
      raise exception 'No inventory owner is available for stock movement';
    end if;

    insert into product_owner_stocks (product_id, owner_id, quantity)
    values (new.product_id, resolved_owner_id, 0)
    on conflict (product_id, owner_id) do nothing;

    if new.movement_type = 'in' then
      update product_owner_stocks
      set quantity = quantity + new.quantity,
          updated_at = now()
      where product_id = new.product_id
        and owner_id = resolved_owner_id;
    else
      select quantity
      into current_owner_quantity
      from product_owner_stocks
      where product_id = new.product_id
        and owner_id = resolved_owner_id
      for update;

      if coalesce(current_owner_quantity, 0) < new.quantity then
        raise exception 'Owner stock is not enough for this movement';
      end if;

      update product_owner_stocks
      set quantity = quantity - new.quantity,
          updated_at = now()
      where product_id = new.product_id
        and owner_id = resolved_owner_id;
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists update_owner_stock_after_movement on stock_movements;
create trigger update_owner_stock_after_movement
  after insert on stock_movements
  for each row
  execute function update_product_owner_stock();

alter table inventory_owners enable row level security;
alter table product_owner_stocks enable row level security;

drop policy if exists "Inventory owners viewable by authenticated users" on inventory_owners;
create policy "Inventory owners viewable by authenticated users"
  on inventory_owners for select
  using (auth.role() = 'authenticated');

drop policy if exists "Inventory owners manageable by stock managers" on inventory_owners;
create policy "Inventory owners manageable by stock managers"
  on inventory_owners for all
  using (
    check_user_permission('manage_stock')
    or check_user_permission('edit_product')
    or check_user_permission('add_product')
  )
  with check (
    check_user_permission('manage_stock')
    or check_user_permission('edit_product')
    or check_user_permission('add_product')
  );

drop policy if exists "Product owner stocks viewable by authenticated users" on product_owner_stocks;
create policy "Product owner stocks viewable by authenticated users"
  on product_owner_stocks for select
  using (auth.role() = 'authenticated');

drop policy if exists "Product owner stocks manageable by stock managers" on product_owner_stocks;
create policy "Product owner stocks manageable by stock managers"
  on product_owner_stocks for all
  using (
    check_user_permission('manage_stock')
    or check_user_permission('edit_product')
    or check_user_permission('add_product')
  )
  with check (
    check_user_permission('manage_stock')
    or check_user_permission('edit_product')
    or check_user_permission('add_product')
  );

create index if not exists idx_product_owner_stocks_product_id on product_owner_stocks(product_id);
create index if not exists idx_product_owner_stocks_owner_id on product_owner_stocks(owner_id);
create index if not exists idx_stock_movements_owner_id on stock_movements(owner_id);
create index if not exists idx_order_items_owner_id on order_items(owner_id);
create index if not exists idx_purchase_order_items_owner_id on purchase_order_items(owner_id);
