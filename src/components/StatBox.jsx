export default function StatBox({ label, value, sub, accent = false }) {
  return (
    <div className="bg-[#12121a] border border-[#2e2e45] rounded-xl p-4 flex flex-col items-center text-center gap-1">
      <span className={`text-2xl font-bold ${accent ? 'text-[#e94560]' : 'text-white'}`}>
        {value ?? '—'}
      </span>
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  );
}
