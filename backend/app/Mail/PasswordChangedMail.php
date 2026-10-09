<?php

namespace App\Mail;

use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PasswordChangedMail extends Mailable
{
    use Queueable, SerializesModels;

    public Carbon $changedAt;

    public function __construct(Carbon $changedAt)
    {
        $this->changedAt = $changedAt;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Your Password Was Changed – The Fur Club'
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.password-changed'
        );
    }

    public function attachments(): array
    {
        return [];
    }
}

