<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ThankYouMail extends Mailable
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
            subject: "Thank You for Choosing The Fur Club – {$this->pet->name}'s Service Completed"
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.thank-you',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
