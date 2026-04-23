# Table Analysis for received_at Queries

## Tables Being Used

### In `generateDailyOperationsData()` method:

**Line 2087:** `$tableName = ProjectOrderService::getTableName($project->id);`

This generates dynamic table names:
- **Project 15** → `project_15_orders`
- **Project 16** → `project_16_orders`
- **Project X** → `project_X_orders`

## received_at Column Location

The `received_at` column is defined in **ProjectOrderService.php** (Line 107):
```php
$table->timestamp('received_at')->nullable();
```

This column exists in ALL project order tables: `project_15_orders`, `project_16_orders`, etc.

## Query Logic for Projects 15 & 16

### Line 2114-2142 (DELIVERED count for received_at projects):
```php
if (in_array($project->id, $receivedAtProjects)) {  // [15, 16]
    $hasAusDatein = self::columnExists($tableName, 'ausDatein');
    if ($hasAusDatein) {
        $delivered = DB::table($tableName)
            ->whereDate(DB::raw("COALESCE(received_at, ausDatein)"), $dateObj)
            ->count();
    } else {
        $delivered = DB::table($tableName)
            ->whereDate('received_at', $dateObj)
            ->count();
    }
}
```

### What This Means:

✅ **For Project 15 & 16:**
- Query table: `project_15_orders` / `project_16_orders`  
- Query column: `received_at`
- This counts orders **RECEIVED on that date** (NOT delivered)

✅ **For All Other Projects:**
- Query table: `project_X_orders`
- Query column: `delivered_at`
- This counts orders **DELIVERED on that date**

## Verification Needed

To verify the current data:

```sql
-- Check if received_at column exists and has data
SELECT COUNT(*) as total_with_received_at, 
       COUNT(received_at) as has_received_at_value
FROM project_15_orders;

SELECT COUNT(*) as total_with_received_at, 
       COUNT(received_at) as has_received_at_value
FROM project_16_orders;

-- Check sample data
SELECT id, order_number, received_at, delivered_at, workflow_state
FROM project_15_orders
ORDER BY received_at DESC
LIMIT 10;

SELECT id, order_number, received_at, delivered_at, workflow_state
FROM project_16_orders
ORDER BY received_at DESC
LIMIT 10;
```

## Potential Issues

1. **Column exists but is NULL/empty** - Data might not have received_at populated
2. **Data mismatch** - received_at might be from an old import without proper date
3. **Time zone issue** - received_at might be in wrong timezone
