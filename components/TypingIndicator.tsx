import React from 'react';

const TypingIndicator: React.FC = () => {
  return (
    <div className="flex items-center space-x-3 animate-fade-in-up">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent-gradient flex-shrink-0 text-white font-semibold text-sm">
        AI
      </div>
      <div className="bg-ai-bubble p-3 px-4 rounded-2xl shadow-glow-blue">
        <div className="flex items-center space-x-1">
            <span className="text-text-secondary text-base">Taskbuddy is thinking</span>
            <div className="w-2 h-2 bg-accent-start rounded-full animate-dot-pulse [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-accent-start rounded-full animate-dot-pulse [animation-delay:-0.1s]"></div>
            <div className="w-2 h-2 bg-accent-start rounded-full animate-dot-pulse"></div>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;