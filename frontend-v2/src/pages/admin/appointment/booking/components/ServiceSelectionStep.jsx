import { Trash2 } from "lucide-react";
import { useState } from "react";
import {
  getServiceTiers,
  getVisibleServiceTiers,
  shouldSkipGroomingSizeForCat,
  toManilaIsoDate,
} from "../bookingUtils";
import { formatSizeLabel } from "../../../../../utils/recordFormatters";
import { formatHotelDescription } from "../../../../../utils/textUtils";
import { SkeletonBlock } from "../../../../../components/admin/AdminLoading";
import SelectDropdown from "../../../../../components/reusable-ui/SelectDropdown";

const PARASITE_BLOCK_TITLE = 'A Little "Paws" for Your Pet\'s Well-being';
const PARASITE_BLOCK_BODY =
  "Our priority is a safe, parasite-free environment for everyone. Because we spotted some ticks/fleas, we can't proceed with the booking just yet. We're rooting for a speedy treatment so we can see those tail wags again!";
const MAX_PAWSOME_EXTRAS = 3;
const isPawsomeExtrasService = (service) =>
  String(service?.name || "")
    .trim()
    .toLowerCase() === "pawsome extras";
const HOTEL_DOG_SUITES_BY_SIZE = {
  Small: ["The Cozy Paw Suite", "The Happy Paws Suite", "The Grand Paw Suite"],
  Medium: ["The Happy Paws Suite", "The Grand Paw Suite"],
  Large: ["The Grand Paw Suite"],
  XLarge: ["The VIPaws Suite"],
};

const sizeWeightHint = (sizeLabel = "") => {
  const s = String(sizeLabel).toUpperCase();
  if (s === "S" || s.endsWith(" - SMALL")) return "Up to 5kg";
  if (s.endsWith(" - SMALL TO MEDIUM")) return "Up to 10kg";
  if (s === "M" || s.endsWith(" - MEDIUM")) return "6-10kg";
  if (s === "L" || s.endsWith(" - LARGE")) return "11-15kg";
  if (s === "XL" || s.endsWith(" - XLARGE") || s.endsWith(" - X-LARGE"))
    return "15-20kg";
  if (
    s === "XXL" ||
    s.endsWith(" - XXL") ||
    s.endsWith(" - XXLARGE") ||
    s.endsWith(" - XX-LARGE")
  )
    return "20kg up";
  return "";
};

const ADDON_SIZE_SUFFIX = /\s*-\s*(S|M|L|XL|XXL)$/i;
const addonBaseName = (name = "") =>
  String(name || "")
    .replace(ADDON_SIZE_SUFFIX, "")
    .trim();
const addonSizeName = (name = "") => {
  const match = String(name || "").match(ADDON_SIZE_SUFFIX);
  return match ? match[1].toUpperCase() : "";
};
const addonDisplayName = (addon) => addonBaseName(addon?.name || "");
const addonDisplayTier = (addon) =>
  addon?.tier_label || addonSizeName(addon?.name || "");
const addonPriceLabel = (addon) =>
  addon?.price_max
    ? `PHP ${Number(addon.price_min).toLocaleString("en-PH")} - PHP ${Number(addon.price_max).toLocaleString("en-PH")}`
    : `PHP ${Number(addon?.price_min || 0).toLocaleString("en-PH")}`;
const selectedAddonNames = (availableAddons = [], selectedIds = []) =>
  availableAddons
    .filter((addon) => selectedIds.includes(addon.id))
    .map((addon) => {
      const tier = addonDisplayTier(addon);
      return tier ? `${addonDisplayName(addon)} (${tier})` : addon.name;
    })
    .join(", ");
const parseDaycareTier = (tier) => {
  const raw = String(tier?.size_label || "");
  const low = raw.toLowerCase();
  let durationKey = "";
  let durationLabel = "";
  if (low.includes("hour")) {
    durationKey = "hourly";
    durationLabel = "Hourly";
  } else if (low.includes("half day") || low.includes("half-day")) {
    durationKey = "half_day";
    durationLabel = "Half Day";
  } else if (low.includes("full day") || low.includes("full-day")) {
    durationKey = "full_day";
    durationLabel = "Full Day";
  }
  const sizeLabel = raw
    .replace(/hourly\s*-\s*/i, "")
    .replace(/half\s*day\s*-\s*/i, "")
    .replace(/full\s*day\s*-\s*/i, "")
    .trim();
  return {
    rawSizeLabel: raw,
    durationKey,
    durationLabel,
    sizeLabel: sizeLabel || raw,
    price: Number(tier?.price || 0),
    durationHours: Number(tier?.duration_hours || 0),
  };
};
const formatDurationWithHours = (durationKey, rows = []) => {
  const matched = rows.filter((row) => row.durationKey === durationKey);
  const tierHours = matched
    .map((row) => Number(row.durationHours || 0))
    .filter((hours) => Number.isFinite(hours) && hours > 0);
  const inferredHours =
    durationKey === "hourly"
      ? 1
      : durationKey === "half_day"
        ? 4
        : durationKey === "full_day"
          ? 8
          : 0;
  const hours = tierHours[0] || inferredHours;
  const base =
    durationKey === "hourly"
      ? "Hourly"
      : durationKey === "half_day"
        ? "Half Day"
        : durationKey === "full_day"
          ? "Full Day"
          : "";
  return hours > 0 ? `${base} (${hours} hour${hours > 1 ? "s" : ""})` : base;
};
const inferDaycareDurationLabel = (service) => {
  const blob =
    `${service?.name || ""} ${service?.description || ""}`.toLowerCase();
  if (blob.includes("hour")) return "Hourly";
  if (blob.includes("half day") || blob.includes("half-day")) return "Half Day";
  if (blob.includes("full day") || blob.includes("full-day")) return "Full Day";
  return "";
};

