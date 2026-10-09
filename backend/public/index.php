<?php

use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Determine if the application is in maintenance mode...
if (file_exists($maintenance = __DIR__.'/../storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register the Composer autoloader...
require __DIR__.'/../vendor/autoload.php';

// Bootstrap Laravel and handle the request...

// Suppress deprecation notices from PHP and libraries which can break
// JSON API responses during local development. Keep other errors visible
// when APP_DEBUG is enabled.
if (ini_get('display_errors')) {
    // Hide E_DEPRECATED and E_USER_DEPRECATED from output but keep others.
    error_reporting(error_reporting() & ~E_DEPRECATED & ~E_USER_DEPRECATED);
    ini_set('display_errors', '1');
}

(require_once __DIR__.'/../bootstrap/app.php')
    ->handleRequest(Request::capture());
