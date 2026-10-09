export default function HealthConditionsSection({
  conditionSectionTitle,
  groomingItems,
  form,
  setField,
}) {
  return (
    <div>
      <p className="mb-3 border-b border-brand-dark-light pb-1 text-[11px] font-extrabold uppercase tracking-widest text-brand-dark">
        {conditionSectionTitle}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {groomingItems.map(({ key, label }) => (
          <label key={key} className="cursor-pointer flex items-center gap-2">
            <input
              type="checkbox"
              checked={form[key]}
              onChange={(event) => setField(key, event.target.checked)}
              className="h-4 w-4 accent-brand-teal"
              style={{ appearance: 'checkbox' }}
            />
            <span className="text-sm text-brand-dark">{label}</span>
          </label>
        ))}
        <label className="cursor-pointer flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.has_other_condition}
            onChange={(event) => {
              setField('has_other_condition', event.target.checked);
              if (!event.target.checked) setField('other_condition_notes', '');
            }}
            className="h-4 w-4 accent-brand-teal"
            style={{ appearance: 'checkbox' }}
          />
          <span className="text-sm text-brand-dark">Others</span>
        </label>
      </div>
      {form.has_other_condition && (
        <div className="mt-2">
          <input
            type="text"
            value={form.other_condition_notes}
            onChange={(event) => setField('other_condition_notes', event.target.value)}
            placeholder="Please specify condition"
            className="w-full rounded-xl border border-brand-dark-light px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
          />
        </div>
      )}

      <div className="mt-3">
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brand-dark">
          Any Allergies?
        </label>
        <input
          type="text"
          value={form.allergies}
          onChange={(event) => setField('allergies', event.target.value)}
          placeholder="e.g. chicken, certain grasses — type None if none"
          className="w-full rounded-xl border border-brand-dark-light px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
        />
      </div>
    </div>
  );
}
