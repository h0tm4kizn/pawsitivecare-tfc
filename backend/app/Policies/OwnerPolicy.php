<?php

namespace App\Policies;

use App\Models\Owner;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class OwnerPolicy
{
    /**
     * Determine whether the user can view any models.
     *
     * Purpose: Only admin and staff can view the full list of owners.
     * Customers cannot browse other owners' profiles — they only access their own
     * record, which is handled by the view() ownership check below.
     */
    public function viewAny(User $user): bool
    {
        return $user->canOperateFrontDesk();
    }

    /**
     * Determine whether the user can view the model.
     *
     * Purpose: Admin and staff can view any owner profile.
     * A customer can only view the owner record that is linked to their own user account.
     * We compare owner.user_id against the authenticated user's ID for ownership.
     */
    public function view(User $user, Owner $owner): bool
    {
        if ($user->canOperateFrontDesk()) {
            return true;
        }

        // Customer can only view their own owner profile
        return $user->isCustomer() && $owner->user_id === $user->id;
    }

    /**
     * Determine whether the user can create models.
     *
     * Purpose: Owner profiles are created by admin or staff during customer onboarding.
     * Customers do not create owner records directly — that is handled by the system
     * or staff during registration/setup.
     */
    public function create(User $user): bool
    {
        return $user->canOperateFrontDesk();
    }

    /**
     * Determine whether the user can update the model.
     *
     * Purpose: Admin and staff can update any owner profile.
     * A customer can also update their own profile (e.g., contact info, address).
     */
    public function update(User $user, Owner $owner): bool
    {
        if ($user->canOperateFrontDesk()) {
            return true;
        }

        // Customer can edit only their own owner profile
        return $user->isCustomer() && $owner->user_id === $user->id;
    }

    /**
     * Determine whether the user can delete the model.
     *
     * Purpose: Only admin can delete an owner record.
     * Deleting an owner has cascading impact on linked pets and appointments,
     * so this is restricted to admin only to prevent accidental data loss.
     */
    public function delete(User $user, Owner $owner): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can restore the model.
     *
     * Purpose: Only admin can restore a soft-deleted owner record.
     */
    public function restore(User $user, Owner $owner): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can permanently delete the model.
     *
     * Purpose: Only admin can permanently remove an owner and their linked data.
     * This is the most destructive action and must be restricted to admin only.
     */
    public function forceDelete(User $user, Owner $owner): bool
    {
        return $user->isAdmin();
    }
}
