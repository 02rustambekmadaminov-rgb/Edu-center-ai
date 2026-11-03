create extension if not exists pgcrypto;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  role_key text not null unique,
  name_uz text not null,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  permission_key text not null unique,
  name_uz text not null,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null unique,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, code)
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete restrict,
  role_id uuid not null references public.roles(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_memberships_user_active_idx
  on public.organization_memberships (user_id, is_active, organization_id);
create index branches_organization_idx on public.branches (organization_id);
create index users_auth_user_idx on public.users (auth_user_id);

insert into public.roles (role_key, name_uz) values
  ('super_admin', 'Super administrator'),
  ('director', 'Markaz direktori'),
  ('branch_director', 'Filial direktori'),
  ('administrator', 'Administrator'),
  ('sales_manager', 'Sotuv menejeri'),
  ('support_teacher', 'Support teacher'),
  ('teacher', 'Ustoz'),
  ('finance_manager', 'Moliyachi'),
  ('parent', 'Ota-ona'),
  ('student', 'O‘quvchi');

insert into public.permissions (permission_key, name_uz) values
  ('organization.read', 'Markaz ma’lumotlarini ko‘rish'),
  ('organization.manage', 'Markaz sozlamalarini boshqarish'),
  ('branches.read', 'Filiallarni ko‘rish'),
  ('branches.manage', 'Filiallarni boshqarish'),
  ('users.read', 'Xodimlarni ko‘rish'),
  ('users.manage', 'Xodimlarni boshqarish'),
  ('leads.read', 'Murojaatlarni ko‘rish'),
  ('leads.manage', 'Murojaatlarni boshqarish'),
  ('students.read', 'O‘quvchilarni ko‘rish'),
  ('students.manage', 'O‘quvchilarni boshqarish'),
  ('academics.read', 'Akademik ma’lumotlarni ko‘rish'),
  ('academics.manage', 'Akademik jarayonlarni boshqarish'),
  ('finance.read', 'Moliyaviy ma’lumotlarni ko‘rish'),
  ('finance.manage', 'Moliyani boshqarish'),
  ('kpi.read', 'KPI ko‘rsatkichlarini ko‘rish'),
  ('kpi.manage', 'KPI sozlamalarini boshqarish'),
  ('reports.read', 'Hisobotlarni ko‘rish'),
  ('portal.read', 'Shaxsiy portal ma’lumotlarini ko‘rish');

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
cross join public.permissions
where roles.role_key = 'director'
   or (roles.role_key = 'branch_director' and permissions.permission_key in (
     'organization.read', 'branches.read', 'users.read', 'users.manage',
     'leads.read', 'leads.manage', 'students.read', 'students.manage',
     'academics.read', 'academics.manage', 'finance.read', 'kpi.read',
     'kpi.manage', 'reports.read'
   ))
   or (roles.role_key = 'administrator' and permissions.permission_key in (
     'organization.read', 'branches.read', 'users.read', 'leads.read',
     'leads.manage', 'students.read', 'students.manage',
     'academics.read', 'academics.manage', 'reports.read'
   ))
   or (roles.role_key = 'sales_manager' and permissions.permission_key in (
     'organization.read', 'branches.read', 'leads.read', 'leads.manage',
     'students.read', 'reports.read'
   ))
   or (roles.role_key = 'support_teacher' and permissions.permission_key in (
     'organization.read', 'branches.read', 'students.read', 'academics.read',
     'academics.manage', 'kpi.read'
   ))
   or (roles.role_key = 'teacher' and permissions.permission_key in (
     'organization.read', 'branches.read', 'students.read', 'academics.read',
     'academics.manage', 'portal.read'
   ))
   or (roles.role_key = 'finance_manager' and permissions.permission_key in (
     'organization.read', 'branches.read', 'students.read', 'finance.read',
     'finance.manage', 'reports.read'
   ))
   or (roles.role_key in ('parent', 'student') and permissions.permission_key = 'portal.read');

create or replace function public.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    where membership.organization_id = p_organization_id
      and app_user.auth_user_id = (select auth.uid())
      and membership.is_active
  );
