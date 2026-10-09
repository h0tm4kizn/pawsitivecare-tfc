import { AdminStatSkeleton } from '../../../../../components/admin/AdminLoading';
import { X } from 'lucide-react';
import { useMemo, useState } from 'react';

const toLocalYMD = (utcStr) => {
  if (!utcStr) return '';
  const dt = new Date(utcStr);
  if (Number.isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const fmtJoinDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-US', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
  });
};

export default function NewCustomersStatBox({ loading = false, owners, onView }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('month');

  const { todayYMD, monthYM } = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return { todayYMD: `${y}-${m}-${d}`, monthYM: `${y}-${m}` };
  }, []);

  const todayList = useMemo(
    () => owners.filter((owner) => toLocalYMD(owner.created_at) === todayYMD)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [owners, todayYMD],
  );

  const monthList = useMemo(
    () => owners.filter((owner) => toLocalYMD(owner.created_at).startsWith(monthYM))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [owners, monthYM],
  );

  const displayList = tab === 'today' ? todayList : monthList;

  if (loading) return <AdminStatSkeleton />;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group min-h-[110px] w-full rounded-xl border border-brand-teal/25 bg-white px-5 py-4 text-left font-poppins shadow-[0_6px_12px_rgba(23,53,81,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_18px_rgba(23,53,81,0.14)] focus:outline-none focus:ring-2 focus:ring-brand-teal/30"
      >
        <h2 className="text-xs font-semibold text-brand-dark">NEW CUSTOMERS</h2>
        <p className="mt-2 text-3xl font-extrabold leading-none text-brand-teal">{monthList.length}</p>
        <p className="mt-2 text-[11px] font-semibold text-brand-dark-soft">
          {todayList.length} new today · this month
        </p>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/40 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-white">New Customers</h2>
                <p className="text-[11px] font-semibold text-white/70">Newly registered customers breakdown</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
                aria-label="Close"
              >
                <X size={15} strokeWidth={2.8} />
              </button>
            </div>
            <div className="h-1 bg-white" />

            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-brand-teal/20 bg-brand-teal/10 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-brand-dark-soft">Today</p>
                  <p className="mt-1 text-4xl font-extrabold leading-none text-brand-teal-dark">{todayList.length}</p>
                  <p className="mt-2 text-xs font-semibold text-brand-dark-soft">New customers today</p>
                </div>
                <div className="rounded-lg border border-brand-teal/20 bg-brand-teal/5 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-brand-dark-soft">This Month</p>
                  <p className="mt-1 text-4xl font-extrabold leading-none text-brand-teal-dark">{monthList.length}</p>
                  <p className="mt-2 text-xs font-semibold text-brand-dark-soft">Including today</p>
                </div>
              </div>

              <div className="flex overflow-hidden rounded-xl border border-brand-dark-light text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setTab('today')}
                  className={`flex-1 py-2 transition-colors ${tab === 'today' ? 'bg-brand-teal text-white' : 'bg-white text-brand-dark-soft hover:bg-brand-teal-light/20'}`}
                >
                  Today ({todayList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTab('month')}
                  className={`flex-1 border-l border-brand-dark-light py-2 transition-colors ${tab === 'month' ? 'bg-brand-teal text-white' : 'bg-white text-brand-dark-soft hover:bg-brand-teal-light/20'}`}
                >
                  This Month ({monthList.length})
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-brand-dark-light">
                {displayList.length === 0 ? (
                  <p className="px-4 py-8 text-center text-xs font-semibold text-brand-dark-soft">
                    No new customers {tab === 'today' ? 'today' : 'this month'} yet.
                  </p>
                ) : (
                  <div className="max-h-[240px] divide-y divide-brand-teal/10 overflow-y-auto">
                    {displayList.map((owner) => (
                      <div key={owner.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-brand-dark">{owner.fullName}</p>
                            {tab === 'month' && toLocalYMD(owner.created_at) === todayYMD && (
                              <span className="shrink-0 rounded-full bg-brand-teal/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-brand-teal-dark">Today</span>
                            )}
                          </div>
                          <p className="text-[11px] text-brand-dark-soft">
                            {owner.email} · Joined {fmtJoinDate(owner.created_at)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => { onView?.(owner); setOpen(false); }}
                          className="shrink-0 rounded-lg border border-brand-teal/30 px-2.5 py-1 text-[11px] font-bold text-brand-teal transition-colors hover:bg-brand-teal hover:text-white"
                        >
                          View
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
