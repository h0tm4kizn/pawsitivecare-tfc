export default function PoliciesDeclarationSection({
  hasServiceContext,
  policyTitle,
  activePolicies,
  declarationRef,
  fieldErrors,
  form,
  setField,
  declarationText,
}) {
  return (
    <>
      <div>
        <p className="mb-3 border-b border-brand-dark-light pb-1 text-[11px] font-extrabold uppercase tracking-widest text-brand-dark">
          {hasServiceContext ? policyTitle : 'Hotel & Daycare Policies'}
        </p>
        <div className="space-y-3 rounded-xl border border-brand-dark-light bg-white px-4 py-4">
          {activePolicies.map((policy) => (
            <div key={policy.num} className="flex gap-2 text-xs leading-relaxed text-brand-dark">
              <span className="shrink-0 font-bold text-brand-teal">{policy.num}</span>
              <span><strong>{policy.title}</strong> - {policy.body}</span>
            </div>
          ))}
        </div>
      </div>

      <div
        ref={declarationRef}
        className={`rounded-xl border px-4 py-4 ${
          fieldErrors.declaration_accepted ? 'border-red-400 bg-red-50' : 'border-brand-teal/30 bg-brand-teal-soft/12'
        }`}
      >
        <label className="cursor-pointer flex items-start gap-3">
          <input
            type="checkbox"
            checked={form.declaration_accepted}
            onChange={(event) => setField('declaration_accepted', event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand-teal"
            style={{ appearance: 'checkbox' }}
          />
          <span className="text-xs leading-relaxed text-brand-dark">
            {declarationText}
          </span>
        </label>
        {fieldErrors.declaration_accepted && (
          <p className="mt-2 text-xs text-red-500">{fieldErrors.declaration_accepted}</p>
        )}
      </div>
    </>
  );
}
