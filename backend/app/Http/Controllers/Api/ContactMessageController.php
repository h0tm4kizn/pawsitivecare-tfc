<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\ContactReplyMail;
use App\Models\ContactMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class ContactMessageController extends Controller
{
    public function index(Request $request)
    {
        $perPage = min((int) $request->query('per_page', 30), 100);
        $messages = ContactMessage::query()
            ->select(['id', 'name', 'email', 'phone', 'message', 'is_read', 'created_at', 'updated_at'])
            ->latest('created_at')
            ->paginate($perPage);
        return response()->json(['data' => $messages]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'    => 'required|string|max:255',
            'email'   => 'required|email|max:255',
            'phone'   => 'nullable|string|max:30',
            'message' => 'required|string|max:3000',
        ]);

        $msg = ContactMessage::create($validated);
        return response()->json(['data' => $msg, 'message' => 'Message sent successfully.'], 201);
    }

    public function markRead(ContactMessage $contactMessage)
    {
        $contactMessage->update(['is_read' => true]);
        return response()->json(['data' => $contactMessage]);
    }

    public function reply(Request $request, ContactMessage $contactMessage)
    {
        $request->validate([
            'reply' => 'required|string|max:3000',
        ]);

        Mail::to($contactMessage->email)
            ->send(new ContactReplyMail($contactMessage, $request->reply));

        $contactMessage->update(['is_read' => true]);

        return response()->json(['message' => 'Reply sent successfully.']);
    }

    public function destroy(Request $request, ContactMessage $contactMessage)
    {
        $this->authorize('delete', $contactMessage);
        $contactMessage->delete();
        return response()->json(['message' => 'Message deleted successfully.']);
    }
}
