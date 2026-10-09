@include('emails.partials.document-start', ['title' => 'Appointment Cancelled – ' . $pet->name])

@php
  $isHotel = $appointment->service?->category === 'hotel' || $appointment->hotel_nights;
  $isDaycare = $appointment->service?->category === 'daycare';
  $category = $isHotel ? 'Pet Hotel' : ($isDaycare ? 'Daycare' : 'Grooming');
  $cancelledByOwner = !empty($appointment->cancelled_by) && !empty($owner->user_id) && $appointment->cancelled_by == $owner->user_id;
  $ownerName = $owner->full_name ?? trim(($owner->first_name ?? '') . ' ' . ($owner->last_name ?? ''));
@endphp

<tr>
  <td style="padding:36px 40px;">
    <p style="margin:0 0 20px;font-size:15px;color:{{ config('mail_theme.colors.brand_dark') }};line-height:1.6;">Dear <strong>{{ $ownerName }}</strong>,</p>
    <p style="margin:0 0 28px;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
      @if($cancelledByOwner)
        This is a confirmation that you cancelled the appointment for <strong style="color:{{ config('mail_theme.colors.brand_dark') }};">{{ $pet->name }}</strong> at <strong style="color:{{ config('mail_theme.colors.brand_dark') }};">The Fur Club Pet Station</strong>.
      @else
        We would like to inform you that the appointment for <strong style="color:{{ config('mail_theme.colors.brand_dark') }};">{{ $pet->name }}</strong> at <strong style="color:{{ config('mail_theme.colors.brand_dark') }};">The Fur Club Pet Station</strong> has been cancelled.
      @endif
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid {{ config('mail_theme.colors.status_red_border') }};border-radius:12px;margin-bottom:28px;overflow:hidden;">
      <tr><td style="background-color:{{ config('mail_theme.colors.status_red_soft') }};padding:14px 20px;border-bottom:1px solid {{ config('mail_theme.colors.status_red_border') }};"><p style="margin:0;font-size:13px;font-weight:800;color:{{ config('mail_theme.colors.status_red_dark') }};text-transform:uppercase;letter-spacing:0.8px;">Appointment Details</p></td></tr>
      <tr><td style="padding:20px;"><table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark_soft') }};width:40%;border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">Pet</td><td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark') }};font-weight:700;border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">{{ $pet->name }}</td></tr>
        <tr><td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark_soft') }};border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">Service</td><td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark') }};font-weight:600;border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">{{ $category }}</td></tr>
        @if(!$isHotel && $appointment->service)
          <tr><td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark_soft') }};border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">Package</td><td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark') }};font-weight:600;border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">{{ $appointment->service->name }}@if($appointment->size_label) &ndash; {{ $appointment->size_label }}@endif</td></tr>
        @endif
        <tr><td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark_soft') }};border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">Date</td><td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark') }};font-weight:600;border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">{{ \Carbon\Carbon::parse($appointment->appointment_date)->format('F j, Y') }}</td></tr>
        <tr><td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark_soft') }};">Status</td><td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.status_red') }};font-weight:700;">Cancelled</td></tr>
      </table></td></tr>
    </table>

    @if($displayReason)
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:{{ config('mail_theme.colors.status_red_surface') }};border:1px solid {{ config('mail_theme.colors.status_red_border') }};border-radius:12px;margin-bottom:28px;"><tr><td style="padding:16px 20px;"><p style="margin:0 0 8px;font-size:13px;font-weight:800;color:{{ config('mail_theme.colors.status_red_dark') }};text-transform:uppercase;letter-spacing:0.6px;">Reason for Cancellation</p><p style="margin:0;font-size:13px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">{{ $displayReason }}</p></td></tr></table>
    @endif

    <p style="margin:0 0 20px;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">@if($cancelledByOwner) If you change your mind, you are welcome to book a new appointment at any time. @else You are welcome to book a new appointment at a different date or time. If you have any questions or concerns, please feel free to contact us. @endif</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:{{ config('mail_theme.colors.surface_canvas') }};border-radius:12px;margin-bottom:28px;"><tr><td style="padding:16px 20px;"><p style="margin:0 0 10px;font-size:13px;font-weight:800;color:{{ config('mail_theme.colors.brand_dark') }};text-transform:uppercase;letter-spacing:0.6px;">Get in Touch</p><p style="margin:4px 0;font-size:13px;color:{{ config('mail_theme.colors.text_secondary') }};">The Fur Club Pet Station</p><p style="margin:4px 0;font-size:13px;"><a href="mailto:connect.thefurclub@gmail.com" style="color:{{ config('mail_theme.colors.brand_teal') }};text-decoration:none;">connect.thefurclub@gmail.com</a></p><p style="margin:4px 0;font-size:13px;"><a href="tel:+639760658031" style="color:{{ config('mail_theme.colors.brand_teal') }};text-decoration:none;">0976 065 8031</a></p></td></tr></table>

    <p style="margin:24px 0 0;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">Warmly,<br/><strong style="color:{{ config('mail_theme.colors.brand_dark') }};">The Fur Club Pet Station Team</strong></p>
  </td>
</tr>

@include('emails.partials.document-end', ['compactFooter' => true, 'disclaimer' => 'You are receiving this email because you have an appointment record with The Fur Club Pet Station.'])
