<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Crypt;
use App\Mail\OtpMail;
use App\Mail\PasswordChangedMail;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Validator;

class AuthController extends Controller
{
    // Login — returns Sanctum token on success.
    // Accepts a single `identifier` field: email (contains @) or phone (09XXXXXXXXX).
    // Accepts optional remember_me boolean to signal the frontend whether to persist the session.
    // Uses a generic failure message on both bad identifier and bad password to prevent enumeration.
    // Public route — no auth required.
    public function login(Request $request)
    {
        $loginPerfTraceId = (string) Str::uuid();
        $loginPerfStart = microtime(true);
        $loginPerfMark = $loginPerfStart;
        $loginPerfLog = function (string $stage, array $extra = []) use (&$loginPerfMark, $loginPerfStart, $loginPerfTraceId, $request) {
            $now = microtime(true);
            \Log::info('auth.login.perf', array_merge([
                'trace_id' => $loginPerfTraceId,
                'stage' => $stage,
                'delta_ms' => (int) round(($now - $loginPerfMark) * 1000),
                'elapsed_ms' => (int) round(($now - $loginPerfStart) * 1000),
                'ip' => (string) $request->ip(),
            ], $extra));
            $loginPerfMark = $now;
        };

        $request->validate([
            'identifier'  => 'required|string|max:150',
            'password'    => 'required|string',
            'remember_me' => 'sometimes|boolean',
            'otp_challenge_id' => 'nullable|uuid',
            'otp_code' => 'nullable|string|max:10',
            'otp_method' => 'nullable|in:email,authenticator,recovery_code',
            'recovery_code' => 'nullable|string|max:64',
            'device_id' => 'nullable|string|max:120',
            'trust_device' => 'sometimes|boolean',
        ]);

        $identifier = $request->input('identifier');
        $isEmail    = str_contains($identifier, '@');

        if ($isEmail) {
            $user = User::where('email', strtolower(trim($identifier)))
                        ->where('is_active', true)
                        ->first();
        } else {
            // Sanitize phone: strip non-digits, normalize +63/63 prefix → 09XXXXXXXXX.
            $digits = preg_replace('/\D+/', '', $identifier);
            if (str_starts_with($digits, '63')) {
                $digits = substr($digits, 2);
            }
            if ($digits !== '' && !str_starts_with($digits, '0')) {
                $digits = '0' . $digits;
            }
            $phone = substr($digits, 0, 11);

            $user = User::where('phone', $phone)
                        ->where('is_active', true)
                        ->first();
        }
        $loginPerfLog('user_lookup_done', [
            'identifier_type' => $isEmail ? 'email' : 'phone',
            'user_found' => (bool) $user,
        ]);

        // Generic message for both not-found and wrong password — prevents account enumeration.
        $genericError = 'Invalid credentials. Please check your login details and try again.';

        if (!$user || !Hash::check($request->password, $user->password_hash)) {
            $loginPerfLog('password_check_failed', ['user_found' => (bool) $user]);
            $this->logOtpEvent(null, 'login_credentials_invalid', 'denied', null, (string) $request->ip(), (string) $request->userAgent(), [
                'identifier_hash' => hash('sha256', strtolower(trim((string) $request->input('identifier', '')))),
            ]);
            return $this->error($genericError, 401);
        }

        if ($user->isCustomer() && !$user->email_verified_at) {
            return $this->error('Please verify your email before signing in.', 403, [
                'requires_verification' => true,
            ]);
        }
        $loginPerfLog('password_check_passed', [
            'user_id' => $user->id,
            'role' => $user->role,
            'staff_type' => $user->staff_type,
        ]);

        // Customer/Admin OTP challenge before issuing token.
        // Also applies to Front Desk staff only (Groomers excluded).
        // Supports email OTP, authenticator, and recovery codes with optional 30-day trusted device bypass.
        // OTP is disabled in offline/demo mode (SQLite) — email delivery is unavailable without internet.
        $loginOtpEnabled = filter_var(env('LOGIN_OTP_ENABLED', false), FILTER_VALIDATE_BOOLEAN);
        $requiresOtp = $loginOtpEnabled && config('database.default') !== 'sqlite' && (
            $user->isCustomer()

            // Temporarily disabled for admin-side login.
            // Restore these lines when admin/staff OTP should be required again:
            // || $user->isAdmin()
        );
        if ($requiresOtp) {
            $deviceId = trim((string) $request->input('device_id', ''));
            $trustDevice = $request->boolean('trust_device', false);
            $isTrustedDevice = $this->isTrustedDevice($user->id, $deviceId);
            $challengeId = $request->input('otp_challenge_id');
            $otpCode = preg_replace('/\D+/', '', (string) $request->input('otp_code', ''));
            $otpMethod = $request->input('otp_method', 'email');
            $recoveryCode = strtoupper(preg_replace('/[^A-Z0-9]/', '', (string) $request->input('recovery_code', '')));
            $totpEnabled = (bool) ($user->totp_enabled ?? false);
            $canUseAuthenticator = $totpEnabled && !empty($user->totp_secret);
            $isInitialOtpRequest =
                ($otpMethod === 'email' && (!$challengeId || $otpCode === '')) ||
                ($otpMethod === 'authenticator' && $otpCode === '') ||
                ($otpMethod === 'recovery_code' && $recoveryCode === '');

            if (!$isTrustedDevice && $isInitialOtpRequest) {
                if ($otpMethod === 'authenticator') {
                    if (!$canUseAuthenticator) {
                        throw ValidationException::withMessages([
                            'otp_code' => ['Authenticator is not enabled for this account. Use email OTP or enable authenticator in account security settings.'],
                        ]);
                    }
                    return response()->json([
                        'requires_otp' => true,
                        'otp_method' => 'authenticator',
                        'message' => 'Enter the 6-digit code from your authenticator app.',
                        'data' => [
                            'challenge_id' => null,
                            'expires_in' => 30,
                        ],
                    ], 202);
                }
                if ($otpMethod === 'recovery_code') {
                    if ($recoveryCode === '') {
                        return response()->json([
                            'requires_otp' => true,
                            'otp_method' => 'recovery_code',
                            'message' => 'Enter one of your recovery codes.',
                            'data' => [
                                'challenge_id' => null,
                                'expires_in' => 300,
                            ],
                        ], 202);
                    }
                }

                if (empty($user->email)) {
                    throw ValidationException::withMessages([
                        'otp_code' => ['Email OTP is unavailable for this account. Use authenticator or contact support.'],
                    ]);
                }

                $challengeId = (string) Str::uuid();
                $otpPlain = $this->generateOtpCode();
                $now = now('Asia/Manila');

                // Invalidate old unused challenges for this user/device before issuing a new one.
                DB::table('login_otp_challenges')
                    ->where('user_id', $user->id)
                    ->when($deviceId !== '', fn($q) => $q->where('device_id', $deviceId))
                    ->delete();

                DB::table('login_otp_challenges')->insert([
                    'id' => $challengeId,
                    'user_id' => $user->id,
                    'device_id' => $deviceId !== '' ? $deviceId : null,
                    'code_hash' => Hash::make($otpPlain),
                    'attempts' => 0,
                    'max_attempts' => 5,
                    'resend_count' => 0,
                    'max_resends' => 5,
                    'last_sent_at' => $now,
                    'expires_at' => $now->copy()->addMinutes(5),
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $this->sendLoginOtp($user->email, $otpPlain);
                $loginPerfLog('otp_challenge_created_and_dispatched', [
                    'otp_method' => 'email',
                    'trusted_device' => false,
                ]);
                $this->logOtpEvent($user->id, 'otp_challenge_issued', 'success', $challengeId, (string) $request->ip(), (string) $request->userAgent(), [
                    'device_id' => $deviceId !== '' ? $deviceId : null,
                ]);

                return response()->json([
                    'requires_otp' => true,
                    'otp_method' => 'email',
                    'message' => 'We need to verify it\'s you.',
                    'data' => [
                        'challenge_id' => $challengeId,
                        'expires_in' => 300,
                    ],
                ], 202);
            }

            if (!$isTrustedDevice) {
                if ($otpMethod === 'authenticator') {
                    if ($challengeId) {
                        throw ValidationException::withMessages([
                            'otp_code' => ['Invalid OTP session for authenticator verification.'],
                        ]);
                    }
                    if (!$canUseAuthenticator) {
                        throw ValidationException::withMessages([
                            'otp_code' => ['Authenticator is not set up for this account yet.'],
                        ]);
                    }

                    $secret = Crypt::decryptString((string) $user->totp_secret);
                    if (!$this->verifyTotpCode($secret, $otpCode, 1)) {
                        throw ValidationException::withMessages([
                            'otp_code' => ['Invalid authenticator code. Please try again.'],
                        ]);
                    }
                } elseif ($otpMethod === 'recovery_code') {
                    if ($challengeId) {
                        throw ValidationException::withMessages([
                            'recovery_code' => ['Invalid OTP session for recovery code verification.'],
                        ]);
                    }
                    if ($recoveryCode === '') {
                        throw ValidationException::withMessages([
                            'recovery_code' => ['Recovery code is required.'],
                        ]);
                    }
                    if (!$this->consumeRecoveryCode($user, $recoveryCode)) {
                        throw ValidationException::withMessages([
                            'recovery_code' => ['Invalid recovery code.'],
                        ]);
                    }
                } else {
                if (!$challengeId) {
                    throw ValidationException::withMessages([
                        'otp_code' => ['OTP session is required. Please log in again.'],
                    ]);
                }
                $challenge = DB::table('login_otp_challenges')
                    ->where('id', $challengeId)
                    ->where('user_id', $user->id)
                    ->first();

                if (!$challenge) {
                    $this->logOtpEvent($user->id, 'otp_verify_invalid_session', 'denied', $challengeId, (string) $request->ip(), (string) $request->userAgent());
                    throw ValidationException::withMessages([
                        'otp_code' => ['OTP session is invalid. Please try logging in again.'],
                    ]);
                }

                if (!empty($challenge->device_id) && $challenge->device_id !== $deviceId) {
                    $this->logOtpEvent($user->id, 'otp_verify_session_mismatch', 'denied', $challengeId, (string) $request->ip(), (string) $request->userAgent());
                    throw ValidationException::withMessages([
                        'otp_code' => ['OTP session mismatch. Please log in again.'],
                    ]);
                }

                if ((int) $challenge->attempts >= (int) $challenge->max_attempts) {
                    DB::table('login_otp_challenges')->where('id', $challengeId)->delete();
                    $this->logOtpEvent($user->id, 'otp_verify_attempt_limit', 'denied', $challengeId, (string) $request->ip(), (string) $request->userAgent());
                    throw ValidationException::withMessages([
                        'otp_code' => ['Too many OTP attempts. Please log in again.'],
                    ]);
                }

                if (now('Asia/Manila')->greaterThan($challenge->expires_at)) {
                    DB::table('login_otp_challenges')->where('id', $challengeId)->delete();
                    $this->logOtpEvent($user->id, 'otp_verify_expired', 'denied', $challengeId, (string) $request->ip(), (string) $request->userAgent());
                    throw ValidationException::withMessages([
                        'otp_code' => ['OTP expired. Please log in again.'],
                    ]);
                }

                if (!Hash::check($otpCode, $challenge->code_hash)) {
                    DB::table('login_otp_challenges')
                        ->where('id', $challengeId)
                        ->update([
                            'attempts' => ((int) $challenge->attempts) + 1,
                            'updated_at' => now('Asia/Manila'),
                        ]);
                    $this->logOtpEvent($user->id, 'otp_verify_invalid_code', 'denied', $challengeId, (string) $request->ip(), (string) $request->userAgent());

                    throw ValidationException::withMessages([
                        'otp_code' => ['Invalid OTP code. Please try again.'],
                    ]);
                }

                // One-time use OTP.
                DB::table('login_otp_challenges')->where('id', $challengeId)->delete();
                $this->logOtpEvent($user->id, 'otp_verify_success', 'success', $challengeId, (string) $request->ip(), (string) $request->userAgent());
                }
            }

            // Trust device only when user chooses and device id exists.
            if ($trustDevice && $deviceId !== '') {
                $this->trustDevice($user->id, $deviceId, (string) $request->userAgent(), (string) $request->ip());
                $this->logOtpEvent($user->id, 'device_trusted', 'success', null, (string) $request->ip(), (string) $request->userAgent(), [
                    'device_id' => $deviceId,
                ]);
            }
        }

        $tokenName = $request->boolean('remember_me') ? 'remember-token' : 'auth-token';
        $token     = $user->createToken($tokenName)->plainTextToken;
        $loginPerfLog('token_issued', ['token_name' => $tokenName]);

        return $this->success([
            'token'       => $token,
            'remember_me' => $request->boolean('remember_me'),
            'user'        => [
                'id'         => $user->id,
                'display_id' => $user->display_id,
                'name'       => $user->name,
                'email'      => $user->email,
                'phone'      => $user->phone,
                'role'       => $user->role,
                'staff_type' => $user->staff_type,
                'owner'      => $user->owner ? [
                    'id' => $user->owner->id,
                    'first_name' => $user->owner->first_name,
                    'last_name' => $user->owner->last_name,
                ] : null,
            ],
        ], 'Login successful.');
    }

    public function resendLoginOtp(Request $request)
    {
        $request->validate([
            'challenge_id' => 'required|uuid',
            'device_id' => 'nullable|string|max:120',
        ]);

        $challenge = DB::table('login_otp_challenges')
            ->where('id', $request->challenge_id)
            ->first();

        if (!$challenge) {
            $this->logOtpEvent(null, 'otp_resend_invalid_session', 'denied', (string) $request->challenge_id, (string) $request->ip(), (string) $request->userAgent());
            return $this->error('OTP session is invalid. Please log in again.', 422);
        }

        $deviceId = trim((string) $request->input('device_id', ''));
        if (!empty($challenge->device_id) && $deviceId !== '' && $challenge->device_id !== $deviceId) {
            $this->logOtpEvent($challenge->user_id ?? null, 'otp_resend_session_mismatch', 'denied', (string) $request->challenge_id, (string) $request->ip(), (string) $request->userAgent());
            return $this->error('OTP session mismatch. Please log in again.', 422);
        }

        if (now('Asia/Manila')->greaterThan($challenge->expires_at)) {
            DB::table('login_otp_challenges')->where('id', $request->challenge_id)->delete();
            $this->logOtpEvent($challenge->user_id ?? null, 'otp_resend_expired', 'denied', (string) $request->challenge_id, (string) $request->ip(), (string) $request->userAgent());
            return $this->error('OTP expired. Please log in again.', 422);
        }

        $lastSentAt = $challenge->last_sent_at ? \Carbon\Carbon::parse($challenge->last_sent_at) : null;
        if ($lastSentAt && now('Asia/Manila')->diffInSeconds($lastSentAt) < 30) {
            $this->logOtpEvent($challenge->user_id ?? null, 'otp_resend_cooldown', 'denied', (string) $request->challenge_id, (string) $request->ip(), (string) $request->userAgent());
            return $this->error('Please wait before requesting another code.', 429);
        }

        if ((int) ($challenge->resend_count ?? 0) >= (int) ($challenge->max_resends ?? 5)) {
            $this->logOtpEvent($challenge->user_id ?? null, 'otp_resend_limit', 'denied', (string) $request->challenge_id, (string) $request->ip(), (string) $request->userAgent());
            return $this->error('Resend limit reached. Please log in again.', 429);
        }

        $user = User::find($challenge->user_id);
        if (!$user || empty($user->email)) {
            DB::table('login_otp_challenges')->where('id', $request->challenge_id)->delete();
            return $this->error('Unable to send OTP. Please log in again.', 422);
        }

        $otpPlain = $this->generateOtpCode();
        DB::table('login_otp_challenges')
            ->where('id', $request->challenge_id)
            ->update([
                'code_hash' => Hash::make($otpPlain),
                'attempts' => 0,
                'resend_count' => ((int) ($challenge->resend_count ?? 0)) + 1,
                'last_sent_at' => now('Asia/Manila'),
                'expires_at' => now('Asia/Manila')->addMinutes(5),
                'updated_at' => now('Asia/Manila'),
            ]);

        $this->sendLoginOtp($user->email, $otpPlain);
        $this->logOtpEvent($user->id, 'otp_resent', 'success', (string) $request->challenge_id, (string) $request->ip(), (string) $request->userAgent());

        return $this->success([
            'challenge_id' => $request->challenge_id,
            'expires_in' => 300,
        ], 'OTP sent.');
    }

    // Logout — deletes current token.
    // Protected route — requires auth:sanctum.
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return $this->success(null, 'Logged out successfully.');
    }

    // Me — returns the currently authenticated user.
    // Protected route — requires auth:sanctum.
    public function me(Request $request)
    {
        return $this->success($request->user(), 'Authenticated user retrieved.');
    }

    // Register step 1: validate details and send OTP to email.
    public function register(Request $request)
    {
        $payload = $this->normalizeRegistrationPayload($request->all());
        $validator = Validator::make($payload, $this->registrationRules(), $this->registrationMessages());
        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Validation failed.', 'errors' => $validator->errors()], 422);
        }

        $validated = $validator->validated();
        if (!empty($payload['password_confirmation'])) {
            $validated['password_confirmation'] = $payload['password_confirmation'];
        }
        $challengeId = (string) Str::uuid();
        $otpPlain = $this->generateOtpCode();
        $now = now('Asia/Manila');

        DB::table('registration_otp_challenges')->where(function ($q) use ($validated) {
            $q->where('email', $validated['email'])->orWhere('phone', $validated['phone']);
        })->delete();

        DB::table('registration_otp_challenges')->insert([
            'id' => $challengeId, 'email' => $validated['email'], 'phone' => $validated['phone'],
            'payload_json' => json_encode($validated), 'code_hash' => Hash::make($otpPlain),
            'attempts' => 0, 'max_attempts' => 5, 'resend_count' => 0, 'max_resends' => 5,
            'last_sent_at' => $now, 'expires_at' => $now->copy()->addMinutes(10), 'created_at' => $now, 'updated_at' => $now,
        ]);

        Mail::to($validated['email'])->send(new OtpMail(
            $otpPlain,
            'Your Sign-Up Verification Code – The Fur Club',
            'Thank you for registering with The Fur Club Pet Station! Please use the code below to verify your email address and complete your sign-up.',
            '10 minutes',
            'You are receiving this email because a sign-up request was made using this email address at The Fur Club Pet Station.'
        ));

        return response()->json(['requires_otp' => true, 'message' => 'We sent a 6-digit code to your email.', 'data' => ['challenge_id' => $challengeId, 'expires_in' => 600]], 202);
    }

