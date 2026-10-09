@include('emails.partials.document-start', ['title' => 'Booking Update – ' . $pet->name])

          {{-- Body --}}
          <tr>
            <td style="padding:36px 40px;">

              @php
                $isHotel   = $appointment->service?->category === 'hotel' || $appointment->hotel_nights;
                $isDaycare = $appointment->service?->category === 'daycare';
                $category  = $isHotel ? 'Pet Hotel' : ($isDaycare ? 'Daycare' : 'Grooming');
              @endphp

              <p style="margin:0 0 20px;font-size:15px;color:{{ config('mail_theme.colors.brand_dark') }};line-height:1.6;">
                Dear <strong>{{ $owner->full_name ?? ($owner->first_name . ' ' . $owner->last_name) }}</strong>,
              </p>

              <p style="margin:0 0 28px;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                We regret to inform you that your booking request at <strong style="color:{{ config('mail_theme.colors.brand_dark') }};">The Fur Club Pet Station</strong> could not be approved at this time. Here are the details of the booking:
              </p>

              {{-- Booking details --}}
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid {{ config('mail_theme.colors.status_red_soft') }};border-radius:12px;margin-bottom:28px;overflow:hidden;">
                <tr>
                  <td style="background-color:{{ config('mail_theme.colors.status_red_soft') }};padding:14px 20px;border-bottom:1px solid {{ config('mail_theme.colors.status_red_border') }};">
                    <p style="margin:0;font-size:13px;font-weight:800;color:{{ config('mail_theme.colors.status_red_dark') }};text-transform:uppercase;letter-spacing:0.8px;">
                      Appointment Details
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark_soft') }};width:40%;border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">Pet</td>
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark') }};font-weight:700;border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">{{ $pet->name }}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark_soft') }};border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">Service</td>
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark') }};font-weight:600;border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">{{ $category }}</td>
                      </tr>
                      @if(!$isHotel && $appointment->service)
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark_soft') }};border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">Package</td>
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark') }};font-weight:600;border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">
                          {{ $appointment->service->name }}@if($appointment->size_label) &ndash; {{ $appointment->size_label }}@endif
                        </td>
                      </tr>
                      @endif
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark_soft') }};border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">Date</td>
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark') }};font-weight:600;border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">
                          {{ \Carbon\Carbon::parse($appointment->appointment_date)->format('F j, Y') }}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark_soft') }};">Status</td>
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.status_red') }};font-weight:700;">Not Approved</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              @if($displayReason)
              {{-- Reason --}}
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:{{ config('mail_theme.colors.status_red_surface') }};border:1px solid {{ config('mail_theme.colors.status_red_border') }};border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:{{ config('mail_theme.colors.status_red_dark') }};">Reason</p>
                    <p style="margin:0;font-size:13px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">{{ $displayReason }}</p>
                  </td>
                </tr>
              </table>
              @endif

              <p style="margin:0 0 20px;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                You are welcome to submit a new booking request for a different date or time. If you have any questions, please don't hesitate to contact us.
              </p>

              <p style="margin:24px 0 0;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                Warmly,<br/>
                <strong style="color:{{ config('mail_theme.colors.brand_dark') }};">The Fur Club Pet Station Team</strong>
              </p>

            </td>
          </tr>

@include('emails.partials.document-end', ['disclaimer' => 'You are receiving this email because you have a pending or recent appointment request with The Fur Club Pet Station.'])

