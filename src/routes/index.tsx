import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { AppHeader } from "@/components/AppHeader";
import { AlertTriangle, Package, Receipt, Plus, ArrowRight } from "lucide-react";
import { money } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shelf — Today" },
      { name: "description", content: "Your inventory at a glance: low stock and open pay-later tabs." },
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
      return data;
    },
  });

  const { data: tabs = [] } = useQuery({
    queryKey: ["pay_later"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pay_later").select("*").order("taken_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const lowStock = items.filter((i) => i.quantity <= i.low_stock_threshold);
  const openTabs = tabs.filter((t) => !t.paid);
  const owed = openTabs.reduce((s, t) => s + Number(t.amount || 0), 0);
  const categories = new Set(items.map((i) => i.category).filter(Boolean)).size;

  return (
    <>
      <AppHeader />

      <main className="flex-1 px-5">
        {/* Stats grid */}
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
          />
          <StatCard
            icon={<Package className="h-4 w-4" />}
            label={t.dashboard.totalItems}
            value={items.length.toString()}
          />
          <StatCard
            label={t.dashboard.categories}
            value={categories.toString()}
            sub={t.dashboard.openTabs + ` · ${openTabs.length}`}
          />
        </section>

        {/* Low stock alerts */}
        <section className="mt-7">
          <SectionHeader title={t.dashboard.lowStock} to="/inventory" />
          {lowStock.length === 0 ? (
            <p className="rounded-2xl bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">
              {t.dashboard.noLowStock}
            </p>
          ) : (
            <ul className="space-y-2">
              {lowStock.slice(0, 5).map((i) => {
                const out = i.quantity === 0;
                return (
                  <li key={i.id} className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{i.name}</p>
                      {i.category && <p className="truncate text-xs text-muted-foreground">{i.category}</p>}
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

        {/* Open tabs */}
        <section className="mt-7">
          <SectionHeader title={t.dashboard.openTabs} to="/fiado" />
          {openTabs.length === 0 ? (
            <p className="rounded-2xl bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">
              {t.fiado.empty}
            </p>
          ) : (
            <ul className="space-y-2">
              {openTabs.slice(0, 4).map((tab) => (
                <li key={tab.id} className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{tab.customer_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{tab.item_name} · {tab.quantity}</p>
                  </div>
                  <span className="ml-3 shrink-0 font-display text-base font-semibold text-primary">
                    {money(tab.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Quick actions */}
        <section className="mt-7">
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t.dashboard.quickAdd}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/inventory" className="flex items-center justify-between rounded-2xl bg-primary px-4 py-4 text-primary-foreground">
              <span className="font-semibold">{t.dashboard.addItem}</span>
              <Plus className="h-5 w-5" />
            </Link>
            <Link to="/fiado" className="flex items-center justify-between rounded-2xl bg-accent px-4 py-4 text-accent-foreground">
              <span className="font-semibold">{t.dashboard.addFiado}</span>
              <Plus className="h-5 w-5" />
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}

function StatCard({
  icon, label, value, sub, tone = "default",
}: {
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
