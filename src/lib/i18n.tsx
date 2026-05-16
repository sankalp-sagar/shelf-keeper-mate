import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { money as fmtMoney } from "./format";

export type Lang = "en" | "es";

const dict = {
  en: {
    appName: "Shelf",
    tagline: "Inventory, kept light.",
    nav: { dashboard: "Home", inventory: "Inventory", sales: "Sales", admin: "Settings" },

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
      addSale: "New sale",
      rentalsOut: "Rentals out",
      overdue: "Overdue",
      activeRental: "Rental",
      unpaid: "Unpaid",
      noOpenTabs: "No open tabs.",
    },

    inventory: {
      title: "Inventory",
      search: "Search items…",
      empty: "No items yet. Add your first one.",
      add: "Add item",
      edit: "Edit item",
      name: "Name",
      category: "Category",
      noCategory: "No category",
      manageCategories: "Manage categories",
      quantity: "Quantity",
      threshold: "Low-stock threshold",
      price: "Unit price",
      rentalPrice: "Rental price",
      notes: "Notes",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      confirmDelete: "Delete this item?",
      low: "Low",
      out: "Out",
      filterAll: "All items",
      filterLow: "Low stock",
      adjust: "Adjust",
      uncategorized: "Uncategorized",
      lowAlarm: (name: string, qty: number) => `Low stock: ${name} (${qty} left)`,
      outAlarm: (name: string) => `Out of stock: ${name}`,
    },

    categories: {
      title: "Categories",
      add: "New category",
      addChild: "Add subcategory",
      rename: "Rename",
      parent: "Parent",
      none: "— Top level —",
      confirmDelete: "Delete this category and all its subcategories?",
      empty: "No categories yet.",
    },

    sales: {
      title: "Sales",
      subtitle: "Purchases, rentals & tabs",
      historyTitle: "Purchase history",
      empty: "No sales yet.",
      add: "New sale",
      edit: "View sale",
      customer: "Customer name",
      lines: "Items",
      addLine: "Add item",
      item: "Item",
      itemPh: "Pick or type an item",
      qty: "Qty",
      price: "Price",
      kind: "Type",
      buy: "Buy",
      rent: "Rent",
      returnBy: "Return by",
      returned: "Returned",
      markReturned: "Mark returned",
      markNotReturned: "Mark not returned",
      payment: "Payment",
      payNow: "Pay now",
      payLater: "Pay later",
      promisedDate: "Promised date",
      paidOn: "Paid on",
      paidActualDate: "Actual payment date",
      markPaid: "Mark paid",
      markUnpaid: "Mark unpaid",
      filterPending: "Pending",
      filterPaid: "Paid",
      filterRentals: "Rentals out",
      filterAll: "All",
      filterHistory: "History",
      total: "Total",
      totalOwed: "Total owed",
      taken: "Taken on",
      notes: "Notes",
      itemsCount: (n: number) => `${n} item${n === 1 ? "" : "s"}`,
      atLeastOne: "Add at least one item",
      removeLine: "Remove",
      pendingBadge: "Pending",
      paidBadge: "Paid",
      rentalBadge: "Has rentals",
      due: "Due",
      overdueBadge: "Overdue",
      confirmDelete: "Delete this sale?",
      restoreStock: "Restoring stock for unreturned items.",
    },

    admin: {
      title: "Settings",
      subtitle: "Currency & data tools",
      currency: "Currency",
      currencyHint: "Used everywhere prices are shown.",
      dangerZone: "Danger zone",
      dangerHint: "These actions cannot be undone.",
      resetSales: "Reset sales & rentals",
      resetSalesConfirm: "Delete every sale and rental record? Inventory will stay.",
      resetInventory: "Reset inventory",
      resetInventoryConfirm: "Delete every item from inventory? Sales referencing them will keep their item name.",
      resetCategories: "Reset categories",
      resetCategoriesConfirm: "Delete every category? Items will become uncategorized.",
      resetAll: "Reset everything",
      resetAllConfirm: "Wipe everything: sales, rentals, items and categories. Are you sure?",
      done: "Done.",
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
      close: "Close",
    },
  },
  es: {
    appName: "Shelf",
    tagline: "Inventario, sin peso.",
    nav: { dashboard: "Inicio", inventory: "Inventario", sales: "Ventas", admin: "Ajustes" },

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
      addSale: "Nueva venta",
      rentalsOut: "Alquileres",
      overdue: "Vencidos",
      activeRental: "Alquiler",
      unpaid: "Sin pagar",
      noOpenTabs: "Sin cuentas abiertas.",
    },

    inventory: {
      title: "Inventario",
      search: "Buscar…",
      empty: "Aún no hay productos. Añade el primero.",
      add: "Añadir producto",
      edit: "Editar producto",
      name: "Nombre",
      category: "Categoría",
      noCategory: "Sin categoría",
      manageCategories: "Gestionar categorías",
      quantity: "Cantidad",
      threshold: "Aviso de bajo stock",
      price: "Precio unitario",
      rentalPrice: "Precio de alquiler",
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
      uncategorized: "Sin categoría",
      lowAlarm: (name: string, qty: number) => `Bajo stock: ${name} (quedan ${qty})`,
      outAlarm: (name: string) => `Agotado: ${name}`,
    },

    categories: {
      title: "Categorías",
      add: "Nueva categoría",
      addChild: "Añadir subcategoría",
      rename: "Renombrar",
      parent: "Categoría padre",
      none: "— Nivel superior —",
      confirmDelete: "¿Eliminar esta categoría y todas sus subcategorías?",
      empty: "Sin categorías.",
    },

    sales: {
      title: "Ventas",
      subtitle: "Compras, alquileres y fiados",
      historyTitle: "Historial de compras",
      empty: "Sin ventas todavía.",
      add: "Nueva venta",
      edit: "Ver venta",
      customer: "Nombre del cliente",
      lines: "Productos",
      addLine: "Añadir producto",
      item: "Producto",
      itemPh: "Elige o escribe un producto",
      qty: "Cant.",
      price: "Precio",
      kind: "Tipo",
      buy: "Compra",
      rent: "Alquiler",
      returnBy: "Devolver antes de",
      returned: "Devuelto",
      markReturned: "Marcar devuelto",
      markNotReturned: "Marcar no devuelto",
      payment: "Pago",
      payNow: "Pagar ahora",
      payLater: "Pagar después",
      promisedDate: "Fecha prometida",
      paidOn: "Pagado el",
      paidActualDate: "Fecha real de pago",
      markPaid: "Marcar pagado",
      markUnpaid: "Marcar pendiente",
      filterPending: "Pendientes",
      filterPaid: "Pagadas",
      filterRentals: "Alquileres",
      filterAll: "Todas",
      filterHistory: "Historial",
      total: "Total",
      totalOwed: "Total por cobrar",
      taken: "Fecha",
      notes: "Notas",
      itemsCount: (n: number) => `${n} producto${n === 1 ? "" : "s"}`,
      atLeastOne: "Añade al menos un producto",
      removeLine: "Quitar",
      pendingBadge: "Pendiente",
      paidBadge: "Pagado",
      rentalBadge: "Con alquiler",
      due: "Vence",
      overdueBadge: "Vencido",
      confirmDelete: "¿Eliminar esta venta?",
      restoreStock: "Restaurando stock de productos no devueltos.",
    },

    admin: {
      title: "Ajustes",
      subtitle: "Moneda y herramientas de datos",
      currency: "Moneda",
      currencyHint: "Se usa en todos los precios.",
      dangerZone: "Zona de peligro",
      dangerHint: "Estas acciones no se pueden deshacer.",
      resetSales: "Borrar ventas y alquileres",
      resetSalesConfirm: "¿Borrar todas las ventas y alquileres? El inventario se queda.",
      resetInventory: "Borrar inventario",
      resetInventoryConfirm: "¿Borrar todos los productos del inventario?",
      resetCategories: "Borrar categorías",
      resetCategoriesConfirm: "¿Borrar todas las categorías? Los productos quedan sin categoría.",
      resetAll: "Borrar todo",
      resetAllConfirm: "Borra todo: ventas, alquileres, productos y categorías. ¿Seguro?",
      done: "Listo.",
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
      close: "Cerrar",
    },
  },
} as const;

