import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { AppHeader } from "@/components/AppHeader";
import { AlertTriangle, Package, Receipt, Plus, ArrowRight, PackageCheck } from "lucide-react";
import { money } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

type Item = Tables<"items">;
type Transaction = Tables<"transactions">;
type Line = Tables<"transaction_lines">;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shelf — Today" },
      { name: "description", content: "Your inventory at a glance: low stock, open tabs and rentals." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { t } = useI18n();

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("items").select("*").order("name");
      if (error) throw error;
      return data as Item[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*").order("taken_at", { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    },
  });

  const { data: lines = [] } = useQuery({
    queryKey: ["transaction_lines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transaction_lines").select("*");
      if (error) throw error;
      return data as Line[];
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const lowStock = items.filter((i) => i.quantity <= i.low_stock_threshold);
  const pending = txs.filter((tx) => tx.status === "pending");
  const owed = pending.reduce((s, tx) => s + Number(tx.total_amount || 0), 0);
  const rentalsOut = lines.filter((l) => l.kind === "rent" && !l.returned_at);
  const overdueRentals = rentalsOut.filter((l) => l.rental_return_date && l.rental_return_date < today).length;
  const catById = new Map(categories.map((c) => [c.id, c]));

  return (
    <>
      <AppHeader />

      <main className="flex-1 px-5">
        <section className="grid grid-cols-2 gap-3">
          <StatCard
            tone="warning"
            icon={<AlertTriangle className="h-4 w-4" />}
            label={t.dashboard.lowStock}
            value={lowStock.length.toString()}
          />
          <StatCard
            tone="primary"
            icon={<Receipt className="h-4 w-4" />}
            label={t.dashboard.outstanding}
            value={money(owed)}
            sub={`${pending.length} · ${t.dashboard.openTabs}`}
          />
          <StatCard
            icon={<Package className="h-4 w-4" />}
            label={t.dashboard.totalItems}
            value={items.length.toString()}
            sub={`${categories.length} · ${t.dashboard.categories}`}
          />
          <StatCard
            icon={<PackageCheck className="h-4 w-4" />}
            label={t.dashboard.rentalsOut}
            value={rentalsOut.length.toString()}
            sub={overdueRentals > 0 ? `${overdueRentals} · ${t.dashboard.overdue}` : undefined}
            tone={overdueRentals > 0 ? "warning" : "default"}
          />
        </section>

        <section className="mt-7">
          <SectionHeader title={t.dashboard.lowStock} to="/inventory" />
          {lowStock.length === 0 ? (
            <p className="rounded-2xl bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">{t.dashboard.noLowStock}</p>
          ) : (
            <ul className="space-y-2">
              {lowStock.slice(0, 5).map((i) => {
                const out = i.quantity === 0;
                const catName = i.category_id ? catById.get(i.category_id)?.name : null;
                return (
                  <li key={i.id} className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{i.name}</p>
                      {catName && <p className="truncate text-xs text-muted-foreground">{catName}</p>}
                    </div>
                    <span
                      className="ml-3 shrink-0 rounded-full px-2.5 py-1 text-xs font-bold"
                      style={{
                        background: out ? "var(--destructive)" : "var(--warning)",
                        color: out ? "var(--destructive-foreground)" : "var(--warning-foreground)",
                      }}
                    >
                      {out ? t.inventory.out : `${i.quantity} · ${t.inventory.low}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-7">
          <SectionHeader title={t.dashboard.openTabs} to="/sales" />
          {pending.length === 0 ? (
            <p className="rounded-2xl bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">{t.sales.empty}</p>
          ) : (
            <ul className="space-y-2">
              {pending.slice(0, 4).map((tx) => (
                <li key={tx.id} className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{tx.customer_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {tx.payment_due_date ? `${t.sales.due}: ${tx.payment_due_date}` : ""}
                    </p>
                  </div>
                  <span className="ml-3 shrink-0 font-display text-base font-semibold text-primary">
                    {money(tx.total_amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-7">
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t.dashboard.quickAdd}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/inventory" className="flex items-center justify-between rounded-2xl bg-primary px-4 py-4 text-primary-foreground">
              <span className="font-semibold">{t.dashboard.addItem}</span>
              <Plus className="h-5 w-5" />
            </Link>
            <Link to="/sales" className="flex items-center justify-between rounded-2xl bg-accent px-4 py-4 text-accent-foreground">
              <span className="font-semibold">{t.dashboard.addSale}</span>
              <Plus className="h-5 w-5" />
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}

function StatCard({ icon, label, value, sub, tone = "default" }: {
  icon?: React.ReactNode; label: string; value: string; sub?: string;
  tone?: "default" | "primary" | "warning";
}) {
  const styles =
    tone === "warning"
      ? { background: "color-mix(in oklab, var(--warning) 18%, var(--card))", borderColor: "color-mix(in oklab, var(--warning) 35%, transparent)" }
      : tone === "primary"
      ? { background: "color-mix(in oklab, var(--primary) 8%, var(--card))", borderColor: "var(--border)" }
      : { background: "var(--card)", borderColor: "var(--border)" };

  return (
    <div className="rounded-2xl border p-4" style={styles}>
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}<span>{label}</span>
      </div>
      <div className="mt-2 font-display text-2xl font-semibold text-foreground">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function SectionHeader({ title, to }: { title: string; to: string }) {
  return (
    <div className="mb-2 flex items-center justify-between px-1">
      <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
      <Link to={to} className="flex items-center gap-1 text-xs font-semibold text-primary">
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
