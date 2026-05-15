import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { AppHeader } from "@/components/AppHeader";
import { PayLaterForm } from "@/components/PayLaterForm";
import type { Tables } from "@/integrations/supabase/types";
import { Plus, Check, RotateCcw, Trash2, Pencil, Calendar } from "lucide-react";
import { toast } from "sonner";
import { money, formatDate } from "@/lib/format";

type PayLater = Tables<"pay_later">;

export const Route = createFileRoute("/fiado")({
  head: () => ({
    meta: [
      { title: "Pay Later · Shelf" },
      { name: "description", content: "Track open pay-later tabs and balances." },
    ],
  }),
  component: FiadoPage,
});

function FiadoPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"open" | "paid" | "all">("open");
  const [editing, setEditing] = useState<PayLater | null | undefined>(undefined);

  const { data: tabs = [], isLoading } = useQuery({
    queryKey: ["pay_later"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pay_later").select("*").order("taken_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const togglePaid = useMutation({
    mutationFn: async (tab: PayLater) => {
      const { error } = await supabase
        .from("pay_later")
        .update({ paid: !tab.paid, paid_at: !tab.paid ? new Date().toISOString() : null })
        .eq("id", tab.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pay_later"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pay_later").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pay_later"] });
      toast.success(t.common.deleted);
    },
  });

  const filtered = tabs.filter((tab) =>
    filter === "all" ? true : filter === "open" ? !tab.paid : tab.paid
  );
  const owed = tabs.filter((tab) => !tab.paid).reduce((s, tab) => s + Number(tab.amount || 0), 0);

  return (
    <>
      <AppHeader title={t.fiado.title} subtitle={t.fiado.subtitle} />

      <main className="flex-1 px-5">
        <div className="mb-4 rounded-2xl border border-border bg-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.fiado.total}</div>
          <div className="mt-1 font-display text-3xl font-semibold text-primary">{money(owed)}</div>
        </div>

        <div className="flex gap-2">
          <Chip active={filter === "open"} onClick={() => setFilter("open")}>{t.fiado.filterOpen}</Chip>
          <Chip active={filter === "paid"} onClick={() => setFilter("paid")}>{t.fiado.filterPaid}</Chip>
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>{t.fiado.filterAll}</Chip>
        </div>

        <ul className="mt-4 space-y-2">
          {isLoading && <li className="text-sm text-muted-foreground">…</li>}
          {!isLoading && filtered.length === 0 && (
            <li className="rounded-2xl bg-muted/60 px-4 py-8 text-center text-sm text-muted-foreground">
              {t.fiado.empty}
            </li>
          )}
          {filtered.map((tab) => (
            <li
              key={tab.id}
              className="rounded-2xl border border-border bg-card p-4"
              style={tab.paid ? { opacity: 0.7 } : undefined}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-foreground">{tab.customer_name}</p>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                      style={{
                        background: tab.paid ? "color-mix(in oklab, var(--success) 18%, transparent)" : "color-mix(in oklab, var(--accent) 30%, transparent)",
                        color: tab.paid ? "var(--success)" : "var(--accent-foreground)",
                      }}
                    >
                      {tab.paid ? t.fiado.paid : t.fiado.open}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-foreground/80">{tab.item_name} · {tab.quantity}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatDate(tab.taken_at, lang)}
                    {tab.due_date && <> · {t.fiado.due}: {formatDate(tab.due_date, lang)}</>}
                  </p>
                  {tab.notes && <p className="mt-1 text-xs text-muted-foreground">{tab.notes}</p>}
                </div>
                <div className="text-right">
                  <div className="font-display text-lg font-semibold text-primary">{money(tab.amount)}</div>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => togglePaid.mutate(tab)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold"
                  style={
                    tab.paid
                      ? { background: "var(--secondary)", color: "var(--secondary-foreground)" }
                      : { background: "var(--success)", color: "var(--success-foreground)" }
                  }
                >
                  {tab.paid ? <><RotateCcw className="h-3 w-3" /> {t.fiado.markUnpaid}</> : <><Check className="h-3 w-3" /> {t.fiado.markPaid}</>}
                </button>
                <button onClick={() => setEditing(tab)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground">
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={() => { if (confirm(t.inventory.confirmDelete)) del.mutate(tab.id); }}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </main>

      <button
        onClick={() => setEditing(null)}
        className="fixed bottom-24 right-1/2 z-30 flex translate-x-[12.5rem] items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 max-[28rem]:right-5 max-[28rem]:translate-x-0"
      >
        <Plus className="h-4 w-4" /> {t.fiado.add}
      </button>

      {editing !== undefined && <PayLaterForm entry={editing} onClose={() => setEditing(undefined)} />}
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
