<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use App\Support\CustomerAppointmentFormatter;

class BookingConfirmationMail extends Mailable
{
    use Queueable, SerializesModels;

    public $appointment;
    public $owner;
    public $pet;
    public $displayStatus;

    public function __construct($appointment, $owner, $pet)
    {
        $this->appointment = $appointment;
        $this->owner       = $owner;
        $this->pet         = $pet;
        $this->displayStatus = CustomerAppointmentFormatter::statusLabel($appointment->status ?? null);
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Booking Approved – {$this->pet->name} at The Fur Club"
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.booking-confirmation',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
