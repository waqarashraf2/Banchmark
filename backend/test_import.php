<?php

require_once 'vendor/autoload.php';

$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$csv = file_get_contents('test_csv.txt');

$controller = new App\Http\Controllers\Api\OrderImportController();
$request = new Illuminate\Http\Request();
$request->merge(['csv_text' => $csv]);
$user = App\Models\User::first();
auth()->login($user);
$result = $controller->importCsvText($request, 8);
var_dump($result);