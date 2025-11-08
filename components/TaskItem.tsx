import React from 'react';
import { Task } from '../types';

interface TaskItemProps {
    task: Task;
    onToggle: (id: string) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, onToggle }) => {
  const priorityColor = {
    high: 'border-l-accent-end',
    medium: 'border-l-accent-start',
    low: 'border-l-gray-500',
  };

  return (
    <div className={`
      flex items-center bg-ai-bubble p-3 rounded-lg border-l-4 ${priorityColor[task.priority]}
      transition-all duration-300 ${task.isCompleted ? 'opacity-50' : 'opacity-100'}
      cursor-pointer shadow-sm hover:bg-user-bubble
    `}
    onClick={() => onToggle(task.id)}
    >
      <input
        type="checkbox"
        readOnly
        checked={task.isCompleted}
        className="w-5 h-5 rounded bg-user-bubble border-divider text-accent-start focus:ring-accent-start cursor-pointer flex-shrink-0"
      />
      <div className="ml-3 flex-1">
        <p className={`text-text-primary ${task.isCompleted ? 'line-through' : ''}`}>{task.text}</p>
        {task.dueDate && (
          <p className="text-xs text-text-secondary mt-0.5">
            Due: {new Date(task.dueDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        )}
      </div>
    </div>
  );
};

export default TaskItem;