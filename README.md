

## Render’da ishga tushirish

Repo ildizidagi `render.yaml` Render Blueprint orqali `frontend/` ichidagi Vite ilovasini Static Site sifatida deploy qiladi. Render Dashboard’da **New → Blueprint** tanlab, ushbu GitHub repositoriyasini ulang va Blueprint’ni yarating. Deploy sozlamalarida `VITE_SUPABASE_ANON_KEY` uchun Supabase publishable key’ni kiriting (`service_role` yoki `sb_secret_...` emas). Build `npm ci && npm run build`, publish papkasi `dist`; SPA yo‘llari `index.html` ga yo‘naltiriladi.

Deploy tugagach, Render bergan `onrender.com` manzilini Supabase Auth URL Configuration’dagi Redirect URLs ro‘yxatiga qo‘shing. `VITE_SUPABASE_URL` Render Blueprint’da sozlangan; kalitni GitHub repo’ga yozmang.
