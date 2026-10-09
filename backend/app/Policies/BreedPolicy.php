<?php

namespace App\Policies;

use App\Models\Breed;
use App\Models\User;

class BreedPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isStaff();
    }

    public function view(User $user, Breed $breed): bool
    {
        return $user->isAdmin() || $user->isStaff();
    }

    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    public function update(User $user, Breed $breed): bool
    {
        return $user->isAdmin();
    }

    public function delete(User $user, Breed $breed): bool
    {
        return $user->isAdmin();
    }
}
