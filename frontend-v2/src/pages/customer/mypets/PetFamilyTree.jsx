import { useEffect, useRef, useState } from 'react';

const petIsCat    = (p) => String(p?.species_type?.name || p?.speciesType?.name || '').toLowerCase().includes('cat');
const petColor    = (p) => petIsCat(p) ? '#FE7E4D' : '#4FC6C9';
const petInitials = (n) => String(n || '?').slice(0, 2).toUpperCase();

const calcBirthdayDays = (dob) => {
  if (!dob) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const birth = new Date(String(dob).slice(0,10) + 'T00:00:00');
  if (isNaN(birth.getTime())) return null;
  const next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return Math.round((next - today) / (1000*60*60*24));
};

function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function generateBlossoms(cx, cy, rx, ry, count, seed) {
  const rand = seededRand(seed);
  const out = [];
  let attempts = 0;
  while (out.length < count && attempts < count * 10) {
    attempts++;
    const x = cx + (rand() * 2 - 1) * rx;
    const y = cy + (rand() * 2 - 1) * ry;
    if ((x - cx) ** 2 / rx ** 2 + (y - cy) ** 2 / ry ** 2 <= 1)
      out.push({ x, y, size: 0.55 + rand() * 0.9, rot: rand() * 360 });
  }
  return out;
}

// Scatter pet positions inside canopy — oldest lowest Y, youngest highest Y
// Ensures no two avatars overlap (min distance = avatar diameter + padding)
function scatterPetPositions(count, sortedPets, CX = 400, CY = 250, RX = 180, RY = 100, avatarR = 20) {
  if (count === 0) return [];
  const MIN_DIST = avatarR * 2 + 28;
  const rand = seededRand(99);
  const positions = [];

  sortedPets.forEach((_, i) => {
    const t = count === 1 ? 0.5 : i / (count - 1);
    // Y: oldest at bottom, youngest at top
    const targetY = (CY + RY * 0.65) - t * (RY * 1.3);

    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 200) {
      attempts++;
      // Vary Y slightly around target
      const y = targetY + (rand() * 2 - 1) * 14;
      // Max X at this Y — 0.62 keeps pets well inside canopy
      const maxX = RX * Math.sqrt(Math.max(0, 1 - ((y - CY) / RY) ** 2)) * 0.62;
      if (maxX < 10) continue;
      const x = CX + (rand() * 2 - 1) * maxX;

      // Check no overlap with already placed pets
      const tooClose = positions.some(([px, py]) =>
        Math.sqrt((x - px) ** 2 + (y - py) ** 2) < MIN_DIST
      );
      if (!tooClose) {
        positions.push([x, y]);
        placed = true;
      }
    }

    // Fallback: force place at target Y with offset if still not placed
    if (!placed) {
      const fallbackX = CX + (i % 2 === 0 ? 1 : -1) * (40 + i * 25);
      positions.push([Math.max(CX - RX + 30, Math.min(CX + RX - 30, fallbackX)), targetY]);
    }
  });

  return positions;
}

function Blossom({ cx, cy, size = 1, rot = 0, show, delay }) {
  const petals = [0, 72, 144, 216, 288];
  const r = 7 * size;
  const pr = 5 * size;
  return (
    <g transform={`rotate(${rot} ${cx} ${cy})`}
      opacity={show ? 1 : 0} style={{ transition: `opacity 0.5s ease ${delay}s` }}>
      {petals.map((a) => {
        const rad = (a - 90) * Math.PI / 180;
        const px = cx + Math.cos(rad) * r;
        const py = cy + Math.sin(rad) * r;
        return (
          <ellipse key={a} cx={px} cy={py} rx={pr} ry={pr * 0.62}
            fill={a % 144 === 0 ? '#f8b4bf' : '#F38797'} opacity="0.92"
            transform={`rotate(${a} ${px} ${py})`} />
        );
      })}
      <circle cx={cx} cy={cy} r={2.5 * size} fill="#fff0f3" />
      <circle cx={cx} cy={cy} r={1.5 * size} fill="#F38797" opacity="0.7" />
    </g>
  );
}

function AnimatedPath({ d, delay, stroke, strokeWidth = 4 }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const len = el.getTotalLength();
    el.style.strokeDasharray = len;
    el.style.strokeDashoffset = len;
    el.style.transition = 'none';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = `stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1) ${delay}s`;
      el.style.strokeDashoffset = '0';
    }));
  }, [d]);
  return <path ref={ref} d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round" />;
}

function PetAvatar({ pet, x, y, r = 22, delay, onClick }) {
  const isCat = String(pet?.species_type?.name || pet?.speciesType?.name || '').toLowerCase().includes('cat');
  const color = isCat ? '#FE7E4D' : '#4FC6C9';
  const [imgErr, setImgErr] = useState(false);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), (delay + 0.6) * 1000);
    return () => clearTimeout(t);
  }, [delay]);

  const initials = String(pet?.name || '?').slice(0, 2).toUpperCase();

  return (
    <g onClick={onClick}
      opacity={show ? 1 : 0}
      style={{ transition: `opacity 0.4s ease ${delay + 0.6}s`, cursor: 'pointer' }}>

      {/* Pulsing glow ring */}
      <circle cx={x} cy={y} r={r + 7} fill={color} opacity="0.2">
        <animate attributeName="r" values={`${r+5};${r+9};${r+5}`} dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.2;0.08;0.2" dur="2s" repeatCount="indefinite" />
      </circle>

      {/* Species-colored border */}
      <circle cx={x} cy={y} r={r + 3} fill="white" stroke={color} strokeWidth="2.5" />

      {/* Photo or initials */}
      {pet.photo_url && !imgErr ? (
        <>
          <defs><clipPath id={`clip-${pet.id}`}><circle cx={x} cy={y} r={r} /></clipPath></defs>
          <image href={pet.photo_url} x={x-r} y={y-r} width={r*2} height={r*2}
            clipPath={`url(#clip-${pet.id})`} preserveAspectRatio="xMidYMid slice"
            onError={() => setImgErr(true)} />
        </>
      ) : (
        <>
          <circle cx={x} cy={y} r={r} fill={color} opacity="0.2" />
          <text x={x} y={y+1} textAnchor="middle" dominantBaseline="middle"
            fontSize={r * 0.6} fontWeight="bold" fill={color} fontFamily="sans-serif">
            {initials}
          </text>
        </>
      )}

      {/* Name pill */}
      <rect x={x - 26} y={y + r + 6} width={52} height={15} rx={7.5}
        fill="white" stroke="#e5ecf0" strokeWidth="1" />
      <text x={x} y={y + r + 14} textAnchor="middle"
        fontSize="8.5" fontWeight="700" fill="#173551" fontFamily="sans-serif">
        {pet.name.length > 8 ? pet.name.slice(0, 7) + '…' : pet.name}
      </text>
    </g>
  );
}

export default function PetFamilyTree({ pets, onPetClick, onAddPet }) {
  const [show, setShow] = useState(false);
  const [petalDelays, setPetalDelays] = useState([]);
  
  useEffect(() => { 
    const t = setTimeout(() => setShow(true), 200); 
    return () => clearTimeout(t); 
  }, []);

  // Generate random petal delays on mount (so they fall unsynchronized)
  useEffect(() => {
    const delays = Array.from({ length: 80 }, () => 1.3 + Math.random() * 2);
    setPetalDelays(delays);
  }, []);

  const sortedPets = [...pets].sort((a, b) => {
    if (!a.date_of_birth && !b.date_of_birth) return String(a.name).localeCompare(String(b.name));
    if (!a.date_of_birth) return 1;
    if (!b.date_of_birth) return -1;
    const diff = new Date(a.date_of_birth) - new Date(b.date_of_birth);
    return diff !== 0 ? diff : String(a.name).localeCompare(String(b.name));
  });

  const count = sortedPets.length;

  // Dynamic avatar radius based on pet count
  const avatarR = count <= 3 ? 20 : count <= 6 ? 16 : 14;

  // Scale canopy based on pet count — compact to fit within modal
  const CX = 400;
  const CY = 250;
  const RX = Math.min(220, 150 + count * 12);
  const RY = Math.min(120, 85 + count * 7);
  const W  = 800;
  const H  = 600;

  const petPositions = scatterPetPositions(count, sortedPets, CX, CY, RX, RY, avatarR);

  // Scale blossom count with canopy size
  const blossomScale = Math.max(1, RX / 215);
  const layer1 = generateBlossoms(CX, CY,       RX,       RY,       Math.round(200 * blossomScale), 3);
  const layer2 = generateBlossoms(CX, CY - 7,   RX * 0.9, RY * 0.9, Math.round(150 * blossomScale), 17);
  const layer3 = generateBlossoms(CX, CY + 7,   RX * 0.8, RY * 0.8, Math.round(100 * blossomScale), 41);
  const layer4 = generateBlossoms(CX, CY - 13,  RX * 1.1, RY * 1.1, Math.round(80  * blossomScale), 67);

  // Fallen petals scattered on grass
  const groundPetals = [
    [80, 575, 25], [140, 580, 85], [200, 577, 145], [260, 582, 40], [320, 578, 110],
    [380, 584, 200], [440, 576, 75], [500, 581, 160], [560, 579, 35], [620, 583, 120],
    [680, 580, 180], [740, 575, 55], [100, 588, 95], [160, 586, 165], [220, 590, 50],
    [280, 585, 130], [340, 589, 20], [400, 587, 100], [460, 591, 170], [520, 586, 45],
    [580, 592, 135], [640, 588, 175], [120, 576, 65], [180, 581, 145], [240, 574, 95],
    [300, 586, 160], [360, 579, 35], [420, 593, 115], [480, 582, 185], [540, 577, 60],
    [600, 590, 140], [660, 584, 30], [130, 594, 105], [190, 583, 175], [250, 589, 55],
    [310, 576, 125], [370, 592, 70], [430, 581, 150], [490, 591, 90], [550, 585, 165],
    [610, 578, 45], [670, 592, 155], [90, 587, 35], [150, 572, 115], [210, 595, 175],
    [270, 580, 65], [330, 592, 135], [390, 574, 85], [450, 596, 160], [510, 575, 50],
    [570, 589, 140], [630, 582, 20], [690, 594, 100], [110, 584, 145], [170, 591, 75],
    [230, 578, 165], [290, 590, 40], [350, 582, 120], [410, 589, 175], [470, 577, 60],
    [530, 593, 130], [590, 586, 85], [650, 592, 155], [710, 581, 50], [75, 591, 110],
    [135, 589, 170], [195, 576, 85], [255, 595, 150], [315, 579, 45], [375, 587, 125],
    [435, 594, 95], [495, 585, 165], [555, 574, 75], [615, 591, 135], [675, 588, 25]
  ];

  return (
    <div className="w-full h-full flex items-end justify-center select-none">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMax meet" style={{ display: 'block' }}>
        <style>{`
          @keyframes petalFall {
            0% {
              opacity: 0;
              transform: translateY(-300px);
            }
            10% {
              opacity: 1;
            }
            90% {
              opacity: 1;
            }
            100% {
              opacity: 0.8;
              transform: translateY(0);
            }
          }
          .petal-fall {
            animation: petalFall 2.5s ease-in-out forwards;
            transform-origin: center;
          }
        `}</style>
        <defs>
          <radialGradient id="skyG" cx="50%" cy="65%" r="55%">
            <stop offset="0%" stopColor="#fde8ec" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#fde8ec" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Sky blush */}
        <ellipse cx={CX} cy={CY+25} rx={RX+130} ry={RY+105} fill="url(#skyG)" />

        {/* ── GREEN GROUND ── */}
        <ellipse cx={CX} cy={H - 10} rx={W/2 + 40} ry={35} fill="#3d6b34" />
        <ellipse cx={CX} cy={H - 14} rx={W/2 + 20} ry={28} fill="#4a7c3f" />
        <ellipse cx={CX} cy={H - 18} rx={W/2}      ry={22} fill="#5a9448" />
        <ellipse cx={CX} cy={H - 22} rx={W/2 - 60} ry={16} fill="#6aaa55" />
        <ellipse cx={CX} cy={H - 25} rx={W/2 - 140} ry={11} fill="#7bbf63" />
        <ellipse cx={CX} cy={H - 28} rx={W/2 - 220} ry={7}  fill="#8dd470" />

        {/* ── TRUNK ── */}
        <AnimatedPath d="M 391 570 C 389 530 387 490 388 450 C 389 420 391 400 392 378 C 393 358 395 338 396 322 C 397 310 398 302 399 294" delay={0} stroke="#4a2c08" strokeWidth={22} />
        <AnimatedPath d="M 400 570 C 400 530 400 490 400 450 C 400 420 400 400 400 378 C 400 358 400 338 400 322 C 400 310 400 302 400 294" delay={0} stroke="#6b4210" strokeWidth={16} />
        <AnimatedPath d="M 406 570 C 406 530 405 490 405 450 C 404 420 403 400 403 378 C 402 358 402 338 401 322 C 401 310 401 302 401 294" delay={0} stroke="#8c5a18" strokeWidth={8} />
        <AnimatedPath d="M 403 570 C 403 530 403 490 402 450 C 402 420 401 400 401 378 C 401 358 401 338 401 322" delay={0.05} stroke="#b87820" strokeWidth={3} />
        
        {/* ── REALISTIC ROOT SYSTEM ── */}
        <AnimatedPath d="M 390 570 C 370 573 350 575 330 577 C 310 578 280 580 260 585" delay={0.08} stroke="#4a2c08" strokeWidth={9} />
        <AnimatedPath d="M 388 573 C 360 577 330 581 305 587" delay={0.12} stroke="#3d1f03" strokeWidth={6} />
        <AnimatedPath d="M 385 575 C 355 580 320 585 290 591" delay={0.16} stroke="#3d1f03" strokeWidth={5} />
        <AnimatedPath d="M 410 570 C 430 573 450 575 470 577 C 490 578 520 580 540 585" delay={0.08} stroke="#4a2c08" strokeWidth={9} />
        <AnimatedPath d="M 412 573 C 440 577 470 581 495 587" delay={0.12} stroke="#3d1f03" strokeWidth={6} />
        <AnimatedPath d="M 415 575 C 445 580 480 585 510 591" delay={0.16} stroke="#3d1f03" strokeWidth={5} />
        <AnimatedPath d="M 350 575 C 335 580 320 587 310 595" delay={0.18} stroke="#3d1f03" strokeWidth={4} />
        <AnimatedPath d="M 375 577 C 365 585 355 593 345 600" delay={0.19} stroke="#3d1f03" strokeWidth={3} />
        <AnimatedPath d="M 450 575 C 465 580 480 587 490 595" delay={0.18} stroke="#3d1f03" strokeWidth={4} />
        <AnimatedPath d="M 425 577 C 435 585 445 593 455 600" delay={0.19} stroke="#3d1f03" strokeWidth={3} />

        {/* ── BRANCHES ── */}
        <AnimatedPath d="M 395 298 C 372 285 335 272 295 258 C 265 248 238 242 212 238" delay={0.45} stroke="#4a2c08" strokeWidth={13} />
        <AnimatedPath d="M 395 298 C 372 285 335 272 295 258 C 265 248 238 242 212 238" delay={0.50} stroke="#6b4210" strokeWidth={7} />
        <AnimatedPath d="M 405 298 C 430 283 472 270 515 255 C 548 244 575 238 602 235" delay={0.45} stroke="#4a2c08" strokeWidth={13} />
        <AnimatedPath d="M 405 298 C 430 283 472 270 515 255 C 548 244 575 238 602 235" delay={0.50} stroke="#6b4210" strokeWidth={7} />
        <AnimatedPath d="M 399 290 C 394 275 388 258 382 242 C 377 230 372 220 368 208" delay={0.48} stroke="#4a2c08" strokeWidth={10} />
        <AnimatedPath d="M 399 290 C 394 275 388 258 382 242 C 377 230 372 220 368 208" delay={0.53} stroke="#6b4210" strokeWidth={6} />
        <AnimatedPath d="M 401 290 C 408 274 415 258 420 242 C 424 230 428 220 430 208" delay={0.48} stroke="#4a2c08" strokeWidth={9} />
        <AnimatedPath d="M 401 290 C 408 274 415 258 420 242 C 424 230 428 220 430 208" delay={0.53} stroke="#6b4210" strokeWidth={5} />

        {/* Sub-branches */}
        <AnimatedPath d="M 212 238 C 204 230 196 222 188 213" delay={0.62} stroke="#6b4210" strokeWidth={7} />
        <AnimatedPath d="M 212 238 C 218 228 224 218 228 208" delay={0.64} stroke="#6b4210" strokeWidth={6} />
        <AnimatedPath d="M 295 258 C 285 246 276 234 268 222" delay={0.60} stroke="#6b4210" strokeWidth={7} />
        <AnimatedPath d="M 295 258 C 302 245 308 232 312 220" delay={0.62} stroke="#6b4210" strokeWidth={6} />
        <AnimatedPath d="M 368 208 C 360 198 352 188 346 178" delay={0.68} stroke="#6b4210" strokeWidth={6} />
        <AnimatedPath d="M 368 208 C 376 197 382 186 386 176" delay={0.70} stroke="#6b4210" strokeWidth={5} />
        <AnimatedPath d="M 430 208 C 422 197 418 186 415 176" delay={0.68} stroke="#6b4210" strokeWidth={6} />
        <AnimatedPath d="M 430 208 C 438 197 444 186 448 176" delay={0.70} stroke="#6b4210" strokeWidth={5} />
        <AnimatedPath d="M 515 255 C 508 243 502 230 498 218" delay={0.60} stroke="#6b4210" strokeWidth={7} />
        <AnimatedPath d="M 515 255 C 522 242 528 230 532 218" delay={0.62} stroke="#6b4210" strokeWidth={6} />
        <AnimatedPath d="M 602 235 C 608 225 614 214 618 204" delay={0.62} stroke="#6b4210" strokeWidth={7} />
        <AnimatedPath d="M 602 235 C 596 224 590 213 586 203" delay={0.64} stroke="#6b4210" strokeWidth={6} />

        {/* Twigs */}
        {[
          [188,213,178,200],[228,208,220,196],[268,222,258,210],[312,220,304,208],
          [346,178,338,166],[386,176,380,164],[415,176,408,164],[448,176,455,164],
          [498,218,490,206],[532,218,540,206],[618,204,624,192],[586,203,578,191],
        ].map(([x1,y1,x2,y2],i) => (
          <AnimatedPath key={i} d={`M${x1} ${y1} C${(x1+x2)/2} ${y1-6} ${x2} ${y2+4} ${x2} ${y2}`}
            delay={0.76+i*0.03} stroke="#8c5a18" strokeWidth={3} />
        ))}


        {/* ── STONES/ROCKS UNDER TREE ── */}
        {[
          {x: 330, y: 562, w: 42, h: 28, r: 15},
          {x: 470, y: 565, w: 38, h: 24, r: 14},
          {x: 370, y: 568, w: 35, h: 22, r: 12},
          {x: 420, y: 570, w: 40, h: 26, r: 14},
          {x: 300, y: 572, w: 32, h: 20, r: 11},
          {x: 500, y: 574, w: 36, h: 24, r: 12},
          {x: 355, y: 576, w: 30, h: 18, r: 10},
          {x: 445, y: 578, w: 34, h: 22, r: 11},
        ].map((stone, i) => (
          <g key={`stone${i}`} opacity={show ? 1 : 0} style={{ transition: `opacity 0.5s ease 1.2s` }}>
            <ellipse cx={stone.x} cy={stone.y} rx={stone.w/2} ry={stone.h/2}
              fill="#a0a090" stroke="#7a7a6a" strokeWidth="2" />
            <ellipse cx={stone.x-3} cy={stone.y-3} rx={stone.w/2.5} ry={stone.h/2.5}
              fill="#c8c8b8" opacity="0.7" />
          </g>
        ))}

        {/* ── FALLEN PETALS ON GROUND (rendered AFTER stones so they appear in front) ── */}
        {groundPetals.map(([x,y,rot],i) => (
          <g key={`petal${i}`}
            className="petal-fall"
            style={{
              opacity: 0,
              animationDelay: `${petalDelays[i] ?? 1.3}s`
            }}>
            <ellipse cx={x} cy={y} rx={7} ry={5}
              fill="#F38797" opacity="0.8" />
          </g>
        ))}

        {/* ── 530 BLOSSOM CANOPY ── */}
        {layer4.map((b,i) => <Blossom key={`l4${i}`} cx={b.x} cy={b.y} size={b.size*0.65} rot={b.rot} show={show} delay={0.7+(i%25)*0.025} />)}
        {layer1.map((b,i) => <Blossom key={`l1${i}`} cx={b.x} cy={b.y} size={b.size}      rot={b.rot} show={show} delay={0.8+(i%35)*0.018} />)}
        {layer2.map((b,i) => <Blossom key={`l2${i}`} cx={b.x} cy={b.y} size={b.size*1.05} rot={b.rot} show={show} delay={0.9+(i%30)*0.018} />)}
        {layer3.map((b,i) => <Blossom key={`l3${i}`} cx={b.x} cy={b.y} size={b.size*1.15} rot={b.rot} show={show} delay={1.0+(i%20)*0.02} />)}

        {/* ── PET AVATARS (scattered inside canopy) ── */}
        {sortedPets.map((pet, i) => {
          const [ax, ay] = petPositions[i] || [400, 185];
          const days = calcBirthdayDays(pet?.date_of_birth);
          return (
            <g key={pet.id}>
              {days !== null && days <= 7 && (
                <text x={ax+32} y={ay-26} fontSize="14"
                  opacity={show ? 1 : 0} style={{ transition: `opacity 0.3s ease ${0.6+i*0.15+0.8}s` }}>
                  {days === 0 ? '🎂' : '🎈'}
                </text>
              )}
              <PetAvatar pet={pet} x={ax} y={ay} r={avatarR}
                delay={0.6+i*0.15} onClick={() => onPetClick(pet)} />
            </g>
          );
        })}

        {/* Empty state */}
        {pets.length === 0 && (
          <g onClick={onAddPet} style={{ cursor: 'pointer' }}>
            <circle cx={CX} cy={CY} r={36} fill="white" stroke="#F38797"
              strokeWidth="2.5" strokeDasharray="5 4" opacity="0.95" />
            <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle" fontSize="24" fill="#F38797">+</text>
            <text x={CX} y={CY+49} textAnchor="middle" fontSize="11" fill="#7a9ab0" fontFamily="sans-serif">Add your first pet</text>
          </g>
        )}

        {/* Paw prints */}
        <text x={CX-95} y={H-5} fontSize="12" opacity="0.35">🐾</text>
        <text x={CX+60} y={H-3} fontSize="10" opacity="0.28">🐾</text>
        <text x={CX+125} y={H-7} fontSize="11" opacity="0.22">🐾</text>
      </svg>


    </div>
  );
}
