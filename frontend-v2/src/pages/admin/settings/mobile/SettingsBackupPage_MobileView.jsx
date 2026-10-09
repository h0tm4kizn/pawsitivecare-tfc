import useAdminQuery from '../../../../hooks/useAdminQuery';
import { adminJson } from '../../../../api/adminData';
import { AdminSkeleton, AdminLoadState } from '../../../../components/admin/AdminLoading';
import { useState } from 'react';
import { Archive, Database, Download, FileDown, FileSpreadsheet, RefreshCw, RotateCcw, Trash2, Upload } from 'lucide-react';
import { apiFetch } from '../../../../api/apiClient';
import FormatDropdown from '../../../../components/FormatDropdown';

const ENTITY_TABS = [
  { key: 'customers', label: 'Customers' },
  { key: 'staff', label: 'Staff' },
  { key: 'pets', label: 'Pets' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'services', label: 'Services' },
  { key: 'appointments', label: 'Appointments' },
];

const EMPTY = '-';
const titleCase = (value) => String(value || '').replace(/\b\w/g, (letter) => letter.toUpperCase()) || EMPTY;

const IMPORT_TEMPLATES = {
  owners: { filename: 'pawsitivecare-owners-template.csv', headers: ['owner_email', 'first_name', 'last_name', 'phone', 'address'], example: ['owner@example.com', 'Juan', 'Dela Cruz', '09171234567', 'Complete address'] },
  pets: { filename: 'pawsitivecare-pets-template.csv', headers: ['owner_email', 'name', 'species', 'breed', 'sex', 'date_of_birth', 'weight_kg', 'medical_notes', 'photo_url'], example: ['owner@example.com', 'Buddy', 'Dog', 'Labrador', 'Male', '2022-01-15', '12.5', 'Optional notes', ''] },
};

function downloadImportTemplate(templateKey) {
  const template = IMPORT_TEMPLATES[templateKey];
  if (!template) return;
  const escapeCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = [template.headers, template.example].map((row) => row.map(escapeCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = template.filename;
  link.click();
  URL.revokeObjectURL(url);
}

const dateValue = (value) => value ? new Date(value).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }) : EMPTY;

const FIELD_MAP = {
  customers: [
    { label: 'Name', render: (r) => `${r.first_name || ''} ${r.last_name || ''}`.trim() || EMPTY },
    { label: 'Email', render: (r) => r.email || EMPTY },
    { label: 'Phone', render: (r) => r.phone || EMPTY },
    { label: 'Deleted', render: (r) => dateValue(r.deleted_at) },
  ],
  staff: [
    { label: 'Name', render: (r) => r.name || EMPTY },
    { label: 'Email', render: (r) => r.email || EMPTY },
    { label: 'Role', render: (r) => titleCase(r.staff_type || r.role) },
    { label: 'Deleted', render: (r) => dateValue(r.deleted_at) },
  ],
  pets: [
    { label: 'Name', render: (r) => r.name || EMPTY },
    { label: 'Owner', render: (r) => r.owner ? `${r.owner.first_name || ''} ${r.owner.last_name || ''}`.trim() : EMPTY },
    { label: 'Species', render: (r) => r.species_type?.name || EMPTY },
    { label: 'Deleted', render: (r) => dateValue(r.deleted_at) },
  ],
  inventory: [
    { label: 'Item', render: (r) => r.item_name || EMPTY },
    { label: 'Category', render: (r) => r.category || EMPTY },
    { label: 'Stock', render: (r) => r.stock_quantity ?? EMPTY },
    { label: 'Deleted', render: (r) => dateValue(r.deleted_at) },
  ],
  services: [
    { label: 'Name', render: (r) => r.name || EMPTY },
    { label: 'Category', render: (r) => r.category || EMPTY },
    { label: 'Deleted', render: (r) => dateValue(r.deleted_at) },
  ],
  appointments: [
    { label: 'Code', render: (r) => r.appointment_code || EMPTY },
    { label: 'Pet', render: (r) => r.pet?.name || EMPTY },
    { label: 'Service', render: (r) => r.service?.name || EMPTY },
    { label: 'Date', render: (r) => r.appointment_date || EMPTY },
    { label: 'Deleted', render: (r) => dateValue(r.deleted_at) },
  ],
};

