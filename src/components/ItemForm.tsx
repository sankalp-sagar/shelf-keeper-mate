import { useEffect, useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { X, FolderTree, Upload, Trash2 } from "lucide-react";
import { buildTree, flattenTree, type Category } from "@/lib/categories";
import { CategoryManager } from "./CategoryManager";

type Item = Tables<"items">;

export function ItemForm({
  item,
  onClose,
  defaultCategoryId,
}: {
  item?: Item | null;
  onClose: () => void;
  defaultCategoryId?: string | null;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCats, setShowCats] = useState(false);
  const [form, setForm] = useState({
    name: item?.name ?? "",
    category_id: item?.category_id ?? defaultCategoryId ?? "",
    quantity: item?.quantity?.toString() ?? "0",
    low_stock_threshold: item?.low_stock_threshold?.toString() ?? "5",
    unit_price: item?.unit_price?.toString() ?? "0",
    rental_price: item?.rental_price?.toString() ?? "0",
    notes: item?.notes ?? "",
  });

  const [images, setImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>(item?.image_urls || []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data as Category[];
    },
  });

  const flat = flattenTree(buildTree(categories));

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      if (images.length + existingImages.length + newFiles.length > 5) {
        toast.error(t.common.error || "Maximum 5 images allowed");
        return;
      }
      setImages((prev) => [...prev, ...newFiles]);
    }
    // reset input so the same files can be selected again if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const uploadedUrls = [...existingImages];
      for (const file of images) {
        const ext = file.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("item_images").upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from("item_images").getPublicUrl(fileName);
        uploadedUrls.push(publicUrl);
      }

      const payload = {
        name: form.name.trim(),
        category_id: form.category_id || null,
        quantity: Number(form.quantity) || 0,
        low_stock_threshold: Number(form.low_stock_threshold) || 0,
        unit_price: Number(form.unit_price) || 0,
        rental_price: Number(form.rental_price) || 0,
        notes: form.notes.trim() || null,
        image_urls: uploadedUrls,
      };
      if (!payload.name) throw new Error(t.common.required);
      if (item) {
        const { error } = await supabase.from("items").update(payload).eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("items").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success(t.common.saved);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || t.common.error),
  });

  const canAddMoreImages = images.length + existingImages.length < 5;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm sm:items-center" onClick={onClose}>
        <div
          className="flex max-h-[92vh] w-full max-w-md flex-col rounded-t-3xl bg-card shadow-2xl sm:rounded-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-6 pb-3">
            <h2 className="font-display text-2xl font-semibold">
              {item ? t.inventory.edit : t.inventory.add}
            </h2>
            <button onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-muted">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto px-6">
              <Field label={t.inventory.name}>
                <input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
              </Field>

              <Field label={t.inventory.category}>
                <div className="flex gap-2">
                  <select
                    value={form.category_id || ""}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    className="input flex-1"
                  >
                    <option value="">— {t.inventory.noCategory} —</option>
                    {flat.map((c) => (
                      <option key={c.id} value={c.id}>
                        {"— ".repeat(c.depth)}{c.name}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setShowCats(true)} className="rounded-lg border border-border px-3 text-muted-foreground hover:bg-muted" title={t.inventory.manageCategories}>
                    <FolderTree className="h-4 w-4" />
                  </button>
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t.inventory.quantity}>
                  <input type="number" inputMode="numeric" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value.replace(/^0+(?=\d)/, "") })} className="input" />
                </Field>
                <Field label={t.inventory.threshold}>
                  <input type="number" inputMode="numeric" min={0} value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value.replace(/^0+(?=\d)/, "") })} className="input" />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t.inventory.price}>
                  <input type="number" inputMode="decimal" min={0} step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value.replace(/^0+(?=\d)/, "") })} className="input" />
                </Field>
                <Field label={t.inventory.rentalPrice}>
                  <input type="number" inputMode="decimal" min={0} step="0.01" value={form.rental_price} onChange={(e) => setForm({ ...form, rental_price: e.target.value.replace(/^0+(?=\d)/, "") })} className="input" />
                </Field>
              </div>
              
              <Field label="Images">
                <div className="flex flex-wrap gap-2 mb-2">
                  {existingImages.map((url, i) => (
                    <div key={`exist-${i}`} className="relative h-16 w-16 overflow-hidden rounded-md border border-border">
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      <button type="button" onClick={() => setExistingImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute right-0 top-0 rounded-bl-md bg-foreground/50 p-1 text-background backdrop-blur-sm hover:bg-foreground">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {images.map((file, i) => (
                    <div key={`new-${i}`} className="relative h-16 w-16 overflow-hidden rounded-md border border-border">
                      <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                      <button type="button" onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute right-0 top-0 rounded-bl-md bg-foreground/50 p-1 text-background backdrop-blur-sm hover:bg-foreground">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {canAddMoreImages && (
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground">
                      <Upload className="h-5 w-5" />
                    </button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleImageSelect} />
                <p className="text-xs text-muted-foreground">Up to 5 images.</p>
              </Field>

              <Field label={t.inventory.notes}>
                <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input resize-none" />
              </Field>
            </div>

            <div className="border-t border-border bg-card p-4">
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
          .input { width:100%; border:1px solid var(--input); background:var(--background); border-radius: var(--radius); padding: 0.65rem 0.85rem; font-size:0.95rem; outline:none; transition: border-color .15s; }
          .input:focus { border-color: var(--ring); box-shadow: 0 0 0 3px color-mix(in oklab, var(--ring) 18%, transparent); }
          .btn-primary { background: var(--primary); color: var(--primary-foreground); border-radius: var(--radius); padding: 0.7rem 1rem; font-weight:600; font-size:0.95rem; }
          .btn-primary:disabled { opacity:.6; }
          .btn-ghost { background: var(--secondary); color: var(--secondary-foreground); border-radius: var(--radius); padding: 0.7rem 1rem; font-weight:600; font-size:0.95rem; }
        `}</style>
      </div>
      {showCats && <CategoryManager onClose={() => setShowCats(false)} />}
    </>
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
