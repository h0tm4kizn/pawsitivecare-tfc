import { ChevronDown, ChevronUp, MessageSquare, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAdminHeaderStore } from '../../../stores/adminHeaderStore';
import { fmtTimeAgo } from './headerDateUtils';
import HeaderIconButton from './shared/HeaderIconButton';
import HeaderPopoverPanel from './shared/HeaderPopoverPanel';
import HeaderMessagesAllModal from './HeaderMessagesAllModal';
import HeaderMessageReplyModal from './HeaderMessageReplyModal';
import { AdminSkeleton } from '../../../components/admin/AdminLoading';

export default function HeaderMessages() {
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const messages = useAdminHeaderStore((state) => state.messages);
  const messageLoading = useAdminHeaderStore((state) => state.messageLoading);
  const loadMessages = useAdminHeaderStore((state) => state.loadMessages);
  const markMessageRead = useAdminHeaderStore((state) => state.markMessageRead);
  const deleteMessage = useAdminHeaderStore((state) => state.deleteMessage);
  const replyToMessage = useAdminHeaderStore((state) => state.replyToMessage);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 300_000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  const unread = useMemo(
    () => messages.filter((row) => !row?.is_read).length,
    [messages],
  );

  const preview = messages.slice(0, 4);

  return (
    <div className="relative">
      <HeaderIconButton
        icon={MessageSquare}
        label="Messages"
        onClick={() => {
          setIsOpen((open) => {
            const next = !open;
            if (next) loadMessages({ force: true });
            return next;
          });
        }}
        badgeCount={unread}
        testId="icon-message"
      />

      <HeaderPopoverPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Messages"
        titleIcon="fa-envelope"
        rightAction={unread > 0 ? <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{unread}</span> : null}
        footer={(
          <button
            type="button"
            onClick={() => {
              loadMessages({ force: true });
              setShowAll(true);
              setIsOpen(false);
            }}
            className="w-full border-t border-brand-teal/20 bg-brand-teal-soft/20 py-2.5 text-xs font-bold text-brand-teal hover:bg-brand-teal-soft/35"
          >
            See All Messages
          </button>
        )}
      >
        {messageLoading ? (
          <AdminSkeleton variant="table" label="Loading messages" rows={3} />
        ) : preview.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <i className="fa-solid fa-envelope text-brand-dark/20 text-2xl mb-2 block" />
            <p className="text-xs text-brand-dark-soft">No messages yet.</p>
          </div>
        ) : (
          <div className="max-h-[280px] overflow-y-auto scrollbar-teal">
            {preview.map((row) => {
              const isExpanded = expandedId === row.id;
              return (
                <div key={row.id} className={`border-b border-brand-dark-light px-4 py-3 ${row?.is_read ? 'opacity-70' : 'bg-white'}`}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!row?.is_read) markMessageRead(row.id);
                      setExpandedId((prev) => (prev === row.id ? null : row.id));
                    }}
                    className="w-full text-left"
                  >
                    <div className="flex items-start gap-2.5">
                      <i className="fa-solid fa-envelope mt-0.5 text-sm shrink-0 text-brand-teal" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold text-brand-dark leading-snug truncate">{row?.name || 'Unknown'}</p>
                        <p className="mt-0.5 text-[10px] text-brand-dark-soft line-clamp-1">{row?.message || '-'}</p>
                        <span className="mt-0.5 block text-[9px] text-brand-dark-soft">{fmtTimeAgo(row?.created_at)}</span>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        {!row?.is_read && <span className="h-1.5 w-1.5 rounded-full bg-brand-teal" />}
                        <span className="rounded-full bg-brand-teal/10 p-1 text-brand-teal">
                          {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </span>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="mt-2 rounded-xl border border-brand-dark-light bg-brand-surface px-3 py-2">
                      <p className="text-[11px] leading-relaxed text-brand-dark">{row?.message || '-'}</p>
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!row?.id || deletingId) return;
                            setDeletingId(row.id);
                            await deleteMessage(row.id);
                            setDeletingId(null);
                            if (expandedId === row.id) setExpandedId(null);
                          }}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-500 transition hover:bg-red-100 disabled:opacity-60"
                          aria-label="Delete message"
                          disabled={deletingId === row.id}
                        >
                          <Trash2 size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!row?.is_read) markMessageRead(row.id);
                            setReplyTarget(row);
                            setIsOpen(false);
                          }}
                          className="text-[10px] font-bold text-brand-teal hover:text-brand-teal-dark"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </HeaderPopoverPanel>

      <HeaderMessagesAllModal
        isOpen={showAll}
        messages={messages}
        onClose={() => setShowAll(false)}
        onReply={(row) => {
          if (!row?.is_read) markMessageRead(row.id);
          setReplyTarget(row);
          setShowAll(false);
        }}
        deletingId={deletingId}
        onDelete={async (id) => {
          if (!id || deletingId) return;
          setDeletingId(id);
          await deleteMessage(id);
          setDeletingId(null);
        }}
      />

      <HeaderMessageReplyModal
        message={replyTarget}
        onClose={() => setReplyTarget(null)}
        onSend={replyToMessage}
      />
    </div>
  );
}
