const variants = {
  win: 'bg-green-900/40 text-green-400 border-green-800/40',
  loss: 'bg-red-900/40 text-red-400 border-red-800/40',
  draw: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/40',
  default: 'bg-[#2a2a3e] text-gray-300 border-[#2e2e45]',
  accent: 'bg-[#e94560]/20 text-[#e94560] border-[#e94560]/30',
};

export default function Badge({ children, variant = 'default' }) {
  return (
    <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border ${variants[variant] || variants.default}`}>
      {children}
    </span>
  );
}
