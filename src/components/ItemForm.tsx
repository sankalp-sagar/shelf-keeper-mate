import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { X, FolderTree } from "lucide-react";
import { buildTree, flattenTree, type Category } from "@/lib/categories";
import { CategoryManager } from "./CategoryManager";

type Item = Tables<"items">;

export function ItemForm({
  item,
  onClose,
  defaultCategoryId,
}: {
  item?: Item | null;
  onClose: () => void;
  defaultCategoryId?: string | null;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [showCats, setShowCats] = useState(false);
  const [form, setForm] = useState({
    name: item?.name ?? "",
    category_id: item?.category_id ?? defaultCategoryId ?? "",
    quantity: item?.quantity ?? 0,
    low_stock_threshold: item?.low_stock_threshold ?? 5,
    unit_price: item?.unit_price ?? 0,
    rental_price: item?.rental_price ?? 0,
    notes: item?.notes ?? "",
  });

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data as Category[];
    },
  });

  const flat = flattenTree(buildTree(categories));

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        category_id: form.category_id || null,
        quantity: Number(form.quantity) || 0,
        low_stock_threshold: Number(form.low_stock_threshold) || 0,
        unit_price: Number(form.unit_price) || 0,
        rental_price: Number(form.rental_price) || 0,
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
    <>
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

          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
            <Field label={t.inventory.name}>
              <input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
            </Field>

            <Field label={t.inventory.category}>
              <div className="flex gap-2">
                <select
                  value={form.category_id || ""}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  className="input flex-1"
                >
                  <option value="">— {t.inventory.noCategory} —</option>
                  {flat.map((c) => (
                    <option key={c.id} value={c.id}>
                      {"— ".repeat(c.depth)}{c.name}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => setShowCats(true)} className="rounded-lg border border-border px-3 text-muted-foreground hover:bg-muted" title={t.inventory.manageCategories}>
                  <FolderTree className="h-4 w-4" />
                </button>
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t.inventory.quantity}>
                <input type="number" inputMode="numeric" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} className="input" />
              </Field>
              <Field label={t.inventory.threshold}>
                <input type="number" inputMode="numeric" min={0} value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })} className="input" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t.inventory.price}>
                <input type="number" inputMode="decimal" min={0} step="0.01" value={form.unit_price ?? 0} onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })} className="input" />
              </Field>
              <Field label={t.inventory.rentalPrice}>
                <input type="number" inputMode="decimal" min={0} step="0.01" value={form.rental_price ?? 0} onChange={(e) => setForm({ ...form, rental_price: Number(e.target.value) })} className="input" />
              </Field>
            </div>

            <Field label={t.inventory.notes}>
              <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input resize-none" />
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
      {showCats && <CategoryManager onClose={() => setShowCats(false)} />}
    </>
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