function MobileArchivedRecords({ type }) {
  const archiveQuery = useAdminQuery(`archives:${type}`, async () => {
    const json = await adminJson(`/api/admin/trashed/${type}`);
    return json.data || json || [];
  }, []);
  const { data: records, setData: setRecords, loading, refresh: load } = archiveQuery;
  const [error, setError] = useState('');
  const [restoring, setRestoring] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fields = FIELD_MAP[type] || [];

  const restore = async (id) => {
    setRestoring(id);
    try {
      await apiFetch(`/api/admin/trashed/${type}/${id}/restore`, { method: 'POST' });
      setRecords((prev) => prev.filter((record) => record.id !== id));
    } catch {
      setError('Failed to restore record.');
    } finally {
      setRestoring(null);
    }
  };

  const forceDelete = async (id) => {
    setDeleting(id);
    setConfirmDelete(null);
    try {
      await apiFetch(`/api/admin/trashed/${type}/${id}`, { method: 'DELETE' });
      setRecords((prev) => prev.filter((record) => record.id !== id));
    } catch {
      setError('Failed to delete record.');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) return <AdminSkeleton label="Loading archived records" />;
  if (archiveQuery.error && !archiveQuery.loaded) return <AdminLoadState error={archiveQuery.error} onRetry={load} />;

  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</div>;
  }

  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-brand-teal/20 bg-white py-10 text-center">
        <Archive size={28} className="mx-auto mb-2 text-brand-dark-soft/40" />
        <p className="text-sm font-bold text-brand-dark-soft">No archived records</p>
        <p className="text-xs text-brand-dark-soft/60">All records in this category are active.</p>
      </div>
    );
  }

  return (
    <>
      <AdminLoadState loading={archiveQuery.refreshing} error={archiveQuery.error} onRetry={load} />
      {confirmDelete && (
        <div className="fixed inset-0 z-[200] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/40 p-4 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="bg-red-500 px-5 py-3.5">
              <h3 className="text-sm font-bold text-white">Delete Permanently</h3>
            </div>
            <div className="px-5 py-5">
              <p className="text-sm text-brand-dark">This record will be permanently deleted. This action cannot be undone.</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfirmDelete(null)}
                  className="rounded-xl border border-brand-dark-light py-2 text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-dark/5">
                  Keep
                </button>
                <button type="button" onClick={() => forceDelete(confirmDelete)}
                  className="rounded-xl bg-red-500 py-2 text-sm font-bold text-white hover:bg-red-600">
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {records.map((record) => {
          const title = fields[0]?.render(record) || EMPTY;
          const detailFields = fields.slice(1);
          const busy = restoring === record.id || deleting === record.id;

          return (
            <article key={record.id} className="overflow-hidden rounded-xl border border-brand-teal/15 bg-white shadow-sm">
              <div className="border-l-4 border-brand-teal px-4 py-3">
                <p className="truncate text-sm font-extrabold text-brand-dark">{title}</p>
                <div className="mt-3 space-y-2">
                  {detailFields.map((field) => (
                    <div key={field.label} className="flex items-start justify-between gap-3 text-xs">
                      <span className="shrink-0 font-semibold text-brand-dark-soft">{field.label}</span>
                      <span className="min-w-0 break-words text-right font-semibold text-brand-dark">{field.render(record)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-brand-dark-light bg-brand-surface/50 px-3 py-3">
                <button type="button" onClick={() => restore(record.id)} disabled={busy}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-brand-teal/30 bg-brand-teal/10 text-brand-teal transition hover:bg-brand-teal hover:text-white disabled:opacity-50" title="Restore record" aria-label="Restore record">
                  <RotateCcw size={13} />
                </button>
                <button type="button" onClick={() => setConfirmDelete(record.id)} disabled={busy}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 transition hover:bg-red-50 disabled:opacity-50" title="Delete permanently" aria-label="Delete permanently">
                  <Trash2 size={13} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

export default function SettingsBackupPage_MobileView({
  activeTab,
  setActiveTab,
  backupFiles = [],
  backupRefreshing = false,
  onRetryBackups,
  backupLoading = false,
  backupBusy = '',
  backupError = '',
  backupNotice = '',
  restoreTarget = null,
  setRestoreTarget,
  onCreateBackup,
  onUploadBackup,
  onExport,
  createFormat = 'json',
  setCreateFormat,
  uploadFormat = 'json',
  setUploadFormat,
  exportFormat = 'csv',
  setExportFormat,
  onDownloadBackup,
  onRestoreBackup,
}) {
  return (
    <div className="px-4 pb-10 pt-4">
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold leading-tight text-brand-teal-dark">
          Backup <span className="text-brand-dark">&amp; Recovery</span>
        </h1>
        <p className="mt-1 text-xs font-semibold text-brand-dark-soft">Create backups and recover archived records.</p>
      </div>

      <section className="mb-4 overflow-hidden rounded-2xl border border-brand-dark-light bg-white shadow-sm">
        <div className="flex items-center gap-2 bg-brand-teal-light px-4 py-3">
          <Database size={14} className="text-brand-teal" />
          <h2 className="text-sm font-bold text-brand-teal-dark">Database Backup</h2>
        </div>
        <div className="p-4">
          <div className="mb-5 rounded-xl border border-brand-teal/20 bg-brand-surface p-3">
            <p className="text-xs font-extrabold uppercase tracking-wider text-brand-teal-dark">Data Setup</p>
            <p className="mt-1 text-[11px] leading-relaxed text-brand-dark-soft">Download blank CSV templates for your initial owner and pet records.</p>
            <div className="mt-3 grid grid-cols-1 gap-2">
              {Object.entries(IMPORT_TEMPLATES).map(([key]) => (
                <button key={key} type="button" onClick={() => downloadImportTemplate(key)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-teal/30 bg-brand-teal/10 px-3 py-2 text-xs font-bold text-brand-teal-dark transition-colors hover:bg-brand-teal hover:text-white">
                  <FileDown size={14} /> Download {key === 'owners' ? 'Owners' : 'Pets'} Template
                </button>
              ))}
            </div>
          </div>
          <p className="text-sm font-extrabold text-brand-dark">Create or upload a backup</p>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-brand-dark-soft">
            Save the current system data or upload an existing JSON backup for recovery.
          </p>
          <AdminLoadState error={backupError} onRetry={onRetryBackups} />
          {backupNotice && <p className="mt-2 text-xs font-semibold text-emerald-600">{backupNotice}</p>}
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button type="button" onClick={() => onCreateBackup?.(createFormat)} disabled={Boolean(backupBusy)}
            className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-brand-teal px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-brand-teal-dark disabled:opacity-60">
            <Database size={15} className="shrink-0" />
            {backupBusy === `create:${createFormat}` ? 'Creating...' : 'Create Backup'}
          </button>
          <FormatDropdown value={createFormat} onChange={setCreateFormat} label="Create backup format" />
          <label className={`inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-brand-teal bg-brand-teal px-3 py-2.5 text-xs font-bold text-white transition hover:bg-brand-teal-dark ${backupBusy ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}>
            <Upload size={15} />
            {backupBusy === 'upload' ? 'Uploading...' : `Upload ${uploadFormat.toUpperCase()}`}
            <input
              type="file"
              accept={uploadFormat === 'csv' ? '.csv,text/csv' : '.json,application/json'}
              className="hidden"
              onChange={(event) => {
                onUploadBackup?.(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </label>
          <FormatDropdown value={uploadFormat} onChange={setUploadFormat} label="Upload backup format" />
          <button type="button" onClick={onExport} disabled={Boolean(backupBusy)}
            className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-brand-teal bg-brand-teal px-3 py-2.5 text-xs font-bold text-white transition hover:bg-brand-teal-dark disabled:opacity-60">
            <FileSpreadsheet size={15} />
            {backupBusy === 'csv' || backupBusy === 'create:json' ? 'Exporting...' : `Export ${exportFormat.toUpperCase()}`}
          </button>
          <FormatDropdown value={exportFormat} onChange={setExportFormat} label="Export backup format" />
          </div>
          <div className="mt-4 rounded-xl border border-brand-dark-light">
            <div className="flex items-center justify-between border-b border-brand-dark-light px-3 py-2.5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-brand-dark">Saved Backups</p>
              <span className="rounded-full bg-brand-teal/10 px-2 py-0.5 text-[10px] font-extrabold text-brand-teal">{backupFiles.length}</span>
            </div>
            <AdminLoadState loading={backupRefreshing} />
        {backupLoading ? (
              <AdminSkeleton label="Loading backups" rows={3} />
            ) : backupError && backupFiles.length === 0 ? null : backupFiles.length === 0 ? (
              <p className="px-3 py-7 text-center text-xs font-semibold text-brand-dark-soft">No database backups yet.</p>
            ) : (
              <div className="divide-y divide-brand-dark-light">
                {backupFiles.map((file) => (
                  <article key={file.filename} className="px-3 py-3">
                    <p className="break-words text-xs font-extrabold text-brand-dark">{file.filename}</p>
                    <p className="mt-1 text-[10px] font-semibold text-brand-dark-soft">
                      {new Date(file.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} | {file.size_label}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => onDownloadBackup?.(file.filename)} disabled={Boolean(backupBusy)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand-dark-light px-3 py-2 text-xs font-bold text-brand-dark disabled:opacity-60">
                        <Download size={13} /> Download
                      </button>
                      <button type="button" onClick={() => setRestoreTarget?.(file)} disabled={Boolean(backupBusy)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
                        <RotateCcw size={13} /> Restore
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {restoreTarget && (
        <div className="fixed inset-0 z-[220] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/40 p-4 backdrop-blur-sm" onClick={() => setRestoreTarget?.(null)}>
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="bg-amber-500 px-5 py-3.5">
              <h3 className="text-sm font-bold text-white">Restore Database Backup</h3>
            </div>
            <div className="px-5 py-5">
              <p className="text-sm text-brand-dark">
                This will replace the current database records with <strong>{restoreTarget.filename}</strong>.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setRestoreTarget?.(null)}
                  className="rounded-xl border border-brand-dark-light py-2 text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-dark/5">
                  Cancel
                </button>
                <button type="button" onClick={onRestoreBackup} disabled={backupBusy === `restore:${restoreTarget.filename}`}
                  className="rounded-xl bg-amber-500 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-60">
                  {backupBusy === `restore:${restoreTarget.filename}` ? 'Restoring...' : 'Restore'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-brand-dark-light bg-white shadow-sm">
        <div className="bg-brand-teal-light px-4 py-3">
          <div className="flex items-center gap-2">
            <Archive size={14} className="text-brand-teal" />
            <h2 className="text-sm font-bold text-brand-teal-dark">Archived Records</h2>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-b border-brand-dark-light p-3">
          {ENTITY_TABS.map((tab) => (
            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
              className={`rounded-xl border px-2 py-2 text-xs font-bold transition-colors ${tab.key === 'appointments' ? 'col-span-2' : ''} ${
                activeTab === tab.key
                  ? 'border-brand-teal bg-brand-teal text-white'
                  : 'border-brand-dark-light bg-white text-brand-dark-soft'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-brand-surface/40 p-3">
          <MobileArchivedRecords key={activeTab} type={activeTab} />
        </div>
      </section>
    </div>
  );
}
