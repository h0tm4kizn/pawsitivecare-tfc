import { AdminSkeleton, AdminLoadState } from './AdminLoading';

export default function ReportSectionState({ state = {}, onRetry, children }) {
  const initial = !state.loaded && !state.error;
  return <>
    <AdminLoadState loading={state.loading && state.loaded} error={state.error} onRetry={onRetry} />
    {state.loaded && (state.loading || state.error) && <p className="px-4 pb-2 text-xs text-brand-dark-soft">Showing the last loaded report until this update succeeds.</p>}
    {initial ? <AdminSkeleton label="Loading report" /> : state.loaded ? children : null}
  </>;
}
