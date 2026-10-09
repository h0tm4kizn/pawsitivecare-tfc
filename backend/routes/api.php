<?php

use Illuminate\Http\Request;
use App\Http\Controllers\Api\PowerSyncController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ContactMessageController;
use App\Http\Controllers\Api\ShopHoursController;
use App\Http\Controllers\Api\PaymentAccountController;
use App\Http\Controllers\Api\StaffAttendanceController;
use App\Http\Controllers\Api\StaffCommissionController;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Http\Controllers\Api\Appointment\AppointmentController;
use App\Http\Controllers\Api\Appointment\AppointmentUpdateController;
use App\Http\Controllers\Api\Appointment\AppointmentBookingController;
use App\Http\Controllers\Api\Appointment\AppointmentStatusController;
use App\Http\Controllers\Api\Appointment\AppointmentCommunicationController;
use App\Http\Controllers\Api\Appointment\AppointmentDashboardController;
use App\Http\Controllers\Api\Appointment\AppointmentAddonController;
use App\Http\Controllers\Api\Appointment\AppointmentAvailabilityController;
use App\Http\Controllers\Api\Appointment\AppointmentHotelController;
use App\Http\Controllers\Api\Appointment\AppointmentPaymentController;
use App\Http\Controllers\Api\StaffController;
use App\Http\Controllers\Api\SpeciesTypeController;
use App\Http\Controllers\Api\BreedController;
use App\Http\Controllers\Api\PetHealthFormController;
use App\Models\SpeciesType;
use App\Models\Breed;

/*
|--------------------------------------------------------------------------
| Public Routes — no authentication required
|--------------------------------------------------------------------------
*/
Route::get('/health', function () {
    return response()->json([
        'ok' => true,
        'name' => config('app.name', 'The Fur Club'),
        'status' => 'ok',
        'message' => 'PawsitiveCare API is running.',
    ]);
});
// Scan sessions are reserved for pet-identification related workflows only.
Route::get('/_db-health', function () {
    $requiredTables = [
        'users',
        'personal_access_tokens',
        'login_otp_challenges',
        'login_otp_events',
    ];

    try {
        DB::connection()->select('select 1');
        $databaseOk = true;
        $databaseError = null;
    } catch (\Throwable $e) {
        $databaseOk = false;
        $databaseError = $e->getMessage();
    }

    $tables = [];
    foreach ($requiredTables as $table) {
        try {
            $tables[$table] = Schema::hasTable($table);
        } catch (\Throwable $e) {
            $tables[$table] = false;
        }
    }

    return response()->json(['ok' => $databaseOk && !in_array(false, $tables, true)], $databaseOk ? 200 : 503);
})->middleware(['auth:sanctum', 'role:admin']);
Route::get('/scan-sessions/server-ip', [\App\Http\Controllers\Api\ScanSessionController::class, 'serverIp'])
    ->middleware(['auth:sanctum', 'role:admin,staff', 'staff_type:front_desk', 'throttle:scan-create']);
Route::post('/scan-sessions', [\App\Http\Controllers\Api\ScanSessionController::class, 'create'])
    ->middleware(['auth:sanctum', 'role:admin,staff', 'staff_type:front_desk', 'throttle:scan-create']);
Route::post('/scan-sessions/{token}', [\App\Http\Controllers\Api\ScanSessionController::class, 'submit'])
    ->middleware('throttle:scan-session');
Route::get('/scan-sessions/{token}', [\App\Http\Controllers\Api\ScanSessionController::class, 'poll'])
    ->middleware('throttle:scan-session');

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
Route::post('/login/otp/resend', [AuthController::class, 'resendLoginOtp'])->middleware('throttle:5,1');
Route::post('/register', [AuthController::class, 'register']);
Route::post('/register/verify-otp', [AuthController::class, 'verifyRegistrationOtp'])->middleware('throttle:10,1');
Route::post('/register/otp/resend', [AuthController::class, 'resendRegistrationOtp'])->middleware('throttle:5,1');
Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:forgot-password');
Route::post('/forgot-password/request-otp', [AuthController::class, 'forgotPasswordRequestOtp'])->middleware('throttle:5,1');
Route::post('/forgot-password/verify-otp', [AuthController::class, 'forgotPasswordVerifyOtp'])->middleware('throttle:10,1');
Route::post('/reset-password', [AuthController::class, 'resetPassword']);
Route::get('/admin/appointments/stream', [AppointmentDashboardController::class, 'streamNewBookings'])->middleware('throttle:120,1');

