import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "./lib/supabase";

export type WorkspaceModule = "dashboard" | "crm" | "students" | "academy" | "finance";

type Props = {
  organizationId: string;
  organizationName: string;
  module: WorkspaceModule;
};

type Lead = {
  id: string;
  full_name: string;
  phone: string;
  course_interest: string;
  source: string;
  status: string;
  created_at: string;
};

type Course = { id: string; name: string; monthly_fee: number; description: string };
type Group = { id: string; name: string; teacher_name: string; meeting_days: string; start_time: string | null; courses?: { name: string } };
type Student = {
  id: string;
  full_name: string;
  phone: string;
  parent_name: string;
  parent_phone: string;
  status: string;
  enrolled_on: string;
  groups?: { name: string } | null;
};
type Invoice = {
  id: string;
  amount: number;
  due_date: string;
  description: string;
  students?: { full_name: string };
  payments?: { amount: number; reversed_at: string | null }[];
};
type Payment = {
  id: string;
  amount: number;
  method: string;
  paid_at: string;
  reversed_at: string | null;
  reversal_reason: string | null;
  invoices?: { description: string; students?: { full_name: string } };
};
type Expense = {
  id: string;
  amount: number;
  category: string;
  description: string;
  spent_at: string;
  reversed_at: string | null;
  reversal_reason: string | null;
};

const leadStatuses = [
  ["new", "Yangi"],
  ["contacted", "Aloqa qilindi"],
  ["trial", "Sinov darsi"],
  ["negotiation", "Muzokara"],
  ["won", "Sotuv"],
  ["lost", "Rad etildi"],
];
const studentStatuses = [
  ["active", "Faol"],
  ["frozen", "Muzlatilgan"],
  ["graduated", "Bitirgan"],
  ["left", "Ketgan"],
];
const methodNames: Record<string, string> = { cash: "Naqd", bank: "Bank", online: "Onlayn" };
const currency = new Intl.NumberFormat("uz-UZ", { style: "currency", currency: "UZS", maximumFractionDigits: 0 });

