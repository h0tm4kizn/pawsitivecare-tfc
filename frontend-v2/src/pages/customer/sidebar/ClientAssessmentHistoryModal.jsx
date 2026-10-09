import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { AdminSkeleton } from '../../../components/admin/AdminLoading';
import {
  AssessmentDetailsPreview,
  AssessmentHistoryLoading,
  formatWeightKg,
} from './sidebarHelpers';

export default function ClientAssessmentHistoryModal({
  isOpen,
  onClose,
  historyPet,
  setHistoryPet,
  petsLoading,
  assessmentPets,
  loadHistory,
  selectedHistoryForm,
  setSelectedHistoryForm,
  historyLoading,
  historyForms,
}) {
  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/30 p-4 backdrop-blur-[2px] lg:hidden"
      onClick={onClose}
    >
      <div
        data-assessment-picker
        className="w-full max-w-md overflow-hidden rounded-2xl border border-brand-teal/20 bg-white font-poppins shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-notes-medical text-white text-sm" />
            <h2 className="text-sm font-bold text-white uppercase tracking-widest">
              Assessment History
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        <div className="h-1 bg-brand-teal-light" />

        <div className="max-h-[72dvh] space-y-1.5 overflow-y-auto px-4 py-4 scrollbar-teal">
          {!historyPet && <p className="mb-2 text-[10px] text-brand-dark-soft">Select a pet</p>}
          {petsLoading ? (
            <AdminSkeleton variant="table" label="Loading pets" rows={3} />
          ) : assessmentPets.length === 0 ? (
            <p className="text-center text-xs text-brand-dark-soft py-4">No pets registered</p>
          ) : !historyPet ? (
            assessmentPets.map((p) => {
              const isCatP = String(p?.species_type?.name || p?.speciesType?.name || '')
                .toLowerCase()
                .includes('cat');
              const bgP = isCatP ? 'bg-brand-orange' : 'bg-brand-teal';
              const borderP = isCatP
                ? 'border-brand-orange/40 hover:border-brand-orange'
                : 'border-brand-teal/40 hover:border-brand-teal';
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => loadHistory(p)}
                  className={`w-full flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs transition-colors ${borderP}`}
                >
                  <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-white shadow">
                    {p.photo_url ? (
                      <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full ${bgP} flex items-center justify-center`}>
                        <span className="text-[8px] font-bold text-white">
                          {String(p.name || '?').slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-brand-dark truncate">{p.name}</p>
                    <p className="text-[9px] text-brand-dark-soft truncate">
                      {p.species_type?.name || p.speciesType?.name || ''}
                    </p>
                  </div>
                  <i className="fa-solid fa-chevron-right text-brand-dark-soft/40 text-[9px] shrink-0" />
                </button>
              );
            })
          ) : (
            <>
              <div className="mb-4 flex items-center gap-3 border-b border-brand-dark-light/70 pb-3">
                <button
                  type="button"
                  onClick={() =>
                    selectedHistoryForm ? setSelectedHistoryForm(null) : setHistoryPet(null)
                  }
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-teal/25 text-brand-teal transition-colors active:bg-brand-teal/10"
                  aria-label="Back"
                >
                  <i className="fa-solid fa-chevron-left text-sm" />
                </button>
                <div className="min-w-0">
                  <p className="truncate text-base font-extrabold text-brand-dark">
                    {selectedHistoryForm ? 'Assessment Details' : historyPet.name}
                  </p>
                </div>
              </div>
              {selectedHistoryForm ? (
                <AssessmentDetailsPreview form={selectedHistoryForm} pet={historyPet} />
              ) : historyLoading ? (
                <AssessmentHistoryLoading />
              ) : historyForms.length === 0 ? (
                <p className="py-4 text-center text-xs text-brand-dark-soft">No forms found</p>
              ) : (
                historyForms.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedHistoryForm(f)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-brand-dark-light px-4 py-3 text-left transition-colors active:bg-brand-teal/5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-brand-dark">
                        {new Date(f.created_at).toLocaleDateString('en-PH', {
                          timeZone: 'Asia/Manila',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-brand-dark-soft">
                        {formatWeightKg(f.weight_kg)}
                        {' - '}
                        {['yes', 'true', '1', 'y'].includes(String(f.is_vaccinated ?? '').toLowerCase())
                          ? 'Vaxx'
                          : '-'}
                        {' - '}
                        {f.declaration_accepted ? 'Done' : '-'}
                      </p>
                    </div>
                    <i className="fa-solid fa-chevron-right text-xs text-brand-teal" />
                  </button>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
