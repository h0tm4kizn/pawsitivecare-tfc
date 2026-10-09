export default function CarePreferencesSection({
  form,
  setField,
  socializationRef,
  treatRef,
  fieldErrors,
  socializationOptions,
  treatOptions,
}) {
  return (
    <div>
      <p className="mb-3 border-b border-brand-dark-light pb-1 text-[11px] font-extrabold uppercase tracking-widest text-brand-dark">
        Socialization &amp; Treat Preferences
      </p>

      <div ref={socializationRef} className="mb-4">
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brand-dark">
          Socialization <span className="text-red-500">*</span>
        </label>
        <div className="flex flex-col gap-2">
          {socializationOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setField('is_friendly', option.value)}
              className={`w-full rounded-xl border px-4 py-2.5 text-left text-sm font-semibold transition-colors ${
                form.is_friendly === option.value
                  ? 'border-brand-teal bg-brand-teal text-white'
                  : 'border-brand-dark-light bg-white text-brand-dark hover:border-brand-teal'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {fieldErrors.is_friendly && (
          <p className="mt-1 text-xs text-red-500">{fieldErrors.is_friendly}</p>
        )}
      </div>

      <div ref={treatRef} className="mb-4">
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brand-dark">
          House Treats <span className="text-red-500">*</span>
        </label>
        <div className="flex flex-col gap-2">
          {treatOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setField('treat_preference', option.value)}
              className={`w-full rounded-xl border px-4 py-2.5 text-left text-sm font-semibold transition-colors ${
                form.treat_preference === option.value
                  ? 'border-brand-teal bg-brand-teal text-white'
                  : 'border-brand-dark-light bg-white text-brand-dark hover:border-brand-teal'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {fieldErrors.treat_preference && (
          <p className="mt-1 text-xs text-red-500">{fieldErrors.treat_preference}</p>
        )}
      </div>
    </div>
  );
}
