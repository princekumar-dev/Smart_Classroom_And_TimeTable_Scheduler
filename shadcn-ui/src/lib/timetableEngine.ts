// Export simplified lab schedule: which class and for what subject is coming to the lab
export function exportSimpleLabScheduleCSV(entries) {
  const labEntries = entries.filter(entry => entry.subject.type === 'Lab');
  const header = ['Lab Room', 'Batch', 'Lab Subject'];
  const rows = labEntries.map(entry => [
    entry.room.name,
    entry.batch.name,
    entry.subject.name
  ]);
  const csvContent =
    [header, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

  // Download as CSV
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'simple_lab_schedule.csv';
  a.click();
  URL.revokeObjectURL(url);
}
// Export lab schedules per classroom as CSV
export function exportLabSchedulesAsCSV(entries) {
  const labEntries = entries.filter(entry => entry.subject.type === 'Lab');
  const header = [
    'Room', 'Batch', 'Subject', 'Faculty', 'Day', 'Period', 'Start Time', 'End Time'
  ];
  const rows = labEntries.map(entry => [
    entry.room.name,
    entry.batch.name,
    entry.subject.name,
    entry.faculty.name,
    entry.timeSlot.day,
    entry.timeSlot.period,
    entry.timeSlot.startTime,
    entry.timeSlot.endTime
  ]);
  const csvContent =
    [header, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

  // Download as CSV
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lab_schedules.csv';
  a.click();
  URL.revokeObjectURL(url);
}
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
        id: 'avoid-consecutive-days-same-subject',
        name: 'Avoid Consecutive Days for Same Subject',
        description: 'Avoid scheduling the same subject for a batch on consecutive days',
        weight: 6,
        enabled: false // Toggleable by user
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

  // Helper function to check if a lab block would conflict with breaks
  // Works dynamically with real-time institution configuration
  private isLabBlockValidWithBreaks(startPeriod: number, duration: number): boolean {
    if (!this.institution.periodTimings || this.institution.periodTimings.length === 0) {
      console.warn('No period timings configured in institution');
      return false;
    }

    const periodTimings = this.institution.periodTimings.sort((a, b) => a.period - b.period);
    const labPeriods = [];
    
    // Get the periods for this lab block
    for (let i = 0; i < duration; i++) {
      const period = periodTimings.find(p => p.period === startPeriod + i);
      if (!period) {
        console.warn(`Period ${startPeriod + i} not found in institution configuration`);
        return false; // Period doesn't exist in configuration
      }
      labPeriods.push(period);
    }
    
    // Check if any break occurs within the lab block duration
    for (let i = 0; i < labPeriods.length - 1; i++) {
      const currentPeriod = labPeriods[i];
      const nextPeriod = labPeriods[i + 1];
      
      // Check if there's a time gap between periods (indicating a break)
      // This works for any schedule configuration the user inputs
      if (this.parseTime(currentPeriod.endTime) !== this.parseTime(nextPeriod.startTime)) {
        console.log(`Break detected between Period ${currentPeriod.period} (${currentPeriod.endTime}) and Period ${nextPeriod.period} (${nextPeriod.startTime})`);
        return false; // There's a time gap (break) between these periods
      }
      
      // Additional check for explicitly configured breaks
      if (this.institution.breaks && this.institution.breaks.length > 0) {
        const hasBreakBetween = this.institution.breaks.some(breakTime => {
          const breakStart = this.parseTime(breakTime.startTime);
          const breakEnd = this.parseTime(breakTime.endTime);
          const currentEnd = this.parseTime(currentPeriod.endTime);
          const nextStart = this.parseTime(nextPeriod.startTime);
          
          return (currentEnd <= breakStart && nextStart >= breakEnd) ||
                 (currentEnd > breakStart && currentEnd < breakEnd) ||
                 (nextStart > breakStart && nextStart < breakEnd);
        });
        
        if (hasBreakBetween) {
          console.log(`Scheduled break conflicts with lab block from Period ${currentPeriod.period} to ${nextPeriod.period}`);
          return false; // Lab block would be interrupted by a scheduled break
        }
      }
    }
    
    return true; // Lab block is valid (no breaks interrupting)
  }

  // Helper function to parse time strings and convert to minutes for comparison
  private parseTime(timeStr: string): number {
    if (!timeStr) return 0;
    
    // Handle various time formats: "09:20", "9:20", "01:40", "1:40", etc.
    const cleanTime = timeStr.replace(/[^\d:]/g, ''); // Remove any non-digit, non-colon chars
    const [hours, minutes] = cleanTime.split(':').map(Number);
    
    if (isNaN(hours) || isNaN(minutes)) {
      console.warn(`Invalid time format: ${timeStr}`);
      return 0;
    }
    
    return hours * 60 + minutes;
  }

  // Check if a time slot matches preferred time slots for subject and faculty
  private isPreferredTimeSlot(timeSlot: TimeSlot, subject: Subject, faculty: Faculty): boolean {
    // Check subject preferred time slots
    const subjectPreferred = subject.preferredTimeSlots && subject.preferredTimeSlots.length > 0;
    const facultyPreferred = faculty.preferences?.preferredTimeSlots && faculty.preferences.preferredTimeSlots.length > 0;
    
    if (!subjectPreferred && !facultyPreferred) {
      return true; // No preferences defined, consider all slots acceptable
    }
    
    let subjectMatch = !subjectPreferred; // If no subject preference, default to true
    let facultyMatch = !facultyPreferred; // If no faculty preference, default to true
    
    // Helper function to check if a time slot matches a preference
    const matchesPreference = (preference: string): boolean => {
      const prefLower = preference.toLowerCase();
      const timeSlotStart = this.parseTime(timeSlot.startTime);
      
      // Handle time-based preferences
      if (prefLower === 'morning') {
        return timeSlotStart < 12 * 60; // Before 12:00 PM
      } else if (prefLower === 'afternoon') {
        return timeSlotStart >= 12 * 60 && timeSlotStart < 17 * 60; // 12:00 PM - 5:00 PM
      } else if (prefLower === 'evening') {
        return timeSlotStart >= 17 * 60; // After 5:00 PM
      }
      
      // Handle day-specific preferences
      const timeslotDay = timeSlot.day.toLowerCase();
      if (prefLower.includes(timeslotDay)) {
        // Day-specific preference
        if (prefLower.includes(`p${timeSlot.period}`)) {
          return true; // Matches day and period
        }
        // Check time range format like "Monday 09:20-10:10"
        const timeMatch = prefLower.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          const slotStart = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
          const slotEnd = parseInt(timeMatch[3]) * 60 + parseInt(timeMatch[4]);
          const timeSlotEnd = this.parseTime(timeSlot.endTime);
          return timeSlotStart >= slotStart && timeSlotEnd <= slotEnd;
        }
        return true; // Just day match
      } else if (prefLower.includes(`p${timeSlot.period}`)) {
        // Period-only preference (any day)
        return true;
      }
      
      return false;
    };
    
    // Check subject preferred time slots
    if (subjectPreferred) {
      subjectMatch = subject.preferredTimeSlots.some(slot => matchesPreference(slot));
    }
    
    // Check faculty preferred time slots
    if (facultyPreferred) {
      facultyMatch = faculty.preferences.preferredTimeSlots.some(slot => matchesPreference(slot));
    }
    
    return subjectMatch && facultyMatch;
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

  // Utility method to shuffle arrays for variation in timetable generation
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Seeded shuffle for deterministic variation
  private shuffleArraySeeded<T>(array: T[], randomFunc: () => number): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(randomFunc() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  public generateTimetable(settings: OptimizationSettings): GeneratedTimetable {
    const entries: TimetableEntry[] = [];
    const conflicts: Conflict[] = [];
    const timeSlots = this.generateTimeSlots();

    // Add variation based on settings to generate different timetables
    // Use settings as seed for deterministic variation
    const seedValue = settings.maxIterations + settings.timeLimit + 
      Object.values(settings.priorityWeights).reduce((sum, weight) => sum + weight * 1000, 0);
    
    // Simple seeded random function
    let seed = Math.floor(seedValue * 1000) % 2147483647;
    const seededRandom = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    
    const variation = {
      batchOrder: this.shuffleArraySeeded([...this.batches], seededRandom),
      subjectOrder: this.shuffleArraySeeded([...this.subjects], seededRandom),
      facultyOrder: this.shuffleArraySeeded([...this.faculty], seededRandom),
      roomOrder: this.shuffleArraySeeded([...this.rooms], seededRandom),
      workingDaysOrder: this.shuffleArraySeeded([...this.institution.workingDays], seededRandom),
      startPeriodOffset: Math.floor(seededRandom() * 3) + 1, // Seeded start between 1-3
      prioritizeEarlierSlots: seededRandom() > 0.5, // Seeded priority direction
      seededRandom: seededRandom // Pass the function for further use
    };

    // Use weeklyHours instead of credits for sessionsPerWeek to respect max weekly limits
    this.subjects.forEach(subject => {
      // Only override sessionsPerWeek for non-Lab subjects
      // Labs use sessionsPerWeek to control number of blocks, not individual sessions
      // For Theory subjects: respect continuousHours - if continuousHours > 1, keep original sessionsPerWeek
      if (subject.type !== 'Lab') {
        // If subject has continuousHours > 1, it means it should be scheduled as fewer, longer sessions
        // Don't override sessionsPerWeek in this case, use the configured value
        if (!subject.continuousHours || subject.continuousHours <= 1) {
          subject.sessionsPerWeek = subject.weeklyHours;
        }
        // Otherwise, keep the original sessionsPerWeek value for continuous subjects
      }
    });

    // --- PRIORITIZE LABS FIRST ---
    // 1. Schedule all labs for all batches first
    // Track lab scheduling to distribute different labs across different periods
    const labSubjectStartPeriods = new Map<string, number>();
    let globalLabStartPeriod = variation.startPeriodOffset; // Use random start period
    
    for (const batch of variation.batchOrder) { // Use shuffled batch order
      const subjectIds = batch.mandatorySubjects && batch.mandatorySubjects.length > 0
        ? batch.mandatorySubjects
        : variation.subjectOrder.map(s => s.id); // Use shuffled subject order
      for (const subjectId of subjectIds) {
        // Strictly limit lab blocks to sessionsPerWeek per subject per batch
        const subject = this.subjects.find(s => s.id === subjectId);
        if (!subject || subject.type !== 'Lab') continue;
        
        const alreadyScheduledLabBlocks = entries.filter(e =>
          e.batch.id === batch.id &&
          e.subject.id === subjectId &&
          e.subject.type === 'Lab'
        ).length;
        
        // Count the number of distinct lab sessions (blocks) already scheduled
        const scheduledBlocksCount = entries.filter(e =>
          e.batch.id === batch.id &&
          e.subject.id === subjectId &&
          e.subject.type === 'Lab'
        ).reduce((blocks, entry) => {
          const dayBlocks = blocks[entry.timeSlot.day] || new Set();
          dayBlocks.add(entry.timeSlot.day);
          blocks[entry.timeSlot.day] = dayBlocks;
          return blocks;
        }, {});
        const totalScheduledBlocks = Object.keys(scheduledBlocksCount).length;
        
        if (totalScheduledBlocks >= subject.sessionsPerWeek) continue;
        
        // Assign different starting periods for different lab subjects
        if (!labSubjectStartPeriods.has(subject.id)) {
          labSubjectStartPeriods.set(subject.id, globalLabStartPeriod);
          // Dynamic spacing based on actual institution configuration
          const periodsPerDay = this.institution.periodsPerDay || this.institution.periodTimings?.length || 6;
          const labSubjects = this.subjects.filter(s => s.type === 'Lab');
          const maxLabDuration = labSubjects.length > 0 ? Math.max(...labSubjects.map(s => s.weeklyHours)) : 3;
          
          // Calculate optimal spacing to distribute labs across the day
          const availableSlots = Math.max(1, periodsPerDay - maxLabDuration + 1);
          const spacing = labSubjects.length > 1 ? Math.max(1, Math.floor(availableSlots / labSubjects.length)) : 2;
          
          globalLabStartPeriod = Math.min(globalLabStartPeriod + spacing, periodsPerDay - subject.weeklyHours + 1);
          if (globalLabStartPeriod > periodsPerDay - subject.weeklyHours) {
            globalLabStartPeriod = 1; // Reset to beginning if we've exceeded available periods
          }
          
          console.log(`Assigned lab ${subject.code} preferred start period: ${labSubjectStartPeriods.get(subject.id)}, next start: ${globalLabStartPeriod}`);
        }
        
        const eligibleFaculty = variation.facultyOrder.filter(f => f.eligibleSubjects.includes(subjectId));
        const suitableRooms = variation.roomOrder.filter(r => r.capacity >= batch.size);
        let labBlocksScheduled = 0;
        for (const day of variation.workingDaysOrder) { // Use shuffled working days order
          // For labs, check against sessionsPerWeek (number of blocks), not weeklyHours (total periods)
          if (labBlocksScheduled >= subject.sessionsPerWeek) break;
          // Prevent more than one lab block for this subject, batch, and day
          const batchHasLabForSubjectOnDay = entries.some(e =>
            e.batch.id === batch.id &&
            e.timeSlot.day === day &&
            e.subject.type === 'Lab' &&
            e.subject.id === subject.id
          );
          if (batchHasLabForSubjectOnDay) continue;
          
          // Also prevent more than one lab (any subject) per day for this batch
          const batchHasAnyLabOnDay = entries.some(e =>
            e.batch.id === batch.id &&
            e.timeSlot.day === day &&
            e.subject.type === 'Lab'
          );
          if (batchHasAnyLabOnDay) continue;
          let scheduled = false;
          for (const faculty of eligibleFaculty) {
            const labSessionsScheduledToday = entries.filter(e =>
              e.faculty.id === faculty.id &&
              e.timeSlot.day === day &&
              e.subject.type === 'Lab'
            ).length;
            const labSessionsScheduledThisWeek = entries.filter(e =>
              e.faculty.id === faculty.id &&
              e.subject.type === 'Lab'
            ).length;
            if (
              labSessionsScheduledToday + 1 > faculty.preferences.maxDailyHours ||
              labSessionsScheduledThisWeek + 1 > faculty.preferences.maxDailyHours
            ) {
              continue;
            }
            for (const room of suitableRooms) {
              const periodTimingsSorted = this.institution.periodTimings.sort((a, b) => a.period - b.period);
              // Find all possible consecutive period blocks (not interrupted by breaks)
              // Works dynamically with any institution configuration
              let consecutiveBlocks = [];
              let currentBlock = [];
              
              if (!this.institution.periodTimings || this.institution.periodTimings.length === 0) {
                console.warn('No period timings configured for consecutive block detection');
                continue;
              }
              
              for (let idx = 0; idx < periodTimingsSorted.length; idx++) {
                if (currentBlock.length === 0) {
                  currentBlock.push(periodTimingsSorted[idx].period);
                } else {
                  const lastPeriod = periodTimingsSorted[idx - 1];
                  const thisPeriod = periodTimingsSorted[idx];
                  
                  // Check if periods are truly consecutive (no time gap) using dynamic time parsing
                  const lastEndTime = this.parseTime(lastPeriod.endTime);
                  const thisStartTime = this.parseTime(thisPeriod.startTime);
                  const isConsecutive = lastEndTime === thisStartTime;
                  
                  // Additional check for explicitly scheduled breaks
                  let hasBreakBetween = false;
                  if (this.institution.breaks && this.institution.breaks.length > 0) {
                    hasBreakBetween = this.institution.breaks.some(breakTime => {
                      const breakStart = this.parseTime(breakTime.startTime);
                      const breakEnd = this.parseTime(breakTime.endTime);
                      
                      return (lastEndTime <= breakStart && thisStartTime >= breakEnd) ||
                             (lastEndTime > breakStart && lastEndTime < breakEnd) ||
                             (thisStartTime > breakStart && thisStartTime < breakEnd);
                    });
                  }
                  
                  // Periods are consecutive only if times align AND no break in between
                  if (isConsecutive && !hasBreakBetween) {
                    currentBlock.push(thisPeriod.period);
                  } else {
                    if (currentBlock.length >= subject.weeklyHours) {
                      consecutiveBlocks.push([...currentBlock]);
                    }
                    currentBlock = [thisPeriod.period];
                  }
                }
              }
              if (currentBlock.length >= subject.weeklyHours) {
                consecutiveBlocks.push([...currentBlock]);
              }
              // Only schedule if a full consecutive block is available
              // Sort blocks to prefer the assigned start period for this lab subject
              const preferredStartPeriod = labSubjectStartPeriods.get(subject.id) || 1;
              consecutiveBlocks.sort((a, b) => {
                // Prefer blocks that start at or near the preferred start period
                const aDistance = Math.abs(a[0] - preferredStartPeriod);
                const bDistance = Math.abs(b[0] - preferredStartPeriod);
                return aDistance - bDistance;
              });
              
              for (const block of consecutiveBlocks) {
                for (let i = 0; i <= block.length - subject.weeklyHours; i++) {
                  // Prefer starting at or near the preferred start period
                  const blockStartPeriod = block[i];
                  const distanceFromPreferred = Math.abs(blockStartPeriod - preferredStartPeriod);
                  
                  // Dynamic distance tolerance based on actual institution configuration
                  const periodsPerDay = this.institution.periodsPerDay || this.institution.periodTimings?.length || 6;
                  const maxDistance = Math.max(2, Math.floor(periodsPerDay / 3)); // Scale with number of periods
                  if (distanceFromPreferred > maxDistance) {
                    console.log(`Skipping block starting at period ${blockStartPeriod} (distance ${distanceFromPreferred} > ${maxDistance})`);
                    continue;
                  }
                  
                  // Check if this lab block would conflict with breaks/lunch
                  if (!this.isLabBlockValidWithBreaks(blockStartPeriod, subject.weeklyHours)) {
                    continue; // Skip this block as it conflicts with breaks
                  }
                  
                  // Strictly enforce weeklyHours limit before every atomic scheduling
                  const alreadyScheduledLabBlocks = entries.filter(e =>
                    e.batch.id === batch.id &&
                    e.subject.id === subject.id &&
                    e.subject.type === 'Lab'
                  ).reduce((acc, curr, idx, arr) => {
                    // Only count the first period of each block (to avoid counting each period separately)
                    if (
                      idx === 0 ||
                      curr.timeSlot.day !== arr[idx - 1].timeSlot.day ||
                      curr.timeSlot.period !== arr[idx - 1].timeSlot.period + 1
                    ) {
                      return acc + 1;
                    }
                    return acc;
                  }, 0);
                  if (alreadyScheduledLabBlocks >= subject.weeklyHours) break;
                  let forceableBlock = true;
                  const candidateLabSlotsBlock = [];
                  const toRemoveBlock: TimetableEntry[] = [];
                  for (let j = 0; j < subject.weeklyHours; j++) {
                    const period = block[i + j];
                    const timeSlot = timeSlots.find(ts => ts.day === day && ts.period === period);
                    if (!timeSlot) { forceableBlock = false; break; }
                    const clash = entries.find(e =>
                      (e.batch.id === batch.id || e.room.id === room.id || e.faculty.id === faculty.id) &&
                      e.timeSlot.day === day && e.timeSlot.period === period
                    );
                    if (clash) {
                      toRemoveBlock.push(clash);
                    }
                    candidateLabSlotsBlock.push(timeSlot);
                  }
                  // Only schedule if ALL periods are available (no partial scheduling)
                  if (forceableBlock && candidateLabSlotsBlock.length === subject.weeklyHours) {
                    // Only schedule the block if no other lab for this batch/subject/day is already scheduled
                    const alreadyScheduledBlock = entries.some(e =>
                      e.batch.id === batch.id &&
                      e.subject.id === subject.id &&
                      e.subject.type === 'Lab' &&
                      e.timeSlot.day === day
                    );
                    if (alreadyScheduledBlock) break;
                    for (const removeEntry of toRemoveBlock) {
                      const idx = entries.indexOf(removeEntry);
                      if (idx !== -1) entries.splice(idx, 1);
                    }
                    // ATOMIC: Only push if all periods are available
                    for (const timeSlot of candidateLabSlotsBlock) {
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
                      } else {
                        conflicts.push(...entryConflicts);
                        forceableBlock = false;
                        break;
                      }
                    }
                    if (forceableBlock) {
                      scheduled = true;
                      if (toRemoveBlock.length > 0) {
                        if (!Array.isArray((settings as any)._rescheduleQueue)) {
                          (settings as any)._rescheduleQueue = [];
                        }
                        (settings as any)._rescheduleQueue.push(...toRemoveBlock);
                      }
                      break;
                    } else {
                      // If any conflict, roll back all scheduled entries for this block
                      for (const timeSlot of candidateLabSlotsBlock) {
                        const idx = entries.findIndex(e =>
                          e.batch.id === batch.id &&
                          e.subject.id === subject.id &&
                          e.subject.type === 'Lab' &&
                          e.timeSlot.day === day &&
                          e.timeSlot.period === timeSlot.period
                        );
                        if (idx !== -1) entries.splice(idx, 1);
                      }
                    }
                  }
                  if (scheduled) break;
                }
                if (scheduled) break;
              }
              if (scheduled) {
                labBlocksScheduled++;
                break;
              }
            }
            if (scheduled) break;
          }
        }
        if (labBlocksScheduled < subject.sessionsPerWeek) {
          console.warn(`Could not schedule all LAB blocks for subject ${subject.name} in batch ${batch.name}. Scheduled ${labBlocksScheduled}/${subject.sessionsPerWeek} blocks.`);
        }
      }
    }
    
    // 2. Now schedule all non-lab (theory etc) sessions for all batches
    console.log('Starting theory subject scheduling...');
    for (const batch of variation.batchOrder) { // Use shuffled batch order
      const subjectIds = batch.mandatorySubjects && batch.mandatorySubjects.length > 0
        ? batch.mandatorySubjects
        : variation.subjectOrder.map(s => s.id); // Use shuffled subject order
      
      console.log(`Scheduling subjects for batch ${batch.name}: ${subjectIds.join(', ')}`);
      
      // Sort subjects by difficulty: continuous subjects first, then regular subjects
      const sortedSubjectIds = subjectIds.sort((a, b) => {
        const subjectA = this.subjects.find(s => s.id === a);
        const subjectB = this.subjects.find(s => s.id === b);
        
        if (!subjectA || !subjectB) return 0;
        if (subjectA.type === 'Lab' && subjectB.type !== 'Lab') return 1;
        if (subjectA.type !== 'Lab' && subjectB.type === 'Lab') return -1;
        
        // Prioritize continuous subjects (harder to schedule)
        const continuousA = (subjectA.continuousHours || 1) > 1;
        const continuousB = (subjectB.continuousHours || 1) > 1;
        
        if (continuousA && !continuousB) return -1; // A comes first
        if (!continuousA && continuousB) return 1;  // B comes first
        
        return 0; // Keep original order for similar subjects
      });
      
      console.log(`Sorted subjects (continuous first): ${sortedSubjectIds.join(', ')}`);
      
      for (const subjectId of sortedSubjectIds) {
        const subject = this.subjects.find(s => s.id === subjectId);
        if (!subject || subject.type === 'Lab') continue;
        
        console.log(`Attempting to schedule subject ${subject.code} (${subject.name}) - ${subject.sessionsPerWeek} sessions, continuousHours: ${subject.continuousHours || 1}`);
        
        if (subject.code === 'U24ED311') {
          console.log(`🎯 SPECIAL TRACKING: EDI subject detected - requires ${subject.continuousHours} continuous hours`);
        }
        
        const eligibleFaculty = variation.facultyOrder.filter(f => f.eligibleSubjects.includes(subjectId));
        console.log(`Eligible faculty for ${subject.code}: ${eligibleFaculty.map(f => f.name).join(', ')}`);
        
        if (eligibleFaculty.length === 0) {
          console.error(`No eligible faculty found for subject ${subject.code}!`);
          continue;
        }
        
        const suitableRooms = variation.roomOrder.filter(r => r.capacity >= batch.size);
        let totalSessionsScheduled = 0;
        
        for (let session = 0; session < subject.sessionsPerWeek; session++) {
          let scheduled = false;
          
          // For theory subjects, find days that don't already have this subject
          const availableDays = subject.type === 'Theory' 
            ? this.institution.workingDays.filter(day => {
                const sessionsTodayCount = entries.filter(e =>
                  e.batch.id === batch.id &&
                  e.timeSlot.day === day &&
                  e.subject.id === subject.id &&
                  e.subject.type === 'Theory'
                ).length;
                return sessionsTodayCount === 0;
              })
            : this.institution.workingDays;
          
          // If no available days for theory subjects, log warning but continue
          if (subject.type === 'Theory' && availableDays.length === 0) {
            console.warn(`No available days for ${subject.name} session ${session + 1} in batch ${batch.name}. Already scheduled on: ${this.institution.workingDays.filter(day => !availableDays.includes(day))}`);
            break; // Stop trying to schedule more sessions for this subject
          }
          
          // Calculate how many periods this session needs (for continuous subjects)
          const periodsNeeded = subject.continuousHours || 1;
          
          if (subject.type === 'Theory') {
            console.log(`Scheduling ${subject.name} session ${session + 1}/${subject.sessionsPerWeek} (${periodsNeeded} periods) for batch ${batch.name}. Available days: ${availableDays.join(', ')}`);
          }
          
          // Add variation to time slot selection - shuffle and prioritize preferred slots
          const shuffledTimeSlots = this.shuffleArraySeeded([...timeSlots], variation.seededRandom);
          
          // Separate preferred and non-preferred time slots for eligible faculty
          const timeSlotsByPreference = shuffledTimeSlots.reduce((acc, slot) => {
            // For theory subjects, only consider time slots on available days
            if (subject.type === 'Theory' && !availableDays.includes(slot.day)) {
              return acc;
            }
            
            // Check if any eligible faculty has this as a preferred slot
            const isSubjectPreferred = this.isPreferredTimeSlot(slot, subject, { preferences: {} } as Faculty);
            const hasPreferredFaculty = eligibleFaculty.length > 0 && eligibleFaculty.some(faculty => 
              this.isPreferredTimeSlot(slot, subject, faculty)
            );
            
            if (isSubjectPreferred || hasPreferredFaculty) {
              acc.preferred.push(slot);
            } else {
              acc.nonPreferred.push(slot);
            }
            return acc;
          }, { preferred: [] as TimeSlot[], nonPreferred: [] as TimeSlot[] });
          
          // Sort preferred slots first, then non-preferred
          const orderedPreferred = variation.prioritizeEarlierSlots 
            ? timeSlotsByPreference.preferred.sort((a, b) => a.period - b.period)
            : timeSlotsByPreference.preferred.sort((a, b) => b.period - a.period);
            
          const orderedNonPreferred = variation.prioritizeEarlierSlots 
            ? timeSlotsByPreference.nonPreferred.sort((a, b) => a.period - b.period)
            : timeSlotsByPreference.nonPreferred.sort((a, b) => b.period - a.period);
          
          // Combine: preferred slots first, then non-preferred
          const orderedTimeSlots = [...orderedPreferred, ...orderedNonPreferred];
          
          console.log(`📅 ${subject.code}: Found ${timeSlotsByPreference.preferred.length} preferred slots, ${timeSlotsByPreference.nonPreferred.length} non-preferred slots`);
          
          // Debug: Show subject and faculty preferences
          if (subject.preferredTimeSlots && subject.preferredTimeSlots.length > 0) {
            console.log(`   Subject ${subject.code} preferences: ${subject.preferredTimeSlots.join(', ')}`);
          }
          if (eligibleFaculty.length > 0) {
            eligibleFaculty.forEach(faculty => {
              if (faculty.preferences?.preferredTimeSlots && faculty.preferences.preferredTimeSlots.length > 0) {
                console.log(`   Faculty ${faculty.name} preferences: ${faculty.preferences.preferredTimeSlots.join(', ')}`);
              }
            });
          }
          
          for (const timeSlot of orderedTimeSlots) {
            if (scheduled) break;
            
            // Skip if this is a theory subject and the day is not available
            if (subject.type === 'Theory' && !availableDays.includes(timeSlot.day)) {
              continue;
            }
            
            // Prevent the same subject from being scheduled at the same period (hour) on every day of the week for a batch
            const samePeriodCount = entries.filter(e =>
              e.batch.id === batch.id &&
              e.subject.id === subject.id &&
              e.timeSlot.period === timeSlot.period
            ).length;
            // If this subject is already scheduled at this period on more than 0 other days, skip this period for this batch
            if (samePeriodCount > 0) continue;
            const alreadyScheduledToday = entries.find(e =>
              e.batch.id === batch.id &&
              e.timeSlot.day === timeSlot.day &&
              e.subject.id === subject.id &&
              e.subject.type === 'Theory'
            );
            if (subject.type === 'Theory' && alreadyScheduledToday) {
              continue;
            }

            // Prevent consecutive theory classes of the same subject for the same batch
            // EXCEPT for continuous subjects that are meant to be scheduled consecutively
            if (subject.type === 'Theory' && periodsNeeded === 1) {
              const hasConsecutiveTheoryConflict = entries.some(e =>
                e.batch.id === batch.id &&
                e.timeSlot.day === timeSlot.day &&
                e.subject.id === subject.id &&
                e.subject.type === 'Theory' &&
                Math.abs(e.timeSlot.period - timeSlot.period) === 1
              );
              if (hasConsecutiveTheoryConflict) {
                continue;
              }
            }
            for (const faculty of eligibleFaculty) {
              if (scheduled) break;
              
              // Add debugging for specific subject
              if (subject.id === 'U24MA302' && timeSlot.day === 'Friday') {
                console.log(`Trying to schedule U24MA302 on Friday P${timeSlot.period} with faculty ${faculty.name}`);
              }
              
              const theorySessionsScheduledToday = entries.filter(e =>
                e.faculty.id === faculty.id &&
                e.timeSlot.day === timeSlot.day &&
                e.subject.type === 'Theory'
              ).length;
              const theorySessionsScheduledThisWeek = entries.filter(e =>
                e.faculty.id === faculty.id &&
                e.subject.type === 'Theory'
              ).length;
              if (
                subject.type === 'Theory' &&
                (theorySessionsScheduledToday >= faculty.preferences.maxDailyHours ||
                theorySessionsScheduledThisWeek >= faculty.maxWeeklyLoad)
              ) {
                if (subject.id === 'U24MA302' && timeSlot.day === 'Friday') {
                  console.log(`Faculty ${faculty.name} unavailable: dailyHours=${theorySessionsScheduledToday}/${faculty.preferences.maxDailyHours}, weeklyHours=${theorySessionsScheduledThisWeek}/${faculty.maxWeeklyLoad}`);
                }
                continue;
              }
              for (const room of suitableRooms) {
                // For continuous subjects, we need to check if there are enough consecutive periods
                if (periodsNeeded > 1) {
                  if (subject.code === 'U24ED311') {
                    console.log(`🎯 EDI: Trying to schedule ${periodsNeeded} consecutive periods starting at ${timeSlot.day} P${timeSlot.period} with ${faculty.name} in ${room.name}`);
                  }
                  
                  // Check if we can schedule consecutive periods starting from this one
                  let canScheduleContinuous = true;
                  const consecutiveSlots = [];
                  
                  for (let p = 0; p < periodsNeeded; p++) {
                    const currentPeriod = timeSlot.period + p;
                    if (currentPeriod > this.institution.periodsPerDay) {
                      canScheduleContinuous = false;
                      if (subject.code === 'U24ED311') {
                        console.log(`🎯 EDI: Cannot schedule - period ${currentPeriod} exceeds max periods (${this.institution.periodsPerDay})`);
                      }
                      break;
                    }
                    
                    // Create timeSlot for this period
                    const consecutiveTimeSlot = timeSlots.find(ts => 
                      ts.day === timeSlot.day && ts.period === currentPeriod
                    );
                    
                    if (!consecutiveTimeSlot) {
                      canScheduleContinuous = false;
                      if (subject.code === 'U24ED311') {
                        console.log(`🎯 EDI: Cannot find timeslot for ${timeSlot.day} P${currentPeriod}`);
                      }
                      break;
                    }
                    
                    // Check if this period is available for all entities
                    const tempEntry: TimetableEntry = {
                      id: `temp-${Date.now()}-${Math.random()}`,
                      subject,
                      faculty,
                      room,
                      batch,
                      timeSlot: consecutiveTimeSlot
                    };
                    
                    const tempConflicts = this.checkHardConstraints(tempEntry, entries);
                    if (tempConflicts.length > 0) {
                      canScheduleContinuous = false;
                      if (subject.code === 'U24ED311') {
                        console.log(`🎯 EDI: Conflict at ${timeSlot.day} P${currentPeriod}: ${tempConflicts[0].description}`);
                      }
                      break;
                    }
                    
                    consecutiveSlots.push(consecutiveTimeSlot);
                  }
                  
                  if (canScheduleContinuous && consecutiveSlots.length === periodsNeeded) {
                    if (subject.code === 'U24ED311') {
                      console.log(`🎯 EDI: SUCCESS! Scheduling ${periodsNeeded} periods starting at ${timeSlot.day} P${timeSlot.period}`);
                    }
                    
                    // Check if this is a preferred time slot
                    const isPreferred = this.isPreferredTimeSlot(timeSlot, subject, faculty);
                    console.log(`✅ SCHEDULED (Continuous): ${subject.code} with ${faculty.name} at ${timeSlot.day} P${timeSlot.period}-P${timeSlot.period + periodsNeeded - 1} ${isPreferred ? '⭐ PREFERRED SLOT' : ''}`);
                    
                    // Schedule all consecutive periods
                    for (const consecutiveSlot of consecutiveSlots) {
                      const entry: TimetableEntry = {
                        id: `entry-${Date.now()}-${Math.random()}`,
                        subject,
                        faculty,
                        room,
                        batch,
                        timeSlot: consecutiveSlot
                      };
                      entries.push(entry);
                    }
                    scheduled = true;
                    break;
                  }
                } else {
                  // Single period scheduling (original logic)
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
                    // Check if this is a preferred time slot
                    const isPreferred = this.isPreferredTimeSlot(timeSlot, subject, faculty);
                    console.log(`✅ SCHEDULED: ${subject.code} with ${faculty.name} at ${timeSlot.day} P${timeSlot.period} ${isPreferred ? '⭐ PREFERRED SLOT' : ''}`);
                    
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
          if (!scheduled) {
            console.warn(`Could not schedule session ${session + 1}/${subject.sessionsPerWeek} for subject ${subject.name} in batch ${batch.name}. Available days were: ${subject.type === 'Theory' ? availableDays.join(', ') : 'N/A'}`);
          } else {
            totalSessionsScheduled++;
            console.log(`Successfully scheduled session ${session + 1}/${subject.sessionsPerWeek} for ${subject.code}`);
          }
        }
        
        console.log(`Completed scheduling for ${subject.code}: ${totalSessionsScheduled}/${subject.sessionsPerWeek} sessions scheduled`);
        
        if (totalSessionsScheduled < subject.sessionsPerWeek) {
          console.error(`MISSING SESSIONS: Subject ${subject.code} only got ${totalSessionsScheduled}/${subject.sessionsPerWeek} sessions scheduled!`);
        }
      }
    }
    // Reschedule any removed entries (theory/other) that were displaced by lab blocks
    if (Array.isArray((settings as any)._rescheduleQueue)) {
      const toReschedule = (settings as any)._rescheduleQueue;
      for (const entry of toReschedule) {
        // Try to find a new slot for this entry
        let scheduled = false;
        for (const timeSlot of timeSlots) {
          if (scheduled) break;
          // Don't double-book
          const clash = entries.some(e =>
            (e.batch.id === entry.batch.id || e.room.id === entry.room.id || e.faculty.id === entry.faculty.id) &&
            e.timeSlot.day === timeSlot.day && e.timeSlot.period === timeSlot.period
          );
          if (clash) continue;
          // Only one theory of same subject per day
          if (entry.subject.type === 'Theory') {
            const alreadyScheduledToday = entries.find(e =>
              e.batch.id === entry.batch.id &&
              e.timeSlot.day === timeSlot.day &&
              e.subject.id === entry.subject.id &&
              e.subject.type === 'Theory'
            );
            if (alreadyScheduledToday) continue;

            // Prevent consecutive theory classes of the same subject for the same batch
            const hasConsecutiveTheoryConflict = entries.some(e =>
              e.batch.id === entry.batch.id &&
              e.timeSlot.day === timeSlot.day &&
              e.subject.id === entry.subject.id &&
              e.subject.type === 'Theory' &&
              Math.abs(e.timeSlot.period - timeSlot.period) === 1
            );
            if (hasConsecutiveTheoryConflict) continue;
          }
          // Place the entry
          const newEntry = { ...entry, timeSlot };
          const entryConflicts = this.checkHardConstraints(newEntry, entries);
          if (entryConflicts.length === 0) {
            entries.push(newEntry);
            scheduled = true;
            break;
          }
        }
        if (!scheduled) {
          conflicts.push({
            id: `reschedule-fail-${Date.now()}`,
            type: 'Constraint Violation',
            description: `Could not reschedule displaced class for ${entry.subject.name} (${entry.subject.type})`,
            severity: 'High',
            affectedEntries: [entry.id],
            suggestions: ['Increase available periods or relax constraints']
          });
        }
      }
    }

    // Final scheduling summary
    console.log('=== TIMETABLE GENERATION SUMMARY ===');
    console.log(`Total entries scheduled: ${entries.length}`);
    
    // Check which subjects were scheduled
    const scheduledSubjects = [...new Set(entries.map(e => e.subject.code))];
    const allRequiredSubjects = [...new Set(this.batches.flatMap(b => 
      b.mandatorySubjects && b.mandatorySubjects.length > 0 ? b.mandatorySubjects : this.subjects.map(s => s.id)
    ))];
    
    console.log(`Scheduled subjects: ${scheduledSubjects.join(', ')}`);
    console.log(`Required subjects: ${allRequiredSubjects.join(', ')}`);
    
    const missingSubjects = allRequiredSubjects.filter(s => !scheduledSubjects.includes(s));
    if (missingSubjects.length > 0) {
      console.error(`MISSING SUBJECTS: ${missingSubjects.join(', ')}`);
    }
    
    // Check faculty utilization  
    const facultyUtilization = this.faculty.map(f => {
      const assignedEntries = entries.filter(e => e.faculty.id === f.id);
      return {
        name: f.name,
        assigned: assignedEntries.length,
        subjects: [...new Set(assignedEntries.map(e => e.subject.code))]
      };
    });
    
    console.log('Faculty utilization:');
    facultyUtilization.forEach(f => {
      console.log(`  ${f.name}: ${f.assigned} classes (${f.subjects.join(', ')})`);
    });
    
    console.log('=== END SUMMARY ===');

    // Ensure unique id for each timetable
    const uniqueSuffix = Math.random().toString(36).substring(2, 10);
    return {
      id: `timetable-${Date.now()}-${uniqueSuffix}`,
      name: `Generated Timetable ${new Date().toLocaleDateString()}`,
      entries,
      conflicts,
      score: this.calculateScore(entries),
      generatedAt: new Date().toISOString(),
      status: 'Draft'
    };
  }

  private calculateScore(entries: TimetableEntry[]): number {
    // Improved scoring: count all scheduled subjects if mandatorySubjects is empty
    let totalRequired = 0;
    for (const batch of this.batches) {
      if (batch.mandatorySubjects && batch.mandatorySubjects.length > 0) {
        totalRequired += batch.mandatorySubjects.length;
      } else {
        totalRequired += this.subjects.length;
      }
    }
    const scheduled = entries.length;
    return totalRequired > 0 ? Math.round((scheduled / totalRequired) * 100) : 0;
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