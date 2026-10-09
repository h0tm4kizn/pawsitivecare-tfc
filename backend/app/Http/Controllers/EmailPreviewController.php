<?php

namespace App\Http\Controllers;

use App\Mail\AppointmentReminderMail;
use App\Mail\BookingConfirmationMail;
use App\Mail\BookingRejectedMail;
use App\Mail\ContactReplyMail;
use App\Mail\ForgotPasswordMail;
use App\Mail\PetBirthdayMail;
use App\Mail\ThankYouMail;
use App\Mail\WelcomeMail;
use App\Mail\OtpMail;
use App\Mail\PasswordChangedMail;
use App\Mail\NewPetRegisteredMail;
use App\Mail\AppointmentCancelledMail;
use App\Mail\AppointmentNoShowMail;
use App\Mail\GroomingDueMail;
use Illuminate\Mail\Mailable;

class EmailPreviewController extends Controller
{
    /**
     * TEMPORARY: Email preview endpoints for local development only.
     * Remove these previews before deployment or protect them behind admin auth.
     */
    public function previewWelcome(): Mailable
    {
        return new WelcomeMail($this->sampleUser(), $this->sampleOwner(), $this->samplePet());
    }

    public function previewBookingConfirmation(): Mailable
    {
        return new BookingConfirmationMail($this->sampleAppointment('approved'), $this->sampleOwner(), $this->samplePet());
    }

    public function previewThankYou(): Mailable
    {
        return new ThankYouMail($this->sampleAppointment('completed'), $this->sampleOwner(), $this->samplePet());
    }

    public function previewAppointmentReminder(): Mailable
    {
        return new AppointmentReminderMail($this->sampleAppointment('approved', 1), $this->sampleOwner(), $this->samplePet());
    }

    public function previewForgotPassword(): Mailable
    {
        return new ForgotPasswordMail(url('/reset-password?token=example_token_here&email=sample.customer@example.com'));
    }

    public function previewPetBirthday(): Mailable
    {
        return new PetBirthdayMail($this->samplePet(), $this->sampleOwner());
    }

    public function previewContactReply(): Mailable
    {
        $contactMessage = (object) [
            'name'    => 'John Doe',
            'email'   => 'john@example.com',
            'subject' => 'Question about grooming services',
            'message' => 'I would like to know more about your grooming packages and pricing.',
        ];

        $replyText = "Thank you for reaching out! We appreciate your interest.\n\nOur grooming services are available daily from 9 AM to 6 PM. You can book an appointment through our portal or call us for more details.";

        return new ContactReplyMail($contactMessage, $replyText);
    }

    public function previewBookingRejected(): Mailable
    {
        $reason = 'We apologize, but we do not have availability for that date and time. Please try selecting a different date or time slot.';

        return new BookingRejectedMail($this->sampleAppointment('rejected'), $this->sampleOwner(), $this->samplePet(), $reason);
    }

    public function previewOtpSignup(): Mailable
    {
        return new OtpMail(
            '482910',
            'Your Sign-Up Verification Code – The Fur Club',
            'Thank you for registering with The Fur Club Pet Station! Please use the code below to verify your email address and complete your sign-up.',
            '10 minutes',
            'You are receiving this email because a sign-up request was made using this email address at The Fur Club Pet Station.'
        );
    }

    public function previewOtpLogin(): Mailable
    {
        return new OtpMail(
            '738201',
            'Your Login Verification Code – The Fur Club',
            'A login attempt was made to your The Fur Club Pet Station account. Use the code below to complete your sign-in.',
            '5 minutes',
            'You are receiving this email because a login attempt was made on your account at The Fur Club Pet Station.'
        );
    }

    public function previewOtpPasswordReset(): Mailable
    {
        return new OtpMail(
            '193847',
            'Your Password Reset Code – The Fur Club',
            'We received a request to reset the password for your The Fur Club Pet Station account. Use the code below to proceed.',
            '5 minutes',
            'You are receiving this email because a password reset was requested for your account at The Fur Club Pet Station.'
        );
    }

    public function previewPasswordChanged(): Mailable
    {
        return new PasswordChangedMail(now('Asia/Manila'));
    }

    public function previewNewPetRegistered(): Mailable
    {
        return new NewPetRegisteredMail($this->samplePet(), $this->sampleOwner());
    }

    public function previewAppointmentCancelled(): Mailable
    {
        return new AppointmentCancelledMail(
            $this->sampleAppointment('cancelled'),
            $this->sampleOwner(),
            $this->samplePet(),
            'We apologize, but we are unable to accommodate the appointment booking on this date due to fully booked schedule.'
        );
    }

    public function previewAppointmentCancelledByCustomer(): Mailable
    {
        $owner = $this->sampleOwner();
        $appointment = $this->sampleAppointment('cancelled');
        $appointment->cancelled_by = $owner->user_id;

        return new AppointmentCancelledMail(
            $appointment,
            $owner,
            $this->samplePet(),
            'I need to reschedule due to a personal conflict.'
        );
    }

    public function previewAppointmentNoShow(): Mailable
    {
        return new AppointmentNoShowMail(
            $this->sampleAppointment('no_show'),
            $this->sampleOwner(),
            $this->samplePet(),
            ''
        );
    }

    public function previewGroomingDue(): Mailable
    {
        return new GroomingDueMail(
            $this->samplePet(),
            $this->sampleOwner(),
            now()->subWeeks(6)->format('Y-m-d')
        );
    }

    private function sampleUser(): object
    {
        return (object) [
            'name'  => 'Maria Santos',
            'email' => 'maria@example.com',
        ];
    }

    private function sampleOwner(): object
    {
        return (object) [
            'full_name'  => 'Maria Santos',
            'first_name' => 'Maria',
            'last_name'  => 'Santos',
            'display_id' => 'CX26001',
            'email'      => 'maria@example.com',
            'phone'      => '0976 065 8031',
            'address'    => '123 Pet Street, San Juan City',
            'user_id'    => 'sample-user-id-123',
        ];
    }

    private function samplePet(): object
    {
        return (object) [
            'name'          => 'Buddy',
            'pet_id'        => 'DOG260001',
            'species_id'    => 1,
            'date_of_birth' => now()->subYears(3)->format('Y-m-d'),
        ];
    }

    private function sampleAppointment(string $status = 'approved', int $daysFromNow = 5): object
    {
        $service = (object) [
            'name'     => 'Daycare Premium',
            'category' => 'daycare',
        ];

        return (object) [
            'appointment_code' => 'DC26001',
            'appointment_date' => now()->addDays($daysFromNow)->format('Y-m-d'),
            'start_time'       => '10:00:00',
            'total_price'      => 1500,
            'hotel_nights'     => 0,
            'size_label'       => 'Medium',
            'status'           => $status,
            'service'          => $service,
            'service_id'       => 1,
            'hotelSuite'       => null,
        ];
    }
}
