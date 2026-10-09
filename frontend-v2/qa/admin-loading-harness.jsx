    import React from 'react';
    import ReactDOM from 'react-dom/client';
    const { useAuthStore } = await import('/src/stores/authStore.js');
    useAuthStore.setState({ user: { id: 1, role: 'admin', name: 'Test Admin' } });
    await import('/src/index.css');
    const paths = {"appointment": "/src/pages/admin/appointment/AppointmentPage.jsx", "staff": "/src/pages/admin/staff/StaffPage.jsx", "customer": "/src/pages/admin/appointment/customer/CustomerPage.jsx", "pets": "/src/pages/admin/pets/PetsPage.jsx", "service": "/src/pages/admin/service/ServicePage.jsx", "reports": "/src/pages/admin/reports/ReportsPage.jsx", "inventory": "/src/pages/admin/inventory/InventoryPage.jsx", "backup": "/src/pages/admin/settings/SettingsBackupPage.jsx"};
    const pages = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, React.lazy(() => import(/* @vite-ignore */ path))]));
    const { AdminPageFallback } = await import('/src/pages/admin/dashboard/AdminDashboardPageRegistry.jsx');
    function App() {
      const [page, setPage] = React.useState(new URLSearchParams(location.search).get('start') || 'staff');
      return React.createElement(React.Fragment, null,
        React.createElement('nav', { style: { display: 'flex', gap: 8, flexWrap: 'wrap', padding: 12 } }, Object.keys(paths).map(key => React.createElement('button', { key, 'data-testid': 'go-' + key, onClick: () => setPage(key) }, key))),
        React.createElement('main', { style: { maxWidth: 1200, margin: 'auto' } }, React.createElement(React.Suspense, { fallback: React.createElement(AdminPageFallback, { page }) }, React.createElement(pages[page], { key: page }))));
    }
    export default App;
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
