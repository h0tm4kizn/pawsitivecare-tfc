import { Clock3, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import useBodyScrollLock from '../../../hooks/useBodyScrollLock';
import { SkeletonBlock } from '../../../components/admin/AdminLoading';

const shopDays = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

const steps = [
  { id: 1, title: 'Shop Hours', icon: Clock3 },
  { id: 2, title: 'Blocked Dates', icon: X },
];

export default function ManageHoursModal({
  isOpen,
  onClose,
  schedule,
  scheduleEdit,
  setScheduleTime,
  toggleScheduleClosed,
  resetScheduleEdit,
  saveManageHours,
  isSavingManageHours,
  isLoading = false,
}) {
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState(1);
  const [blockedDates, setBlockedDates] = useState([]);
  const [newDate, setNewDate] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  useBodyScrollLock(isOpen || shouldRender);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      return undefined;
    }

    setIsVisible(false);
    const timeout = window.setTimeout(() => setShouldRender(false), 220);
    return () => window.clearTimeout(timeout);
  }, [isOpen]);

  useEffect(() => {
    if (!shouldRender || !isOpen) return undefined;

    const timeout = window.setTimeout(() => setIsVisible(true), 20);
    return () => window.clearTimeout(timeout);
  }, [shouldRender, isOpen]);

  useEffect(() => {
    if (!isOpen || isLoading) return;
    setStep(1);
    setIsDirty(false);
    resetScheduleEdit?.();
    setBlockedDates(Array.isArray(schedule?.blocked_dates) ? schedule.blocked_dates : []);
  }, [isOpen, isLoading, schedule, resetScheduleEdit]);

  const openDays = useMemo(
    () => shopDays.filter((day) => !(scheduleEdit?.[day.key]?.closed)).length,
    [scheduleEdit],
  );

  const onToggleClosed = (dayKey) => {
    setIsDirty(true);
    toggleScheduleClosed?.(dayKey);
  };

  const onChangeTime = (dayKey, field, value) => {
    setIsDirty(true);
    setScheduleTime?.(dayKey, field, value);
  };

  const addBlockedDate = () => {
    if (!newDate || blockedDates.includes(newDate)) return;
    setIsDirty(true);
    setBlockedDates((prev) => [...prev, newDate].sort());
    setNewDate('');
  };

  const removeBlockedDate = (dateValue) => {
    setIsDirty(true);
    setBlockedDates((prev) => prev.filter((item) => item !== dateValue));
  };

  const onSave = async () => {
    const ok = await saveManageHours?.({
      blockedDates,
    });
    if (ok) handleClose();
  };

  const handleClose = () => {
    if (!isVisible) return;
    setIsVisible(false);
    window.setTimeout(() => {
      setShouldRender(false);
      onClose?.();
    }, 220);
  };

  if (!shouldRender) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[320] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/45 p-4 backdrop-blur-sm transition-opacity duration-200 ease-out ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleClose}
    >
      <div
        className={`relative z-10 flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl transition-transform duration-300 ease-out ${
          isVisible ? 'translate-y-0' : 'translate-y-4'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-brand-teal px-6 py-4">
          <h2 className="text-lg font-bold text-white">Shop Operations</h2>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-white/20"
            aria-label="Close shop operations modal"
          >
            <X size={18} strokeWidth={3} />
          </button>
        </div>

        {isLoading ? (
          <div role="status" aria-label="Loading shop hours" className="flex-1 space-y-5 overflow-hidden px-5 py-5">
            <span className="sr-only">Loading shop hours…</span>
            <div className="grid grid-cols-2 gap-2">
              <SkeletonBlock className="h-10 rounded-xl" />
              <SkeletonBlock className="h-10 rounded-xl" />
            </div>
            <SkeletonBlock className="h-5 w-32" />
            <div className="space-y-3">
              {shopDays.map(({ key }) => <SkeletonBlock key={key} className="h-12 w-full rounded-lg" />)}
            </div>
            <div className="grid grid-cols-3 gap-3 border-t border-brand-teal/10 pt-4">
              <SkeletonBlock className="h-12" />
              <SkeletonBlock className="h-12" />
              <SkeletonBlock className="h-12" />
            </div>
          </div>
        ) : <>
        <div className="border-b border-brand-teal/20 bg-white px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            {steps.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStep(item.id)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    step === item.id
                      ? 'bg-brand-teal text-white'
                      : 'border border-brand-teal/25 bg-white text-brand-dark hover:bg-brand-surface'
                  }`}
                >
                  <Icon size={13} />
                  {item.title}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden">
          <div className="no-scrollbar max-h-[calc(100dvh-220px)] overflow-y-auto px-5 py-4">
            {step === 1 && (
              <div className="space-y-5">
                <section>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-dark">Shop Hours</h3>
                  <div className="divide-y divide-brand-teal/15 border-y border-brand-teal/15">
                  {shopDays.map(({ key, label }) => {
                    const row = scheduleEdit?.[key] || { open: '09:00', close: '17:00', closed: true };
                    return (
                      <div key={key} className="grid grid-cols-[42px_68px_1fr] items-center gap-2 py-2.5">
                        <p className="text-xs font-semibold text-brand-dark">{label}</p>
                        <div className="flex justify-start">
                          <button
                            type="button"
                            onClick={() => onToggleClosed(key)}
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                              row.closed ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {row.closed ? 'Closed' : 'Open'}
                          </button>
                        </div>
                        <div>
                          {!row.closed ? (
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                            <input
                              type="time"
                              value={row.open}
                              onChange={(event) => onChangeTime(key, 'open', event.target.value)}
                              className="w-full rounded-md border border-brand-teal/25 bg-white px-2 py-1.5 text-xs font-semibold text-brand-dark"
                            />
                            <span className="text-xs text-brand-dark">to</span>
                            <input
                              type="time"
                              value={row.close}
                              onChange={(event) => onChangeTime(key, 'close', event.target.value)}
                              className="w-full rounded-md border border-brand-teal/25 bg-white px-2 py-1.5 text-xs font-semibold text-brand-dark"
                            />
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-brand-dark">No hours</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </section>

              </div>
            )}

            {step === 2 && (
              <section>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-dark">Blocked Dates</h3>
                <div className="mb-3 grid grid-cols-[1fr_auto] gap-2">
                  <input
                    type="date"
                    value={newDate}
                    onChange={(event) => setNewDate(event.target.value)}
                    className="rounded-md border border-brand-teal/25 bg-white px-3 py-2 text-xs font-semibold text-brand-dark"
                  />
                  <button type="button" onClick={addBlockedDate} className="rounded-md bg-brand-teal px-4 py-2 text-xs font-bold text-white hover:bg-brand-teal-dark">
                    Add
                  </button>
                </div>
                <div className="divide-y divide-brand-teal/15 border-y border-brand-teal/15">
                  {blockedDates.length === 0 && (
                    <p className="px-3 py-6 text-center text-xs font-semibold text-brand-dark">
                      No blocked dates yet.
                    </p>
                  )}
                  {blockedDates.map((dateValue) => (
                    <div key={dateValue} className="flex items-center justify-between py-3">
                      <p className="text-xs font-semibold text-brand-dark">{dateValue}</p>
                      <button
                        type="button"
                        onClick={() => removeBlockedDate(dateValue)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-brand-dark hover:bg-white hover:text-red-500"
                        aria-label={`Remove ${dateValue}`}
                      >
                        <X size={14} strokeWidth={3} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>

          <aside className="shrink-0 border-t border-brand-teal/15 bg-brand-surface/70 px-5 py-3">
            <div className="grid grid-cols-3 gap-3 text-xs font-semibold text-brand-dark">
              <div>
                <p className="uppercase tracking-wide">Open Days</p>
                <p className="mt-1 text-sm font-bold">{openDays}/7</p>
              </div>
              <div>
                <p className="uppercase tracking-wide">Blocked</p>
                <p className="mt-1 text-sm font-bold">{blockedDates.length}</p>
              </div>
              <div>
                <p className="uppercase tracking-wide">Status</p>
                <p className={`mt-1 text-xs font-bold ${isDirty ? 'text-brand-orange' : 'text-emerald-700'}`}>
                  {isDirty ? 'Unsaved' : 'Saved'}
                </p>
              </div>
            </div>
          </aside>
        </div>

        <div className="flex justify-end border-t border-brand-teal/20 px-5 py-4">
          <button
            type="button"
            onClick={onSave}
            disabled={isSavingManageHours || !isDirty}
            className="rounded-lg bg-brand-teal px-5 py-2 text-xs font-medium text-white transition hover:bg-brand-teal-dark focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSavingManageHours ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
        </>}
      </div>
    </div>
    ,
    document.body
  );
}
