import React, { useState, useEffect, useRef } from 'react';
import TermsCondition from './TermsCondition';
import { apiFetch } from '../api/apiClient';
import SelectDropdown from '../components/reusable-ui/SelectDropdown';
import PHAddressFields from '../components/reusable-ui/PHAddressFields';
import useBodyScrollLock from '../hooks/useBodyScrollLock';

// ── Styles ──────────────────────────────────────────────────────────────────
const labelClass = "block text-xs font-semibold tracking-widest mb-2 text-white/80";

const inputClass = (hasError) =>
  `w-full rounded-lg bg-white/16 border ${hasError ? 'border-red-400' : 'border-white/20'} px-4 py-3 text-sm placeholder:text-white/55 focus:outline-none focus:ring-2 focus:ring-brand-teal transition-all`;

const FieldError = ({ msg }) =>
  msg ? <p className="mt-1.5 text-xs text-red-400">{msg}</p> : null;

const RequiredMark = () => <span className="ml-1 text-red-400" aria-hidden="true">*</span>;

const isOtherBreed = (breed) => /^others?(?:\s*\(.*\))?$/i.test(String(breed?.name || '').trim());
const isValidListedBreed = (breed) => {
  const name = String(breed?.name || '').trim();
  return Boolean(name) && !/^\d+$/.test(name) && !isOtherBreed(breed);
};

const composeAddress = (form) => {
  const line1 = [form.address_unit_floor, form.address_street].filter(Boolean).join(', ');
  const line2 = [
    form.address_barangay ? `Brgy. ${form.address_barangay}` : '',
    form.address_city,
    form.address_province,
    form.address_postal_code,
  ]
    .filter(Boolean)
    .join(', ');
  const country = form.address_country || 'PH';
  return [line1, line2, country].filter(Boolean).join(', ');
};

