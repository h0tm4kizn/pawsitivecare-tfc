@include('emails.partials.document-start', ['title' => 'Reset Your Password'])

          {{-- Body --}}
          <tr>
            <td style="padding:36px 40px;">

              <p style="margin:0 0 20px;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                We received a request to reset the password for your <strong style="color:{{ config('mail_theme.colors.brand_dark') }};">The Fur Club Pet Station</strong> account. Click the button below to set a new password.
              </p>

              {{-- Reset button --}}
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr>
                  <td align="center">
                    <a href="{{ $resetUrl }}"
                      style="display:inline-block;background-color:{{ config('mail_theme.colors.brand_teal') }};color:{{ config('mail_theme.colors.brand_white') }};font-size:14px;font-weight:700;padding:14px 40px;border-radius:10px;text-decoration:none;letter-spacing:0.3px;">
                      Reset My Password
                    </a>
                  </td>
                </tr>
              </table>

              {{-- Info box --}}
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:{{ config('mail_theme.colors.surface_canvas') }};border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;font-size:13px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                      This link will expire in <strong>60 minutes</strong>. If you did not request a password reset, you can safely ignore this email &mdash; your password will not be changed.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 28px;font-size:13px;color:{{ config('mail_theme.colors.brand_dark_soft') }};line-height:1.7;">
                If the button above does not work, please contact us at
                <a href="mailto:connect.thefurclub@gmail.com" style="color:{{ config('mail_theme.colors.brand_teal') }};text-decoration:none;">connect.thefurclub@gmail.com</a>.
              </p>

              <p style="margin:0;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                Warmly,<br/>
                <strong style="color:{{ config('mail_theme.colors.brand_dark') }};">The Fur Club Pet Station Team</strong>
              </p>

            </td>
          </tr>

@include('emails.partials.document-end', ['disclaimer' => 'You are receiving this email because a password reset was requested for your account at The Fur Club Pet Station.'])
