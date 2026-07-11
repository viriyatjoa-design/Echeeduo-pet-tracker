// Tiny display helpers shared by the inventory page + dialogs (client-safe).

const idrFormat = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

/** Whole-IDR display, e.g. 85000 → "Rp 85.000". */
export function formatIdr(n: number): string {
  return idrFormat.format(n);
}

const qtyFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/** Stock quantity display, e.g. 1240 → "1,240". */
export function formatQty(n: number): string {
  return qtyFormat.format(n);
}
