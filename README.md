# EduSales AI

O‘quv markazlari uchun multi-tenant Education Management OS. Joriy repo boshlanishida faqat bo‘sh `backen-end` va `front-end` papkalari bo‘lgan; loyiha React + TypeScript frontend va Supabase backend tartibida tashkil qilindi.

## Arxitektura

- `frontend/` — React 19, TypeScript va Vite. Supabase Auth orqali kirish, ro‘yxatdan o‘tish, parolni tiklash, ish joylarini ko‘rish va markaz yaratish interfeysi.
- `backend/supabase/migrations/` — PostgreSQL sxemasi, rol/ruxsatlar katalogi, RLS siyosatlari va xavfsiz markaz yaratish RPC funksiyasi.
- Tenant ajratilishi har bir so‘rovda `organization_id` bilan ta’minlanadi; RLS foydalanuvchining faol tashkilot a’zoligini server tomonda tekshiradi.
- Supabase `service_role` kaliti faqat server muhitida saqlanishi kerak. Frontendga faqat publishable/anon kalit beriladi.

## Ma’lumotlar modeli rejasi

Har bir markazga tegishli biznes jadvallarida `organization_id` majburiy bo‘ladi; filialga tegishli yozuvlarda qo‘shimcha `branch_id` saqlanadi. Filial va markaz mosligini composite foreign key bilan tekshirish, faol yozuvlarni `archived_at` orqali arxivlash va pulni `numeric(14,2)` da yuritish rejalashtirilgan. Moliyaviy yozuvlar o‘chirilmaydi: tuzatishlar reversal yozuvi va audit log orqali bajariladi.

- **Tashkilot va kirish:** `organizations`, `branches`, `users`, `roles`, `permissions`, `role_permissions`, `organization_memberships`, `subscriptions`, `audit_logs`.
- **O‘quvchilar va akademik:** `students`, `parents`, `parent_students`, `employees`, `courses`, `groups`, `group_students`, `classrooms`, `schedules`, `lessons`, `attendance`, `teacher_reports`, `homework`, `tests`, `test_results`.
- **CRM va sotuv:** `leads`, `calls`, `followups`, `tasks`.
- **Moliya:** `payments`, `invoices`, `expenses`, `payrolls`, `payroll_items`, `kpi_metrics`, `kpi_records`.
- **Retention, aloqa va support:** `retention_scores`, `notifications`, `messages`, `complaints`.

Bu ro‘yxat keyingi bosqichlar uchun schema rejasi; ushbu dastlabki migratsiyada faqat kirish va tenant-isolation asosiy jadvallari yaratilgan. Har bir keyingi jadval RLS policy va indekslari bilan, o‘sha modulni qurish vaqtida alohida migratsiyaga qo‘shiladi.

## 1-bosqich holati

- Auth UI va session boshqaruvi, email orqali ro‘yxatdan o‘tish, kirish, parolni tiklash.
- Tashkilot, filial, foydalanuvchi, a’zolik, rol va permission jadvallari.
- Tenant-aware RLS hamda ro‘lga asoslangan `has_permission` tekshiruvi.
- Birinchi markazni yaratish va yaratuvchiga direktor rolini atomik biriktirish.
- Hali bajarilmagan: xodimlarni taklif qilish, super-admin uchun alohida platforma vakolatlari, biznes modullari va dashboard metrikalari.

## Ishga tushirish

1. Supabase loyihasi yarating va SQL Editor yoki Supabase CLI orqali `backend/supabase/migrations/202611030001_initial_tenant_auth.sql` migratsiyasini qo‘llang.
2. `frontend/.env.example` nusxasini `frontend/.env.local` nomi bilan yarating va Supabase Project URL hamda publishable/anon keyni kiriting.
3. `cd frontend`
4. `npm install`
5. `npm run dev`
6. Tekshiruv/build: `npm run build`

Supabase Auth sozlamalarida email tasdiqlashni yoqing va redirect URL ro‘yxatiga mahalliy frontend manzilini qo‘shing.

## GitHub Pages deployment

GitHub Actions workflow `main` branch’iga push bo‘lganda frontend’ni avtomatik build va deploy qiladi. Vite production asset’larini `/Edu-center-ai/` ostida joylaydi; mahalliy `npm run dev` esa root yo‘lidan ishlaydi.

1. GitHub repository **Settings → Pages → Build and deployment → Source** ichida **GitHub Actions** ni tanlang.
2. Repository **Settings → Secrets and variables → Actions → Variables** ichida `VITE_SUPABASE_URL` va `VITE_SUPABASE_ANON_KEY` nomli repository variables yarating. Ochiq/publishable key frontend bundle’da ko‘rinishi normal; `service_role` kalitini bu yerga yoki frontend’ga hech qachon qo‘ymang.
3. Supabase Auth **URL Configuration** ichida Site URL’ni `https://02rustambekmadaminov-rgb.github.io/Edu-center-ai/` qilib, Redirect URLs’ga shu URL va mahalliy development manzilini qo‘shing.
4. `main` branch’iga push qiling va GitHub **Actions** bo‘limida `Deploy EduSales AI to GitHub Pages` workflow muvaffaqiyatli tugashini kuting.

Supabase variables sozlanmagan bo‘lsa, deploy qilingan sayt ataylab sozlash yo‘riqnomasini ko‘rsatadi; Auth ulanishi ishlashi uchun ikkala variable ham kerak.
