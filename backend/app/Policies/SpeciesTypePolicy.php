<?php

namespace App\Policies;

use App\Models\SpeciesType;
use App\Models\User;

class SpeciesTypePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isStaff();
    }

    public function view(User $user, SpeciesType $speciesType): bool
    {
        return $user->isAdmin() || $user->isStaff();
    }

    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    public function update(User $user, SpeciesType $speciesType): bool
    {
        return $user->isAdmin();
    }

    public function delete(User $user, SpeciesType $speciesType): bool
    {
        return $user->isAdmin();
    }
}
