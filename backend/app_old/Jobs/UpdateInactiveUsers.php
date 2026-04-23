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
 * Daily absence marking system.
 * Runs at 12:00 PM (noon) each day.
 * 
 * Rules:
 * - All active users marked as absent at 12 PM
 * - When user logs in (last_activity updated), absent mark is removed
 * - Users who don't login after 12 PM stay marked absent
 * 
 * Scheduled to run daily at 12:00 PM.
 */
class UpdateInactiveUsers implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 300;

    public function handle(): void
    {
        Log::info('UpdateInactiveUsers: Daily absence marking at 12 PM');

        $markedAbsent = 0;

        try {
            // Mark all active users as absent at 12 PM
            // This happens every day, and users remove the absent mark by logging in
            $updated = User::where('is_active', true)
                ->where('is_absent', false)  // Only mark if not already absent
                ->update([
                    'is_absent' => true,
                    'updated_at' => now(),
                ]);

            $markedAbsent = $updated;

            Log::info("UpdateInactiveUsers: Marked {$markedAbsent} users as absent at 12 PM");

        } catch (\Exception $e) {
            Log::error('UpdateInactiveUsers error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('UpdateInactiveUsers job failed', [
            'error' => $exception->getMessage(),
        ]);
    }
}
