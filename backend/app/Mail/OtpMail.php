<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OtpMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $code;
    public string $emailSubject;
    public string $intro;
    public string $expiry;
    public string $disclaimer;

    public function __construct(string $code, string $emailSubject, string $intro, string $expiry, string $disclaimer)
    {
        $this->code         = $code;
        $this->emailSubject = $emailSubject;
        $this->intro        = $intro;
        $this->expiry       = $expiry;
        $this->disclaimer   = $disclaimer;
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->emailSubject);
    }

    public function content(): Content
    {
        return new Content(view: 'emails.otp');
    }

    public function attachments(): array
    {
        return [];
    }
}
