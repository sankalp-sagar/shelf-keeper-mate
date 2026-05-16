import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { X, Plus, Trash2 } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";

type Item = Tables<"items">;

type Line = {
  key: string;
  item_id: string;
  item_name: string;
  quantity: string;
  unit_price: string;
  kind: "buy" | "rent";
  rental_return_date: string;
};

function newLine(): Line {
  return {
    key: crypto.randomUUID(),
    item_id: "",
    item_name: "",
    quantity: "1",
    unit_price: "0",
    kind: "buy",
    rental_return_date: "",
  };
}

export function TransactionForm({ onClose }: { onClose: () => void }) {
  const { t, money } = useI18n();
  const qc = useQueryClient();

  const [customer, setCustomer] = useState("");
  const [takenAt, setTakenAt] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<"paid" | "pending">("paid");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("items").select("*").order("name");
      if (error) throw error;
      return data as Item[];
    },
  });

  const updateLine = (key: string, patch: Partial<Line>) => {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const onPickItem = (key: string, id: string, kind: "buy" | "rent") => {
    const it = items.find((i) => i.id === id);
    const price = it ? Number(kind === "rent" ? it.rental_price ?? 0 : it.unit_price ?? 0) : 0;
    updateLine(key, {
      item_id: id,
      item_name: it?.name ?? "",
      unit_price: price.toString(),
    });
  };

  const onPickKind = (key: string, kind: "buy" | "rent") => {
    const line = lines.find((l) => l.key === key);
    if (!line) return;
    const it = items.find((i) => i.id === line.item_id);
    const price = it ? Number(kind === "rent" ? it.rental_price ?? 0 : it.unit_price ?? 0) : Number(line.unit_price);
    updateLine(key, {
      kind,
      unit_price: price.toString(),
    });
  };

  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0);

  const save = useMutation({
    mutationFn: async () => {
      if (!customer.trim()) throw new Error(t.common.required);
      const valid = lines.filter((l) => l.item_name.trim() && Number(l.quantity) > 0);
      if (valid.length === 0) throw new Error(t.sales.atLeastOne);

      const payload = {
        customer_name: customer.trim(),
        taken_at: takenAt,
        status,
        payment_due_date: status === "pending" ? (dueDate || null) : null,
        paid_at: status === "paid" ? takenAt : null,
        notes: notes.trim() || null,
        lines: valid.map((l) => ({
          item_id: l.item_id || null,
          item_name: l.item_name.trim(),
          quantity: Number(l.quantity) || 1,
          unit_price: Number(l.unit_price) || 0,
          kind: l.kind,
          rental_return_date: l.kind === "rent" ? (l.rental_return_date || null) : null,
        })),
      };

      const { error } = await supabase.rpc("create_transaction", { payload: payload as unknown as import("@/integrations/supabase/types").Json });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["transaction_lines"] });
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success(t.common.saved);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || t.common.error),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-md flex-col rounded-t-3xl bg-card shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 pb-3">
          <h2 className="font-display text-2xl font-semibold">{t.sales.add}</h2>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto px-6">
            <Field label={t.sales.customer}>
              <input autoFocus required value={customer} onChange={(e) => setCustomer(e.target.value)} className="input" />
            </Field>

            <Field label={t.sales.taken}>
              <DatePicker value={takenAt} onChange={setTakenAt} />
            </Field>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.sales.lines}</span>
                <button type="button" onClick={() => setLines((ls) => [...ls, newLine()])} className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
                  <Plus className="h-3 w-3" /> {t.sales.addLine}
                </button>
              </div>

              <div className="space-y-3">
                {lines.map((l) => {
                  const it = items.find((i) => i.id === l.item_id);
                  const lineTotal = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0);
                  return (
                    <div key={l.key} className="rounded-xl border border-border bg-background p-3">
                      <div className="mb-2 flex items-start gap-2">
                        <select value={l.item_id} onChange={(e) => onPickItem(l.key, e.target.value, l.kind)} className="input flex-1">
                          <option value="">— {t.sales.itemPh}</option>
                          {items.map((i) => (
                            <option key={i.id} value={i.id}>{i.name} ({i.quantity})</option>
                          ))}
                        </select>
                        <button type="button" onClick={() => setLines((ls) => ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls)} className="rounded-lg p-2 text-destructive hover:bg-muted">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <input
                        value={l.item_name}
                        placeholder={t.sales.itemPh}
                        onChange={(e) => updateLine(l.key, { item_name: e.target.value, item_id: "" })}
                        className="input mb-2"
                      />

                      <div className="mb-2 flex gap-1 rounded-lg bg-muted p-1">
                        <KindBtn active={l.kind === "buy"} onClick={() => onPickKind(l.key, "buy")}>{t.sales.buy}</KindBtn>
                        <KindBtn active={l.kind === "rent"} onClick={() => onPickKind(l.key, "rent")} disabled={!it?.rental_price}>{t.sales.rent}</KindBtn>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Field label={t.sales.qty}>
                          <input type="number" inputMode="numeric" min={1} value={l.quantity} onChange={(e) => updateLine(l.key, { quantity: e.target.value.replace(/^0+(?=\d)/, "") })} className="input" />
                        </Field>
                        <Field label={t.sales.price}>
                          <input type="number" inputMode="decimal" min={0} step="0.01" value={l.unit_price} onChange={(e) => updateLine(l.key, { unit_price: e.target.value.replace(/^0+(?=\d)/, "") })} className="input" />
                        </Field>
                      </div>

                      {l.kind === "rent" && (
                        <Field label={t.sales.returnBy}>
                          <DatePicker value={l.rental_return_date} onChange={(d) => updateLine(l.key, { rental_return_date: d })} />
                        </Field>
                      )}

                      <div className="mt-2 flex justify-end text-sm font-semibold text-primary">
                        {money(lineTotal)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.sales.payment}</span>
              <div className="mb-2 flex gap-1 rounded-lg bg-card p-1">
                <KindBtn active={status === "paid"} onClick={() => setStatus("paid")}>{t.sales.payNow}</KindBtn>
                <KindBtn active={status === "pending"} onClick={() => setStatus("pending")}>{t.sales.payLater}</KindBtn>
              </div>
              {status === "pending" && (
                <Field label={t.sales.promisedDate}>
                  <DatePicker value={dueDate} onChange={setDueDate} />
                </Field>
              )}
            </div>

            <Field label={t.sales.notes}>
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="input resize-none" />
            </Field>
          </div>

          <div className="border-t border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.sales.total}</span>
              <span className="font-display text-2xl font-semibold text-primary">{money(total)}</span>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-ghost flex-1">{t.inventory.cancel}</button>
              <button type="submit" disabled={save.isPending} className="btn-primary flex-1">
                {save.isPending ? t.common.saving : t.inventory.save}
              </button>
            </div>
          </div>
        </form>
      </div>

      <style>{`
        .input { width:100%; border:1px solid var(--input); background:var(--background); border-radius: var(--radius); padding: 0.55rem 0.75rem; font-size:0.92rem; outline:none; transition: border-color .15s; }
        .input:focus { border-color: var(--ring); box-shadow: 0 0 0 3px color-mix(in oklab, var(--ring) 18%, transparent); }
        .btn-primary { background: var(--primary); color: var(--primary-foreground); border-radius: var(--radius); padding: 0.7rem 1rem; font-weight:600; font-size:0.95rem; }
        .btn-primary:disabled { opacity:.6; }
        .btn-ghost { background: var(--secondary); color: var(--secondary-foreground); border-radius: var(--radius); padding: 0.7rem 1rem; font-weight:600; font-size:0.95rem; }
      `}</style>
    </div>
  );
}

function KindBtn({ active, onClick, disabled, children }: { active: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-active={active}
      className="flex-1 rounded-md py-1.5 text-xs font-semibold text-muted-foreground transition data-[active=true]:bg-primary data-[active=true]:text-primary-foreground disabled:opacity-40"
    >
      {children}
    </button>
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
