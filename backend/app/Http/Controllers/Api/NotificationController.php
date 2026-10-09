<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreNotificationRequest;
use App\Models\Notification;
use App\Models\Owner;
use App\Support\CustomerAppointmentFormatter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class NotificationController extends Controller
{

    // List notifications (paginated).
    // Admin/staff: all notifications. Customer: only own notifications.
    // GET /notifications?page=1&per_page=20
    // OPTIMIZED: Column selection in eager loads for faster data transfer
    public function index(Request $request)
    {
        $this->authorize('viewAny', Notification::class);

        $user = $request->user();
        $perPage = min((int)$request->query('per_page', 20), 100);

        if ($user->isAdmin() || $user->isStaff()) {
            $notifications = Notification::select('id', 'owner_id', 'type', 'channel', 'status', 'subject', 'message', 'metadata', 'appointment_id', 'is_read', 'read_at', 'sent_at', 'created_at', 'updated_at')
                ->with('owner:id,first_name,last_name,email')
                ->latest('created_at')
                ->paginate($perPage);

            return $this->success($notifications, 'Notifications retrieved successfully');
        }

        $owner = Owner::where('user_id', $user->id)->first();

        if (! $owner) {
            return $this->error('Owner profile not found', 404);
        }

        $notifications = Notification::select('id', 'owner_id', 'type', 'channel', 'status', 'subject', 'message', 'metadata', 'appointment_id', 'is_read', 'read_at', 'sent_at', 'created_at', 'updated_at')
            ->with('owner:id,first_name,last_name,email')
            ->where('owner_id', $owner->id)
            ->latest('created_at')
            ->paginate($perPage);

        $notifications->getCollection()->transform(function (Notification $notification) {
            $notification->message = CustomerAppointmentFormatter::notificationMessage($notification->message);
            return $notification;
        });

        return $this->success($notifications, 'Notifications retrieved successfully');
    }

    // View one notification.
    public function show(Notification $notification)
    {
        $this->authorize('view', $notification);

        return $this->success(
            $notification->load('owner'),
            'Notification retrieved successfully'
        );
    }

    // List notifications tied to an appointment.
    public function byAppointment(Request $request, string $appointmentId)
    {
        $this->authorize('viewAny', Notification::class);

        if (! Schema::hasColumn('notifications', 'appointment_id')) {
            return $this->error(
                'Appointment notification linkage is not available yet. Add appointment_id on notifications first.',
                422
            );
        }

        $query = Notification::with('owner')
            ->where('appointment_id', $appointmentId)
            ->latest('created_at');

        $user = $request->user();

        if ($user->isCustomer()) {
            $owner = Owner::where('user_id', $user->id)->first();

            if (! $owner) {
                return $this->error('Owner profile not found', 404);
            }

            $query->where('owner_id', $owner->id);
        }

        // Validate appointment existence only when appointment table exists.
        if (Schema::hasTable('appointments')) {
            $exists = DB::table('appointments')->where('id', $appointmentId)->exists();

            if (! $exists) {
                return $this->error('Appointment not found', 404);
            }
        }

        $notifications = $query->get()->map(function (Notification $notification) use ($user) {
            if ($user->isCustomer()) {
                $notification->message = CustomerAppointmentFormatter::notificationMessage($notification->message);
            }
            return $notification;
        });

        return $this->success(
            $notifications,
            'Appointment notifications retrieved successfully'
        );
    }

    // Create one notification record.
    // Prevent double-send for the same owner/type/channel when already pending or sent.
    public function store(StoreNotificationRequest $request)
    {
        $this->authorize('create', Notification::class);

        $validated = $request->validated();


        $normalizedChannel = $validated['channel'];

        $isDuplicate = Notification::where('owner_id', $validated['owner_id'])
            ->where('appointment_id', $validated['appointment_id'])
            ->where('channel', $normalizedChannel)
            ->whereIn('status', ['pending', 'sent'])
            ->exists();

        if ($isDuplicate) {
            return $this->error(
                'Duplicate notification blocked: same owner, type, and channel is already pending or sent.',
                409
            );
        }

        $notification = Notification::create([
            'owner_id'       => $validated['owner_id'],
            'appointment_id' => $validated['appointment_id'],
            'message'        => $validated['message'],
            'channel'        => $validated['channel'],
            'type'           => $validated['type'],
            'status'         => 'pending', // always starts as pending
            'is_read'        => $validated['is_read'] ?? false,
            'read_at'        => $validated['read_at'] ?? null,
            'sent_at'        => $validated['sent_at'] ?? null,
        ]);
        return $this->success(
            $notification->load('owner'),
            'Notification created successfully',
            201
        );
    }

    // Update existing notification.
    public function update(Request $request, Notification $notification)
    {
        $this->authorize('update', $notification);

        $validated = $request->validate([
            'message' => 'sometimes|string',
            'channel' => 'sometimes|in:phone,email',
            'type'    => 'sometimes|string',
            'status'  => 'sometimes|in:pending,sent,failed',
            'is_read' => 'sometimes|boolean',
            'read_at' => 'nullable|date',
            'sent_at' => 'nullable|date',
        ]);

        if (array_key_exists('is_read', $validated) && $validated['is_read'] && ! array_key_exists('read_at', $validated) && ! $notification->read_at) {
            $validated['read_at'] = now();
        }

        if (array_key_exists('status', $validated) && $validated['status'] === 'sent' && ! array_key_exists('sent_at', $validated) && ! $notification->sent_at) {
            $validated['sent_at'] = now();
        }

        $notification->update($validated);

        return $this->success(
            $notification->load('owner'),
            'Notification updated successfully'
        );
    }

    // Delete notification.
    public function destroy(Notification $notification)
    {
        $this->authorize('delete', $notification);

        $notification->delete();

        return $this->success(null, 'Notification deleted successfully');
    }
}
