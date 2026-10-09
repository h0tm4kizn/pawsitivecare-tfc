<?php

namespace Tests\Unit;

use App\Support\CustomerAppointmentFormatter;
use PHPUnit\Framework\TestCase;

class CustomerAppointmentFormatterTest extends TestCase
{
    public function test_customer_status_labels_never_expose_enum_syntax(): void
    {
        $this->assertSame('In Progress', CustomerAppointmentFormatter::statusLabel('in_progress'));
        $this->assertSame('No Show', CustomerAppointmentFormatter::statusLabel('no_show'));
        $this->assertSame('Rejected', CustomerAppointmentFormatter::statusLabel('rejected'));
        $this->assertSame('Cancelled', CustomerAppointmentFormatter::statusLabel('cancelled'));
        $this->assertSame('Appointment update', CustomerAppointmentFormatter::statusLabel('unexpected_internal_value'));
    }

    public function test_internal_reason_markers_are_removed_at_customer_boundary(): void
    {
        $internal = '[LATE CANCELLATION] Client-Initiated: No-Show (Policy Violation: 15-minute grace period expired)';

        $this->assertSame(
            'The appointment was cancelled after the 15-minute grace period had elapsed.',
            CustomerAppointmentFormatter::reason($internal)
        );
        $this->assertSame('The clinic was unavailable.', CustomerAppointmentFormatter::reason('[REJECTED] The clinic was unavailable.'));
        $this->assertSame(
            'Appointment booking for Buddy has been cancelled. Reason: The appointment was cancelled after the 15-minute grace period had elapsed.',
            CustomerAppointmentFormatter::notificationMessage('Appointment booking for Buddy has been cancelled. Reason: ' . $internal)
        );
        $this->assertSame($internal, $internal);
    }
}
