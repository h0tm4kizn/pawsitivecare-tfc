<?php

use App\Mail\WelcomeMail;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'ok' => true,
        'name' => config('app.name'),
        'status' => 'ok',
        'message' => 'PawsitiveCare API is running.',
    ]);
});

// TEMPORARY: Email preview route for local development only.
// Remove this before deployment or when email template testing is done.
Route::get('/preview-mail/welcome', function () {
    $user = (object) [
        'email' => 'sample.customer@example.com',
    ];

    $owner = (object) [
        'full_name'  => 'Sample Customer',
        'display_id' => 'CUS-0001',
    ];

    return new WelcomeMail($user, $owner);
});