// ── Password rules ───────────────────────────────────────────────────────────
const PASSWORD_RULES = [
  { label: 'At least 8 characters',  test: (p) => p.length >= 8 },
  { label: 'One uppercase letter',   test: (p) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter',   test: (p) => /[a-z]/.test(p) },
  { label: 'One number',             test: (p) => /\d/.test(p) },
  { label: 'One special character',  test: (p) => /[!@#$%^&*()\-_=+{};:,<.>/?\\|[\]`~"']/.test(p) },
];

const getStrength = (password) => PASSWORD_RULES.filter((r) => r.test(password)).length;

const STRENGTH_META = [
  { label: '',             color: 'text-white/30',  bar: 'bg-white/10' },
  { label: 'Very Weak',   color: 'text-red-400',    bar: 'bg-red-500' },
  { label: 'Weak',        color: 'text-orange-400', bar: 'bg-orange-500' },
  { label: 'Fair',        color: 'text-yellow-400', bar: 'bg-yellow-400' },
  { label: 'Strong',      color: 'text-lime-400',   bar: 'bg-lime-500' },
  { label: 'Very Strong', color: 'text-green-400',  bar: 'bg-green-500' },
];

// ── Validation ───────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().split('T')[0];

function validate(form, termsChecked) {
  const e = {};

  // Owner
  if (!form.first_name.trim())
    e.first_name = 'First name is required.';
  if (!form.last_name.trim())
    e.last_name = 'Last name is required.';
  if (!form.email.trim())
    e.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
    e.email = 'Enter a valid email address.';
  if (!form.contact_number.trim())
    e.contact_number = 'Contact number is required.';
  else if (!/^09\d{9}$/.test(form.contact_number))
    e.contact_number = 'Must be a valid PH number (09XXXXXXXXX).';
  if (!form.address_street.trim())
    e.address_street = 'Street is required.';
  if (!form.address_barangay.trim())
    e.address_barangay = 'Barangay is required.';
  if (!form.address_city.trim())
    e.address_city = 'City/Municipality is required.';
  if (!form.address_province.trim())
    e.address_province = 'Province is required.';
  if (form.address_postal_code && !/^\d{4}$/.test(form.address_postal_code))
    e.address_postal_code = 'Postal code must be 4 digits.';

  // Password strength
  const failed = PASSWORD_RULES.filter((r) => !r.test(form.password)).map((r) => r.label);
  if (failed.length > 0)
    e.password = `Password needs: ${failed.join(', ')}.`;
  if (!form.password_confirmation)
    e.password_confirmation = 'Please confirm your password.';
  else if (form.password !== form.password_confirmation)
    e.password_confirmation = 'Passwords do not match.';

  // Pet
  if (!form.pet_name.trim())  e.pet_name   = 'Pet name is required.';
  if (!form.species_id)       e.species_id  = 'Please select a pet species.';
  if (!form.breed_id)         e.breed_id    = 'Please select a breed.';
  if (form.breed_id === '__other__' && !form.other_breed?.trim())
    e.breed_id = 'Please specify the breed.';
  if (!form.pet_sex)          e.pet_sex     = 'Please select pet sex.';
  if (!form.pet_dob)          e.pet_dob     = 'Date of birth is required.';
  else if (form.pet_dob > TODAY)
    e.pet_dob = 'Birthday cannot be a future date.';

  const hasSecondPet = !!(
    form.pet_name_2?.trim() ||
    form.species_id_2 ||
    form.breed_id_2 ||
    form.pet_sex_2 ||
    form.pet_dob_2
  );
  if (hasSecondPet) {
    if (!form.pet_name_2?.trim()) e.pet_name_2 = 'Pet name is required.';
    if (!form.species_id_2) e.species_id_2 = 'Please select a pet species.';
    if (!form.breed_id_2) e.breed_id_2 = 'Please select a breed.';
    if (form.breed_id_2 === '__other__' && !form.other_breed_2?.trim()) e.breed_id_2 = 'Please specify the breed.';
    if (!form.pet_sex_2) e.pet_sex_2 = 'Please select pet sex.';
    if (!form.pet_dob_2) e.pet_dob_2 = 'Date of birth is required.';
    else if (form.pet_dob_2 > TODAY) e.pet_dob_2 = 'Birthday cannot be a future date.';
  }

  if (!termsChecked)
    e.terms = 'You must accept the Terms and Conditions.';

  return e;
}

// ── Component ────────────────────────────────────────────────────────────────
const INITIAL_FORM = {
  first_name: '', last_name: '', email: '', contact_number: '',
  address: '',
  address_unit_floor: '',
  address_street: '',
  address_barangay: '',
  address_city: '',
  address_province: '',
  address_postal_code: '',
  address_country: 'PH',
  password: '', password_confirmation: '',
  pet_name: '', species_id: '', breed_id: '', pet_sex: '', pet_dob: '',
  other_breed: '',
  pet_name_2: '', species_id_2: '', breed_id_2: '', pet_sex_2: '', pet_dob_2: '',
  other_breed_2: '',
};

const REGISTER_DRAFT_KEY = 'pawsitivecare:registration-draft:v1';
const REGISTER_DRAFT_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const SENSITIVE_REGISTER_FIELDS = new Set(['password', 'password_confirmation']);

const readRegistrationDraft = () => {
  if (typeof window === 'undefined') return INITIAL_FORM;
  try {
    const saved = JSON.parse(window.localStorage.getItem(REGISTER_DRAFT_KEY) || 'null');
    if (!saved?.form || !saved.savedAt || Date.now() - saved.savedAt > REGISTER_DRAFT_MAX_AGE) {
      window.localStorage.removeItem(REGISTER_DRAFT_KEY);
      return INITIAL_FORM;
    }
    const restored = { ...INITIAL_FORM };
    Object.keys(INITIAL_FORM).forEach((key) => {
      if (!SENSITIVE_REGISTER_FIELDS.has(key) && saved.form[key] !== undefined) restored[key] = saved.form[key];
    });
    return restored;
  } catch {
    return INITIAL_FORM;
  }
};

const clearRegistrationDraft = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(REGISTER_DRAFT_KEY);
  } catch {
    // Registration still works when browser storage is unavailable.
  }
};

const Register = ({ isOpen, onClose, onSwitchToLogin, onRegisterSuccess }) => {
  useBodyScrollLock(isOpen);
  const [form, setForm]                       = useState(readRegistrationDraft);
  const [fieldErrors, setFieldErrors]         = useState({});
  const [serverError, setServerError]         = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [speciesList, setSpeciesList]         = useState([]);
  const [breeds, setBreeds]                   = useState([]);
  const [breeds2, setBreeds2]                 = useState([]);
  const [showSecondPet, setShowSecondPet]     = useState(false);
  const [showPassword, setShowPassword]       = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [termsChecked, setTermsChecked]       = useState(false);
  const [showTerms, setShowTerms]             = useState(false);
  const [otpMode, setOtpMode]                 = useState(false);
  const [otpChallengeId, setOtpChallengeId]   = useState('');
  const [otpCode, setOtpCode]                 = useState('');
  const [otpResendIn, setOtpResendIn]         = useState(0);
  const otpInputRefs                          = useRef([]);
  const lastAutoSubmittedOtp                  = useRef('');
  const otpVerificationInFlight               = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(p => ({ ...p, password: '', password_confirmation: '' }));
    setFieldErrors({});
    setServerError(null);
    apiFetch('/api/species')
      .then(r => r.json())
      .then(d => {
        const all = Array.isArray(d) ? d : (d.data ?? []);
        setSpeciesList(all.filter(s => ['Dog', 'Cat', 'Others'].includes(s.name)));
      })
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || otpMode || typeof window === 'undefined') return;
    const timer = window.setTimeout(() => {
      const safeForm = {};
      Object.keys(INITIAL_FORM).forEach((key) => {
        if (!SENSITIVE_REGISTER_FIELDS.has(key)) safeForm[key] = form[key];
      });
      try {
        window.localStorage.setItem(REGISTER_DRAFT_KEY, JSON.stringify({ form: safeForm, savedAt: Date.now() }));
      } catch {
        // Ignore private-mode and storage-quota failures.
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [form, isOpen, otpMode]);

  useEffect(() => {
    if (!otpMode || otpResendIn <= 0) return;
    const t = setTimeout(() => setOtpResendIn((v) => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(t);
  }, [otpMode, otpResendIn]);

  useEffect(() => {
    if (!otpMode || otpCode.length !== 6 || loading) return;
    if (lastAutoSubmittedOtp.current === otpCode) return;
    lastAutoSubmittedOtp.current = otpCode;
    void handleVerifyOtp(otpCode);
  }, [otpCode, otpMode, loading]);

  useEffect(() => {
    if (!form.species_id) {
      setBreeds([]);
      setForm(p => ({ ...p, breed_id: '', other_breed: '' }));
      return;
    }
    apiFetch(`/api/breeds/options?species_id=${form.species_id}`)
      .then(r => r.json())
      .then(d => { setBreeds(Array.isArray(d) ? d : (d.data ?? [])); })
      .catch(() => {});
  }, [form.species_id]);

  useEffect(() => {
    if (!form.species_id_2) {
      setBreeds2([]);
      setForm(p => ({ ...p, breed_id_2: '', other_breed_2: '' }));
      return;
    }
    apiFetch(`/api/breeds/options?species_id=${form.species_id_2}`)
      .then(r => r.json())
      .then(d => { setBreeds2(Array.isArray(d) ? d : (d.data ?? [])); })
      .catch(() => {});
  }, [form.species_id_2]);

  useEffect(() => {
    const hasSecondPetData = !!(
      form.pet_name_2?.trim() ||
      form.species_id_2 ||
      form.breed_id_2 ||
      form.pet_sex_2 ||
      form.pet_dob_2
    );
    if (hasSecondPetData && !showSecondPet) {
      setShowSecondPet(true);
    }
  }, [form.pet_name_2, form.species_id_2, form.breed_id_2, form.pet_sex_2, form.pet_dob_2, showSecondPet]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
    if (fieldErrors[name]) setFieldErrors(p => ({ ...p, [name]: undefined }));
  };

  const otherBreedOption = breeds.find(isOtherBreed);
  const otherBreedOption2 = breeds2.find(isOtherBreed);
  const breedOptions = [
    { value: '', label: form.species_id ? 'Select breed' : 'Select type first' },
    ...[...breeds]
      .filter(isValidListedBreed)
      .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
      .map((b) => ({ value: b.id, label: b.name })),
    { value: '__other__', label: 'Others' },
  ];
  const breedOptions2 = [
    { value: '', label: form.species_id_2 ? 'Select breed' : 'Select type first' },
    ...[...breeds2]
      .filter(isValidListedBreed)
      .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
      .map((b) => ({ value: b.id, label: b.name })),
    { value: '__other__', label: 'Others' },
  ];

  const handleBreedChange = (value) => {
    if (value === '__other__') {
      setForm((p) => ({ ...p, breed_id: '__other__', other_breed: '' }));
    } else {
      setForm((p) => ({ ...p, breed_id: value, other_breed: '' }));
    }
    if (fieldErrors.breed_id) setFieldErrors((p) => ({ ...p, breed_id: undefined }));
  };
  const handleBreedChange2 = (value) => {
    if (value === '__other__') {
      setForm((p) => ({ ...p, breed_id_2: '__other__', other_breed_2: '' }));
    } else {
      setForm((p) => ({ ...p, breed_id_2: value, other_breed_2: '' }));
    }
    if (fieldErrors.breed_id_2) setFieldErrors((p) => ({ ...p, breed_id_2: undefined }));
  };

  const scrollToFirstError = (errors) => {
    const ORDER = [
      'first_name','last_name','email','phone',
      'address_street','address_barangay','address_city','address_province','address_postal_code',
      'password','password_confirmation',
      'pet_name','species_id','breed_id','pet_sex','pet_dob',
      'pet_name_2','species_id_2','breed_id_2','pet_sex_2','pet_dob_2',
      'noseprint','terms',
    ];
    const key = ORDER.find(k => errors[k]);
    if (!key) return;
    const el = document.getElementById(`field-${key}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleVerifyOtp = async (manualCode) => {
    if (otpVerificationInFlight.current) return;
    const code = (manualCode || otpCode).trim();
    if (code.length !== 6) {
      setServerError('Enter the 6-digit verification code.');
      return;
    }
    otpVerificationInFlight.current = true;
    setLoading(true);
    try {
      const res = await apiFetch('/api/register/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: otpChallengeId, otp_code: code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorDetails = data?.errors ? Object.values(data.errors).flat().join(' ') : '';
        setServerError(errorDetails || data?.message || 'Verification failed.');
        return;
      }
      // Preserve the owner/pet records returned by registration. The customer
      // dashboard and PowerSync both need owner.id to scope the first pet
      // read immediately after login.
      onRegisterSuccess?.({
        token: data.data.token,
        user: {
          ...data.data.user,
          owner: data.data.owner,
          pets: data.data.pets || (data.data.pet ? [data.data.pet] : []),
        },
        remember: false,
      });
      clearRegistrationDraft();
      setForm(INITIAL_FORM);
      setFieldErrors({});
      setTermsChecked(false);
      setOtpMode(false);
      setOtpChallengeId('');
      setOtpCode('');
      lastAutoSubmittedOtp.current = '';
      onClose();
    } catch {
      setServerError('Network error. Please check your connection.');
    } finally {
      otpVerificationInFlight.current = false;
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);

    if (otpMode) {
      await handleVerifyOtp();
      return;
    }

    const errors = validate(form, termsChecked);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      scrollToFirstError(errors);
      return;
    }
      if (form.breed_id === '__other__' && !otherBreedOption?.id) {
        const nextErrors = { breed_id: 'Other breed option is unavailable. Please try another breed.' };
        setFieldErrors(nextErrors);
        scrollToFirstError(nextErrors);
        return;
      }
      if (form.breed_id_2 === '__other__' && !otherBreedOption2?.id) {
        const nextErrors = { breed_id_2: 'Other breed option is unavailable. Please try another breed.' };
        setFieldErrors(nextErrors);
        scrollToFirstError(nextErrors);
        return;
      }

    setLoading(true);
    try {
      const normalizedAddress = composeAddress({
        ...form,
        address_unit_floor: form.address_unit_floor.trim(),
        address_street: form.address_street.trim(),
        address_barangay: form.address_barangay.trim(),
        address_city: form.address_city.trim(),
        address_province: form.address_province.trim(),
        address_postal_code: form.address_postal_code.trim(),
        address_country: 'PH',
      });

      const res = await apiFetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          pets: [
            {
              pet_name: form.pet_name,
              species_id: form.species_id,
              breed_id: form.breed_id === '__other__' ? (otherBreedOption?.id || '') : form.breed_id,
              pet_sex: form.pet_sex,
              pet_dob: form.pet_dob || null,
            },
            ...(form.pet_name_2 || form.species_id_2 || form.breed_id_2 || form.pet_sex_2 || form.pet_dob_2
              ? [{
                  pet_name: form.pet_name_2,
                  species_id: form.species_id_2,
                  breed_id: form.breed_id_2 === '__other__' ? (otherBreedOption2?.id || '') : form.breed_id_2,
                  pet_sex: form.pet_sex_2,
                  pet_dob: form.pet_dob_2 || null,
                }]
              : []),
          ],
          breed_id: form.breed_id === '__other__' ? (otherBreedOption?.id || '') : form.breed_id,
          address: normalizedAddress,
          address_unit_floor: form.address_unit_floor.trim() || null,
          address_street: form.address_street.trim() || null,
          address_barangay: form.address_barangay.trim() || null,
          address_city: form.address_city.trim() || null,
          address_province: form.address_province.trim() || null,
          address_postal_code: form.address_postal_code.trim() || null,
          address_country: 'PH',
          phone: form.contact_number,
          terms_accepted: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.errors) {
          const mapped = {};
          Object.entries(data.errors).forEach(([k, v]) => {
            const key = k === 'phone' ? 'contact_number' : k;
            mapped[key] = Array.isArray(v) ? v[0] : v;
          });
          setFieldErrors(mapped);
          scrollToFirstError(mapped);
        } else {
          setServerError(data?.message || 'Registration failed.');
        }
        return;
      }
      if (data?.requires_otp) {
        setOtpMode(true);
        setOtpChallengeId(data?.data?.challenge_id || '');
        setOtpCode('');
        lastAutoSubmittedOtp.current = '';
        setOtpResendIn(30);
        setServerError(null);
        setTimeout(() => otpInputRefs.current[0]?.focus(), 0);
        return;
      }
      setServerError('Unexpected response. Please try again.');
    } catch {
      setServerError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!otpChallengeId || otpResendIn > 0) return;
    setLoading(true);
    setServerError(null);
    try {
      const res = await apiFetch('/api/register/otp/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: otpChallengeId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServerError(data?.message || 'Could not resend code.');
        return;
      }
      setOtpResendIn(30);
      setOtpCode('');
      lastAutoSubmittedOtp.current = '';
      otpInputRefs.current[0]?.focus();
    } catch {
      setServerError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpDigitChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = otpCode.split('');
    while (next.length < 6) next.push('');
    next[index] = digit;
    const joined = next.join('').slice(0, 6);
    setOtpCode(joined);
    setServerError(null);
    if (digit && index < 5) otpInputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !otpCode[index] && index > 0) otpInputRefs.current[index - 1]?.focus();
    if (event.key === 'ArrowLeft' && index > 0) otpInputRefs.current[index - 1]?.focus();
    if (event.key === 'ArrowRight' && index < 5) otpInputRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (event) => {
    const digits = (event.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!digits) return;
    event.preventDefault();
    setOtpCode(digits);
    setServerError(null);
    otpInputRefs.current[Math.min(5, digits.length - 1)]?.focus();
  };

  const strength = getStrength(form.password);
  const sm = STRENGTH_META[strength];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen overflow-y-auto" onClick={onClose}>
      <div
        className="register-modal-glass relative flex w-full max-w-[380px] md:max-w-[1100px] rounded-2xl overflow-hidden shadow-2xl font-poppins max-h-[94dvh] transition-all duration-300"
        onClick={(e) => e.stopPropagation()}>

        {/* Close button — top-right of card, mobile only */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/85 transition-colors hover:bg-white/20 hover:text-white"
          aria-label="Close"
        >
          <i className="fa-solid fa-xmark text-sm" />
        </button>

        {/* ── Left branding panel — hidden on mobile ───────────────────────── */}
        <div className="hidden md:flex bg-brand-teal flex-col items-center justify-center w-[320px] lg:w-[400px] shrink-0 relative">
            <div className="flex flex-col items-center justify-center w-full h-full py-16 px-8">
              <div className="w-28 h-28 rounded-full bg-brand-teal flex items-center justify-center mb-4">
                <img src="/assets/paw-teal.webp" alt="The Fur Club"
                  className="w-24 h-24 object-contain" />
              </div>
              <img src="/assets/furclub_text.webp" alt="The Fur Club Logo"
                className="w-60 h-auto object-contain mx-auto mt-3 mb-3" />
              <p className="text-sm font-bold tracking-[0.2em] text-white/70 text-center mt-2 uppercase">
                Join The Fur Club community
              </p>
              <p className="text-xs text-brand-dark/80 text-center mt-3 leading-relaxed">
                Your pet's second home is just a few steps away. <br />
                <span className="text-xs text-white/40">Powered by PawsitiveCare</span>
              </p>
          </div>
        </div>

        {/* ── Right form panel ────────────────────────────────────────────── */}
        <div className="register-glass-panel register-form-glass-panel relative text-white flex flex-col px-4 py-6 sm:px-8 sm:py-8 md:px-12 md:py-10 flex-1 min-w-0 overflow-y-auto max-h-[94dvh] md:max-h-[90vh]">
          <h1 className={`font-poppins text-2xl font-bold text-white ${otpMode ? 'text-center' : ''}`}>{otpMode ? 'Verify Your Account' : 'Create Your Account'}</h1>

          {serverError && (
            <div className={`mb-5 rounded-lg bg-red-500/20 border border-red-400/30 px-4 py-3 text-sm text-red-300 ${otpMode ? 'text-center' : ''}`}>
              {serverError}
            </div>
          )}

          <form className={otpMode ? "space-y-5" : "space-y-8"} onSubmit={handleSubmit} noValidate>
            {otpMode && (
              <section className="flex flex-col items-center space-y-5 py-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-teal/20 border border-brand-teal/40">
                  <i className="fa-solid fa-envelope-circle-check text-2xl text-brand-teal" />
                </div>

                <p className="w-full min-w-0 text-center text-sm text-white/70 leading-relaxed">
                  We sent a 6-digit verification code to<br />
                  <span className="block max-w-full break-all font-semibold text-white">{form.email}</span>
                </p>

                <div className="w-full">
                  <label className="block text-[11px] font-semibold tracking-[0.22em] mb-3 text-white/60 text-center">ENTER 6-DIGIT CODE</label>
                  <div className="grid grid-cols-6 gap-2 sm:gap-3" onPaste={handleOtpPaste}>
                    {Array.from({ length: 6 }).map((_, index) => (
                      <input
                        key={index}
                        ref={(el) => { otpInputRefs.current[index] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        className="h-12 sm:h-14 rounded-xl border border-white/25 bg-white/10 text-center text-xl font-bold text-white outline-none transition-all focus:border-brand-teal focus:bg-white/15 focus:ring-2 focus:ring-brand-teal/40"
                        value={otpCode[index] || ''}
                        onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex w-full items-center justify-between text-xs text-white/60">
                  <button type="button" onClick={handleResendOtp} disabled={loading || otpResendIn > 0} className="font-semibold hover:text-brand-orange transition-colors disabled:opacity-50">
                    {otpResendIn > 0 ? `Resend in ${otpResendIn}s` : 'Resend code'}
                  </button>
                  <button type="button" onClick={() => { setOtpMode(false); setOtpChallengeId(''); setOtpCode(''); lastAutoSubmittedOtp.current = ''; setServerError(null); }} className="font-semibold hover:text-brand-orange transition-colors">
                    &larr; Back to Register
                  </button>
                </div>
              </section>
            )}

            {/* ── Owner Information ────────────────────────────────────────── */}
            {!otpMode && <section>
              <h2 className="text-base font-bold mb-5 border-b border-brand-orange/30 pb-3 tracking-wide text-white">
                Owner Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                <div id="field-first_name">
                  <label htmlFor="first_name" className={labelClass}>FIRST NAME<RequiredMark /></label>
                  <input id="first_name" name="first_name" type="text" placeholder="First name"
                    className={inputClass(fieldErrors.first_name)}
                    value={form.first_name} onChange={handleChange} />
                  <FieldError msg={fieldErrors.first_name} />
                </div>

                <div id="field-last_name">
                  <label htmlFor="last_name" className={labelClass}>LAST NAME<RequiredMark /></label>
                  <input id="last_name" name="last_name" type="text" placeholder="Last name"
                    className={inputClass(fieldErrors.last_name)}
                    value={form.last_name} onChange={handleChange} />
                  <FieldError msg={fieldErrors.last_name} />
                </div>

                <div className="md:col-span-2" id="field-email">
                  <label htmlFor="email" className={labelClass}>EMAIL<RequiredMark /></label>
                  <input id="email" name="email" type="email" placeholder="Enter your email"
                    className={inputClass(fieldErrors.email)}
                    value={form.email} onChange={handleChange} />
                  <FieldError msg={fieldErrors.email} />
                </div>

                <div className="md:col-span-2" id="field-contact_number">
                  <label htmlFor="contact_number" className={labelClass}>CONTACT NUMBER<RequiredMark /></label>
                  <input id="contact_number" name="contact_number" type="text" placeholder="09XXXXXXXXX"
                    className={inputClass(fieldErrors.contact_number)}
                    maxLength={11}
                    value={form.contact_number}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setForm(p => ({ ...p, contact_number: val }));
                      if (fieldErrors.contact_number) setFieldErrors(p => ({ ...p, contact_number: undefined }));
                    }}
                    onBlur={() => {
                      if (!form.contact_number) return;
                      if (!/^09\d{9}$/.test(form.contact_number))
                        setFieldErrors(p => ({ ...p, contact_number: 'Must be a valid PH number (09XXXXXXXXX).' }));
                    }}
                  />
                  <FieldError msg={fieldErrors.contact_number} />
                </div>

                <div className="md:col-span-2 space-y-3">
                  <label className={labelClass}>ADDRESS</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div id="field-address_unit_floor">
                      <label htmlFor="address_unit_floor" className={labelClass}>UNIT / FLOOR</label>
                      <input id="address_unit_floor" name="address_unit_floor" type="text" placeholder="Unit/Floor (Optional)"
                        className={inputClass(fieldErrors.address_unit_floor)}
                        value={form.address_unit_floor} onChange={handleChange} />
                      <FieldError msg={fieldErrors.address_unit_floor} />
                    </div>
                    <div id="field-address_street">
                      <label htmlFor="address_street" className={labelClass}>HOUSE NO. / STREET<RequiredMark /></label>
                      <input id="address_street" name="address_street" type="text" placeholder="House No. / Street"
                        className={inputClass(fieldErrors.address_street)}
                        value={form.address_street} onChange={handleChange} />
                      <FieldError msg={fieldErrors.address_street} />
                    </div>
                    <PHAddressFields
                      form={form}
                      onFieldChange={(field, value) => {
                        setForm((p) => ({ ...p, [field]: value }));
                        if (fieldErrors[field]) setFieldErrors((p) => ({ ...p, [field]: undefined }));
                      }}
                      errors={fieldErrors}
                      variant="dark"
                      requiredFields={['address_province', 'address_city', 'address_barangay']}
                    />
                  </div>
                </div>

                {/* Password */}
                <div id="field-password">
                  <label htmlFor="password" className={labelClass}>PASSWORD<RequiredMark /></label>
                  <div className="relative">
                    <input id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="********"
                      className={`${inputClass(fieldErrors.password)} pr-10`}
                      value={form.password} onChange={handleChange} />
                    <button type="button"
                      onMouseDown={() => setShowPassword(true)}
                      onMouseUp={() => setShowPassword(false)}
                      onMouseLeave={() => setShowPassword(false)}
                      onTouchStart={() => setShowPassword(true)}
                      onTouchEnd={() => setShowPassword(false)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white select-none">
                      <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
                    </button>
                  </div>

                  {/* Strength meter */}
                  {form.password.length > 0 && (
                    <div className="mt-2">
                      <div className="flex gap-1 h-1.5">
                        {[1,2,3,4,5].map(i => (
                          <div key={i} className={`flex-1 rounded-full transition-all ${i <= strength ? sm.bar : 'bg-white/10'}`} />
                        ))}
                      </div>
                      <p className={`text-xs mt-1 font-medium ${sm.color}`}>{sm.label}</p>
                      <ul className="mt-2 space-y-0.5">
                        {PASSWORD_RULES.map((r) => (
                          <li key={r.label}
                            className={`text-xs flex items-center gap-1.5 ${r.test(form.password) ? 'text-green-400' : 'text-white/40'}`}>
                            <i className={`fa-solid ${r.test(form.password) ? 'fa-check' : 'fa-xmark'} text-[10px]`} />
                            {r.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <FieldError msg={fieldErrors.password} />
                </div>

                {/* Confirm password */}
                <div id="field-password_confirmation">
                  <label htmlFor="password_confirmation" className={labelClass}>CONFIRM PASSWORD<RequiredMark /></label>
                  <div className="relative">
                    <input id="password_confirmation" name="password_confirmation" type={showConfirm ? 'text' : 'password'} placeholder="********"
                      className={`${inputClass(fieldErrors.password_confirmation)} pr-10`}
                      value={form.password_confirmation} onChange={handleChange} />
                    <button type="button"
                      onMouseDown={() => setShowConfirm(true)}
                      onMouseUp={() => setShowConfirm(false)}
                      onMouseLeave={() => setShowConfirm(false)}
                      onTouchStart={() => setShowConfirm(true)}
                      onTouchEnd={() => setShowConfirm(false)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white select-none">
                      <i className={`fa-solid ${showConfirm ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
                    </button>
                  </div>
                  {form.password && form.password_confirmation && (
                    <p className={`text-xs mt-1.5 flex items-center gap-1.5 ${form.password === form.password_confirmation ? 'text-green-400' : 'text-red-400'}`}>
                      <i className={`fa-solid ${form.password === form.password_confirmation ? 'fa-check' : 'fa-xmark'} text-[10px]`} />
                      {form.password === form.password_confirmation ? 'Passwords match' : 'Passwords do not match'}
                    </p>
                  )}
                  <FieldError msg={fieldErrors.password_confirmation} />
                </div>

              </div>
            </section>}

            {/* ── Initial Pet Details ──────────────────────────────────────── */}
            {!otpMode && <section>
              <h2 className="text-base font-bold mb-5 border-b border-brand-orange/30 pb-3 tracking-wide text-white">
                Initial Pet Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                <div id="field-pet_name">
                  <label htmlFor="pet_name" className={labelClass}>PET NAME<RequiredMark /></label>
                  <input id="pet_name" name="pet_name" type="text" placeholder="Pet name"
                    className={inputClass(fieldErrors.pet_name)}
                    value={form.pet_name} onChange={handleChange} />
                  <FieldError msg={fieldErrors.pet_name} />
                </div>

                <div id="field-species_id">
                  <label className={labelClass}>PET SPECIES<RequiredMark /></label>
                  <SelectDropdown
                    value={form.species_id}
                    onChange={(v) => {
                      handleChange({ target: { name: 'species_id', value: v } });
                      setForm((p) => ({ ...p, breed_id: '', other_breed: '' }));
                    }}
                    options={[{ value: '', label: 'Select type' }, ...speciesList.map(s => ({ value: s.id, label: s.name }))]}
                    placeholder="Select type"
                    hasError={!!fieldErrors.species_id}
                    variant="dark"
                  />
                  <FieldError msg={fieldErrors.species_id} />
                </div>

                <div id="field-breed_id">
                  <label className={labelClass}>PET BREED<RequiredMark /></label>
                  <SelectDropdown
                    value={form.breed_id}
                    onChange={handleBreedChange}
                    options={breedOptions}
                    placeholder={form.species_id ? 'Select breed' : 'Select type first'}
                    disabled={!form.species_id}
                    hasError={!!fieldErrors.breed_id}
                    searchable
                    searchPlaceholder="Search breed..."
                    groupByFirstLetter
                    variant="dark"
                  />
                  {form.breed_id === '__other__' && (
                    <input
                      type="text"
                      name="other_breed"
                      value={form.other_breed}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, other_breed: e.target.value }));
                        if (fieldErrors.breed_id) setFieldErrors((p) => ({ ...p, breed_id: undefined }));
                      }}
                      placeholder="Please specify what breed"
                      autoFocus
                      className={`mt-2 ${inputClass(fieldErrors.breed_id)}`}
                    />
                  )}
                  <FieldError msg={fieldErrors.breed_id} />
                </div>

                <div id="field-pet_sex">
                  <label className={labelClass}>PET SEX<RequiredMark /></label>
                  <SelectDropdown
                    value={form.pet_sex}
                    onChange={(v) => handleChange({ target: { name: 'pet_sex', value: v } })}
                    options={[{ value: '', label: 'Select sex' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]}
                    placeholder="Select sex"
                    hasError={!!fieldErrors.pet_sex}
                    variant="dark"
                  />
                  <FieldError msg={fieldErrors.pet_sex} />
                </div>



                <div className="md:col-span-2" id="field-pet_dob">
                  <label htmlFor="pet_dob" className={labelClass}>DATE OF BIRTH<RequiredMark /></label>
                  <input id="pet_dob" name="pet_dob" type="date"
                    max={TODAY}
                    className={inputClass(fieldErrors.pet_dob)}
                    value={form.pet_dob} onChange={handleChange} />
                  <FieldError msg={fieldErrors.pet_dob} />
                </div>

              </div>

              <div className="mt-4 rounded-lg border border-white/15 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold tracking-wider text-white/80">Got another furbaby? (Optional)</p>
                  {showSecondPet ? (
                    <button
                      type="button"
                      onClick={() => {
                        setForm((p) => ({
                          ...p,
                          pet_name_2: '', species_id_2: '', breed_id_2: '', pet_sex_2: '', pet_dob_2: '', other_breed_2: '',
                        }));
                        setFieldErrors((p) => ({
                          ...p,
                          pet_name_2: undefined, species_id_2: undefined, breed_id_2: undefined, pet_sex_2: undefined, pet_dob_2: undefined,
                        }));
                        setShowSecondPet(false);
                      }}
                      className="text-xs font-semibold text-brand-orange hover:underline"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowSecondPet(true)}
                      className="text-xs font-semibold text-brand-orange hover:underline"
                    >
                      Add Another Pet
                    </button>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-white/65">
                  Register your second pet now, or add more later directly from your profile dashboard once you&apos;re all set up!
                </p>

                {showSecondPet && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div id="field-pet_name_2">
                      <label className={labelClass}>PET NAME<RequiredMark /></label>
                      <input name="pet_name_2" type="text" placeholder="Pet name"
                        className={inputClass(fieldErrors.pet_name_2)}
                        value={form.pet_name_2} onChange={handleChange} />
                      <FieldError msg={fieldErrors.pet_name_2} />
                    </div>

                    <div id="field-species_id_2">
                      <label className={labelClass}>PET SPECIES<RequiredMark /></label>
                      <SelectDropdown
                        value={form.species_id_2}
                        onChange={(v) => {
                          handleChange({ target: { name: 'species_id_2', value: v } });
                          setForm((p) => ({ ...p, breed_id_2: '', other_breed_2: '' }));
                        }}
                        options={[{ value: '', label: 'Select type' }, ...speciesList.map(s => ({ value: s.id, label: s.name }))]}
                        placeholder="Select type"
                        hasError={!!fieldErrors.species_id_2}
                        variant="dark"
                      />
                      <FieldError msg={fieldErrors.species_id_2} />
                    </div>

                    <div id="field-breed_id_2">
                      <label className={labelClass}>PET BREED<RequiredMark /></label>
                      <SelectDropdown
                        value={form.breed_id_2}
                        onChange={handleBreedChange2}
                        options={breedOptions2}
                        placeholder={form.species_id_2 ? 'Select breed' : 'Select type first'}
                        disabled={!form.species_id_2}
                        hasError={!!fieldErrors.breed_id_2}
                        searchable
                        searchPlaceholder="Search breed..."
                        groupByFirstLetter
                        variant="dark"
                      />
                      {form.breed_id_2 === '__other__' && (
                        <input
                          type="text"
                          name="other_breed_2"
                          value={form.other_breed_2}
                          onChange={(e) => {
                            setForm((p) => ({ ...p, other_breed_2: e.target.value }));
                            if (fieldErrors.breed_id_2) setFieldErrors((p) => ({ ...p, breed_id_2: undefined }));
                          }}
                          placeholder="Please specify what breed"
                          autoFocus
                          className={`mt-2 ${inputClass(fieldErrors.breed_id_2)}`}
                        />
                      )}
                      <FieldError msg={fieldErrors.breed_id_2} />
                    </div>

                    <div id="field-pet_sex_2">
                      <label className={labelClass}>PET SEX<RequiredMark /></label>
                      <SelectDropdown
                        value={form.pet_sex_2}
                        onChange={(v) => handleChange({ target: { name: 'pet_sex_2', value: v } })}
                        options={[{ value: '', label: 'Select sex' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]}
                        placeholder="Select sex"
                        hasError={!!fieldErrors.pet_sex_2}
                        variant="dark"
                      />
                      <FieldError msg={fieldErrors.pet_sex_2} />
                    </div>

                    <div className="md:col-span-2" id="field-pet_dob_2">
                      <label className={labelClass}>DATE OF BIRTH<RequiredMark /></label>
                      <input name="pet_dob_2" type="date"
                        max={TODAY}
                        className={inputClass(fieldErrors.pet_dob_2)}
                        value={form.pet_dob_2} onChange={handleChange} />
                      <FieldError msg={fieldErrors.pet_dob_2} />
                    </div>
                  </div>
                )}
              </div>

              {/* Terms */}
              <div className="mt-5" id="field-terms">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={termsChecked}
                    onChange={(e) => {
                      setTermsChecked(e.target.checked);
                      if (e.target.checked) setFieldErrors((p) => ({ ...p, terms: undefined }));
                    }}
                    className="accent-brand-orange w-4 h-4 mt-0.5 shrink-0"
                    style={{ appearance: 'checkbox' }}
                  />
                  <div className="text-sm text-white/80">
                    <span>I have read and understood the </span>
                    <button
                      type="button"
                      onClick={() => setShowTerms(true)}
                      className="font-semibold underline text-brand-orange hover:text-brand-orange-hover"
                    >
                      Terms and Conditions
                    </button>
                    <span> of Registration</span>
                  </div>
                </div>
                <FieldError msg={fieldErrors.terms} />
              </div>

            </section>}

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full bg-brand-teal hover:bg-brand-teal-dark text-white font-bauhaus font-bold text-lg py-3 rounded-full shadow-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? (otpMode ? 'Verifying...' : 'Registering...') : (otpMode ? 'Verify Account' : 'Register Account')}
            </button>

            {!otpMode && (
              <p className="text-center text-sm text-white/80">
                Already part of the family?{' '}
                <button type="button" onClick={onSwitchToLogin}
                  className="text-brand-orange hover:underline font-semibold">
                  Login
                </button>
              </p>
            )}

          </form>
        </div>
      </div>

      {showTerms && <TermsCondition isOpen={showTerms} onClose={() => setShowTerms(false)} />}
    </div>
  );
};

export default Register;
