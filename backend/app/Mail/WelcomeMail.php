<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class WelcomeMail extends Mailable
{
    use Queueable, SerializesModels;

    public $user;
    public $owner;
    public $pet;

    public function __construct($user, $owner, $pet = null)
    {
        $this->user  = $user;
        $this->owner = $owner;
        $this->pet   = $pet;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Welcome to the Pack! Your Registration is Complete at The Fur Club Pet Station',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.welcome',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
