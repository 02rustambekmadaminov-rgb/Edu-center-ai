create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  phone text not null check (char_length(btrim(phone)) between 7 and 32),
  course_interest text not null default '',
  level text not null default '',
  source text not null default 'Boshqa',
  status text not null default 'new'
    check (status in ('new', 'contacted', 'trial', 'negotiation', 'won', 'lost')),
  notes text not null default '',
  assigned_to uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  description text not null default '',
  monthly_fee numeric(14,2) not null default 0 check (monthly_fee >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  course_id uuid not null,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  teacher_name text not null default '',
  meeting_days text not null default '',
  start_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, course_id)
    references public.courses(organization_id, id) on delete restrict
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid,
  group_id uuid,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  phone text not null default '',
  parent_name text not null default '',
  parent_phone text not null default '',
  status text not null default 'active'
    check (status in ('active', 'frozen', 'graduated', 'left')),
  enrolled_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, branch_id)
    references public.branches(organization_id, id) on delete restrict,
  foreign key (organization_id, group_id)
    references public.groups(organization_id, id) on delete set null (group_id)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  due_date date not null,
  description text not null default '',
  created_by uuid not null default public.current_app_user_id()
    references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, student_id)
    references public.students(organization_id, id) on delete restrict
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  method text not null check (method in ('cash', 'bank', 'online')),
  paid_at timestamptz not null default now(),
  note text not null default '',
  created_by uuid not null default public.current_app_user_id()
    references public.users(id) on delete restrict,
  reversed_at timestamptz,
  reversal_reason text,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, invoice_id)
    references public.invoices(organization_id, id) on delete restrict,
  check ((reversed_at is null and reversal_reason is null)
    or (reversed_at is not null and char_length(btrim(reversal_reason)) > 0))
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  category text not null check (char_length(btrim(category)) between 2 and 80),
  description text not null default '',
  spent_at timestamptz not null default now(),
  created_by uuid not null default public.current_app_user_id()
    references public.users(id) on delete restrict,
  reversed_at timestamptz,
  reversal_reason text,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  check ((reversed_at is null and reversal_reason is null)
    or (reversed_at is not null and char_length(btrim(reversal_reason)) > 0))
);

create index leads_org_status_created_idx on public.leads (organization_id, status, created_at desc);
create index students_org_status_name_idx on public.students (organization_id, status, full_name);
create index courses_org_active_name_idx on public.courses (organization_id, is_active, name);
create index groups_org_course_name_idx on public.groups (organization_id, course_id, name);
create index invoices_org_student_due_idx on public.invoices (organization_id, student_id, due_date);
create index payments_org_invoice_date_idx on public.payments (organization_id, invoice_id, paid_at desc);
create index expenses_org_date_idx on public.expenses (organization_id, spent_at desc);

alter table public.leads enable row level security;
alter table public.courses enable row level security;
alter table public.groups enable row level security;
alter table public.students enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;

create policy "Authorized members can read leads"
  on public.leads for select to authenticated
  using ((select public.has_permission(organization_id, 'leads.read')));
create policy "Authorized members can create leads"
  on public.leads for insert to authenticated
  with check ((select public.has_permission(organization_id, 'leads.manage')));
create policy "Authorized members can update leads"
  on public.leads for update to authenticated
  using ((select public.has_permission(organization_id, 'leads.manage')))
  with check ((select public.has_permission(organization_id, 'leads.manage')));

create policy "Authorized members can read courses"
  on public.courses for select to authenticated
  using ((select public.has_permission(organization_id, 'academics.read')));
create policy "Authorized members can manage courses"
  on public.courses for all to authenticated
  using ((select public.has_permission(organization_id, 'academics.manage')))
  with check ((select public.has_permission(organization_id, 'academics.manage')));

create policy "Authorized members can read groups"
  on public.groups for select to authenticated
  using ((select public.has_permission(organization_id, 'academics.read')));
create policy "Authorized members can manage groups"
  on public.groups for all to authenticated
  using ((select public.has_permission(organization_id, 'academics.manage')))
  with check ((select public.has_permission(organization_id, 'academics.manage')));

create policy "Authorized members can read students"
  on public.students for select to authenticated
  using ((select public.has_permission(organization_id, 'students.read')));
