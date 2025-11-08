export enum Role {
  USER = 'user',
  MODEL = 'model',
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: string;
  userName: string;
}

export interface Task {
  id: string;
  text: string;
  isCompleted: boolean;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
  userName: string;
  reminders?: string[]; // To store reminder timestamps
}
