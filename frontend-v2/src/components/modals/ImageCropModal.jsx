import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { createPortal } from 'react-dom';

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', reject);
    img.src = url;
  });

async function getCroppedBlob(imageSrc, pixelCrop, outputType, outputQuality) {
  const image  = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width  = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y,
    pixelCrop.width, pixelCrop.height,
    0, 0,
    pixelCrop.width, pixelCrop.height,
  );
  return new Promise((resolve) => canvas.toBlob(resolve, outputType, outputQuality));
}

export default function ImageCropModal({
  imageSrc,
  onDone,
  onCancel,
  cropShape = 'round',
  title = 'Crop Photo',
  fileName = 'pet-photo.jpg',
  outputType = 'image/jpeg',
  outputQuality = 0.92,
  minZoom = 1,
}) {
  const [crop,        setCrop]        = useState({ x: 0, y: 0 });
  const [zoom,        setZoom]        = useState(minZoom);
  const [croppedArea, setCroppedArea] = useState(null);

  const onCropComplete = useCallback((_, croppedAreaPixels) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handleDone = async () => {
    if (!croppedArea) return;
    const blob = await getCroppedBlob(imageSrc, croppedArea, outputType, outputQuality);
    const file = new File([blob], fileName, { type: outputType });
    const preview = URL.createObjectURL(blob);
    onDone(file, preview);
  };

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl font-poppins border-0">
        <div className="flex items-center justify-between bg-brand-teal px-5 py-3">
          <p className="text-sm font-bold text-white">{title}</p>
          <button type="button" onClick={onCancel} className="text-white/60 hover:text-white transition-colors">
            <i className="fa-solid fa-xmark text-lg" />
          </button>
        </div>
        <div className="h-1 bg-brand-teal" />

        <div className="relative bg-black" style={{ height: 280 }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape={cropShape}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="px-5 py-3 flex items-center gap-3">
          <i className="fa-solid fa-magnifying-glass-minus text-brand-dark-soft text-xs" />
          <input
            type="range" min={minZoom} max={3} step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-brand-teal"
          />
          <i className="fa-solid fa-magnifying-glass-plus text-brand-dark-soft text-xs" />
        </div>

        <div className="flex justify-center px-5 pb-5">
          <button type="button" onClick={handleDone}
            className="w-full max-w-xs rounded-xl bg-brand-teal py-2.5 text-sm font-bold text-white hover:brightness-95 transition-colors">
            Save
          </button>
        </div>
      </div>
    </div>
  , document.body);
}
