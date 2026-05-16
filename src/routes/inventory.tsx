import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { AppHeader } from "@/components/AppHeader";
import { ItemForm } from "@/components/ItemForm";
import { CategoryManager } from "@/components/CategoryManager";
import type { Tables } from "@/integrations/supabase/types";
import { Plus, Search, Minus, Trash2, Pencil, FolderTree, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { buildTree, descendantIds, type Category, type CategoryNode } from "@/lib/categories";

type Item = Tables<"items">;

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory · Shelf" },
      { name: "description", content: "All your tracked items with low-stock indicators." },
    ],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const { t, money } = useI18n();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low">("all");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Item | null | undefined>(undefined);
  const [showCats, setShowCats] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: items = [], isLoading } = useQuery({
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
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data as Category[];
    },
  });

  const tree = useMemo(() => buildTree(categories), [categories]);
  const allowedCategoryIds = useMemo(() => categoryId ? descendantIds(tree, categoryId) : null, [tree, categoryId]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const adjust = useMutation({
    mutationFn: async ({ id, delta, current }: { id: string; delta: number; current: number }) => {
      const next = Math.max(0, current + delta);
      const { error } = await supabase.from("items").update({ quantity: next }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["items"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success(t.common.deleted);
    },
  });

  const filtered = items.filter((i) => {
    const cat = i.category_id ? categoryById.get(i.category_id) : null;
    const catName = cat?.name ?? "";
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || catName.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || (filter === "low" && i.quantity <= i.low_stock_threshold);
    const matchCat = !allowedCategoryIds || (i.category_id && allowedCategoryIds.has(i.category_id));
    return matchSearch && matchFilter && matchCat;
  });

  const toggle = (id: string) => setExpanded((s) => {
    const next = new Set(s);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const renderCatNode = (node: CategoryNode) => {
    const active = categoryId === node.id;
    const isExpanded = expanded.has(node.id);
    const hasChildren = node.children.length > 0;
    return (
      <li key={node.id}>
        <div className="flex items-center gap-1" style={{ paddingLeft: `${node.depth * 12}px` }}>
          <button
            onClick={() => hasChildren && toggle(node.id)}
            className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
            disabled={!hasChildren}
            aria-label="toggle"
          >
            <ChevronRight className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
          </button>
          <button
            onClick={() => setCategoryId(active ? null : node.id)}
            data-active={active}
            className="flex-1 truncate rounded-md px-2 py-1 text-left text-sm transition data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-muted/60"
          >
            {node.name}
          </button>
        </div>
        {isExpanded && hasChildren && <ul>{node.children.map(renderCatNode)}</ul>}
      </li>
    );
  };

  return (
    <>
      <AppHeader title={t.inventory.title} />

      <main className="flex-1 px-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.inventory.search}
            className="w-full rounded-full border border-border bg-card py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-ring"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>{t.inventory.filterAll}</Chip>
          <Chip active={filter === "low"} onClick={() => setFilter("low")}>{t.inventory.filterLow}</Chip>
          <button
            onClick={() => setShowCats(true)}
            className="ml-auto flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
          >
            <FolderTree className="h-3.5 w-3.5" /> {t.inventory.manageCategories}
          </button>
        </div>

        {tree.length > 0 && (
          <div className="mt-3 rounded-2xl border border-border bg-card p-2">
            <ul>
              <li>
                <button
                  onClick={() => setCategoryId(null)}
                  data-active={categoryId === null}
                  className="w-full rounded-md px-3 py-1 text-left text-sm transition data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-muted/60"
                >
                  {t.inventory.filterAll}
                </button>
              </li>
              {tree.map(renderCatNode)}
            </ul>
          </div>
        )}

        <ul className="mt-4 space-y-2">
          {isLoading && <li className="text-sm text-muted-foreground">…</li>}
          {!isLoading && filtered.length === 0 && (
            <li className="rounded-2xl bg-muted/60 px-4 py-8 text-center text-sm text-muted-foreground">
              {t.inventory.empty}
            </li>
          )}
          {filtered.map((i) => {
            const low = i.quantity <= i.low_stock_threshold;
            const out = i.quantity === 0;
            const catName = i.category_id ? categoryById.get(i.category_id)?.name : null;
            return (
              <li key={i.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-foreground">{i.name}</p>
                      {low && (
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                          style={{
                            background: out ? "var(--destructive)" : "var(--warning)",
                            color: out ? "var(--destructive-foreground)" : "var(--warning-foreground)",
                          }}
                        >
                          {out ? t.inventory.out : t.inventory.low}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {catName || t.inventory.uncategorized}{i.unit_price ? ` · ${money(i.unit_price)}` : ""}
                    </p>
                    {i.notes && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{i.notes}</p>}
                  </div>

                  <div className="flex items-center gap-1 rounded-full bg-secondary p-1">
                    <button
                      onClick={() => adjust.mutate({ id: i.id, delta: -1, current: i.quantity })}
                      className="rounded-full p-1.5 text-secondary-foreground transition hover:bg-card disabled:opacity-40"
                      disabled={i.quantity === 0}
                      aria-label="-"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-[1.75rem] text-center font-display text-base font-semibold tabular-nums">
                      {i.quantity}
                    </span>
                    <button
                      onClick={() => adjust.mutate({ id: i.id, delta: 1, current: i.quantity })}
                      className="rounded-full p-1.5 text-secondary-foreground transition hover:bg-card"
                      aria-label="+"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button onClick={() => setEditing(i)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-xs font-semibold text-foreground">
                    <Pencil className="h-3 w-3" /> {t.inventory.edit}
                  </button>
                  <button
                    onClick={() => { if (confirm(t.inventory.confirmDelete)) del.mutate(i.id); }}
                    className="flex items-center justify-center rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </main>

      <button
        onClick={() => setEditing(null)}
        className="fixed bottom-24 right-1/2 z-30 flex translate-x-[12.5rem] items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 max-[28rem]:right-5 max-[28rem]:translate-x-0"
      >
        <Plus className="h-4 w-4" /> {t.inventory.add}
      </button>

      {editing !== undefined && <ItemForm item={editing} defaultCategoryId={categoryId} onClose={() => setEditing(undefined)} />}
      {showCats && <CategoryManager onClose={() => setShowCats(false)} />}
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
