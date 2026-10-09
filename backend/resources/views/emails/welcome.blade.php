@include('emails.partials.document-start', ['title' => 'Welcome to The Fur Club Pet Station'])

          {{-- Body --}}
          <tr>
            <td style="padding:36px 40px;">

              <p style="margin:0 0 20px;font-size:15px;color:{{ config('mail_theme.colors.brand_dark') }};line-height:1.6;">
                Dear <strong>{{ $owner->full_name }}</strong>,
              </p>

              <p style="margin:0 0 20px;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                Welcome to <strong style="color:{{ config('mail_theme.colors.brand_dark') }};">The Fur Club Pet Station!</strong>
                We are thrilled to have you as the newest member of our family.
              </p>

              <p style="margin:0 0 28px;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                Our mission is to provide a safe, happy, and professional environment for your furry friends.
                We are excited to welcome you and <strong style="color:{{ config('mail_theme.colors.brand_dark') }};">{{ $pet->name ?? 'your pet' }}</strong> to The Fur Club family!
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                Your pet has been registered with PET ID:
                <strong style="color:{{ config('mail_theme.colors.brand_teal') }};">{{ $pet->pet_id ?? 'Pending Assignment' }}</strong>.
              </p>

              {{-- Mandatory Requirements --}}
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid {{ config('mail_theme.colors.brand_teal_light') }};border-radius:12px;margin-bottom:28px;overflow:hidden;">
                <tr>
                  <td style="background-color:{{ config('mail_theme.colors.brand_teal_light') }};padding:14px 20px;border-bottom:1px solid {{ config('mail_theme.colors.teal_border_soft') }};">
                    <p style="margin:0;font-size:13px;font-weight:800;color:{{ config('mail_theme.colors.brand_teal_dark') }};text-transform:uppercase;letter-spacing:0.8px;">
                      Mandatory Check-in Requirements
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 6px;font-size:14px;color:{{ config('mail_theme.colors.brand_dark') }};line-height:1.6;">
                      To proceed with any appointment service, please ensure the following:
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};vertical-align:top;">
                          <p style="margin:0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark') }};"><strong>Pet Assessment Form</strong></p>
                          <p style="margin:4px 0 0;font-size:13px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.6;">
                            Owners must answer our Pet Assessment Form to proceed with any service. This helps our team understand your pet's specific needs and temperament.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};vertical-align:top;">
                          <p style="margin:0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark') }};"><strong>Pet Identification</strong></p>
                          <p style="margin:4px 0 0;font-size:13px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.6;">
                            Upon arrival, we will perform a quick Pet Identification process to verify your pet's profile and secure their records.
                          </p>
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>
              </table>

              {{-- Services & Policies --}}
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid {{ config('mail_theme.colors.brand_teal_light') }};border-radius:12px;margin-bottom:28px;overflow:hidden;">
                <tr>
                  <td style="background-color:{{ config('mail_theme.colors.brand_teal_light') }};padding:14px 20px;border-bottom:1px solid {{ config('mail_theme.colors.teal_border_soft') }};">
                    <p style="margin:0;font-size:13px;font-weight:800;color:{{ config('mail_theme.colors.brand_teal_dark') }};text-transform:uppercase;letter-spacing:0.8px;">
                      Our Services &amp; Policies
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};vertical-align:top;">
                          <p style="margin:0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark') }};"><strong>Daycare</strong></p>
                          <p style="margin:4px 0 0;font-size:13px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.6;">
                            Enjoy supervised play and snacks for your pet!
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid {{ config('mail_theme.colors.brand_dark_light') }};vertical-align:top;">
                          <p style="margin:0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark') }};"><strong>Grooming</strong></p>
                          <p style="margin:4px 0 0;font-size:13px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.6;">
                            We observe a strict <strong>15-minute grace period</strong>. Late arrivals may lose their slot to prevent delays for other scheduled pets. No reservation deposit is required for Grooming.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;vertical-align:top;">
                          <p style="margin:0;font-size:14px;color:{{ config('mail_theme.colors.brand_dark') }};"><strong>Hotel Suite</strong></p>
                          <p style="margin:4px 0 0;font-size:13px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.6;">
                            Experience 24/7 CCTV and air-conditioned comfort in our designated suites. A <strong>50% Reservation Deposit</strong> is required to secure your Hotel Suite booking.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              {{-- Next Steps --}}
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:{{ config('mail_theme.colors.surface_canvas') }};border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:{{ config('mail_theme.colors.brand_dark') }};">Next Steps</p>
                    <p style="margin:0;font-size:13px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                      You can now book appointments for Daycare, Grooming, or Hotel Suite through our system.
                      Remember to complete the <strong>Pet Assessment Form</strong> during the booking process to finalize your request!
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                We can't wait to meet you!
              </p>

              <p style="margin:24px 0 0;font-size:15px;color:{{ config('mail_theme.colors.text_secondary') }};line-height:1.7;">
                Warmly,<br/>
                <strong style="color:{{ config('mail_theme.colors.brand_dark') }};">The Fur Club Pet Station Team</strong>
              </p>

            </td>
          </tr>

@include('emails.partials.document-end', ['disclaimer' => 'You are receiving this email because you recently created an account with The Fur Club Pet Station.'])

