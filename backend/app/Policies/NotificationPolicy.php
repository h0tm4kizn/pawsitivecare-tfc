<?php

namespace App\Policies;

use App\Models\Notification;
use App\Models\User;

class NotificationPolicy
{
    /**
     * Determine whether the user can view any models.
     *
     * Purpose: All authenticated roles can access the notification list.
     * Admin and staff see all notifications in the system.
     * Customers see only their own — this filtering is applied at the
     * query/controller level, not blocked here at the policy level.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isStaff() || $user->isCustomer();
    }

    /**
     * Determine whether the user can view the model.
     *
     * Purpose: Admin and staff can view any notification.
     * Customers can only read a notification that was sent to them.
     * We compare the notification owner's linked user_id against the
     * authenticated user's ID to enforce ownership.
     */
    public function view(User $user, Notification $notification): bool
    {
        if ($user->isAdmin() || $user->isStaff()) {
            return true;
        }

        // Customer can only view a notification addressed to them
        return $user->isCustomer() && optional($notification->owner)->user_id === $user->id;
    }

    /**
     * Determine whether the user can create models.
     *
     * Purpose: Both admin and staff can send/create notifications to customers.
     * This covers system-generated alerts (e.g., appointment reminders,
     * status updates) that staff trigger on behalf of the clinic.
     * Customers do not create notifications themselves.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin() || $user->isStaff();
    }

    /**
     * Determine whether the user can update the model.
     *
     * Purpose: Admin and staff can update notification content or status
     * (e.g., mark as read/unread at the system level).
     * Customers cannot edit notification records.
     */
    public function update(User $user, Notification $notification): bool
    {
        if ($user->isAdmin() || $user->isStaff()) return true;
        // Customers can only mark their own notifications as read
        return $user->isCustomer() && optional($notification->owner)->user_id === $user->id;
    }

    /**
     * Determine whether the user can delete the model.
     *
     * Purpose: Only admin can delete a notification record.
     * Notifications serve as an audit trail of communication with the customer,
     * so deletion is restricted to admin only.
     */
    public function delete(User $user, Notification $notification): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can restore the model.
     *
     * Purpose: Only admin can restore a soft-deleted notification.
     */
    public function restore(User $user, Notification $notification): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can permanently delete the model.
     *
     * Purpose: Only admin can permanently remove a notification from the database.
     * This is irreversible and removes the communication record entirely.
     */
    public function forceDelete(User $user, Notification $notification): bool
    {
        return $user->isAdmin();
    }
}
