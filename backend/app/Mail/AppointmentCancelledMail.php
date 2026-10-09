<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use App\Support\CustomerAppointmentFormatter;

class AppointmentCancelledMail extends Mailable
{
    use Queueable, SerializesModels;

    public $appointment;
    public $owner;
    public $pet;
    public $reason;
    public $displayReason;

    public function __construct($appointment, $owner, $pet, string $reason = '')
    {
        $this->appointment = $appointment;
        $this->owner       = $owner;
        $this->pet         = $pet;
        $this->reason      = $reason;
        $this->displayReason = CustomerAppointmentFormatter::reason($reason);
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Appointment Cancelled – {$this->pet->name} at The Fur Club"
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.appointment-cancelled');
    }

    public function attachments(): array
    {
        return [];
    }

    /**
     * Convert internal cancellation annotations into neutral customer-facing
     * wording without changing the persisted appointment reason.
     */
    public static function customerFacingReason(?string $reason): ?string
    {
        return CustomerAppointmentFormatter::reason($reason);
    }
}
