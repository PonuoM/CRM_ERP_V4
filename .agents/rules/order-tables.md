# Order Tables Relationship Rules

## ⚠️ MUST READ before any CRUD on `orders`, `order_items`, `order_boxes`

## Table Relationships

```
orders.id ──┬── order_items.parent_order_id
             └── order_boxes.order_id

order_boxes.sub_order_id ── order_items.order_id
```

### Key Columns

| Parent Table | Column | Child Table | Column | Description |
|---|---|---|---|---|
| `orders` | `id` | `order_items` | `parent_order_id` | Items belong to which order |
| `orders` | `id` | `order_boxes` | `order_id` | Boxes belong to which order |
| `order_boxes` | `sub_order_id` | `order_items` | `order_id` | Items belong to which box/sub-order |

### Common Mistakes

> [!CAUTION]
> **DO NOT** use `order_items.order_id` to join directly with `orders.id`.
> Use `order_items.parent_order_id = orders.id` instead.
>
> `order_items.order_id` references `order_boxes.sub_order_id`, NOT `orders.id`.

### Correct JOIN Examples

```sql
-- Items → Orders
JOIN orders o ON o.id = oi.parent_order_id

-- Boxes → Orders
JOIN orders o ON o.id = ob.order_id

-- Items → Boxes
JOIN order_boxes ob ON ob.sub_order_id = oi.order_id
  AND ob.order_id = oi.parent_order_id

-- Full chain: Orders → Boxes → Items
SELECT *
FROM orders o
JOIN order_boxes ob ON ob.order_id = o.id
JOIN order_items oi ON oi.order_id = ob.sub_order_id
  AND oi.parent_order_id = o.id
```

### Incorrect JOIN (❌)

```sql
-- WRONG: order_items.order_id is NOT orders.id
JOIN orders o ON o.id = oi.order_id
```