export default function Workspace({ organizationId, organizationName, module }: Props) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [overviewCounts, setOverviewCounts] = useState({ students: 0, leads: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError("");

    if (module === "crm") {
      const { data, error: queryError } = await supabase.from("leads").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false });
      if (queryError) setError(`Murojaatlarni yuklab bo‘lmadi: ${queryError.message}`);
      else setLeads((data ?? []) as Lead[]);
    } else if (module === "students") {
      const [studentResult, groupResult] = await Promise.all([
        supabase.from("students").select("*, groups(name)").eq("organization_id", organizationId).order("created_at", { ascending: false }),
        supabase.from("groups").select("id, name").eq("organization_id", organizationId).order("name"),
      ]);
      if (studentResult.error) setError(`O‘quvchilarni yuklab bo‘lmadi: ${studentResult.error.message}`);
      else setStudents((studentResult.data ?? []) as Student[]);
      if (groupResult.error) setError((current) => current || `Guruhlarni yuklab bo‘lmadi: ${groupResult.error.message}`);
      else setGroups((groupResult.data ?? []) as Group[]);
    } else if (module === "academy") {
      const [courseResult, groupResult] = await Promise.all([
        supabase.from("courses").select("*").eq("organization_id", organizationId).order("name"),
        supabase.from("groups").select("*, courses(name)").eq("organization_id", organizationId).order("name"),
      ]);
      if (courseResult.error) setError(`Kurslarni yuklab bo‘lmadi: ${courseResult.error.message}`);
      else setCourses((courseResult.data ?? []) as Course[]);
      if (groupResult.error) setError((current) => current || `Guruhlarni yuklab bo‘lmadi: ${groupResult.error.message}`);
      else setGroups((groupResult.data ?? []) as Group[]);
    } else if (module === "finance") {
      const [invoiceResult, paymentResult, expenseResult, studentResult] = await Promise.all([
        supabase.from("invoices").select("*, students(full_name), payments(amount, reversed_at)").eq("organization_id", organizationId).order("due_date", { ascending: false }),
        supabase.from("payments").select("*, invoices(description, students(full_name))").eq("organization_id", organizationId).order("paid_at", { ascending: false }),
        supabase.from("expenses").select("*").eq("organization_id", organizationId).order("spent_at", { ascending: false }),
        supabase.from("students").select("id, full_name").eq("organization_id", organizationId).order("full_name"),
      ]);
      if (invoiceResult.error) setError(`Hisoblarni yuklab bo‘lmadi: ${invoiceResult.error.message}`);
      else setInvoices((invoiceResult.data ?? []) as Invoice[]);
      if (paymentResult.error) setError((current) => current || `To‘lovlarni yuklab bo‘lmadi: ${paymentResult.error.message}`);
      else setPayments((paymentResult.data ?? []) as Payment[]);
      if (expenseResult.error) setError((current) => current || `Xarajatlarni yuklab bo‘lmadi: ${expenseResult.error.message}`);
      else setExpenses((expenseResult.data ?? []) as Expense[]);
      if (studentResult.error) setError((current) => current || `O‘quvchilarni yuklab bo‘lmadi: ${studentResult.error.message}`);
      else setStudents((studentResult.data ?? []) as Student[]);
    } else {
      const [leadResult, studentResult, invoiceResult, expenseResult] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
        supabase.from("students").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "active"),
        supabase.from("invoices").select("amount, payments(amount, reversed_at)").eq("organization_id", organizationId),
        supabase.from("expenses").select("amount").eq("organization_id", organizationId).is("reversed_at", null),
      ]);
      const errorResult = leadResult.error ?? studentResult.error ?? invoiceResult.error ?? expenseResult.error;
      if (errorResult) setError(`Ko‘rsatkichlarni yuklab bo‘lmadi: ${errorResult.message}`);
      else {
        setOverviewCounts({ students: studentResult.count ?? 0, leads: leadResult.count ?? 0 });
        setInvoices((invoiceResult.data ?? []) as Invoice[]);
        setExpenses((expenseResult.data ?? []) as Expense[]);
      }
    }
    setLoading(false);
  }, [module, organizationId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  async function submit(event: FormEvent<HTMLFormElement>, action: () => Promise<{ error: { message: string } | null }>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await action();
      if (result.error) setError(result.error.message);
      else {
        formElement.reset();
        setNotice("Ma’lumot saqlandi.");
        await loadData();
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "So‘rov bajarilmadi.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(table: "leads" | "students", id: string, status: string) {
    if (!supabase) return;
    const { error: updateError } = await supabase.from(table).update({ status, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", organizationId);
    if (updateError) setError(`Holatni o‘zgartirib bo‘lmadi: ${updateError.message}`);
    else {
      setNotice("Holat yangilandi.");
      await loadData();
    }
  }

  const heading: Record<WorkspaceModule, string> = {
    dashboard: "Umumiy ko‘rinish",
    crm: "CRM va sotuvlar",
    students: "O‘quvchilar",
    academy: "Akademiya",
    finance: "Moliya",
  };

  return <div className="module-content">
    <div className="welcome-row">
      <div><div className="eyebrow"><span className="eyebrow-dot" /> {organizationName.toLocaleUpperCase("uz-UZ")}</div><h1>{heading[module]}<span className="heading-period">.</span></h1><p className="welcome-copy">Ma’lumotlar tanlangan markaz doirasida yuklanadi va ruxsatlar serverda tekshiriladi.</p></div>
      <button className="secondary-button" onClick={() => void loadData()} disabled={loading}>Yangilash</button>
    </div>
    {error && <div className="inline-error" role="alert">{error}</div>}
    {notice && <div className="inline-success" role="status">{notice}</div>}
    {loading ? <div className="module-empty">Ma’lumotlar yuklanmoqda…</div> : <>
      {module === "dashboard" && <Dashboard students={overviewCounts.students} leads={overviewCounts.leads} invoices={invoices} expenses={expenses} />}
      {module === "crm" && <CrmModule organizationId={organizationId} leads={leads} saving={saving} submit={submit} updateStatus={updateStatus} />}
      {module === "students" && <StudentsModule organizationId={organizationId} students={students} groups={groups} saving={saving} submit={submit} updateStatus={updateStatus} />}
      {module === "academy" && <AcademyModule organizationId={organizationId} courses={courses} groups={groups} saving={saving} submit={submit} />}
      {module === "finance" && <FinanceModule organizationId={organizationId} students={students} invoices={invoices} payments={payments} expenses={expenses} saving={saving} submit={submit} refresh={loadData} onError={setError} onNotice={setNotice} />}
    </>}
  </div>;
}

function Dashboard({ students, leads, invoices, expenses }: { students: number; leads: number; invoices: Invoice[]; expenses: Expense[] }) {
  const outstanding = invoices.reduce((sum, invoice) => {
    const paid = (invoice.payments ?? []).filter((payment) => !payment.reversed_at).reduce((total, payment) => total + Number(payment.amount), 0);
    return sum + Math.max(0, Number(invoice.amount) - paid);
  }, 0);
  const expenseTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  return <>
    <div className="metric-grid">
      <Metric title="Faol o‘quvchilar" value={students.toLocaleString("uz-UZ")} detail="Bazadagi faol o‘quvchilar" />
      <Metric title="Murojaatlar" value={leads.toLocaleString("uz-UZ")} detail="Barcha CRM murojaatlari" />
      <Metric title="Qarzdorlik" value={currency.format(outstanding)} detail="Hisoblar va tushgan to‘lovlar farqi" />
      <Metric title="Xarajatlar" value={currency.format(expenseTotal)} detail="Bekor qilinmagan xarajatlar" />
    </div>
    <div className="module-empty">Ko‘rsatkichlar Supabase’dagi joriy markaz ma’lumotlaridan hisoblandi. Hali ma’lumot bo‘lmasa, nol ko‘rsatiladi.</div>
  </>;
}

function Metric({ title, value, detail }: { title: string; value: string; detail: string }) {
  return <article className="metric-card"><span>{title}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function CrmModule({ organizationId, leads, saving, submit, updateStatus }: {
  organizationId: string; leads: Lead[]; saving: boolean;
  submit: (event: FormEvent<HTMLFormElement>, action: () => Promise<{ error: { message: string } | null }>) => Promise<void>;
  updateStatus: (table: "leads" | "students", id: string, status: string) => Promise<void>;
}) {
  return <>
    <section className="module-panel"><div className="panel-heading"><div><h2>Yangi murojaat</h2><p>Lead CRM bazasiga saqlanadi.</p></div></div>
      <form className="module-form" onSubmit={(event) => void submit(event, async () => {
        if (!supabase) return { error: { message: "Supabase ulanishi mavjud emas." } };
        const form = new FormData(event.currentTarget);
        return supabase.from("leads").insert({ organization_id: organizationId, full_name: String(form.get("full_name") ?? ""), phone: String(form.get("phone") ?? ""), course_interest: String(form.get("course_interest") ?? ""), source: String(form.get("source") ?? "Boshqa") });
      })}>
        <label>Ism familiya<input name="full_name" required minLength={2} maxLength={120} /></label>
        <label>Telefon<input name="phone" required minLength={7} maxLength={32} placeholder="+998…" /></label>
        <label>Qiziqqan kursi<input name="course_interest" maxLength={120} /></label>
        <label>Manba<select name="source"><option>Telegram</option><option>Instagram</option><option>Qo‘ng‘iroq</option><option>Tavsiya</option><option>Boshqa</option></select></label>
        <button className="primary-button" disabled={saving}>{saving ? "Saqlanmoqda…" : "Murojaat qo‘shish"}</button>
      </form>
    </section>
    <section className="module-panel"><div className="panel-heading"><div><h2>Sotuv voronkasi</h2><p>{leads.length} ta murojaat · holatni jadvaldan o‘zgartiring</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>Ism</th><th>Telefon</th><th>Kurs</th><th>Manba</th><th>Holat</th><th>Sana</th></tr></thead><tbody>
        {leads.map((lead) => <tr key={lead.id}><td>{lead.full_name}</td><td>{lead.phone}</td><td>{lead.course_interest || "—"}</td><td>{lead.source}</td><td><select aria-label={`${lead.full_name} murojaat holati`} value={lead.status} onChange={(event) => void updateStatus("leads", lead.id, event.target.value)}>{leadStatuses.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></td><td>{new Date(lead.created_at).toLocaleDateString("uz-UZ")}</td></tr>)}
        {!leads.length && <EmptyRow columns={6} text="Hali murojaat yo‘q." />}
      </tbody></table></div>
    </section>
  </>;
}

function StudentsModule({ organizationId, students, groups, saving, submit, updateStatus }: {
  organizationId: string; students: Student[]; groups: Group[]; saving: boolean;
  submit: (event: FormEvent<HTMLFormElement>, action: () => Promise<{ error: { message: string } | null }>) => Promise<void>;
  updateStatus: (table: "leads" | "students", id: string, status: string) => Promise<void>;
}) {
  return <>
    <section className="module-panel"><div className="panel-heading"><div><h2>O‘quvchi qo‘shish</h2><p>O‘quvchi va ota-ona aloqa ma’lumotlari.</p></div></div>
      <form className="module-form" onSubmit={(event) => void submit(event, async () => {
        if (!supabase) return { error: { message: "Supabase ulanishi mavjud emas." } };
        const form = new FormData(event.currentTarget);
        const groupId = String(form.get("group_id") ?? "");
        return supabase.from("students").insert({ organization_id: organizationId, full_name: String(form.get("full_name") ?? ""), phone: String(form.get("phone") ?? ""), parent_name: String(form.get("parent_name") ?? ""), parent_phone: String(form.get("parent_phone") ?? ""), group_id: groupId || null });
      })}>
        <label>O‘quvchi ismi<input name="full_name" required minLength={2} maxLength={120} /></label>
        <label>O‘quvchi telefoni<input name="phone" maxLength={32} /></label>
        <label>Ota-ona ismi<input name="parent_name" maxLength={120} /></label>
        <label>Ota-ona telefoni<input name="parent_phone" maxLength={32} /></label>
        <label>Guruh<select name="group_id"><option value="">Tanlanmagan</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
        <button className="primary-button" disabled={saving}>{saving ? "Saqlanmoqda…" : "O‘quvchi qo‘shish"}</button>
      </form>
    </section>
    <section className="module-panel"><div className="panel-heading"><div><h2>O‘quvchilar ro‘yxati</h2><p>{students.length} ta yozuv</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>O‘quvchi</th><th>Telefon</th><th>Ota-ona</th><th>Guruh</th><th>Holat</th><th>Qabul qilingan</th></tr></thead><tbody>
        {students.map((student) => <tr key={student.id}><td>{student.full_name}</td><td>{student.phone || "—"}</td><td>{student.parent_name ? `${student.parent_name} · ${student.parent_phone}` : student.parent_phone || "—"}</td><td>{student.groups?.name ?? "—"}</td><td><select aria-label={`${student.full_name} holati`} value={student.status} onChange={(event) => void updateStatus("students", student.id, event.target.value)}>{studentStatuses.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></td><td>{new Date(student.enrolled_on).toLocaleDateString("uz-UZ")}</td></tr>)}
        {!students.length && <EmptyRow columns={6} text="Hali o‘quvchi yo‘q." />}
      </tbody></table></div>
    </section>
  </>;
}

function AcademyModule({ organizationId, courses, groups, saving, submit }: {
  organizationId: string; courses: Course[]; groups: Group[]; saving: boolean;
  submit: (event: FormEvent<HTMLFormElement>, action: () => Promise<{ error: { message: string } | null }>) => Promise<void>;
}) {
  return <>
    <div className="module-columns">
      <section className="module-panel"><div className="panel-heading"><div><h2>Kurs yaratish</h2><p>Kurs narxi so‘mda saqlanadi.</p></div></div>
        <form className="stacked-form" onSubmit={(event) => void submit(event, async () => {
          if (!supabase) return { error: { message: "Supabase ulanishi mavjud emas." } };
          const form = new FormData(event.currentTarget);
          return supabase.from("courses").insert({ organization_id: organizationId, name: String(form.get("name") ?? ""), description: String(form.get("description") ?? ""), monthly_fee: Number(form.get("monthly_fee")) });
        })}>
          <label>Kurs nomi<input name="name" required minLength={2} maxLength={120} /></label>
          <label>Oylik narxi (so‘m)<input name="monthly_fee" type="number" min="0" step="1000" required defaultValue="0" /></label>
          <label>Izoh<input name="description" maxLength={500} /></label>
          <button className="primary-button" disabled={saving}>{saving ? "Saqlanmoqda…" : "Kursni saqlash"}</button>
        </form>
      </section>
      <section className="module-panel"><div className="panel-heading"><div><h2>Guruh ochish</h2><p>Kurs va dars jadvalini belgilang.</p></div></div>
        <form className="stacked-form" onSubmit={(event) => void submit(event, async () => {
          if (!supabase) return { error: { message: "Supabase ulanishi mavjud emas." } };
          const form = new FormData(event.currentTarget);
          return supabase.from("groups").insert({ organization_id: organizationId, course_id: String(form.get("course_id") ?? ""), name: String(form.get("name") ?? ""), teacher_name: String(form.get("teacher_name") ?? ""), meeting_days: String(form.get("meeting_days") ?? ""), start_time: String(form.get("start_time") ?? "") || null });
        })}>
          <label>Guruh nomi<input name="name" required minLength={2} maxLength={120} /></label>
          <label>Kurs<select name="course_id" required defaultValue=""><option value="" disabled>Kurs tanlang</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
          <label>Ustoz<input name="teacher_name" maxLength={120} /></label>
          <label>Dars kunlari<input name="meeting_days" placeholder="Du / Chor / Ju" maxLength={80} /></label>
          <label>Boshlanish vaqti<input name="start_time" type="time" /></label>
          <button className="primary-button" disabled={saving || !courses.length}>{saving ? "Saqlanmoqda…" : "Guruhni saqlash"}</button>
        </form>
      </section>
    </div>
    <section className="module-panel"><div className="panel-heading"><div><h2>Kurslar va guruhlar</h2><p>{courses.length} ta kurs · {groups.length} ta guruh</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>Nomi</th><th>Kurs</th><th>Ustoz</th><th>Jadval</th><th>Oylik narxi</th></tr></thead><tbody>
        {groups.map((group) => <tr key={group.id}><td>{group.name}</td><td>{group.courses?.name ?? "—"}</td><td>{group.teacher_name || "—"}</td><td>{[group.meeting_days, group.start_time?.slice(0, 5)].filter(Boolean).join(" · ") || "—"}</td><td>{currency.format(Number(courses.find((course) => course.name === group.courses?.name)?.monthly_fee ?? 0))}</td></tr>)}
        {courses.map((course) => <tr key={`course-${course.id}`}><td>{course.name}</td><td>Kurs</td><td>—</td><td>{course.description || "—"}</td><td>{currency.format(Number(course.monthly_fee))}</td></tr>)}
        {!groups.length && !courses.length && <EmptyRow columns={5} text="Hali kurs yoki guruh yo‘q." />}
      </tbody></table></div>
    </section>
  </>;
}

function FinanceModule({ organizationId, students, invoices, payments, expenses, saving, submit, refresh, onError, onNotice }: {
  organizationId: string; students: Student[]; invoices: Invoice[]; payments: Payment[]; expenses: Expense[]; saving: boolean;
  submit: (event: FormEvent<HTMLFormElement>, action: () => Promise<{ error: { message: string } | null }>) => Promise<void>;
  refresh: () => Promise<void>; onError: (message: string) => void; onNotice: (message: string) => void;
}) {
  const [reversal, setReversal] = useState<{ type: "payment" | "expense"; id: string } | null>(null);
  const outstanding = invoices.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.amount) - (invoice.payments ?? []).filter((payment) => !payment.reversed_at).reduce((total, payment) => total + Number(payment.amount), 0)), 0);

  async function reverse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !reversal) return;
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "");
    const { error } = await supabase.rpc("reverse_financial_entry", { p_entry_type: reversal.type, p_entry_id: reversal.id, p_reason: reason });
    if (error) onError(`Yozuvni bekor qilib bo‘lmadi: ${error.message}`);
    else {
      onNotice("Yozuv o‘chirilgani yo‘q, reversal bilan qayd etildi.");
      setReversal(null);
      await refresh();
    }
  }

  return <>
    <div className="metric-grid finance-metrics"><Metric title="Ochiq qarzdorlik" value={currency.format(outstanding)} detail="Hisob summasidan qaytarilmagan to‘lovlar ayirildi" /><Metric title="Hisoblar" value={String(invoices.length)} detail="Yaratilgan o‘quv to‘lovi hisoblari" /><Metric title="To‘lovlar" value={String(payments.filter((payment) => !payment.reversed_at).length)} detail="Faol to‘lov yozuvlari" /><Metric title="Xarajatlar" value={String(expenses.filter((expense) => !expense.reversed_at).length)} detail="Faol xarajat yozuvlari" /></div>
    <div className="module-columns">
      <section className="module-panel"><div className="panel-heading"><div><h2>To‘lov hisobi</h2><p>O‘quvchi uchun qarzdorlik hisobini yarating.</p></div></div>
        <form className="stacked-form" onSubmit={(event) => void submit(event, async () => {
          if (!supabase) return { error: { message: "Supabase ulanishi mavjud emas." } };
          const form = new FormData(event.currentTarget);
          return supabase.from("invoices").insert({ organization_id: organizationId, student_id: String(form.get("student_id") ?? ""), amount: Number(form.get("amount")), due_date: String(form.get("due_date") ?? ""), description: String(form.get("description") ?? "") });
        })}>
          <label>O‘quvchi<select name="student_id" required defaultValue=""><option value="" disabled>O‘quvchi tanlang</option>{students.map((student) => <option key={student.id} value={student.id}>{student.full_name}</option>)}</select></label>
          <label>Summa (so‘m)<input name="amount" type="number" min="1" step="1000" required /></label>
          <label>To‘lov muddati<input name="due_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
          <label>Izoh<input name="description" maxLength={300} /></label>
          <button className="primary-button" disabled={saving || !students.length}>{saving ? "Saqlanmoqda…" : "Hisob yaratish"}</button>
        </form>
      </section>
      <section className="module-panel"><div className="panel-heading"><div><h2>To‘lov qabul qilish</h2><p>To‘lov mavjud hisobga biriktiriladi.</p></div></div>
        <form className="stacked-form" onSubmit={(event) => void submit(event, async () => {
          if (!supabase) return { error: { message: "Supabase ulanishi mavjud emas." } };
          const form = new FormData(event.currentTarget);
          return supabase.rpc("record_payment", { p_invoice_id: String(form.get("invoice_id") ?? ""), p_amount: Number(form.get("amount")), p_method: String(form.get("method") ?? ""), p_note: String(form.get("note") ?? "") });
        })}>
          <label>Hisob<select name="invoice_id" required defaultValue=""><option value="" disabled>Hisob tanlang</option>{invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.students?.full_name ?? "O‘quvchi"} · {currency.format(Number(invoice.amount))} · {invoice.due_date}</option>)}</select></label>
          <label>Summa (so‘m)<input name="amount" type="number" min="1" step="1000" required /></label>
          <label>To‘lov turi<select name="method"><option value="cash">Naqd</option><option value="bank">Bank</option><option value="online">Onlayn</option></select></label>
          <label>Izoh<input name="note" maxLength={300} /></label>
          <button className="primary-button" disabled={saving || !invoices.length}>{saving ? "Saqlanmoqda…" : "To‘lovni qayd etish"}</button>
        </form>
      </section>
      <section className="module-panel"><div className="panel-heading"><div><h2>Xarajat kiritish</h2><p>Moliyaviy yozuvlar o‘chirilmaydi.</p></div></div>
        <form className="stacked-form" onSubmit={(event) => void submit(event, async () => {
          if (!supabase) return { error: { message: "Supabase ulanishi mavjud emas." } };
          const form = new FormData(event.currentTarget);
          return supabase.from("expenses").insert({ organization_id: organizationId, amount: Number(form.get("amount")), category: String(form.get("category") ?? ""), description: String(form.get("description") ?? "") });
        })}>
          <label>Summa (so‘m)<input name="amount" type="number" min="1" step="1000" required /></label>
          <label>Toifa<input name="category" required minLength={2} maxLength={80} placeholder="Ijara, ish haqi…" /></label>
          <label>Izoh<input name="description" maxLength={300} /></label>
          <button className="primary-button" disabled={saving}>{saving ? "Saqlanmoqda…" : "Xarajatni saqlash"}</button>
        </form>
      </section>
    </div>
    <section className="module-panel"><div className="panel-heading"><div><h2>Hisoblar</h2><p>Ochiq balanslar bekor qilinmagan to‘lovlardan hisoblanadi.</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>O‘quvchi</th><th>Hisob</th><th>Muddati</th><th>Jami</th><th>To‘langan</th><th>Qoldiq</th></tr></thead><tbody>
        {invoices.map((invoice) => { const paid = (invoice.payments ?? []).filter((payment) => !payment.reversed_at).reduce((sum, payment) => sum + Number(payment.amount), 0); return <tr key={invoice.id}><td>{invoice.students?.full_name ?? "—"}</td><td>{invoice.description || "O‘qish to‘lovi"}</td><td>{invoice.due_date}</td><td>{currency.format(Number(invoice.amount))}</td><td>{currency.format(paid)}</td><td>{currency.format(Math.max(0, Number(invoice.amount) - paid))}</td></tr>; })}
        {!invoices.length && <EmptyRow columns={6} text="Hali hisob yaratilmagan." />}
      </tbody></table></div>
    </section>
    <section className="module-panel"><div className="panel-heading"><div><h2>To‘lovlar tarixi</h2><p>{payments.length} ta moliyaviy yozuv · o‘chirish o‘rniga reversal</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>O‘quvchi</th><th>Izoh</th><th>Summa</th><th>Usul</th><th>Sana / holat</th><th>Amal</th></tr></thead><tbody>
        {payments.map((payment) => <tr key={payment.id}><td>{payment.invoices?.students?.full_name ?? "—"}</td><td>{payment.invoices?.description || "O‘qish to‘lovi"}</td><td>{currency.format(Number(payment.amount))}</td><td>{methodNames[payment.method] ?? payment.method}</td><td>{payment.reversed_at ? `Bekor qilingan: ${payment.reversal_reason}` : new Date(payment.paid_at).toLocaleDateString("uz-UZ")}</td><td>{payment.reversed_at ? "—" : <button className="text-button" onClick={() => setReversal({ type: "payment", id: payment.id })}>Reversal</button>}</td></tr>)}
        {!payments.length && <EmptyRow columns={6} text="Hali to‘lov yo‘q." />}
      </tbody></table></div>
    </section>
    <section className="module-panel"><div className="panel-heading"><div><h2>Xarajatlar</h2><p>{expenses.length} ta yozuv</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>Toifa</th><th>Izoh</th><th>Summa</th><th>Sana / holat</th><th>Amal</th></tr></thead><tbody>
        {expenses.map((expense) => <tr key={expense.id}><td>{expense.category}</td><td>{expense.description || "—"}</td><td>{currency.format(Number(expense.amount))}</td><td>{expense.reversed_at ? `Bekor qilingan: ${expense.reversal_reason}` : new Date(expense.spent_at).toLocaleDateString("uz-UZ")}</td><td>{expense.reversed_at ? "—" : <button className="text-button" onClick={() => setReversal({ type: "expense", id: expense.id })}>Reversal</button>}</td></tr>)}
        {!expenses.length && <EmptyRow columns={5} text="Hali xarajat yo‘q." />}
      </tbody></table></div>
    </section>
    {reversal && <div className="modal-backdrop"><form className="reversal-dialog" onSubmit={(event) => void reverse(event)}><h2>Moliyaviy yozuvni reversal qilish</h2><p>Yozuv o‘chirilmaydi; sabab audit uchun saqlanadi.</p><label>Sabab<input name="reason" minLength={3} maxLength={300} required autoFocus /></label><div><button type="button" className="secondary-button" onClick={() => setReversal(null)}>Bekor qilish</button><button className="primary-button">Reversalni tasdiqlash</button></div></form></div>}
  </>;
}

function EmptyRow({ columns, text }: { columns: number; text: string }) {
  return <tr><td colSpan={columns} className="empty-row">{text}</td></tr>;
}
