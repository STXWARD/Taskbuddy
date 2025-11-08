import React, { useState, useEffect } from 'react';
import { Task } from '../types';

interface NotificationToastProps {
  task: Task;
  onMarkAsDone: (taskId: string) => void;
  onSnooze: (taskId: string) => void;
  onClose: () => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ task, onMarkAsDone, onSnooze, onClose }) => {
  const [timeRemaining, setTimeRemaining] = useState('');

  useEffect(() => {
    const calculateTimeRemaining = () => {
      if (!task.dueDate) return '';
      const now = new Date();
      const dueDate = new Date(task.dueDate);
      const diff = dueDate.getTime() - now.getTime();

      if (diff <= 0) {
        onClose(); // Auto-close if overdue
        return 'Due now';
      }
      
      const minutes = Math.floor((diff / 1000) / 60);
      const seconds = Math.floor((diff / 1000) % 60);

      if (minutes > 0) {
        return `Due in ${minutes}m ${seconds}s`;
      }
      return `Due in ${seconds}s`;
    };

    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, 1000);

    // Set initial value
    setTimeRemaining(calculateTimeRemaining());

    return () => clearInterval(interval);
  }, [task.dueDate, onClose]);

  return (
    <div 
      className="fixed bottom-6 right-6 w-full max-w-sm bg-ai-bubble backdrop-blur-md rounded-2xl shadow-2xl border border-divider p-5 z-50 animate-fade-in-up"
      style={{ animationDuration: '0.4s' }}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-accent-gradient shadow-glow-blue mt-1">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-text-primary text-lg">Reminder</h3>
            <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors" aria-label="Close notification">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <p className="text-text-primary mt-1">{task.text}</p>
          <p className="text-accent-start font-medium text-sm mt-1">{timeRemaining}</p>

          {/* Actions */}
          <div className="mt-4 flex gap-3">
            <button 
              onClick={() => onMarkAsDone(task.id)}
              className="flex-1 px-4 py-2 rounded-lg bg-accent-gradient text-white hover:opacity-90 transition-opacity font-semibold text-sm"
            >
              Mark as Done
            </button>
            <button 
              onClick={() => onSnooze(task.id)}
              className="flex-1 px-4 py-2 rounded-lg bg-user-bubble hover:bg-user-bubble/80 transition-colors font-semibold text-text-primary text-sm"
            >
              Snooze (5m)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationToast;
