import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet } from '../../../api/apiClient';

export default function useAssessmentHistory() {
  const [showAssessmentPicker, setShowAssessmentPicker] = useState(false);
  const [tooltip, setTooltip] = useState('');
  const [assessmentPets, setAssessmentPets] = useState([]);
  const [assessmentPet, setAssessmentPet] = useState(null);
  const [historyPet, setHistoryPet] = useState(null);
  const [historyForms, setHistoryForms] = useState([]);
  const [selectedHistoryForm, setSelectedHistoryForm] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [petsLoading, setPetsLoading] = useState(false);
  const [, setAssessmentStatus] = useState({});

  const assessmentPickerRef = useRef(null);

  // Close assessment picker on outside click without blocking scroll
  useEffect(() => {
    if (!showAssessmentPicker) return;
    const handler = (e) => {
      if (e.target?.closest?.('[data-assessment-picker]')) return;
      if (assessmentPickerRef.current && !assessmentPickerRef.current.contains(e.target)) {
        setShowAssessmentPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [showAssessmentPicker]);

  const openAssessment = useCallback(() => {
    setHistoryPet(null);
    setHistoryForms([]);
    setSelectedHistoryForm(null);
    setAssessmentStatus({});
    setShowAssessmentPicker(true);
    setPetsLoading(true);
    const todayDate = new Date().toISOString().slice(0, 10);
    apiGet('/api/my-pets')
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => {
        const pets = Array.isArray(d.data) ? d.data : [];
        setAssessmentPets(pets);
        pets.forEach((p) => {
          apiGet(`/api/my-pets/${p.id}/health-form`)
            .then((r) => (r.ok ? r.json() : { data: null }))
            .then((d) => {
              const f = d?.data;
              const createdDate = String(f?.created_at || f?.updated_at || '').slice(0, 10);
              const done = !!(f && createdDate === todayDate && f.is_vaccinated && f.is_friendly && f.declaration_accepted);
              setAssessmentStatus((prev) => ({ ...prev, [p.id]: done }));
            })
            .catch(() => {});
        });
      })
      .catch(() => {})
      .finally(() => setPetsLoading(false));
  }, []);

  const loadHistory = (pet) => {
    setHistoryPet(pet);
    setSelectedHistoryForm(null);
    setHistoryLoading(true);
    setHistoryForms([]);
    apiGet(`/api/my-pets/${pet.id}/health-form/history`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => {
        const raw = d?.data?.data ?? d?.data?.forms ?? d?.data ?? d?.forms ?? d ?? [];
        setHistoryForms(Array.isArray(raw) ? raw : []);
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  };

  return {
    showAssessmentPicker,
    setShowAssessmentPicker,
    tooltip,
    setTooltip,
    assessmentPets,
    assessmentPet,
    setAssessmentPet,
    historyPet,
    setHistoryPet,
    historyForms,
    selectedHistoryForm,
    setSelectedHistoryForm,
    historyLoading,
    petsLoading,
    assessmentPickerRef,
    openAssessment,
    loadHistory,
  };
}
