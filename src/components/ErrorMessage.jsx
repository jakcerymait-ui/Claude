export default function ErrorMessage({ message, onRetry }) {
  return (
    <div className="card border-red-800/40 bg-red-900/10 flex flex-col items-center gap-3 py-10 text-center">
      <span className="text-4xl">⚠️</span>
      <p className="text-red-400 font-medium">{message || 'Something went wrong'}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary text-sm mt-1">
          Try Again
        </button>
      )}
    </div>
  );
}
