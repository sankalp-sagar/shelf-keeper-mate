import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { AppHeader } from "@/components/AppHeader";
import { CURRENCIES } from "@/lib/format";
import { toast } from "sonner";
import { AlertTriangle, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Settings · Shelf" },
      { name: "description", content: "Currency and data tools." },
    ],
  }),
  component: AdminPage,
});

type ResetKind = "sales" | "inventory" | "categories" | "all";

function AdminPage() {
  const { t, currency, setCurrency } = useI18n();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<ResetKind | null>(null);

  const reset = useMutation({
    mutationFn: async (kind: ResetKind) => {
      setBusy(kind);
      // Always wipe lines/transactions first if affected (FK-less but logically referenced).
      if (kind === "sales" || kind === "all" || kind === "inventory") {
        const { error: e1 } = await supabase.from("transaction_lines").delete().not("id", "is", null);
        if (e1) throw e1;
        const { error: e2 } = await supabase.from("transactions").delete().not("id", "is", null);
        if (e2) throw e2;
      }
      if (kind === "inventory" || kind === "all") {
        const { error } = await supabase.from("items").delete().not("id", "is", null);
        if (error) throw error;
      }
      if (kind === "categories" || kind === "all") {
        const { error } = await supabase.from("categories").delete().not("id", "is", null);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success(t.admin.done);
      setBusy(null);
    },
    onError: (e: Error) => {
      toast.error(e.message || t.common.error);
      setBusy(null);
    },
  });

  const ask = (kind: ResetKind, msg: string) => {
    if (confirm(msg)) reset.mutate(kind);
  };

  return (
    <>
      <AppHeader title={t.admin.title} subtitle={t.admin.subtitle} />

      <main className="flex-1 px-5">
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-display text-lg font-semibold">{t.admin.currency}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.admin.currencyHint}</p>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </section>

        <section className="mt-6 rounded-2xl border p-4" style={{ background: "color-mix(in oklab, var(--destructive) 6%, var(--card))", borderColor: "color-mix(in oklab, var(--destructive) 30%, transparent)" }}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h2 className="font-display text-lg font-semibold">{t.admin.dangerZone}</h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.admin.dangerHint}</p>

          <div className="mt-4 grid gap-2">
            <DangerBtn label={t.admin.resetSales} loading={busy === "sales"} onClick={() => ask("sales", t.admin.resetSalesConfirm)} />
            <DangerBtn label={t.admin.resetInventory} loading={busy === "inventory"} onClick={() => ask("inventory", t.admin.resetInventoryConfirm)} />
            <DangerBtn label={t.admin.resetCategories} loading={busy === "categories"} onClick={() => ask("categories", t.admin.resetCategoriesConfirm)} />
            <DangerBtn label={t.admin.resetAll} strong loading={busy === "all"} onClick={() => ask("all", t.admin.resetAllConfirm)} />
          </div>
        </section>
      </main>
    </>
  );
}

function DangerBtn({ label, onClick, loading, strong }: { label: string; onClick: () => void; loading: boolean; strong?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm font-semibold transition disabled:opacity-60"
      style={{
        background: strong ? "var(--destructive)" : "var(--card)",
        color: strong ? "var(--destructive-foreground)" : "var(--destructive)",
        borderColor: "color-mix(in oklab, var(--destructive) 40%, transparent)",
      }}
    >
      <span>{label}</span>
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
