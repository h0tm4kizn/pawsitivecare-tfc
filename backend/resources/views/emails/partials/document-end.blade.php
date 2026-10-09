          <tr>
            <td style="background-color:{{ config('mail_theme.colors.footer_bg') }};padding:20px 24px;text-align:center;">
              <p style="margin:0 0 9px;font-size:15px;line-height:1.4;font-weight:700;color:#ffffff;letter-spacing:0.2px;">
                The Fur Club Pet Station
              </p>
              <p style="margin:0 0 7px;font-size:12px;line-height:1.45;font-weight:600;color:#ffffff;">
                <a href="https://www.google.com/maps/search/?api=1&amp;query=207+F.+Blumentritt+St.+Kabayanan+San+Juan+City+San+Juan+Philippines+1550" style="color:#ffffff !important;text-decoration:none !important;-webkit-text-fill-color:#ffffff;">
                  207 F. Blumentritt St. Kabayanan San Juan City, San Juan, Philippines, 1550
                </a>
              </p>
              <p style="margin:0 0 9px;font-size:12px;line-height:1.45;color:rgba(255,255,255,0.96);">
                Need help? Call <a href="tel:+639760658031" style="color:#ffffff !important;text-decoration:none !important;-webkit-text-fill-color:#ffffff;">0976 065 8031</a> or email <a href="mailto:connect.thefurclub@gmail.com" style="color:#ffffff !important;text-decoration:none !important;-webkit-text-fill-color:#ffffff;">connect.thefurclub@gmail.com</a>
              </p>
              <p style="margin:0;font-size:11px;line-height:1.45;color:rgba(255,255,255,0.84);">
                {{ $disclaimer ?? 'You are receiving this email because you have an account or an active record with The Fur Club Pet Station.' }}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
