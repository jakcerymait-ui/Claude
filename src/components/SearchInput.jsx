import { useState } from 'react';

export default function SearchInput({ placeholder, onSearch, loading }) {
  const [value, setValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim()) onSearch(value.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <input
        className="input-field flex-1"
        placeholder={placeholder || 'Search…'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" className="btn-primary" disabled={loading || !value.trim()}>
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Searching…
          </span>
        ) : (
          'Search'
        )}
      </button>
    </form>
  );
}
