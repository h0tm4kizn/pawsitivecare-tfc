import { Download, QrCode } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { apiFetch } from '../../../../api/apiClient';

export default function StaffQRCode({
  staffId,
  staffName = '',
  staffUuid = '',
  credentialEndpoint = '',
  showDownload = false,
  showReissue = false,
  size = 192,
}) {
  const qrRef = useRef(null);
  const existingStaffId = String(staffId || '').trim();
  const requestPath = credentialEndpoint || (staffUuid
    ? `/api/admin/staff/${encodeURIComponent(staffUuid)}/qr-credential`
    : '');
  const [credential, setCredential] = useState('');
  const [issuedStaffId, setIssuedStaffId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [reissuing, setReissuing] = useState(false);

  useEffect(() => {
    let active = true;
    setCredential('');
    setIssuedStaffId('');
    setError('');
    if (!requestPath) return () => { active = false; };

    setLoading(true);
    apiFetch(requestPath, { method: 'POST' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.message || 'Unable to load staff QR code.');
        const nextCredential = body?.data?.credential;
        if (typeof nextCredential !== 'string' || !nextCredential) {
          throw new Error('The server did not return a staff QR credential.');
        }
        let payloadStaffId = '';
        try {
          payloadStaffId = JSON.parse(nextCredential)?.staff_id || '';
        } catch {
          throw new Error('The server returned an invalid staff QR credential.');
        }
        if (active) {
          setCredential(nextCredential);
          setIssuedStaffId(String(payloadStaffId));
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Unable to load staff QR code.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [requestPath]);
  const qrStaffId = existingStaffId || issuedStaffId;

  const downloadQr = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg || !qrStaffId || !credential) return;

    const image = svg.cloneNode(true);
    image.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    image.setAttribute('width', '1024');
    image.setAttribute('height', '1024');
    const blob = new Blob([new XMLSerializer().serializeToString(image)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = String(staffName || 'staff').trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '');
    link.download = `staff-QR-${safeName || 'staff'}.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const reissueQr = async () => {
    if (!staffUuid || !credential || reissuing) return;
    if (!window.confirm(`Reissue the QR credential for ${staffName || qrStaffId}? The current QR will stop working.`)) return;

    setReissuing(true);
    setError('');
    try {
      const response = await apiFetch(`/api/admin/staff/${encodeURIComponent(staffUuid)}/qr-credential/reissue`, {
        method: 'POST',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message || 'Unable to reissue staff QR credential.');
      const nextCredential = body?.data?.credential || '';
      if (!nextCredential) throw new Error('The server did not return a staff QR credential.');
      setCredential(nextCredential);
      setIssuedStaffId(String(JSON.parse(nextCredential)?.staff_id || ''));
      window.dispatchEvent(new CustomEvent('staff-qr-credential-updated', {
        detail: { staffUuid, credential: nextCredential },
      }));
    } catch (requestError) {
      setError(requestError.message || 'Unable to reissue staff QR credential.');
    } finally {
      setReissuing(false);
    }
  };

  useEffect(() => {
    const updateCredential = (event) => {
      if (event.detail?.staffUuid === staffUuid && event.detail?.credential) {
        setCredential(event.detail.credential);
      }
    };
    window.addEventListener('staff-qr-credential-updated', updateCredential);
    return () => window.removeEventListener('staff-qr-credential-updated', updateCredential);
  }, [staffUuid]);

  return (
    <div className="flex flex-col items-center">
      {qrStaffId && credential ? (
        <div ref={qrRef} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-brand-dark-light">
          <QRCodeSVG
            value={credential}
            size={size}
            level="H"
            includeMargin
            bgColor="#ffffff"
            fgColor="#173551"
            title={`Staff QR code for ${staffName || 'staff member'}`}
          />
        </div>
      ) : (
        <div className="flex h-[184px] w-[184px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-brand-teal/30 bg-white p-4 text-center text-xs text-brand-dark-soft">
          <QrCode size={30} className="text-brand-teal" />
          <span>{!existingStaffId && !requestPath ? 'QR code is unavailable until a Staff ID is assigned.' : loading ? 'Loading secure staff QR…' : error || 'Secure QR credential unavailable.'}</span>
        </div>
      )}

      <p className="mt-2 max-w-full break-words text-sm font-extrabold text-center text-brand-dark">{staffName || 'Staff name unavailable'}</p>

      {showDownload && qrStaffId && credential && (
        <div className="mt-3 grid w-full max-w-[240px] gap-2">
          <button
            type="button"
            onClick={downloadQr}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-teal/30 px-2 py-2 text-xs font-bold text-brand-teal-dark transition hover:bg-brand-surface"
          >
            <Download size={14} /> Download QR
          </button>
          {showReissue && staffUuid && (
            <button
              type="button"
              onClick={reissueQr}
              disabled={reissuing}
              className="inline-flex items-center justify-center rounded-lg border border-amber-300 px-2 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-50 disabled:opacity-60"
            >
              {reissuing ? 'Reissuing…' : 'Reissue QR Credential'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
