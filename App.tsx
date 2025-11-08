import React, { useState, useEffect, useRef, FormEvent, useCallback } from 'react';
import { GoogleGenAI, Chat, FunctionDeclaration, Type } from '@google/genai';
import { Message, Role, Task } from './types';
import { initDB, addMessage, getAllMessages, addTask, getAllTasks, updateTask, deleteTask } from './db';
import { getSuggestions } from './helper';
import ChatBubble from './components/ChatBubble';
import TypingIndicator from './components/TypingIndicator';
import PaperPlaneIcon from './components/PaperPlaneIcon';
import MicrophoneIcon from './components/MicrophoneIcon';
import OptionsMenu from './components/OptionsMenu';
import CalendarView from './views/CalendarView';
import GoalsView from './views/GoalsView';
import NotificationToast from './components/NotificationToast';

// Fix: Add type definitions for the Web Speech API to resolve TypeScript errors.
// The SpeechRecognition APIs are not included in standard TypeScript DOM typings.
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// Define the function for creating tasks
const createTaskFunctionDeclaration: FunctionDeclaration = {
  name: 'createTask',
  description: "Creates a new task, reminder, goal, or schedules a new event for the user. Use this only for brand new items. If the user asks for a reminder for an existing task, use the 'scheduleReminder' tool instead.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      text: {
        type: Type.STRING,
        description: 'A concise, natural-sounding title for the task or event, phrased as a noun or short noun phrase. For example, for "remind me to do my physics 2nd assignment", the text should be "Physics 2nd assignment".',
      },
      dueDate: {
        type: Type.STRING,
        description: "The task's due date and time in a complete RFC3339 format (e.g., '2024-07-21T19:00:00Z'). You MUST calculate the exact date and time based on the user's request and the current date context.",
      },
      priority: {
        type: Type.STRING,
        description: "The priority of the task: 'high', 'medium', or 'low'. Infer if not specified.",
      },
    },
    required: ['text'],
  },
};

const scheduleReminderFunctionDeclaration: FunctionDeclaration = {
    name: 'scheduleReminder',
    description: "Schedules a reminder for an existing task. Use this when a user asks to be reminded about a task that has already been created. Do NOT use this to create new tasks.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        taskId: {
          type: Type.STRING,
          description: "The unique ID of the task to set a reminder for. You MUST find this ID from the list of recent tasks provided in the system context.",
        },
        reminderTime: {
          type: Type.STRING,
          description: "The exact time for the reminder in RFC3339 format (e.g., '2024-07-21T18:45:00Z'). Calculate this based on the user's request (e.g., '15 minutes before', 'at 9am').",
        },
      },
      required: ['taskId', 'reminderTime'],
    },
  };

const deleteTaskFunctionDeclaration: FunctionDeclaration = {
    name: 'deleteTask',
    description: "Deletes a task, reminder, goal, or event. You must identify the correct task based on the user's request and the provided list of recent tasks, and then provide its specific 'taskId'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        taskId: {
          type: Type.STRING,
          description: "The unique ID of the task to be deleted. This ID must be sourced from the list of recent tasks provided in the system context.",
        },
      },
      required: ['taskId'],
    },
  };

