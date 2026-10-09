import { AdminSkeleton, AdminLoadState } from '../../../components/admin/AdminLoading';
import useAdminQuery from '../../../hooks/useAdminQuery';
import { adminJson } from '../../../api/adminData';
import { useState } from 'react';
import { Archive, Database, Download, FileDown, FileSpreadsheet, RefreshCw, RotateCcw, Trash2, Upload } from 'lucide-react';
import { apiFetch } from '../../../api/apiClient';
import useMediaQuery from '../../../hooks/useMediaQuery';
import SettingsBackupPage_MobileView from './mobile/SettingsBackupPage_MobileView';
import FormatDropdown from '../../../components/FormatDropdown';
import AssessmentFormTemplateDownload from './AssessmentFormTemplateDownload';

const ENTITY_TABS = [
  { key: 'customers',    label: 'Customers' },
  { key: 'staff',        label: 'Staff' },
  { key: 'pets',         label: 'Pets' },
  { key: 'inventory',    label: 'Inventory' },
  { key: 'services',     label: 'Services' },
  { key: 'appointments', label: 'Appointments' },
];

const EMPTY = '-';
const titleCase = (value) => String(value || '').replace(/\b\w/g, (letter) => letter.toUpperCase()) || EMPTY;

const IMPORT_TEMPLATES = {
  owners: {
    filename: 'pawsitivecare-owners-template.csv',
    headers: ['owner_email', 'first_name', 'last_name', 'phone', 'address'],
    example: ['owner@example.com', 'Juan', 'Dela Cruz', '09171234567', 'Complete address'],
  },
  pets: {
    filename: 'pawsitivecare-pets-template.csv',
    headers: ['owner_email', 'name', 'species', 'breed', 'sex', 'date_of_birth', 'weight_kg', 'medical_notes', 'photo_url'],
    example: ['owner@example.com', 'Buddy', 'Dog', 'Labrador', 'Male', '2022-01-15', '12.5', 'Optional notes', ''],
  },
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

const COLUMNS = {
  customers: [
    { label: 'Name',    render: (r) => `${r.first_name || ''} ${r.last_name || ''}`.trim() || EMPTY },
    { label: 'Email',   render: (r) => r.email   || EMPTY },
    { label: 'Phone',   render: (r) => r.phone   || EMPTY },
    { label: 'Deleted', render: (r) => r.deleted_at ? new Date(r.deleted_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }) : EMPTY },
  ],
  staff: [
    { label: 'Name',    render: (r) => r.name     || EMPTY },
    { label: 'Email',   render: (r) => r.email    || EMPTY },
    { label: 'Role',    render: (r) => titleCase(r.staff_type || r.role) },
    { label: 'Deleted', render: (r) => r.deleted_at ? new Date(r.deleted_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }) : EMPTY },
  ],
  pets: [
    { label: 'Name',    render: (r) => r.name || EMPTY },
    { label: 'Owner',   render: (r) => r.owner ? `${r.owner.first_name} ${r.owner.last_name}`.trim() : EMPTY },
    { label: 'Species', render: (r) => r.species_type?.name || EMPTY },
    { label: 'Deleted', render: (r) => r.deleted_at ? new Date(r.deleted_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }) : EMPTY },
  ],
  inventory: [
    { label: 'Item',     render: (r) => r.item_name        || EMPTY },
    { label: 'Category', render: (r) => r.category         || EMPTY },
    { label: 'Stock',    render: (r) => r.stock_quantity ?? EMPTY },
    { label: 'Deleted',  render: (r) => r.deleted_at ? new Date(r.deleted_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }) : EMPTY },
  ],
  services: [
    { label: 'Name',     render: (r) => r.name     || EMPTY },
    { label: 'Category', render: (r) => r.category || EMPTY },
    { label: 'Deleted',  render: (r) => r.deleted_at ? new Date(r.deleted_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }) : EMPTY },
  ],
  appointments: [
    { label: 'Code',    render: (r) => r.appointment_code || EMPTY },
    { label: 'Pet',     render: (r) => r.pet?.name        || EMPTY },
    { label: 'Service', render: (r) => r.service?.name    || EMPTY },
    { label: 'Date',    render: (r) => r.appointment_date || EMPTY },
    { label: 'Deleted', render: (r) => r.deleted_at ? new Date(r.deleted_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }) : EMPTY },
  ],
};

