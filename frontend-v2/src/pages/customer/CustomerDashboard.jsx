import { useAuthStore } from '../../stores/authStore';
import { Suspense, lazy, useState, useEffect, useCallback } from 'react';
import { apiGet } from '../../api/apiClient';
import { db } from '../../utils/powersync/db';
import { useStatus } from '@powersync/react';
import ClientSidebar from './ClientSidebar';
import Loading from '../../components/Loading';
import useMediaQuery from '../../hooks/useMediaQuery';
import { dashboardBackground } from './dashboard/dashboardConstants';

const ServiceSection = lazy(() => import('./dashboard/ServiceSection'));
const AppointmentSection = lazy(() => import('./dashboard/AppointmentSection'));
const PetSidebar = lazy(() => import('./dashboard/PetSidebar'));
const BookingModal = lazy(() => import('./dashboard/BookingModal'));
const BookingReminderModal = lazy(() => import('./dashboard/BookingReminderModal'));
const PetAssessmentFormModal = lazy(() => import('../../components/modals/PetAssessmentFormModal'));
const DashboardFooter = lazy(() => import('../../components/DashboardFooter'));
const CustomerDashboard_MobileView = lazy(() => import('./dashboard/mobile/CustomerDashboard_MobileView'));

// Keep the client dashboard on the same warm radial surface used by the
// admin/staff dashboard shell.
// -- Offline helpers -----------------------------------------------------------

/**
 * Build the nested appointment shape from flat PowerSync SQLite rows.
 * Mirrors what /api/my-appointments returns so all existing components work unchanged.
 */
function buildOfflineAppointment(row, addonRows) {
  const myAddons = addonRows
    .filter((a) => a.appointment_id === row.id)
    .map((a) => ({
      id:             a.id,
      appointment_id: a.appointment_id,
      addon_id:       a.addon_id,
      price_charged:  a.price_charged,
      serviceAddon:   { id: a.addon_id, name: a.addon_name ?? 'Add-on', category: a.addon_category ?? '' },
    }));

  return {
    ...row,
    service: row.service_id ? {
      id:         row.service_id,
      name:       row.service_name       ?? '',
      category:   row.service_category   ?? '',
      display_id: row.service_display_id ?? '',
    } : null,
    pet: row.pet_id ? {
      id:           row.pet_id,
      name:         row.pet_name  ?? '',
      pet_id:       row.pet_id_value ?? '',
      date_of_birth: row.pet_dob  ?? null,
      breed:        { name: row.breed_name ?? '' },
      speciesType:  { name: row.species_name ?? '' },
    } : null,
    hotelSuite: row.hotel_suite_id ? {
      id:   row.hotel_suite_id,
      name: row.hotel_suite_name ?? '',
    } : null,
    appointmentAddons: myAddons,
    handled_by_name: row.handled_by_name ?? null,
    handledBy: row.handled_by_name ? { name: row.handled_by_name } : null,
  };
}

async function loadAppointmentsOffline(ownerId) {
  if (!ownerId) return [];

  const aptRows = await db.getAll(
    `SELECT
       a.*,
       s.name         AS service_name,
       s.category     AS service_category,
       s.display_id   AS service_display_id,
       p.name         AS pet_name,
       p.pet_id       AS pet_id_value,
       p.date_of_birth AS pet_dob,
       b.name         AS breed_name,
       sp.name        AS species_name,
       hs.name        AS hotel_suite_name
     FROM appointments a
     LEFT JOIN services    s  ON a.service_id      = s.id
     LEFT JOIN pets        p  ON a.pet_id          = p.id
     LEFT JOIN breeds      b  ON p.breed_id        = b.id
     LEFT JOIN species_types sp ON p.species_id    = sp.id
     LEFT JOIN hotel_suites hs ON a.hotel_suite_id = hs.id
     WHERE a.booked_by_owner_id = ?
     ORDER BY a.appointment_date DESC, a.start_time DESC`,
    [ownerId]
  );

  if (aptRows.length === 0) return [];

  const addonRows = await db.getAll(
    `SELECT
       aa.*,
       sa.name     AS addon_name,
       sa.category AS addon_category
     FROM appointment_addons aa
     LEFT JOIN service_addons sa ON aa.addon_id = sa.id
     WHERE aa.appointment_id IN (${aptRows.map(() => '?').join(',')})`,
    aptRows.map((r) => r.id)
  );

  return aptRows.map((row) => buildOfflineAppointment(row, addonRows));
}

