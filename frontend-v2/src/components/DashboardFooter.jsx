export default function DashboardFooter({ className = '' }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={`border-t border-brand-dark/10 bg-white/50 px-4 py-3 ${className}`}>
      <p className="font-poppins text-[11px] text-center text-brand-dark/60 font-medium">
        © The Fur Club {currentYear}. Made by PawsitiveCare.
      </p>
    </footer>
  );
}
