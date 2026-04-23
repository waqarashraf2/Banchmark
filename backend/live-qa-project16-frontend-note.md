# Live QA Worker Access Update

Base path: `/api/live-qa`

Auth required: `auth:sanctum`

## New behavior

For project `16`, worker roles now have limited Live QA access:

- `checker` can do Live QA only for `drawer` layer
- `checker` can only access orders assigned to them through `checker_id`
- `qa` can do Live QA only for `checker` layer
- `qa` can only access orders assigned to them through `qa_id`

Default Live QA behavior for existing Live QA users remains unchanged.

This is project-specific and currently enabled only for project `16`.

## Frontend rules

For project `16`:

- if logged-in user role is `checker`, show Live QA only for `layer=drawer`
- if logged-in user role is `qa`, show Live QA only for `layer=checker`
- hide other Live QA layers for these worker roles
- only use returned orders list; backend already filters to assigned orders

For all other projects:

- keep existing Live QA frontend behavior unchanged

## 1. Get orders for Live QA

**Route**
`GET /api/live-qa/orders/{projectId}?layer={layer}`

### Allowed worker combinations for project 16

- checker → `layer=drawer`
- qa → `layer=checker`

### Success response `200`
```json
{
  "success": true,
  "data": [
    {
      "id": 125,
      "order_number": "ORD-1001",
      "address": "123 Main St",
      "drawer_name": "Ali",
      "checker_name": "Usman",
      "drawer_done": "yes",
      "checker_done": "yes",
      "final_upload": null,
      "d_live_qa": 0,
      "c_live_qa": 0,
      "qa_reviewed_items": 4,
      "qa_total_items": 10,
      "qa_review_complete": false
    }
  ],
  "pagination": {
    "total": 1,
    "per_page": 50,
    "current_page": 1,
    "last_page": 1
  }
}
```

### Forbidden response `403`
Returned when worker tries an unsupported layer for project `16`.

```json
{
  "message": "You are not allowed to access this Live QA layer."
}
```

## 2. Get review details

**Route**
`GET /api/live-qa/review/{projectId}/{orderNumber}/{layer}`

### Success response `200`
```json
{
  "success": true,
  "order_number": "ORD-1001",
  "layer": "drawer",
  "worker_name": "Ali",
  "order": {
    "id": 125,
    "order_number": "ORD-1001",
    "drawer_name": "Ali",
    "checker_name": "Usman",
    "qa_name": null
  },
  "items": [
    {
      "product_checklist_id": 1,
      "title": "Line quality",
      "client": "Schematic",
      "product": "FP",
      "is_checked": false,
      "count_value": 0,
      "text_value": "",
      "review_id": null,
      "created_by": null,
      "updated_at": null
    }
  ],
  "total_items": 10,
  "reviewed_items": 4
}
```

### Forbidden response `403`
Returned when the order is not assigned to the logged-in worker.

```json
{
  "message": "You can only access Live QA for your assigned orders."
}
```

### Validation response `422`
Returned when the order is not ready for that layer yet.

```json
{
  "message": "Order is not ready for this Live QA layer."
}
```

### Not found response `404`
```json
{
  "message": "Order not found."
}
```

## 3. Submit review

**Route**
`POST /api/live-qa/review/{projectId}/{orderNumber}/{layer}`

### Request body
```json
{
  "items": [
    {
      "product_checklist_id": 1,
      "is_checked": true,
      "count_value": 2,
      "text_value": "Need line cleanup"
    }
  ]
}
```

### Success response `200`
```json
{
  "success": true,
  "message": "Review saved: 1 new, 0 updated",
  "inserted": 1,
  "updated": 0
}
```

### Forbidden response `403`
```json
{
  "message": "You can only submit Live QA for your assigned orders."
}
```

### Validation response `422`
```json
{
  "message": "Order is not ready for this Live QA layer."
}
```

## Recommended frontend implementation

- Use current user role plus project id to decide which Live QA tab/layer to show
- For project `16`:
- checker should call only `layer=drawer`
- qa should call only `layer=checker`
- Do not rely on frontend-only filtering for assignment; backend already enforces assignment ownership
- Handle `403` by showing a simple "You do not have access to this Live QA layer/order" message
- Handle `422` by showing "Order is not ready for Live QA yet"

## Future extension

Backend is now project-config based, so more projects can be enabled later without changing API shape.
