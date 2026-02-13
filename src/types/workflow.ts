/**
 * Weekly Planning Workflow Types
 * Defines the state machine for the weekly planning approval process
 * 
 * Feature: "Flow for ugeplan" - submission/review/approval workflow
 * Status: Planned for Phase 2
 */

export enum WeeklyPlanStatus {
  DRAFT = 'draft',           // Fighter is editing their week
  SUBMITTED = 'submitted',   // Fighter submitted, waiting for coach review
  REVIEWING = 'reviewing',   // Coach is reviewing
  APPROVED = 'approved',     // Coach approved, ready for training
  REJECTED = 'rejected',     // Coach rejected, fighter needs to resubmit
}

export interface WeeklyPlanWorkflow {
  fighterId: string;
  weekNumber: number;
  status: WeeklyPlanStatus;
  
  // Submission tracking
  submittedAt?: string;
  submittedBy?: string;
  submittedNote?: string;
  
  // Review tracking
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
  
  // Approval tracking
  approvedAt?: string;
  approvedBy?: string;
  
  // Rejection tracking (if applicable)
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  
  // Auto-approval after deadline
  autoApprovedAt?: string;
}

/**
 * Workflow Rules (for reference):
 * 
 * Monday: Next week becomes available for editing (status: DRAFT)
 * Fighter edits week, must submit by Saturday 18:00
 * 
 * Coach reviews submitted plans until Sunday 18:00
 * If neither approved nor rejected by Sunday 18:00 → auto-approved
 * 
 * If rejected: Fighter must resubmit by next day 18:00
 * 
 * Once approved: Fighter can only cancel sessions (not add new ones)
 * Cancellations must have reason and timestamp
 */
