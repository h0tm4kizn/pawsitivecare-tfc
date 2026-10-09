<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class GroomingDueMail extends Mailable
{
    use Queueable, SerializesModels;

    public $pet;
    public $owner;
    public $lastGroomingDate;

    public function __construct($pet, $owner, string $lastGroomingDate)
    {
        $this->pet              = $pet;
        $this->owner            = $owner;
        $this->lastGroomingDate = $lastGroomingDate;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "We Miss {$this->pet->name}! Time for a Grooming Session 🐾"
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.grooming-due');
    }

    public function attachments(): array
    {
        return [];
    }
}
