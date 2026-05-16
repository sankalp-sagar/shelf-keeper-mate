import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { AppHeader } from "@/components/AppHeader";
import { TransactionForm } from "@/components/TransactionForm";
import { DatePicker } from "@/components/ui/date-picker";
import type { Tables } from "@/integrations/supabase/types";
import { Plus, Check, RotateCcw, Trash2, ChevronDown, Calendar, PackageCheck, PackageOpen } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

type Transaction = Tables<"transactions">;
type Line = Tables<"transaction_lines">;

export const Route = createFileRoute("/sales")({
  head: () => ({
    meta: [
      { title: "Sales · Shelf" },
      { name: "description", content: "Purchases, rentals and pay-later tabs." },
    ],
  }),
  component: SalesPage,
});

type Filter = "pending" | "paid" | "rentals" | "all";

function SalesPage() {
  const { t, lang, money } = useI18n();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("pending");
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [payingTx, setPayingTx] = useState<Transaction | null>(null);
  const [paidDate, setPaidDate] = useState("");

  const { data: txs = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*").order("taken_at", { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    },
  });

  const { data: linesAll = [] } = useQuery({
    queryKey: ["transaction_lines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transaction_lines").select("*");
      if (error) throw error;
      return data as Line[];
    },
  });

  const linesByTx = new Map<string, Line[]>();
  linesAll.forEach((l) => {
    if (!linesByTx.has(l.transaction_id)) linesByTx.set(l.transaction_id, []);
    linesByTx.get(l.transaction_id)!.push(l);
  });

  const markPaid = useMutation({
    mutationFn: async ({ tx, paid_at }: { tx: Transaction; paid_at: string | null }) => {
      const newStatus = paid_at ? "paid" : "pending";
      const { error } = await supabase
        .from("transactions")
        .update({ status: newStatus, paid_at })
        .eq("id", tx.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setPayingTx(null);
    },
  });

  const toggleReturned = useMutation({
    mutationFn: async ({ id, returned }: { id: string; returned: boolean }) => {
      const { error } = await supabase.rpc("set_line_returned", { line_id: id, returned });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transaction_lines"] });
      qc.invalidateQueries({ queryKey: ["items"] });
    },
  });

  const delTx = useMutation({
    mutationFn: async (id: string) => {
      // Restore stock for any unreturned rentals first
      const lines = linesByTx.get(id) ?? [];
      for (const l of lines) {
        if (l.kind === "rent" && !l.returned_at && l.item_id) {
          await supabase.rpc("set_line_returned", { line_id: l.id, returned: true });
        }
      }
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["transaction_lines"] });
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success(t.common.deleted);
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const filtered = txs.filter((tx) => {
    if (filter === "pending") return tx.status === "pending";
    if (filter === "paid") return tx.status === "paid";
    if (filter === "rentals") {
      const lines = linesByTx.get(tx.id) ?? [];
      return lines.some((l) => l.kind === "rent" && !l.returned_at);
    }
    return true;
  });

  const owed = txs.filter((tx) => tx.status === "pending").reduce((s, tx) => s + Number(tx.total_amount || 0), 0);

  const toggleExp = (id: string) => setExpanded((s) => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  return (
    <>
      <AppHeader title={t.sales.title} subtitle={t.sales.subtitle} />

      <main className="flex-1 px-5">
        <div className="mb-4 rounded-2xl border border-border bg-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.sales.totalOwed}</div>
          <div className="mt-1 font-display text-3xl font-semibold text-primary">{money(owed)}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip active={filter === "pending"} onClick={() => setFilter("pending")}>{t.sales.filterPending}</Chip>
          <Chip active={filter === "paid"} onClick={() => setFilter("paid")}>{t.sales.filterPaid}</Chip>
          <Chip active={filter === "rentals"} onClick={() => setFilter("rentals")}>{t.sales.filterRentals}</Chip>
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>{t.sales.filterAll}</Chip>
        </div>

        <ul className="mt-4 space-y-2">
          {filtered.length === 0 && (
            <li className="rounded-2xl bg-muted/60 px-4 py-8 text-center text-sm text-muted-foreground">{t.sales.empty}</li>
          )}
          {filtered.map((tx) => {
            const lines = linesByTx.get(tx.id) ?? [];
            const isOpen = expanded.has(tx.id);
            const isPending = tx.status === "pending";
            const overdue = isPending && tx.payment_due_date && tx.payment_due_date < today;
            return (
              <li key={tx.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <button onClick={() => toggleExp(tx.id)} className="w-full p-4 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-foreground">{tx.customer_name}</p>
                        <StatusBadge status={tx.status} overdue={!!overdue} t={t} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {t.sales.itemsCount(lines.length)} · {formatDate(tx.taken_at, lang)}
                        {tx.payment_due_date && isPending && <> · {t.sales.due}: {formatDate(tx.payment_due_date, lang)}</>}
                        {tx.paid_at && !isPending && <> · {t.sales.paidOn}: {formatDate(tx.paid_at, lang)}</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-lg font-semibold text-primary">{money(tx.total_amount)}</span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border bg-background/40 p-4">
                    <ul className="space-y-2">
                      {lines.map((l) => (
                        <li key={l.id} className="flex items-start justify-between gap-2 rounded-lg bg-card p-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium">{l.item_name}</p>
                              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                                {l.kind === "rent" ? t.sales.rent : t.sales.buy}
                              </span>
                              {l.kind === "rent" && l.returned_at && (
                                <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: "color-mix(in oklab, var(--success) 18%, transparent)", color: "var(--success)" }}>
                                  {t.sales.returned}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {l.quantity} × {money(l.unit_price)} = {money(l.line_total)}
                              {l.kind === "rent" && l.rental_return_date && <> · {t.sales.returnBy}: {formatDate(l.rental_return_date, lang)}</>}
                            </p>
                          </div>
                          {l.kind === "rent" && (
                            <button
                              onClick={() => toggleReturned.mutate({ id: l.id, returned: !l.returned_at })}
                              className="shrink-0 rounded-lg border border-border p-1.5 text-muted-foreground"
                              title={l.returned_at ? t.sales.markNotReturned : t.sales.markReturned}
                            >
                              {l.returned_at ? <PackageOpen className="h-3.5 w-3.5" /> : <PackageCheck className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>

                    {tx.notes && <p className="mt-3 text-xs text-muted-foreground">{tx.notes}</p>}

                    <div className="mt-3 flex gap-2">
                      {isPending ? (
                        <button
                          onClick={() => { setPayingTx(tx); setPaidDate(today); }}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold"
                          style={{ background: "var(--success)", color: "var(--success-foreground)" }}
                        >
                          <Check className="h-3 w-3" /> {t.sales.markPaid}
                        </button>
                      ) : (
                        <button
                          onClick={() => markPaid.mutate({ tx, paid_at: null })}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-xs font-semibold"
                        >
                          <RotateCcw className="h-3 w-3" /> {t.sales.markUnpaid}
                        </button>
                      )}
                      <button
                        onClick={() => { if (confirm(t.sales.confirmDelete)) delTx.mutate(tx.id); }}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </main>

      <button
        onClick={() => setCreating(true)}
        className="fixed bottom-24 right-1/2 z-30 flex translate-x-[12.5rem] items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 max-[28rem]:right-5 max-[28rem]:translate-x-0"
      >
        <Plus className="h-4 w-4" /> {t.sales.add}
      </button>

      {creating && <TransactionForm onClose={() => setCreating(false)} />}

      {payingTx && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm sm:items-center" onClick={() => setPayingTx(null)}>
          <div className="w-full max-w-sm rounded-t-3xl bg-card p-6 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl font-semibold">{t.sales.markPaid}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{payingTx.customer_name} · {money(payingTx.total_amount)}</p>
            <div className="mt-4">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.sales.paidActualDate}</span>
              <DatePicker value={paidDate} onChange={setPaidDate} />
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setPayingTx(null)} className="flex-1 rounded-lg bg-secondary py-2 text-sm font-semibold text-secondary-foreground">{t.inventory.cancel}</button>
              <button onClick={() => markPaid.mutate({ tx: payingTx, paid_at: paidDate || today })} className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground">
                <Check className="mr-1 inline h-3 w-3" /> {t.sales.markPaid}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      data-active={active}
      className="rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition data-[active=true]:border-primary data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
    >
      {children}
    </button>
  );
}

function StatusBadge({ status, overdue, t }: { status: string; overdue: boolean; t: ReturnType<typeof useI18n>["t"] }) {
  const isPaid = status === "paid";
  const label = isPaid ? t.sales.paidBadge : overdue ? t.sales.overdueBadge : t.sales.pendingBadge;
  const bg = isPaid
    ? "color-mix(in oklab, var(--success) 18%, transparent)"
    : overdue
    ? "color-mix(in oklab, var(--destructive) 22%, transparent)"
    : "color-mix(in oklab, var(--accent) 30%, transparent)";
  const fg = isPaid ? "var(--success)" : overdue ? "var(--destructive)" : "var(--accent-foreground)";
  return (
    <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}
