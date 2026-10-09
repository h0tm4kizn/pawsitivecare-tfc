<?php

namespace Tests\Feature;

use App\Mail\PetBirthdayMail;
use App\Models\Notification;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;
use Tests\TestDataHelper;

class PetBirthdayNotificationTest extends TestCase
{
    use RefreshDatabase, TestDataHelper;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_it_notifies_each_eligible_pet_and_keeps_admin_staff_visibility_on_existing_record(): void
    {
        Mail::fake();
        $today = Carbon::create(2026, 10, 9, 12, 0, 'Asia/Manila');
        Carbon::setTestNow($today);

        $speciesId = $this->createSpeciesType();
        $breedId = $this->createBreed($speciesId);
        $ownerId = $this->createOwner();
        $petId = $this->createPet($ownerId, $speciesId, $breedId);
        DB::table('pets')->where('id', $petId)->update(['date_of_birth' => '2020-10-09']);

        Artisan::call('pets:birthday-notifications');

        $this->assertDatabaseHas('notifications', [
            'owner_id' => $ownerId,
            'dedupe_key' => "pet-birthday:{$petId}:2026",
            'subject' => 'Happy Birthday, Buddy!',
        ]);
        Mail::assertSent(PetBirthdayMail::class, 1);
        $this->assertSame('pet_birthday', Notification::first()->metadata['event']);
    }

    public function test_it_does_not_duplicate_email_or_notification_when_the_command_is_rerun(): void
    {
        Mail::fake();
        Carbon::setTestNow(Carbon::create(2026, 10, 9, 12, 0, 'Asia/Manila'));

        $speciesId = $this->createSpeciesType();
        $breedId = $this->createBreed($speciesId);
        $ownerId = $this->createOwner();
        $petId = $this->createPet($ownerId, $speciesId, $breedId);
        DB::table('pets')->where('id', $petId)->update(['date_of_birth' => '2020-10-09']);

        Artisan::call('pets:birthday-notifications');
        Artisan::call('pets:birthday-notifications');

        $this->assertDatabaseCount('notifications', 1);
        Mail::assertSent(PetBirthdayMail::class, 1);
    }

    public function test_it_allows_the_same_pet_to_receive_a_new_notification_in_a_new_year(): void
    {
        Mail::fake();
        $speciesId = $this->createSpeciesType();
        $breedId = $this->createBreed($speciesId);
        $ownerId = $this->createOwner();
        $petId = $this->createPet($ownerId, $speciesId, $breedId);
        DB::table('pets')->where('id', $petId)->update(['date_of_birth' => '2020-10-09']);

        Carbon::setTestNow(Carbon::create(2026, 10, 9, 12, 0, 'Asia/Manila'));
        Artisan::call('pets:birthday-notifications');
        Carbon::setTestNow(Carbon::create(2027, 10, 9, 12, 0, 'Asia/Manila'));
        Artisan::call('pets:birthday-notifications');

        $this->assertDatabaseCount('notifications', 2);
        Mail::assertSent(PetBirthdayMail::class, 2);
    }

    public function test_it_handles_multiple_pets_and_february_29_birthdays(): void
    {
        Mail::fake();
        $speciesId = $this->createSpeciesType();
        $breedId = $this->createBreed($speciesId);
        $ownerId = $this->createOwner();
        $firstPetId = $this->createPet($ownerId, $speciesId, $breedId);
        $secondPetId = $this->createPet($ownerId, $speciesId, $breedId);
        DB::table('pets')->where('id', $firstPetId)->update(['date_of_birth' => '2020-10-09']);
        DB::table('pets')->where('id', $secondPetId)->update(['date_of_birth' => '2020-02-29']);

        Carbon::setTestNow(Carbon::create(2026, 10, 9, 12, 0, 'Asia/Manila'));
        Artisan::call('pets:birthday-notifications');
        $this->assertDatabaseCount('notifications', 1);

        Carbon::setTestNow(Carbon::create(2027, 2, 28, 12, 0, 'Asia/Manila'));
        Artisan::call('pets:birthday-notifications');

        $this->assertDatabaseHas('notifications', [
            'dedupe_key' => "pet-birthday:{$secondPetId}:2027",
        ]);
        Mail::assertSent(PetBirthdayMail::class, 2);
    }
}
