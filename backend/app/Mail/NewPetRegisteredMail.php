<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class NewPetRegisteredMail extends Mailable
{
    use Queueable, SerializesModels;

    public object $pet;
    public object $owner;

    public function __construct(object $pet, object $owner)
    {
        $this->pet = $pet;
        $this->owner = $owner;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'New Pet Registered – ' . ($this->pet->name ?? 'Your Pet')
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.new-pet-registered'
        );
    }

    public function attachments(): array
    {
        return [];
    }
}