export default function ServiceSelectionStep({
  entries,
  activeItemIndex,
  setActiveItemIndex,
  activeEntry,
  hotelSuites,
  hotelSuitesForPet,
  petSpecies,
  services,
  pawsomeExtrasService: resolvedPawsomeExtrasService = null,
  patchEntry,
  handleCategoryChange,
  handleServiceChange,
  setEntries,
  freshEntry,
  petHasTicksOrFlea,
  petMissingRabies,
  hasHotelCategory,
  hasNonHotelCategory,
  hasDaycareAndGrooming,
  lockCategory = false,
  selectedDaycarePetIds = [],
  ownerPets = [],
  daycarePetSizes = {},
  setDaycarePetSizes = () => {},
}) {
  const [openSizedExtra, setOpenSizedExtra] = useState("");
  const activeServiceTiers = getServiceTiers(activeEntry.selectedService);
  const visibleActiveServiceTiers = getVisibleServiceTiers(
    activeEntry.selectedService,
    petSpecies,
  );
  const activeRequiresRabies =
    String(activeEntry?.category || "").toLowerCase() === "hotel";
  const blockSelectionForRabies = activeRequiresRabies && petMissingRabies;
  const skipVisibleSizeStep = shouldSkipGroomingSizeForCat(
    activeEntry,
    petSpecies,
  );
  const isDaycare =
    String(activeEntry?.category || "").toLowerCase() === "daycare";
  const isHotel = String(activeEntry?.category || "").toLowerCase() === "hotel";
  const isGrooming =
    String(activeEntry?.category || "").toLowerCase() === "grooming";
  const isGroomingExtrasPath =
    isGrooming &&
    String(activeEntry?.grooming_booking_type || "").toLowerCase() === "extras";
  const selectedDaycarePets = ownerPets.filter((pet) =>
    selectedDaycarePetIds.map(String).includes(String(pet.id)),
  );
  const isGroomingPackagePath =
    isGrooming &&
    String(activeEntry?.grooming_booking_type || "").toLowerCase() ===
      "package";
  const hotelPetSizeOptions =
    petSpecies === "D"
      ? ["Small", "Medium", "Large", "XLarge"].map((value) => ({
          value,
          label: value,
        }))
      : petSpecies === "C"
        ? [
            { value: "CAT", label: "Cat" },
            { value: "KITTEN", label: "Kitten" },
          ]
        : [];
  const compatibleHotelSuites =
    petSpecies === "D"
      ? hotelSuitesForPet.filter((suite) =>
          (HOTEL_DOG_SUITES_BY_SIZE[activeEntry.pet_size] || []).includes(
            suite.name,
          ),
        )
      : hotelSuitesForPet;
  const selectedHotelSuite = hotelSuites.find(
    (suite) => String(suite.id) === String(activeEntry.hotel_suite_id),
  );
  const selectedHotelSuiteCompatible =
    !selectedHotelSuite ||
    petSpecies !== "D" ||
    compatibleHotelSuites.some(
      (suite) => String(suite.id) === String(selectedHotelSuite.id),
    );
  const pawsomeExtrasService =
    resolvedPawsomeExtrasService ||
    services.find(isPawsomeExtrasService) ||
    null;
  const daycareTierRows = isDaycare
    ? visibleActiveServiceTiers.map(parseDaycareTier)
    : [];
  const daycareDurationOptions = Array.from(
    new Map(
      daycareTierRows
        .filter((row) => row.durationKey)
        .map((row) => [
          row.durationKey,
          {
            value: row.durationKey,
            label: formatDurationWithHours(row.durationKey, daycareTierRows),
          },
        ]),
    ).values(),
  );
  const activeDaycareDuration = String(activeEntry?.daycare_duration || "");
  const daycareSizeRows = daycareTierRows.filter(
    (row) => row.durationKey === activeDaycareDuration,
  );
  const daycareAllSizesSelected =
    isDaycare &&
    selectedDaycarePetIds.length > 0 &&
    Boolean(activeDaycareDuration) &&
    selectedDaycarePetIds.every((petId) =>
      Boolean(daycarePetSizes[String(petId)]),
    );
  const selectedPromotionTier = activeServiceTiers.find(
    (tier) =>
      String(tier?.size_label || "") === String(activeEntry?.size_label || ""),
  );
  const availablePromotions = (selectedPromotionTier?.promotions || [])
    .filter((promo) => promo?.is_active !== false)
    .filter(
      (promo) =>
        !promo.starts_on ||
        promo.starts_on <= (activeEntry?.appointment_date || toManilaIsoDate()),
    )
    .filter(
      (promo) =>
        !promo.ends_on ||
        promo.ends_on >= (activeEntry?.appointment_date || toManilaIsoDate()),
    );
  const serviceDetailsReady =
    Boolean(activeEntry.category && activeEntry.service_id) &&
    (isHotel
      ? Boolean(activeEntry.pet_size && activeEntry.hotel_suite_id)
      : isDaycare
        ? daycareAllSizesSelected
        : activeServiceTiers.length === 0 ||
          activeEntry.size_label ||
          skipVisibleSizeStep);
  const shouldShowPawsomeExtrasChooser =
    isGroomingExtrasPath && serviceDetailsReady && !activeEntry.addonsDecided;
  const togglePawsomeExtra = (addonId, groupAddonIds = []) => {
    const groupIds = groupAddonIds.map(String);
    const selectedIds = activeEntry.addon_ids.map(String);
    const alreadySelected = selectedIds.includes(String(addonId));
    const withoutGroup = groupIds.length
      ? activeEntry.addon_ids.filter((id) => !groupIds.includes(String(id)))
      : activeEntry.addon_ids;
    if (alreadySelected) {
      patchEntry(activeEntry.key, {
        addon_ids: activeEntry.addon_ids.filter(
          (id) => String(id) !== String(addonId),
        ),
      });
      return;
    }
    if (withoutGroup.length >= MAX_PAWSOME_EXTRAS) return;
    patchEntry(activeEntry.key, { addon_ids: [...withoutGroup, addonId] });
  };

  return (
    <div className="space-y-4">
      {entries.slice(0, activeItemIndex).map((entry, idx) => (
        <div
          key={entry.key}
          className="rounded-xl border-2 border-green-200 bg-green-50 px-4 py-3 flex items-start justify-between gap-3"
        >
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <i className="fa-solid fa-circle-check mt-0.5 shrink-0 text-sm text-green-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-snug text-brand-dark">
                {entry.category === "hotel"
                  ? hotelSuites.find((s) => s.id === entry.hotel_suite_id)
                      ?.name || "Hotel Suite"
                  : entry.selectedService?.name || "-"}
              </p>
              {entry.size_label && (
                <p className="mt-0.5 text-[11px] leading-snug text-brand-dark-soft">
                  {formatSizeLabel(entry.size_label)}
                </p>
              )}
              {String(entry.category || "").toLowerCase() === "grooming" &&
                entry.addon_ids.length > 0 && (
                  <p className="mt-0.5 text-[11px] leading-snug text-brand-dark-soft">
                    +{" "}
                    {selectedAddonNames(entry.availableAddons, entry.addon_ids)}
                  </p>
                )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveItemIndex(idx)}
            className="text-[10px] text-brand-teal font-semibold hover:underline shrink-0"
          >
            Edit
          </button>
        </div>
      ))}

      <div className="space-y-3">
        {isHotel && (
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">
              Pet Size <span className="text-red-500">*</span>
            </label>
            <SelectDropdown
              value={activeEntry.pet_size || ""}
              onChange={(value) => {
                if (value === activeEntry.pet_size) return;
                patchEntry(activeEntry.key, { pet_size: value });
              }}
              options={hotelPetSizeOptions}
              placeholder={
                hotelPetSizeOptions.length
                  ? "Select pet size"
                  : "Pet species is not supported"
              }
              disabled={!hotelPetSizeOptions.length}
            />
            <p className="mt-1 text-[10px] text-brand-dark-soft">
              {petSpecies === "D"
                ? "Choose the dog's Daycare size category."
                : "Choose the existing cat category that fits this pet."}
            </p>
            {selectedHotelSuite && (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-brand-dark-light px-3 py-2">
                <span className="text-[10px] font-semibold text-brand-dark">
                  Selected suite: {selectedHotelSuite.name}
                  {!selectedHotelSuiteCompatible &&
                    " — choose a compatible suite for this size."}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    patchEntry(activeEntry.key, {
                      hotel_suite_id: "",
                      service_id: "",
                      selectedService: null,
                      size_label: "",
                    })
                  }
                  className="shrink-0 text-[10px] font-bold text-brand-teal hover:underline"
                >
                  Change suite
                </button>
              </div>
            )}
          </div>
        )}
        {isGrooming &&
          !blockSelectionForRabies &&
          !String(activeEntry.grooming_booking_type || "").trim() && (
            <div>
              <p className="text-sm font-bold text-brand-dark">
                What would you like to book?
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    patchEntry(activeEntry.key, {
                      grooming_booking_type: "package",
                      service_id: "",
                      selectedService: null,
                      size_label: "",
                      addon_ids: [],
                      loadingAddons: false,
                      addonsDecided: false,
                      show_pawsome_extras: false,
                    })
                  }
                  className={`min-h-11 rounded-xl border px-3 py-2 text-center text-xs font-extrabold transition-all ${
                    String(activeEntry.grooming_booking_type || "") ===
                    "package"
                      ? "border-brand-grooming bg-brand-grooming text-white"
                      : "border-brand-grooming/25 bg-white text-brand-grooming hover:border-brand-grooming/45 hover:bg-brand-grooming-soft"
                  }`}
                >
                  Grooming Package
                </button>
                <button
                  type="button"
                  disabled={!pawsomeExtrasService}
                  onClick={() => {
                    patchEntry(activeEntry.key, {
                      grooming_booking_type: "extras",
                      service_id: pawsomeExtrasService?.id || "",
                      selectedService: pawsomeExtrasService,
                      size_label: pawsomeExtrasService ? "Standard" : "",
                      addon_ids: [],
                      addonsDecided: false,
                      show_pawsome_extras: true,
                    });
                  }}
                  className={`min-h-11 rounded-xl border px-3 py-2 text-center text-xs font-extrabold transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
                    String(activeEntry.grooming_booking_type || "") === "extras"
                      ? "border-brand-grooming bg-brand-grooming text-white"
                      : "border-brand-grooming/25 bg-white text-brand-grooming hover:border-brand-grooming/45 hover:bg-brand-grooming-soft"
                  }`}
                >
                  Pawsome Extras
                </button>
              </div>
            </div>
          )}
        {!activeEntry.category && (
          <>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-dark-soft">
              Select a Service
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
              {[
                {
                  key: "daycare",
                  label: "Pet Daycare",
                  desc: "Safe playtime & socialization",
                  icon: "fa-bone",
                  border: "border-brand-daycare/30",
                  hoverBg: "hover:bg-brand-daycare-soft",
                  textColor: "text-brand-daycare",
                  iconBg: "bg-brand-daycare-soft",
                },
                {
                  key: "grooming",
                  label: "Pet Grooming",
                  desc: "Full grooming & styling",
                  icon: "fa-scissors",
                  border: "border-brand-grooming/30",
                  hoverBg: "hover:bg-brand-grooming-soft",
                  textColor: "text-brand-grooming",
                  iconBg: "bg-brand-grooming-soft",
                },
                {
                  key: "hotel",
                  label: "Pet Hotel",
                  desc: "Cozy air-conditioned rooms",
                  icon: "fa-hotel",
                  border: "border-brand-hotel/30",
                  hoverBg: "hover:bg-brand-hotel-soft",
                  textColor: "text-brand-hotel",
                  iconBg: "bg-brand-hotel-soft",
                },
              ]
                .filter(({ key }) => {
                  if (
                    key === "hotel" &&
                    (hasNonHotelCategory || hasDaycareAndGrooming)
                  )
                    return false;
                  if (key !== "hotel" && hasHotelCategory) return false;
                  return true;
                })
                .map(
                  ({
                    key,
                    label,
                    desc,
                    icon,
                    border,
                    hoverBg,
                    textColor,
                    iconBg,
                  }) => (
                    <button
                      key={key}
                      type="button"
                      disabled={petHasTicksOrFlea}
                      onClick={() => handleCategoryChange(activeEntry.key, key)}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all sm:flex-col sm:justify-start sm:gap-2.5 sm:py-4 sm:text-center ${border} ${
                        petHasTicksOrFlea
                          ? "cursor-not-allowed opacity-45"
                          : hoverBg
                      }`}
                    >
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12 ${iconBg}`}
                      >
                        <i
                          className={`fa-solid ${icon} ${textColor} text-lg`}
                        />
                      </div>
                      <div className="min-w-0 sm:text-center">
                        <p className={`text-xs font-bold ${textColor} mb-0.5`}>
                          {label}
                        </p>
                        <p className="text-[10px] text-brand-dark-soft leading-snug">
                          {desc}
                        </p>
                      </div>
                    </button>
                  ),
                )}
            </div>
            {petHasTicksOrFlea && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <p className="font-semibold">{PARASITE_BLOCK_TITLE}</p>
                <p className="mt-1">{PARASITE_BLOCK_BODY}</p>
              </div>
            )}
          </>
        )}

        {activeEntry.category === "hotel" &&
          !activeEntry.hotel_suite_id &&
          !blockSelectionForRabies && (
            <>
              <div className="flex items-center gap-2">
                {!lockCategory && (
                  <button
                    type="button"
                    onClick={() => handleCategoryChange(activeEntry.key, "")}
                    className="text-brand-dark-soft hover:text-brand-teal transition-colors"
                  >
                    <i className="fa-solid fa-chevron-left text-xs" />
                  </button>
                )}
                <p className="text-xs font-bold uppercase tracking-wider text-brand-dark-soft">
                  Select Suite -{" "}
                  {petSpecies === "D"
                    ? "Dogs"
                    : petSpecies === "C"
                      ? "Cats"
                      : "All"}
                </p>
              </div>
              <div className="space-y-2">
                {hotelSuitesForPet.find((suite) => suite.description)
                  ?.description && (
                  <p className="rounded-xl border border-brand-hotel/20 bg-brand-hotel-soft/40 px-4 py-3 text-xs leading-relaxed text-brand-dark-soft">
                    {formatHotelDescription(
                      hotelSuitesForPet.find((suite) => suite.description)
                        .description,
                    )}
                  </p>
                )}
                {compatibleHotelSuites.length === 0 ? (
                  <p className="text-xs text-brand-dark-soft">
                    No suites available for this pet&apos;s selected size.
                  </p>
                ) : (
                  compatibleHotelSuites.map((suite) => (
                    <button
                      key={suite.id}
                      type="button"
                      onClick={() =>
                        patchEntry(activeEntry.key, {
                          hotel_suite_id: suite.id,
                          size_label: suite.size_range || suite.size || "",
                        })
                      }
                      className="w-full text-left rounded-xl border border-brand-dark-light px-4 py-3 hover:border-brand-teal/50 transition-colors"
                    >
                      <p className="text-sm font-bold text-brand-dark">
                        {suite.name}
                      </p>
                      <p className="text-xs text-brand-dark font-semibold mt-0.5">
                        PHP{" "}
                        {Number(suite.price_per_night).toLocaleString("en-PH", {
                          timeZone: "Asia/Manila",
                          minimumFractionDigits: 2,
                        })}
                        /night - {suite.size_range}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </>
          )}

        {activeEntry.category &&
          activeEntry.category !== "hotel" &&
          !activeEntry.service_id &&
          !blockSelectionForRabies && (
            <>
              {(!isGrooming ||
                activeEntry.grooming_booking_type === "package") && (
                <>
                  <div className="flex items-center gap-2">
                    {!lockCategory && (
                      <button
                        type="button"
                        onClick={() =>
                          patchEntry(activeEntry.key, {
                            category: "",
                            service_id: "",
                            selectedService: null,
                            size_label: "",
                            loadingAddons: false,
                            addonsDecided: false,
                            addon_ids: [],
                            availableAddons: [],
                            show_pawsome_extras: false,
                          })
                        }
                        className="text-brand-dark-soft hover:text-brand-teal transition-colors"
                      >
                        <i className="fa-solid fa-chevron-left text-xs" />
                      </button>
                    )}
                    <p className="text-xs font-bold uppercase tracking-wider text-brand-dark-soft">
                      {String(activeEntry.category || "").toLowerCase() ===
                      "daycare"
                        ? "Select Daycare Package"
                        : "Select Package"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {activeEntry.loadingServices ? (
                      <div
                        role="status"
                        aria-label={`Loading ${String(activeEntry.category || "service").toLowerCase()} packages`}
                        className="space-y-2"
                      >
                        <span className="sr-only">
                          Loading packages and pricing
                        </span>
                        {Array.from({ length: 3 }, (_, index) => (
                          <div
                            key={index}
                            className="rounded-xl border border-brand-dark-light bg-white px-4 py-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <SkeletonBlock
                                className={`h-4 ${index === 1 ? "w-36" : "w-44"}`}
                              />
                              {String(
                                activeEntry.category || "",
                              ).toLowerCase() === "daycare" && (
                                <SkeletonBlock className="h-5 w-16 rounded-full" />
                              )}
                            </div>
                            <SkeletonBlock
                              className={`mt-2 h-3 ${index === 2 ? "w-3/5" : "w-4/5"}`}
                            />
                          </div>
                        ))}
                      </div>
                    ) : activeEntry.serviceLoadError ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-center">
                        <i className="fa-solid fa-triangle-exclamation text-lg text-amber-500" />
                        <p className="mt-2 text-xs font-bold text-brand-dark">
                          {String(activeEntry.category || "Service")} packages
                          could not be loaded.
                        </p>
                        <p className="mt-1 text-[11px] text-brand-dark-soft">
                          {activeEntry.serviceLoadError}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            handleCategoryChange(
                              activeEntry.key,
                              activeEntry.category,
                            )
                          }
                          className="mt-3 rounded-lg bg-brand-daycare px-4 py-2 text-xs font-bold text-white transition hover:brightness-95"
                        >
                          Retry
                        </button>
                      </div>
                    ) : (
                      services
                        .filter(
                          (svc) =>
                            String(svc?.category || "").toLowerCase() ===
                            String(activeEntry.category || "").toLowerCase(),
                        )
                        .filter(
                          (svc) => !isGrooming || !isPawsomeExtrasService(svc),
                        )
                        .sort((a, b) => {
                          if (
                            String(activeEntry.category || "").toLowerCase() !==
                            "daycare"
                          )
                            return 0;
                          const rank = (svc) => {
                            const label = inferDaycareDurationLabel(svc);
                            if (label === "Hourly") return 1;
                            if (label === "Half Day") return 2;
                            if (label === "Full Day") return 3;
                            return 99;
                          };
                          return rank(a) - rank(b);
                        })
                        .map((svc) => (
                          <button
                            key={svc.id}
                            type="button"
                            onClick={() =>
                              handleServiceChange(activeEntry.key, svc.id)
                            }
                            className="w-full text-left rounded-xl border border-brand-dark-light px-4 py-3 hover:border-brand-teal/50 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-bold text-brand-dark">
                                {svc.name}
                              </p>
                              {String(
                                activeEntry.category || "",
                              ).toLowerCase() === "daycare" &&
                                inferDaycareDurationLabel(svc) && (
                                  <span className="rounded-full bg-brand-daycare-soft px-2 py-0.5 text-[10px] font-bold text-brand-daycare">
                                    {inferDaycareDurationLabel(svc)}
                                  </span>
                                )}
                            </div>
                            {svc.description && (
                              <p className="text-xs text-brand-dark-soft mt-0.5">
                                {svc.description}
                              </p>
                            )}
                          </button>
                        ))
                    )}
                  </div>
                </>
              )}
            </>
          )}

        {activeEntry.category &&
          activeEntry.category !== "hotel" &&
          activeEntry.service_id &&
          activeServiceTiers.length > 0 &&
          !activeEntry.size_label &&
          !skipVisibleSizeStep &&
          !isDaycare && (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    patchEntry(activeEntry.key, {
                      service_id: "",
                      selectedService: null,
                      size_label: "",
                      loadingAddons: false,
                      addonsDecided: false,
                      addon_ids: [],
                      show_pawsome_extras: false,
                    })
                  }
                  className="text-brand-dark-soft hover:text-brand-teal transition-colors"
                >
                  <i className="fa-solid fa-chevron-left text-xs" />
                </button>
                <p className="text-xs font-bold uppercase tracking-wider text-brand-dark-soft">
                  Select Size
                </p>
              </div>
              <p className="text-sm font-bold text-brand-dark">
                {activeEntry.selectedService?.name}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {visibleActiveServiceTiers.map((tier) => (
                  <button
                    key={tier.size_label}
                    type="button"
                    onClick={() =>
                      patchEntry(activeEntry.key, {
                        size_label: tier.size_label,
                      })
                    }
                    className="rounded-xl border border-brand-dark-light px-3 py-2.5 text-left hover:border-brand-teal/50 transition-colors"
                  >
                    <p className="text-xs font-bold text-brand-dark">
                      {formatSizeLabel(tier.size_label)}
                    </p>
                    {sizeWeightHint(tier.size_label) && (
                      <p className="text-[10px] text-brand-dark-soft">
                        {sizeWeightHint(tier.size_label)}
                      </p>
                    )}
                    <p className="text-xs text-brand-dark font-semibold">
                      PHP{" "}
                      {Number(tier.price).toLocaleString("en-PH", {
                        timeZone: "Asia/Manila",
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </button>
                ))}
              </div>
            </>
          )}

        {activeEntry.category &&
          activeEntry.category !== "hotel" &&
          activeEntry.service_id &&
          activeServiceTiers.length > 0 &&
          isDaycare && (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    patchEntry(activeEntry.key, {
                      service_id: "",
                      selectedService: null,
                      size_label: "",
                      loadingAddons: false,
                      addonsDecided: false,
                      addon_ids: [],
                      show_pawsome_extras: false,
                    })
                  }
                  className="text-brand-dark-soft hover:text-brand-teal transition-colors"
                >
                  <i className="fa-solid fa-chevron-left text-xs" />
                </button>
                <p className="text-xs font-bold uppercase tracking-wider text-brand-dark-soft">
                  Select Daycare Package
                </p>
              </div>
              <div className="rounded-xl border border-brand-daycare/25 bg-brand-daycare-soft/30 px-3 py-3">
                <p className="mb-2 text-[11px] font-bold text-brand-dark">
                  Daycare Duration
                </p>
                <SelectDropdown
                  value={activeDaycareDuration}
                  onChange={(value) => {
                    patchEntry(activeEntry.key, {
                      daycare_duration: value || null,
                    });
                    setDaycarePetSizes((prev) => {
                      const next = { ...prev };
                      selectedDaycarePetIds.forEach((petId) => {
                        delete next[String(petId)];
                      });
                      return next;
                    });
                  }}
                  options={daycareDurationOptions}
                  placeholder="Select duration"
                />
              </div>
              {Boolean(activeDaycareDuration) && (
                <div className="space-y-2">
                  {selectedDaycarePets.map((pet) => {
                    const petId = String(pet.id);
                    const selectedSize = daycarePetSizes[petId] || "";
                    return (
                      <div
                        key={petId}
                        className="rounded-xl border border-brand-daycare/25 bg-brand-daycare-soft/30 px-3 py-3"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-[11px] font-bold text-brand-dark">
                            Size of Pet
                          </p>
                          <p className="truncate text-[10px] font-semibold text-brand-teal">
                            {pet.name}
                          </p>
                        </div>
                        <SelectDropdown
                          value={selectedSize}
                          onChange={(size) =>
                            setDaycarePetSizes((prev) => ({
                              ...prev,
                              [petId]: size,
                            }))
                          }
                          options={daycareSizeRows.map((row) => ({
                            value: row.rawSizeLabel,
                            label: `${formatSizeLabel(row.sizeLabel)} - PHP ${row.price.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
                          }))}
                          placeholder="Select size"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

        {isGroomingPackagePath && serviceDetailsReady && (
          <div className="rounded-xl border-2 border-green-200 bg-green-50 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <i className="fa-solid fa-circle-check mt-0.5 shrink-0 text-sm text-green-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold leading-snug text-brand-dark">
                    {activeEntry.selectedService?.name || "-"}
                  </p>
                  {activeEntry.size_label && (
                    <p className="mt-0.5 text-[11px] leading-snug text-brand-dark-soft">
                      {formatSizeLabel(activeEntry.size_label)}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  patchEntry(activeEntry.key, {
                    service_id: "",
                    selectedService: null,
                    size_label: "",
                    addon_ids: [],
                    loadingAddons: false,
                    addonsDecided: false,
                    show_pawsome_extras: false,
                  })
                }
                className="shrink-0 text-[10px] font-bold text-brand-teal hover:underline"
              >
                Edit Package
              </button>
            </div>
          </div>
        )}

        {serviceDetailsReady && availablePromotions.length > 0 && (
          <div className="rounded-xl border border-brand-teal/20 bg-brand-teal/5 px-4 py-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-brand-teal-dark">
              Apply Promotion (Optional)
            </p>
            <SelectDropdown
              value={activeEntry.promotion_id || ""}
              onChange={(value) =>
                patchEntry(activeEntry.key, { promotion_id: value || "" })
              }
              options={[
                { value: "", label: "No promotion" },
                ...availablePromotions.map((promo) => ({
                  value: promo.id,
                  label:
                    promo.discount_type === "percentage"
                      ? `${promo.title} (${promo.discount_value}% off)`
                      : promo.discount_type === "fixed"
                        ? `${promo.title} (PHP ${Number(promo.discount_value || 0).toFixed(2)} off)`
                        : `${promo.title} (Set price PHP ${Number(promo.promotional_price || 0).toFixed(2)})`,
                })),
              ]}
              placeholder="No promotion"
            />
          </div>
        )}

        {shouldShowPawsomeExtrasChooser &&
          activeEntry.availableAddons.length > 0 &&
          (() => {
            const groups = [];
            const seen = {};
            activeEntry.availableAddons.forEach((addon) => {
              const base = addonDisplayName(addon);
              const size = addonDisplayTier(addon);
              if (seen[base] === undefined) {
                seen[base] = groups.length;
                groups.push({ base, items: [] });
              }
              groups[seen[base]].items.push({ ...addon, size });
            });
            groups.sort((a, b) => {
              const aHasChoices =
                a.items.length > 1 || Boolean(a.items[0]?.size);
              const bHasChoices =
                b.items.length > 1 || Boolean(b.items[0]?.size);
              if (aHasChoices !== bHasChoices) return aHasChoices ? -1 : 1;
              return a.base.localeCompare(b.base);
            });
            return (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-dark-soft">
                    Select Pawsome Extras
                  </p>
                  <span className="text-[10px] font-semibold text-brand-teal">
                    {activeEntry.addon_ids.length} of {MAX_PAWSOME_EXTRAS}{" "}
                    selected
                  </span>
                </div>
                <div className="space-y-2">
                  {groups.map(({ base, items }) => {
                    const isSized = items.length > 1 || items[0].size;
                    if (isSized) {
                      const selectedAddon = items.find((a) =>
                        activeEntry.addon_ids.includes(a.id),
                      );
                      const isSizeSelectorOpen =
                        openSizedExtra === base || Boolean(selectedAddon);
                      const selectionLimitReached =
                        !selectedAddon &&
                        activeEntry.addon_ids.length >= MAX_PAWSOME_EXTRAS;
                      return (
                        <div
                          key={base}
                          className={`rounded-xl border px-4 py-3 transition-colors ${selectedAddon ? "border-brand-teal bg-brand-teal-light" : "border-brand-dark-light"}`}
                        >
                          <button
                            type="button"
                            disabled={selectionLimitReached}
                            onClick={() => {
                              if (selectedAddon) {
                                patchEntry(activeEntry.key, {
                                  addon_ids: activeEntry.addon_ids.filter(
                                    (id) =>
                                      !items.some((addon) => addon.id === id),
                                  ),
                                });
                                setOpenSizedExtra("");
                                return;
                              }
                              setOpenSizedExtra((current) =>
                                current === base ? "" : base,
                              );
                            }}
                            className="flex w-full items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${selectedAddon ? "border-brand-teal bg-brand-teal" : "border-brand-dark-light"}`}
                              >
                                {selectedAddon && (
                                  <i className="fa-solid fa-check text-[8px] text-white" />
                                )}
                              </span>
                              <span className="text-sm font-semibold text-brand-dark">
                                {base}
                              </span>
                            </span>
                            <i
                              className={`fa-solid fa-chevron-down text-[10px] text-brand-teal transition-transform ${isSizeSelectorOpen ? "rotate-180" : ""}`}
                            />
                          </button>
                          {isSizeSelectorOpen && (
                            <div className="mt-3 border-t border-brand-teal/15 pt-3">
                              <SelectDropdown
                                value={selectedAddon?.id || ""}
                                onChange={(selectedId) => {
                                  const withoutThisGroup =
                                    activeEntry.addon_ids.filter(
                                      (id) =>
                                        !items.some((addon) => addon.id === id),
                                    );
                                  if (!selectedId) {
                                    patchEntry(activeEntry.key, {
                                      addon_ids: withoutThisGroup,
                                    });
                                    return;
                                  }
                                  if (
                                    withoutThisGroup.length >=
                                    MAX_PAWSOME_EXTRAS
                                  )
                                    return;
                                  patchEntry(activeEntry.key, {
                                    addon_ids: [
                                      ...withoutThisGroup,
                                      selectedId,
                                    ],
                                  });
                                }}
                                options={items.map((addon) => ({
                                  value: addon.id,
                                  label: `${addon.size || "Standard"} - ${addonPriceLabel(addon)}`,
                                }))}
                                placeholder="Select size"
                                buttonClassName="!rounded-lg !px-3 !py-2"
                                textClassName="!text-xs !font-semibold"
                              />
                            </div>
                          )}
                        </div>
                      );
                    }
                    const addon = items[0];
                    const selected = activeEntry.addon_ids.includes(addon.id);
                    const selectionLimitReached =
                      !selected &&
                      activeEntry.addon_ids.length >= MAX_PAWSOME_EXTRAS;
                    const price = addonPriceLabel(addon);
                    return (
                      <button
                        key={addon.id}
                        type="button"
                        disabled={selectionLimitReached}
                        onClick={() => {
                          togglePawsomeExtra(addon.id);
                        }}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 sm:px-4 ${selected ? "border-brand-teal bg-brand-teal-light" : "border-brand-dark-light hover:border-brand-teal/50"}`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${selected ? "bg-brand-teal border-brand-teal" : "border-brand-dark-light"}`}
                          >
                            {selected && (
                              <i className="fa-solid fa-check text-white text-[8px]" />
                            )}
                          </div>
                          <p className="min-w-0 text-sm font-semibold text-brand-dark">
                            {addon.name}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-brand-dark">
                          {price}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {activeEntry.addon_ids.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      patchEntry(activeEntry.key, { addonsDecided: true })
                    }
                    className="w-full rounded-lg bg-brand-teal px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-teal-dark"
                  >
                    Done
                  </button>
                )}
              </>
            );
          })()}

        {shouldShowPawsomeExtrasChooser && activeEntry.loadingAddons && (
          <div
            role="status"
            aria-label="Loading Pawsome Extras"
            className="space-y-3"
          >
            <span className="sr-only">Loading Pawsome Extras</span>
            <SkeletonBlock className="h-3 w-36" />
            <div className="space-y-2">
              {Array.from({ length: 4 }, (_, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-3 rounded-xl border border-brand-dark-light bg-white px-3 py-3 sm:px-4"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <SkeletonBlock className="h-4 w-4 shrink-0" />
                    <SkeletonBlock
                      className={`h-4 ${index % 2 === 0 ? "w-36" : "w-28"}`}
                    />
                  </div>
                  <SkeletonBlock className="h-3 w-20 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {isGroomingExtrasPath &&
          !activeEntry.loadingAddons &&
          activeEntry.availableAddons.length === 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-brand-dark-soft">
                  Select Pawsome Extras
                </p>
              </div>
              {activeEntry.addonLoadError ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-center">
                  <p className="text-xs font-semibold text-brand-dark-soft">
                    {activeEntry.addonLoadError}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      patchEntry(activeEntry.key, {
                        addonLoadError: "",
                        loadingAddons: false,
                      })
                    }
                    className="mt-2 text-xs font-bold text-brand-teal hover:underline"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <p className="rounded-lg border border-brand-dark-light bg-brand-surface px-3 py-2 text-xs font-semibold text-brand-dark-soft">
                  No Pawsome Extras available right now.
                </p>
              )}
            </>
          )}

        {isGroomingExtrasPath &&
          activeEntry.addonsDecided &&
          activeEntry.addon_ids.length > 0 && (
            <div className="rounded-xl border border-brand-dark-light bg-white px-4 py-3 flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <i className="fa-solid fa-circle-check mt-0.5 shrink-0 text-sm text-brand-teal" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold leading-snug text-brand-dark">
                    Pawsome Extras
                  </p>
                  {activeEntry.addon_ids.length > 0 && (
                    <p className="mt-0.5 text-[11px] leading-snug text-brand-dark-soft">
                      {selectedAddonNames(
                        activeEntry.availableAddons,
                        activeEntry.addon_ids,
                      )}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  patchEntry(activeEntry.key, {
                    addonsDecided: false,
                    show_pawsome_extras: true,
                  })
                }
                className="text-[10px] text-brand-teal font-semibold hover:underline shrink-0"
              >
                Edit Pawsome Extras
              </button>
            </div>
          )}

        {activeEntry.category === "hotel" &&
          activeEntry.hotel_suite_id &&
          !blockSelectionForRabies && (
            <div className="rounded-xl border-2 border-green-200 bg-green-50 px-4 py-3 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                <i className="fa-solid fa-circle-check mt-0.5 shrink-0 text-sm text-green-500" />
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-snug text-brand-dark">
                    {hotelSuites.find(
                      (s) => s.id === activeEntry.hotel_suite_id,
                    )?.name || "Suite"}
                  </p>
                  {activeEntry.size_label && (
                    <p className="mt-0.5 text-[11px] leading-snug text-brand-dark-soft">
                      {formatSizeLabel(activeEntry.size_label)}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  patchEntry(activeEntry.key, {
                    hotel_suite_id: "",
                    size_label: "",
                    hotel_checkout: "",
                    hotel_nights: "",
                    appointment_date: "",
                  })
                }
                className="text-[10px] text-brand-teal font-semibold hover:underline shrink-0"
              >
                Edit
              </button>
            </div>
          )}

        {entries.length > 1 && (
          <button
            type="button"
            onClick={() => {
              const next = entries.filter(
                (entry) => entry.key !== activeEntry.key,
              );
              setEntries(next.length > 0 ? next : [freshEntry()]);
              setActiveItemIndex(0);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-100"
          >
            <Trash2 size={12} />
            Remove Item
          </button>
        )}
      </div>
    </div>
  );
}
