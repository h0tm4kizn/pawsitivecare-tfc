<?php

namespace Tests\Feature;

use App\Models\ShopHoursSetting;
use App\Models\StaffAttendance;
use App\Models\StaffCommission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Tests\TestDataHelper;

class StaffReportsIntegrationTest extends TestCase
{
    use RefreshDatabase, TestDataHelper;

    private const FILTERS = '?view=monthly&year=2026&month=10';

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_attendance_counts_shifts_days_and_overnight_duration_without_inventing_absences(): void
    {
        Sanctum::actingAs($this->createAdminUser());
        $staff = $this->createStaffUser();
        $staff->update(['display_id' => 'STF260001']);
        $other = $this->createStaffUser('groomer');
        foreach ([['2026-10-08 09:00:00', '2026-10-08 12:00:00'], ['2026-10-08 13:00:00', '2026-10-08 17:00:00'], ['2026-10-09 22:00:00', '2026-10-10 02:00:00']] as [$in, $out]) {
            StaffAttendance::create(['staff_id' => $staff->id, 'time_in_at' => $in, 'time_out_at' => $out]);
        }
        $response = $this->getJson('/api/reports/staff-attendance'.self::FILTERS);
        $response->assertOk()->assertJsonPath('summary.completed', 3)->assertJsonPath('summary.days_worked', 2)->assertJsonPath('summary.total_seconds', 39600);
        $response->assertJsonPath('data.data.0.date', '2026-10-09');
        $response->assertJsonPath('data.data.0.staff_display_id', 'STF260001');
        $this->assertStringContainsString('+08:00', $response->json('data.data.0.time_in'));
        $this->assertCount(3, $response->json('data.data'));
        $this->assertSame(0, $this->getJson('/api/reports/staff-attendance'.self::FILTERS.'&staff_id='.$other->id)->json('summary.count'));
    }

    public function test_attendance_report_includes_qr_recording_actor_and_method(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-08 17:00:00', 'Asia/Manila'));
        $admin = $this->createAdminUser();
        $staff = $this->createStaffUser('field');
        Sanctum::actingAs($admin);
        $staff->update(['display_id' => 'STF260008']);
        $credential = $this->postJson("/api/admin/staff/{$staff->id}/qr-credential")
            ->assertOk()
            ->json('data.credential');
        $this->postJson('/api/admin/attendance/qr/confirm-time-in', ['credential' => $credential])->assertCreated();

        $this->getJson('/api/reports/staff-attendance'.self::FILTERS)
            ->assertOk()
            ->assertJsonPath('data.data.0.recorded_by', $admin->id)
            ->assertJsonPath('data.data.0.recorded_by_name', $admin->name)
            ->assertJsonPath('data.data.0.recording_method', 'qr_admin');

        $csv = $this->get('/api/reports/staff-export'.self::FILTERS.'&group=attendance&format=csv');
        $csv->assertOk();
        $csvContent = $csv->streamedContent();
        $this->assertStringContainsString('Recorded By', $csvContent);
        $this->assertStringContainsString('qr_admin', $csvContent);
    }

    public function test_computed_missing_time_out_is_excluded_from_on_duty_and_date_filters_use_manila(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-08 12:00:00', 'Asia/Manila'));
        Sanctum::actingAs($this->createAdminUser());
        $staff = $this->createStaffUser();
        ShopHoursSetting::set('shop_hours_raw', ['wed' => ['open' => '09:00', 'close' => '18:00'], 'thu' => ['open' => '09:00', 'close' => '18:00']]);
        StaffAttendance::create(['staff_id' => $staff->id, 'time_in_at' => '2026-10-07 09:00:00']);
        StaffAttendance::create(['staff_id' => $staff->id, 'time_in_at' => '2026-10-08 09:00:00']);
        $this->getJson('/api/reports/staff-attendance'.self::FILTERS)
            ->assertJsonPath('summary.days_worked', 2)
            ->assertJsonPath('summary.completed', 0)
            ->assertJsonPath('summary.total_seconds', 0);
        $onDuty = $this->getJson('/api/reports/staff-attendance'.self::FILTERS.'&status=on_duty');
        $onDuty->assertOk()->assertJsonPath('summary.count', 1)->assertJsonPath('data.data.0.status', 'on_duty');
        $missing = $this->getJson('/api/reports/staff-attendance'.self::FILTERS.'&status=missing_time_out');
        $missing->assertOk()->assertJsonPath('summary.count', 1)->assertJsonPath('data.data.0.status', 'missing_time_out');
        $this->getJson('/api/reports/staff-attendance'.self::FILTERS.'&from=2026-10-08&to=2026-10-08')->assertJsonPath('summary.count', 1);
    }

