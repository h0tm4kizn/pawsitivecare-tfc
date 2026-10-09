@include('emails.partials.document-start', ['title' => 'Thank You – ' . $pet->name])

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
                Thank you for trusting <strong style="color:{{ config('mail_theme.colors.brand_dark') }};">The Fur Club Pet Station</strong> with {{ $pet->name }}'s care. We hope {{ $pet->name }} had a wonderful experience with us!
              </p>

              {{-- Service Summary --}}
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid {{ config('mail_theme.colors.brand_teal_light') }};border-radius:12px;margin-bottom:28px;overflow:hidden;">
                <tr>
                  <td style="background-color:{{ config('mail_theme.colors.brand_teal_light') }};padding:14px 20px;border-bottom:1px solid {{ config('mail_theme.colors.teal_border_soft') }};">
                    <p style="margin:0;font-size:13px;font-weight:800;color:{{ config('mail_theme.colors.brand_teal_dark') }};text-transform:uppercase;letter-spacing:0.8px;">
                      Service Summary
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
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark_soft') }};border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">Date</td>
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark') }};font-weight:600;border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};">
                          {{ \Carbon\Carbon::parse($appointment->appointment_date)->format('F j, Y') }}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark_soft') }};">Status</td>
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.status_green') }};font-weight:700;">Completed</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              {{-- Message Us --}}
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:{{ config('mail_theme.colors.surface_canvas') }};border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:{{ config('mail_theme.colors.brand_dark') }};">We'd Love to Hear From You</p>
                    <p style="margin:0 0 12px;font-size:13px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                      Have questions, concerns, or just want to share how {{ $pet->name }}'s visit went? Feel free to reach out to us!
                    </p>
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:{{ config('mail_theme.colors.text_secondary') }};">
                          📘 <a href="https://www.facebook.com/profile.php?id=61575018202629" style="color:{{ config('mail_theme.colors.brand_teal') }};text-decoration:none;">The Fur Club Pet Station</a>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:{{ config('mail_theme.colors.text_secondary') }};">
                          📧 <a href="mailto:connect.thefurclub@gmail.com" style="color:{{ config('mail_theme.colors.brand_teal') }};text-decoration:none;">connect.thefurclub@gmail.com</a>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:{{ config('mail_theme.colors.text_secondary') }};">
                          📞 <a href="tel:+639760658031" style="color:{{ config('mail_theme.colors.brand_teal') }};text-decoration:none;">0976 065 8031</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                We look forward to seeing {{ $pet->name }} again soon!
              </p>

              <p style="margin:24px 0 0;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                With gratitude,<br/>
                <strong style="color:{{ config('mail_theme.colors.brand_dark') }};">The Fur Club Pet Station Team</strong>
              </p>

            </td>
          </tr>

@include('emails.partials.document-end', ['disclaimer' => 'You are receiving this email because you recently completed a service with The Fur Club Pet Station.'])

