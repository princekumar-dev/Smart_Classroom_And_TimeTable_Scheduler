// Core type definitions for the timetable optimization system

export interface TimeSlot {
  day: string;
  period: number;
  startTime: string;
  endTime: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  type: 'Theory' | 'Lab' | 'Tutorial' | 'Seminar';
  credits: number;
  weeklyHours: number;
  sessionsPerWeek: number;
  sessionDuration: number; // in minutes
  preferredTimeSlots: string[];
  continuousHours: number;
  equipmentRequired: string[];
}

export interface Faculty {
  id: string;
  name: string;
  eligibleSubjects: string[];
  maxWeeklyLoad: number;
  availability: TimeSlot[];
  unavailableSlots: TimeSlot[];
  preferences: {
    preferredDays: string[];
    preferredTimeSlots: string[];
    noBackToBack: boolean;
    maxDailyHours: number;
  };
  leaveFrequency: number; // probability 0-1
  preferredRooms?: string[];
}

export interface Room {
  id: string;
  name: string;
  type: 'Classroom' | 'Lab' | 'Seminar Hall' | 'Auditorium';
  capacity: number;
  equipment: string[];
  availability: TimeSlot[];
  location: string;
}

export interface StudentBatch {
  id: string;
  name: string;
  department: string;
  year: number;
  section: string;
  size: number;
  mandatorySubjects: string[];
  assignedRoomId?: string;
  electiveGroups: ElectiveGroup[];
  maxDailyClasses: number;
  specialRequirements: string[];
}

export interface ElectiveGroup {
  id: string;
  name: string;
  subjects: string[];
  maxSelections: number;
}

export interface Institution {
  id: string;
  name: string;
  workingDays: string[];
  periodsPerDay: number;
  periodTimings: { period: number; startTime: string; endTime: string }[];
  breaks: { name: string; startTime: string; endTime: string }[];
  semesterStart: string;
  semesterEnd: string;
  holidays: string[];
}

export interface HardConstraint {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface SoftConstraint {
  id: string;
  name: string;
  description: string;
  weight: number; // 1-10
  enabled: boolean;
}

export interface TimetableEntry {
  id: string;
  subject: Subject;
  faculty: Faculty;
  room: Room;
  batch: StudentBatch;
  timeSlot: TimeSlot;
}

export interface GeneratedTimetable {
  id: string;
  name: string;
  entries: TimetableEntry[];
  conflicts: Conflict[];
  score: number;
  generatedAt: string;
  status: 'Draft' | 'Under Review' | 'Approved' | 'Published';
}

export interface Conflict {
  id: string;
  type: 'Faculty Clash' | 'Room Clash' | 'Batch Clash' | 'Constraint Violation';
  description: string;
  severity: 'High' | 'Medium' | 'Low';
  affectedEntries: string[];
  suggestions: string[];
}

export interface OptimizationSettings {
  maxIterations: number;
  timeLimit: number; // in seconds
  priorityWeights: {
    facultyLoad: number;
    roomUtilization: number;
    studentSchedule: number;
    constraints: number;
  };
}