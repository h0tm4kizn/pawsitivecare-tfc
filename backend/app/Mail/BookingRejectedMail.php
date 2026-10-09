<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use App\Support\CustomerAppointmentFormatter;

class BookingRejectedMail extends Mailable
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
            subject: "Booking Update – {$this->pet->name}'s Appointment at The Fur Club"
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.booking-rejected',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
