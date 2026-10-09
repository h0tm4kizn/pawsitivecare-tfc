<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        $query = AuditLog::with('user:id,name,email,role')->latest('created_at');

        if ($request->filled('action')) {
            $query->where('action', $request->string('action')->toString());
        }
        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->date('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->date('to'));
        }
        if ($request->filled('module')) {
            $query->where('metadata->module', $request->string('module')->toString());
        }

        return response()->json([
            'data' => $query->paginate(min(max($request->integer('per_page', 25), 1), 100)),
        ]);
    }
}
