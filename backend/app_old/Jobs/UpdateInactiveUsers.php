<?php

namespace App\Jobs;

use App\Models\User;
use App\Services\AuditService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Update inactive_days counter for all users.
 * Flags users who haven't logged in for 15+ days.
 * Scheduled to run daily at midnight.
 */
class UpdateInactiveUsers implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 300;

    public function handle(): void
    {
        Log::info('UpdateInactiveUsers: Starting daily inactive user check');

        $inactiveThresholdDays = 15;
        $flagged = 0;
        $unflagged = 0;

        // Update inactive_days for all active users
        User::where('is_active', true)
            ->whereNotNull('last_activity')
            ->chunkById(100, function ($users) use ($inactiveThresholdDays, &$flagged) {
                foreach ($users as $user) {
                    $daysSinceLogin = $user->last_activity->diffInDays(now());
                    
                    $wasInactive = $user->inactive_days >= $inactiveThresholdDays;
                    $user->update(['inactive_days' => $daysSinceLogin]);
                    
                    // Log if user crossed the threshold
                    if (!$wasInactive && $daysSinceLogin >= $inactiveThresholdDays) {
                        AuditService::log(
                            null,
                            'USER_FLAGGED_INACTIVE',
                            'User',
                            $user->id,
                            $user->project_id,
                            ['inactive_days' => $user->getOriginal('inactive_days')],
                            ['inactive_days' => $daysSinceLogin, 'threshold' => $inactiveThresholdDays]
                        );
                        $flagged++;
                    }
                }
            });

        // Users who have never logged in get flagged based on created_at
        User::where('is_active', true)
            ->whereNull('last_activity')
            ->chunkById(100, function ($users) use ($inactiveThresholdDays, &$flagged) {
                foreach ($users as $user) {
                    $daysSinceCreation = $user->created_at->diffInDays(now());
                    
                    if ($daysSinceCreation >= $inactiveThresholdDays) {
                        $user->update(['inactive_days' => $daysSinceCreation]);
                        
                        AuditService::log(
                            null,
                            'USER_FLAGGED_INACTIVE',
                            'User',
                            $user->id,
                            $user->project_id,
                            null,
                            ['inactive_days' => $daysSinceCreation, 'reason' => 'Never logged in']
                        );
                        $flagged++;
                    }
                }
            });

        Log::info("UpdateInactiveUsers: Completed. Flagged {$flagged} users as inactive.");
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('UpdateInactiveUsers job failed', [
            'error' => $exception->getMessage(),
        ]);
    }
}
