import React, { useState, useMemo } from 'react';
import { Task } from '../types';

interface CalendarViewProps {
  tasks: Task[];
  onBack: () => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ tasks, onBack }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const taskDates = useMemo(() => 
    new Set(tasks.filter(t => t.dueDate).map(t => new Date(t.dueDate!).toDateString())),
    [tasks]
  );
  
  const tasksForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return tasks.filter(task => 
      task.dueDate && new Date(task.dueDate).toDateString() === selectedDate.toDateString()
    ).sort((a,b) => (a.dueDate && b.dueDate) ? new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime() : 0);
  }, [tasks, selectedDate]);


  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDateClick = (day: number) => {
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(clickedDate);
  };
  
  const renderCalendarGrid = () => {
    const startDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: startDay });
    const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    return (
      <div className="bg-ai-bubble p-4 rounded-lg">
        <div className="flex justify-between items-center mb-3">
          <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-user-bubble transition-colors">&lt;</button>
          <h3 className="font-semibold text-text-primary text-lg">
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h3>
          <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-user-bubble transition-colors">&gt;</button>
        </div>
        <div className="grid grid-cols-7 gap-2 text-center text-xs text-text-secondary">
          {weekDays.map(day => <div key={day} className="font-semibold">{day}</div>)}
          {blanks.map((_, i) => <div key={`blank-${i}`} />)}
          {days.map(day => {
            const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const isToday = dayDate.toDateString() === new Date().toDateString();
            const hasTask = taskDates.has(dayDate.toDateString());
            const isSelected = selectedDate && dayDate.toDateString() === selectedDate.toDateString();

            return (
              <div
                key={day}
                onClick={() => handleDateClick(day)}
                className={`w-9 h-9 flex items-center justify-center rounded-full cursor-pointer transition-all mx-auto ${
                  isSelected ? 'bg-accent-gradient text-white ring-2 ring-accent-start/50' 
                  : isToday ? 'bg-user-bubble text-text-primary' 
                  : 'hover:bg-user-bubble'
                } ${hasTask ? 'relative' : ''}`}
              >
                {day}
                {hasTask && !isSelected && <span className="absolute bottom-1 w-1.5 h-1.5 bg-accent-start rounded-full" />}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-bg-primary text-text-primary p-4 sm:p-6 lg:p-8 animate-fade-in-up">
      <div className="w-full max-w-4xl mx-auto h-full bg-bg-secondary backdrop-blur-sm rounded-2xl shadow-2xl border border-divider flex flex-col relative overflow-hidden">
        <div className="p-4 sm:p-6 bg-accent-gradient flex items-center justify-between flex-shrink-0">
          <button onClick={onBack} className="flex items-center gap-2 text-white/90 hover:text-white font-semibold transition-colors">
             &larr; Back to Chat
          </button>
          <h1 className="text-xl sm:text-2xl font-semibold text-text-primary">Calendar</h1>
        </div>
        
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 p-4 sm:p-6 overflow-y-auto custom-scrollbar">
          <div className="md:col-span-1">
            {renderCalendarGrid()}
          </div>
          <div className="md:col-span-1">
            <h2 className="text-lg font-semibold text-text-primary mb-3">
              {selectedDate 
                ? `Tasks for ${selectedDate.toLocaleDateString([], { month: 'long', day: 'numeric' })}`
                : 'Select a date to see tasks'
              }
            </h2>
            <div className="space-y-3">
              {selectedDate && tasksForSelectedDate.length > 0 ? (
                tasksForSelectedDate.map(task => (
                  <div key={task.id} className="bg-ai-bubble p-3 rounded-lg">
                    <p className={`text-text-primary ${task.isCompleted ? 'line-through' : ''}`}>- {task.text}</p>
                    <p className="text-xs text-text-secondary mt-0.5 ml-4">
                      Status: {task.isCompleted ? 'Completed' : 'Pending'}
                    </p>
                  </div>
                ))
              ) : selectedDate ? (
                <p className="text-text-secondary text-sm p-3 bg-ai-bubble rounded-lg">No reminders or tasks recorded for this date.</p>
              ) : (
                 <p className="text-text-secondary text-sm p-3 bg-ai-bubble rounded-lg">Click on a day in the calendar to view its tasks.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarView;