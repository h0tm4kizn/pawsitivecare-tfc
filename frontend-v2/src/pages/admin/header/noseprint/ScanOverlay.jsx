import React from 'react';
import { CheckCircle2, ScanFace } from 'lucide-react';

export default function ScanOverlay({ quality, ready, isCapturing, mode, liveHint, autoCapturePending, species, petFrameValid, roiBox }) {
  const pct = Math.max(0, Math.min(100, Math.round(quality || 0)));
  const color = ready ? '#22c55e' : quality >= 40 ? '#f59e0b' : '#60a5fa';
  const label = isCapturing
    ? 'Analyzing...'
    : autoCapturePending
    ? `Hold still — ${pct}% clarity`
    : ready
    ? 'Ready — capturing automatically'
    : (liveHint || `${pct}% clarity`);

  // In identify mode, only display species drawing once detected/valid
  const showSpeciesDrawing = mode === 'enroll' || (mode === 'identify' && petFrameValid && (species === 'cat' || species === 'dog'));
  const activeSpecies = showSpeciesDrawing ? species : null;

  // Default fallback dimensions
  const defaultW = activeSpecies === 'cat' ? 155 : activeSpecies === 'dog' ? 140 : 130;
  const defaultH = activeSpecies === 'cat' ? 165 : activeSpecies === 'dog' ? 100 : 95;

  let frameStyle = {
    width: defaultW,
    height: defaultH,
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
  };

  if (roiBox && Array.isArray(roiBox.box) && Array.isArray(roiBox.frameSize)) {
    const [x1, y1, x2, y2] = roiBox.box;
    const [fw, fh] = roiBox.frameSize;
    if (fw > 0 && fh > 0 && x2 > x1 && y2 > y1) {
      const leftPct = (x1 / fw) * 100;
      const topPct = (y1 / fh) * 100;
      const widthPct = ((x2 - x1) / fw) * 100;
      const heightPct = ((y2 - y1) / fh) * 100;
      frameStyle = {
        left: `${leftPct.toFixed(1)}%`,
        top: `${topPct.toFixed(1)}%`,
        width: `${widthPct.toFixed(1)}%`,
        height: `${heightPct.toFixed(1)}%`,
        transform: 'none',
      };
    }
  }

  return (
    <>
      <style>{`
        @keyframes noseScan {
          0%   { top: 8%;  opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 82%; opacity: 0; }
        }
        @keyframes bracketPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes captureRing {
          from { stroke-dashoffset: 150.8; }
          to   { stroke-dashoffset: 0; }
        }
        .scan-beam { animation: noseScan 2.4s ease-in-out infinite; position: absolute; left: 0; right: 0; height: 2px; }
        .bracket-pulse { animation: bracketPulse 0.7s ease-in-out infinite; }
        .capture-ring { transform: rotate(-90deg); transform-origin: 30px 30px; animation: captureRing 0.9s linear forwards; }
      `}</style>

      <div className="pointer-events-none absolute inset-0">
        {/* Vignette */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-transparent to-black/55" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/50" />

        {/* Quality bar */}
        <div className="absolute left-4 right-4 top-3">
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
          </div>
        </div>

        {/* Corner-bracket frame — dimensions adapt per species or fit ROI box automatically */}
        <div
          className="absolute transition-all duration-300"
          style={frameStyle}
        >
          {/* TL */}
          <span
            className={`absolute left-0 top-0 block h-5 w-5 rounded-tl-sm border-l-[2.5px] border-t-[2.5px] transition-colors duration-300${autoCapturePending ? ' bracket-pulse' : ''}`}
            style={{ borderColor: color }}
          />
          {/* TR */}
          <span
            className={`absolute right-0 top-0 block h-5 w-5 rounded-tr-sm border-r-[2.5px] border-t-[2.5px] transition-colors duration-300${autoCapturePending ? ' bracket-pulse' : ''}`}
            style={{ borderColor: color }}
          />
          {/* BL */}
          <span
            className={`absolute bottom-0 left-0 block h-5 w-5 rounded-bl-sm border-b-[2.5px] border-l-[2.5px] transition-colors duration-300${autoCapturePending ? ' bracket-pulse' : ''}`}
            style={{ borderColor: color }}
          />
          {/* BR */}
          <span
            className={`absolute bottom-0 right-0 block h-5 w-5 rounded-br-sm border-b-[2.5px] border-r-[2.5px] transition-colors duration-300${autoCapturePending ? ' bracket-pulse' : ''}`}
            style={{ borderColor: color }}
          />

          {/* Default Scanning Reticle when no species face/nose is active */}
          {!activeSpecies && (
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 120 90" fill="none">
              <ellipse cx="60" cy="45" rx="36" ry="26" stroke={color} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6" />
              <line x1="60" y1="18" x2="60" y2="72" stroke={color} strokeWidth="1" opacity="0.35" />
              <line x1="28" y1="45" x2="92" y2="45" stroke={color} strokeWidth="1" opacity="0.35" />
              <circle cx="60" cy="45" r="2.5" fill={color} opacity="0.65" />
            </svg>
          )}

          {/* Dog Nose Print Drawing (for Dog) */}
          {activeSpecies === 'dog' && (
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 210 150"
              fill="none"
            >
              {/* Outer Nose Pad Silhouette */}
              <path
                d="M 45,45 C 45,22 75,15 105,15 C 135,15 165,22 165,45 C 165,78 142,112 105,118 C 68,112 45,78 45,45 Z"
                stroke={color} strokeWidth="1.8" strokeDasharray="6 4" opacity="0.85" fill="none"
              />
              {/* Center Philtrum Cleft Line */}
              <line x1="105" y1="65" x2="105" y2="118" stroke={color} strokeWidth="1.8" opacity="0.75" />

              {/* Left Nostril Opening (Wing / Comma shape) */}
              <path
                d="M 85,55 C 77,55 70,63 70,72 C 70,81 78,85 87,83 C 94,81 94,74 87,74 C 80,74 76,69 85,55 Z"
                stroke={color} strokeWidth="1.5" fill={color} fillOpacity="0.25" opacity="0.85"
              />
              {/* Right Nostril Opening (Wing / Comma shape) */}
              <path
                d="M 125,55 C 133,55 140,63 140,72 C 140,81 132,85 123,83 C 116,81 116,74 123,74 C 130,74 134,69 125,55 Z"
                stroke={color} strokeWidth="1.5" fill={color} fillOpacity="0.25" opacity="0.85"
              />

              {/* Nose Pad Texture Ridges */}
              <path d="M 64,48 Q 105,40 146,48" stroke={color} strokeWidth="0.9" opacity="0.3" fill="none" />
              <path d="M 58,62 Q 105,53 152,62" stroke={color} strokeWidth="0.9" opacity="0.3" fill="none" />
              <path d="M 60,76 Q 105,68 150,76" stroke={color} strokeWidth="0.9" opacity="0.3" fill="none" />
              <path d="M 68,90 Q 105,82 142,90" stroke={color} strokeWidth="0.9" opacity="0.3" fill="none" />

              {/* Center Focus Dot */}
              <circle cx="105" cy="72" r="3" fill={color} opacity="0.6" />
            </svg>
          )}

          {/* Cat Face Figure with Pointy Ears (for Cat) */}
          {activeSpecies === 'cat' && (
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 180 200"
              fill="none"
            >
              {/* Head Circle */}
              <ellipse cx="90" cy="118" rx="64" ry="64"
                stroke={color} strokeWidth="1.8" strokeDasharray="6 4" opacity="0.85" fill="none"
              />

              {/* Left Pointy Cat Ear */}
              <path
                d="M 40,76 C 14,16 38,8 64,30 Q 72,52 74,62"
                stroke={color} strokeWidth="1.8" opacity="0.85" fill="none"
              />
              <path
                d="M 44,70 C 26,28 40,20 58,36"
                stroke={color} strokeWidth="1.2" opacity="0.4" fill="none"
              />

              {/* Right Pointy Cat Ear */}
              <path
                d="M 140,76 C 166,16 142,8 116,30 Q 108,52 106,62"
                stroke={color} strokeWidth="1.8" opacity="0.85" fill="none"
              />
              <path
                d="M 136,70 C 154,28 140,20 122,36"
                stroke={color} strokeWidth="1.2" opacity="0.4" fill="none"
              />

              {/* Eye Alignment Guide Ovals */}
              <ellipse cx="64" cy="104" rx="12" ry="8" stroke={color} strokeWidth="1.2" opacity="0.5" fill="none" />
              <ellipse cx="116" cy="104" rx="12" ry="8" stroke={color} strokeWidth="1.2" opacity="0.5" fill="none" />
              <circle cx="64" cy="104" r="2.5" fill={color} opacity="0.4" />
              <circle cx="116" cy="104" r="2.5" fill={color} opacity="0.4" />

              {/* Nose Triangle */}
              <polygon points="90,125 82,137 98,137" stroke={color} strokeWidth="1.2" opacity="0.5" fill="none" />
              <circle cx="90" cy="126" r="2.5" fill={color} opacity="0.4" />

              {/* Whisker Lines */}
              <line x1="22" y1="130" x2="66" y2="128" stroke={color} strokeWidth="0.9" opacity="0.3" />
              <line x1="22" y1="140" x2="66" y2="136" stroke={color} strokeWidth="0.9" opacity="0.3" />
              <line x1="114" y1="128" x2="158" y2="130" stroke={color} strokeWidth="0.9" opacity="0.3" />
              <line x1="114" y1="136" x2="158" y2="140" stroke={color} strokeWidth="0.9" opacity="0.3" />
            </svg>
          )}

          {/* Scan beam */}
          {!isCapturing && (
            <div
              className="scan-beam"
              style={{
                background: `linear-gradient(90deg, transparent, ${color}99, ${color}, ${color}99, transparent)`,
              }}
            />
          )}
        </div>

        {/* Countdown ring — visible only when auto-capture is pending */}
        {autoCapturePending && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <svg width="60" height="60" viewBox="0 0 60 60">
              <circle cx="30" cy="30" r="24" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
              <circle
                cx="30" cy="30" r="24" fill="none"
                stroke="#22c55e" strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="150.8"
                className="capture-ring"
              />
            </svg>
          </div>
        )}

        {/* Mode badge */}
        <div className="absolute left-4 top-3 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 backdrop-blur-sm">
          <ScanFace size={11} style={{ color }} />
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color }}>
            {mode === 'enroll' ? 'Enroll' : 'Identify'}
          </span>
        </div>

        {/* Status pill */}
        <div className="absolute bottom-3 left-0 right-0 flex justify-center">
          <div className="rounded-full bg-black/70 px-4 py-1.5 backdrop-blur-sm">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color }}>
              {ready && !isCapturing && <CheckCircle2 size={12} />}
              {label}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
