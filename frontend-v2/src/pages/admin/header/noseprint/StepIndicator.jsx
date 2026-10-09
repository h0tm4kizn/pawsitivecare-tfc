import React from 'react';

const STEPS = ['Owner', 'Pet', 'Capture'];

export default function StepIndicator({ step }) {
  return (
    <div className="flex items-center justify-center gap-0 py-1">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-extrabold transition-all ${
                i < step
                  ? 'bg-brand-teal text-white'
                  : i === step
                  ? 'bg-brand-teal text-white ring-2 ring-brand-teal/30'
                  : 'bg-brand-dark-light text-brand-dark-soft'
              }`}
            >
              {i < step ? '✓' : i + 1}
            </div>
            <span
              className={`text-[9px] font-semibold uppercase tracking-wide ${
                i === step ? 'text-brand-dark' : 'text-brand-dark-soft'
              }`}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`mb-3 mx-2 h-px w-8 transition-all ${i < step ? 'bg-brand-teal' : 'bg-brand-dark-light'}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
