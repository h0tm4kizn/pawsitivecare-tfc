import { FileText } from 'lucide-react';
import SimpleField from './AppointmentInfoField';

export function PetDetailsSection({
  appointment,
  petDisplayId,
  petSpecies,
  isHotel,
  petSize,
  petBreed,
  petSex,
  petDateOfBirth,
  petAge,
  petColor,
  petMedicalNotes,
  hasPet,
  onViewAssessment,
}) {
  return (
    <section className="flex h-full flex-col rounded-xl border border-brand-teal/15 bg-white p-4 shadow-[0_18px_35px_rgba(23,53,81,0.16)]">
      <div className="flex items-start justify-between gap-3 border-b border-brand-dark-light pb-3">
        <h3 className="text-sm font-semibold text-brand-dark">Pet Details</h3>
        <button
          type="button"
          onClick={onViewAssessment}
          disabled={!hasPet}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-teal/25 px-2.5 py-1.5 text-[10px] font-bold text-brand-teal transition hover:bg-brand-teal hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          <FileText size={12} strokeWidth={2.6} />
          View Assessment Form
        </button>
      </div>
      <div className="mt-3 grid flex-1 gap-3 sm:grid-cols-2">
        <SimpleField label="Pet" value={appointment.pet || '--'} />
        <SimpleField label="Pet ID" value={petDisplayId} />
        <SimpleField label="Species" value={petSpecies} />
        {isHotel && <SimpleField label="Pet Size" value={petSize || 'Not recorded'} />}
        <SimpleField label="Breed" value={petBreed || '-'} />
        <SimpleField label="Sex" value={petSex} />
        <SimpleField label="Date of Birth" value={petDateOfBirth || '-'} />
        <SimpleField label="Age" value={petAge} />
        {petColor && <SimpleField label="Color" value={petColor} />}
        {petMedicalNotes && <SimpleField label="Medical Notes" value={petMedicalNotes} className="sm:col-span-2" />}
      </div>
    </section>
  );
}

export function OwnerDetailsSection({ ownerName, contact, email, address }) {
  return (
    <section className="rounded-xl border border-brand-teal/15 bg-white p-4 shadow-[0_18px_35px_rgba(23,53,81,0.16)]">
      <h3 className="border-b border-brand-dark-light pb-3 text-sm font-semibold text-brand-dark">Pet Owner</h3>
      <div className="mt-3 grid gap-2.5">
        <SimpleField label="Owner" value={ownerName} />
        <SimpleField label="Contact" value={contact} />
        <SimpleField label="Email" value={email} />
        <SimpleField label="Address" value={address || '-'} className="whitespace-pre-line" />
      </div>
    </section>
  );
}
