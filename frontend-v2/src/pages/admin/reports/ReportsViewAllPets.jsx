import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../../api/apiClient';
import { AdminSkeleton } from '../../../components/admin/AdminLoading';
import SelectDropdown from '../../../components/reusable-ui/SelectDropdown';
import ReportsTableFilterSort from './ReportsTableFilterSort';
import { sanitizeText } from '../../../utils/textUtils';

const getPetIdentifier = (pet) => pet?.pet_id || '';
const getPetName = (pet) => pet?.name || '-';
const getSpeciesName = (pet) => sanitizeText(pet?.speciesType?.name || pet?.species_type?.name || pet?.species || '-');
const getBreedName = (pet) => {
  const breed = String(pet?.breed?.name || pet?.breed_name || pet?.breed || '').trim();
  const isOtherBreed = /^(other|others)(\s*\(please specify\))?$/i.test(breed);
  if (!isOtherBreed) return sanitizeText(breed || '-');

  const match = String(pet?.medical_notes || '').match(/^Other Breed:\s*(.+?)\s*$/im);
  const customBreed = match?.[1]?.trim();
  return sanitizeText(customBreed ? `Others: ${customBreed}` : 'Others');
};
const getOwnerName = (owner) => {
  const fullName = `${owner?.first_name || ''} ${owner?.last_name || ''}`.trim();
  return fullName || owner?.name || owner?.email || '-';
};
const getOwnerEmail = (owner) => owner?.email || '';

export default function ReportsViewAllPets({ isOpen, onClose, period, month, year }) {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    if (isOpen && month && year) {
      fetchPets();
    } else {
      setPets([]);
    }
  }, [isOpen, period, month, year]);

  const fetchPets = async () => {
    setLoading(true);
    setPets([]);
    try {
      const monthIndex = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].indexOf(month) + 1;
      
      let startDate, endDate;
      if (period === 'All Weeks' || period === 'This Month') {
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

      const response = await apiFetch(`/api/pets?start_date=${startDate}&end_date=${endDate}&per_page=100`);
      const data = await response.json();
      
      let petsList = [];
      if (data && data.data) {
        if (Array.isArray(data.data.data)) {
          petsList = data.data.data;
        } else if (Array.isArray(data.data)) {
          petsList = data.data;
        }
      } else if (Array.isArray(data)) {
        petsList = data;
      }
      
      setPets(petsList);
    } catch (error) {
      console.error('Error fetching pets:', error);
      setPets([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  const sortedPets = [...pets].sort((a, b) => {
    if (sortBy === 'name') return getPetName(a).localeCompare(getPetName(b));
    if (sortBy === 'owner') {
      const ownerOrder = getOwnerName(a.owner).localeCompare(getOwnerName(b.owner));
      return ownerOrder || getPetName(a).localeCompare(getPetName(b));
    }
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });

  return (
    <div className="fixed inset-0 z-[320] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen">
      <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-brand-teal/10 bg-brand-teal px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">Pets - {period}</h2>
            <p className="text-sm text-white/80">{month} {year}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-white transition-colors hover:bg-white/20">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          {loading ? (
            <AdminSkeleton variant="table" label="Loading pets" />
          ) : (
            <div className="space-y-4">
              <ReportsTableFilterSort>
                <div className="sm:col-span-2"><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-brand-dark-soft">Sort by</p><SelectDropdown value={sortBy} onChange={setSortBy} options={[{ value: 'newest', label: 'Newest registered' }, { value: 'name', label: 'Pet name' }, { value: 'owner', label: 'Owner (A–Z)' }]} buttonClassName="!rounded-lg !border-brand-teal/20 !px-2.5 !py-1.5" textClassName="!text-xs !font-semibold" /></div>
              </ReportsTableFilterSort>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-teal/10 bg-gray-50">
                      <th className="px-3 py-2 text-left text-xs font-bold uppercase text-brand-dark-soft">Pet</th>
                      <th className="px-3 py-2 text-left text-xs font-bold uppercase text-brand-dark-soft">Species</th>
                      <th className="px-3 py-2 text-left text-xs font-bold uppercase text-brand-dark-soft">Breed</th>
                      <th className="px-3 py-2 text-left text-xs font-bold uppercase text-brand-dark-soft">Owner</th>
                      <th className="px-3 py-2 text-left text-xs font-bold uppercase text-brand-dark-soft">Registered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!Array.isArray(pets) || pets.length === 0 ? (
                      <tr className="border-b border-brand-teal/5">
                        <td colSpan="5" className="px-3 py-8 text-center text-sm text-brand-dark-soft">
                          No pets found for this period.
                        </td>
                      </tr>
                    ) : (
                      sortedPets.map((pet) => (
                        <tr key={pet.id} className="border-b border-brand-teal/5 hover:bg-gray-50">
                          <td className="px-3 py-3">
                            <p className="truncate text-sm font-bold uppercase leading-tight text-brand-dark">{getPetName(pet)}</p>
                            <p className="mt-0.5 truncate text-[11px] font-semibold text-brand-dark-soft">
                              {getPetIdentifier(pet) || 'No pet ID'}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-flex rounded-full bg-brand-teal/10 px-2 py-1 text-xs font-bold text-brand-teal-dark">
                              {getSpeciesName(pet)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-brand-dark">{getBreedName(pet)}</td>
                          <td className="px-3 py-3">
                            <p className="truncate text-sm font-bold uppercase leading-tight text-brand-dark">{getOwnerName(pet.owner)}</p>
                            <p className="mt-0.5 truncate text-[11px] font-semibold text-brand-dark-soft">
                              {getOwnerEmail(pet.owner) || 'No email'}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-brand-dark">
                            {pet.created_at ? new Date(pet.created_at).toLocaleDateString('en-US', { timeZone: 'Asia/Manila',  month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-right text-[11px] italic text-brand-dark-soft">{pets.length} pet(s) shown for {period}, {month} {year}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
