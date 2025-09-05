import {
  Subject,
  Faculty,
  Room,
  StudentBatch,
  Institution,
  TimetableEntry,
  GeneratedTimetable,
  Conflict,
  TimeSlot,
  HardConstraint,
  SoftConstraint,
  OptimizationSettings
} from '../types/timetable';

export class TimetableEngine {
  private institution: Institution;
  private subjects: Subject[] = [];
  private faculty: Faculty[] = [];
  private rooms: Room[] = [];
  private batches: StudentBatch[] = [];
  private hardConstraints: HardConstraint[] = [];
  private softConstraints: SoftConstraint[] = [];

  constructor(institution: Institution) {
    this.institution = institution;
    this.initializeDefaultConstraints();
  }

  private initializeDefaultConstraints() {
    this.hardConstraints = [
      {
        id: 'no-faculty-clash',
        name: 'No Faculty Double Booking',
        description: 'Faculty cannot be assigned to multiple classes at the same time',
        enabled: true
      },
      {
        id: 'no-room-clash',
        name: 'No Room Double Booking',
        description: 'Room cannot be assigned to multiple classes at the same time',
        enabled: true
      },
      {
        id: 'no-batch-clash',
        name: 'No Batch Double Booking',
        description: 'Student batch cannot have multiple classes at the same time',
        enabled: true
      },
      {
        id: 'room-capacity',
        name: 'Room Capacity Check',
        description: 'Room capacity must be sufficient for batch size',
        enabled: true
      },
      {
        id: 'faculty-availability',
        name: 'Faculty Availability',
        description: 'Faculty must be available during assigned slots',
        enabled: true
      }
    ];

    this.softConstraints = [
      {
        id: 'even-distribution',
        name: 'Even Distribution',
        description: 'Classes should be evenly distributed across the week',
        weight: 8,
        enabled: true
      },
      {
        id: 'minimize-gaps',
        name: 'Minimize Gaps',
        description: 'Minimize idle time for faculty and students',
        weight: 7,
        enabled: true
      },
      {
        id: 'lab-morning-preference',
        name: 'Lab Morning Preference',
        description: 'Schedule labs and practicals in morning slots',
        weight: 6,
        enabled: true
      },
      {
        id: 'faculty-load-balance',
        name: 'Faculty Load Balance',
        description: 'Balance teaching loads fairly across faculty',
        weight: 7,
        enabled: true
      }
    ];
  }

  public setData(subjects: Subject[], faculty: Faculty[], rooms: Room[], batches: StudentBatch[]) {
    this.subjects = subjects;
    this.faculty = faculty;
    this.rooms = rooms;
    this.batches = batches;
  }

  public generateTimeSlots(): TimeSlot[] {
    const timeSlots: TimeSlot[] = [];
    
    for (const day of this.institution.workingDays) {
      for (const timing of this.institution.periodTimings) {
        timeSlots.push({
          day,
          period: timing.period,
          startTime: timing.startTime,
          endTime: timing.endTime
        });
      }
    }
    
    return timeSlots;
  }

