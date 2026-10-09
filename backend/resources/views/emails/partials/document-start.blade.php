@php
  $assetBaseUrl = env('FRONTEND_URL')
      ? rtrim(env('FRONTEND_URL'), '/')
      : request()->getSchemeAndHttpHost();
  $bannerImageUrl = $assetBaseUrl . '/assets/landing_bg.webp';
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
  <title>{{ $title ?? 'The Fur Club Pet Station' }}</title>
</head>
<body style="margin:0;padding:0;background-color:{{ config('mail_theme.colors.surface_canvas') }};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <style>
    a[x-apple-data-detectors], u + #body a, #MessageViewBody a {
      color: inherit !important;
      text-decoration: none !important;
      font: inherit !important;
      line-height: inherit !important;
    }
  </style>

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:{{ config('mail_theme.colors.surface_canvas') }};padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:{{ config('mail_theme.colors.brand_white') }};border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.07);">

          <tr>
            <td style="background-color:{{ config('mail_theme.colors.brand_teal') }};background-image:url('{{ $bannerImageUrl }}');background-size:cover;background-position:center center;background-repeat:no-repeat;padding:0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:rgba(79,183,197,0.68);">
                <tr>
                  <td style="padding:26px 36px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align:middle;text-align:left;">
                          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;text-align:left;">
                            <tr>
                              <td style="vertical-align:middle;">
                                <span style="display:inline-block;color:#ffffff !important;-webkit-text-fill-color:#ffffff;font-size:34px;line-height:1.1;font-weight:800;letter-spacing:0.4px;">
                                  The Fur Club
                                </span>
                              </td>
                            </tr>
                          </table>
                          <p style="margin:10px 0 0;color:rgba(255,255,255,0.92);font-size:13px;line-height:1.5;letter-spacing:0.1px;">
                            207 F. Blumentritt st. Kabayanan San Juan City, San Juan, Philippines, 1550
                          </p>
                          <p style="margin:10px 0 0;color:rgba(255,255,255,0.88);font-size:11px;line-height:1.6;">
                            Services: Daycare / Grooming / Hotel Suite
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