// Email preview routes (development/debugging only)
Route::prefix('preview-email')->middleware(['development.email.preview', 'throttle:100,1'])->group(function () {
    Route::get('/welcome', [App\Http\Controllers\EmailPreviewController::class, 'previewWelcome']);
    Route::get('/booking-confirmation', [App\Http\Controllers\EmailPreviewController::class, 'previewBookingConfirmation']);
    Route::get('/thank-you', [App\Http\Controllers\EmailPreviewController::class, 'previewThankYou']);
    Route::get('/appointment-reminder', [App\Http\Controllers\EmailPreviewController::class, 'previewAppointmentReminder']);
    Route::get('/forgot-password', [App\Http\Controllers\EmailPreviewController::class, 'previewForgotPassword']);
    Route::get('/pet-birthday', [App\Http\Controllers\EmailPreviewController::class, 'previewPetBirthday']);
    Route::get('/contact-reply', [App\Http\Controllers\EmailPreviewController::class, 'previewContactReply']);
    Route::get('/booking-rejected', [App\Http\Controllers\EmailPreviewController::class, 'previewBookingRejected']);
    Route::get('/otp-signup', [App\Http\Controllers\EmailPreviewController::class, 'previewOtpSignup']);
    Route::get('/otp-login', [App\Http\Controllers\EmailPreviewController::class, 'previewOtpLogin']);
    Route::get('/otp-password-reset', [App\Http\Controllers\EmailPreviewController::class, 'previewOtpPasswordReset']);
    Route::get('/password-changed', [App\Http\Controllers\EmailPreviewController::class, 'previewPasswordChanged']);
    Route::get('/new-pet-registered', [App\Http\Controllers\EmailPreviewController::class, 'previewNewPetRegistered']);
    Route::get('/appointment-cancelled', [App\Http\Controllers\EmailPreviewController::class, 'previewAppointmentCancelled']);
    Route::get('/appointment-cancelled-by-customer', [App\Http\Controllers\EmailPreviewController::class, 'previewAppointmentCancelledByCustomer']);
    Route::get('/appointment-no-show', [App\Http\Controllers\EmailPreviewController::class, 'previewAppointmentNoShow']);
    Route::get('/grooming-due', [App\Http\Controllers\EmailPreviewController::class, 'previewGroomingDue']);
});

// Contact messages — public submit (no auth needed)
Route::post('/contact-messages', [ContactMessageController::class, 'store']);

// Public clinic schedule — clients need this to see available days/times
Route::get('/clinic/schedule', [ShopHoursController::class, 'index']);

// Public read-only supplies catalog. Purchases are completed at the physical shop.
Route::get('/supplies/catalog', [\App\Http\Controllers\Api\InventoryController::class, 'publicCatalog']);

// Public service catalog — for client dashboard browsing (no auth required)
Route::get('/services/catalog', function () {
    $services = \App\Models\Service::with(['serviceTiers.promotions' => fn($q) => $q->where('is_active', true)])
        ->where('is_active', true)
        ->get()
        ->map(function ($svc) {
            return [
                'id'          => $svc->id,
                'name'        => $svc->name,
                'category'    => $svc->category,
                'description' => $svc->description,
                'tiers'       => $svc->serviceTiers->map(fn($t) => [
                    'size_label'     => $t->size_label,
                    'price'          => $t->price,
                    'price_max'      => $t->price_max,
                    'duration_hours' => $t->duration_hours,
                    'promotions' => $t->promotions->map(fn($promo) => [
                        'id' => $promo->id, 'title' => $promo->title, 'description' => $promo->description,
                        'discount_type' => $promo->discount_type, 'discount_value' => $promo->discount_value,
                        'promotional_price' => $promo->promotional_price,
                        'starts_on' => $promo->starts_on?->toDateString(), 'ends_on' => $promo->ends_on?->toDateString(),
                    ]),
                ]),
            ];
        });
    return response()->json(['data' => $services]);
});

