import React, { useState, useEffect, useRef } from 'react';
import MenuIcon from './MenuIcon';

type View = 'chat' | 'calendar' | 'goals';

interface OptionsMenuProps {
  onNavigate: (view: View) => void;
}

const OptionsMenu: React.FC<OptionsMenuProps> = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleNavigation = (view: View) => {
    onNavigate(view);
    setIsOpen(false);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div ref={menuRef} className="relative z-30">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-black/20 backdrop-blur-sm p-2.5 rounded-full shadow-lg hover:bg-black/30 transition-colors z-30"
        aria-label="Open options menu"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <MenuIcon className="w-6 h-6" />
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-48 bg-ai-bubble backdrop-blur-md rounded-lg shadow-2xl border border-divider py-2 animate-fade-in-up origin-top-right"
          style={{ animationDuration: '0.2s' }}
          role="menu"
          aria-orientation="vertical"
        >
          <button
            onClick={() => handleNavigation('calendar')}
            className="w-full text-left px-4 py-2 text-text-primary hover:bg-user-bubble flex items-center gap-3 transition-colors"
            role="menuitem"
          >
            <span role="img" aria-label="calendar emoji">📅</span> Calendar
          </button>
          <button
            onClick={() => handleNavigation('goals')}
            className="w-full text-left px-4 py-2 text-text-primary hover:bg-user-bubble flex items-center gap-3 transition-colors"
            role="menuitem"
          >
            <span role="img" aria-label="target emoji">🎯</span> Your Goals
          </button>
        </div>
      )}
    </div>
  );
};

export default OptionsMenu;