import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

const Grooming = lazy(() => import('./Grooming.jsx'));
const Daycare = lazy(() => import('./Daycare.jsx'));
const HotelSuite = lazy(() => import('./HotelSuite.jsx'));

export default function ServicesRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="grooming" element={<Grooming />} />
        <Route path="daycare" element={<Daycare />} />
        <Route path="hotelsuite" element={<HotelSuite />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