// Public hotel suites — for landing page display (no auth required)
Route::get('/public/hotel-suites', function () {
    return response()->json(
        \App\Models\HotelSuite::whereRaw('"is_available" = true')->orderedForDisplay()->get()
    );
});

// Fetch species for the registration form (public — no auth)
Route::get('/species', function () {
    $species = SpeciesType::whereRaw('"is_active" = true')->get();
    return response()->json(['data' => $species]);
});

// Fetch breeds (filtered by species_id) for the registration form
// Note: /breeds conflicts with the authenticated apiResource('breeds') route, so use /breeds/options
Route::get('/breeds/options', function (Request $request) {
    $query = Breed::whereRaw('"is_active" = true');

    if ($request->has('species_id')) {
        $query->where('species_id', $request->species_id);
    }
    return response()->json(['data' => $query->get()]);
});

/*
|--------------------------------------------------------------------------
| Authenticated Routes (All Logged-in Users)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'verified.customer'])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/me/otp/authenticator/setup', [AuthController::class, 'setupAuthenticator']);
    Route::post('/me/otp/authenticator/confirm', [AuthController::class, 'confirmAuthenticator']);
    Route::post('/me/otp/authenticator/disable', [AuthController::class, 'disableAuthenticator']);
    Route::post('/me/otp/recovery-codes/regenerate', [AuthController::class, 'regenerateRecoveryCodes']);

    // Available slots — accessible by all authenticated users
    Route::get('/appointments/available-slots', [AppointmentAvailabilityController::class, 'availableSlots']);
    Route::get('/appointments/hotel-calendar', [AppointmentAvailabilityController::class, 'hotelCalendarAvailability']);
    Route::get('/clinic/payment-accounts', [PaymentAccountController::class, 'index']);
    Route::get('/staff/attendance/today', [StaffAttendanceController::class, 'today']);
    Route::get('/staff/attendance/history', [StaffAttendanceController::class, 'history']);
    Route::post('/staff/attendance/time-in', [StaffAttendanceController::class, 'timeIn']);
    Route::post('/staff/attendance/time-out', [StaffAttendanceController::class, 'timeOut']);
    Route::post('/staff/qr-credential', [StaffController::class, 'qrCredentialForSelf']);
    Route::get('/staff/commissions', [StaffCommissionController::class, 'index']);
    // Customers may upload proof for their own hotel appointment; the
    // controller policy still enforces ownership/admin-staff access.
    Route::get('/appointments/{appointment}/deposit-proof', [AppointmentPaymentController::class, 'showDepositProof']);
    Route::post('/appointments/{appointment}/deposit-proof', [AppointmentPaymentController::class, 'uploadDepositProof']);

    // Task 93: view notifications for a specific appointment
    Route::get('/appointments/{appointmentId}/notifications', [NotificationController::class, 'byAppointment']);

    // Booking Flow API - Enhanced multi-step booking
    Route::prefix('booking')->group(function () {
        Route::get('/categories', [\App\Http\Controllers\Api\BookingFlowController::class, 'getCategories']);
        Route::get('/owners', [\App\Http\Controllers\Api\BookingFlowController::class, 'getOwners'])
            ->middleware('role:admin,staff');
        Route::get('/owners/{ownerId}/pets', [\App\Http\Controllers\Api\BookingFlowController::class, 'getPetsByOwner'])
            ->middleware('role:admin,staff');
        Route::get('/services', [\App\Http\Controllers\Api\BookingFlowController::class, 'getServicesByCategory']);
        Route::get('/addons', [\App\Http\Controllers\Api\BookingFlowController::class, 'getAddonsByCategory']);
        Route::get('/hotel-suites', [\App\Http\Controllers\Api\BookingFlowController::class, 'getAvailableHotelSuites']);
        Route::get('/hotel-capacity', [\App\Http\Controllers\Api\BookingFlowController::class, 'checkHotelCapacity']);
        Route::post('/validate', [\App\Http\Controllers\Api\BookingFlowController::class, 'validateBooking']);
        Route::post('/calculate-price', [\App\Http\Controllers\Api\BookingFlowController::class, 'calculatePrice']);
    });

    /*
    |--------------------------------------------------------------------------
    | PowerSync Routes — Offline-First Sync
    | Requires Sanctum authentication for secure client-server sync
    |--------------------------------------------------------------------------
    */
    // PowerSync token — issues a short-lived JWT for the sync stream
    Route::get('/powersync/token', [PowerSyncController::class, 'token']);

    // PowerSync sync endpoint — client downloads data changes
    Route::post('/powersync/sync', [PowerSyncController::class, 'sync']);

    // PowerSync upload endpoint — client sends mutations (create/update/delete)
    Route::post('/powersync/upload', [PowerSyncController::class, 'upload']);
});

