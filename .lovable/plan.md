# Rework: multi-item transactions, nested categories, buy/rent, pay-later

## What changes conceptually

Today the app treats every "pay later" entry as a single item taken by one customer. That doesn't match how the place actually works. A customer walks in, takes several different items (some in multiple copies), and either pays now or promises to pay by a certain date. Some items are bought, some rented (returned by a date). When they eventually pay, we record the actual payment date — which may be before, on, or after the promised date.

Also, items aren't a flat list. Categories nest arbitrarily deep (e.g. Books → Fiction → Fantasy → Harry Potter).

## New data model

```text
categories (self-referencing tree, infinite depth)
  id, name, parent_id (nullable), sort_order

items
  id, name, category_id, quantity (stock), low_stock_threshold,
  unit_price, rental_price (nullable), notes

transactions  (one "visit" by a customer)
  id, customer_name, taken_at,
  status: 'paid' | 'pending'
  payment_due_date  (nullable — only for pay-later)
  paid_at           (nullable — actual payment date, set when marked paid)
  total_amount      (denormalized sum)
  notes

transaction_lines  (cart contents)
  id, transaction_id, item_id, item_name (snapshot),
  quantity, unit_price (snapshot), line_total,
  kind: 'buy' | 'rent',
  rental_return_date (nullable, only when kind='rent'),
  returned_at        (nullable — when actually returned)
```

Stock is decremented when a transaction is created (buy reduces permanently; rent reduces until `returned_at` is set, then restored).

## UI changes

- **Inventory page**: now shows a category tree on the left (collapsible nodes, any depth). Items live inside categories. Add/edit item picks a category from the tree. Add "Manage categories" modal to create/rename/nest/delete.
- **New "Sales" page** (replaces Fiado): list of transactions, filterable by Pending / Paid / Rentals out / All. Each row: customer, date, item count, total, status badge, due date if pending.
- **New transaction flow**: pick customer name → add lines (search item, qty, buy/rent, rental return date if rent) → choose Pay now or Pay later (+ promised date) → save. Stock decrements automatically.
- **Mark paid**: opens a small dialog with a date picker (defaults to today) to record the actual payment date.
- **Mark returned** (for rental lines): per-line button, restores stock.
- **Dashboard**: low-stock alerts + outstanding balance (sum of pending transactions) + rentals overdue today.

All strings added to the i18n dictionary (English + Spanish).

## Migration approach

Destructive rewrite of the schema (the app is brand new, no real data yet):
1. Drop `pay_later` and recreate as `transactions` + `transaction_lines`.
2. Add `categories` table; add `category_id` FK on `items` (replaces the free-text `category` column — existing values become top-level categories).
3. Keep permissive RLS (no auth, as agreed).

## Technical notes

- Category tree rendered with a recursive component; expand/collapse state in local state.
- Transaction create is wrapped so all line inserts + stock decrements happen together; on any failure we roll back via a Postgres function (`create_transaction(payload jsonb)`).
- Realtime not added yet — react-query invalidation is enough.
- No new pages outside the existing bottom-nav slots; "Sales" replaces "Fiado".

## Out of scope (ask later if needed)

- Customer profiles / phone numbers / history per customer
- Partial payments (each transaction is fully paid or fully pending)
- Receipts / printing
- Reports & exports

Confirm and I'll build it.
