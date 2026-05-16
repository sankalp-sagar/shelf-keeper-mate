export const money = (n: number | null | undefined, currency: string = "USD") => {
  const v = Number(n ?? 0);
  try {
    return v.toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: 2 });
  } catch {
    return `${currency} ${v.toFixed(2)}`;
  }
};

export const formatDate = (d: string | Date | null | undefined, lang: string = "en") => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(lang === "es" ? "es-ES" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const CURRENCIES = [
  { code: "USD", label: "US Dollar ($)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "GBP", label: "British Pound (£)" },
  { code: "ARS", label: "Argentine Peso" },
  { code: "MXN", label: "Mexican Peso" },
  { code: "COP", label: "Colombian Peso" },
  { code: "CLP", label: "Chilean Peso" },
  { code: "PEN", label: "Peruvian Sol" },
  { code: "BRL", label: "Brazilian Real" },
  { code: "INR", label: "Indian Rupee (₹)" },
  { code: "JPY", label: "Japanese Yen (¥)" },
  { code: "CAD", label: "Canadian Dollar" },
  { code: "AUD", label: "Australian Dollar" },
] as const;
