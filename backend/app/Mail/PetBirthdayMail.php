<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PetBirthdayMail extends Mailable
{
    use Queueable, SerializesModels;

    public $pet;
    public $owner;

    public function __construct($pet, $owner)
    {
        $this->pet = $pet;
        $this->owner = $owner;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Happy Birthday to {$this->pet->name}!"
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.pet-birthday',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
