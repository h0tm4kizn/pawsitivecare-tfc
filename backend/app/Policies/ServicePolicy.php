<?php

namespace App\Policies;

use App\Models\Service;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class ServicePolicy
{
    /**
     * Determine whether the user can view any models.
     *
     * Purpose: All authenticated roles can browse the list of available services.
     * Customers need to see services so they can choose one when booking an appointment.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isStaff() || $user->isCustomer();
    }

    /**
     * Determine whether the user can view the model.
     *
     * Purpose: All roles can view the details of a specific service.
     * Services are not private — any authenticated user can read service info
     * (name, price, duration) to support the booking process.
     */
    public function view(User $user, Service $service): bool
    {
        return $user->isAdmin() || $user->isStaff() || $user->isCustomer();
    }

    /**
     * Determine whether the user can create models.
     *
     * Purpose: Only admin can add new services to the system.
     * Services are clinic offerings managed internally — customers cannot create them.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can update the model.
     *
     * Purpose: Only admin can edit service details such as price,
     * description, or duration. Customers cannot modify service offerings.
     */
    public function update(User $user, Service $service): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can delete the model.
     *
     * Purpose: Only admin can remove a service from the system.
     * Deleting a service can affect existing appointments linked to it,
     * so this is restricted to admin for safety.
     */
    public function delete(User $user, Service $service): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can restore the model.
     *
     * Purpose: Only admin can bring back a soft-deleted service.
     */
    public function restore(User $user, Service $service): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can permanently delete the model.
     *
     * Purpose: Only admin can permanently wipe a service record.
     * This is irreversible and should only be done when a service is
     * fully retired with no linked appointment history.
     */
    public function forceDelete(User $user, Service $service): bool
    {
        return $user->isAdmin();
    }
}
