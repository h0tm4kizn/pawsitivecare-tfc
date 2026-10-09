@include('emails.partials.document-start', ['title' => $emailSubject])

          {{-- Body --}}
          <tr>
            <td style="padding:36px 40px;">

              <p style="margin:0 0 20px;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                {{ $intro }}
              </p>

              {{-- OTP Code Box --}}
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;background-color:{{ config('mail_theme.colors.brand_teal_light') }};border:2px dashed {{ config('mail_theme.colors.brand_teal') }};border-radius:14px;padding:20px 40px;">
                      <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:{{ config('mail_theme.colors.brand_teal_dark') }};text-transform:uppercase;letter-spacing:1px;">Your Verification Code</p>
                      <p style="margin:0;font-size:36px;font-weight:800;color:{{ config('mail_theme.colors.brand_dark') }};letter-spacing:10px;">{{ $code }}</p>
                    </div>
                  </td>
                </tr>
              </table>

              {{-- Info box --}}
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:{{ config('mail_theme.colors.surface_canvas') }};border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;font-size:13px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                      This code expires in <strong>{{ $expiry }}</strong>. Do not share this code with anyone.
                      If you did not request this, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                Warmly,<br/>
                <strong style="color:{{ config('mail_theme.colors.brand_dark') }};">The Fur Club Pet Station Team</strong>
              </p>

            </td>
          </tr>

@include('emails.partials.document-end', ['disclaimer' => $disclaimer])

