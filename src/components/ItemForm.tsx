import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { X } from "lucide-react";

type Item = Tables<"items">;

export function ItemForm({
  item,
  onClose,
}: {
  item?: Item | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: item?.name ?? "",
    category: item?.category ?? "",
    quantity: item?.quantity ?? 0,
    low_stock_threshold: item?.low_stock_threshold ?? 5,
    unit_price: item?.unit_price ?? 0,
    notes: item?.notes ?? "",
  });

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        category: form.category.trim() || null,
        quantity: Number(form.quantity) || 0,
        low_stock_threshold: Number(form.low_stock_threshold) || 0,
        unit_price: Number(form.unit_price) || 0,
        notes: form.notes.trim() || null,
      };
      if (!payload.name) throw new Error(t.common.required);
      if (item) {
        const { error } = await supabase.from("items").update(payload).eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("items").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
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
            {item ? t.inventory.edit : t.inventory.add}
          </h2>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
          className="space-y-3"
        >
          <Field label={t.inventory.name}>
            <input
              autoFocus
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
            />
          </Field>
          <Field label={t.inventory.category}>
            <input
              value={form.category}
              placeholder={t.inventory.categoryPh}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.inventory.quantity}>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                className="input"
              />
            </Field>
            <Field label={t.inventory.threshold}>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={form.low_stock_threshold}
                onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })}
                className="input"
              />
            </Field>
          </div>
          <Field label={t.inventory.price}>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={form.unit_price}
              onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })}
              className="input"
            />
          </Field>
          <Field label={t.inventory.notes}>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input resize-none"
            />
          </Field>

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
