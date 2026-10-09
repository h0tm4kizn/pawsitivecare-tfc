import { AdminSkeleton } from '../../../components/admin/AdminLoading';
import HeaderPopoverPanel from '../../admin/header/shared/HeaderPopoverPanel';
import {
  AssessmentDetailsPreview,
  AssessmentHistoryLoading,
  formatWeightKg,
} from './sidebarHelpers';

export default function ClientAssessmentDropdown({
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
  if (!isOpen) return null;

  return (
    <HeaderPopoverPanel
      isOpen={isOpen}
      onClose={onClose}
      title="Assessment History"
      titleIcon="fa-notes-medical"
      widthClass="w-[calc(100vw-2rem)] max-w-[420px]"
    >
      <div data-assessment-picker className="font-poppins">
        <div className="max-h-[70vh] space-y-1.5 overflow-y-auto px-4 py-3 scrollbar-teal">
          {!historyPet && <p className="mb-2 text-[10px] text-brand-dark-soft">Select a pet</p>}
          {petsLoading ? (
            <AdminSkeleton variant="table" label="Loading pets" rows={3} />
          ) : assessmentPets.length === 0 ? (
            <p className="text-center text-xs text-brand-dark-soft py-4">No pets registered</p>
          ) : !historyPet ? (
            assessmentPets.map((p) => {
              const isCat = String(p?.species_type?.name || p?.speciesType?.name || '')
                .toLowerCase()
                .includes('cat');
              const bg = isCat ? 'bg-brand-orange' : 'bg-brand-teal';
              const border = isCat
                ? 'border-brand-orange/40 hover:border-brand-orange'
                : 'border-brand-teal/40 hover:border-brand-teal';
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => loadHistory(p)}
                  className={`w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${border}`}
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 flex-shrink-0 border border-white shadow">
                    {p.photo_url ? (
                      <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full ${bg} flex items-center justify-center`}>
                        <span className="text-[7px] font-bold text-white">
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
              <div className="mb-3 flex items-center gap-3 border-b border-brand-dark-light/70 pb-3">
                <button
                  type="button"
                  onClick={() =>
                    selectedHistoryForm ? setSelectedHistoryForm(null) : setHistoryPet(null)
                  }
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-teal/25 text-brand-teal transition-colors hover:bg-brand-teal/10 hover:text-brand-teal-dark"
                  aria-label="Back"
                >
                  <i className="fa-solid fa-chevron-left text-xs" />
                </button>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-brand-dark">
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
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-brand-dark-light px-3 py-2.5 text-left transition-colors hover:border-brand-teal hover:bg-brand-teal/5"
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
    </HeaderPopoverPanel>
  );
}
