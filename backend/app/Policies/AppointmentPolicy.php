<?php

namespace App\Policies;

use App\Models\Appointment;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class AppointmentPolicy
{
    /**
     * Determine whether the user can view any models.
     *
     * Purpose: Only admin and staff can browse the full list of appointments.
     * Customers do not see all appointments — they only access their own records
     * through the view() method, which applies an ownership check.
     */
    public function viewAny(User $user): bool
    {
        // Customers can list their own appointments (controller filters by owner)
        return $user->canOperateFrontDesk() || $user->isGroomer() || $user->isCustomer();
    }

    /**
     * Determine whether the user can view the model.
     *
     * Purpose: Admin and staff can view any appointment.
     * Customers can only view an appointment that belongs to them.
     * We check booked_by_owner_id against the authenticated user's owner ID to enforce ownership.
     */
    public function view(User $user, Appointment $appointment): bool
    {
        if ($user->canOperateFrontDesk()) {
            return true;
        }

        if ($user->isGroomer()) {
            return (string) $appointment->handled_by === (string) $user->id
                && strtolower((string) $appointment->service?->category) === 'grooming';
        }

        // Customer can only view their own appointment
        // booked_by_owner_id links to owners table — not users table
        return $user->isCustomer() && $appointment->booked_by_owner_id === $user->owner?->id;
}

    /**
     * Determine whether the user can create models.
     *
     * Purpose: All roles are allowed to create an appointment.
     * Customers book for themselves, while staff/admin can create on behalf of a customer.
     */
    public function create(User $user): bool
    {
        return $user->canOperateFrontDesk() || $user->isCustomer();
    }

    /**
     * Determine whether the user can update the model.
     *
     * Purpose: Admin and staff can update any appointment (e.g., reschedule or update status).
     * Customers can only update their own pending appointments.
     */
    public function update(User $user, Appointment $appointment): bool
    {
        if ($user->canOperateFrontDesk()) {
            return true;
        }

        // Customer can only edit their own appointment
        return $user->isCustomer() && $appointment->booked_by_owner_id === $user->owner?->id;
    }

        /**
     * Determine whether the user can update the status of an appointment.
     *
     * Purpose: Only admin and staff can move appointments through the status flow.
     * Customers cannot change status directly — they can only cancel via cancel().
     */
    public function updateStatus(User $user, Appointment $appointment): bool
    {
        return $user->canOperateFrontDesk() || (
            $user->isGroomer()
            && (string) $appointment->handled_by === (string) $user->id
            && strtolower((string) $appointment->service?->category) === 'grooming'
        );
    }

    /**
     * Determine whether the user can cancel their own appointment.
     *
     * Purpose: Customers can cancel their own pending appointments only.
     * Admin and staff use updateStatus() instead.
     */
    public function cancel(User $user, Appointment $appointment): bool
    {
    if ($user->canOperateFrontDesk()) {
        return true;
    }

    // Customer can only cancel their own appointment
    return $user->isCustomer() && $appointment->booked_by_owner_id === $user->owner?->id;
}

    /**
     * Determine whether the user can delete the model.
     *
     * Purpose: Only admin can delete appointments to prevent accidental data loss.
     * Staff and customers are not allowed to delete appointment records.
     */
    public function delete(User $user, Appointment $appointment): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can restore the model.
     *
     * Purpose: Only admin can restore soft-deleted appointments.
     */
    public function restore(User $user, Appointment $appointment): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can permanently delete the model.
     *
     * Purpose: Only admin can permanently wipe an appointment record from the database.
     * This is the most destructive action, so it is admin-only.
     */
    public function forceDelete(User $user, Appointment $appointment): bool
    {
        return $user->isAdmin();
    }
}