function TemplatesPanel() {
  return (
    <div className="mx-auto w-full max-w-[1736px] px-0 pb-10 pt-4">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-brand-teal-dark">Download <span className="text-brand-dark">Templates</span></h1>
        <p className="text-sm text-brand-dark-soft">Download reusable data and pet assessment templates.</p>
      </div>
      <section className="overflow-hidden rounded-2xl border border-brand-dark-light bg-white shadow-[0_6px_12px_rgba(23,53,81,0.06)]">
        <div className="flex items-center gap-2 bg-brand-teal-light px-5 py-3">
          <FileSpreadsheet size={14} className="text-brand-teal" />
          <h2 className="text-sm font-bold text-brand-teal-dark">Available Templates</h2>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {Object.entries(IMPORT_TEMPLATES).map(([key]) => (
            <button
              key={key}
              type="button"
              onClick={() => downloadImportTemplate(key)}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-brand-teal/30 bg-brand-teal/10 px-4 py-3 text-sm font-bold text-brand-teal-dark transition-colors hover:bg-brand-teal hover:text-white"
            >
              <Download size={16} aria-hidden="true" />
              Download {key === 'owners' ? 'Owners' : 'Pets'} Template
            </button>
          ))}
          <AssessmentFormTemplateDownload />
        </div>
      </section>
    </div>
  );
}

function TrashedTable({ type }) {
  const archiveQuery = useAdminQuery(`archives:${type}`, async () => {
    const json = await adminJson(`/api/admin/trashed/${type}`);
    return json.data || json || [];
  }, []);
  const { data: records, setData: setRecords, loading, refresh: load } = archiveQuery;
  const [error, setError] = useState('');
  const [restoring, setRestoring] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const restore = async (id) => {
    setRestoring(id);
    try {
      await apiFetch(`/api/admin/trashed/${type}/${id}/restore`, { method: 'POST' });
      setRecords((prev) => prev.filter((r) => r.id !== id));
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
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError('Failed to delete record.');
    } finally {
      setDeleting(null);
    }
  };

  const cols = COLUMNS[type] || [];

  if (loading) return <AdminSkeleton label="Loading archived records" />;
  if (archiveQuery.error && !archiveQuery.loaded) return <AdminLoadState error={archiveQuery.error} onRetry={load} />;

  if (error) return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
  );

  if (records.length === 0) return (
    <div className="rounded-xl border border-brand-teal/20 bg-brand-teal-light/10 py-10 text-center">
      <Archive size={28} className="mx-auto mb-2 text-brand-dark-soft/40" />
      <p className="text-sm font-bold text-brand-dark-soft">No archived records</p>
      <p className="text-xs text-brand-dark-soft/60">All records in this category are active.</p>
    </div>
  );

  return (
    <>
      <AdminLoadState loading={archiveQuery.refreshing} error={archiveQuery.error} onRetry={load} />
      {confirmDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-brand-dark/40 p-4 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-red-500 px-5 py-3.5">
              <h3 className="text-sm font-bold text-white">Delete Permanently</h3>
            </div>
            <div className="px-5 py-5">
              <p className="text-sm text-brand-dark">This record will be <strong>permanently deleted</strong>. This action cannot be undone.</p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setConfirmDelete(null)}
                  className="flex-1 rounded-xl border border-brand-dark-light py-2 text-sm font-medium text-brand-dark-soft transition-colors hover:bg-brand-dark-light">
                  Cancel
                </button>
                <button type="button" onClick={() => forceDelete(confirmDelete)}
                  className="flex-1 rounded-xl bg-red-500 py-2 text-sm font-bold text-white hover:bg-red-600">
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-brand-teal/20">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-brand-teal/15 bg-brand-teal-light/30">
              {cols.map((c) => (
                <th key={c.label} className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-wider text-brand-dark">
                  {c.label}
                </th>
              ))}
              <th className="px-4 py-3 text-center text-[11px] font-extrabold uppercase tracking-wider text-brand-dark">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-teal/10 bg-white">
            {records.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-brand-teal-light/10">
                {cols.map((c) => (
                  <td key={c.label} className="whitespace-nowrap px-4 py-3 text-sm text-brand-dark">
                    {c.render(r)}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button type="button" onClick={() => restore(r.id)} disabled={restoring === r.id || deleting === r.id}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand-teal/30 bg-brand-teal/10 text-brand-teal transition-colors hover:bg-brand-teal hover:text-white disabled:opacity-50" title="Restore record" aria-label="Restore record">
                      <RotateCcw size={14} />
                    </button>
                    <button type="button" onClick={() => setConfirmDelete(r.id)} disabled={restoring === r.id || deleting === r.id}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50" title="Delete permanently" aria-label="Delete permanently">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function SettingsBackupPage({ mode = 'all' }) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [activeTab, setActiveTab] = useState('customers');
  const backupQuery = useAdminQuery('backup-files', async () => {
    const json = await adminJson('/api/admin/backup/files');
    return json.data || [];
  }, []);
  const { data: backupFiles, loading: backupLoading, refresh: loadBackupFiles } = backupQuery;
  const [backupBusy, setBackupBusy] = useState('');
  const [backupError, setBackupError] = useState('');
  const [backupNotice, setBackupNotice] = useState('');
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [createFormat, setCreateFormat] = useState('json');
  const [uploadFormat, setUploadFormat] = useState('json');
  const [exportFormat, setExportFormat] = useState('csv');

  if (mode === 'templates') return <TemplatesPanel />;



  const handleCreateBackup = async (format = createFormat, download = false) => {
    setBackupBusy(`create:${format}`);
    setBackupError('');
    setBackupNotice('');
    try {
      const query = format === 'csv' ? '?format=csv' : '';
      const res = await apiFetch(`/api/admin/backup/files${query}`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Backup failed.');
      if (download && json?.data?.filename) {
        await handleDownloadBackup(json.data.filename);
        setBackupNotice(`${format.toUpperCase()} export downloaded.`);
      } else {
        setBackupNotice(`${format.toUpperCase()} backup created.`);
      }
      await loadBackupFiles();
    } catch (error) {
      setBackupError(error?.message || 'Backup failed. Please try again.');
    } finally {
      setBackupBusy('');
    }
  };

  const handleUploadBackup = async (file) => {
    if (!file) return;
    setBackupBusy('upload');
    setBackupError('');
    setBackupNotice('');
    try {
      const body = new FormData();
      body.append('backup', file);
      const res = await apiFetch('/api/admin/backup/upload', { method: 'POST', body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Upload failed.');
      setBackupNotice('Backup uploaded and saved.');
      await loadBackupFiles();
    } catch (error) {
      setBackupError(error?.message || 'Upload failed. Please use a valid JSON backup file.');
    } finally {
      setBackupBusy('');
    }
  };

  const handleExportCsv = async () => {
    setBackupBusy('csv');
    setBackupError('');
    setBackupNotice('');
    try {
      const res = await apiFetch('/api/admin/backup/export');
      if (!res.ok) throw new Error('CSV export failed.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'pawsitivecare-backup.csv';
      link.click();
      URL.revokeObjectURL(url);
      setBackupNotice('CSV export downloaded.');
    } catch (error) {
      setBackupError(error?.message || 'CSV export failed.');
    } finally {
      setBackupBusy('');
    }
  };

  const handleExport = () => exportFormat === 'json'
    ? handleCreateBackup('json', true)
    : handleExportCsv();

  const handleDownloadBackup = async (filename) => {
    setBackupBusy(`download:${filename}`);
    setBackupError('');
    try {
      const res = await apiFetch(`/api/admin/backup/files/${encodeURIComponent(filename)}/download`);
      if (!res.ok) throw new Error('Download failed.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setBackupError(error?.message || 'Download failed.');
    } finally {
      setBackupBusy('');
    }
  };

  const handleRestoreBackup = async () => {
    if (!restoreTarget) return;
    setBackupBusy(`restore:${restoreTarget.filename}`);
    setBackupError('');
    setBackupNotice('');
    try {
      const res = await apiFetch(`/api/admin/backup/files/${encodeURIComponent(restoreTarget.filename)}/restore`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Restore failed.');
      setBackupNotice('Database restored successfully.');
      setRestoreTarget(null);
    } catch (error) {
      setBackupError(error?.message || 'Restore failed. Please try again.');
    } finally {
      setBackupBusy('');
    }
  };

  if (!isDesktop) {
    return (
      <SettingsBackupPage_MobileView
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        backupFiles={backupFiles}
        backupLoading={backupLoading}
        backupRefreshing={backupQuery.refreshing}
        onRetryBackups={loadBackupFiles}
        backupBusy={backupBusy}
        backupError={backupError || backupQuery.error}
        backupNotice={backupNotice}
        restoreTarget={restoreTarget}
        setRestoreTarget={setRestoreTarget}
        onCreateBackup={handleCreateBackup}
        onUploadBackup={handleUploadBackup}
        onExport={handleExport}
        createFormat={createFormat}
        setCreateFormat={setCreateFormat}
        uploadFormat={uploadFormat}
        setUploadFormat={setUploadFormat}
        exportFormat={exportFormat}
        setExportFormat={setExportFormat}
        onDownloadBackup={handleDownloadBackup}
        onRestoreBackup={handleRestoreBackup}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1736px] px-0 pb-10 pt-4">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-teal-dark">
            Backup <span className="text-brand-dark">&amp; Recovery</span>
          </h1>
          <p className="text-sm text-brand-dark-soft">Create backups and restore archived records</p>
        </div>
      </div>

      <section className="mb-5 overflow-hidden rounded-2xl border border-brand-dark-light bg-white shadow-[0_6px_12px_rgba(23,53,81,0.06)]">
        <div className="flex items-center gap-2 bg-brand-teal-light px-5 py-3">
          <Database size={14} className="text-brand-teal" />
          <h2 className="text-sm font-bold text-brand-teal-dark">Database Backup</h2>
        </div>
        <div className="grid grid-cols-[minmax(420px,0.5fr)_minmax(0,1fr)] gap-5 p-5">
          <div className="flex flex-col justify-between rounded-xl border border-brand-teal/15 bg-brand-teal/5 p-4">
            <div>
            {mode !== 'backup' && <div className="mb-5 rounded-xl border border-brand-teal/20 bg-white p-3">
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
            </div>}
            <p className="text-base font-extrabold text-brand-dark">Create or upload a backup</p>
            <p className="mt-1 text-xs leading-relaxed text-brand-dark-soft">Save a complete copy of the current system, or upload an existing JSON backup for later recovery.</p>
            {backupError && <p className="mt-1 text-xs font-semibold text-red-500">{backupError}</p>}
            {backupNotice && <p className="mt-1 text-xs font-semibold text-emerald-600">{backupNotice}</p>}
            </div>
          <div className="mt-5 grid grid-cols-1 gap-2">
            <div className="flex min-w-0 rounded-xl bg-brand-teal">
              <button type="button" onClick={() => handleCreateBackup()} disabled={Boolean(backupBusy)}
                className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-l-xl px-3 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-teal-dark disabled:opacity-60">
                <Database size={15} className="shrink-0" />
                {backupBusy === `create:${createFormat}` ? 'Creating...' : 'Create Backup'}
              </button>
              <FormatDropdown value={createFormat} onChange={setCreateFormat} label="Create backup format" />
            </div>
            <div className={`flex min-w-0 rounded-xl border border-brand-teal bg-brand-teal transition-colors hover:bg-brand-teal-dark ${backupBusy ? 'pointer-events-none opacity-60' : ''}`}>
              <label className="inline-flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-l-xl px-2 py-2.5 text-sm font-bold text-white">
                <Upload size={15} />
                Upload {uploadFormat.toUpperCase()}
                <input
                  type="file"
                  accept={uploadFormat === 'csv' ? '.csv,text/csv' : '.json,application/json'}
                  className="hidden"
                  onChange={(event) => {
                    handleUploadBackup(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
              </label>
              <FormatDropdown value={uploadFormat} onChange={setUploadFormat} label="Upload backup format" />
            </div>
            <div className="flex min-w-0 rounded-xl border border-brand-teal bg-brand-teal">
              <button type="button" onClick={handleExport} disabled={Boolean(backupBusy)}
                className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-l-xl bg-brand-teal px-2 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-teal-dark disabled:opacity-60">
              <FileSpreadsheet size={15} />
                {backupBusy === 'csv' || backupBusy === 'create:json' ? 'Exporting...' : `Export ${exportFormat.toUpperCase()}`}
              </button>
              <FormatDropdown value={exportFormat} onChange={setExportFormat} label="Export backup format" />
            </div>
          </div>
          </div>
          <div className="rounded-xl border border-brand-dark-light">
            <div className="flex items-center justify-between border-b border-brand-dark-light px-4 py-2.5">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-brand-dark">Saved Backups</p>
                <p className="mt-0.5 text-[10px] font-semibold text-brand-dark-soft">{backupFiles.length} file{backupFiles.length === 1 ? '' : 's'} available</p>
              </div>
              <button type="button" onClick={loadBackupFiles} disabled={backupLoading || Boolean(backupBusy)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-brand-teal hover:bg-brand-teal/10 disabled:opacity-60"><RefreshCw size={12} /> Refresh</button>
            </div>
            <AdminLoadState loading={backupQuery.refreshing} error={backupQuery.error} onRetry={loadBackupFiles} />
            {backupLoading ? (
              <AdminSkeleton label="Loading backups" rows={3} />
            ) : backupQuery.error && backupFiles.length === 0 ? null : backupFiles.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs font-semibold text-brand-dark-soft">No database backups yet.</p>
            ) : (
              <div className="divide-y divide-brand-dark-light">
                {backupFiles.map((file) => (
                  <div key={file.filename} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-brand-dark">{file.filename}</p>
                      <p className="text-[11px] text-brand-dark-soft">{new Date(file.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} | {file.size_label}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button type="button" onClick={() => handleDownloadBackup(file.filename)} disabled={Boolean(backupBusy)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-dark-light px-3 py-1.5 text-[11px] font-bold text-brand-dark hover:bg-brand-surface disabled:opacity-60">
                        <Download size={12} /> Download
                      </button>
                      <button type="button" onClick={() => setRestoreTarget(file)} disabled={Boolean(backupBusy)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-amber-600 disabled:opacity-60">
                        <RotateCcw size={12} /> Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {restoreTarget && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-brand-dark/40 p-4 backdrop-blur-sm" onClick={() => setRestoreTarget(null)}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="bg-amber-500 px-5 py-3.5">
              <h3 className="text-sm font-bold text-white">Restore Database Backup</h3>
            </div>
            <div className="px-5 py-5">
              <p className="text-sm text-brand-dark">
                This will replace the current database records with <strong>{restoreTarget.filename}</strong>. Create a fresh backup first if you need the current data.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setRestoreTarget(null)}
                  className="rounded-xl border border-brand-dark-light py-2 text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-dark/5">
                  Cancel
                </button>
                <button type="button" onClick={handleRestoreBackup} disabled={backupBusy === `restore:${restoreTarget.filename}`}
                  className="rounded-xl bg-amber-500 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-60">
                  {backupBusy === `restore:${restoreTarget.filename}` ? 'Restoring...' : 'Restore'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-brand-dark-light bg-white shadow-[0_6px_12px_rgba(23,53,81,0.06)]">
        <div className="bg-brand-teal-light px-5 py-3">
          <div className="flex items-center gap-2">
            <Archive size={14} className="text-brand-teal" />
            <h2 className="text-sm font-bold text-brand-teal-dark">Archived Records</h2>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-brand-dark-light px-5 py-3">
          {ENTITY_TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setActiveTab(t.key)}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition-colors ${
                activeTab === t.key
                  ? 'border-brand-teal bg-brand-teal text-white'
                  : 'border-brand-dark-light bg-white text-brand-dark-soft hover:border-brand-teal/40 hover:text-brand-dark'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          <TrashedTable key={activeTab} type={activeTab} />
        </div>
      </section>
    </div>
  );
}
