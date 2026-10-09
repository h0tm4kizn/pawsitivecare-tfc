@include('emails.partials.document-start', ['title' => 'Reply from The Fur Club'])

          {{-- Body --}}
          <tr>
            <td style="padding:36px 40px;">

              <p style="margin:0 0 20px;font-size:15px;color:{{ config('mail_theme.colors.brand_dark') }};line-height:1.6;">
                Dear <strong>{{ $contactMessage->name }}</strong>,
              </p>

              <p style="margin:0 0 28px;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                Thank you for reaching out to us. Here is our response to your message:
              </p>

              {{-- Reply box --}}
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid {{ config('mail_theme.colors.brand_teal_light') }};border-radius:12px;margin-bottom:28px;overflow:hidden;">
                <tr>
                  <td style="background-color:{{ config('mail_theme.colors.brand_teal_light') }};padding:14px 20px;border-bottom:1px solid {{ config('mail_theme.colors.teal_border_soft') }};">
                    <p style="margin:0;font-size:13px;font-weight:800;color:{{ config('mail_theme.colors.brand_teal_dark') }};text-transform:uppercase;letter-spacing:0.8px;">
                      Our Response
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0;font-size:15px;color:{{ config('mail_theme.colors.brand_dark') }};line-height:1.8;white-space:pre-line;">{{ $replyText }}</p>
                  </td>
                </tr>
              </table>

              {{-- Original message --}}
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:{{ config('mail_theme.colors.surface_canvas') }};border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:{{ config('mail_theme.colors.brand_dark_soft') }};text-transform:uppercase;letter-spacing:0.8px;">Your Original Message</p>
                    <p style="margin:0;font-size:13px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.6;white-space:pre-line;">{{ $contactMessage->message }}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                If you have any further questions, feel free to reply to this email or contact us directly.
              </p>

              <p style="margin:24px 0 0;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                Warmly,<br/>
                <strong style="color:{{ config('mail_theme.colors.brand_dark') }};">The Fur Club Pet Station Team</strong>
              </p>

            </td>
          </tr>

@include('emails.partials.document-end', ['disclaimer' => 'You are receiving this email because you submitted a message through the contact form on our website.'])

