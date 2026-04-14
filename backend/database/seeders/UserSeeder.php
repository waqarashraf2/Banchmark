<?php

namespace Database\Seeders;

use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class UserSeeder extends Seeder
{
    /**
     * Seed users matching the real organisational structure.
     *
     * Admin: CEO, Director, Accounts Manager
     * OMs (7): Nadeem Saeed, Subhan Javed, Ali Hamza, Farhan Ali, Muneeb,
     *          Ghulam Haider, Abdul Rehman
     * PMs (19): see spreadsheet mapping below
     *
     * After creating users, sets up OM↔Project and PM↔Project pivot tables.
     */
    public function run(): void
    {
        // ── Admin users ──────────────────────────────────────
        $admin = [
            [
                'name' => 'CEO',
                'email' => 'ceo@benchmark.com',
                'password' => 'password',
                'role' => 'ceo',
                'country' => 'Global',
                'is_active' => true,
                'last_activity' => now(),
            ],
            [
                'name' => 'Director',
                'email' => 'director@benchmark.com',
                'password' => 'password',
                'role' => 'director',
                'country' => 'UK',
                'is_active' => true,
                'last_activity' => now(),
            ],
            [
                'name' => 'Accounts Manager',
                'email' => 'accounts@benchmark.com',
                'password' => 'password',
                'role' => 'accounts_manager',
                'country' => 'UK',
                'is_active' => true,
                'last_activity' => now(),
            ],
        ];

        foreach ($admin as $u) {
            User::create($u);
        }

        // ── Operations Managers ──────────────────────────────
        // project codes they manage (mapped to IDs after creation)
        $oms = [
            [
                'name' => 'Nadeem Saeed',
                'email' => 'nadeem.saeed@benchmark.com',
                'password' => 'password',
                'role' => 'operations_manager',
                'country' => 'UK',
                'department' => 'floor_plan',
                'is_active' => true,
                'last_activity' => now(),
                '_projects' => ['FOCAL-CRM-FP', 'FOCAL-PB-FP', 'FOCAL-MP-FP', 'SCHEMATIC-FP', 'UK-FOCAL-XACT', 'AUS-METRO-XACT'],
            ],
            [
                'name' => 'Subhan Javed',
                'email' => 'subhan.javed@benchmark.com',
                'password' => 'password',
                'role' => 'operations_manager',
                'country' => 'UK',
                'department' => 'floor_plan',
                'is_active' => true,
                'last_activity' => now(),
                '_projects' => ['GF-FP', 'SINGLE-FP', 'CAD-FP', 'CODE-FP', 'BR-FP', 'SA-FP'],
            ],
            [
                'name' => 'Ali Hamza',
                'email' => 'ali.hamza@benchmark.com',
                'password' => 'password',
                'role' => 'operations_manager',
                'country' => 'Australia',
                'department' => 'floor_plan',
                'is_active' => true,
                'last_activity' => now(),
                '_projects' => ['METRO-FP', 'AUS-OTHERS-FP'],
            ],
            [
                'name' => 'Farhan Ali',
                'email' => 'farhan.ali@benchmark.com',
                'password' => 'password',
                'role' => 'operations_manager',
                'country' => 'Australia',
                'department' => 'floor_plan',
                'is_active' => true,
                'last_activity' => now(),
                '_projects' => ['ROOMIO-FP'],
            ],
            [
                'name' => 'Muneeb',
                'email' => 'muneeb@benchmark.com',
                'password' => 'password',
                'role' => 'operations_manager',
                'country' => 'Vietnam',
                'department' => 'floor_plan',
                'is_active' => true,
                'last_activity' => now(),
                '_projects' => ['CUBI-FP'],
            ],
            [
                'name' => 'Ghulam Haider',
                'email' => 'ghulam.haider@benchmark.com',
                'password' => 'password',
                'role' => 'operations_manager',
                'country' => 'UK',
                'department' => 'photos_enhancement',
                'is_active' => true,
                'last_activity' => now(),
                '_projects' => ['BR-PHOTOS', 'ALL-OTHER-HDR'],
            ],
            [
                'name' => 'Abdul Rehman',
                'email' => 'abdul.rehman@benchmark.com',
                'password' => 'password',
                'role' => 'operations_manager',
                'country' => 'UK',
                'department' => 'photos_enhancement',
                'is_active' => true,
                'last_activity' => now(),
                '_projects' => ['SA-PHOTOS', 'CODE-PHOTOS', 'SINGLE-PHOTOS', 'FOCAL-CRM-PHOTOS', 'FOCAL-AI-PHOTOS', 'FOCAL-PB-PHOTOS', 'RAW-PRESTIGE', 'FOCAL-RTV'],
            ],
        ];

        // Preload project code→id map
        $projectMap = Project::pluck('id', 'code')->toArray();

        foreach ($oms as $data) {
            $projectCodes = $data['_projects'];
            unset($data['_projects']);

            $user = User::create($data);

            // OM ↔ Project pivot
            $projectIds = array_map(fn ($c) => $projectMap[$c], $projectCodes);
            $user->omProjects()->sync($projectIds);
        }

        // ── Project Managers ─────────────────────────────────
        // Each PM entry has _projects (codes) they manage
        $pms = [
            // --- Floor Plan PMs ---
            [
                'name' => 'Ahmad Mustafa',
                'email' => 'ahmad.mustafa@benchmark.com',
                'password' => 'password',
                'role' => 'project_manager',
                'country' => 'UK',
                'department' => 'floor_plan',
                'is_active' => true,
                'last_activity' => now(),
                '_projects' => ['FOCAL-CRM-FP', 'FOCAL-PB-FP'],
            ],
            [
                'name' => 'Moaz',
                'email' => 'moaz@benchmark.com',
                'password' => 'password',
                'role' => 'project_manager',
                'country' => 'UK',
                'department' => 'floor_plan',
                'is_active' => true,
                'last_activity' => now(),
                '_projects' => ['FOCAL-MP-FP', 'SCHEMATIC-FP'],
            ],
            [
                'name' => 'Kanwal',
                'email' => 'kanwal@benchmark.com',
                'password' => 'password',
                'role' => 'project_manager',
                'country' => 'UK',
                'department' => 'floor_plan',
                'is_active' => true,
                'last_activity' => now(),
                '_projects' => ['FOCAL-MP-FP', 'SCHEMATIC-FP'],
            ],
            [
                'name' => 'Qadeer',
                'email' => 'qadeer@benchmark.com',
                'password' => 'password',
                'role' => 'project_manager',
                'country' => 'UK',
                'department' => 'floor_plan',
                'is_active' => true,
                'last_activity' => now(),
                '_projects' => ['GF-FP'],
            ],
            [
                'name' => 'Furqan',
                'email' => 'furqan@benchmark.com',
                'password' => 'password',
                'role' => 'project_manager',
                'country' => 'UK',
                'department' => 'floor_plan',
                'is_active' => true,
                'last_activity' => now(),
                '_projects' => ['SINGLE-FP'],
            ],
            [
                'name' => 'Abdullah',
                'email' => 'abdullah.fp@benchmark.com',
                'password' => 'password',
                'role' => 'project_manager',
                'country' => 'UK',
                'department' => 'floor_plan',
                'is_active' => true,
                'last_activity' => now(),
                '_projects' => ['CAD-FP'],
            ],
            [
                'name' => 'Naveed',
                'email' => 'naveed@benchmark.com',
                'password' => 'password',
                'role' => 'project_manager',
                'country' => 'UK',
                'department' => 'floor_plan',
                'is_active' => true,
                'last_activity' => now(),
                '_projects' => ['CODE-FP', 'BR-FP'],
            ],
            [
                'name' => 'Zaryab',
                'email' => 'zaryab@benchmark.com',
                'password' => 'password',
                'role' => 'project_manager',
                'country' => 'UK',
                'department' => 'floor_plan',
                'is_active' => true,
                'last_activity' => now(),
                '_projects' => ['SA-FP'],
            ],
            [
                'name' => 'Shahzad John',
                'email' => 'shahzad.john@benchmark.com',
                'password' => 'password',
                'role' => 'project_manager',
                'country' => 'Australia',
                'department' => 'floor_plan',
                'is_active' => true,
                'last_activity' => now(),
                '_projects' => ['METRO-FP'],
            ],
            [
                'name' => 'Rizwan Khan',
                'email' => 'rizwan.khan@benchmark.com',
                'password' => 'password',
                'role' => 'project_manager',
                'country' => 'Australia',
                'department' => 'floor_plan',
                'is_active' => true,
                'last_activity' => now(),
                '_projects' => ['METRO-FP'],
            ],
            [
                'name' => 'Mubeen Imran',
                'email' => 'mubeen.imran@benchmark.com',
                'password' => 'password',
                'role' => 'project_manager',
                'country' => 'Australia',
                'department' => 'floor_plan',
                'is_active' => true,
                'last_activity' => now(),
                '_projects' => ['AUS-OTHERS-FP'],
            ],
            [
                'name' => 'Hafiz Omar Zubaidi',
                'email' => 'hafiz.omar@benchmark.com',
                'password' => 'password',
                'role' => 'project_manager',
                'country' => 'Australia',
                'department' => 'floor_plan',
                'is_active' => true,
                'last_activity' => now(),
                '_projects' => ['ROOMIO-FP'],
            ],
            [
                'name' => 'Aliya',
                'email' => 'aliya@benchmark.com',
                'password' => 'password',
                'role' => 'project_manager',
                'country' => 'Vietnam',
                'department' => 'floor_plan',
                'is_active' => true,
                'last_activity' => now(),
                '_projects' => ['CUBI-FP'],
            ],
            [
                'name' => 'Ameer Hamza',
                'email' => 'ameer.hamza@benchmark.com',
                'password' => 'password',
                'role' => 'project_manager',
                'country' => 'Vietnam',
                'department' => 'floor_plan',
                'is_active' => true,
                'last_activity' => now(),
                '_projects' => ['CUBI-FP', 'SA-PHOTOS'],
            ],

            // --- Photo Enhancement PMs ---
            [
                'name' => 'Subhan',
                'email' => 'subhan@benchmark.com',
                'password' => 'password',
                'role' => 'project_manager',
                'country' => 'UK',
                'department' => 'photos_enhancement',
                'is_active' => true,
                'last_activity' => now(),
                '_projects' => ['BR-PHOTOS'],
            ],
            [
                'name' => 'Shahbaz',
                'email' => 'shahbaz@benchmark.com',
                'password' => 'password',
                'role' => 'project_manager',
                'country' => 'UK',
                'department' => 'photos_enhancement',
                'is_active' => true,
                'last_activity' => now(),
                '_projects' => ['ALL-OTHER-HDR'],
            ],
            [
                'name' => 'Humair',
                'email' => 'humair@benchmark.com',
                'password' => 'password',
                'role' => 'project_manager',
                'country' => 'UK',
                'department' => 'photos_enhancement',
                'is_active' => true,
                'last_activity' => now(),
                '_projects' => ['SA-PHOTOS'],
            ],
            [
                'name' => 'Abdullah',
                'email' => 'abdullah.pe@benchmark.com',
                'password' => 'password',
                'role' => 'project_manager',
                'country' => 'UK',
                'department' => 'photos_enhancement',
                'is_active' => true,
                'last_activity' => now(),
                '_projects' => ['CODE-PHOTOS', 'SINGLE-PHOTOS'],
            ],
            [
                'name' => 'Umer Farooq',
                'email' => 'umer.farooq@benchmark.com',
                'password' => 'password',
                'role' => 'project_manager',
                'country' => 'UK',
                'department' => 'photos_enhancement',
                'is_active' => true,
                'last_activity' => now(),
                '_projects' => ['FOCAL-CRM-PHOTOS', 'FOCAL-AI-PHOTOS', 'FOCAL-PB-PHOTOS', 'RAW-PRESTIGE', 'FOCAL-RTV'],
            ],
        ];

        foreach ($pms as $data) {
            $projectCodes = $data['_projects'];
            unset($data['_projects']);

            $user = User::create($data);

            // PM ↔ Project pivot
            $projectIds = array_map(fn ($c) => $projectMap[$c], $projectCodes);
            $user->managedProjects()->sync($projectIds);
        }
    }
}
