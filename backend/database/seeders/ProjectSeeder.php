<?php

namespace Database\Seeders;

use App\Models\Project;
use App\Services\ProjectOrderService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ProjectSeeder extends Seeder
{
    private function getFloorPlanInvoiceConfig(): array
    {
        return [
            ['name' => 'Black & White Plans', 'count_key' => 'by_plan_type.black_and_white', 'rate' => 15.00],
            ['name' => 'Color Plans', 'count_key' => 'by_plan_type.color', 'rate' => 25.00],
            ['name' => 'Texture Plans', 'count_key' => 'by_plan_type.texture', 'rate' => 35.00],
            ['name' => '3D Plans', 'count_key' => 'by_plan_type.3d', 'rate' => 50.00],
            ['name' => 'Other Plans', 'count_key' => 'by_plan_type.other', 'rate' => 20.00],
        ];
    }

    private function getPhotosEnhancementInvoiceConfig(): array
    {
        return [
            ['name' => 'General Images', 'count_key' => 'by_image_type.general', 'rate' => 5.00],
            ['name' => 'HDR Images', 'count_key' => 'by_image_type.hdr', 'rate' => 8.00],
            ['name' => 'Object Removal', 'count_key' => 'by_image_type.object_removal', 'rate' => 12.00],
            ['name' => 'Virtual Furniture (VF)', 'count_key' => 'by_image_type.virtual_furniture', 'rate' => 25.00],
            ['name' => 'Other Enhancements', 'count_key' => 'by_image_type.other', 'rate' => 6.00],
        ];
    }

    public function run(): void
    {
        // Ensure Vietnam exists in countries table
        if (!DB::table('countries')->where('code', 'VN')->exists()) {
            DB::table('countries')->insert([
                'code' => 'VN', 'name' => 'Vietnam', 'is_active' => true,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        $fp = $this->getFloorPlanInvoiceConfig();
        $pe = $this->getPhotosEnhancementInvoiceConfig();

        $projects = [
            // ══════════════════════════════════════════
            // FLOOR PLAN — Nadeem Saeed (OM)
            // ══════════════════════════════════════════
            [
                'code' => 'FOCAL-CRM-FP',
                'name' => 'Focal CRM FP',
                'country' => 'UK',
                'department' => 'floor_plan',
                'client_name' => 'Focal CRM',
                'status' => 'active',
                'workflow_type' => 'FP_3_LAYER',
                'workflow_layers' => ['drawer', 'checker', 'qa'],
                'wip_cap' => 3,
                'invoice_categories_config' => $fp,
            ],
            [
                'code' => 'FOCAL-PB-FP',
                'name' => 'Focal PB FP',
                'country' => 'UK',
                'department' => 'floor_plan',
                'client_name' => 'Focal PB',
                'status' => 'active',
                'workflow_type' => 'FP_3_LAYER',
                'workflow_layers' => ['drawer', 'checker', 'qa'],
                'wip_cap' => 3,
                'invoice_categories_config' => $fp,
            ],
            [
                'code' => 'FOCAL-MP-FP',
                'name' => 'Focal MP FP',
                'country' => 'UK',
                'department' => 'floor_plan',
                'client_name' => 'Focal MP',
                'status' => 'active',
                'workflow_type' => 'FP_3_LAYER',
                'workflow_layers' => ['drawer', 'checker', 'qa'],
                'wip_cap' => 3,
                'invoice_categories_config' => $fp,
            ],
            [
                'code' => 'SCHEMATIC-FP',
                'name' => 'Schematic FP',
                'country' => 'UK',
                'department' => 'floor_plan',
                'client_name' => 'Schematic',
                'status' => 'active',
                'workflow_type' => 'FP_3_LAYER',
                'workflow_layers' => ['drawer', 'checker', 'qa'],
                'wip_cap' => 3,
                'invoice_categories_config' => $fp,
            ],
            [
                'code' => 'UK-FOCAL-XACT',
                'name' => 'UK Focal Xactimate',
                'country' => 'Australia',
                'department' => 'floor_plan',
                'client_name' => 'Focal Xactimate UK',
                'status' => 'active',
                'workflow_type' => 'FP_3_LAYER',
                'workflow_layers' => ['drawer', 'checker', 'qa'],
                'wip_cap' => 3,
                'invoice_categories_config' => $fp,
            ],
            [
                'code' => 'AUS-METRO-XACT',
                'name' => 'Aus Metro Xactimate',
                'country' => 'Australia',
                'department' => 'floor_plan',
                'client_name' => 'Metro Xactimate AUS',
                'status' => 'active',
                'workflow_type' => 'FP_3_LAYER',
                'workflow_layers' => ['drawer', 'checker', 'qa'],
                'wip_cap' => 3,
                'invoice_categories_config' => $fp,
            ],

            // ══════════════════════════════════════════
            // FLOOR PLAN — Subhan Javed (OM)
            // ══════════════════════════════════════════
            [
                'code' => 'GF-FP',
                'name' => 'GF FP',
                'country' => 'UK',
                'department' => 'floor_plan',
                'client_name' => 'GF',
                'status' => 'active',
                'workflow_type' => 'FP_3_LAYER',
                'workflow_layers' => ['drawer', 'checker', 'qa'],
                'wip_cap' => 3,
                'invoice_categories_config' => $fp,
            ],
            [
                'code' => 'SINGLE-FP',
                'name' => 'Single FP',
                'country' => 'UK',
                'department' => 'floor_plan',
                'client_name' => 'Single',
                'status' => 'active',
                'workflow_type' => 'FP_3_LAYER',
                'workflow_layers' => ['drawer', 'checker', 'qa'],
                'wip_cap' => 3,
                'invoice_categories_config' => $fp,
            ],
            [
                'code' => 'CAD-FP',
                'name' => 'CAD FP',
                'country' => 'UK',
                'department' => 'floor_plan',
                'client_name' => 'CAD',
                'status' => 'active',
                'workflow_type' => 'FP_3_LAYER',
                'workflow_layers' => ['drawer', 'checker', 'qa'],
                'wip_cap' => 3,
                'invoice_categories_config' => $fp,
            ],
            [
                'code' => 'CODE-FP',
                'name' => 'Code FP',
                'country' => 'UK',
                'department' => 'floor_plan',
                'client_name' => 'Code',
                'status' => 'active',
                'workflow_type' => 'FP_3_LAYER',
                'workflow_layers' => ['drawer', 'checker', 'qa'],
                'wip_cap' => 3,
                'invoice_categories_config' => $fp,
            ],
            [
                'code' => 'BR-FP',
                'name' => 'BR FP',
                'country' => 'UK',
                'department' => 'floor_plan',
                'client_name' => 'BR',
                'status' => 'active',
                'workflow_type' => 'FP_3_LAYER',
                'workflow_layers' => ['drawer', 'checker', 'qa'],
                'wip_cap' => 3,
                'invoice_categories_config' => $fp,
            ],
            [
                'code' => 'SA-FP',
                'name' => 'SA FP',
                'country' => 'UK',
                'department' => 'floor_plan',
                'client_name' => 'SA',
                'status' => 'active',
                'workflow_type' => 'FP_3_LAYER',
                'workflow_layers' => ['drawer', 'checker', 'qa'],
                'wip_cap' => 3,
                'invoice_categories_config' => $fp,
            ],

            // ══════════════════════════════════════════
            // FLOOR PLAN — Ali Hamza (OM)
            // ══════════════════════════════════════════
            [
                'code' => 'METRO-FP',
                'name' => 'Metro FP',
                'country' => 'Australia',
                'department' => 'floor_plan',
                'client_name' => 'Metro',
                'status' => 'active',
                'workflow_type' => 'FP_3_LAYER',
                'workflow_layers' => ['drawer', 'checker', 'qa'],
                'wip_cap' => 3,
                'invoice_categories_config' => $fp,
            ],
            [
                'code' => 'AUS-OTHERS-FP',
                'name' => 'AUS Others FP',
                'country' => 'Australia',
                'department' => 'floor_plan',
                'client_name' => 'AUS Others',
                'status' => 'active',
                'workflow_type' => 'FP_3_LAYER',
                'workflow_layers' => ['drawer', 'checker', 'qa'],
                'wip_cap' => 3,
                'invoice_categories_config' => $fp,
            ],

            // ══════════════════════════════════════════
            // FLOOR PLAN — Farhan Ali (OM)
            // ══════════════════════════════════════════
            [
                'code' => 'ROOMIO-FP',
                'name' => 'Roomio FP',
                'country' => 'Australia',
                'department' => 'floor_plan',
                'client_name' => 'Roomio',
                'status' => 'active',
                'workflow_type' => 'FP_3_LAYER',
                'workflow_layers' => ['drawer', 'checker', 'qa'],
                'wip_cap' => 3,
                'invoice_categories_config' => $fp,
            ],

            // ══════════════════════════════════════════
            // FLOOR PLAN — Muneeb (OM)
            // ══════════════════════════════════════════
            [
                'code' => 'CUBI-FP',
                'name' => 'Cubi FP',
                'country' => 'Vietnam',
                'department' => 'floor_plan',
                'client_name' => 'Cubi',
                'status' => 'active',
                'workflow_type' => 'FP_3_LAYER',
                'workflow_layers' => ['drawer', 'checker', 'qa'],
                'wip_cap' => 3,
                'invoice_categories_config' => $fp,
            ],

            // ══════════════════════════════════════════
            // PHOTO ENHANCEMENT — Ghulam Haider (OM)
            // ══════════════════════════════════════════
            [
                'code' => 'BR-PHOTOS',
                'name' => 'BR Photos',
                'country' => 'UK',
                'department' => 'photos_enhancement',
                'client_name' => 'BR',
                'status' => 'active',
                'workflow_type' => 'PH_2_LAYER',
                'workflow_layers' => ['designer', 'qa'],
                'wip_cap' => 3,
                'invoice_categories_config' => $pe,
            ],
            [
                'code' => 'ALL-OTHER-HDR',
                'name' => 'All Other HDR',
                'country' => 'UK',
                'department' => 'photos_enhancement',
                'client_name' => 'All Other HDR',
                'status' => 'active',
                'workflow_type' => 'PH_2_LAYER',
                'workflow_layers' => ['designer', 'qa'],
                'wip_cap' => 3,
                'invoice_categories_config' => $pe,
            ],

            // ══════════════════════════════════════════
            // PHOTO ENHANCEMENT — Abdul Rehman (OM)
            // ══════════════════════════════════════════
            [
                'code' => 'SA-PHOTOS',
                'name' => 'SA Photos',
                'country' => 'UK',
                'department' => 'photos_enhancement',
                'client_name' => 'SA',
                'status' => 'active',
                'workflow_type' => 'PH_2_LAYER',
                'workflow_layers' => ['designer', 'qa'],
                'wip_cap' => 3,
                'invoice_categories_config' => $pe,
            ],
            [
                'code' => 'CODE-PHOTOS',
                'name' => 'Code Photos',
                'country' => 'UK',
                'department' => 'photos_enhancement',
                'client_name' => 'Code',
                'status' => 'active',
                'workflow_type' => 'PH_2_LAYER',
                'workflow_layers' => ['designer', 'qa'],
                'wip_cap' => 3,
                'invoice_categories_config' => $pe,
            ],
            [
                'code' => 'SINGLE-PHOTOS',
                'name' => 'Single Photos',
                'country' => 'UK',
                'department' => 'photos_enhancement',
                'client_name' => 'Single',
                'status' => 'active',
                'workflow_type' => 'PH_2_LAYER',
                'workflow_layers' => ['designer', 'qa'],
                'wip_cap' => 3,
                'invoice_categories_config' => $pe,
            ],
            [
                'code' => 'FOCAL-CRM-PHOTOS',
                'name' => 'Focal CRM Photos',
                'country' => 'UK',
                'department' => 'photos_enhancement',
                'client_name' => 'Focal CRM',
                'status' => 'active',
                'workflow_type' => 'PH_2_LAYER',
                'workflow_layers' => ['designer', 'qa'],
                'wip_cap' => 3,
                'invoice_categories_config' => $pe,
            ],
            [
                'code' => 'FOCAL-AI-PHOTOS',
                'name' => 'Focal Ai Photos',
                'country' => 'UK',
                'department' => 'photos_enhancement',
                'client_name' => 'Focal Ai',
                'status' => 'active',
                'workflow_type' => 'PH_2_LAYER',
                'workflow_layers' => ['designer', 'qa'],
                'wip_cap' => 3,
                'invoice_categories_config' => $pe,
            ],
            [
                'code' => 'FOCAL-PB-PHOTOS',
                'name' => 'Focal PB Photos',
                'country' => 'UK',
                'department' => 'photos_enhancement',
                'client_name' => 'Focal PB',
                'status' => 'active',
                'workflow_type' => 'PH_2_LAYER',
                'workflow_layers' => ['designer', 'qa'],
                'wip_cap' => 3,
                'invoice_categories_config' => $pe,
            ],
            [
                'code' => 'RAW-PRESTIGE',
                'name' => 'RAW Prestige',
                'country' => 'UK',
                'department' => 'photos_enhancement',
                'client_name' => 'RAW Prestige',
                'status' => 'active',
                'workflow_type' => 'PH_2_LAYER',
                'workflow_layers' => ['designer', 'qa'],
                'wip_cap' => 3,
                'invoice_categories_config' => $pe,
            ],
            [
                'code' => 'FOCAL-RTV',
                'name' => 'Focal RTV',
                'country' => 'UK',
                'department' => 'photos_enhancement',
                'client_name' => 'Focal RTV',
                'status' => 'active',
                'workflow_type' => 'PH_2_LAYER',
                'workflow_layers' => ['designer', 'qa'],
                'wip_cap' => 3,
                'invoice_categories_config' => $pe,
            ],
        ];

        foreach ($projects as $data) {
            $project = Project::create($data);
            // Create per-project order table
            ProjectOrderService::createTableForProject($project);
        }
    }
}
