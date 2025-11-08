import React, { useState, useMemo } from 'react';
import { Task } from '../types';
import TaskItem from '../components/TaskItem';

interface GoalsViewProps {
  tasks: Task[];
  onToggleTask: (taskId: string) => void;
  onBack: () => void;
}

type SortOption = 'priority' | 'dueDate' | 'latest';

const GoalsView: React.FC<GoalsViewProps> = ({ tasks, onToggleTask, onBack }) => {
  const [sortOption, setSortOption] = useState<SortOption>('dueDate');

  const { pendingTasks, completedTasks } = useMemo(() => {
    const priorityOrder = { high: 1, medium: 2, low: 3 };
    const idToTimestamp = (id: string) => parseInt(id.split('-')[1] || '0');

    const sortFunction = (a: Task, b: Task) => {
      switch (sortOption) {
        case 'priority':
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        case 'dueDate':
          if (a.dueDate && b.dueDate) {
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          }
          if (a.dueDate) return -1; // Tasks with due dates come first
          if (b.dueDate) return 1;
          return 0; // Keep original order if no due dates
        case 'latest':
          return idToTimestamp(b.id) - idToTimestamp(a.id); // Newest first
        default:
          return 0;
      }
    };

    const pending = tasks.filter(task => !task.isCompleted).sort(sortFunction);
    const completed = tasks.filter(task => task.isCompleted).sort(sortFunction);

    return { pendingTasks: pending, completedTasks: completed };
  }, [tasks, sortOption]);

  return (
    <div className="h-screen bg-bg-primary text-text-primary p-4 sm:p-6 lg:p-8 animate-fade-in-up">
      <div className="w-full max-w-4xl mx-auto h-full bg-bg-secondary backdrop-blur-sm rounded-2xl shadow-2xl border border-divider flex flex-col relative overflow-hidden">
        <div className="p-4 sm:p-6 bg-accent-gradient flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="flex items-center gap-2 text-white/90 hover:text-white font-semibold transition-colors">
              &larr; Back to Chat
            </button>
            <h1 className="text-xl sm:text-2xl font-semibold text-text-primary">Your Goals</h1>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="sort-goals" className="text-sm text-white/90">Sort by:</label>
            <select
              id="sort-goals"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="bg-black/25 text-white rounded-md px-2 py-1 border border-white/20 focus:ring-2 focus:ring-accent-start focus:outline-none text-sm transition-colors"
            >
              <option className="bg-user-bubble" value="dueDate">Due Date</option>
              <option className="bg-user-bubble" value="priority">Priority</option>
              <option className="bg-user-bubble" value="latest">Latest Added</option>
            </select>
          </div>
        </div>

        <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-8">
          <div>
            <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
              🕒 Tasks Still Pending <span className="text-sm bg-user-bubble px-2 py-0.5 rounded-full">{pendingTasks.length}</span>
            </h2>
            <div className="space-y-3">
              {pendingTasks.length > 0 ? (
                pendingTasks.map(task => <TaskItem key={task.id} task={task} onToggle={onToggleTask} />)
              ) : (
                <div className="text-center text-text-secondary p-6 bg-ai-bubble rounded-lg">
                  <p className="text-2xl mb-2">🎉</p>
                  <p className="font-semibold">All tasks completed — great job!</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
              ✅ Completed Goals / Tasks <span className="text-sm bg-user-bubble px-2 py-0.5 rounded-full">{completedTasks.length}</span>
            </h2>
            <div className="space-y-3">
              {completedTasks.length > 0 ? (
                completedTasks.map(task => <TaskItem key={task.id} task={task} onToggle={onToggleTask} />)
              ) : (
                <p className="text-text-secondary text-sm p-3 bg-ai-bubble rounded-lg">No completed goals yet. Keep going!</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoalsView;