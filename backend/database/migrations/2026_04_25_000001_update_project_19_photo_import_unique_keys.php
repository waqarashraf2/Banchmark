<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private string $table = 'project_19_orders';
    private string $orderNumberUnique = 'project_19_orders_order_number_unique';
    private string $orderNumberIndex = 'project_19_orders_order_number_index';
    private string $clientPortalUnique = 'project_19_orders_client_portal_id_unique';

    public function up(): void
    {
        if (!Schema::hasTable($this->table) || !Schema::hasColumn($this->table, 'client_portal_id')) {
            return;
        }

        $duplicateClientPortalIds = DB::table($this->table)
            ->select('client_portal_id')
            ->whereNotNull('client_portal_id')
            ->groupBy('client_portal_id')
            ->havingRaw('COUNT(*) > 1')
            ->limit(1)
            ->pluck('client_portal_id');

        if ($duplicateClientPortalIds->isNotEmpty()) {
            throw new RuntimeException('Cannot add unique index to project_19_orders.client_portal_id because duplicate values already exist.');
        }

        Schema::table($this->table, function (Blueprint $table) {
            if ($this->hasIndex($this->orderNumberUnique)) {
                $table->dropUnique($this->orderNumberUnique);
            }

            if (!$this->hasIndex($this->orderNumberIndex)) {
                $table->index('order_number', $this->orderNumberIndex);
            }

            if (!$this->hasIndex($this->clientPortalUnique)) {
                $table->unique('client_portal_id', $this->clientPortalUnique);
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable($this->table)) {
            return;
        }

        Schema::table($this->table, function (Blueprint $table) {
            if ($this->hasIndex($this->clientPortalUnique)) {
                $table->dropUnique($this->clientPortalUnique);
            }

            if ($this->hasIndex($this->orderNumberIndex)) {
                $table->dropIndex($this->orderNumberIndex);
            }

            if (!$this->hasIndex($this->orderNumberUnique)) {
                $table->unique('order_number', $this->orderNumberUnique);
            }
        });
    }

    private function hasIndex(string $indexName): bool
    {
        return collect(DB::select("SHOW INDEX FROM `{$this->table}`"))
            ->contains(fn ($index) => ($index->Key_name ?? null) === $indexName);
    }
};