    public function verifyRegistrationOtp(Request $request)
    {
        $request->validate(['challenge_id' => 'required|uuid', 'otp_code' => 'required|string|max:10']);

        $challenge = DB::table('registration_otp_challenges')->where('id', $request->challenge_id)->first();
        if (!$challenge) return $this->error('Verification session is invalid. Please register again.', 422);
        if (now('Asia/Manila')->greaterThan($challenge->expires_at)) {
            DB::table('registration_otp_challenges')->where('id', $request->challenge_id)->delete();
            return $this->error('Verification code expired. Please register again.', 422);
        }
        if ((int) $challenge->attempts >= (int) $challenge->max_attempts) {
            DB::table('registration_otp_challenges')->where('id', $request->challenge_id)->delete();
            return $this->error('Too many attempts. Please register again.', 422);
        }

        $otpCode = preg_replace('/\D+/', '', (string) $request->otp_code);
        if (!Hash::check($otpCode, $challenge->code_hash)) {
            DB::table('registration_otp_challenges')->where('id', $request->challenge_id)->update(['attempts' => ((int) $challenge->attempts) + 1, 'updated_at' => now('Asia/Manila')]);
            return $this->error('Invalid verification code.', 422);
        }

        $validated = json_decode((string) $challenge->payload_json, true) ?: [];
        // The challenge payload is client-originated data stored before OTP
        // verification. Re-run the complete registration contract here so a
        // verified request can never bypass the required-pet rules.
        // Password confirmation was already verified before OTP issuance.
        $finalRules = $this->registrationRules();
        $finalRules['password'] = 'required|string|min:8';
        unset($finalRules['password_confirmation']);
        $finalValidator = Validator::make($validated, $finalRules, $this->registrationMessages());
        if ($finalValidator->fails()) {
            DB::table('registration_otp_challenges')->where('id', $request->challenge_id)->delete();
            return response()->json([
                'success' => false,
                'message' => 'Validation failed: ' . implode(' ', $finalValidator->errors()->all()),
                'errors' => $finalValidator->errors(),
            ], 422);
        }
        $validated = $finalValidator->validated();

        $result = DB::transaction(function () use ($validated) {
            $user = User::create([
                'name' => $validated['first_name'] . ' ' . $validated['last_name'],
                'email' => $validated['email'],
                'phone' => $validated['phone'],
                'password_hash' => Hash::make($validated['password']),
                'role' => 'customer',
                'is_active' => true,
                'email_verified_at' => now('Asia/Manila'),
            ]);
            $preferredContact = $validated['preferred_contact'] ?? ($validated['email'] ? 'email' : 'phone');
            $owner = \App\Models\Owner::create([
                'user_id' => $user->id, 'first_name' => $validated['first_name'], 'last_name' => $validated['last_name'],
                'email' => $validated['email'], 'phone' => $validated['phone'],
                'address' => $validated['address'] ?? null, 'address_unit_floor' => $validated['address_unit_floor'] ?? null,
                'address_street' => $validated['address_street'] ?? null, 'address_barangay' => $validated['address_barangay'] ?? null,
                'address_city' => $validated['address_city'] ?? null, 'address_province' => $validated['address_province'] ?? null,
                'address_postal_code' => $validated['address_postal_code'] ?? null, 'address_country' => $validated['address_country'] ?? 'PH',
                'preferred_contact' => $preferredContact,
            ]);
            $pets = collect($validated['pets'] ?? [])->map(function ($petData) use ($owner) {
                return \App\Models\Pet::create([
                    'owner_id' => $owner->id,
                    'species_id' => $petData['species_id'],
                    'breed_id' => $petData['breed_id'],
                    'name' => $petData['pet_name'],
                    'sex' => $petData['pet_sex'],
                    'date_of_birth' => $petData['pet_dob'] ?? null,
                    'weight_kg' => $petData['pet_weight'] ?? null,
                ]);
            });
            if ($pets->isEmpty()) {
                throw new \RuntimeException('Registration requires at least one pet.');
            }
            $primaryPet = $pets->first();
            $token = $user->createToken('auth-token')->plainTextToken;
            if (!empty($user->email) && $primaryPet) Mail::to($user->email)->send(new \App\Mail\WelcomeMail($user, $owner, $primaryPet));
            try {
                $petNames = $pets->pluck('name')->filter()->values()->all();
                $petLabel = count($petNames) > 1
                    ? implode(', ', $petNames)
                    : ($petNames[0] ?? 'your pet');
                Notification::create([
                    'owner_id' => $owner->id, 'appointment_id' => null, 'subject' => 'Welcome to The Fur Club',
                    'message' => 'Welcome to The Fur Club, ' . $validated['first_name'] . '! Your account has been created successfully. We\'re excited to have you and ' . $petLabel . ' join our family.',
                    'type' => 'confirmation', 'channel' => 'email', 'status' => 'sent', 'is_read' => false, 'sent_at' => now('Asia/Manila'),
                ]);
            } catch (\Exception $e) { \Log::warning('Welcome notification creation failed: ' . $e->getMessage()); }

            return [
                'token' => $token,
                'user' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'role' => $user->role],
                'owner' => ['id' => $owner->id, 'first_name' => $owner->first_name, 'last_name' => $owner->last_name, 'phone' => $owner->phone],
                'pet' => $primaryPet ? ['id' => $primaryPet->id, 'name' => $primaryPet->name, 'pet_id' => $primaryPet->pet_id] : null,
                'pets' => $pets->map(fn ($pet) => ['id' => $pet->id, 'name' => $pet->name, 'pet_id' => $pet->pet_id])->values()->all(),
            ];
        });

