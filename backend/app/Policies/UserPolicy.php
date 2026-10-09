<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    /**
     * Determine whether the user can view any models.
     *
     * Purpose: Only admin can browse the full list of user accounts.
     * User records contain sensitive identity data (email, role, active status),
     * so this must never be exposed to staff or customers.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can view the model.
     *
     * Purpose: Only admin can view an individual user account.
     * This protects user identity data from being read by other roles.
     * Profile self-viewing is handled separately through the /api/me endpoint,
     * not through this policy.
     */
    public function view(User $user, User $model): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can create models.
     *
     * Purpose: Only admin can create user accounts directly.
     * Public registration (if allowed) bypasses this policy and is handled
     * by the AuthController. This method covers admin-initiated user creation.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can update the model.
     *
     * Purpose: Only admin can update any user account.
     * This includes changing roles, toggling active status, or correcting
     * account details. Self-profile updates are handled separately.
     */
    public function update(User $user, User $model): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can delete the model.
     *
     * Purpose: Only admin can deactivate or delete a user account.
     * Deleting a user has cascading impact on their pets, appointments,
     * and owner profile, so this must be admin-only.
     */
    public function delete(User $user, User $model): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can restore the model.
     *
     * Purpose: Only admin can restore a soft-deleted user account.
     * This allows recovery of accidentally deactivated accounts.
     */
    public function restore(User $user, User $model): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can permanently delete the model.
     *
     * Purpose: Only admin can permanently remove a user from the database.
     * This is the most destructive and irreversible action in the system —
     * it must be restricted to admin with no exceptions.
     */
    public function forceDelete(User $user, User $model): bool
    {
        return $user->isAdmin();
    }
}
