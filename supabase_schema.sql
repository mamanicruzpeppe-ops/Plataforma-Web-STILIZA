create extension if not exists "uuid-ossp";

drop table if exists public.contact_messages cascade;
drop table if exists public.reservation_items cascade;
drop table if exists public.reservations cascade;
drop table if exists public.promotions cascade;
drop table if exists public.products cascade;
drop table if exists public.clientes cascade;
drop table if exists public.profiles cascade;

-- CLIENTES (nombre + correo)
create table public.clientes (
  id uuid default uuid_generate_v4() primary key,
  full_name text not null,
  email text not null unique,
  created_at timestamptz default now() not null
);

-- PERFILES (dueño / empleado con Auth)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text,
  role text not null default 'cliente'
    check (role in ('cliente', 'empleado', 'dueno')),
  phone text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- PRODUCTOS
create table public.products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text default '',
  material text default '',
  category text not null default 'gala'
    check (category in ('gala', 'casual', 'fiesta', 'boda', 'quinceañera')),
  price numeric(12,2) not null default 0 check (price >= 0),
  image_url text default '',
  sizes text[] default array['S','M','L'],
  is_active boolean default true,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- PROMOCIONES
create table public.promotions (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text default '',
  discount_percent integer default 0,
  discount_label text default '',
  original_price numeric(12,2) default 0,
  category text default '',
  image_url text default '',
  end_date date,
  days_total integer default 20,
  is_active boolean default true,
  created_at timestamptz default now() not null
);

-- RESERVAS / VENTAS
create table public.reservations (
  id uuid default uuid_generate_v4() primary key,
  reservation_number text unique not null,
  customer_name text not null,
  customer_email text default '',
  customer_phone text default '',
  total_amount numeric(12,2) not null default 0,
  deposit_amount numeric(12,2) not null default 0,
  remaining_amount numeric(12,2) not null default 0,
  payment_method text default 'tarjeta'
    check (payment_method in ('tarjeta', 'qr', 'efectivo', 'transferencia')),
  payment_status text default 'pagado'
    check (payment_status in ('pendiente', 'pagado', 'cancelado')),
  pickup_status text default 'pendiente'
    check (pickup_status in ('pendiente', 'recogido', 'expirado', 'vendido')),
  tipo text default 'reserva'
    check (tipo in ('reserva', 'venta_tienda')),
  pickup_deadline date,
  notes text default '',
  employee_email text default '',
  created_by uuid references auth.users on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ÍTEMS DE RESERVA
create table public.reservation_items (
  id uuid default uuid_generate_v4() primary key,
  reservation_id uuid references public.reservations on delete cascade not null,
  product_id uuid references public.products on delete set null,
  product_name text not null,
  size text default 'M',
  unit_price numeric(12,2) not null default 0,
  quantity integer not null default 1,
  created_at timestamptz default now() not null
);

-- MENSAJES DE CONTACTO
create table public.contact_messages (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  email text not null,
  phone text default '',
  message text not null,
  is_read boolean default false,
  created_at timestamptz default now() not null
);

-- Trigger Auth → profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'cliente')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS abierto para la web
alter table public.clientes enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.promotions enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_items enable row level security;
alter table public.contact_messages enable row level security;

create policy "all_clientes" on public.clientes for all using (true) with check (true);
create policy "all_profiles" on public.profiles for all using (true) with check (true);
create policy "all_products" on public.products for all using (true) with check (true);
create policy "all_promotions" on public.promotions for all using (true) with check (true);
create policy "all_reservations" on public.reservations for all using (true) with check (true);
create policy "all_items" on public.reservation_items for all using (true) with check (true);
create policy "all_messages" on public.contact_messages for all using (true) with check (true);