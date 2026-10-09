<?php

namespace App\Policies;

use App\Models\ServiceAddon;
use App\Models\User;

class ServiceAddonPolicy
{
    /**
     * Determine whether the user can view any models.
     *
     * Purpose: All authenticated roles can browse the list of service add-ons.
     * Customers need to see available add-ons (e.g., extra grooming, nail trim)
     * so they can include them when booking an appointment.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isStaff() || $user->isCustomer();
    }

    /**
     * Determine whether the user can view the model.
     *
     * Purpose: All roles can view the details of a specific add-on.
     * Add-on details (name, price, description) are not private — any
     * authenticated user needs to read them during the booking process.
     */
    public function view(User $user, ServiceAddon $serviceAddon): bool
    {
        return $user->isAdmin() || $user->isStaff() || $user->isCustomer();
    }

    /**
     * Determine whether the user can create models.
     *
     * Purpose: Only admin can add new service add-ons to the system.
     * Add-ons are clinic offerings managed internally — customers cannot
     * define or create them.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can update the model.
     *
     * Purpose: Only admin can edit add-on details such as price
     * or description. Customers have no business reason to modify add-ons.
     */
    public function update(User $user, ServiceAddon $serviceAddon): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can delete the model.
     *
     * Purpose: Only admin can delete a service add-on.
     * Removing an add-on may affect existing appointments that include it,
     * so this is restricted to admin to prevent data integrity issues.
     */
    public function delete(User $user, ServiceAddon $serviceAddon): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can restore the model.
     *
     * Purpose: Only admin can restore a soft-deleted service add-on record.
     */
    public function restore(User $user, ServiceAddon $serviceAddon): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can permanently delete the model.
     *
     * Purpose: Only admin can permanently remove an add-on from the database.
     * This is irreversible and should only be done after confirming no
     * active appointments are still referencing this add-on.
     */
    public function forceDelete(User $user, ServiceAddon $serviceAddon): bool
    {
        return $user->isAdmin();
    }
}
