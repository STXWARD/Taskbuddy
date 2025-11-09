import React, { useState, useMemo, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Task } from '../types';
import TaskItem from '../components/TaskItem';

interface GoalsViewProps {
  tasks: Task[];
  onToggleTask: (taskId: string) => void;
  onBack: () => void;
}

// Interfaces for the new structured AI summary
interface SummaryTask {
  task: string;
  priority: 'High' | 'Medium' | 'Low';
  deadline: string;
  status?: 'Pending' | 'Completed';
}

interface AITaskSummary {
  summary_message: string;
  today_tasks: SummaryTask[];
  tomorrow_tasks: SummaryTask[];
  upcoming_tasks: SummaryTask[];
  completed_tasks: SummaryTask[];
}

const GoalsView: React.FC<GoalsViewProps> = ({ tasks, onToggleTask, onBack }) => {
  const [tasksSummary, setTasksSummary] = useState<AITaskSummary | null>(null);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { pendingTasks, completedTasks } = useMemo(() => {
    const priorityOrder = { high: 1, medium: 2, low: 3 };
    const pending = tasks
      .filter(task => !task.isCompleted)
      .sort((a, b) => {
        // First, sort by priority
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        
        // If priorities are the same, sort by due date (earliest first).
        // Tasks without a due date are considered 'later' than tasks with one.
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        
        return dateA - dateB;
      });
    const completed = tasks.filter(task => task.isCompleted);
    return { pendingTasks: pending, completedTasks: completed };
  }, [tasks]);

  const stringifiedTasks = useMemo(() => JSON.stringify(tasks), [tasks]);

  // Helper component to render a single task from the AI summary
  const SummaryTaskItem: React.FC<{ task: SummaryTask }> = ({ task }) => {
    const priorityClasses = {
      High: 'bg-red-500/20 text-red-300',
      Medium: 'bg-yellow-500/20 text-yellow-300',
      Low: 'bg-blue-500/20 text-blue-300',
    };
    const priority = task.priority || 'Medium';
    const deadlineTime = task.deadline ? new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  
    return (
      <div className="flex items-center justify-between text-sm p-2 rounded-md hover:bg-user-bubble/50 transition-colors">
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${priority === 'High' ? 'bg-red-400' : priority === 'Medium' ? 'bg-yellow-400' : 'bg-blue-400'}`}></span>
          <span className="text-text-primary">{task.task}</span>
        </div>
        <div className="flex items-center gap-3">
          {deadlineTime && <span className="text-text-secondary">{deadlineTime}</span>}
          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${priorityClasses[priority]}`}>{priority}</span>
        </div>
      </div>
    );
  };
  
  // Helper component to render a category of tasks from the AI summary
  const TaskCategory: React.FC<{ title: string, tasks: SummaryTask[] }> = ({ title, tasks }) => {
    if (tasks.length === 0) return null;
    return (
      <div className="mt-4">
        <h4 className="font-semibold text-text-primary mb-2">{title}</h4>
        <div className="space-y-1 bg-user-bubble/30 p-2 rounded-lg">
          {tasks.map((task, index) => <SummaryTaskItem key={index} task={task} />)}
        </div>
      </div>
    );
  };
  
  // Automatically summarize tasks when the view loads or tasks change
  useEffect(() => {
    const summarizeTasks = async () => {
      if (tasks.length === 0) {
        setIsSummarizing(false);
        setTasksSummary(null);
        return;
      }

      setIsSummarizing(true);
      setTasksSummary(null);
      setError(null);

      const tasksDataForAI = tasks.map(task => ({
        name: task.text,
        deadline: task.dueDate,
        status: task.isCompleted ? 'Completed' : 'Pending',
        priority: task.priority,
        type: task.type,
      }));

      const today = new Date();
      const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD

      const systemPrompt = `You are TaskBuddy, an intelligent task assistant. Your goal is to generate a daily AI Task Summary in a structured JSON format. The current date is ${todayString}.

**Instructions:**
1.  Analyze the user's task list provided below.
2.  Categorize all tasks based on their 'dueDate' relative to today's date (${todayString}):
    - 'today_tasks': Tasks due today.
    - 'tomorrow_tasks': Tasks due tomorrow.
    - 'upcoming_tasks': Tasks due after tomorrow.
    - 'completed_tasks': All tasks where 'status' is 'Completed', regardless of date.
3.  Within 'today_tasks', 'tomorrow_tasks', and 'upcoming_tasks', sort the tasks first by 'priority' (High, then Medium, then Low), and then by their 'deadline' time (earliest first).
4.  Generate a concise, friendly 'summary_message' for the user about their tasks for today. Mention the total number of tasks, how many are pending vs. completed, and encourage them to focus on high-priority items.
5.  Return the entire output strictly in the specified JSON schema. Ensure all fields are present. If a category has no tasks, return an empty array for it.

Here is the user's task list in JSON format:
${JSON.stringify(tasksDataForAI, null, 2)}`;
      
      const summaryTaskSchema = {
          type: Type.OBJECT,
          properties: {
              task: { type: Type.STRING, description: "The name of the task." },
              priority: { type: Type.STRING, description: "Priority of the task (High, Medium, or Low)." },
              deadline: { type: Type.STRING, description: "The deadline in RFC3339 format." },
              status: { type: Type.STRING, description: "The status of the task ('Pending' or 'Completed')." }
          },
          required: ['task', 'priority', 'deadline']
      };
      
      const schema = {
          type: Type.OBJECT,
          properties: {
              summary_message: {
                  type: Type.STRING,
                  description: "A short, friendly summary of today's tasks."
              },
              today_tasks: {
                  type: Type.ARRAY,
                  description: "A list of tasks due today, sorted by priority and time.",
                  items: summaryTaskSchema
              },
              tomorrow_tasks: {
                  type: Type.ARRAY,
                  description: "A list of tasks due tomorrow, sorted by priority and time.",
                  items: summaryTaskSchema
              },
              upcoming_tasks: {
                  type: Type.ARRAY,
                  description: "A list of tasks due after tomorrow, sorted by priority and time.",
                  items: summaryTaskSchema
              },
              completed_tasks: {
                  type: Type.ARRAY,
                  description: "A list of all completed tasks.",
                  items: summaryTaskSchema
              }
          },
          required: ['summary_message', 'today_tasks', 'tomorrow_tasks', 'upcoming_tasks', 'completed_tasks']
      };

      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: systemPrompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: schema,
          },
        });

        setTasksSummary(JSON.parse(response.text));
      } catch (e) {
        console.error("Error summarizing tasks:", e);
        const rawErrorMessage = e instanceof Error ? e.message : String(e);
        if (rawErrorMessage.includes('429') || rawErrorMessage.includes('RESOURCE_EXHAUSTED')) {
          setError("Couldn't generate summary: API request limit reached.");
        } else {
          setError("Sorry, I couldn't create a task summary right now. Please try again later.");
        }
      } finally {
        setIsSummarizing(false);
      }
    };

    summarizeTasks();
  }, [stringifiedTasks, tasks]);

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
        </div>

        <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-8">
          {/* AI Task Summary Section */}
          <div className="bg-ai-bubble p-4 rounded-lg border border-divider">
            <h2 className="text-lg font-semibold text-text-primary">✨ AI Task Summary</h2>
            <p className="text-text-secondary text-sm mt-1">Here's an intelligent overview of your progress.</p>
            
            <div className="mt-4 pt-4 border-t border-divider min-h-[100px] flex flex-col justify-center">
              {isSummarizing && (
                <div className="text-center text-text-secondary p-6 rounded-lg">
                    <p>Generating your task summary...</p>
                </div>
              )}
              {error && <p className="text-red-400 text-sm text-center">{error}</p>}
              
              {!isSummarizing && !error && tasksSummary && (
                 <div>
                    <p className="text-text-primary bg-user-bubble/30 p-3 rounded-lg italic">"{tasksSummary.summary_message}"</p>
                    <TaskCategory title="Today's Focus" tasks={tasksSummary.today_tasks} />
                    <TaskCategory title="Tomorrow" tasks={tasksSummary.tomorrow_tasks} />
                    <TaskCategory title="Upcoming" tasks={tasksSummary.upcoming_tasks} />
                    <TaskCategory title="Completed Recently" tasks={tasksSummary.completed_tasks} />
                 </div>
              )}

              {!isSummarizing && tasks.length === 0 && (
                <div className="text-center text-text-secondary p-6 rounded-lg">
                   <p>No tasks found. Add some in the chat to see a summary!</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Task Lists */}
          <div>
            <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
              🕒 All Pending Tasks <span className="text-sm bg-user-bubble px-2 py-0.5 rounded-full">{pendingTasks.length}</span>
            </h2>
            <div className="space-y-3">
              {pendingTasks.length > 0 ? (
                pendingTasks.map(task => <TaskItem key={task.id} task={task} onToggle={onToggleTask} />)
              ) : (
                <div className="text-center text-text-secondary p-6 bg-ai-bubble rounded-lg">
                  <p className="text-2xl mb-2">🎉</p>
                  <p className="font-semibold">All tasks completed — great job!</p>
                  <p className="text-sm mt-1">Add a new goal through the chat.</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
              ✅ Completed Tasks <span className="text-sm bg-user-bubble px-2 py-0.5 rounded-full">{completedTasks.length}</span>
            </h2>
            <div className="space-y-3">
              {completedTasks.length > 0 ? (
                completedTasks.map(task => <TaskItem key={task.id} task={task} onToggle={onToggleTask} />)
              ) : (
                <p className="text-text-secondary text-sm p-3 bg-ai-bubble rounded-lg">No completed tasks yet. Keep going!</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoalsView;