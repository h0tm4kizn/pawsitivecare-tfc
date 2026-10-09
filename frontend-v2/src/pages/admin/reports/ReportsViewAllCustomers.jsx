import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../../api/apiClient';
import { AdminSkeleton } from '../../../components/admin/AdminLoading';
import SelectDropdown from '../../../components/reusable-ui/SelectDropdown';
import ReportsTableFilterSort from './ReportsTableFilterSort';

const formatOwnerPets = (owner) => {
  const pets = Array.isArray(owner?.pets) ? owner.pets : [];
  return pets.map((pet) => pet.name || pet.pet_id).filter(Boolean).join(', ') || '—';
};

export default function ReportsViewAllCustomers({ isOpen, onClose, period, month, year }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    if (isOpen && month && year) {
      fetchCustomers();
    } else {
      setCustomers([]);
    }
  }, [isOpen, period, month, year]);

  const fetchCustomers = async () => {
    setLoading(true);
    setCustomers([]);
    try {
      const monthIndex = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].indexOf(month) + 1;
      
      let startDate, endDate;
      if (period === 'This Month') {
        startDate = `${year}-${String(monthIndex).padStart(2, '0')}-01`;
        const lastDay = new Date(year, monthIndex, 0).getDate();
        endDate = `${year}-${String(monthIndex).padStart(2, '0')}-${lastDay}`;
      } else {
        const weekNum = parseInt(period.replace('Week ', ''));
        const weekStart = (weekNum - 1) * 7 + 1;
        const weekEnd = Math.min(weekNum * 7, new Date(year, monthIndex, 0).getDate());
        startDate = `${year}-${String(monthIndex).padStart(2, '0')}-${String(weekStart).padStart(2, '0')}`;
        endDate = `${year}-${String(monthIndex).padStart(2, '0')}-${String(weekEnd).padStart(2, '0')}`;
      }

      const response = await apiFetch(`/api/owners?start_date=${startDate}&end_date=${endDate}&per_page=100`);
      const data = await response.json();
      
      let customersList = [];
      if (data && data.data) {
        if (Array.isArray(data.data.data)) {
          customersList = data.data.data;
        } else if (Array.isArray(data.data)) {
          customersList = data.data;
        }
      } else if (Array.isArray(data)) {
        customersList = data;
      }
      
      setCustomers(customersList);
    } catch (error) {
      console.error('Error fetching customers:', error);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  const sortedCustomers = [...customers].sort((a, b) => sortBy === 'name'
    ? `${a.first_name || ''} ${a.last_name || ''}`.localeCompare(`${b.first_name || ''} ${b.last_name || ''}`)
    : String(b.created_at || '').localeCompare(String(a.created_at || '')));

  return (
    <div className="fixed inset-0 z-[320] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen">
      <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-brand-teal/10 bg-brand-teal px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">Customers - {period}</h2>
            <p className="text-sm text-white/80">{month} {year}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-white transition-colors hover:bg-white/20">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          {loading ? (
            <AdminSkeleton variant="table" label="Loading customers" />
          ) : (
            <div className="space-y-4">
              <ReportsTableFilterSort>
                <div className="sm:col-span-2"><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-brand-dark-soft">Sort by</p><SelectDropdown value={sortBy} onChange={setSortBy} options={[{ value: 'newest', label: 'Newest registered' }, { value: 'name', label: 'Customer name' }]} buttonClassName="!rounded-lg !border-brand-teal/20 !px-2.5 !py-1.5" textClassName="!text-xs !font-semibold" /></div>
              </ReportsTableFilterSort>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-teal/10 bg-gray-50">
                      <th className="px-3 py-2 text-left text-xs font-bold uppercase text-brand-dark-soft">ID</th>
                      <th className="px-3 py-2 text-left text-xs font-bold uppercase text-brand-dark-soft">Name</th>
                      <th className="px-3 py-2 text-left text-xs font-bold uppercase text-brand-dark-soft">Email</th>
                      <th className="px-3 py-2 text-left text-xs font-bold uppercase text-brand-dark-soft">Phone</th>
                      <th className="px-3 py-2 text-left text-xs font-bold uppercase text-brand-dark-soft">Pets</th>
                      <th className="px-3 py-2 text-left text-xs font-bold uppercase text-brand-dark-soft">Registered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!Array.isArray(customers) || customers.length === 0 ? (
                      <tr className="border-b border-brand-teal/5">
                        <td colSpan="6" className="px-3 py-8 text-center text-sm text-brand-dark-soft">
                          No customers found for this period.
                        </td>
                      </tr>
                    ) : (
                      sortedCustomers.map((customer) => (
                        <tr key={customer.id} className="border-b border-brand-teal/5 hover:bg-gray-50">
                          <td className="px-3 py-3 text-brand-dark">{customer.display_id || '-'}</td>
                          <td className="px-3 py-3 font-medium text-brand-dark">
                            {`${customer.first_name || ''} ${customer.last_name || ''}`.trim() || '-'}
                          </td>
                          <td className="px-3 py-3 text-brand-dark">{customer.email || '-'}</td>
                          <td className="px-3 py-3 text-brand-dark">{customer.phone || '-'}</td>
                          <td className="max-w-[180px] px-3 py-3 text-brand-dark" title={formatOwnerPets(customer)}>{formatOwnerPets(customer)}</td>
                          <td className="px-3 py-3 text-brand-dark">
                            {customer.created_at ? new Date(customer.created_at).toLocaleDateString('en-US', { timeZone: 'Asia/Manila',  month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-right text-[11px] italic text-brand-dark-soft">{customers.length} customer(s) shown for {period}, {month} {year}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
