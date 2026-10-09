<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ContactReplyMail extends Mailable
{
    use Queueable, SerializesModels;

    public $contactMessage;
    public $replyText;

    public function __construct($contactMessage, $replyText)
    {
        $this->contactMessage = $contactMessage;
        $this->replyText      = $replyText;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Re: Your Message to The Fur Club Pet Station'
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.contact-reply',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
