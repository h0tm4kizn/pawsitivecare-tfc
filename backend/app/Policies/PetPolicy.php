<?php

namespace App\Policies;

use App\Models\Appointment;
use App\Models\Owner;
use App\Models\Pet;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class PetPolicy
{
    /**
     * Determine whether the user can view any models.
     *
     * Purpose: All roles can browse the pet list.
     * Admin and staff see all pets in the system. Customers see only theirs,
     * which is filtered at the controller/query level — not blocked here.
     */
    public function viewAny(User $user): bool
    {
        return $user->canOperateFrontDesk() || $user->isCustomer();
    }

    /**
     * Determine whether the user can view the model.
     *
     * Purpose: Admin and staff can view any pet profile.
     * A customer can only view a pet that they own (matched by owner_id).
     */
    public function view(User $user, Pet $pet): bool
    {
        if ($user->canOperateFrontDesk()) {
            return true;
        }

        if ($user->isGroomer()) {
            return Appointment::query()->where('handled_by', $user->id)
                ->where('pet_id', $pet->id)
                ->whereNotIn('status', ['cancelled', 'completed', 'no_show', 'rejected'])
                ->whereHas('service', fn ($q) => $q->where('category', 'grooming'))
                ->exists();
        }

        return $this->customerOwnsPet($user, $pet);
    }

    /**
     * Determine whether the user can create models.
     *
     * Purpose: Only staff and admin can register a pet in the system.
     * This ensures pets are created with proper clinic oversight and validation.
     * Customers cannot self-register pets; staff handles onboarding.
     */
    public function create(User $user): bool
    {
        return $user->canOperateFrontDesk();
    }

    /**
     * Determine whether the user can update the model.
     *
     * Purpose: Only staff and admin can update pet records (e.g., add medical notes).
     * This ensures medical and assignment changes are tracked and controlled.
     * Customers can view but not modify their pet's record.
     */
    public function update(User $user, Pet $pet): bool
    {
        if ($user->canOperateFrontDesk()) return true;
        return $this->customerOwnsPet($user, $pet);
    }

    public function updateHealthForm(User $user, Pet $pet): bool
    {
        return $this->update($user, $pet) || $this->view($user, $pet);
    }

    private function customerOwnsPet(User $user, Pet $pet): bool
    {
        if (!$user->isCustomer()) {
            return false;
        }

        $ownerId = $user->owner?->id
            ?? Owner::where('email', $user->email)->value('id');

        return $ownerId !== null && (string) $pet->owner_id === (string) $ownerId;
    }

    /**
     * Determine whether the user can delete the model.
     *
     * Purpose: Only admin can delete a pet record.
     * Deleting a pet removes all linked data (medical history, appointments, nose prints),
     * so this is restricted to admin only to prevent accidental data loss.
     * Staff and customers cannot delete pet records.
     */
    public function delete(User $user, Pet $pet): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can restore the model.
     *
     * Purpose: Only admin can restore a soft-deleted pet record.
     */
    public function restore(User $user, Pet $pet): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can permanently delete the model.
     *
     * Purpose: Only admin can permanently remove a pet from the database.
     * This also clears linked nose print hashes and Supabase storage files,
     * so it is restricted to admin only.
     */
    public function forceDelete(User $user, Pet $pet): bool
    {
        return $user->isAdmin();
    }
}
