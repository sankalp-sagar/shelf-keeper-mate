import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { X } from "lucide-react";

type PayLater = Tables<"pay_later">;

export function PayLaterForm({
  entry,
  onClose,
}: {
  entry?: PayLater | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const isNew = !entry;

  const { data: items } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("items").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    customer_name: entry?.customer_name ?? "",
    item_id: entry?.item_id ?? "",
    item_name: entry?.item_name ?? "",
    quantity: entry?.quantity ?? 1,
    amount: entry?.amount ?? 0,
    taken_at: entry?.taken_at ?? new Date().toISOString().slice(0, 10),
    due_date: entry?.due_date ?? "",
    notes: entry?.notes ?? "",
  });
  const [deductStock, setDeductStock] = useState(isNew);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const onPickItem = (id: string) => {
    const it = items?.find((i) => i.id === id);
    setForm((f) => ({
      ...f,
      item_id: id,
      item_name: it?.name ?? f.item_name,
      amount: it?.unit_price ? Number(it.unit_price) * (f.quantity || 1) : f.amount,
    }));
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        customer_name: form.customer_name.trim(),
        item_id: form.item_id || null,
        item_name: form.item_name.trim(),
        quantity: Number(form.quantity) || 1,
        amount: Number(form.amount) || 0,
        taken_at: form.taken_at,
        due_date: form.due_date || null,
        notes: form.notes.trim() || null,
      };
      if (!payload.customer_name || !payload.item_name) throw new Error(t.common.required);

      if (entry) {
        const { error } = await supabase.from("pay_later").update(payload).eq("id", entry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pay_later").insert(payload);
        if (error) throw error;

        if (deductStock && payload.item_id) {
          const it = items?.find((i) => i.id === payload.item_id);
          if (it) {
            const next = Math.max(0, (it.quantity ?? 0) - payload.quantity);
            await supabase.from("items").update({ quantity: next }).eq("id", it.id);
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pay_later"] });
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success(t.common.saved);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || t.common.error),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-card p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold">
            {entry ? t.fiado.edit : t.fiado.add}
          </h2>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
          <Field label={t.fiado.customer}>
            <input autoFocus required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} className="input" />
          </Field>

          <Field label={t.fiado.item}>
            {items && items.length > 0 ? (
              <select
                value={form.item_id || ""}
                onChange={(e) => onPickItem(e.target.value)}
                className="input"
              >
                <option value="">— {t.fiado.itemPh}</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            ) : null}
            <input
              required
              value={form.item_name}
              placeholder={t.fiado.itemPh}
              onChange={(e) => setForm({ ...form, item_name: e.target.value, item_id: "" })}
              className="input mt-2"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t.fiado.qty}>
              <input type="number" inputMode="numeric" min={1} value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} className="input" />
            </Field>
            <Field label={t.fiado.amount}>
              <input type="number" inputMode="decimal" min={0} step="0.01" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="input" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t.fiado.taken}>
              <input type="date" value={form.taken_at}
                onChange={(e) => setForm({ ...form, taken_at: e.target.value })} className="input" />
            </Field>
            <Field label={t.fiado.due}>
              <input type="date" value={form.due_date ?? ""}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="input" />
            </Field>
          </div>

          <Field label={t.fiado.notes}>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input resize-none" />
          </Field>

          {isNew && form.item_id && (
            <label className="flex items-center gap-2 rounded-lg bg-muted/60 p-3 text-sm">
              <input type="checkbox" checked={deductStock} onChange={(e) => setDeductStock(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
              <span>{t.fiado.deductStock}</span>
            </label>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">{t.inventory.cancel}</button>
            <button type="submit" disabled={save.isPending} className="btn-primary flex-1">
              {save.isPending ? t.common.saving : t.inventory.save}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .input { width:100%; border:1px solid var(--input); background:var(--background); border-radius: var(--radius); padding: 0.65rem 0.85rem; font-size:0.95rem; outline:none; transition: border-color .15s; }
        .input:focus { border-color: var(--ring); box-shadow: 0 0 0 3px color-mix(in oklab, var(--ring) 18%, transparent); }
        .btn-primary { background: var(--primary); color: var(--primary-foreground); border-radius: var(--radius); padding: 0.7rem 1rem; font-weight:600; font-size:0.95rem; }
        .btn-primary:disabled { opacity:.6; }
        .btn-ghost { background: var(--secondary); color: var(--secondary-foreground); border-radius: var(--radius); padding: 0.7rem 1rem; font-weight:600; font-size:0.95rem; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
