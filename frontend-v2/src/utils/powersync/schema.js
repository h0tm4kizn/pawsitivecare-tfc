import { column, Schema, Table } from '@powersync/web';

// ── Reference tables (global — synced to all users) ────────────────────────

const species_types = new Table({
  name: column.text,
  code: column.text,
  is_active: column.integer,
});

const breeds = new Table({
  species_id: column.text,
  name: column.text,
  is_active: column.integer,
});

const services = new Table(
  {
    name: column.text,
    category: column.text,
    description: column.text,
    is_active: column.integer,
    needs_cage: column.integer,
    display_id: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { category: ['category'] } }
);

const service_tiers = new Table(
  {
    service_id: column.text,
    size_label: column.text,
    price: column.real,
    price_max: column.real,
    duration_hours: column.real,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { service: ['service_id'] } }
);

const service_addons = new Table(
  {
    name: column.text,
    category: column.text,
    price_min: column.real,
    price_max: column.real,
    has_size_pricing: column.integer,
    is_active: column.integer,
    display_id: column.text,
    created_at: column.text,
    updated_at: column.text,
  }
);

const hotel_suites = new Table(
  {
    name: column.text,
    species_type: column.text,
    size_range: column.text,
    price_per_night: column.real,
    capacity: column.integer,
    is_available: column.integer,
    description: column.text,
    created_at: column.text,
    updated_at: column.text,
  }
);

const owners = new Table(
  {
    user_id: column.text,
    first_name: column.text,
    last_name: column.text,
    email: column.text,
    phone: column.text,
    address: column.text,
    is_active: column.integer,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { user: ['user_id'], email: ['email'] } }
);

// ── Owner-scoped tables (synced per authenticated user) ────────────────────

const pets = new Table(
  {
    owner_id: column.text,
    species_id: column.text,
    breed_id: column.text,
    pet_id: column.text,
    name: column.text,
    sex: column.text,
    date_of_birth: column.text,
    weight_kg: column.real,
    medical_notes: column.text,
    photo_url: column.text,
    identification_hash: column.text,
    identification_image_url: column.text,
    recognition_registered: column.integer,
    recognition_registered_at: column.text,
    is_active: column.integer,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { owner: ['owner_id'] } }
);

const appointments = new Table(
  {
    pet_id: column.text,
    service_id: column.text,
    hotel_suite_id: column.text,
    handled_by: column.text,
    handled_by_name: column.text,
    booked_by_owner_id: column.text,
    size_label: column.text,
    status: column.text,
    reschedule_requested_at: column.text,
    appointment_date: column.text,
    start_time: column.text,
    check_in_time: column.text,
    check_out_time: column.text,
    completed_at: column.text,
    daycare_duration: column.text,
    hotel_nights: column.integer,
    special_instructions: column.text,
    total_price: column.real,
    deposit: column.real,
    reference_number: column.text,
    reservation_channel: column.text,
    reservation_provider: column.text,
    reservation_payment_account_id: column.text,
    reservation_payer_provider: column.text,
    reservation_deposit_proof_url: column.text,
    notes: column.text,
    appointment_code: column.text,
    cancellation_reason: column.text,
    cancelled_at: column.text,
    cancelled_by: column.text,
    cancellation_type: column.text,
    is_full_day_package: column.integer,
    grooming_discount: column.real,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      owner: ['booked_by_owner_id'],
      date: ['appointment_date'],
      status: ['status'],
      // Composite index: accelerates month-range + status filter used in loadAppointmentsFromPowerSync
      date_status: ['appointment_date', 'status'],
      // FK indexes: speed up LEFT JOINs against pets and services in SQLite queries
      pet: ['pet_id'],
      service: ['service_id'],
    },
  }
);

const appointment_addons = new Table(
  {
    appointment_id: column.text,
    addon_id: column.text,
    price_charged: column.real,
    notes: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { appointment: ['appointment_id'] } }
);

const notifications = new Table(
  {
    owner_id: column.text,
    appointment_id: column.text,
    message: column.text,
    channel: column.text,
    type: column.text,
    status: column.text,
    is_read: column.integer,
    read_at: column.text,
    sent_at: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { owner: ['owner_id'], read: ['is_read'] } }
);

export const AppSchema = new Schema({
  species_types,
  breeds,
  services,
  service_tiers,
  service_addons,
  hotel_suites,
  owners,
  pets,
  appointments,
  appointment_addons,
  notifications,
});
