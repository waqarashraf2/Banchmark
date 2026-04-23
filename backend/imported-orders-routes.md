# Imported Orders API

Base path: `/api`

Auth required: `auth:sanctum`

Allowed roles: `ceo`, `director`, `operations_manager`, `project_manager`

## 1. Fetch Imported Orders

**Route**
`GET /api/projects/{projectId}/imported-orders`

**Query params**
- `per_page` optional, default `50`, max `100`
- `search` optional, searches in `order_number`, `address`, `client_name`

**Success response - 200**
```json
{
  "success": true,
  "project_id": 7,
  "data": [
    {
      "order_id": 101,
      "order_number": "ORD-1001",
      "address": "123 Main St",
      "client_name": "John Doe",
      "import_source": "csv",
      "import_log_id": 55,
      "created_at": "2026-04-16T10:00:00.000000Z",
      "updated_at": "2026-04-16T10:15:00.000000Z"
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

**Possible errors**
- `401` Unauthenticated
- `403` Forbidden
- `404` Project not found

## 2. Update Imported Order

**Route**
`PUT /api/projects/{projectId}/imported-orders/{orderId}`

**Request body**
```json
{
  "order_number": "ORD-1001",
  "address": "123 Main St",
  "client_name": "John Doe"
}
```

**Fields**
- `order_number` optional, string, max `255`
- `address` optional, nullable string, max `255`
- `client_name` optional, nullable string, max `255`

**Success response - 200**
```json
{
  "success": true,
  "message": "Imported order updated successfully.",
  "data": {
    "order_id": 101,
    "order_number": "ORD-1001",
    "address": "123 Main St",
    "client_name": "John Doe",
    "import_source": "csv",
    "import_log_id": 55,
    "created_at": "2026-04-16T10:00:00.000000Z",
    "updated_at": "2026-04-16T10:20:00.000000Z"
  }
}
```

**Validation error - 422**
```json
{
  "message": "Order number already exists for this project.",
  "errors": {
    "order_number": [
      "The order number has already been taken."
    ]
  }
}
```

**General validation error - 422**
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "order_number": [
      "The order number field must be a string."
    ]
  }
}
```

**Possible errors**
- `401` Unauthenticated
- `403` Forbidden
- `404` Project not found
- `404` Order not found

## 3. Delete Imported Order

**Route**
`DELETE /api/projects/{projectId}/imported-orders/{orderId}`

**Success response - 200**
```json
{
  "success": true,
  "message": "Imported order deleted successfully.",
  "order_id": 101
}
```

**Possible errors**
- `401` Unauthenticated
- `403` Forbidden
- `404` Project not found
- `404` Order not found