        DB::table('registration_otp_challenges')->where('id', $request->challenge_id)->delete();
        return $this->success($result, 'Registration successful.', 201);
    }

    public function resendRegistrationOtp(Request $request)
    {
        $request->validate(['challenge_id' => 'required|uuid']);
        $challenge = DB::table('registration_otp_challenges')->where('id', $request->challenge_id)->first();
        if (!$challenge) return $this->error('Verification session is invalid. Please register again.', 422);
        if (now('Asia/Manila')->greaterThan($challenge->expires_at)) {
            DB::table('registration_otp_challenges')->where('id', $request->challenge_id)->delete();
            return $this->error('Verification code expired. Please register again.', 422);
        }
        $lastSentAt = $challenge->last_sent_at ? \Carbon\Carbon::parse($challenge->last_sent_at) : null;
        if ($lastSentAt && now('Asia/Manila')->diffInSeconds($lastSentAt) < 30) return $this->error('Please wait before requesting another code.', 429);
        if ((int) ($challenge->resend_count ?? 0) >= (int) ($challenge->max_resends ?? 5)) return $this->error('Resend limit reached. Please register again.', 429);

        $otpPlain = $this->generateOtpCode();
        DB::table('registration_otp_challenges')->where('id', $request->challenge_id)->update([
            'code_hash' => Hash::make($otpPlain), 'attempts' => 0, 'resend_count' => ((int) ($challenge->resend_count ?? 0)) + 1,
            'last_sent_at' => now('Asia/Manila'), 'expires_at' => now('Asia/Manila')->addMinutes(10), 'updated_at' => now('Asia/Manila'),
        ]);
        Mail::to($challenge->email)->send(new OtpMail(
            $otpPlain,
            'Your Sign-Up Verification Code – The Fur Club',
            'Thank you for registering with The Fur Club Pet Station! Please use the code below to verify your email address and complete your sign-up.',
            '10 minutes',
            'You are receiving this email because a sign-up request was made using this email address at The Fur Club Pet Station.'
        ));
        return $this->success(['challenge_id' => $request->challenge_id, 'expires_in' => 600], 'Verification code sent.');
    }
    // OTP-based forgot password — step 1: send code to email.
    public function forgotPasswordRequestOtp(Request $request)
    {
        $request->validate(['email' => 'required|email|max:150']);

        $user = User::where('email', strtolower(trim($request->email)))
                    ->where('is_active', true)
                    ->first();

        if (!$user) {
            return $this->error('We do not have that email registered.', 404);
        }

        $challengeId = (string) Str::uuid();

        if ($user) {
            $otpPlain = $this->generateOtpCode();
            $now = now('Asia/Manila');

            DB::table('login_otp_challenges')
                ->where('user_id', $user->id)
                ->where('device_id', 'pwd_reset')
                ->delete();

            DB::table('login_otp_challenges')->insert([
                'id'           => $challengeId,
                'user_id'      => $user->id,
                'device_id'    => 'pwd_reset',
                'code_hash'    => Hash::make($otpPlain),
                'attempts'     => 0,
                'max_attempts' => 5,
                'resend_count' => 0,
                'max_resends'  => 3,
                'last_sent_at' => $now,
                'expires_at'   => $now->copy()->addMinutes(5),
                'created_at'   => $now,
                'updated_at'   => $now,
            ]);

            Mail::to($user->email)->send(new OtpMail(
                $otpPlain,
                'Your Password Reset Code – The Fur Club',
                'We received a request to reset the password for your The Fur Club Pet Station account. Use the code below to proceed.',
                '5 minutes',
                'You are receiving this email because a password reset was requested for your account at The Fur Club Pet Station.'
            ));
        }

        // Always respond the same way — prevents email enumeration.
        return response()->json([
            'requires_otp' => true,
            'message'      => 'A 6-digit code was sent to your email.',
            'data'         => ['challenge_id' => $challengeId, 'expires_in' => 300],
        ], 202);
    }

    // OTP-based forgot password — step 2: verify code, return short-lived reset token.
    public function forgotPasswordVerifyOtp(Request $request)
    {
        $request->validate([
            'challenge_id' => 'required|uuid',
            'otp_code'     => 'required|string|max:10',
        ]);

        $challenge = DB::table('login_otp_challenges')
            ->where('id', $request->challenge_id)
            ->where('device_id', 'pwd_reset')
            ->first();

        if (!$challenge) {
            return $this->error('Reset session is invalid. Please request a new code.', 422);
        }

        if (now('Asia/Manila')->greaterThan($challenge->expires_at)) {
            DB::table('login_otp_challenges')->where('id', $request->challenge_id)->delete();
            return $this->error('Code expired. Please request a new one.', 422);
        }

        if ((int) $challenge->attempts >= (int) $challenge->max_attempts) {
            DB::table('login_otp_challenges')->where('id', $request->challenge_id)->delete();
            return $this->error('Too many attempts. Please request a new code.', 422);
        }

        $otpCode = preg_replace('/\D+/', '', (string) $request->otp_code);
        if (!Hash::check($otpCode, $challenge->code_hash)) {
            DB::table('login_otp_challenges')
                ->where('id', $request->challenge_id)
                ->update(['attempts' => ((int) $challenge->attempts) + 1, 'updated_at' => now('Asia/Manila')]);
            return $this->error('Invalid code. Please try again.', 422);
        }

        $user = User::find($challenge->user_id);
        if (!$user) {
            DB::table('login_otp_challenges')->where('id', $request->challenge_id)->delete();
            return $this->error('Account not found.', 422);
        }

        $resetToken = Str::random(64);
        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $user->email],
            ['token' => $resetToken, 'created_at' => now('Asia/Manila')]
        );
        DB::table('login_otp_challenges')->where('id', $request->challenge_id)->delete();

        return $this->success([
            'reset_token' => $resetToken,
            'email'       => $user->email,
        ], 'Code verified. You may now reset your password.');
    }

    // Public route — no auth required.
    public function forgotPassword(Request $request)
    {
        return $this->forgotPasswordRequestOtp($request);
    }

    // Reset Password — verifies token and updates password.
    // Public route — no auth required.
    public function resetPassword(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'token'    => 'required|string',
            'password' => 'required|min:8|confirmed',
        ]);

        $record = DB::table('password_reset_tokens')
            ->where('email', $request->email)
            ->where('token', $request->token)
            ->first();

        if (!$record) {
            return $this->error('Invalid or expired reset token.', 422);
        }

        if (now('Asia/Manila')->diffInMinutes($record->created_at) > 60) {
            DB::table('password_reset_tokens')->where('email', $request->email)->delete();
            return $this->error('Reset token has expired. Please request a new one.', 422);
        }

        User::where('email', $request->email)->update([
            'password_hash' => Hash::make($request->password),
        ]);

        // Security hardening: revoke all trusted devices and access tokens on reset.
        $user = User::where('email', $request->email)->first();
        if ($user) {
            DB::table('user_trusted_devices')->where('user_id', $user->id)->delete();
            DB::table('personal_access_tokens')->where('tokenable_type', User::class)->where('tokenable_id', $user->id)->delete();
            if (!empty($user->email)) {
                Mail::to($user->email)->send(new PasswordChangedMail(now('Asia/Manila')));
            }
        }

        DB::table('password_reset_tokens')->where('email', $request->email)->delete();

        return $this->success(null, 'Password reset successfully.');
    }

    private function generateOtpCode(): string
    {
        return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }

    private function sendLoginOtp(string $email, string $otpCode): void
    {
        $mailable = new OtpMail(
            $otpCode,
            'Your Login Verification Code – The Fur Club',
            'A login attempt was made to your The Fur Club Pet Station account. Use the code below to complete your sign-in.',
            '5 minutes',
            'You are receiving this email because a login attempt was made on your account at The Fur Club Pet Station.'
        );

        // Improve perceived login speed: return OTP challenge response first,
        // then send the email after response when possible.
        try {
            dispatch(function () use ($email, $mailable) {
                Mail::to($email)->send($mailable);
            })->afterResponse();
            return;
        } catch (\Throwable $e) {
            \Log::warning('Deferred OTP send failed; falling back to sync send: ' . $e->getMessage());
        }

        Mail::to($email)->send($mailable);
    }

    private function buildOtpAuthUrl(User $user, string $secret): string
    {
        $issuer = 'The Fur Club';
        $label = rawurlencode($issuer . ':' . ($user->email ?: $user->phone));
        $issuerEncoded = rawurlencode($issuer);
        return "otpauth://totp/{$label}?secret={$secret}&issuer={$issuerEncoded}&algorithm=SHA1&digits=6&period=30";
    }

    private function generateTotpSecret(int $length = 32): string
    {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $secret = '';
        for ($i = 0; $i < $length; $i++) {
            $secret .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }
        return $secret;
    }

    private function verifyTotpCode(string $secret, string $code, int $window = 1): bool
    {
        if (!preg_match('/^\d{6}$/', $code)) {
            return false;
        }
        $timeSlice = (int) floor(time() / 30);
        for ($i = -$window; $i <= $window; $i++) {
            if (hash_equals($this->totpAt($secret, $timeSlice + $i), $code)) {
                return true;
            }
        }
        return false;
    }

    private function totpAt(string $secret, int $timeSlice): string
    {
        $secretKey = $this->base32Decode($secret);
        if ($secretKey === null) {
            return '000000';
        }
        $time = pack('N*', 0) . pack('N*', $timeSlice);
        $hash = hash_hmac('sha1', $time, $secretKey, true);
        $offset = ord(substr($hash, -1)) & 0x0F;
        $truncatedHash = substr($hash, $offset, 4);
        $value = unpack('N', $truncatedHash)[1] & 0x7FFFFFFF;
        return str_pad((string) ($value % 1000000), 6, '0', STR_PAD_LEFT);
    }

    private function base32Decode(string $secret): ?string
    {
        $secret = strtoupper(preg_replace('/[^A-Z2-7]/', '', $secret));
        if ($secret === '') {
            return null;
        }
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $bits = '';
        $binary = '';
        $chars = str_split($secret);
        foreach ($chars as $char) {
            $pos = strpos($alphabet, $char);
            if ($pos === false) {
                return null;
            }
            $bits .= str_pad(decbin($pos), 5, '0', STR_PAD_LEFT);
        }
        for ($i = 0; $i + 8 <= strlen($bits); $i += 8) {
            $binary .= chr(bindec(substr($bits, $i, 8)));
        }
        return $binary;
    }

    private function normalizeRegistrationPayload(array $payload): array
    {
        $digits = preg_replace('/\D+/', '', (string) ($payload['phone'] ?? ''));
        if ($digits && str_starts_with($digits, '63')) {
            $digits = substr($digits, 2);
        }
        if ($digits && !str_starts_with($digits, '0')) {
            $digits = '0' . $digits;
        }

        $email = strtolower(trim((string) ($payload['email'] ?? '')));
        $payload['email'] = $email !== '' ? $email : null;
        $payload['phone'] = $digits ? substr($digits, 0, 11) : null;
        $payload['address_country'] = strtoupper(trim((string) (($payload['address_country'] ?? 'PH'))));
        $payload['address_postal_code'] = !empty($payload['address_postal_code'])
            ? substr(preg_replace('/\D+/', '', (string) $payload['address_postal_code']), 0, 4)
            : null;

        // Backward-compatible pet payload normalization:
        // - if `pets` is provided, keep up to 2 entries
        // - otherwise derive from legacy single-pet fields
        $pets = [];
        if (!empty($payload['pets']) && is_array($payload['pets'])) {
            $pets = array_values(array_slice($payload['pets'], 0, 2));
        } elseif (!empty($payload['pet_name']) || !empty($payload['species_id']) || !empty($payload['breed_id'])) {
            $pets[] = [
                'pet_name' => $payload['pet_name'] ?? null,
                'species_id' => $payload['species_id'] ?? null,
                'breed_id' => $payload['breed_id'] ?? null,
                'pet_sex' => $payload['pet_sex'] ?? null,
                'pet_dob' => $payload['pet_dob'] ?? null,
                'pet_weight' => $payload['pet_weight'] ?? null,
            ];
        }
        $payload['pets'] = $pets;

        return $payload;
    }

    private function registrationRules(): array
    {
        return [
            'first_name' => 'required|string|max:100',
            'last_name' => 'required|string|max:100',
            'email' => 'required|email|max:150|unique:users,email|unique:owners,email',
            'phone' => 'required|regex:/^09\d{9}$/|unique:users,phone|unique:owners,phone',
            'password' => 'required|string|min:8|confirmed',
            'password_confirmation' => 'sometimes|string',
            'address' => 'nullable|string',
            'address_unit_floor' => 'nullable|string|max:120',
            'address_street' => 'nullable|string|max:255',
            'address_barangay' => 'nullable|string|max:120',
            'address_city' => 'nullable|string|max:120',
            'address_province' => 'nullable|string|max:120',
            'address_postal_code' => 'nullable|digits:4',
            'address_country' => 'nullable|in:PH',
            'preferred_contact' => 'sometimes|in:email,phone,both',
            'pets' => 'required|array|min:1|max:2',
            'pets.*.pet_name' => 'required|string|max:100',
            'pets.*.species_id' => 'required|uuid|exists:species_types,id',
            'pets.*.breed_id' => 'required|uuid|exists:breeds,id',
            'pets.*.pet_sex' => 'required|in:male,female',
            'pets.*.pet_dob' => 'nullable|date|before_or_equal:today',
            'pets.*.pet_weight' => ['nullable', 'regex:/^\d{1,2}(\.\d{1,2})?$/', 'numeric', 'min:0', 'max:99.99'],
        ];
    }

    private function registrationMessages(): array
    {
        return [
            'email.required' => 'Email is required to create an account.',
            'email.unique' => 'An account with this email already exists.',
            'phone.required' => 'A phone number (09XXXXXXXXX) is required to create an account.',
            'phone.regex' => 'Phone must start with 09 and be exactly 11 digits (e.g. 09XXXXXXXXX).',
            'phone.unique' => 'An account with this phone number already exists.',
            'password.confirmed' => 'Password confirmation does not match.',
            'password.min' => 'Password must be at least 8 characters.',
        ];
    }

    public function setupAuthenticator(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return $this->error('Unauthorized.', 401);
        }

        $plainSecret = $this->generateTotpSecret();
        $user->totp_pending_secret = Crypt::encryptString($plainSecret);
        $user->save();

        return $this->success([
            'secret' => $plainSecret,
            'otpauth_url' => $this->buildOtpAuthUrl($user, $plainSecret),
            'message' => 'Open Google Authenticator, add an account, and scan the QR or use the secret key.',
        ], 'Authenticator setup started.');
    }

    public function confirmAuthenticator(Request $request)
    {
        $request->validate([
            'otp_code' => 'required|string|max:10',
        ]);

        $user = $request->user();
        if (!$user || empty($user->totp_pending_secret)) {
            return $this->error('No pending authenticator setup found.', 422);
        }

        $secret = Crypt::decryptString((string) $user->totp_pending_secret);
        $code = preg_replace('/\D+/', '', (string) $request->input('otp_code', ''));
        if (!$this->verifyTotpCode($secret, $code, 1)) {
            return $this->error('Invalid authenticator code.', 422);
        }

        $recoveryCodes = $this->generateRecoveryCodes();
        $user->totp_secret = Crypt::encryptString($secret);
        $user->totp_pending_secret = null;
        $user->totp_enabled = true;
        $user->totp_recovery_codes = array_map(fn ($c) => Hash::make($c), $recoveryCodes);
        $user->save();

        return $this->success([
            'recovery_codes' => $recoveryCodes,
        ], 'Authenticator enabled.');
    }

    public function disableAuthenticator(Request $request)
    {
        $request->validate([
            'current_password' => 'required|string',
        ]);

        $user = $request->user();
        if (!$user) {
            return $this->error('Unauthorized.', 401);
        }

        if (!Hash::check((string) $request->input('current_password'), (string) $user->password_hash)) {
            throw ValidationException::withMessages([
                'current_password' => ['Current password is incorrect.'],
            ]);
        }

        $user->totp_enabled = false;
        $user->totp_secret = null;
        $user->totp_pending_secret = null;
        $user->totp_recovery_codes = null;
        $user->save();

        return $this->success(null, 'Authenticator disabled.');
    }

    public function regenerateRecoveryCodes(Request $request)
    {
        $request->validate([
            'current_password' => 'required|string',
        ]);

        $user = $request->user();
        if (!$user) {
            return $this->error('Unauthorized.', 401);
        }
        if (!(bool) $user->totp_enabled || empty($user->totp_secret)) {
            return $this->error('Authenticator is not enabled.', 422);
        }
        if (!Hash::check((string) $request->input('current_password'), (string) $user->password_hash)) {
            throw ValidationException::withMessages([
                'current_password' => ['Current password is incorrect.'],
            ]);
        }

        $recoveryCodes = $this->generateRecoveryCodes();
        $user->totp_recovery_codes = array_map(fn ($c) => Hash::make($c), $recoveryCodes);
        $user->save();

        return $this->success([
            'recovery_codes' => $recoveryCodes,
        ], 'Recovery codes regenerated.');
    }

    private function generateRecoveryCodes(int $count = 8): array
    {
        $codes = [];
        for ($i = 0; $i < $count; $i++) {
            $codes[] = strtoupper(Str::random(4) . '-' . Str::random(4));
        }
        return $codes;
    }

    private function consumeRecoveryCode(User $user, string $inputCode): bool
    {
        $codes = is_array($user->totp_recovery_codes) ? $user->totp_recovery_codes : [];
        if (empty($codes)) {
            return false;
        }

        $remaining = [];
        $matched = false;
        foreach ($codes as $hash) {
            if (!$matched && is_string($hash) && Hash::check($inputCode, $hash)) {
                $matched = true;
                continue;
            }
            $remaining[] = $hash;
        }

        if (!$matched) {
            return false;
        }

        $user->totp_recovery_codes = $remaining;
        $user->save();
        return true;
    }

    private function isTrustedDevice(string $userId, string $deviceId): bool
    {
        if ($deviceId === '') {
            return false;
        }

        $row = DB::table('user_trusted_devices')
            ->where('user_id', $userId)
            ->where('device_id', $deviceId)
            ->where('trusted_until', '>', now('Asia/Manila'))
            ->first();

        if (!$row) {
            return false;
        }

        DB::table('user_trusted_devices')
            ->where('id', $row->id)
            ->update([
                'last_used_at' => now('Asia/Manila'),
                'updated_at' => now('Asia/Manila'),
            ]);

        return true;
    }

    private function trustDevice(string $userId, string $deviceId, string $userAgent, string $ip): void
    {
        $existing = DB::table('user_trusted_devices')
            ->where('user_id', $userId)
            ->where('device_id', $deviceId)
            ->first();

        $data = [
            'user_agent_hash' => hash('sha256', $userAgent ?: 'unknown'),
            'last_ip' => $ip ?: null,
            'trusted_until' => now('Asia/Manila')->addDays(30),
            'last_used_at' => now('Asia/Manila'),
            'updated_at' => now('Asia/Manila'),
        ];

        if ($existing) {
            DB::table('user_trusted_devices')->where('id', $existing->id)->update($data);
            return;
        }

        DB::table('user_trusted_devices')->insert(array_merge($data, [
            'id' => (string) Str::uuid(),
            'user_id' => $userId,
            'device_id' => $deviceId,
            'first_ip' => $ip ?: null,
            'created_at' => now('Asia/Manila'),
        ]));
    }

    private function logOtpEvent(
        ?string $userId,
        string $eventType,
        string $status,
        ?string $challengeId = null,
        ?string $ip = null,
        ?string $userAgent = null,
        array $metadata = []
    ): void {
        try {
            DB::table('login_otp_events')->insert([
                'id' => (string) Str::uuid(),
                'user_id' => $userId,
                'challenge_id' => $challengeId,
                'event_type' => $eventType,
                'status' => $status,
                'ip_address' => $ip,
                'user_agent_hash' => $userAgent ? hash('sha256', $userAgent) : null,
                'metadata' => !empty($metadata) ? json_encode($metadata) : null,
                'created_at' => now('Asia/Manila'),
                'updated_at' => now('Asia/Manila'),
            ]);
        } catch (\Throwable $e) {
            \Log::warning('OTP event logging failed: ' . $e->getMessage());
        }
    }
}
