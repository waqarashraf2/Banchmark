<?php

namespace Database\Seeders;

use App\Models\Order;
use Illuminate\Database\Seeder;

class OrderSeeder extends Seeder
{
    /**
     * Generate random floor plan metadata for invoice testing.
     */
    private function randomFloorPlanMetadata(): array
    {
        $planTypes = ['black_and_white', 'color', 'texture', '3d'];
        $bedrooms = [1, 2, 3, 4, 5];
        $areas = [800, 1200, 1500, 2200, 2800, 3500, 4500];

        return [
            'plan_type' => $planTypes[array_rand($planTypes)],
            'bedrooms' => $bedrooms[array_rand($bedrooms)],
            'area_sqft' => $areas[array_rand($areas)],
        ];
    }

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $orders = [
            // UK Floor Plan Orders
            [
                'order_number' => 'ORD-UK-FP-001',
                'project_id' => 1,
                'client_reference' => 'REF-LDN-001',
                'current_layer' => 'checker',
                'workflow_state' => 'QUEUED_CHECK',
                'workflow_type' => 'FP_3_LAYER',
                'status' => 'pending',
                'assigned_to' => null,
                'team_id' => 1,
                'priority' => 'high',
                'received_at' => now()->subHours(2),
                'started_at' => now()->subHour(),
                'metadata' => ['plan_type' => 'color', 'bedrooms' => 3, 'area_sqft' => 1800],
            ],
            [
                'order_number' => 'ORD-UK-FP-002',
                'project_id' => 1,
                'client_reference' => 'REF-LDN-002',
                'current_layer' => 'checker',
                'workflow_state' => 'QUEUED_CHECK',
                'workflow_type' => 'FP_3_LAYER',
                'status' => 'pending',
                'assigned_to' => 6, // Lisa Checker
                'team_id' => 1,
                'priority' => 'normal',
                'received_at' => now()->subHours(3),
                'started_at' => now()->subHour(),
                'metadata' => ['plan_type' => 'texture', 'bedrooms' => 4, 'area_sqft' => 2500],
            ],
            [
                'order_number' => 'ORD-UK-FP-003',
                'project_id' => 1,
                'client_reference' => 'REF-LDN-003',
                'current_layer' => 'qa',
                'workflow_state' => 'QUEUED_QA',
                'workflow_type' => 'FP_3_LAYER',
                'status' => 'pending',
                'assigned_to' => 7, // David QA
                'team_id' => 1,
                'priority' => 'urgent',
                'received_at' => now()->subHours(1),
                'metadata' => ['plan_type' => '3d', 'bedrooms' => 5, 'area_sqft' => 4200],
            ],
            [
                'order_number' => 'ORD-UK-FP-004',
                'project_id' => 1,
                'current_layer' => 'drawer',
                'workflow_state' => 'QUEUED_DRAW',
                'workflow_type' => 'FP_3_LAYER',
                'status' => 'pending',
                'team_id' => 1,
                'priority' => 'normal',
                'received_at' => now()->subMinutes(30),
                'metadata' => ['plan_type' => 'black_and_white', 'bedrooms' => 2, 'area_sqft' => 950],
            ],
            // UK Photo Enhancement Orders
            [
                'order_number' => 'ORD-UK-PE-001',
                'project_id' => 2,
                'client_reference' => 'REF-MCH-001',
                'current_layer' => 'designer',
                'workflow_state' => 'IN_DESIGN',
                'workflow_type' => 'PH_2_LAYER',
                'status' => 'in-progress',
                'assigned_to' => 8, // Anna Designer
                'team_id' => 2,
                'priority' => 'high',
                'received_at' => now()->subHours(4),
                'started_at' => now()->subHours(2),
                'metadata' => ['image_type' => 'hdr', 'image_count' => 15],
            ],
            [
                'order_number' => 'ORD-UK-PE-002',
                'project_id' => 2,
                'client_reference' => 'REF-MCH-002',
                'current_layer' => 'qa',
                'workflow_state' => 'QUEUED_QA',
                'workflow_type' => 'PH_2_LAYER',
                'status' => 'pending',
                'assigned_to' => 9, // Bob QA
                'team_id' => 2,
                'priority' => 'normal',
                'received_at' => now()->subHours(1),
                'metadata' => ['image_type' => 'virtual_furniture', 'image_count' => 8],
            ],
            // Australia Orders
            [
                'order_number' => 'ORD-AU-FP-001',
                'project_id' => 3,
                'client_reference' => 'REF-SYD-001',
                'current_layer' => 'drawer',
                'workflow_state' => 'IN_DRAW',
                'workflow_type' => 'FP_3_LAYER',
                'status' => 'in-progress',
                'assigned_to' => 10, // Chris Drawer AU
                'team_id' => 3,
                'priority' => 'high',
                'received_at' => now()->subHours(5),
                'started_at' => now()->subHours(3),
                'metadata' => ['plan_type' => 'color', 'bedrooms' => 3, 'area_sqft' => 1600],
            ],
            [
                'order_number' => 'ORD-AU-FP-002',
                'project_id' => 3,
                'current_layer' => 'drawer',
                'workflow_state' => 'QUEUED_DRAW',
                'workflow_type' => 'FP_3_LAYER',
                'status' => 'pending',
                'team_id' => 3,
                'priority' => 'normal',
                'received_at' => now()->subMinutes(45),
                'metadata' => ['plan_type' => 'black_and_white', 'bedrooms' => 2, 'area_sqft' => 1100],
            ],
            // Completed/Delivered Floor Plan Orders (for invoice testing)
            [
                'order_number' => 'ORD-UK-FP-COMPLETED-001',
                'project_id' => 1,
                'client_reference' => 'REF-LDN-DONE-001',
                'current_layer' => 'qa',
                'workflow_state' => 'DELIVERED',
                'workflow_type' => 'FP_3_LAYER',
                'status' => 'completed',
                'team_id' => 1,
                'priority' => 'normal',
                'received_at' => now()->subDays(2),
                'started_at' => now()->subDays(2)->addHour(),
                'completed_at' => now()->subDay(),
                'delivered_at' => now()->subDay(),
                'metadata' => ['plan_type' => 'black_and_white', 'bedrooms' => 2, 'area_sqft' => 900],
            ],
            [
                'order_number' => 'ORD-UK-PE-COMPLETED-001',
                'project_id' => 2,
                'client_reference' => 'REF-MCH-DONE-001',
                'current_layer' => 'qa',
                'workflow_state' => 'DELIVERED',
                'workflow_type' => 'PH_2_LAYER',
                'status' => 'completed',
                'team_id' => 2,
                'priority' => 'high',
                'received_at' => now()->subDays(1),
                'started_at' => now()->subDays(1)->addHour(),
                'completed_at' => now()->subHours(6),
                'delivered_at' => now()->subHours(6),
                'metadata' => ['image_type' => 'general', 'image_count' => 20],
            ],
            // Delivered Photos Enhancement Orders (for invoice testing)
            [
                'order_number' => 'ORD-UK-PE-DELIVERED-TODAY-001',
                'project_id' => 2,
                'client_reference' => 'REF-MCH-TODAY-001',
                'current_layer' => 'qa',
                'workflow_state' => 'DELIVERED',
                'workflow_type' => 'PH_2_LAYER',
                'status' => 'completed',
                'team_id' => 2,
                'priority' => 'normal',
                'received_at' => now()->subHours(5),
                'started_at' => now()->subHours(4),
                'completed_at' => now()->subHour(),
                'delivered_at' => now()->subHour(),
                'metadata' => ['image_type' => 'hdr', 'image_count' => 12],
            ],
            [
                'order_number' => 'ORD-UK-PE-DELIVERED-TODAY-002',
                'project_id' => 2,
                'client_reference' => 'REF-MCH-TODAY-002',
                'current_layer' => 'qa',
                'workflow_state' => 'DELIVERED',
                'workflow_type' => 'PH_2_LAYER',
                'status' => 'completed',
                'team_id' => 2,
                'priority' => 'high',
                'received_at' => now()->subHours(4),
                'started_at' => now()->subHours(3),
                'completed_at' => now()->subMinutes(45),
                'delivered_at' => now()->subMinutes(45),
                'metadata' => ['image_type' => 'object_removal', 'image_count' => 5],
            ],
            [
                'order_number' => 'ORD-UK-PE-DELIVERED-TODAY-003',
                'project_id' => 2,
                'client_reference' => 'REF-MCH-TODAY-003',
                'current_layer' => 'qa',
                'workflow_state' => 'DELIVERED',
                'workflow_type' => 'PH_2_LAYER',
                'status' => 'completed',
                'team_id' => 2,
                'priority' => 'urgent',
                'received_at' => now()->subHours(3),
                'started_at' => now()->subHours(2),
                'completed_at' => now()->subMinutes(30),
                'delivered_at' => now()->subMinutes(30),
                'metadata' => ['image_type' => 'virtual_furniture', 'image_count' => 3],
            ],
            [
                'order_number' => 'ORD-UK-PE-DELIVERED-TODAY-004',
                'project_id' => 2,
                'client_reference' => 'REF-MCH-TODAY-004',
                'current_layer' => 'qa',
                'workflow_state' => 'DELIVERED',
                'workflow_type' => 'PH_2_LAYER',
                'status' => 'completed',
                'team_id' => 2,
                'priority' => 'normal',
                'received_at' => now()->subHours(2),
                'started_at' => now()->subHours(1),
                'completed_at' => now()->subMinutes(15),
                'delivered_at' => now()->subMinutes(15),
                'metadata' => ['image_type' => 'general', 'image_count' => 25],
            ],
            // Today's deliveries with varied plan types
            [
                'order_number' => 'ORD-UK-FP-DELIVERED-TODAY-001',
                'project_id' => 1,
                'client_reference' => 'REF-LDN-TODAY-001',
                'current_layer' => 'qa',
                'workflow_state' => 'DELIVERED',
                'workflow_type' => 'FP_3_LAYER',
                'status' => 'completed',
                'team_id' => 1,
                'priority' => 'normal',
                'received_at' => now()->subHours(8),
                'started_at' => now()->subHours(7),
                'completed_at' => now()->subHours(1),
                'delivered_at' => now()->subHours(1),
                'metadata' => ['plan_type' => 'color', 'bedrooms' => 3, 'area_sqft' => 1500],
            ],
            [
                'order_number' => 'ORD-UK-FP-DELIVERED-TODAY-002',
                'project_id' => 1,
                'client_reference' => 'REF-LDN-TODAY-002',
                'current_layer' => 'qa',
                'workflow_state' => 'DELIVERED',
                'workflow_type' => 'FP_3_LAYER',
                'status' => 'completed',
                'team_id' => 1,
                'priority' => 'high',
                'received_at' => now()->subHours(6),
                'started_at' => now()->subHours(5),
                'completed_at' => now()->subMinutes(30),
                'delivered_at' => now()->subMinutes(30),
                'metadata' => ['plan_type' => 'texture', 'bedrooms' => 4, 'area_sqft' => 2800],
            ],
            // More delivered orders for invoice category testing
            [
                'order_number' => 'ORD-UK-FP-DELIVERED-TODAY-003',
                'project_id' => 1,
                'client_reference' => 'REF-LDN-TODAY-003',
                'current_layer' => 'qa',
                'workflow_state' => 'DELIVERED',
                'workflow_type' => 'FP_3_LAYER',
                'status' => 'completed',
                'team_id' => 1,
                'priority' => 'normal',
                'received_at' => now()->subHours(4),
                'started_at' => now()->subHours(3),
                'completed_at' => now()->subMinutes(45),
                'delivered_at' => now()->subMinutes(45),
                'metadata' => ['plan_type' => '3d', 'bedrooms' => 5, 'area_sqft' => 4500],
            ],
            [
                'order_number' => 'ORD-UK-FP-DELIVERED-TODAY-004',
                'project_id' => 1,
                'client_reference' => 'REF-LDN-TODAY-004',
                'current_layer' => 'qa',
                'workflow_state' => 'DELIVERED',
                'workflow_type' => 'FP_3_LAYER',
                'status' => 'completed',
                'team_id' => 1,
                'priority' => 'low',
                'received_at' => now()->subHours(3),
                'started_at' => now()->subHours(2),
                'completed_at' => now()->subMinutes(15),
                'delivered_at' => now()->subMinutes(15),
                'metadata' => ['plan_type' => 'black_and_white', 'bedrooms' => 1, 'area_sqft' => 750],
            ],
        ];

        foreach ($orders as $order) {
            $projectId = $order['project_id'];
            Order::createForProject($projectId, $order);
        }
    }
}
