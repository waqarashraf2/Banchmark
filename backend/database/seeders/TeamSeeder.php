<?php

namespace Database\Seeders;

use App\Models\Project;
use App\Models\Team;
use Illuminate\Database\Seeder;

class TeamSeeder extends Seeder
{
    /**
     * Create one default team per project.
     * FP projects: drawer + checker + qa
     * PE projects: designer + qa
     */
    public function run(): void
    {
        $projects = Project::all();

        foreach ($projects as $project) {
            $isFP = $project->department === 'floor_plan';

            Team::create([
                'project_id' => $project->id,
                'name' => $project->name . ' Team',
                'qa_count' => 1,
                'checker_count' => $isFP ? 1 : 0,
                'drawer_count' => $isFP ? 1 : 0,
                'designer_count' => $isFP ? 0 : 1,
                'is_active' => true,
            ]);
        }
    }
}
