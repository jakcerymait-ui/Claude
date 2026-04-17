import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Player Search' },
  { to: '/compare', label: 'Compare' },
  { to: '/team', label: 'Team Stats' },
  { to: '/h2h', label: 'Head-to-Head' },
  { to: '/resonance', label: 'Resonance Suppressor' },
];

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-[#12121a]/90 backdrop-blur border-b border-[#2e2e45]">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-6 h-16">
        <span className="text-[#e94560] font-extrabold text-xl tracking-tight mr-4">
          ⚽ FootStats
        </span>
        <div className="flex gap-1 overflow-x-auto">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[#e94560] text-white'
                    : 'text-gray-400 hover:text-white hover:bg-[#2a2a3e]'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
