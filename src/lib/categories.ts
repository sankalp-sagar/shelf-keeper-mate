import type { Tables } from "@/integrations/supabase/types";

export type Category = Tables<"categories">;

export type CategoryNode = Category & { children: CategoryNode[]; depth: number };

export function buildTree(categories: Category[]): CategoryNode[] {
  const map = new Map<string, CategoryNode>();
  categories.forEach((c) => map.set(c.id, { ...c, children: [], depth: 0 }));
  const roots: CategoryNode[] = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      const parent = map.get(node.parent_id)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sort = (arr: CategoryNode[]) => {
    arr.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    arr.forEach((c) => sort(c.children));
  };
  sort(roots);
  // recompute depth on full traversal (parent depth might have been wrong if processed before parent)
  const fix = (nodes: CategoryNode[], depth: number) => {
    nodes.forEach((n) => {
      n.depth = depth;
      fix(n.children, depth + 1);
    });
  };
  fix(roots, 0);
  return roots;
}

export function flattenTree(roots: CategoryNode[]): CategoryNode[] {
  const out: CategoryNode[] = [];
  const walk = (n: CategoryNode) => {
    out.push(n);
    n.children.forEach(walk);
  };
  roots.forEach(walk);
  return out;
}

export function descendantIds(roots: CategoryNode[], id: string): Set<string> {
  const set = new Set<string>([id]);
  const find = (nodes: CategoryNode[]): CategoryNode | null => {
    for (const n of nodes) {
      if (n.id === id) return n;
      const f = find(n.children);
      if (f) return f;
    }
    return null;
  };
  const node = find(roots);
  if (!node) return set;
  const walk = (n: CategoryNode) => {
    set.add(n.id);
    n.children.forEach(walk);
  };
  walk(node);
  return set;
}

export function categoryPath(categories: Category[], id: string | null | undefined): string {
  if (!id) return "";
  const byId = new Map(categories.map((c) => [c.id, c]));
  const parts: string[] = [];
  let cur = byId.get(id);
  let safety = 50;
  while (cur && safety-- > 0) {
    parts.unshift(cur.name);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return parts.join(" › ");
}