create policy "Authorized members can manage students"
  on public.students for all to authenticated
  using ((select public.has_permission(organization_id, 'students.manage')))
  with check ((select public.has_permission(organization_id, 'students.manage')));

create policy "Authorized members can read invoices"
  on public.invoices for select to authenticated
  using ((select public.has_permission(organization_id, 'finance.read')));
create policy "Authorized members can create invoices"
  on public.invoices for insert to authenticated
  with check (
    (select public.has_permission(organization_id, 'finance.manage'))
    and created_by = (select public.current_app_user_id())
  );

create policy "Authorized members can read payments"
  on public.payments for select to authenticated
  using ((select public.has_permission(organization_id, 'finance.read')));
create policy "Authorized members can read expenses"
  on public.expenses for select to authenticated
  using ((select public.has_permission(organization_id, 'finance.read')));
create policy "Authorized members can create expenses"
  on public.expenses for insert to authenticated
  with check (
    (select public.has_permission(organization_id, 'finance.manage'))
    and created_by = (select public.current_app_user_id())
  );

create or replace function public.record_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_method text,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invoice_row public.invoices%rowtype;
  new_payment_id uuid;
begin
  if p_amount is null or p_amount <= 0 or p_amount > 999999999999.99 then
    raise exception 'To‘lov summasi musbat va ruxsat etilgan oraliqda bo‘lishi kerak'
      using errcode = '22023';
  end if;
  if p_method is null or p_method not in ('cash', 'bank', 'online') then
    raise exception 'To‘lov turi noto‘g‘ri' using errcode = '22023';
  end if;
  if char_length(coalesce(p_note, '')) > 300 then
    raise exception 'Izoh 300 belgidan oshmasligi kerak' using errcode = '22023';
  end if;

  select * into invoice_row
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found or not (select public.has_permission(invoice_row.organization_id, 'finance.manage')) then
    raise exception 'Hisob topilmadi yoki to‘lov kiritish huquqi yo‘q'
      using errcode = '42501';
  end if;

  if (
    select coalesce(sum(payment.amount), 0)
    from public.payments payment
    where payment.invoice_id = p_invoice_id
      and payment.reversed_at is null
  ) + p_amount > invoice_row.amount then
    raise exception 'To‘lov summasi hisob qoldig‘idan oshib ketdi'
      using errcode = '22023';
  end if;

  insert into public.payments (organization_id, invoice_id, amount, method, note)
  values (invoice_row.organization_id, p_invoice_id, p_amount, p_method, coalesce(p_note, ''))
  returning id into new_payment_id;
  return new_payment_id;
end;
$$;

create or replace function public.reverse_financial_entry(
  p_entry_type text,
  p_entry_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry_organization_id uuid;
begin
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'Bekor qilish sababi kamida 3 ta belgidan iborat bo‘lishi kerak'
      using errcode = '22023';
  end if;

  if p_entry_type = 'payment' then
    select organization_id into entry_organization_id
    from public.payments
    where id = p_entry_id and reversed_at is null
    for update;
  elsif p_entry_type = 'expense' then
    select organization_id into entry_organization_id
    from public.expenses
    where id = p_entry_id and reversed_at is null
    for update;
  else
    raise exception 'Moliyaviy yozuv turi noto‘g‘ri' using errcode = '22023';
  end if;

  if entry_organization_id is null
    or not (select public.has_permission(entry_organization_id, 'finance.manage')) then
    raise exception 'Yozuv topilmadi yoki moliyani boshqarish huquqi yo‘q'
      using errcode = '42501';
  end if;

  if p_entry_type = 'payment' then
    update public.payments
    set reversed_at = now(), reversal_reason = btrim(p_reason)
    where id = p_entry_id;
  else
    update public.expenses
    set reversed_at = now(), reversal_reason = btrim(p_reason)
    where id = p_entry_id;
  end if;
end;
$$;

revoke all on function public.record_payment(uuid, numeric, text, text) from public;
revoke all on function public.reverse_financial_entry(text, uuid, text) from public;
grant execute on function public.record_payment(uuid, numeric, text, text) to authenticated;
grant execute on function public.reverse_financial_entry(text, uuid, text) to authenticated;

grant select, insert, update on public.leads to authenticated;
grant select, insert, update on public.courses, public.groups, public.students to authenticated;
grant select, insert on public.invoices, public.expenses to authenticated;
grant select on public.payments to authenticated;
