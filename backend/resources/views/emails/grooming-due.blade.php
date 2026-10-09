@include('emails.partials.document-start', ['title' => 'We Miss ' . $pet->name . '!'])

          {{-- Body --}}
          <tr>
            <td style="padding:36px 40px;">

              <p style="margin:0 0 20px;font-size:15px;color:{{ config('mail_theme.colors.brand_dark') }};line-height:1.6;">
                Dear <strong>{{ $owner->full_name ?? ($owner->first_name . ' ' . $owner->last_name) }}</strong>,
              </p>

              <p style="margin:0 0 20px;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                We miss <strong style="color:{{ config('mail_theme.colors.brand_dark') }};">{{ $pet->name }}</strong>! It's been about 2 months since their last grooming session with us at <strong style="color:{{ config('mail_theme.colors.brand_dark') }};">The Fur Club Pet Station</strong>, and we think it might be time for a fresh trim and some pampering!
              </p>

              <p style="margin:0 0 28px;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                Regular grooming every 4–6 weeks keeps your pet's coat healthy, reduces shedding, and helps our team spot any skin or health concerns early.
              </p>

              {{-- Last grooming --}}
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid {{ config('mail_theme.colors.brand_teal_light') }};border-radius:12px;margin-bottom:28px;overflow:hidden;">
                <tr>
                  <td style="background-color:{{ config('mail_theme.colors.brand_teal_light') }};padding:14px 20px;border-bottom:1px solid {{ config('mail_theme.colors.teal_border_soft') }};">
                    <p style="margin:0;font-size:13px;font-weight:800;color:{{ config('mail_theme.colors.brand_teal_dark') }};text-transform:uppercase;letter-spacing:0.8px;">
                      Last Grooming Session
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
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark_soft') }};">Last Groomed</td>
                        <td style="padding:8px 0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark') }};font-weight:600;">{{ \Carbon\Carbon::parse($lastGroomingDate)->format('F j, Y') }}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              {{-- Book now nudge --}}
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:{{ config('mail_theme.colors.surface_canvas') }};border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:{{ config('mail_theme.colors.brand_dark') }};">Ready to Book?</p>
                    <p style="margin:0;font-size:13px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                      Log in to your account and book {{ $pet->name }}'s next grooming appointment today. Our team is ready to make them look and feel their best!
                    </p>
                  </td>
                </tr>
              </table>

              {{-- Contact --}}
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:{{ config('mail_theme.colors.surface_canvas') }};border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:{{ config('mail_theme.colors.brand_dark') }};">Get in Touch</p>
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
                We can't wait to see {{ $pet->name }} again!
              </p>

              <p style="margin:24px 0 0;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                Warmly,<br/>
                <strong style="color:{{ config('mail_theme.colors.brand_dark') }};">The Fur Club Pet Station Team</strong>
              </p>

            </td>
          </tr>

@include('emails.partials.document-end', ['disclaimer' => 'You are receiving this email because your pet had a grooming session with The Fur Club Pet Station.'])