async function loadPetsOffline(ownerId) {
  if (!ownerId) return [];
  const rows = await db.getAll(
    `SELECT
       p.*,
       b.name  AS breed_name,
       sp.name AS species_name
     FROM pets p
     LEFT JOIN breeds       b  ON p.breed_id  = b.id
     LEFT JOIN species_types sp ON p.species_id = sp.id
     WHERE p.owner_id = ?
       AND p.is_active = 1
     ORDER BY p.created_at ASC`,
    [ownerId]
  );

  return rows.map((pet) => ({
    ...pet,
    breed: pet.breed || (pet.breed_name ? { name: pet.breed_name } : null),
    speciesType: pet.speciesType || pet.species_type || (pet.species_name ? { name: pet.species_name } : null),
  }));
}

export default function CustomerDashboard() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const powersyncStatus = useStatus();
  const powersyncConnected = powersyncStatus?.connected ?? false;

  const [pets, setPets] = useState([]);
  const [petsLoading, setPetsLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);
  const [showBookingReminder, setShowBookingReminder] = useState(false);
  const [pendingBookingArgs, setPendingBookingArgs] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [healthFormPet, setHealthFormPet] = useState(null);
  const [savedBookingState, setSavedBookingState] = useState(null);
  const [calendarBookingState, setCalendarBookingState] = useState(null);
  const [dashboardCalendarDate, setDashboardCalendarDate] = useState(null);
  const [selectedPet, setSelectedPet] = useState(null);

  const loadPets = (updatedPet = null) => {
    setPetsLoading(true);
    const ownerId = user?.owner?.id ?? user?.ownerId ?? null;

    // PowerSync-first: prefer local synced rows when offline or sync stream is active.
    if (!navigator.onLine || powersyncConnected) {
      loadPetsOffline(ownerId)
        .then((list) => {
          if (list.length === 0 && navigator.onLine) {
            throw new Error('empty-powersync');
          }
          const refreshedList = updatedPet?.id
            ? (list.some((pet) => String(pet.id) === String(updatedPet.id))
              ? list.map((pet) => String(pet.id) === String(updatedPet.id) ? { ...pet, ...updatedPet } : pet)
              : [updatedPet, ...list])
            : list;
          setPets(refreshedList);
          if (refreshedList.length > 0) {
            setSelectedPet((prev) => {
              if (!prev) return refreshedList[0];
              const still = refreshedList.find((p) => p.id === prev.id);
              return still ?? refreshedList[0];
            });
          }
        })
        .catch(() => {
          apiGet('/api/my-pets')
            .then((r) => r.ok ? r.json() : Promise.reject(new Error('offline')))
            .then((d) => {
              let list = Array.isArray(d.data) ? d.data : [];
              if (updatedPet?.id && updatedPet?.photo_url) {
                list = list.map((p) =>
                  p.id === updatedPet.id
                    ? { ...p, ...updatedPet, photo_url: updatedPet.photo_url + '?t=' + Date.now() }
                    : p
                );
              }
              setPets(list);
              if (list.length > 0) {
                setSelectedPet((prev) => {
                  if (!prev) return list[0];
                  const still = list.find((p) => p.id === prev.id);
                  return still ?? list[0];
                });
              }
            })
            .catch(() => setPets([]))
            .finally(() => setPetsLoading(false));
        });
      return;
    }

    apiGet('/api/my-pets')
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('offline')))
      .then((d) => {
        let list = Array.isArray(d.data) ? d.data : [];
        if (updatedPet?.id && updatedPet?.photo_url) {
          list = list.map((p) =>
            p.id === updatedPet.id
              ? { ...p, ...updatedPet, photo_url: updatedPet.photo_url + '?t=' + Date.now() }
              : p
          );
        }
        setPets(list);
        if (list.length > 0) {
          setSelectedPet((prev) => {
            if (!prev) return list[0];
            const still = list.find((p) => p.id === prev.id);
            return still ?? list[0];
          });
        }
      })
      .catch(async () => {
        // Offline fallback — read from PowerSync local SQLite
        const ownerId = user?.owner?.id ?? user?.ownerId ?? null;
        const list = await loadPetsOffline(ownerId).catch(() => []);
        setPets(list);
        if (list.length > 0) {
          setSelectedPet((prev) => {
            if (!prev) return list[0];
            const still = list.find((p) => p.id === prev.id);
            return still ?? list[0];
          });
        }
      })
      .finally(() => setPetsLoading(false));
  };

  const loadAppointments = ({ silent = false } = {}) => {
    if (!silent) setAppointmentsLoading(true);
    const ownerId = user?.owner?.id ?? user?.ownerId ?? null;

    // PowerSync-first: prefer local synced rows when offline or sync stream is active.
    if (!navigator.onLine || powersyncConnected) {
      loadAppointmentsOffline(ownerId)
        .then((data) => {
          if (data.length === 0 && navigator.onLine) {
            throw new Error('empty-powersync');
          }
          setAppointments(data);
        })
        .catch(() => {
          apiGet('/api/my-appointments')
            .then((r) => r.ok ? r.json() : Promise.reject(new Error('offline')))
            .then((d) => {
              let data = [];
              if (d.data && typeof d.data === 'object' && !Array.isArray(d.data) && Array.isArray(d.data.data)) {
                data = d.data.data;
              } else if (Array.isArray(d.data)) {
                data = d.data;
              }
              setAppointments(data);
            })
            .catch(() => setAppointments([]))
            .finally(() => {
              if (!silent) setAppointmentsLoading(false);
            });
        });
      return;
    }

    apiGet('/api/my-appointments')
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('offline')))
      .then((d) => {
        let data = [];
        if (d.data && typeof d.data === 'object' && !Array.isArray(d.data) && Array.isArray(d.data.data)) {
          data = d.data.data;
        } else if (Array.isArray(d.data)) {
          data = d.data;
        }
        setAppointments(data);
      })
      .catch(async () => {
        // Offline fallback — read from PowerSync local SQLite
        const ownerId = user?.owner?.id ?? user?.ownerId ?? null;
        const data = await loadAppointmentsOffline(ownerId).catch(() => []);
        setAppointments(data);
      })
      .finally(() => {
        if (!silent) setAppointmentsLoading(false);
      });
  };

  useEffect(() => {
    loadAppointments();
    loadPets();
    const interval = setInterval(() => loadAppointments({ silent: true }), 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleBooked = (createdAppointment = null, requestedDate = null) => {
    const bookedDate = requestedDate
      || createdAppointment?.appointment_date
      || createdAppointment?.appointments?.[0]?.appointment_date
      || null;
    if (bookedDate) setDashboardCalendarDate(String(bookedDate).slice(0, 10));
    setCalendarBookingState(null);
    loadAppointments();
  };

  const handleFillHealthForm = (pet, bookingForm, bookingStep, bookingCategory, serviceId = null) => {
    setSavedBookingState({ form: bookingForm, step: bookingStep, category: bookingCategory, serviceId });
    setCalendarBookingState(null);
    setShowBooking(false);
    setHealthFormPet(pet);
  };

  const handleHealthFormSaved = () => {
    const petId = savedBookingState?.form?.pet_id;
    setHealthFormPet(null);
    if (savedBookingState) {
      setCalendarBookingState({
        step: 0,
        form: savedBookingState.form,
        bookingItems: [{ category: '', service: null, size_label: '', hotel_suite_id: '', addons: [], addonsDecided: false, appointment_date: '', start_time: '', hotel_nights: '', hotel_checkout: '', daycare_duration: '', availableAddons: [] }],
        activeItemIndex: 0,
        serviceAssessments: {},
        refreshPetId: petId,
      });
      setSavedBookingState(null);
      setShowBooking(true);
    }
  };

  const [addPetTrigger, setAddPetTrigger] = useState(null);
  const handleAddPetTrigger = useCallback((fn) => setAddPetTrigger(() => fn), []);
  const [familyTreeTrigger, setFamilyTreeTrigger] = useState(null);
  const handleFamilyTreeTrigger = useCallback((fn) => setFamilyTreeTrigger(() => fn), []);

  const [mobileTriggers, setMobileTriggers] = useState({});
  const handleRegisterMobile = useCallback((triggers) => setMobileTriggers(triggers), []);

  const firstName = user?.name?.split(' ')[0] || 'Furparent';

  const getGreeting = () => {
    const hour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })).getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const openBooking = (date, category) => {
    const localDate = date ? String(date).slice(0, 10) : null;
    setCalendarBookingState(null);
    setPendingBookingArgs({ date: localDate, category: category ?? '' });
    setShowBookingReminder(true);
  };

  const handleReminderContinue = () => {
    setShowBookingReminder(false);
    if (pendingBookingArgs) {
      setSelectedDate(pendingBookingArgs.date);
      setSelectedCategory(pendingBookingArgs.category);
      setPendingBookingArgs(null);
    }
    setShowBooking(true);
  };

  const handleReminderClose = () => {
    setShowBookingReminder(false);
    setPendingBookingArgs(null);
  };

  return (
    <>
      {/* ClientSidebar always mounts so its profile/assessment portals work on mobile too */}
      <ClientSidebar
        currentUser={user}
        onLogout={logout}
        onRegisterMobile={handleRegisterMobile}
      />

      {/* -- Mobile layout (below lg) -- */}
      {!isDesktop && (
        <Suspense fallback={<Loading overlay message="Loading your dashboard..." />}>
          <CustomerDashboard_MobileView
            user={user}
            firstName={firstName}
            pets={pets}
            petsLoading={petsLoading}
            appointments={appointments}
            appointmentsLoading={appointmentsLoading}
            onLogout={logout}
            onBook={(date, category) => openBooking(date, category)}
            onRefresh={loadAppointments}
            onPetAdded={(petData) => loadPets(petData)}
            onPetSelect={setSelectedPet}
            selectedPet={selectedPet}
            calendarFocusDate={dashboardCalendarDate}
            onOpenProfile={mobileTriggers.openProfile}
            onOpenAssessment={mobileTriggers.openAssessment}
            style={dashboardBackground}
          />
        </Suspense>
      )}

      {/* -- Desktop layout (lg and above) -- */}
      {isDesktop && (
        <div className="flex min-h-screen flex-col bg-transparent font-poppins" style={dashboardBackground}>
          <main className="mx-auto w-full max-w-[1800px] flex-1 px-4 pb-8 pt-4 md:px-6 md:pt-6 lg:px-8">
            <div className="grid grid-cols-[minmax(0,1fr)_320px] items-stretch gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">

              <div className="flex min-w-0 flex-col gap-6">
                <div>
                  <h1 className="font-poppins text-3xl font-semibold leading-tight text-brand-dark">{getGreeting()}, {firstName}!</h1>
                  <p className="mt-1 text-sm text-brand-dark-soft">Ready for some Pawsitive Care?</p>
                </div>
                <Suspense fallback={<div className="min-h-[220px]" />}>
                  <ServiceSection onBook={(date, category) => openBooking(date, category)} />
                </Suspense>
                <div>
                  <Suspense fallback={<div className="min-h-[360px]" />}>
                    <AppointmentSection
                      appointments={appointments}
                      loading={appointmentsLoading}
                      onRefresh={loadAppointments}
                      selectedPet={selectedPet}
                      focusDate={dashboardCalendarDate}
                      onBook={(date, category) => openBooking(date, category)}
                    />
                  </Suspense>
                </div>
              </div>

              <aside className="flex min-w-0 flex-col">
                <div className="mb-3 flex min-h-9 items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-brand-dark-soft">Your Pets</p>
                    <div className="relative group">
                      <button
                        type="button"
                        onClick={() => addPetTrigger?.()}
                        className="w-5 h-5 rounded-full bg-brand-teal-light border border-brand-teal/40 flex items-center justify-center hover:bg-brand-teal hover:text-white text-brand-teal transition-colors"
                        aria-label="Register Pet"
                      >
                        <i className="fa-solid fa-plus text-[9px]" />
                      </button>
                      <span className="absolute left-1/2 -translate-x-1/2 top-6 z-50 whitespace-nowrap rounded-lg bg-brand-dark px-2 py-1 text-[10px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        Register Pet
                      </span>
                    </div>
                    <div className="relative group">
                      <button
                        type="button"
                        onClick={() => familyTreeTrigger?.()}
                        className="w-5 h-5 rounded-full bg-brand-teal-light border border-brand-teal/40 flex items-center justify-center hover:bg-brand-teal hover:text-white text-brand-teal transition-colors"
                        aria-label="Family Tree"
                      >
                        <i className="fa-solid fa-sitemap text-[9px]" />
                      </button>
                      <span className="absolute left-1/2 -translate-x-1/2 top-6 z-50 whitespace-nowrap rounded-lg bg-brand-dark px-2 py-1 text-[10px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        View Family Tree
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-brand-teal inline-block" />
                      <span className="text-[10px] text-brand-dark-soft">Dog</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-brand-orange inline-block" />
                      <span className="text-[10px] text-brand-dark-soft">Cat</span>
                    </div>
                  </div>
                </div>
                <Suspense fallback={<div className="min-h-[480px] flex-1" />}>
                  <PetSidebar
                    pets={pets}
                    loading={petsLoading}
                    onPetAdded={(petData) => loadPets(petData)}
                    onPetSelect={setSelectedPet}
                    onAddPetTrigger={handleAddPetTrigger}
                    onFamilyTreeTrigger={handleFamilyTreeTrigger}
                    className="w-full flex-1"
                  />
                </Suspense>
              </aside>

            </div>
          </main>
          <Suspense fallback={null}>
            <DashboardFooter className="mt-0" />
          </Suspense>
        </div>
      )}

      {!isDesktop && (
        <Suspense fallback={null}>
          <DashboardFooter className="mt-0" />
        </Suspense>
      )}

      {/* -- Shared modals (portal-based, work for both mobile and desktop) -- */}
      {showBookingReminder && (
        <Suspense fallback={null}>
          <BookingReminderModal
            isOpen={showBookingReminder}
            category={pendingBookingArgs?.category || ''}
            onContinue={handleReminderContinue}
            onClose={handleReminderClose}
          />
        </Suspense>
      )}
      {showBooking && (
        <Suspense fallback={null}>
          <BookingModal
            isOpen={showBooking}
            onClose={() => { setShowBooking(false); setSelectedCategory(''); setSavedBookingState(null); setCalendarBookingState(null); }}
            pets={pets}
            petsLoading={petsLoading}
            onBooked={handleBooked}
            selectedDate={selectedDate}
            selectedCategory={selectedCategory}
            initialStep={undefined}
            initialForm={calendarBookingState ?? undefined}
            onFillHealthForm={(pet, form, step, category, serviceId) => handleFillHealthForm(pet, form, step, category, serviceId)}
            onSaveState={(state) => setCalendarBookingState(state ?? null)}
          />
        </Suspense>
      )}
      {!!healthFormPet && (
        <Suspense fallback={null}>
          <PetAssessmentFormModal
            isOpen={!!healthFormPet}
            pet={healthFormPet}
            onClose={() => setHealthFormPet(null)}
            onSaved={handleHealthFormSaved}
            apiBase="/api/my-pets"
            serviceId={savedBookingState?.serviceId || null}
            serviceCategory={savedBookingState?.category || ''}
            theme="pet_owner"
          />
        </Suspense>
      )}
    </>
  );
}
