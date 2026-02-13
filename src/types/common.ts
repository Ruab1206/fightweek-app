/**
 * Common Type Definitions
 * Shared types used throughout the application
 */

// User & Auth Types
export interface UserProfile {
  email: string;
  name: string;
  role: 'fighter' | 'coach' | 'admin';
  uid: string;
}

// Training Session Types
export interface TrainingSession {
  id?: string;
  day: string;
  name: string;
  category: string;
  start: string;
  end: string;
  location: string;
  status: 'active' | 'cancelled';
  cancellationReason?: string;
  cancellationTime?: string | null;
}

export interface StandardWeek {
  fighterId: string;
  sessions: TrainingSession[];
  lastUpdated: string;
  version: number;
}

export interface WeeklyPlan {
  fighterId: string;
  weekNumber: number;
  year: number;
  sessions: TrainingSession[];
  restDays: string[];
  status: 'draft' | 'submitted' | 'reviewing' | 'approved';
  submittedAt?: string;
  reviewedAt?: string;
  approvedAt?: string;
  lastUpdated: string;
}

// Feedback Types
export interface FeedbackItem {
  id?: string;
  userId: string;
  userName: string;
  context: string;
  text: string;
  device: string;
  status: 'new' | 'read' | 'resolved';
  timestamp: string;
}

// Admin / Backlog Types
export interface BacklogItem {
  id: string;
  title: string;
  status: 'backlog' | 'todo' | 'doing' | 'done';
  description: string;
  acceptanceCriteria?: string;
  notes?: string;
  dataFields?: string;
  release?: string;
  tag?: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  order?: number;
}

// Modal Types
export interface ModalState {
  type: 'none' | 'session' | 'feedback' | 'confirm' | 'import' | 'shortcuts';
  data?: any;
}

// UI State Types
export interface ToastState {
  message: string;
  type: 'success' | 'error';
  visible: boolean;
}