$$;

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select app_user.id
  from public.users app_user
  where app_user.auth_user_id = (select auth.uid())
  limit 1;
$$;

create or replace function public.has_permission(p_organization_id uuid, p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    join public.role_permissions role_permission on role_permission.role_id = membership.role_id
    join public.permissions permission on permission.id = role_permission.permission_id
    where membership.organization_id = p_organization_id
      and app_user.auth_user_id = (select auth.uid())
      and membership.is_active
      and permission.permission_key = p_permission_key
  );
$$;

create or replace function public.create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_app_user_id uuid;
  new_organization_id uuid;
  normalized_name text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_name is null or char_length(btrim(p_name)) not between 2 and 120 then
    raise exception 'Markaz nomi 2 dan 120 tagacha belgidan iborat bo‘lishi kerak'
      using errcode = '22023';
  end if;

  select id into current_app_user_id
  from public.users
  where auth_user_id = (select auth.uid());

  if current_app_user_id is null then
    raise exception 'Foydalanuvchi profili topilmadi' using errcode = '42501';
  end if;

  normalized_name := trim(both '-' from regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g'));

  insert into public.organizations (name, slug, created_by)
  values (
    btrim(p_name),
    coalesce(nullif(normalized_name, ''), 'markaz') || '-' || substr(gen_random_uuid()::text, 1, 8),
    current_app_user_id
  )
  returning id into new_organization_id;

  insert into public.organization_memberships (organization_id, user_id, role_id)
  select new_organization_id, current_app_user_id, role.id
  from public.roles role
  where role.role_key = 'director';

  if not found then
    raise exception 'Direktor roli sozlanmagan' using errcode = '55000';
  end if;

  return new_organization_id;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (auth_user_id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

alter table public.users enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.organizations enable row level security;
alter table public.branches enable row level security;
alter table public.organization_memberships enable row level security;

create policy "Users can read self and same-organization users"
  on public.users for select to authenticated
  using (
    auth_user_id = (select auth.uid())
    or exists (
      select 1
      from public.organization_memberships own_membership
      join public.organization_memberships other_membership
        on other_membership.organization_id = own_membership.organization_id
      where own_membership.user_id = (select public.current_app_user_id())
        and own_membership.is_active
        and other_membership.user_id = users.id
        and other_membership.is_active
    )
  );

create policy "Users can update their own profile"
  on public.users for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

create policy "Authenticated users can read role catalog"
  on public.roles for select to authenticated using (true);

create policy "Authenticated users can read permission catalog"
  on public.permissions for select to authenticated using (true);

create policy "Authenticated users can read role permission catalog"
  on public.role_permissions for select to authenticated using (true);

create policy "Organization members can read their organizations"
  on public.organizations for select to authenticated
  using ((select public.is_org_member(id)));

create policy "Members can read branches in their organizations"
  on public.branches for select to authenticated
  using ((select public.is_org_member(organization_id)));

create policy "Authorized directors can manage branches"
  on public.branches for all to authenticated
  using ((select public.has_permission(organization_id, 'branches.manage')))
  with check ((select public.has_permission(organization_id, 'branches.manage')));

create policy "Users can read memberships in their organizations"
  on public.organization_memberships for select to authenticated
  using (
    user_id = (select public.current_app_user_id())
    or (select public.is_org_member(organization_id))
  );

revoke all on function public.create_organization(text) from public;
revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.current_app_user_id() from public;
revoke all on function public.has_permission(uuid, text) from public;
revoke all on function public.handle_new_auth_user() from public;
grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.current_app_user_id() to authenticated;
grant execute on function public.has_permission(uuid, text) to authenticated;

grant usage on schema public to authenticated;
grant select on public.users, public.roles, public.permissions,
  public.role_permissions, public.organizations, public.branches,
  public.organization_memberships to authenticated;
grant update (full_name) on public.users to authenticated;
grant insert, update, delete on public.branches to authenticated;
