import jsPDF from 'jspdf';

const BODY_FONT_SIZE = 7.5;
const TITLE_FONT_SIZE = 16;
const STATION_FONT_SIZE = 10;

const GROOMING_CONDITION_ITEMS = [
  'Ticks',
  'Flea',
  'Wound',
  'Mange',
  'Bald Spot',
  'Skin Problem',
  'Lameness',
  'Eye Discharge',
  'Nasal Discharge',
  'Ear Discharge',
];

const DOG_VACCINE_GROUPS = [
  {
    title: 'Core / Common Combination Vaccines',
    items: ['Rabies', '5-in-1 (DHPPiL)', '6-in-1', '7-in-1', '8-in-1'],
  },
  {
    title: 'Individual Canine Vaccines',
    items: [
      'Canine Distemper',
      'Infectious Canine Hepatitis (Adenovirus)',
      'Canine Parvovirus',
      'Canine Parainfluenza',
      'Leptospirosis',
      'Bordetella (Kennel Cough)',
      'Canine Influenza',
      'Lyme Disease',
      'Canine Coronavirus',
    ],
  },
];

const CAT_VACCINE_GROUPS = [
  {
    title: 'Core / Common Combination Vaccines',
    items: ['Rabies', 'FVRCP (3-in-1 / 4-in-1)'],
  },
  {
    title: 'Individual Feline Vaccines',
    items: [
      'Feline Viral Rhinotracheitis (FVR)',
      'Feline Calicivirus (FCV)',
      'Feline Panleukopenia (FPV)',
      'Feline Leukemia Virus (FeLV)',
      'Chlamydia felis',
      'Bordetella bronchiseptica',
    ],
  },
];

const POLICIES = [
  {
    title: '1. Check-out & Pick-up Policy',
    body: 'Standard check-out time is _____ AM/PM. Pick-ups beyond the agreed time will incur a Daycare Fee ( _____ per hour).',
  },
  {
    title: '2. Safety & Comfort',
    body: 'We provide a safe, clean, and loving environment. Pets showing extreme aggression may be refused or separated for safety.',
  },
  {
    title: '3. Happy & Healthy Pets Only',
    body: 'Pets must have updated complete vaccinations with proof (vet card/record). Anti-tick & flea prevention is required before check-in. Pets with illness (coughing, vomiting, diarrhea, severe skin issues) cannot be accepted.',
  },
  {
    title: '4. Emergency Care',
    body: 'In case of emergency, we will contact you or your secondary contact. If urgent, your pet may be taken to your listed vet (or the nearest clinic if unavailable).',
  },
];

const DECLARATION =
  "I, the undersigned Fur Parent, have read and agreed to The Fur Club's policies for the service availed. I authorize The Fur Club to provide the best possible care for my pet.";

const GROOMING_REMINDERS = [
  {
    title: '1. Flea & Tick-Free, Please!',
    body: "Your pet should be free of fleas and ticks on the day of their appointment. If we spot any, we'll need to reschedule to protect all the other furry guests.",
  },
  {
    title: '2. Health & Skin Condition',
    body: 'Please inform us of any wounds, rashes, skin sensitivities, allergies, recent surgery, or medical conditions before grooming begins.',
  },
  {
    title: '3. Behaviour & Handling',
    body: 'Please let us know if your pet is anxious, difficult to handle, or has shown aggression during grooming so we can provide the safest possible care.',
  },
  {
    title: '4. Matting & Coat Condition',
    body: 'Severely matted coats may require shaving or a shorter cut for your pet\'s comfort and safety. Additional charges may apply.',
  },
];

const clean = (value, fallback = '') => String(value || fallback || '')
  .replace(/\s*\((?:please\s+)?specif(?:y|iy)\)\s*/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const speciesName = (pet = {}) =>
  clean(pet?.species_type?.name || pet?.speciesType?.name || pet?.species || pet?.species_name);

const breedName = (pet = {}) =>
  clean(pet?.breed?.name || (typeof pet?.breed === 'string' ? pet.breed : '') || pet?.breed_name);

const ownerName = (owner = {}) => {
  const full = clean(owner?.full_name || owner?.fullName || owner?.name);
  if (full) return full;
  return clean(`${owner?.first_name || ''} ${owner?.last_name || ''}`);
};

const ownerPhone = (owner = {}) => clean(owner?.phone || owner?.contact_number || owner?.mobile_number);

const ownerAddress = (owner = {}) =>
  clean(owner?.address || owner?.full_address || owner?.complete_address || owner?.street_address);

const wrapAtCharacterLimit = (value, limit = 30) => {
  const words = clean(value).split(' ').filter(Boolean);
  if (!words.length) return '';

  const lines = [];
  let currentLine = '';
  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length <= limit || !currentLine) {
      currentLine = candidate;
      return;
    }
    lines.push(currentLine);
    currentLine = word;
  });
  if (currentLine) lines.push(currentLine);
  return lines.join('\n');
};