    public function test_saved_commission_values_and_activity_remain_separate(): void
    {
        Sanctum::actingAs($this->createAdminUser());
        $staff = $this->createStaffUser();
        $staff->update(['display_id' => 'STF260003']);
        $empty = $this->createStaffUser('groomer');
        $owner = $this->createOwner();
        $species = $this->createSpeciesType();
        $pet = $this->createPet($owner, $species, $this->createBreed($species));
        $service = $this->createService();
        $first = $this->createAppointment($pet, $service, $staff->id, $owner);
        $second = $this->createAppointment($pet, $service, $staff->id, $owner);
        DB::table('appointments')->whereIn('id', [$first, $second])->update(['status' => 'completed', 'appointment_date' => '2026-10-08']);
        StaffCommission::create(['staff_id' => $staff->id, 'appointment_id' => $first, 'service_id' => $service, 'service_amount' => 900, 'commission_base_amount' => 800, 'rate_percent' => 12.5, 'commission_amount' => 100, 'earned_at' => '2026-10-08 11:00:00']);
        $activity = $this->getJson('/api/reports/staff-activity'.self::FILTERS);
        $activity->assertOk()->assertJsonPath('data.summary.completed', 2);
        $this->assertCount(2, $activity->json('data.by_staff'));
        $commissions = $this->getJson('/api/reports/commissions'.self::FILTERS);
        $commissions->assertOk()->assertJsonPath('summary.count', 1)->assertJsonPath('summary.total_commission', 100)->assertJsonPath('summary.total_base', 800);
        $commissions->assertJsonPath('data.data.0.staff.display_id', 'STF260003');
        $commissions->assertJsonPath('data.data.0.rate_percent', 12.5);
        $this->getJson('/api/reports/commissions'.self::FILTERS.'&staff_id='.$empty->id)->assertJsonPath('summary.count', 0);
        $this->getJson('/api/reports/commissions'.self::FILTERS.'&service_id='.$service)->assertJsonPath('summary.count', 1);
        DB::table('appointments')->where('id', $second)->update(['status' => 'no_show']);
        $this->getJson('/api/reports/staff-activity'.self::FILTERS.'&staff_id='.$staff->id)
            ->assertJsonPath('data.by_staff.0.total', 2)
            ->assertJsonPath('data.by_staff.0.completed', 1)
            ->assertJsonPath('data.by_staff.0.no_show', 1);
        $this->getJson('/api/reports/staff-activity'.self::FILTERS.'&staff_id='.$staff->id.'&appointment_status=no_show')
            ->assertJsonPath('data.by_staff.0.total', 1);
        $this->getJson('/api/reports/staff-activity-details'.self::FILTERS.'&staff_id='.$staff->id)
            ->assertJsonPath('data.total', 2);
        $this->getJson('/api/reports/staff-activity-details'.self::FILTERS.'&staff_id='.$staff->id.'&appointment_status=no_show')
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.data.0.status', 'no_show');
        $activityCsv = $this->get('/api/reports/staff-export'.self::FILTERS.'&staff_id='.$staff->id.'&appointment_status=no_show&group=activity&format=csv');
        $activityCsv->assertOk();
        $this->assertStringContainsString('No-Show', $activityCsv->streamedContent());
    }

    public function test_csv_stream_exports_more_than_one_thousand_matching_rows_and_pdf_is_available(): void
    {
        Sanctum::actingAs($this->createAdminUser());
        $staff = $this->createStaffUser();
        $records = [];
        for ($i = 0; $i < 1001; $i++) {
            $records[] = ['id' => (string) Str::uuid(), 'staff_id' => $staff->id, 'time_in_at' => '2026-10-08 09:00:00', 'time_out_at' => '2026-10-08 10:00:00', 'timezone' => 'Asia/Manila', 'created_at' => now(), 'updated_at' => now()];
        }
        foreach (array_chunk($records, 200) as $chunk) DB::table('staff_attendance')->insert($chunk);
        $csv = $this->get('/api/reports/staff-export'.self::FILTERS.'&group=attendance&format=csv');
        $csv->assertOk();
        $content = $csv->streamedContent();
        $this->assertSame(1001, substr_count($content, 'Completed Shift'));
        $this->assertMatchesRegularExpression('/"?Attendance records"?,1001/', $content);
        $this->assertMatchesRegularExpression('/"?Distinct staff-days worked"?,1/', $content);
        $this->assertStringContainsString('Timezone,Asia/Manila', $content);
        $pdf = $this->get('/api/reports/staff-export'.self::FILTERS.'&group=activity&format=pdf');
        $pdf->assertOk();
        $this->assertStringStartsWith('%PDF', $pdf->getContent());
        $largePdf = $this->get('/api/reports/staff-export'.self::FILTERS.'&group=attendance&format=pdf');
        $largePdf->assertOk();
        $pdfContent = $largePdf->getContent();
        $this->assertStringStartsWith('%PDF', $pdfContent);
        $this->assertGreaterThan(1000, strlen($pdfContent));
    }

