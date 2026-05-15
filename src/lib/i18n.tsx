import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "es";

const dict = {
  en: {
    appName: "Shelf",
    tagline: "Inventory, kept light.",
    nav: { dashboard: "Home", inventory: "Inventory", fiado: "Pay Later" },

    dashboard: {
      title: "Today",
      lowStock: "Running low",
      noLowStock: "Everything's well stocked.",
      outstanding: "Unpaid balance",
      openTabs: "Open tabs",
      totalItems: "Items tracked",
      categories: "Categories",
      quickAdd: "Quick add",
      addItem: "New item",
      addFiado: "New tab",
    },

    inventory: {
      title: "Inventory",
      search: "Search items…",
      empty: "No items yet. Add your first one.",
      add: "Add item",
      edit: "Edit item",
      name: "Name",
      category: "Category",
      categoryPh: "e.g. Books, Snacks…",
      quantity: "Quantity",
      threshold: "Low-stock threshold",
      price: "Unit price",
      notes: "Notes",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      confirmDelete: "Delete this item?",
      low: "Low",
      out: "Out",
      filterAll: "All",
      filterLow: "Low stock",
      adjust: "Adjust",
    },

    fiado: {
      title: "Pay Later",
      subtitle: "Track who owes you",
      empty: "No open tabs. Nice.",
      add: "New tab",
      edit: "Edit tab",
      customer: "Customer name",
      item: "Item",
      itemPh: "What did they take?",
      qty: "Qty",
      amount: "Amount",
      taken: "Taken on",
      due: "Due date",
      notes: "Notes",
      open: "Open",
      paid: "Paid",
      markPaid: "Mark paid",
      markUnpaid: "Mark unpaid",
      paidOn: "Paid",
      filterOpen: "Open",
      filterPaid: "Paid",
      filterAll: "All",
      total: "Total owed",
      deductStock: "Deduct from inventory",
    },

    common: {
      yes: "Yes",
      no: "No",
      back: "Back",
      saving: "Saving…",
      saved: "Saved",
      deleted: "Deleted",
      error: "Something went wrong",
      required: "Required",
    },
  },
  es: {
    appName: "Shelf",
    tagline: "Inventario, sin peso.",
    nav: { dashboard: "Inicio", inventory: "Inventario", fiado: "Fiado" },

    dashboard: {
      title: "Hoy",
      lowStock: "Bajo stock",
      noLowStock: "Todo bien surtido.",
      outstanding: "Saldo por cobrar",
      openTabs: "Cuentas abiertas",
      totalItems: "Productos",
      categories: "Categorías",
      quickAdd: "Añadir rápido",
      addItem: "Nuevo producto",
      addFiado: "Nuevo fiado",
    },

    inventory: {
      title: "Inventario",
      search: "Buscar…",
      empty: "Aún no hay productos. Añade el primero.",
      add: "Añadir producto",
      edit: "Editar producto",
      name: "Nombre",
      category: "Categoría",
      categoryPh: "ej. Libros, Snacks…",
      quantity: "Cantidad",
      threshold: "Aviso de bajo stock",
      price: "Precio unitario",
      notes: "Notas",
      save: "Guardar",
      cancel: "Cancelar",
      delete: "Eliminar",
      confirmDelete: "¿Eliminar este producto?",
      low: "Bajo",
      out: "Agotado",
      filterAll: "Todos",
      filterLow: "Bajo stock",
      adjust: "Ajustar",
    },

    fiado: {
      title: "Fiado",
      subtitle: "Quién te debe",
      empty: "Sin cuentas abiertas. Genial.",
      add: "Nuevo fiado",
      edit: "Editar fiado",
      customer: "Nombre del cliente",
      item: "Producto",
      itemPh: "¿Qué se llevó?",
      qty: "Cant.",
      amount: "Monto",
      taken: "Fecha",
      due: "Fecha de pago",
      notes: "Notas",
      open: "Pendiente",
      paid: "Pagado",
      markPaid: "Marcar pagado",
      markUnpaid: "Marcar pendiente",
      paidOn: "Pagado",
      filterOpen: "Pendientes",
      filterPaid: "Pagados",
      filterAll: "Todos",
      total: "Total por cobrar",
      deductStock: "Descontar del inventario",
    },

    common: {
      yes: "Sí",
      no: "No",
      back: "Volver",
      saving: "Guardando…",
      saved: "Guardado",
      deleted: "Eliminado",
      error: "Algo salió mal",
      required: "Requerido",
    },
  },
} as const;

type Dict = typeof dict.en;
const dictionaries: Record<Lang, Dict> = dict as unknown as Record<Lang, Dict>;

const Ctx = createContext<{ lang: Lang; t: Dict; setLang: (l: Lang) => void }>({
  lang: "en",
  t: dictionaries.en,
  setLang: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? (localStorage.getItem("lang") as Lang | null) : null;
    if (stored === "en" || stored === "es") setLangState(stored);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("lang", l);
  };

  return <Ctx.Provider value={{ lang, t: dictionaries[lang], setLang }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
