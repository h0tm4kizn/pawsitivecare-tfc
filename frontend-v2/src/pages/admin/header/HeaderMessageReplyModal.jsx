import { useState } from 'react';
import HeaderModalShell from './shared/HeaderModalShell';

export default function HeaderMessageReplyModal({ message, onClose, onSend }) {
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  if (!message) return null;

  const handleSend = async () => {
    if (!replyText.trim() || isSending) return;
    setIsSending(true);
    setError('');
    const result = await onSend?.(message.id, replyText.trim());
    if (!result?.ok) {
      setError(result?.message || 'Failed to send reply.');
      setIsSending(false);
      return;
    }
    setIsSending(false);
    onClose?.();
  };

  return (
    <HeaderModalShell
      isOpen={Boolean(message)}
      onClose={onClose}
      title="Reply Message"
      subtitle={message?.email || '-'}
      className="w-full max-w-md"
      headerClassName="bg-brand-teal"
    >
        <div className="space-y-3 px-5 py-4">
          <div className="rounded-xl border border-brand-teal/20 bg-white px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-brand-dark-soft">Original Message</p>
            <p className="mt-1 text-xs text-brand-dark">{message?.message || '-'}</p>
          </div>

          <textarea
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            rows={5}
            placeholder="Type your reply..."
            className="w-full resize-none rounded-xl border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
          />

          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        </div>

        <div className="border-t border-brand-dark-light px-5 py-3">
          <button
            type="button"
            onClick={handleSend}
            disabled={!replyText.trim() || isSending}
            className="w-full rounded-xl bg-brand-teal py-2.5 text-sm font-bold text-white transition hover:bg-brand-teal-dark disabled:opacity-60"
          >
            {isSending ? 'Sending...' : 'Send Reply'}
          </button>
        </div>
    </HeaderModalShell>
  );
}