const toBool = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const normalized = String(value || '').trim().toLowerCase();
  return ['yes', 'true', '1', 'y', 'socialize', 'can_treats'].includes(normalized);
};

const yesNoValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  return toBool(value);
};

const fmtDate = (value) => {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: '2-digit', year: 'numeric' });
};

const fmtTime = (value) => {
  if (!value) return '';
  const time = String(value).includes('T') ? String(value) : `1970-01-01T${String(value)}`;
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const petAge = (pet = {}) => {
  if (!pet?.date_of_birth) return '';
  const birth = new Date(`${String(pet.date_of_birth).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return '';
  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) years -= 1;
  return years > 0 ? `${years} year${years === 1 ? '' : 's'}` : 'Under 1 year';
};

const serviceTextFor = (record = {}, fallback = '') =>
  clean(`${record?.service?.category || record?.service_category || record?.appointment?.service?.category || fallback} ${record?.service_name || record?.service?.name || record?.appointment?.service?.name || ''}`).toLowerCase();

const isGroomingAssessment = (record = {}, fallback = '') => {
  const text = serviceTextFor(record, fallback);
  return ['groom', 'fresh', 'tidy', 'glow', 'glam'].some((needle) => text.includes(needle));
};

const recordVaccines = (record = {}) => {
  const vaccines = Array.isArray(record?.vaccines) ? record.vaccines : [];
  return vaccines.filter(Boolean).map(String);
};

const vaccineChecked = (record = {}, item = '') => {
  const needle = item.toLowerCase();
  if (needle.includes('rabies') && toBool(record?.vaccine_rabies)) return true;
  if (needle.includes('5-in-1') && toBool(record?.vaccine_5in1)) return true;
  return recordVaccines(record).some((name) => {
    const value = name.toLowerCase();
    return value.includes(needle) || needle.includes(value);
  });
};

const addOnsText = (appointment = {}) => {
  const rows = Array.isArray(appointment?.appointmentAddons) ? appointment.appointmentAddons : [];
  return rows.map((row) => row?.serviceAddon?.name || row?.name).filter(Boolean).join(', ');
};

const appointmentCheckIn = (appointment = {}) => {
  const date = fmtDate(appointment?.appointment_date);
  const time = fmtTime(appointment?.start_time);
  return clean(`${date} ${time}`);
};

const appointmentCheckOut = (appointment = {}) => {
  if (appointment?.check_out_time) return `${fmtDate(appointment.check_out_time)} ${fmtTime(appointment.check_out_time)}`.trim();
  if (!appointment?.appointment_date || !appointment?.hotel_nights) return '';
  const date = new Date(`${String(appointment.appointment_date).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + Number(appointment.hotel_nights || 1));
  return clean(`${fmtDate(date.toISOString())} ${fmtTime(appointment.start_time)}`);
};

const safeFilePart = (value, fallback = 'assessment') =>
  clean(value, fallback).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || fallback;

const loadImageAsBase64 = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext('2d').drawImage(image, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = reject;
    image.src = src;
  });

const setBaseText = (doc) => {
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(BODY_FONT_SIZE);
};

const checkbox = (doc, x, y, label, checked = false) => {
  doc.rect(x, y - 3.1, 3.6, 3.6);
  if (checked) {
    doc.setFont('helvetica', 'bold');
    doc.text('X', x + 1, y - 0.2);
    doc.setFont('helvetica', 'normal');
  }
  doc.text(label, x + 5.3, y);
};

const yesNo = (doc, x, y, label, optionsX = x + 66, selected = null) => {
  doc.setFont('helvetica', 'bold');
  doc.text(label.endsWith(':') ? label : `${label}:`, x, y);
  doc.setFont('helvetica', 'normal');
  checkbox(doc, optionsX, y, 'Yes', selected === true);
  checkbox(doc, optionsX + 18, y, 'No', selected === false);
};
const field = (doc, x, y, width, label, value = '') => {
  const displayLabel = label.endsWith(':') ? label : `${label}:`;
  const valueLines = String(value || '').split('\n');
  const lineHeight = 3.8;
  doc.setFont('helvetica', 'bold');
  doc.text(displayLabel, x, y);
  doc.setFont('helvetica', 'normal');
  const labelWidth = Math.min(doc.getTextWidth(displayLabel) + 2.5, width - 10);
  const underlineY = y + ((valueLines.length - 1) * lineHeight) + 0.8;
  doc.line(x + labelWidth, underlineY, x + width, underlineY);
  if (value) {
    doc.text(valueLines, x + labelWidth + 1.5, y - 0.7, { lineHeightFactor: 1.35 });
  }
  return Math.max(5.2, valueLines.length * lineHeight + 1.4);
};

const section = (doc, title, y) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(BODY_FONT_SIZE);
  doc.text(title.toUpperCase(), 14, y);
  doc.line(14, y + 1.6, 196, y + 1.6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(BODY_FONT_SIZE);
  return y + 6;
};

const wrapped = (doc, text, x, y, width, lineHeight = 3.7) => {
  const lines = doc.splitTextToSize(text, width);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
};

const detailBox = (doc, x, y, width, title, rows) => {
  doc.setFont('helvetica', 'bold');
  doc.text(`${title.toUpperCase()}:`, x + 2, y + 5);
  doc.setFont('helvetica', 'normal');
  let rowY = y + 9.5;
  rows.forEach(([label, value]) => {
    rowY += field(doc, x + 2, rowY, width - 4, label, value);
  });
  return rowY;
};

const petDetailBox = (doc, x, y, width, pet, species) => {
  doc.setFont('helvetica', 'bold');
  doc.text('PET:', x + 2, y + 5);
  doc.setFont('helvetica', 'normal');

  let rowY = y + 9.5;
  rowY += field(doc, x + 2, rowY, width - 4, 'Pet Name', clean(pet?.name));
  rowY += field(doc, x + 2, rowY, width - 4, 'Pet ID', clean(pet?.pet_id || pet?.display_id || pet?.id));
  rowY += field(doc, x + 2, rowY, width - 4, 'Species / Breed', clean(`${species}${species && breedName(pet) ? ' / ' : ''}${breedName(pet)}`));
  rowY += field(doc, x + 2, rowY, width - 4, 'Date of Birth', fmtDate(pet?.date_of_birth));
  field(doc, x + 2, rowY, 35, 'Age', petAge(pet));
  doc.setFont('helvetica', 'bold');
  doc.text('Sex:', x + 42, rowY);
  doc.setFont('helvetica', 'normal');
  const sex = clean(pet?.sex).toLowerCase();
  checkbox(doc, x + 54, rowY, 'Male', sex.startsWith('m'));
  checkbox(doc, x + 72, rowY, 'Female', sex.startsWith('f'));
  return rowY + 5.2;
};

const serviceChoice = (doc, x, y, label, checked = false) => {
  checkbox(doc, x, y, label, checked);
};

const policyBlock = (doc, x, y, width, title, body) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(BODY_FONT_SIZE);
  doc.text(title, x, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(BODY_FONT_SIZE);
  const lines = doc.splitTextToSize(body, width);
  doc.text(lines, x + 3, y + 3.8);

  return y + 3.8 + lines.length * 3.5 + 2;
};

const signatureBlock = (doc, x, y, width, label) => {
  doc.line(x, y, x + width, y);
  doc.setFont('helvetica', 'bold');
  doc.text(label, x + width / 2, y + 3.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('Signature over Printed Name', x + width / 2, y + 6.2, { align: 'center' });
};

const vaccineGroup = (doc, x, y, title, items, isChecked = () => false, labelFor = (item) => item) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(BODY_FONT_SIZE);
  doc.text(title, x, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(BODY_FONT_SIZE);

  let itemY = y + 4.6;
  items.forEach((item) => {
    checkbox(doc, x, itemY, labelFor(item), isChecked(item));
    itemY += 4.5;
  });

  return itemY;
};

const vaccineColumn = (doc, x, y, title, groups, isChecked = () => false, labelFor = (item) => item) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(BODY_FONT_SIZE);
  doc.text(title, x, y);

  let groupY = y + 5.2;
  groups.forEach((group) => {
    groupY = vaccineGroup(doc, x, groupY, group.title, group.items, isChecked, labelFor) + 1.2;
  });

  return groupY;
};

const addDocumentHeader = async (doc, title) => {
  setBaseText(doc);
  try {
    const logoData = await loadImageAsBase64('/assets/paw-realteal.webp');
    doc.addImage(logoData, 'PNG', 186, 7, 14, 14);
  } catch {
    // The form should still download if the logo asset cannot be loaded.
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(TITLE_FONT_SIZE);
  doc.text(title, 107.95, 14, { align: 'center' });
  doc.setFontSize(STATION_FONT_SIZE);
  doc.text('The Fur Club Pet Station', 107.95, 21, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(BODY_FONT_SIZE);
  doc.text('207 F. Blumentritt St. Kabayanan San Juan City, San Juan, Philippines, 1550', 107.95, 26, { align: 'center' });
  doc.text('0976 065 8031 | connect.thefurclub@gmail.com', 107.95, 31, { align: 'center' });
};

export async function downloadBlankPetAssessmentPdf({ pet = {}, owner = {}, appointment = {}, serviceCategory = '', record = {}, filename = 'TFC-DH-Assessment-Form.pdf' } = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'legal' });
  const species = speciesName(pet);
  const normalizedSpecies = species.toLowerCase();
  const isDog = normalizedSpecies.includes('dog') || normalizedSpecies.includes('canine');
  const isCat = normalizedSpecies.includes('cat') || normalizedSpecies.includes('feline');
  const appointmentData = appointment || record?.appointment || {};
  const serviceText = serviceTextFor(record, serviceCategory);
  const vaccines = recordVaccines(record);
  const illness = clean(record?.medical_conditions);
  const allergies = clean(record?.allergies);
  const medicalNotes = clean(record?.special_needs || record?.medical_notes || record?.other_medical_notes);

  await addDocumentHeader(doc, 'Pet Assessment Form');

  let y = section(doc, 'Owner | Pet Details', 40);
  const ownerDetailsEndY = detailBox(doc, 14, y, 88, 'Owner', [
    ['Name', ownerName(owner)],
    ['Contact No.', ownerPhone(owner)],
    ['Email', clean(owner?.email)],
    ['Address', wrapAtCharacterLimit(ownerAddress(owner), 30)],
  ]);
  const petDetailsEndY = petDetailBox(doc, 108, y, 88, pet, species);
  y = Math.max(ownerDetailsEndY, petDetailsEndY) + 3;

  y = section(doc, 'Hotel & Daycare Service Details', y) + 1.5;
  serviceChoice(doc, 18, y, 'Pet Hotel (Overnight Stay)', serviceText.includes('hotel') || Boolean(appointmentData?.hotel_nights));
  serviceChoice(doc, 108, y, 'Pet Daycare (Play & Socialization)', serviceText.includes('day') || serviceText.includes('play'));
  y += 8;
  field(doc, 16, y, 82, 'Check-in Date & Time', appointmentCheckIn(appointmentData));
  field(doc, 106, y, 88, 'Check-out Date & Time', appointmentCheckOut(appointmentData));
  y += 8;

  y = section(doc, 'Veterinary Information', y) + 1.5;
  yesNo(doc, 16, y, 'Vaccinated', 53, yesNoValue(record?.is_vaccinated));
  y += 6.5;
  field(doc, 16, y, 82, 'Vet Clinic', clean(record?.vet_clinic_name));
  field(doc, 106, y, 88, 'Vet Contact Number', clean(record?.vet_contact_number));
  y += 7;

  y = section(doc, 'Vaccines', y) + 1.5;
  const rabiesDate = fmtDate(record?.vaccine_date);
  const rabiesLabel = (item) => item === 'Rabies' && rabiesDate ? `Rabies (${rabiesDate})` : item;
  const dogVaccineEndY = vaccineColumn(doc, 18, y, 'DOG VACCINES', DOG_VACCINE_GROUPS, (item) => isDog && vaccineChecked(record, item), rabiesLabel);
  const catVaccineEndY = vaccineColumn(doc, 110, y, 'CAT VACCINES', CAT_VACCINE_GROUPS, (item) => isCat && vaccineChecked(record, item), rabiesLabel);
  y = Math.max(dogVaccineEndY, catVaccineEndY) + 0.8;
  checkbox(doc, 18, y, 'Others:', vaccines.some((name) => !DOG_VACCINE_GROUPS.concat(CAT_VACCINE_GROUPS).flatMap((group) => group.items).some((item) => vaccineChecked({ vaccines: [name] }, item))));
  doc.line(40, y + 0.8, 194, y + 0.8);
  y += 7;

  y = section(doc, 'Health, Medical Notes & Allergies', y) + 1.5;
  yesNo(doc, 16, y, 'Any current illness or symptoms', 73, illness ? true : null);
  field(doc, 110, y, 84, 'If Yes, specify', illness);
  y += 6;
  yesNo(doc, 16, y, 'Any allergies', 53, allergies ? true : null);
  field(doc, 110, y, 84, 'If Yes, specify', allergies);
  y += 6;
  field(doc, 16, y, 178, 'Medical Notes / Special Needs', medicalNotes);
  y += 7;

  y = section(doc, 'Behaviour, Socialization & Treat Preferences', y) + 1.5;
  const friendly = clean(record?.is_friendly).toLowerCase();
  yesNo(doc, 16, y, 'Can your pet safely socialize with other pets?', 128, friendly ? ['yes', 'socialize', 'friendly'].includes(friendly) : null);
  y += 5.5;
  yesNo(doc, 16, y, 'Has your pet shown aggression toward people or pets?', 128, friendly ? ['no', 'alone', 'aggressive'].includes(friendly) : null);
  y += 5.5;
  yesNo(doc, 16, y, 'Can your pet have house treats?', 128, yesNoValue(record?.treat_preference));
  y += 6.5;

  y = section(doc, 'Hotel & Daycare Policies', y) + 2;
  const leftPolicyEndY = POLICIES.slice(0, 2).reduce(
    (policyY, policy) => policyBlock(doc, 16, policyY, 82, policy.title, policy.body),
    y,
  );
  const rightPolicyEndY = POLICIES.slice(2).reduce(
    (policyY, policy) => policyBlock(doc, 108, policyY, 86, policy.title, policy.body),
    y,
  );
  y = Math.max(leftPolicyEndY, rightPolicyEndY) + 1.5;
  doc.setFontSize(BODY_FONT_SIZE);

  y = section(doc, 'Acknowledgement & Declaration', y) + 2;
  doc.setFontSize(BODY_FONT_SIZE);
  y = wrapped(doc, DECLARATION, 16, y, 178, 3.8) + 6;
  doc.setFontSize(BODY_FONT_SIZE);
  signatureBlock(doc, 16, y, 78, 'Fur Parent Signature');
  signatureBlock(doc, 116, y, 78, 'Staff Signature');

  doc.save(filename);
}

export async function downloadGroomingAssessmentPdf({ groomingPackages = [], pet = {}, owner = {}, appointment = {}, record = {}, filename = 'TFC-G-Assessment-Form.pdf' } = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const species = speciesName(pet);
  const appointmentData = appointment || record?.appointment || {};
  const serviceText = serviceTextFor(record, 'grooming');
  const illness = clean(record?.medical_conditions);
  const allergies = clean(record?.allergies);
  const conditionNotes = clean(record?.other_condition_notes || record?.condition_notes);
  const packageNames = [...new Set(
    groomingPackages
      .map((service) => clean(service?.name || service?.service || service))
      .filter(Boolean),
  )];

  await addDocumentHeader(doc, 'Pet Grooming Assessment Form');

  let y = section(doc, 'Owner | Pet Details', 40);
  const ownerDetailsEndY = detailBox(doc, 14, y, 88, 'Owner', [
    ['Name', ownerName(owner)],
    ['Contact No.', ownerPhone(owner)],
    ['Email', clean(owner?.email)],
    ['Address', wrapAtCharacterLimit(ownerAddress(owner), 30)],
  ]);
  const petDetailsEndY = petDetailBox(doc, 108, y, 88, pet, species);
  y = Math.max(ownerDetailsEndY, petDetailsEndY) + 3;

  y = section(doc, 'Pet Grooming Appointment Details', y) + 1.5;
  field(doc, 16, y, 82, 'Date', fmtDate(appointmentData?.appointment_date));
  field(doc, 106, y, 88, 'Time', fmtTime(appointmentData?.start_time));
  y += 9;

  y = section(doc, 'Grooming Services', y) + 2;
  if (packageNames.length) {
    packageNames.forEach((packageName, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      checkbox(doc, 18 + column * 92, y + row * 5.2, packageName, serviceText.includes(packageName.toLowerCase()));
    });
    y += Math.ceil(packageNames.length / 2) * 5.2 + 2;
  } else {
    checkbox(doc, 18, y, 'Grooming Package', Boolean(serviceText));
    y += 7;
  }
  checkbox(doc, 18, y, 'Add Ons:', Boolean(addOnsText(appointmentData)));
  doc.line(40, y + 0.8, 194, y + 0.8);
  const addons = addOnsText(appointmentData);
  if (addons) doc.text(addons, 42, y - 0.7);
  y += 9;

  y = section(doc, 'Physical Grooming Assessment', y) + 2;
  GROOMING_CONDITION_ITEMS.forEach((item, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const conditionKey = `has_${item.toLowerCase().replace(/ /g, '_')}`;
    checkbox(doc, 18 + column * 60, y + row * 5.5, item, toBool(record?.[conditionKey]));
  });
  y += Math.ceil(GROOMING_CONDITION_ITEMS.length / 3) * 5.5 + 2;
  field(doc, 18, y, 176, 'Other Conditions / Notes', conditionNotes);
  y += 9;

  y = section(doc, 'Health & Behaviour', y) + 2;
  yesNo(doc, 16, y, 'Any current illness or symptoms', 82, illness ? true : null);
  field(doc, 112, y, 82, 'If Yes, specify', illness);
  y += 6.5;
  yesNo(doc, 16, y, 'Any allergies or skin sensitivities', 82, allergies ? true : null);
  field(doc, 112, y, 82, 'If Yes, specify', allergies);
  y += 6.5;
  const friendly = clean(record?.is_friendly).toLowerCase();
  yesNo(doc, 16, y, 'Has your pet shown aggression during grooming?', 88, friendly ? ['no', 'alone', 'aggressive'].includes(friendly) : null);
  y += 9;

  y = section(doc, 'Grooming Reminders', y) + 2;
  const leftReminderEndY = GROOMING_REMINDERS.slice(0, 2).reduce(
    (reminderY, reminder) => policyBlock(doc, 16, reminderY, 82, reminder.title, reminder.body),
    y,
  );
  const rightReminderEndY = GROOMING_REMINDERS.slice(2).reduce(
    (reminderY, reminder) => policyBlock(doc, 108, reminderY, 86, reminder.title, reminder.body),
    y,
  );
  y = Math.max(leftReminderEndY, rightReminderEndY) + 4;

  y = section(doc, 'Acknowledgement & Declaration', y) + 2;
  y = wrapped(doc, DECLARATION, 16, y, 178, 3.8) + 9;
  signatureBlock(doc, 16, y, 78, 'Fur Parent Signature');
  signatureBlock(doc, 116, y, 78, 'Staff Signature');

  doc.save(filename);
}

export async function downloadPetAssessmentRecordPdf({ record = {}, pet = {}, owner = {} } = {}) {
  const appointment = record?.appointment || {};
  const serviceName = clean(record?.service_name || record?.service?.name || appointment?.service?.name || 'assessment');
  const filename = `assessment-${safeFilePart(pet?.pet_id || pet?.name || 'pet')}-${safeFilePart(serviceName)}-${new Date().toISOString().slice(0, 10)}.pdf`;

  if (isGroomingAssessment(record)) {
    await downloadGroomingAssessmentPdf({
      groomingPackages: ['Fresh me up', 'Tidy up', 'Glow up', 'Glam up'],
      pet,
      owner,
      appointment,
      record,
      filename,
    });
    return;
  }

  await downloadBlankPetAssessmentPdf({
    pet,
    owner,
    appointment,
    serviceCategory: record?.service?.category || record?.service_category || appointment?.service?.category || '',
    record,
    filename,
  });
}
