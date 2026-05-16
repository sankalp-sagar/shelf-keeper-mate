import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useQueryClient } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";
import { AlertTriangle } from "lucide-react";

type Item = Tables<"items">;

/**
 * Listens for inventory changes and fires a toast the moment an item
 * crosses below its low-stock threshold (or goes out of stock).
 */
export function LowStockWatcher() {
  const { t } = useI18n();
  const qc = useQueryClient();
  // Track last-known qty per item so we only alert on the crossing event.
  const lastQty = useRef<Map<string, number>>(new Map());
  const seeded = useRef(false);

  useEffect(() => {
    // Seed from current items so an initial load doesn't spam toasts.
    (async () => {
      const { data } = await supabase.from("items").select("id,quantity");
      if (data) data.forEach((r) => lastQty.current.set(r.id, r.quantity));
      seeded.current = true;
    })();

    const channel = supabase
      .channel("items-low-stock")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "items" },
        (payload) => {
          const item = payload.new as Item;
          const prev = lastQty.current.get(item.id);
          lastQty.current.set(item.id, item.quantity);
          qc.invalidateQueries({ queryKey: ["items"] });
          if (!seeded.current || prev === undefined) return;
          const threshold = item.low_stock_threshold ?? 0;
          // Fire only when crossing from above-threshold to at/below.
          if (prev > threshold && item.quantity <= threshold) {
            if (item.quantity === 0) {
              toast.warning(t.inventory.outAlarm(item.name), { icon: <AlertTriangle className="h-4 w-4" />, duration: 6000 });
            } else {
              toast.warning(t.inventory.lowAlarm(item.name, item.quantity), { icon: <AlertTriangle className="h-4 w-4" />, duration: 6000 });
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "items" },
        (payload) => {
          const item = payload.new as Item;
          lastQty.current.set(item.id, item.quantity);
          qc.invalidateQueries({ queryKey: ["items"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "items" },
        (payload) => {
          const old = payload.old as { id?: string };
          if (old.id) lastQty.current.delete(old.id);
          qc.invalidateQueries({ queryKey: ["items"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, t]);

  return null;
}
