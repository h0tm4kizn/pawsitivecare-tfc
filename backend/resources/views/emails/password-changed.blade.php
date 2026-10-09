@include('emails.partials.document-start', ['title' => 'Password Changed'])

          <tr>
            <td style="padding:36px 40px;">

              <p style="margin:0 0 20px;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                This is a confirmation that the password for your
                <strong style="color:{{ config('mail_theme.colors.brand_dark') }};">The Fur Club Pet Station</strong>
                account was changed successfully.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:{{ config('mail_theme.colors.surface_canvas') }};border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;font-size:13px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                      <strong>Date and time:</strong> {{ $changedAt->format('F d, Y h:i A') }} (Asia/Manila)
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 28px;font-size:13px;color:{{ config('mail_theme.colors.brand_dark_soft') }};line-height:1.7;">
                If you did not make this change, please contact us immediately at
                <a href="mailto:connect.thefurclub@gmail.com" style="color:{{ config('mail_theme.colors.brand_teal') }};text-decoration:none;">connect.thefurclub@gmail.com</a>.
              </p>

              <p style="margin:0;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                Warmly,<br/>
                <strong style="color:{{ config('mail_theme.colors.brand_dark') }};">The Fur Club Pet Station Team</strong>
              </p>

            </td>
          </tr>

@include('emails.partials.document-end', ['disclaimer' => 'You are receiving this email because a password change was completed for your account at The Fur Club Pet Station.'])
