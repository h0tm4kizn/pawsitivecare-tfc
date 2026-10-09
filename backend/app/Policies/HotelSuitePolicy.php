<?php

namespace App\Policies;

use App\Models\HotelSuite;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class HotelSuitePolicy
{
    /**
     * Determine whether the user can view any models.
     *
     * Purpose: All authenticated roles can view the list of hotel suites.
     * Customers need this to browse available boarding options before booking.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isStaff() || $user->isCustomer();
    }

    /**
     * Determine whether the user can view the model.
     *
     * Purpose: All roles can view the details of a specific hotel suite.
     * Suite details (room type, capacity, price) are not private and are
     * needed by customers during the boarding appointment booking process.
     */
    public function view(User $user, HotelSuite $hotelSuite): bool
    {
        return $user->isAdmin() || $user->isStaff() || $user->isCustomer();
    }

    /**
     * Determine whether the user can create models.
     *
     * Purpose: Only admin can add new hotel suite records.
     * Suite setup is an internal clinic operation that customers have no
     * business reason to perform.
     */
    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can update the model.
     *
     * Purpose: Only admin can update suite details such as availability,
     * room description, or pricing. Customers cannot edit suite records.
     */
    public function update(User $user, HotelSuite $hotelSuite): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can delete the model.
     *
     * Purpose: Only admin can delete a hotel suite.
     * Removing a suite may affect active or future bookings linked to it,
     * so this action is restricted to admin only.
     */
    public function delete(User $user, HotelSuite $hotelSuite): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can restore the model.
     *
     * Purpose: Only admin can restore a soft-deleted hotel suite record.
     */
    public function restore(User $user, HotelSuite $hotelSuite): bool
    {
        return $user->isAdmin();
    }

    /**
     * Determine whether the user can permanently delete the model.
     *
     * Purpose: Only admin can permanently remove a hotel suite from the database.
     * This is irreversible and should only happen after confirming no
     * active or historical bookings are linked to that suite.
     */
    public function forceDelete(User $user, HotelSuite $hotelSuite): bool
    {
        return $user->isAdmin();
    }
}
