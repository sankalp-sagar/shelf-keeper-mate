import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { buildTree, type Category, type CategoryNode } from "@/lib/categories";
import { ChevronRight, Plus, Trash2, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";

export function CategoryManager({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [addingUnder, setAddingUnder] = useState<string | null | undefined>(undefined);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order").order("name");
      if (error) throw error;
      return data as Category[];
    },
  });

  const tree = buildTree(categories);

  const add = useMutation({
    mutationFn: async ({ name, parent_id }: { name: string; parent_id: string | null }) => {
      const { error } = await supabase.from("categories").insert({ name: name.trim(), parent_id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      setNewName("");
      setAddingUnder(undefined);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rename = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("categories").update({ name: name.trim() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["items"] });
      setRenamingId(null);
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success(t.common.deleted);
    },
  });

  const toggle = (id: string) => {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const renderNode = (node: CategoryNode) => {
    const isExpanded = expanded.has(node.id);
    const hasChildren = node.children.length > 0;
    return (
      <li key={node.id}>
        <div className="flex items-center gap-1 rounded-lg py-1.5" style={{ paddingLeft: `${node.depth * 14}px` }}>
          <button
            onClick={() => hasChildren && toggle(node.id)}
            className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
            disabled={!hasChildren}
            aria-label="toggle"
          >
            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
          </button>
          {renamingId === node.id ? (
            <>
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") rename.mutate({ id: node.id, name: renameValue }); if (e.key === "Escape") setRenamingId(null); }}
                className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm"
              />
              <button onClick={() => rename.mutate({ id: node.id, name: renameValue })} className="rounded p-1 text-success">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setRenamingId(null)} className="rounded p-1 text-muted-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              <span className="flex-1 truncate text-sm font-medium text-foreground">{node.name}</span>
              <button onClick={() => { setAddingUnder(node.id); setNewName(""); }} title={t.categories.addChild} className="rounded p-1 text-muted-foreground hover:bg-muted">
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => { setRenamingId(node.id); setRenameValue(node.name); }} className="rounded p-1 text-muted-foreground hover:bg-muted">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => { if (confirm(t.categories.confirmDelete)) del.mutate(node.id); }} className="rounded p-1 text-destructive hover:bg-muted">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>

        {addingUnder === node.id && (
          <div className="mb-1 flex items-center gap-1" style={{ paddingLeft: `${(node.depth + 1) * 14 + 28}px` }}>
            <input
              autoFocus
              value={newName}
              placeholder="Name"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) add.mutate({ name: newName, parent_id: node.id });
                if (e.key === "Escape") setAddingUnder(undefined);
              }}
              className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm"
            />
            <button onClick={() => newName.trim() && add.mutate({ name: newName, parent_id: node.id })} className="rounded p-1 text-success">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setAddingUnder(undefined)} className="rounded p-1 text-muted-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {isExpanded && hasChildren && (
          <ul>{node.children.map(renderNode)}</ul>
        )}
      </li>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl bg-card p-6 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold">{t.categories.title}</h2>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-3 flex gap-2">
          <input
            value={addingUnder === null ? newName : ""}
            onFocus={() => { setAddingUnder(null); setNewName(""); }}
            placeholder={t.categories.add}
            onChange={(e) => { setAddingUnder(null); setNewName(e.target.value); }}
            onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) add.mutate({ name: newName, parent_id: null }); }}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={() => newName.trim() && add.mutate({ name: newName, parent_id: null })}
            className="rounded-lg bg-primary px-3 text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <ul className="flex-1 overflow-y-auto">
          {tree.length === 0 && (
            <li className="rounded-2xl bg-muted/60 px-4 py-8 text-center text-sm text-muted-foreground">{t.categories.empty}</li>
          )}
          {tree.map(renderNode)}
        </ul>
      </div>
    </div>
  );
}
