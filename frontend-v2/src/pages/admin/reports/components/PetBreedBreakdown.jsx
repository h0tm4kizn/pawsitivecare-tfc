import { useEffect, useState } from "react";
import { apiFetch } from "../../../../api/apiClient";
import { formatReportBreed, getSpeciesSortRank } from "../reportUtils";

export default function PetBreedBreakdown({ selMonth, selYear }) {
  const [breedData, setBreedData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchBreedData = async () => {
      setLoading(true);
      try {
        const monthIndex = selMonth + 1;
        const start = `${selYear}-${String(monthIndex).padStart(2, "0")}-01`;
        const lastDay = new Date(selYear, monthIndex, 0).getDate();
        const end = `${selYear}-${String(monthIndex).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

        const response = await apiFetch(
          `/api/pets?start_date=${start}&end_date=${end}&per_page=1000`,
        );
        const json = await response.json();
        const items = json.data?.data || json.data || [];

        const breedCounts = {};
        items.forEach((pet) => {
          const breed = formatReportBreed(pet);
          const species = pet.species_type?.name || "Unknown";
          const key = `${breed}|${species}`;
          if (!breedCounts[key]) {
            breedCounts[key] = { breed, species, count: 0 };
          }
          breedCounts[key].count++;
        });

        const sorted = Object.values(breedCounts).sort((a, b) => {
          const speciesA = getSpeciesSortRank(a.species);
          const speciesB = getSpeciesSortRank(b.species);
          if (speciesA !== speciesB) return speciesA - speciesB;
          if (b.count !== a.count) return b.count - a.count;
          return a.breed.localeCompare(b.breed);
        });
        setBreedData(sorted);
      } catch (err) {
        console.error("Failed to fetch breed data:", err);
        setBreedData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBreedData();
  }, [selMonth, selYear]);

  return (
    <div>
      <h4 className="text-xs font-bold uppercase text-brand-dark-soft mb-3">
        Breed Breakdown
      </h4>
      {loading ? (
        <div className="py-4 text-center text-sm text-brand-dark-soft">
          Loading breeds...
        </div>
      ) : breedData.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-brand-teal/10">
          {Object.entries(
            breedData.reduce((groups, item) => {
              (groups[item.species] ||= []).push(item);
              return groups;
            }, {}),
          ).map(([species, breeds]) => (
            <div
              key={species}
              className="border-b border-brand-teal/10 last:border-b-0"
            >
              <div className="flex items-center justify-between bg-gray-50 px-3 py-2">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                    species.toLowerCase() === "dog"
                      ? "bg-brand-teal/10 text-brand-teal"
                      : species.toLowerCase() === "cat"
                        ? "bg-amber-50 text-amber-600"
                        : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {species}
                </span>
                <span className="text-[11px] font-semibold text-brand-dark-soft">
                  {breeds.reduce((sum, item) => sum + item.count, 0)} pets
                </span>
              </div>
              <div className="divide-y divide-brand-teal/5">
                {breeds.map((item) => (
                  <div
                    key={`${item.breed}-${item.species}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 text-sm"
                  >
                    <span className="font-medium text-brand-dark">
                      {item.breed}
                    </span>
                    <span className="font-bold text-brand-dark">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-brand-dark-soft">
          No breed data available for this period
        </p>
      )}
    </div>
  );
}