/*
|--------------------------------------------------------------------------
| Admin + Staff Routes (Shared)
| Both admin and staff can access these
|--------------------------------------------------------------------------
*/


Route::middleware(['auth:sanctum', 'role:admin,staff', 'audit.admin'])->group(function () {
    // Owners — read/create/update (delete is admin only)
    Route::apiResource('owners', \App\Http\Controllers\Api\OwnerController::class)->except(['destroy']);

    // Pets — read/create/update (delete is admin only)
    Route::post('/pets/nose-print-lookup', [\App\Http\Controllers\Api\PetController::class, 'nosePrintLookup']);
    Route::apiResource('pets', \App\Http\Controllers\Api\PetController::class)->except(['destroy']);
    Route::post('/pets/{pet}/photo', [\App\Http\Controllers\Api\PetController::class, 'uploadPhoto']);
    Route::post('/pets/{pet}/nose-print', [\App\Http\Controllers\Api\PetController::class, 'uploadNosePrint']);
    Route::post('/pets/{pet}/recognition-enroll', [\App\Http\Controllers\Api\PetController::class, 'markRecognitionEnrolled'])->middleware('staff_type:front_desk');
    Route::post('/pets/{pet}/recognition-photo', [\App\Http\Controllers\Api\PetController::class, 'storeRecognitionPhoto'])->middleware('staff_type:front_desk');
    Route::get('/pets/{pet}/health-form',     [PetHealthFormController::class, 'show']);
    Route::get('/pets/{pet}/health-form/status', [PetHealthFormController::class, 'status']);
    Route::get('/pets/{pet}/health-form/history', [PetHealthFormController::class, 'history']);
    Route::post('/pets/{pet}/health-form',    [PetHealthFormController::class, 'save']);
    Route::get('/pets/{pet}/health-form/pdf', [PetHealthFormController::class, 'downloadPdf']);

    // Species Types — read only for admin+staff (writes are admin-only below)
    Route::apiResource('species-types', SpeciesTypeController::class)->only(['index', 'show']);

    // Breeds — read only for admin+staff (writes are admin-only below)
    Route::apiResource('breeds', BreedController::class)->only(['index', 'show']);

    // Services — admin/staff only
    Route::apiResource('services', \App\Http\Controllers\Api\ServiceController::class);

    // Task 83a: Service sub-page detail endpoint
    Route::get('/services/{id}/detail', [\App\Http\Controllers\Api\ServiceController::class, 'showDetail']);


    // Service Addons — admin/staff only
    Route::apiResource('service-addons', \App\Http\Controllers\Api\ServiceAddonController::class);

    // Service Categories — read (admin/staff)
    Route::get('/service-categories', [\App\Http\Controllers\Api\ServiceCategoryController::class, 'index']);

    // Service Tiers — update/create/delete
    Route::post('/service-tiers', [\App\Http\Controllers\Api\ServiceTierController::class, 'store']);
    Route::put('/service-tiers/{serviceTier}', [\App\Http\Controllers\Api\ServiceTierController::class, 'update']);
    Route::delete('/service-tiers/{serviceTier}', [\App\Http\Controllers\Api\ServiceTierController::class, 'destroy']);

    // Hotel Suites — admin/staff only
    Route::apiResource('hotel-suites', \App\Http\Controllers\Api\HotelSuiteController::class);
    Route::get('/admin/hotel-suites/occupancy', [\App\Http\Controllers\Api\HotelSuiteController::class, 'occupancy']);
    Route::get('/admin/hotel-suites/live-occupancy', [\App\Http\Controllers\Api\HotelSuiteController::class, 'liveOccupancy']);
    // Backward-compatible aliases for older clients.
    Route::get('/admin/hotel-suites/inventory', [\App\Http\Controllers\Api\HotelSuiteController::class, 'inventory']);
    Route::get('/admin/hotel-suites/live-inventory', [\App\Http\Controllers\Api\HotelSuiteController::class, 'liveInventory']);

    // Inventory and walk-in sales � admin/staff read, admin writes enforced in controller.
    Route::get('/admin/inventory', [\App\Http\Controllers\Api\InventoryController::class, 'index']);
    Route::get('/admin/inventory/barcode', [\App\Http\Controllers\Api\InventoryController::class, 'lookupBarcode']);
    Route::post('/admin/inventory', [\App\Http\Controllers\Api\InventoryController::class, 'store']);
    Route::put('/admin/inventory/{inventory}', [\App\Http\Controllers\Api\InventoryController::class, 'update']);
    Route::delete('/admin/inventory/{inventory}', [\App\Http\Controllers\Api\InventoryController::class, 'destroy']);
    Route::post('/admin/inventory/{inventory}/image', [\App\Http\Controllers\Api\InventoryController::class, 'uploadImage']);

    Route::get('/admin/walk-in-sales', [\App\Http\Controllers\Api\WalkInSaleController::class, 'index'])->middleware('staff_type:front_desk');
    Route::post('/admin/walk-in-sales', [\App\Http\Controllers\Api\WalkInSaleController::class, 'store'])->middleware('staff_type:front_desk');
    Route::get('/admin/walk-in-sales/{walkInSale}', [\App\Http\Controllers\Api\WalkInSaleController::class, 'show'])->middleware('staff_type:front_desk');
    Route::put('/admin/walk-in-sales/{walkInSale}', [\App\Http\Controllers\Api\WalkInSaleController::class, 'update'])->middleware('staff_type:front_desk');
    Route::post('/admin/walk-in-sales/{walkInSale}/void', [\App\Http\Controllers\Api\WalkInSaleController::class, 'void'])->middleware('staff_type:front_desk');
    Route::delete('/admin/walk-in-sales/{walkInSale}', [\App\Http\Controllers\Api\WalkInSaleController::class, 'destroy'])->middleware('staff_type:front_desk');
    // Appointments — staff sees own, admin sees all (enforced by AppointmentPolicy)
    Route::get('/appointments/hotel-handler-options', [AppointmentHotelController::class, 'hotelHandlerOptions']);
    Route::apiResource('appointments', AppointmentController::class)->except(['destroy', 'store', 'update']);
    Route::put('/appointments/{appointment}', [AppointmentUpdateController::class, 'update'])->name('appointments.update');
    Route::post('/appointments', [AppointmentBookingController::class, 'store']);
    Route::get('/appointments/{appointment}/history', [AppointmentController::class, 'history']);
    Route::post('/appointments/{appointment}/hotel-checkout-preview', [AppointmentHotelController::class, 'hotelCheckoutPreview']);
    Route::patch('/appointments/{appointment}/status', [AppointmentStatusController::class, 'updateStatus']);
    Route::post('/appointments/{appointment}/addons', [AppointmentAddonController::class, 'store']);
    Route::delete('/appointments/{appointment}/addons/{addonId}', [AppointmentAddonController::class, 'destroy']);

    // Notifications — both can log and read
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications', [NotificationController::class, 'store']);
    Route::delete('/notifications/{notification}', [NotificationController::class, 'destroy']);

    // Dashboard — staff and admin both need these
    Route::get('/admin/dashboard/overview', [AppointmentDashboardController::class, 'dashboardOverview']);
    Route::get('/admin/dashboard/day',      [AppointmentDashboardController::class, 'dashboardDay']);
    Route::get('/admin/dashboard/week',     [AppointmentDashboardController::class, 'dashboardWeek']);
    Route::get('/admin/dashboard/list',     [AppointmentDashboardController::class, 'dashboardList']);

    // Customer registration — staff can register new owners with pets
    Route::post('/admin/owners-with-pet', [\App\Http\Controllers\Api\OwnerController::class, 'storeWithPet']);
    // Customer Management uses the dashboard API path; keep it in the shared
    // group so authenticated staff can list/search customers too.
    Route::get('/admin/owners', [\App\Http\Controllers\Api\OwnerController::class, 'adminIndex']);

    // Staff list (read-only) — staff needs groomer list to complete grooming appointments
    Route::get('/admin/staff', [\App\Http\Controllers\Api\StaffController::class, 'index']);
    Route::post('/admin/attendance/qr/identify', [StaffAttendanceController::class, 'identifyQr']);
    Route::post('/admin/attendance/qr/confirm-time-in', [StaffAttendanceController::class, 'qrTimeIn']);
    Route::post('/admin/attendance/qr/confirm-time-out', [StaffAttendanceController::class, 'qrTimeOut']);

    // Contact messages — staff can view and mark read
    Route::get('/admin/contact-messages', [ContactMessageController::class, 'index']);
    Route::patch('/admin/contact-messages/{contactMessage}/read', [ContactMessageController::class, 'markRead']);
    Route::post('/admin/contact-messages/{contactMessage}/reply', [ContactMessageController::class, 'reply']);
    Route::delete('/admin/contact-messages/{contactMessage}', [ContactMessageController::class, 'destroy']);
    Route::put('/me/change-password', [\App\Http\Controllers\Api\UserController::class, 'changeOwnPassword']);

});