    public function test_filter_options_include_staff_beyond_old_page_limit_and_all_services(): void
    {
        Sanctum::actingAs($this->createAdminUser());
        for ($i = 0; $i < 105; $i++) $this->createStaffUser('front_desk', (string) $i);
        $service = $this->createService();
        $options = $this->getJson('/api/reports/staff-options');
        $options->assertOk();
        $this->assertCount(105, $options->json('data.staff'));
        $this->assertContains($service, array_column($options->json('data.services'), 'id'));
    }

    public function test_custom_date_range_and_staff_filters_match_activity_and_commission_summaries(): void
    {
        Sanctum::actingAs($this->createAdminUser());
        $staff = $this->createStaffUser();
        $staff->update(['display_id' => 'STF260002']);
        $other = $this->createStaffUser('groomer');
        $owner = $this->createOwner();
        $species = $this->createSpeciesType();
        $pet = $this->createPet($owner, $species, $this->createBreed($species));
        $service = $this->createService();
        $appointment = $this->createAppointment($pet, $service, $staff->id, $owner);
        DB::table('appointments')->where('id', $appointment)->update(['appointment_date' => '2026-10-08', 'status' => 'completed']);
        StaffCommission::create(['staff_id' => $staff->id, 'appointment_id' => $appointment, 'service_id' => $service, 'service_amount' => 100, 'commission_base_amount' => 90, 'rate_percent' => 10, 'commission_amount' => 9, 'earned_at' => '2026-10-08 11:00:00']);
        $query = self::FILTERS.'&staff_id='.$staff->id.'&from=2026-10-08&to=2026-10-08';
        $this->getJson('/api/reports/staff-activity'.$query)->assertJsonPath('data.summary.completed', 1);
        $this->getJson('/api/reports/commissions'.$query)->assertJsonPath('summary.total_commission', 9);
        $filteredCsv = $this->get('/api/reports/staff-export'.$query.'&group=all&format=csv');
        $filteredCsv->assertOk();
        $filteredContent = $filteredCsv->streamedContent();
        $this->assertMatchesRegularExpression('/"?Staff Id"?,STF260002/', $filteredContent);
        $this->assertStringNotContainsString($staff->id, $filteredContent);
        $this->assertMatchesRegularExpression('/"?Total commission \(PHP\)"?,9\.00/', $filteredContent);
        $weeklyCsv = $this->get('/api/reports/staff-export'.self::FILTERS.'&from=2026-10-08&to=2026-10-14&group=commission&format=csv');
        $weeklyCsv->assertOk();
        $weeklyContent = $weeklyCsv->streamedContent();
        $this->assertStringContainsString('From,2026-10-08', $weeklyContent);
        $this->assertStringContainsString('To,2026-10-14', $weeklyContent);
        $this->assertStringContainsString('"Total commission (PHP)",9.00', $weeklyContent);
        $weeklyPdf = $this->get('/api/reports/staff-export'.self::FILTERS.'&from=2026-10-08&to=2026-10-14&group=commission&format=pdf');
        $weeklyPdf->assertOk();
        $this->assertStringContainsString('2026-10-08 to 2026-10-14', $weeklyPdf->getContent());
        $this->getJson('/api/reports/commissions'.self::FILTERS.'&from=2026-10-01&to=2026-10-07')->assertJsonPath('summary.count', 0);
        $this->getJson('/api/reports/staff-activity'.self::FILTERS.'&staff_id='.$other->id)->assertJsonPath('data.summary.completed', 0);
        $this->getJson('/api/reports/commissions'.self::FILTERS.'&from=2026-10-09&to=2026-10-09')->assertJsonPath('summary.count', 0);
    }
}
