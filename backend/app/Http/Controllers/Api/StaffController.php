<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreStaffRequest;
use App\Http\Requests\UpdateStaffRequest;
use App\Models\User;
use App\Models\Appointment;
use App\Services\StaffAttendanceService;
use App\Services\StaffQrCredentialService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

class StaffController extends Controller
{
    public function __construct(private readonly StaffAttendanceService $attendanceService)
    {
    }

    public function qrCredentialForSelf(Request $request, StaffQrCredentialService $credentials)
    {
        $staff = $request->user();
        abort_unless($staff?->isStaff() && $staff->is_active, 403);
        if (blank($staff->display_id)) {
            return $this->error('A staff account with an assigned Staff ID is required.', 422);
        }

        return $this->success(['credential' => $credentials->issue($staff)], 'Staff QR credential retrieved.');
    }

    public function qrCredential(User $staff, StaffQrCredentialService $credentials)
    {
        abort_unless($staff->isStaff(), 404);
        if (blank($staff->display_id)) {
            return $this->error('A staff account with an assigned Staff ID is required.', 422);
        }

        return $this->success(['credential' => $credentials->issue($staff)], 'Staff QR credential retrieved.');
    }

    public function reissueQrCredential(User $staff, StaffQrCredentialService $credentials)
    {
        abort_unless($staff->isStaff(), 404);
        if (blank($staff->display_id)) {
            return $this->error('A staff account with an assigned Staff ID is required.', 422);
        }

        return $this->success(['credential' => $credentials->issue($staff, reissue: true)], 'Staff QR credential reissued.');
    }

    /**
     * List all staff users (paginated), optionally filtered by staff_type.
     * GET /admin/staff?page=1&per_page=20&type=front_desk|groomer&search=
     */
    public function index(Request $request)
    {
        abort_unless($request->user()?->isAdmin() || $request->user()?->isStaff(), 403);

        $type    = User::normalizeStaffType($request->query('type', '')) ?: '';
        $availability = $request->query('availability', '');
        $includeId = (string) $request->query('include_id', '');
        $search  = $request->query('search', '');
        $perPage = min((int) $request->query('per_page', 20), 100);
        $page    = (int) $request->query('page', 1);

        $cacheKey = 'staff:list:' . self::staffVersion() . ':' . md5($type . ':' . $availability . ':' . $includeId . ':' . $search . ':' . $page . ':' . $perPage);
        $result   = Cache::remember($cacheKey, 60, function () use ($type, $availability, $includeId, $search, $perPage, $page, $request) {
            $query = User::where('role', 'staff')
                ->whereIn('staff_type', [User::STAFF_TYPE_FRONT_DESK, User::STAFF_TYPE_GROOMER])
                ->latest();

            if ($type !== '') {
                $query->where('staff_type', $type);
            }

            if ($search !== '') {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'ilike', '%' . $search . '%')
                      ->orWhere('email', 'ilike', '%' . $search . '%')
                      ->orWhere('display_id', 'ilike', '%' . $search . '%');
                });
            }

            if ($availability === 'on_duty') {
                $staff = $query->get()
                    ->filter(fn (User $user) => (string) $user->id === $includeId || $this->attendanceService->isCurrentlyOnDuty($user))
                    ->values();
                $paginated = new \Illuminate\Pagination\LengthAwarePaginator(
                    $staff->forPage($page, $perPage)->values(),
                    $staff->count(),
                    $perPage,
                    $page,
                    ['path' => $request->url(), 'query' => $request->query()]
                );
            } else {
                $paginated = $query->paginate($perPage);
            }
            $staff     = $paginated->getCollection()->map(fn ($u) => $this->format($u));
            return $paginated->setCollection(collect($staff));
        });

        return $this->success($result, 'Staff retrieved successfully.');
    }

    /**
     * Show a single staff member.
     * GET /admin/staff/{staff}
     */
    public function show(User $staff)
    {
        $this->authorize('view', $staff);

        if ($staff->role !== 'staff') {
            return $this->error('User is not a staff member.', 404);
        }

        return $this->success($this->format($staff), 'Staff retrieved successfully.');
    }

    /**
     * Create a new staff account.
     * POST /admin/staff
     */
    public function store(StoreStaffRequest $request)
    {
        $this->authorize('create', User::class);

        $staff = User::create([
            'name'          => $request->name,
            'email'         => $request->email,
            'password_hash' => Hash::make($request->password ?: bin2hex(random_bytes(32))),
            'role'          => 'staff',
            'staff_type'    => $request->staff_type,
            'is_active'     => $request->boolean('is_active', true),
            'phone'         => $request->contact_number,
        ]);

        Log::info('Admin staff created', [
            'actor_id' => $request->user()?->id,
            'actor_email' => $request->user()?->email,
            'staff_id' => $staff->id,
            'staff_email' => $staff->email,
            'staff_type' => $staff->staff_type,
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        self::touchStaffVersion();
        return $this->success($this->format($staff), 'Staff account created successfully.', 201);
    }

    /**
     * Update an existing staff account.
     * PUT /admin/staff/{staff}
     */
    public function update(UpdateStaffRequest $request, User $staff)
    {
        $this->authorize('update', $staff);

        if ($staff->role !== 'staff') {
            return $this->error('User is not a staff member.', 422);
        }

        $data = $request->validated();

        if (!empty($data['password'])) {
            $data['password_hash'] = Hash::make($data['password']);
        }
        unset($data['password']);

        if (array_key_exists('contact_number', $data)) {
            $data['phone'] = $data['contact_number'];
            unset($data['contact_number']);
        }

        $staff->update($data);

        self::touchStaffVersion();
        return $this->success($this->format($staff->fresh()), 'Staff account updated successfully.');
    }

    /**
     * Delete a staff account.
     * DELETE /admin/staff/{staff}
     */
    public function destroy(Request $request, User $staff)
    {
        $this->authorize('delete', $staff);

        if ($staff->role !== 'staff') {
            return $this->error('User is not a staff member.', 422);
        }

        // Prevent deletion if staff has handled appointment history.
        $hasHandledAppointments = Appointment::where('handled_by', $staff->id)->exists();

        if ($hasHandledAppointments) {
            return $this->error('Cannot delete staff with appointment history. Consider deactivating the account instead.', 422);
        }

        // Record deletion reason if provided, then delete
        if ($request->filled('deletion_reason')) {
            $staff->deletion_reason = trim((string) $request->input('deletion_reason')) ?: null;
            $staff->save();
        }

        $staff->delete();

        self::touchStaffVersion();
        return $this->success(null, 'Staff account deleted successfully.');
    }

    private static function staffVersion(): int
    {
        return (int) Cache::get('staff:version', 0);
    }

    private static function touchStaffVersion(): void
    {
        Cache::put('staff:version', now()->timestamp, 3600);
    }

    private function format(User $u): array
    {
        return [
            'id'             => $u->id,
            'display_id'     => $u->display_id,
            'name'           => $u->name,
            'email'          => $u->email,
            'role'           => $u->role,
            'staff_type'     => $u->staff_type,
            'contact_number' => $u->phone,
            'is_active'      => $u->is_active,
            'status'         => $u->is_active ? 'Active' : 'Inactive',
            'deactivation_reason' => $u->deactivation_reason,
            'deletion_reason'     => $u->deletion_reason,
            'created_at'     => $u->created_at,
        ];
    }
}
