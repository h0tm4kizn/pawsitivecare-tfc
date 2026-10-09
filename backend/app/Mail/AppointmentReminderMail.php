<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AppointmentReminderMail extends Mailable
{
    use Queueable, SerializesModels;

    public $appointment;
    public $owner;
    public $pet;

    public function __construct($appointment, $owner, $pet)
    {
        $this->appointment = $appointment;
        $this->owner       = $owner;
        $this->pet         = $pet;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Reminder: {$this->pet->name}'s Appointment is Tomorrow!"
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.appointment-reminder',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