type Dict = typeof dict.en;
const dictionaries: Record<Lang, Dict> = dict as unknown as Record<Lang, Dict>;

type Ctx = {
  lang: Lang;
  t: Dict;
  setLang: (l: Lang) => void;
  currency: string;
  setCurrency: (c: string) => void;
  money: (n: number | null | undefined) => string;
};

const I18nCtx = createContext<Ctx>({
  lang: "en",
  t: dictionaries.en,
  setLang: () => {},
  currency: "USD",
  setCurrency: () => {},
  money: (n) => fmtMoney(n, "USD"),
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [currency, setCurrencyState] = useState<string>("USD");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedLang = localStorage.getItem("lang") as Lang | null;
    if (storedLang === "en" || storedLang === "es") setLangState(storedLang);
    const storedCur = localStorage.getItem("currency");
    if (storedCur) setCurrencyState(storedCur);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("lang", l);
  };

  const setCurrency = (c: string) => {
    setCurrencyState(c);
    if (typeof window !== "undefined") localStorage.setItem("currency", c);
  };

  const money = useCallback((n: number | null | undefined) => fmtMoney(n, currency), [currency]);

  return (
    <I18nCtx.Provider value={{ lang, t: dictionaries[lang], setLang, currency, setCurrency, money }}>
      {children}
    </I18nCtx.Provider>
  );
}

export const useI18n = () => useContext(I18nCtx);
