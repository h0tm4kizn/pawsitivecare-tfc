@include('emails.partials.document-start', ['title' => 'Happy Birthday, ' . $pet->name . '!'])

          {{-- Body --}}
          <tr>
            <td style="padding:36px 40px;">

              <p style="margin:0 0 20px;font-size:15px;color:{{ config('mail_theme.colors.brand_dark') }};line-height:1.6;">
                Dear <strong>{{ $owner->full_name }}</strong>,
              </p>

              <p style="margin:0 0 28px;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                We at <strong style="color:{{ config('mail_theme.colors.brand_dark') }};">The Fur Club Pet Station</strong> want to take a moment to celebrate the most important furry member of your family &mdash; <strong>{{ $pet->name }}</strong>.
              </p>

              {{-- Birthday card --}}
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid {{ config('mail_theme.colors.brand_teal_light') }};border-radius:12px;margin-bottom:28px;overflow:hidden;">
                <tr>
                  <td style="background-color:{{ config('mail_theme.colors.brand_teal_light') }};padding:14px 20px;border-bottom:1px solid {{ config('mail_theme.colors.teal_border_soft') }};">
                    <p style="margin:0;font-size:13px;font-weight:800;color:{{ config('mail_theme.colors.brand_teal_dark') }};text-transform:uppercase;letter-spacing:0.8px;">
                      Birthday Wishes
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px;text-align:center;">
                    <p style="margin:0 0 8px;font-size:20px;font-weight:800;color:{{ config('mail_theme.colors.brand_dark') }};">
                      Happy Birthday, {{ $pet->name }}!
                    </p>
                    <p style="margin:0;font-size:14px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                      Wishing you endless belly rubs, tasty treats,<br/>
                      and all the love in the world today and always!
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 28px;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                We are so grateful to be part of {{ $pet->name }}'s journey. Whether it's grooming, daycare, or hotel stays &mdash; we are always here to give {{ $pet->name }} the best care possible.
              </p>

              <p style="margin:24px 0 0;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                Warmly,<br/>
                <strong style="color:{{ config('mail_theme.colors.brand_dark') }};">The Fur Club Pet Station Team</strong>
              </p>

            </td>
          </tr>

@include('emails.partials.document-end', ['disclaimer' => 'You are receiving this email because your pet has a birthday on record with The Fur Club Pet Station.'])

