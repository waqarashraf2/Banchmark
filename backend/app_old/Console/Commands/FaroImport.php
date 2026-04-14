<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\FaroImportService;

class FaroImport extends Command
{
    protected $signature = 'app:faro-import';

    protected $description = 'Import Faro orders';

    public function handle()
    {
        app(FaroImportService::class)->run();

        $this->info('Faro import completed successfully.');
    }
}