/*
|--------------------------------------------------------------------------
| Admin Only Routes
| auth:sanctum + role:admin — must have both
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'role:admin', 'audit.admin'])->group(function () {
    // Admin dashboard data routes
    Route::get('/admin/services', [\App\Http\Controllers\Api\ServiceController::class, 'adminIndex']);
    Route::post('/admin/services', [\App\Http\Controllers\Api\ServiceController::class, 'store']);
    Route::put('/admin/services/{service}', [\App\Http\Controllers\Api\ServiceController::class, 'update']);
    Route::delete('/admin/services/{service}', [\App\Http\Controllers\Api\ServiceController::class, 'destroy']);

    // Promotions are service pricing rules, not cashier coupons. Admin-only management.
    Route::apiResource('admin/promotions', \App\Http\Controllers\Api\PromotionController::class)->except(['show']);

    // Service categories — admin only write
    Route::post('/admin/service-categories', [\App\Http\Controllers\Api\ServiceCategoryController::class, 'store']);
    Route::put('/admin/service-categories/{serviceCategory}', [\App\Http\Controllers\Api\ServiceCategoryController::class, 'update']);
    Route::delete('/admin/service-categories/{serviceCategory}', [\App\Http\Controllers\Api\ServiceCategoryController::class, 'destroy']);

    Route::get('/admin/pets', [\App\Http\Controllers\Api\PetController::class, 'adminIndex']);
    // Admin-only delete routes
    Route::delete('/owners/{owner}', [\App\Http\Controllers\Api\OwnerController::class, 'destroy']);
    Route::delete('/pets/{pet}', [\App\Http\Controllers\Api\PetController::class, 'destroy']);

    // User management
    Route::get('/admin/users', [\App\Http\Controllers\Api\UserController::class, 'adminIndex']);
    Route::post('/admin/users', [\App\Http\Controllers\Api\UserController::class, 'store']);
    Route::put('/admin/users/{user}', [\App\Http\Controllers\Api\UserController::class, 'update']);
    Route::delete('/admin/users/{user}', [\App\Http\Controllers\Api\UserController::class, 'destroy']);

    // Staff management — admin only writes
    Route::post('/admin/staff', [StaffController::class, 'store']);
    Route::get('/admin/staff/{staff}', [StaffController::class, 'show']);
    Route::post('/admin/staff/{staff}/qr-credential', [StaffController::class, 'qrCredential']);
    Route::post('/admin/staff/{staff}/qr-credential/reissue', [StaffController::class, 'reissueQrCredential']);
    Route::put('/admin/staff/{staff}', [StaffController::class, 'update']);
    Route::delete('/admin/staff/{staff}', [StaffController::class, 'destroy']);

    // Species Types — write routes admin-only (Task #65a)
    Route::post('/species-types', [SpeciesTypeController::class, 'store']);
    Route::put('/species-types/{speciesType}', [SpeciesTypeController::class, 'update']);
    Route::delete('/species-types/{speciesType}', [SpeciesTypeController::class, 'destroy']);

    // Breeds — write routes admin-only (Task #65b)
    Route::post('/breeds', [BreedController::class, 'store']);
    Route::put('/breeds/{breed}', [BreedController::class, 'update']);
    Route::delete('/breeds/{breed}', [BreedController::class, 'destroy']);

    Route::get('/admin/speciestypes', function () {
        $types = \App\Models\SpeciesType::whereRaw('"is_active" = true')->get();
        return response()->json(['data' => $types]);
    });

    Route::get('/admin/breeds', function () {
        $breeds = \App\Models\Breed::whereRaw('"is_active" = true')->get();
        return response()->json(['data' => $breeds]);
    });

    Route::get('/admin/service-tiers', function () {
        $tiers = \App\Models\ServiceTier::all();
        return response()->json(['tiers' => $tiers]);
    });

    // Admin-only: hard delete appointments
    Route::delete('/appointments/{appointment}', [AppointmentController::class, 'destroy']);

    // Clinic schedule management - admin only
    Route::put('/admin/clinic/schedule/{category}', [ShopHoursController::class, 'updateSchedule']);
    Route::put('/admin/clinic/blocked-dates', [ShopHoursController::class, 'updateBlockedDates']);
    Route::put('/admin/clinic/cages', [ShopHoursController::class, 'updateCages']);
    Route::put('/admin/clinic/shop-hours', [ShopHoursController::class, 'updateShopHours']);
    Route::put('/admin/clinic/payment-accounts', [PaymentAccountController::class, 'update']);
    Route::get('/admin/attendance', [StaffAttendanceController::class, 'history']);
    Route::get('/admin/attendance/summary', [StaffAttendanceController::class, 'summary']);
    Route::get('/admin/attendance/today', [StaffAttendanceController::class, 'today']);
    Route::patch('/admin/attendance/{staffAttendance}/correct-time-out', [StaffAttendanceController::class, 'correctTimeOut']);
    Route::post('/admin/attendance/{staff}/time-in', [StaffAttendanceController::class, 'adminTimeIn']);
    Route::post('/admin/attendance/{staff}/time-out', [StaffAttendanceController::class, 'adminTimeOut']);
    Route::get('/admin/commissions', [StaffCommissionController::class, 'index']);
    Route::get('/admin/commissions/summary', [StaffCommissionController::class, 'summary']);
    Route::get('/admin/commissions/available-appointments', [StaffCommissionController::class, 'availableAppointments']);
    Route::post('/admin/commissions', [StaffCommissionController::class, 'store']);
    Route::put('/admin/commissions/{staffCommission}', [StaffCommissionController::class, 'update']);
    Route::get('/admin/commission-settings', [StaffCommissionController::class, 'settings']);
    Route::post('/admin/commission-settings', [StaffCommissionController::class, 'saveSettings']);
    // Backup & Recovery — admin only
    Route::get('/admin/audit-logs', [\App\Http\Controllers\Api\AuditLogController::class, 'index']);
    Route::get('/admin/backup/export', [\App\Http\Controllers\Api\BackupController::class, 'export']);
    Route::get('/admin/backup/files', [\App\Http\Controllers\Api\BackupController::class, 'index']);
    Route::post('/admin/backup/files', [\App\Http\Controllers\Api\BackupController::class, 'create']);
    Route::post('/admin/backup/upload', [\App\Http\Controllers\Api\BackupController::class, 'upload']);
    Route::get('/admin/backup/files/{filename}/download', [\App\Http\Controllers\Api\BackupController::class, 'download']);
    Route::post('/admin/backup/files/{filename}/restore', [\App\Http\Controllers\Api\BackupController::class, 'restore']);
    Route::get('/admin/trashed/{type}', [\App\Http\Controllers\Api\TrashedController::class, 'index']);
    Route::post('/admin/trashed/{type}/{id}/restore', [\App\Http\Controllers\Api\TrashedController::class, 'restore']);
    Route::delete('/admin/trashed/{type}/{id}', [\App\Http\Controllers\Api\TrashedController::class, 'forceDelete']);

});


/*
|--------------------------------------------------------------------------
| Customer Routes
| auth:sanctum + role:customer — must have both
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'verified.customer', 'role:customer'])->group(function () {
    // Customer views and updates their own profile
    Route::get('/my-profile', [\App\Http\Controllers\Api\OwnerController::class, 'myProfile']);
    Route::put('/my-profile', [\App\Http\Controllers\Api\OwnerController::class, 'updateMyProfile']);
    Route::put('/my-profile/change-password', [\App\Http\Controllers\Api\OwnerController::class, 'changePassword']);
    Route::post('/my-profile/check-password',  [\App\Http\Controllers\Api\OwnerController::class, 'checkPassword']);
    Route::get('/my-profile/trusted-devices', [\App\Http\Controllers\Api\OwnerController::class, 'listTrustedDevices']);
    Route::delete('/my-profile/trusted-devices/{deviceId}', [\App\Http\Controllers\Api\OwnerController::class, 'revokeTrustedDevice']);
    Route::delete('/my-profile/trusted-devices', [\App\Http\Controllers\Api\OwnerController::class, 'revokeAllTrustedDevices']);

    // View own pets / register own pet
    Route::get('/my-pets',  [\App\Http\Controllers\Api\PetController::class, 'index']);
    Route::post('/my-pets', [\App\Http\Controllers\Api\PetController::class, 'storeOwn']);
    Route::put('/my-pets/{pet}', [\App\Http\Controllers\Api\PetController::class, 'updateOwn']);
    Route::post('/my-pets/{pet}/photo', [\App\Http\Controllers\Api\PetController::class, 'uploadPhoto']);
    Route::get('/my-pets/{pet}/health-form',  [PetHealthFormController::class, 'show']);
    Route::get('/my-pets/{pet}/health-form/status', [PetHealthFormController::class, 'status']);
    Route::get('/my-pets/{pet}/health-form/history', [PetHealthFormController::class, 'history']);
    Route::post('/my-pets/{pet}/health-form', [PetHealthFormController::class, 'save']);
    Route::get('/my-pets/{pet}/health-form/pdf', [PetHealthFormController::class, 'downloadPdf']);

    // View / book / edit / cancel own appointments
    Route::get('/my-appointments',                    [AppointmentController::class, 'index']);
    Route::post('/my-appointments',                   [AppointmentBookingController::class, 'bookOwn']);
    Route::get('/my-appointments/{appointment}',      [AppointmentController::class, 'show']);
    Route::put('/my-appointments/{appointment}',      [AppointmentUpdateController::class, 'updateOwn']);
    Route::delete('/my-appointments/{appointment}',   [AppointmentStatusController::class, 'cancelOwn']);
    
    // Service acknowledgment for completed appointments
    Route::get('/my-appointments/{appointment}/service-acknowledgment', [AppointmentCommunicationController::class, 'serviceAcknowledgment']);

    // Customer notifications
    Route::get('/my-notifications', [NotificationController::class, 'index']);
    Route::patch('/my-notifications/{notification}', [NotificationController::class, 'update']);
});

// --- Reports API (admin+staff) ---
Route::middleware(['auth:sanctum', 'role:admin'])->prefix('reports')->group(function () {
    Route::get('/appointment-summary', [\App\Http\Controllers\Reports\ReportsController::class, 'appointmentSummary']);
    Route::get('/hotel-extensions', [\App\Http\Controllers\Reports\ReportsController::class, 'hotelExtensions']);
    Route::get('/customer-registrations', [\App\Http\Controllers\Reports\ReportsController::class, 'customerRegistrations']);
    Route::get('/pet-registrations', [\App\Http\Controllers\Reports\ReportsController::class, 'petRegistrations']);
    Route::get('/service-usage', [\App\Http\Controllers\Reports\ReportsController::class, 'serviceUsage']);
    Route::get('/service-retail-summary', [\App\Http\Controllers\Reports\ReportsController::class, 'serviceRetailSummary']);
    Route::get('/commissions', [\App\Http\Controllers\Reports\ReportsController::class, 'commissions']);
    Route::get('/staff-attendance', [\App\Http\Controllers\Reports\ReportsController::class, 'staffAttendance']);
    Route::get('/staff-activity', [\App\Http\Controllers\Reports\ReportsController::class, 'staffActivity']);
    Route::get('/staff-activity-details', [\App\Http\Controllers\Reports\ReportsController::class, 'staffActivityDetails']);
    Route::get('/staff-options', [\App\Http\Controllers\Reports\ReportsController::class, 'staffOptions']);
    Route::get('/staff-export', [\App\Http\Controllers\Reports\ReportsController::class, 'staffExport']);
});