  public checkHardConstraints(entry: TimetableEntry, existingEntries: TimetableEntry[]): Conflict[] {
    const conflicts: Conflict[] = [];

    // Check faculty clash
    const facultyClash = existingEntries.find(e => 
      e.faculty.id === entry.faculty.id &&
      e.timeSlot.day === entry.timeSlot.day &&
      e.timeSlot.period === entry.timeSlot.period
    );
    
    if (facultyClash) {
      conflicts.push({
        id: `faculty-clash-${Date.now()}`,
        type: 'Faculty Clash',
        description: `Faculty ${entry.faculty.name} is already assigned to ${facultyClash.subject.name}`,
        severity: 'High',
        affectedEntries: [entry.id, facultyClash.id],
        suggestions: ['Assign different faculty', 'Change time slot']
      });
    }

    // Check room clash
    const roomClash = existingEntries.find(e => 
      e.room.id === entry.room.id &&
      e.timeSlot.day === entry.timeSlot.day &&
      e.timeSlot.period === entry.timeSlot.period
    );
    
    if (roomClash) {
      conflicts.push({
        id: `room-clash-${Date.now()}`,
        type: 'Room Clash',
        description: `Room ${entry.room.name} is already occupied by ${roomClash.subject.name}`,
        severity: 'High',
        affectedEntries: [entry.id, roomClash.id],
        suggestions: ['Assign different room', 'Change time slot']
      });
    }

    // Check batch clash
    const batchClash = existingEntries.find(e => 
      e.batch.id === entry.batch.id &&
      e.timeSlot.day === entry.timeSlot.day &&
      e.timeSlot.period === entry.timeSlot.period
    );
    
    if (batchClash) {
      conflicts.push({
        id: `batch-clash-${Date.now()}`,
        type: 'Batch Clash',
        description: `Batch ${entry.batch.name} already has ${batchClash.subject.name}`,
        severity: 'High',
        affectedEntries: [entry.id, batchClash.id],
        suggestions: ['Change time slot', 'Split batch']
      });
    }

    // Check room capacity
    if (entry.room.capacity < entry.batch.size) {
      conflicts.push({
        id: `capacity-${Date.now()}`,
        type: 'Constraint Violation',
        description: `Room capacity (${entry.room.capacity}) insufficient for batch size (${entry.batch.size})`,
        severity: 'High',
        affectedEntries: [entry.id],
        suggestions: ['Assign larger room', 'Split batch']
      });
    }

    return conflicts;
  }

  public generateTimetable(settings: OptimizationSettings): GeneratedTimetable {
    const entries: TimetableEntry[] = [];
    const conflicts: Conflict[] = [];
    const timeSlots = this.generateTimeSlots();

    // Ensure sessionsPerWeek matches credits for each subject
    this.subjects.forEach(subject => {
      subject.sessionsPerWeek = subject.credits;
    });

    // Simple greedy algorithm for MVP
    for (const batch of this.batches) {
      // Use mandatorySubjects if present, otherwise use all subjects
      const subjectIds = batch.mandatorySubjects && batch.mandatorySubjects.length > 0
        ? batch.mandatorySubjects
        : this.subjects.map(s => s.id);
      for (const subjectId of subjectIds) {
        const subject = this.subjects.find(s => s.id === subjectId);
        if (!subject) continue;

        // Find eligible faculty
        const eligibleFaculty = this.faculty.filter(f => 
          f.eligibleSubjects.includes(subjectId)
        );

        // Find suitable rooms
        const suitableRooms = this.rooms.filter(r => 
          r.capacity >= batch.size &&
          (subject.type === 'Lab' ? r.type === 'Lab' : true) &&
          subject.equipmentRequired.every(eq => r.equipment.includes(eq))
        );

        // Schedule required sessions
        for (let session = 0; session < subject.sessionsPerWeek; session++) {
          let scheduled = false;
          
          for (const timeSlot of timeSlots) {
            if (scheduled) break;
            
            for (const faculty of eligibleFaculty) {
              if (scheduled) break;
              
              for (const room of suitableRooms) {
                const entry: TimetableEntry = {
                  id: `entry-${Date.now()}-${Math.random()}`,
                  subject,
                  faculty,
                  room,
                  batch,
                  timeSlot
                };

                const entryConflicts = this.checkHardConstraints(entry, entries);
                
                if (entryConflicts.length === 0) {
                  entries.push(entry);
                  scheduled = true;
                  break;
                } else {
                  conflicts.push(...entryConflicts);
                }
              }
            }
          }
        }
      }
    }

    return {
      id: `timetable-${Date.now()}`,
      name: `Generated Timetable ${new Date().toLocaleDateString()}`,
      entries,
      conflicts,
      score: this.calculateScore(entries),
      generatedAt: new Date().toISOString(),
      status: 'Draft'
    };
  }

  private calculateScore(entries: TimetableEntry[]): number {
    // Simple scoring based on successful assignments
    const totalRequired = this.batches.reduce((sum, batch) => 
      sum + batch.mandatorySubjects.length, 0
    );
    
    const scheduled = entries.length;
    return Math.round((scheduled / totalRequired) * 100);
  }

  public getConstraints() {
    return {
      hard: this.hardConstraints,
      soft: this.softConstraints
    };
  }

  public updateConstraints(hard: HardConstraint[], soft: SoftConstraint[]) {
    this.hardConstraints = hard;
    this.softConstraints = soft;
  }
}