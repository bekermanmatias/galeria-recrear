import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface SearchableSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  label?: string;
  style?: React.CSSProperties;
}

export default function SearchableSelect({
  value, onChange, options, placeholder, label, style
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      {label && (
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#09090B', marginBottom: '8px' }}>
          {label}
        </label>
      )}
      <div 
        onClick={() => { setIsOpen(true); setSearch(''); }}
        style={{
          position: 'relative',
          width: '100%',
          padding: label ? '12px 32px 12px 16px' : '8px 32px 8px 16px',
          border: `1px solid ${isOpen ? '#1A4B77' : '#E4E4E7'}`,
          background: '#FFFFFF',
          fontSize: label ? '14px' : '13px',
          fontFamily: 'inherit',
          cursor: 'pointer',
          borderRadius: '6px',
          display: 'flex', alignItems: 'center', boxSizing: 'border-box',
          minHeight: label ? '44px' : '36px',
          color: value ? '#09090B' : '#71717A',
        }}
      >
        {isOpen ? (
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={placeholder}
            style={{ 
              border: 'none', outline: 'none', width: '100%', 
              background: 'transparent', fontSize: 'inherit', color: '#09090B', padding: 0 
            }}
          />
        ) : (
          <span style={{ width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {value === 'Todos' ? placeholder : (value || placeholder)}
          </span>
        )}
        <ChevronDown size={16} strokeWidth={1.5} style={{
          position: 'absolute', right: '12px', top: '50%',
          transform: `translateY(-50%) ${isOpen ? 'rotate(180deg)' : ''}`, 
          transition: 'transform 0.2s',
          pointerEvents: 'none', color: '#71717A',
        }} />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '6px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          maxHeight: '200px', overflowY: 'auto', zIndex: 50
        }}>
          {filteredOptions.length === 0 ? (
            <div style={{ padding: '12px 16px', fontSize: '13px', color: '#71717A' }}>No se encontraron resultados</div>
          ) : (
            filteredOptions.map(o => (
              <div
                key={o}
                onClick={() => { onChange(o); setIsOpen(false); }}
                style={{
                  padding: '10px 16px', fontSize: label ? '14px' : '13px', color: '#09090B', cursor: 'pointer',
                  background: value === o ? '#F1F5F9' : 'transparent',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                onMouseLeave={e => e.currentTarget.style.background = value === o ? '#F1F5F9' : 'transparent'}
              >
                {o === 'Todos' ? placeholder : o}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
