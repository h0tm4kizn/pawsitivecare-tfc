<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function changeOwnPassword(Request $request)
    {
        $data = $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|confirmed',
        ]);
        $user = $request->user();
        if (!$user || !Hash::check($data['current_password'], $user->password_hash)) {
            return $this->error('Current password is incorrect.', 422);
        }
        $user->update(['password_hash' => Hash::make($data['new_password'])]);
        return $this->success(null, 'Password changed successfully.');
    }

    /**
     * Admin dashboard: return paginated users with filters.
     * GET /admin/users?page=1&per_page=20&search=&role=
     */
    public function adminIndex(Request $request)
    {
        $this->authorize('viewAny', User::class);

        $query = User::latest();

        if ($request->filled('search')) {
            $term = $request->search;
            $query->where(function ($q) use ($term) {
                $q->where('name', 'ilike', '%' . $term . '%')
                  ->orWhere('email', 'ilike', '%' . $term . '%')
                  ->orWhere('role', 'ilike', '%' . $term . '%');
            });
        }

        if ($request->filled('role')) {
            $query->where('role', $request->role);
        }

        $perPage = min((int)$request->query('per_page', 20), 100);
        $paginated = $query->paginate($perPage);

        $users = $paginated->getCollection()->map(fn ($u) => [
            'id'         => $u->id,
            'name'       => $u->name,
            'email'      => $u->email,
            'phone'      => $u->phone ?? '',
            'role'       => $u->role,
            'staff_type' => $u->staff_type ?? null,
            'is_active'  => $u->is_active,
            'status'     => $u->is_active ? 'Active' : 'Inactive',
            'created_at' => $u->created_at,
        ]);

        return $this->success(
            $paginated->setCollection(collect($users)),
            'Users retrieved successfully.'
        );
    }

    /**
     * Create a new user account.
     * POST /admin/users
     */
    public function store(Request $request)
    {
        $this->authorize('create', User::class);

        $request->merge(['staff_type' => User::normalizeStaffType($request->input('staff_type'))]);
        $isGroomer = $request->input('role') === 'staff' && $request->input('staff_type') === User::STAFF_TYPE_GROOMER;

        $data = $request->validate([
            'first_name' => 'required|string|max:50',
            'last_name'  => 'required|string|max:50',
            'email'      => $isGroomer ? 'nullable|email|unique:users,email' : 'required|email|unique:users,email',
            'password'   => $isGroomer ? 'nullable|string|min:8' : 'required|string|min:8',
            'role'       => ['required', Rule::in(['admin', 'staff', 'customer'])],
            'staff_type' => ['required_if:role,staff', 'nullable', Rule::in([User::STAFF_TYPE_FRONT_DESK, User::STAFF_TYPE_GROOMER])],
            'is_active'  => 'boolean',
            'phone'      => [
                Rule::requiredIf(fn () => !($request->input('role') === 'staff' && $request->input('staff_type') === User::STAFF_TYPE_GROOMER)),
                'nullable',
                'string',
                'min:11',
                'max:13',
            ],
        ], [
            'first_name.required' => 'First name is required.',
            'last_name.required'  => 'Last name is required.',
            'email.required'      => 'Email is required.',
            'email.unique'        => 'This email is already registered.',
            'password.required'   => 'Password is required.',
            'password.min'        => 'Password must be at least 8 characters.',
            'role.required'       => 'Role is required.',
            'role.in'             => 'Role must be admin, staff, or customer.',
            'staff_type.required_if' => 'Staff type is required when role is staff.',
            'phone.required' => 'Phone number is required for Front Desk staff.',
            'phone.min'           => 'Phone number must be at least 11 characters.',
            'phone.max'           => 'Phone number must not exceed 13 characters.',
        ]);

        $name = trim($data['first_name'] . ' ' . $data['last_name']);

        // Field staff don't need login credentials, but password_hash is NOT NULL in DB
        // Generate a secure random password that will never be used
        $passwordHash = !empty($data['password']) 
            ? Hash::make($data['password']) 
            : Hash::make(bin2hex(random_bytes(32)));

        $user = User::create([
            'name'          => $name,
            'email'         => $data['email'] ?? null,
            'password_hash' => $passwordHash,
            'role'          => $data['role'],
            'staff_type'    => $data['staff_type'] ?? null,
            'is_active'     => $data['is_active'] ?? true,
            'phone'         => $data['phone'] ?? null,
        ]);

        Log::info('Admin user created', [
            'actor_id' => $request->user()?->id,
            'actor_email' => $request->user()?->email,
            'created_user_id' => $user->id,
            'created_user_email' => $user->email,
            'created_user_role' => $user->role,
            'created_user_staff_type' => $user->staff_type,
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return $this->success([
            'id'         => $user->id,
            'name'       => $user->name,
            'email'      => $user->email,
            'phone'      => $user->phone ?? '',
            'role'       => $user->role,
            'staff_type' => $user->staff_type ?? null,
            'is_active'  => $user->is_active,
            'status'     => $user->is_active ? 'Active' : 'Inactive',
            'created_at' => $user->created_at,
        ], 'User created successfully.', 201);
    }

    /**
     * Update a user account.
     * PUT /admin/users/{user}
     */
    public function update(Request $request, User $user)
    {
        $this->authorize('update', $user);

        $request->merge(['staff_type' => User::normalizeStaffType($request->input('staff_type'))]);
        $isGroomer = $request->input('role') === 'staff' && $request->input('staff_type') === User::STAFF_TYPE_GROOMER;

        $data = $request->validate([
            'first_name' => 'sometimes|string|max:50',
            'last_name'  => 'sometimes|string|max:50',
            'email'      => $isGroomer ? ['sometimes', 'nullable', 'email', Rule::unique('users', 'email')->ignore($user->id)] : ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'password'   => 'sometimes|nullable|string|min:8',
            'role'       => ['sometimes', Rule::in(['admin', 'staff', 'customer'])],
            'staff_type' => ['required_if:role,staff', 'nullable', Rule::in([User::STAFF_TYPE_FRONT_DESK, User::STAFF_TYPE_GROOMER])],
            'is_active'  => 'sometimes|boolean',
            'phone'      => ['sometimes', 'nullable', 'string', 'min:11', 'max:13'],
        ], [
            'email.unique'   => 'This email is already used by another account.',
            'password.min'   => 'Password must be at least 8 characters.',
            'role.in'        => 'Role must be admin, staff, or customer.',
            'staff_type.required_if' => 'Staff type is required when role is staff.',
            'phone.min'      => 'Phone number must be at least 11 characters.',
            'phone.max'      => 'Phone number must not exceed 13 characters.',
        ]);

        if (isset($data['first_name']) || isset($data['last_name'])) {
            $firstName = $data['first_name'] ?? explode(' ', $user->name)[0];
            $lastName = $data['last_name'] ?? implode(' ', array_slice(explode(' ', $user->name), 1));
            $data['name'] = trim($firstName . ' ' . $lastName);
        }
        unset($data['first_name'], $data['last_name']);

        if (!empty($data['password'])) {
            $data['password_hash'] = Hash::make($data['password']);
        }
        unset($data['password']);

        $user->update($data);

        return $this->success([
            'id'         => $user->id,
            'name'       => $user->name,
            'email'      => $user->email,
            'phone'      => $user->phone ?? '',
            'role'       => $user->role,
            'staff_type' => $user->staff_type ?? null,
            'is_active'  => $user->is_active,
            'status'     => $user->is_active ? 'Active' : 'Inactive',
            'created_at' => $user->created_at,
        ], 'User updated successfully.');
    }

    /**
     * Delete a user account.
     * DELETE /admin/users/{user}
     */
    public function destroy(User $user)
    {
        $this->authorize('delete', $user);
        $user->delete();
        return $this->success(null, 'User deleted successfully.');
    }
}
