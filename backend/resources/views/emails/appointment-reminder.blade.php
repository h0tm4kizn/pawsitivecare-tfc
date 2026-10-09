@include('emails.partials.document-start', ['title' => 'Appointment Reminder – ' . $pet->name])

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
                This is a friendly reminder that <strong style="color:{{ config('mail_theme.colors.brand_dark') }};">{{ $pet->name }}</strong> has an appointment at <strong style="color:{{ config('mail_theme.colors.brand_dark') }};">The Fur Club Pet Station</strong> tomorrow. We can't wait to see them!
              </p>

              {{-- Appointment details --}}
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid {{ config('mail_theme.colors.brand_teal_light') }};border-radius:12px;margin-bottom:28px;overflow:hidden;">
                <tr>
                  <td style="background-color:{{ config('mail_theme.colors.brand_teal_light') }};padding:14px 20px;border-bottom:1px solid {{ config('mail_theme.colors.teal_border_soft') }};">
                    <p style="margin:0;font-size:13px;font-weight:800;color:{{ config('mail_theme.colors.brand_teal_dark') }};text-transform:uppercase;letter-spacing:0.8px;">
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
                      @if($isHotel && $appointment->hotelSuite)
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark_soft') }};border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">Suite</td>
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark') }};font-weight:600;border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">{{ $appointment->hotelSuite->name }}</td>
                      </tr>
                      @endif
                      @if($isHotel)
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark_soft') }};border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">Check-in</td>
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark') }};font-weight:600;border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">
                          {{ \Carbon\Carbon::parse($appointment->appointment_date)->format('F j, Y') }}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark_soft') }};border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">Check-out</td>
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark') }};font-weight:600;border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">
                          {{ \Carbon\Carbon::parse($appointment->appointment_date)->addDays($appointment->hotel_nights)->format('F j, Y') }}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark_soft') }};">Nights</td>
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark') }};font-weight:600;">{{ $appointment->hotel_nights }}</td>
                      </tr>
                      @else
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark_soft') }};border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">Date</td>
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark') }};font-weight:600;border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">
                          {{ \Carbon\Carbon::parse($appointment->appointment_date)->format('F j, Y') }}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark_soft') }};">Time</td>
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark') }};font-weight:600;">
                          {{ $appointment->start_time ? \Carbon\Carbon::parse($appointment->start_time)->format('g:i A') : '—' }}
                        </td>
                      </tr>
                      @endif
                    </table>
                  </td>
                </tr>
              </table>

              {{-- Checklist --}}
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:{{ config('mail_theme.colors.surface_canvas') }};border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:{{ config('mail_theme.colors.brand_dark') }};">A Few Reminders</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.6;border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">
                          Inform us of any <strong>new health concerns or behavioral changes</strong> since booking
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.6;border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">
                          Keep your <strong>phone reachable</strong> in case our staff needs to contact you during the service
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.6;">
                          Arrive a few minutes early so we can get started on time
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                See you and {{ $pet->name }} tomorrow!
              </p>

              <p style="margin:24px 0 0;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                Warmly,<br/>
                <strong style="color:{{ config('mail_theme.colors.brand_dark') }};">The Fur Club Pet Station Team</strong>
              </p>

            </td>
          </tr>

@include('emails.partials.document-end', ['disclaimer' => 'You are receiving this email because you have an upcoming appointment with The Fur Club Pet Station.'])