type View = 'chat' | 'calendar' | 'goals';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<Chat | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState<string>('');
  const [userTimezone, setUserTimezone] = useState<string | null>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isSpeechRecognitionSupported, setIsSpeechRecognitionSupported] = useState<boolean>(false);
  const [dbReady, setDbReady] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<View>('chat');
  const [notificationTask, setNotificationTask] = useState<Task | null>(null);
  const [snoozedTasks, setSnoozedTasks] = useState<Set<string>>(new Set());
  const [triggeredReminders, setTriggeredReminders] = useState<Set<string>>(new Set());

  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  
  const formatTimestamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Helper to add a new message to state and IndexedDB for persistence.
  const addNewMessage = useCallback(async (text: string, role: Role) => {
    if (!userName) return;

    const newMessage: Message = {
      id: `${role.toString()}-${Date.now()}`,
      role,
      text,
      timestamp: formatTimestamp(),
      userName,
    };

    setMessages((prev) => [...prev, newMessage]);
    try {
      await addMessage(newMessage);
    } catch (err) {
      console.error("Failed to save message:", err);
      setError("Warning: Could not save message to history.");
    }
  }, [userName]);

  useEffect(() => {
    initDB().then(() => {
      setDbReady(true);
    }).catch(err => {
      console.error(err);
      setError("Could not load chat history or tasks. Your data will not be saved.");
    });
    
    const storedName = localStorage.getItem('taskbuddy_username');
    if (storedName) {
      setUserName(storedName);
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSpeechRecognitionSupported(true);
      const recognition: SpeechRecognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsRecording(true);
      recognition.onend = () => setIsRecording(false);
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0])
          .map((result) => result.transcript)
          .join('');
        setInput(transcript);
      };
      recognitionRef.current = recognition;
    }
  }, []);
  
  // Load chat history and tasks from IndexedDB once the user is identified and the DB is ready.
  useEffect(() => {
    if (userName && dbReady) {
      const loadData = async () => {
        try {
          const messageHistory = await getAllMessages(userName);
          if (messageHistory.length > 0) {
            setMessages(messageHistory);
          }
          const taskHistory = await getAllTasks(userName);
           if (taskHistory.length > 0) {
            setTasks(taskHistory);
          }
        } catch (err) {
          console.error(err);
          setError("Failed to load your history or tasks.");
        }
      };
      loadData();
    }
  }, [userName, dbReady]);

  useEffect(() => {
    if (!userName) return;

    const permissionStatus = localStorage.getItem('taskbuddy_location_permission');
    if (permissionStatus === 'granted' || permissionStatus === 'denied') {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setUserTimezone(tz);
    } else {
      setShowLocationPrompt(true);
    }
  }, [userName]);

  useEffect(() => {
    if (!userName || !userTimezone) return;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      
      const systemInstruction = `You are TaskBuddy, an AI assistant that helps users stay productive.

**Core Functions & Rules:**
- **Task Creation (\`createTask\`):** You MUST use this tool to create a **new** task, goal, or event. For example: "add 'buy groceries' to my list".
- **Scheduling Reminders (\`scheduleReminder\`):** You MUST use this tool when the user asks for a reminder for an **existing** task. For example: "remind me about my project report 10 minutes before it's due". Do NOT create a duplicate task. You MUST identify the correct 'taskId' from the task list provided.
- **Task Deletion (\`deleteTask\`):** You MUST use this tool to delete a task. Identify the correct 'taskId' from the provided task list.
- **Handling Lists:** If the user provides a list of new tasks, you MUST make a separate, parallel 'createTask' function call for EACH item.
- **Task Summarization:** When asked for a summary of tasks, you MUST provide a clear, structured list **as a direct text response**.
  - Clearly separate the list into "Pending" and "Completed" sections.
  - Use the full task list from the system note to get this information.
  - Do NOT use any tools for summarization.

**General Behavior:**
- Be proactive. Do not ask for confirmation unless a request is highly ambiguous.
- All date/time calculations must use the user's timezone: ${userTimezone}.
- When creating a task with a due date that also implies a reminder (e.g., "remind me to..."), you should create the task using \`createTask\` and also schedule an initial reminder using \`scheduleReminder\` in the same response.`;

      const newChat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          // Fix: Wrap the system instruction string in a Content object ({ parts: [{ text: ... }] }).
          // This provides a more robust structure for the API, especially for complex instructions with tools, and resolves underlying parsing errors.
          systemInstruction: { parts: [{ text: systemInstruction }] },
          tools: [{ functionDeclarations: [createTaskFunctionDeclaration, scheduleReminderFunctionDeclaration, deleteTaskFunctionDeclaration] }],
        },
      });
      setChat(newChat);
    } catch (e) {
        console.error("Error initializing Gemini:", e);
        setError("Failed to initialize the AI. Please check your API key and refresh the page.");
    }
  }, [userName, userTimezone]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Check for task reminders periodically
  useEffect(() => {
    const checkReminders = () => {
      if (notificationTask) return; // Don't show a new notification if one is already active

      const now = new Date().getTime();
      const CHECK_WINDOW_MS = 30 * 1000; // Interval duration

      let taskToNotify: Task | null = null;

      for (const task of tasks) {
        if (task.isCompleted || snoozedTasks.has(task.id) || !task.reminders) {
          continue;
        }

        for (const reminderTimestamp of task.reminders) {
          const reminderTime = new Date(reminderTimestamp).getTime();
          const reminderId = `${task.id}-${reminderTimestamp}`;

          // Check if reminder is due now and has not been triggered yet
          if (reminderTime <= now && reminderTime > now - CHECK_WINDOW_MS && !triggeredReminders.has(reminderId)) {
            taskToNotify = task;
            setTriggeredReminders(prev => new Set(prev).add(reminderId));
            break;
          }
        }
        if (taskToNotify) break;
      }

      if (taskToNotify) {
        setNotificationTask(taskToNotify);
      }
    };

    const intervalId = setInterval(checkReminders, 30 * 1000); // Check every 30 seconds
    return () => clearInterval(intervalId);
  }, [tasks, snoozedTasks, notificationTask, triggeredReminders]);

  const handleDenyLocation = () => {
    const fallbackTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setUserTimezone(fallbackTz);
    localStorage.setItem('taskbuddy_location_permission', 'denied');
    setShowLocationPrompt(false);
  };

  const handleAllowLocation = () => {
    if (!navigator.geolocation) {
        setError("Geolocation is not supported by your browser.");
        handleDenyLocation();
        return;
    }

    navigator.geolocation.getCurrentPosition(
        () => { // Success
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            setUserTimezone(tz);
            localStorage.setItem('taskbuddy_location_permission', 'granted');
            setShowLocationPrompt(false);
        },
        (error) => { // User denied or other error
            console.warn(`Geolocation error: ${error.message}`);
            handleDenyLocation();
        }
    );
  };

  const handleCreateTask = async (args: { text: string; dueDate?: string; priority?: 'high' | 'medium' | 'low' }) => {
    if (!userName) return;
    
    const newTask: Task = {
      id: `task-${Date.now()}`,
      text: args.text,
      isCompleted: false,
      dueDate: args.dueDate,
      priority: args.priority || 'medium',
      userName: userName,
      reminders: [],
    };

    setTasks(prev => [...prev, newTask]);
    await addTask(newTask);
  };

  const handleScheduleReminder = async (args: { taskId: string, reminderTime: string }) => {
    const { taskId, reminderTime } = args;
    const taskToUpdate = tasks.find(t => t.id === taskId);

    if (taskToUpdate) {
      const updatedReminders = [...(taskToUpdate.reminders || []), reminderTime];
      const updatedTask = { ...taskToUpdate, reminders: updatedReminders };
      
      setTasks(prevTasks => prevTasks.map(t => t.id === taskId ? updatedTask : t));
      await updateTask(updatedTask);
      return taskToUpdate.text;
    }
    return null;
  };

  const handleDeleteTask = async (args: { taskId: string }) => {
    if (!userName) return null;
    
    const taskToDelete = tasks.find(t => t.id === args.taskId);
    if (!taskToDelete) {
        console.warn(`Task with ID ${args.taskId} not found for deletion.`);
        return null;
    }
    
    setTasks(prev => prev.filter(task => task.id !== args.taskId));
    await deleteTask(args.taskId);

    return taskToDelete.text;
  };

  const handleToggleTask = async (taskId: string) => {
    let updatedTask: Task | undefined;
    setTasks(prevTasks =>
      prevTasks.map(task => {
        if (task.id === taskId) {
          updatedTask = { ...task, isCompleted: !task.isCompleted };
          return updatedTask;
        }
        return task;
      })
    );
  
    if (updatedTask) {
      await updateTask(updatedTask);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !chat) return;
    if (isRecording) {
      recognitionRef.current?.stop();
    }

    const userMessageText = input;
    setInput('');
    await addNewMessage(userMessageText, Role.USER);
    
    setIsLoading(true);
    setError(null);

    try {
      let taskContext = '';
      if (tasks.length > 0) {
          taskContext = `\n\n(System note: Here is the user's full task list, including status. Use this to answer questions about tasks, summarize progress, or find the correct 'taskId' for other tools.)\n${tasks.map(t => `- Task ID: ${t.id}, Text: "${t.text}", Status: ${t.isCompleted ? 'Completed' : 'Pending'}${t.dueDate ? `, Due: "${t.dueDate}"` : ''}`).join('\n')}\n)`;
      } else {
          taskContext = `\n\n(System note: The user currently has no tasks.)`;
      }

      const augmentedMessage = `(System note: Current time is ${new Date().toISOString()}. Use this for all time calculations.)${taskContext}\n\n${userMessageText}`;
      const stream = await chat.sendMessageStream({ message: augmentedMessage });
      
      let aiResponseText = '';
      let functionCalls: any[] | undefined;
      
      for await (const chunk of stream) {
        aiResponseText += chunk.text || '';
        if (chunk.functionCalls) {
          functionCalls = chunk.functionCalls;
        }
      }
      
      const createdTasks: any[] = [];
      const scheduledReminders: string[] = [];
      let taskDeletedMessage = '';

      if (functionCalls) {
        for (const func of functionCalls) {
          if (func.name === 'createTask' && func.args) {
            await handleCreateTask(func.args);
            createdTasks.push(func.args);
          }
           if (func.name === 'scheduleReminder' && func.args) {
            const remindedTaskText = await handleScheduleReminder(func.args);
            if (remindedTaskText) scheduledReminders.push(remindedTaskText);
          }
          if (func.name === 'deleteTask' && func.args) {
            const deletedTaskText = await handleDeleteTask(func.args);
            if (deletedTaskText) {
                taskDeletedMessage = `Alright, I've removed the task: "${deletedTaskText}".`;
            } else {
                taskDeletedMessage = `Sorry, I couldn't find that task.`;
            }
          }
        }
      }

      let finalConfirmationMessage = '';
      if (createdTasks.length > 1) {
        finalConfirmationMessage = `Got it. I've added all ${createdTasks.length} tasks to your list.`;
      } else if (createdTasks.length === 1) {
        finalConfirmationMessage = `OK, I've added "${createdTasks[0].text}" to your list.`;
      }

      if (scheduledReminders.length > 0) {
        const reminderConf = `I'll remind you about: "${scheduledReminders.join('", "')}".`;
        finalConfirmationMessage = finalConfirmationMessage ? `${finalConfirmationMessage} ${reminderConf}` : `OK. ${reminderConf}`;
      }
      
      if (taskDeletedMessage) {
        finalConfirmationMessage = taskDeletedMessage;
      }

      const responseText = aiResponseText.trim();
      if (responseText) {
        await addNewMessage(responseText, Role.MODEL);
      } else if (finalConfirmationMessage) {
        await addNewMessage(finalConfirmationMessage, Role.MODEL);
      }

    } catch (e) {
      console.error("Error sending message:", e);
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(`Sorry, something went wrong: ${errorMessage}`);
      addNewMessage(`Sorry, something went wrong: ${errorMessage}`, Role.MODEL);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNameSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (nameInput.trim()) {
      const trimmedName = nameInput.trim();
      localStorage.setItem('taskbuddy_username', trimmedName);
      setUserName(trimmedName);
    }
  };

  const handleToggleRecording = () => {
    if (!recognitionRef.current) return;

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const handleNotificationMarkAsDone = (taskId: string) => {
    handleToggleTask(taskId);
    setNotificationTask(null);
  };

  const handleNotificationSnooze = (taskId: string) => {
    const SNOOZE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

    setSnoozedTasks(prev => new Set(prev).add(taskId));
    setNotificationTask(null);

    setTimeout(() => {
      setSnoozedTasks(prev => {
        const newSnoozed = new Set(prev);
        newSnoozed.delete(taskId);
        return newSnoozed;
      });
    }, SNOOZE_DURATION_MS);
  };

  if (!userName) {
    return (
      <div className="flex flex-col h-screen bg-bg-primary text-text-primary items-center justify-center p-4">
        <div className="w-full max-w-sm bg-bg-secondary rounded-2xl shadow-2xl border border-divider p-8 animate-fade-in-up">
          <h1 className="text-2xl font-semibold text-center mb-6 text-text-primary">Welcome to Taskbuddy</h1>
          <form onSubmit={handleNameSubmit}>
            <label htmlFor="name-input" className="block text-text-secondary mb-2">What should I call you?</label>
            <input
              id="name-input"
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Enter your name..."
              autoFocus
              className="w-full bg-user-bubble text-text-primary placeholder-text-secondary px-4 py-3 rounded-xl border-2 border-transparent focus:outline-none focus:border-accent-start focus:ring-2 focus:ring-accent-start/50 transition-all duration-300 shadow-inner"
            />
            <button
              type="submit"
              disabled={!nameInput.trim()}
              className="w-full mt-6 bg-accent-gradient text-white p-3 rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-300 focus:outline-none focus:ring-2 focus:ring-accent-start focus:ring-offset-2 focus:ring-offset-bg-secondary font-semibold"
            >
              Let's Chat
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (currentView === 'calendar') {
    return <CalendarView tasks={tasks} onBack={() => setCurrentView('chat')} />;
  }

  if (currentView === 'goals') {
    return <GoalsView tasks={tasks} onToggleTask={handleToggleTask} onBack={() => setCurrentView('chat')} />;
  }

  return (
    <div className="h-screen bg-bg-primary text-text-primary">
      <div className="flex flex-col h-full p-4 sm:p-6 lg:p-8">
        {/* Chat Panel */}
        <div className="flex flex-col w-full max-w-4xl mx-auto h-full bg-bg-secondary rounded-2xl shadow-2xl border border-divider flex flex-col relative overflow-hidden">
          {/* Header */}
          <header className="p-4 sm:p-6 border-b border-divider flex items-center justify-between flex-shrink-0 bg-accent-gradient">
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-text-primary">Taskbuddy</h1>
            </div>
            <div className="flex items-center gap-3">
              <OptionsMenu onNavigate={setCurrentView} />
            </div>
          </header>

          {/* Chat Messages */}
          <div className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto custom-scrollbar">
            {messages.length === 0 && !isLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in-up">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-accent-gradient mb-4">
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-semibold text-text-primary">Hey, {userName}!</h2>
                  <p className="text-text-secondary mt-1">How can I assist you today?</p>
              </div>
            ) : (
              messages.map((msg) => (
                <ChatBubble key={msg.id} message={msg} />
              ))
            )}
            {isLoading && <TypingIndicator />}
            <div ref={chatEndRef}></div>
          </div>

          {/* Chat Input */}
          <div className="p-4 sm:p-6 border-t border-divider flex-shrink-0 relative">
            {error && <p className="text-red-400 text-sm text-center mb-2">{error}</p>}
            <form onSubmit={handleSubmit} >
              <div className="flex items-center gap-2 bg-user-bubble/50 rounded-full shadow-inner pr-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isRecording ? "Listening..." : "Tell Taskbuddy what to do..."}
                  className="flex-1 bg-transparent text-text-primary placeholder-text-secondary px-5 py-3 focus:outline-none"
                  disabled={isLoading}
                />
                {isSpeechRecognitionSupported && (
                  <button
                    type="button"
                    onClick={handleToggleRecording}
                    className={`p-2 rounded-full transition-colors duration-200 focus:outline-none ${isRecording ? 'bg-red-600 text-white animate-pulse' : 'text-text-secondary hover:bg-ai-bubble hover:text-text-primary'}`}
                    aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                  >
                    <MicrophoneIcon className="w-6 h-6" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="p-3 rounded-full bg-accent-gradient text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-300 focus:outline-none"
                  aria-label="Send message"
                >
                  <PaperPlaneIcon className="w-6 h-6" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Location Permission Prompt */}
      {showLocationPrompt && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in-up" style={{ animationDuration: '0.3s' }}>
            <div className="bg-ai-bubble p-8 rounded-2xl shadow-2xl max-w-sm text-center border border-divider">
                <h3 className="text-xl font-semibold mb-4 text-text-primary">Help Me Be More Accurate</h3>
                <p className="text-text-secondary mb-6">Please allow location access so I can provide accurate time-based reminders for your timezone.</p>
                <div className="flex justify-center gap-4">
                    <button onClick={handleDenyLocation} className="px-6 py-2 rounded-lg bg-user-bubble hover:bg-user-bubble/80 transition-colors font-semibold">Maybe Later</button>
                    <button onClick={handleAllowLocation} className="px-6 py-2 rounded-lg bg-accent-gradient hover:opacity-90 transition-opacity font-semibold text-white">Allow</button>
                </div>
            </div>
        </div>
      )}

      {/* Notification Toast */}
      {notificationTask && (
        <NotificationToast 
          task={notificationTask}
          onMarkAsDone={handleNotificationMarkAsDone}
          onSnooze={handleNotificationSnooze}
          onClose={() => setNotificationTask(null)}
        />
      )}
    </div>
  );
};

export default App;