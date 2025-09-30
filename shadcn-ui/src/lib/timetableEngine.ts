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
  OptimizationSettings,
  SavedTimetableRegistry
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
    
    // Get the periods for this lab block and ensure they exist and are consecutive
    for (let i = 0; i < duration; i++) {
      const targetPeriod = startPeriod + i;
      const period = periodTimings.find(p => p.period === targetPeriod);
      if (!period) {
        console.log(`Period ${targetPeriod} not found in institution configuration for lab block starting at P${startPeriod}`);
        return false; // Period doesn't exist in configuration
      }
      labPeriods.push(period);
    }
    
    // Verify lab periods are truly consecutive without breaks
    for (let i = 0; i < labPeriods.length - 1; i++) {
      const currentPeriod = labPeriods[i];
      const nextPeriod = labPeriods[i + 1];
      
      // Check if period numbers are consecutive
      if (nextPeriod.period - currentPeriod.period !== 1) {
        console.log(`Non-consecutive periods detected: P${currentPeriod.period} -> P${nextPeriod.period}`);
        return false;
      }
      
      // Check if there's a time gap between periods (indicating a break)
      const currentEndTime = this.parseTime(currentPeriod.endTime);
      const nextStartTime = this.parseTime(nextPeriod.startTime);
      
      if (currentEndTime !== nextStartTime) {
        console.log(`Time gap detected between Period ${currentPeriod.period} (${currentPeriod.endTime}) and Period ${nextPeriod.period} (${nextPeriod.startTime}) - cannot schedule continuous lab`);
        return false; // There's a time gap (break) between these periods
      }
      
      // Additional check for explicitly configured breaks
      if (this.institution.breaks && this.institution.breaks.length > 0) {
        const hasBreakBetween = this.institution.breaks.some(breakTime => {
          const breakStart = this.parseTime(breakTime.startTime);
          const breakEnd = this.parseTime(breakTime.endTime);
          
          // Check if any part of the break overlaps with the transition between periods
          return (currentEndTime <= breakStart && nextStartTime >= breakEnd) ||
                 (currentEndTime > breakStart && currentEndTime < breakEnd) ||
                 (nextStartTime > breakStart && nextStartTime < breakEnd);
        });
        
        if (hasBreakBetween) {
          console.log(`Scheduled break conflicts with lab block transition from Period ${currentPeriod.period} to ${nextPeriod.period}`);
          return false; // Lab block would be interrupted by a scheduled break
        }
      }
    }
    
    console.log(`✅ Lab block P${startPeriod}-P${startPeriod + duration - 1} is valid (${duration} consecutive periods without breaks)`);
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

    // Apply pattern avoidance for single-class mode
    let availableTimeSlots = [...timeSlots];
    if (settings.avoidedPatterns && settings.avoidedPatterns.length > 0) {
      console.log(`🚫 Pattern Avoidance Active: Avoiding ${settings.avoidedPatterns.length} time slots`);
      settings.avoidedPatterns.forEach(pattern => {
        console.log(`   Avoiding: ${pattern.day} Period ${pattern.period}`);
      });
      
      availableTimeSlots = timeSlots.filter(slot => {
        return !settings.avoidedPatterns!.some(pattern => 
          slot.day === pattern.day && slot.period === pattern.period
        );
      });
      
      console.log(`📊 Available slots: ${availableTimeSlots.length}/${timeSlots.length} (avoided ${timeSlots.length - availableTimeSlots.length} slots)`);
    }

    // Generate truly random seed for different timetables each time
    // Combine current timestamp, Math.random(), and user settings for maximum variety
    const randomComponent = Math.random() * 1000000;
    const timeComponent = Date.now() % 1000000;
    const settingsComponent = settings.maxIterations + settings.timeLimit + 
      Object.values(settings.priorityWeights).reduce((sum, weight) => sum + weight * 100, 0);
    
    const seedValue = randomComponent + timeComponent + settingsComponent;
    
    // Enhanced seeded random function with better distribution
    let seed = Math.floor(seedValue) % 2147483647;
    if (seed <= 0) seed += 2147483646;
    
    const seededRandom = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    
    console.log(`🎲 Using random seed: ${seed} (randomComponent: ${randomComponent.toFixed(0)}, timeComponent: ${timeComponent})`);
    
    const variation = {
      batchOrder: this.shuffleArraySeeded([...this.batches], seededRandom),
      subjectOrder: this.shuffleArraySeeded([...this.subjects], seededRandom),
      facultyOrder: this.shuffleArraySeeded([...this.faculty], seededRandom),
      roomOrder: this.shuffleArraySeeded([...this.rooms], seededRandom),
      workingDaysOrder: this.shuffleArraySeeded([...this.institution.workingDays], seededRandom),
      startPeriodOffset: Math.floor(seededRandom() * 4) + 1, // Random start between 1-4
      prioritizeEarlierSlots: seededRandom() > 0.5, // Random priority direction
      randomizeSlotSelection: seededRandom() > 0.3, // 70% chance to randomize slot selection
      preferredTimeVariation: Math.floor(seededRandom() * 3), // 0=strict, 1=flexible, 2=very flexible
      seededRandom: seededRandom // Pass the function for further use
    };
    
    console.log(`🔀 Randomization settings: startOffset=${variation.startPeriodOffset}, prioritizeEarly=${variation.prioritizeEarlierSlots}, randomizeSlots=${variation.randomizeSlotSelection}, timeFlexibility=${variation.preferredTimeVariation}`);

    // REMOVED: Subject modification logic that was causing extra sessions
    // The subjects should be used exactly as configured by the user
    // Labs and theory subjects will be handled properly in their respective scheduling sections
    
    console.log('=== SUBJECT CONFIGURATION VERIFICATION ===');
    this.subjects.forEach(subject => {
      console.log(`${subject.code}: type=${subject.type}, weeklyHours=${subject.weeklyHours}, sessionsPerWeek=${subject.sessionsPerWeek}, continuousHours=${subject.continuousHours}`);
    });
    console.log('=========================================');

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
        
        console.log(`🧪 Processing lab subject ${subject.code}: weeklyHours=${subject.weeklyHours}, sessionsPerWeek=${subject.sessionsPerWeek}, continuousHours=${subject.continuousHours}`);
        
        // CRITICAL: Auto-correct lab configuration to ensure continuous blocks
        // Labs with weeklyHours=1 should be converted to multi-hour continuous blocks
        let labWeeklyHours = subject.weeklyHours;
        let labSessionsPerWeek = subject.sessionsPerWeek;
        
        if (subject.weeklyHours === 1 || subject.continuousHours === 1) {
          console.warn(`🔧 Auto-correcting lab ${subject.code}: Converting from single-hour to continuous block`);
          console.warn(`   Original: weeklyHours=${subject.weeklyHours}, sessionsPerWeek=${subject.sessionsPerWeek}, continuousHours=${subject.continuousHours}`);
          
          // Auto-correct to standard lab configuration: 2-3 hour continuous blocks
          if (subject.sessionsPerWeek > 1) {
            // If multiple sessions per week, convert to fewer longer sessions
            labWeeklyHours = subject.weeklyHours; // Keep total hours
            labSessionsPerWeek = 1; // But make it 1 long session instead of multiple short ones
          } else {
            // If already 1 session per week, make it at least 2 hours
            labWeeklyHours = Math.max(2, subject.weeklyHours);
            labSessionsPerWeek = 1;
          }
          
          console.warn(`   Corrected: weeklyHours=${labWeeklyHours}, sessionsPerWeek=${labSessionsPerWeek}`);
          console.warn(`   This will schedule the lab as ${labWeeklyHours} continuous periods instead of single periods`);
        }
        
        console.log(`🧪 Final lab config for ${subject.code}: weeklyHours=${labWeeklyHours}, sessionsPerWeek=${labSessionsPerWeek}`);
        
        // Ensure minimum lab duration of 2 periods for proper continuous scheduling
        if (labWeeklyHours < 2) {
          console.warn(`🔧 Enforcing minimum lab duration: ${subject.code} upgraded from ${labWeeklyHours} to 2 periods`);
          labWeeklyHours = 2;
        }
        
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
          const maxLabDuration = labSubjects.length > 0 ? Math.max(...labSubjects.map(s => Math.max(2, s.weeklyHours))) : 3;
          
          // Calculate optimal spacing to distribute labs across the day
          const availableSlots = Math.max(1, periodsPerDay - maxLabDuration + 1);
          const spacing = labSubjects.length > 1 ? Math.max(1, Math.floor(availableSlots / labSubjects.length)) : 2;
          
          globalLabStartPeriod = Math.min(globalLabStartPeriod + spacing, periodsPerDay - labWeeklyHours + 1);
          if (globalLabStartPeriod > periodsPerDay - labWeeklyHours) {
            globalLabStartPeriod = 1; // Reset to beginning if we've exceeded available periods
          }
          
          console.log(`Assigned lab ${subject.code} preferred start period: ${labSubjectStartPeriods.get(subject.id)}, next start: ${globalLabStartPeriod}`);
        }
        
        let eligibleFaculty = variation.facultyOrder.filter(f => f.eligibleSubjects.includes(subjectId));
        
        // Add randomization to faculty selection order
        if (variation.randomizeSlotSelection && eligibleFaculty.length > 1) {
          eligibleFaculty = this.shuffleArraySeeded(eligibleFaculty, variation.seededRandom);
        }
        
        console.log(`🧪 Lab subject matching for ${subject.code} (ID: ${subjectId}):`);
        console.log(`   Matching faculty: ${eligibleFaculty.map(f => f.name).join(', ')}`);
        
        if (eligibleFaculty.length === 0) {
          console.error(`❌ No eligible faculty found for lab subject ${subject.code} (ID: ${subjectId})!`);
        }
        
        let suitableRooms = variation.roomOrder.filter(r => r.capacity >= batch.size);
        
        // Add additional room randomization for variety
        if (variation.randomizeSlotSelection && suitableRooms.length > 1) {
          suitableRooms = this.shuffleArraySeeded(suitableRooms, variation.seededRandom);
        }
        
        let labBlocksScheduled = 0;
        for (const day of variation.workingDaysOrder) { // Use shuffled working days order
          // For labs, check against sessionsPerWeek (number of blocks), not weeklyHours (total periods)
          if (labBlocksScheduled >= labSessionsPerWeek) break;
          // Prevent more than one lab block for this subject, batch, and day
          const batchHasLabForSubjectOnDay = entries.some(e =>
            e.batch.id === batch.id &&
            e.timeSlot.day === day &&
            e.subject.type === 'Lab' &&
            e.subject.id === subject.id
          );
          if (batchHasLabForSubjectOnDay) continue;
          
          // Relaxed constraint: Allow multiple labs per day if needed for full scheduling
          // Count existing labs for this batch on this day
          const batchLabsOnDay = entries.filter(e =>
            e.batch.id === batch.id &&
            e.timeSlot.day === day &&
            e.subject.type === 'Lab'
          ).length;
          
          // Only skip if we already have 2+ labs on this day (allow some flexibility)
          const maxLabsPerDay = 2; // Allow up to 2 labs per day if needed
          if (batchLabsOnDay >= maxLabsPerDay) {
            console.log(`⏭️ Skipping ${day} for ${subject.code}: already has ${batchLabsOnDay} labs (max: ${maxLabsPerDay})`);
            continue;
          }
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
            // Relaxed faculty constraints for lab scheduling  
            const effectiveMaxDailyHours = Math.max(faculty.preferences.maxDailyHours, 6);
            const effectiveMaxWeeklyLoad = Math.max(faculty.maxWeeklyLoad, 30);
            
            if (
              labSessionsScheduledToday + 1 > effectiveMaxDailyHours ||
              labSessionsScheduledThisWeek + 1 > effectiveMaxWeeklyLoad
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
              
              // Sort periods by period number to ensure correct order
              const sortedPeriods = [...periodTimingsSorted].sort((a, b) => a.period - b.period);
              
              for (let idx = 0; idx < sortedPeriods.length; idx++) {
                if (currentBlock.length === 0) {
                  currentBlock.push(sortedPeriods[idx].period);
                } else {
                  const lastPeriod = sortedPeriods[idx - 1];
                  const thisPeriod = sortedPeriods[idx];
                  
                  // Check if periods are truly consecutive (no time gap) using dynamic time parsing
                  const lastEndTime = this.parseTime(lastPeriod.endTime);
                  const thisStartTime = this.parseTime(thisPeriod.startTime);
                  const isConsecutive = lastEndTime === thisStartTime;
                  
                  // Also check if period numbers are consecutive
                  const periodsAreSequential = (thisPeriod.period - lastPeriod.period) === 1;
                  
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
                  
                  // Periods are consecutive only if times align AND period numbers are sequential AND no break in between
                  if (isConsecutive && periodsAreSequential && !hasBreakBetween) {
                    currentBlock.push(thisPeriod.period);
                  } else {
                    // Save current block if it's long enough for this lab
                    if (currentBlock.length >= labWeeklyHours) {
                      consecutiveBlocks.push([...currentBlock]);
                    }
                    // Start new block
                    currentBlock = [thisPeriod.period];
                  }
                }
              }
              // Don't forget the last block
              if (currentBlock.length >= labWeeklyHours) {
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
                for (let i = 0; i <= block.length - labWeeklyHours; i++) {
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
                  if (!this.isLabBlockValidWithBreaks(blockStartPeriod, labWeeklyHours)) {
                    continue; // Skip this block as it conflicts with breaks
                  }
                  
                  // Strictly enforce sessionsPerWeek limit before every atomic scheduling
                  // Count number of distinct lab blocks (sessions) already scheduled for this subject and batch
                  const scheduledLabDays = new Set();
                  entries.filter(e =>
                    e.batch.id === batch.id &&
                    e.subject.id === subject.id &&
                    e.subject.type === 'Lab'
                  ).forEach(e => {
                    scheduledLabDays.add(e.timeSlot.day);
                  });
                  
                  if (scheduledLabDays.size >= labSessionsPerWeek) {
                    console.log(`Lab ${subject.code} for batch ${batch.name} already has ${scheduledLabDays.size}/${labSessionsPerWeek} sessions scheduled`);
                    break;
                  }
                  
                  // Check if we can schedule the ENTIRE consecutive lab block atomically
                  let canScheduleEntireBlock = true;
                  const candidateLabSlotsBlock = [];
                  const conflictingEntries: TimetableEntry[] = [];
                  
                  // First pass: check if all required consecutive periods are available
                  for (let j = 0; j < labWeeklyHours; j++) {
                    const period = block[i + j];
                    const timeSlot = timeSlots.find(ts => ts.day === day && ts.period === period);
                    
                    if (!timeSlot) { 
                      canScheduleEntireBlock = false;
                      console.log(`Cannot find timeSlot for ${day} P${period} in lab block`);
                      break; 
                    }
                    
                    // Check for hard constraint violations
                    const clash = entries.find(e =>
                      (e.batch.id === batch.id || e.room.id === room.id || e.faculty.id === faculty.id) &&
                      e.timeSlot.day === day && e.timeSlot.period === period
                    );
                    
                    if (clash) {
                      // We found a conflict, but we might be able to reschedule it
                      conflictingEntries.push(clash);
                    }
                    
                    candidateLabSlotsBlock.push(timeSlot);
                  }
                  
                  // Only proceed if we found all required consecutive periods
                  if (canScheduleEntireBlock && candidateLabSlotsBlock.length === labWeeklyHours) {
                    // Check if this batch already has a lab for this subject on this day
                    const alreadyScheduledBlock = entries.some(e =>
                      e.batch.id === batch.id &&
                      e.subject.id === subject.id &&
                      e.subject.type === 'Lab' &&
                      e.timeSlot.day === day
                    );
                    if (alreadyScheduledBlock) {
                      console.log(`Lab ${subject.code} already scheduled for batch ${batch.name} on ${day}`);
                      break;
                    }
                    // Remove any conflicting entries first (we'll try to reschedule them later)
                    for (const removeEntry of conflictingEntries) {
                      const idx = entries.indexOf(removeEntry);
                      if (idx !== -1) entries.splice(idx, 1);
                    }
                    
                    // ATOMIC: Schedule ALL periods of the lab block together
                    let allPeriodsScheduled = true;
                    const scheduledEntries: TimetableEntry[] = [];
                    
                    for (const timeSlot of candidateLabSlotsBlock) {
                      const entry: TimetableEntry = {
                        id: `entry-${Date.now()}-${Math.random()}`,
                        subject,
                        faculty,
                        room,
                        batch,
                        timeSlot
                      };
                      
                      // Check hard constraints again after removing conflicts
                      const entryConflicts = this.checkHardConstraints(entry, entries);
                      if (entryConflicts.length === 0) {
                        entries.push(entry);
                        scheduledEntries.push(entry);
                      } else {
                        conflicts.push(...entryConflicts);
                        allPeriodsScheduled = false;
                        
                        // Roll back any entries we just added
                        for (const scheduledEntry of scheduledEntries) {
                          const rollbackIdx = entries.indexOf(scheduledEntry);
                          if (rollbackIdx !== -1) entries.splice(rollbackIdx, 1);
                        }
                        break;
                      }
                    }
                    
                    if (allPeriodsScheduled) {
                      console.log(`✅ SCHEDULED LAB BLOCK: ${subject.code} for batch ${batch.name} on ${day} P${candidateLabSlotsBlock[0].period}-P${candidateLabSlotsBlock[candidateLabSlotsBlock.length - 1].period} (${labWeeklyHours} consecutive periods)`);
                      scheduled = true;
                      
                      // Queue conflicting entries for rescheduling
                      if (conflictingEntries.length > 0) {
                        if (!Array.isArray((settings as any)._rescheduleQueue)) {
                          (settings as any)._rescheduleQueue = [];
                        }
                        (settings as any)._rescheduleQueue.push(...conflictingEntries);
                      }
                      break;
                    } else {
                      // Restore conflicting entries since we couldn't schedule the lab block
                      for (const restoreEntry of conflictingEntries) {
                        entries.push(restoreEntry);
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
        if (labBlocksScheduled < labSessionsPerWeek) {
          console.warn(`Could not schedule all LAB blocks for subject ${subject.name} in batch ${batch.name}. Scheduled ${labBlocksScheduled}/${labSessionsPerWeek} blocks.`);
        }
      }
    }
    
    // Summary after lab scheduling
    console.log('=== LAB SCHEDULING COMPLETE ===');
    const labEntries = entries.filter(e => e.subject.type === 'Lab');
    console.log(`Total lab entries scheduled: ${labEntries.length}`);
    labEntries.forEach(entry => {
      console.log(`  ${entry.subject.code} (${entry.batch.name}): ${entry.timeSlot.day} P${entry.timeSlot.period}`);
    });
    console.log('==============================');
    
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
        if (!subject) {
          console.warn(`❌ Subject with ID ${subjectId} not found in subjects list`);
          continue;
        }
        if (subject.type === 'Lab') {
          console.log(`⏭️  Skipping ${subject.code} in theory section - it's a lab subject (already processed in lab section)`);
          continue;
        }
        
        console.log(`📝 Attempting to schedule THEORY subject ${subject.code} (${subject.name}) - ${subject.sessionsPerWeek} sessions, continuousHours: ${subject.continuousHours || 1}`);
        
        if (subject.code === 'U24ED311') {
          console.log(`🎯 SPECIAL TRACKING: EDI subject detected - requires ${subject.continuousHours} continuous hours`);
        }
        
        let eligibleFaculty = variation.facultyOrder.filter(f => f.eligibleSubjects.includes(subjectId));
        
        // Add randomization to faculty selection order for variety
        if (variation.randomizeSlotSelection && eligibleFaculty.length > 1) {
          eligibleFaculty = this.shuffleArraySeeded(eligibleFaculty, variation.seededRandom);
        }
        
        console.log(`📋 Subject matching for ${subject.code} (ID: ${subjectId}):`);
        console.log(`   Available faculty: ${variation.facultyOrder.map(f => f.name).join(', ')}`);
        console.log(`   Faculty eligible subjects:`, variation.facultyOrder.map(f => `${f.name}: [${f.eligibleSubjects.join(', ')}]`).join(' | '));
        console.log(`   Matching faculty: ${eligibleFaculty.map(f => f.name).join(', ')}`);
        
        if (eligibleFaculty.length === 0) {
          console.error(`❌ No eligible faculty found for subject ${subject.code} (ID: ${subjectId})!`);
          console.error(`   💡 Check that faculty have been assigned to teach subject ID '${subjectId}' in their eligible subjects list.`);
          continue;
        }
        
        let suitableRooms = variation.roomOrder.filter(r => r.capacity >= batch.size);
        
        // Add additional room randomization for variety  
        if (variation.randomizeSlotSelection && suitableRooms.length > 1) {
          suitableRooms = this.shuffleArraySeeded(suitableRooms, variation.seededRandom);
        }
        
        let totalSessionsScheduled = 0;
        
        // Verify this subject hasn't been processed already (preventing duplicates)
        const alreadyProcessedEntries = entries.filter(e => 
          e.batch.id === batch.id && e.subject.id === subject.id
        );
        
        if (alreadyProcessedEntries.length > 0) {
          console.warn(`⚠️  Subject ${subject.code} for batch ${batch.name} already has ${alreadyProcessedEntries.length} entries scheduled. Skipping duplicate processing.`);
          continue;
        }
        
        console.log(`📝 Scheduling ${subject.code} for ${batch.name}: ${subject.sessionsPerWeek} sessions of ${subject.continuousHours || 1} hours each`);
        
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
          // Use availableTimeSlots to respect pattern avoidance
          const shuffledTimeSlots = this.shuffleArraySeeded([...availableTimeSlots], variation.seededRandom);
          
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
          
          // Sort preferred slots first, then non-preferred with randomization option
          let orderedPreferred = variation.prioritizeEarlierSlots 
            ? timeSlotsByPreference.preferred.sort((a, b) => a.period - b.period)
            : timeSlotsByPreference.preferred.sort((a, b) => b.period - a.period);
            
          let orderedNonPreferred = variation.prioritizeEarlierSlots 
            ? timeSlotsByPreference.nonPreferred.sort((a, b) => a.period - b.period)
            : timeSlotsByPreference.nonPreferred.sort((a, b) => b.period - a.period);
          
          // Add randomization to slot ordering for variety
          if (variation.randomizeSlotSelection) {
            if (variation.preferredTimeVariation >= 1 && orderedPreferred.length > 1) {
              orderedPreferred = this.shuffleArraySeeded(orderedPreferred, variation.seededRandom);
            }
            if (variation.preferredTimeVariation >= 2 && orderedNonPreferred.length > 1) {
              orderedNonPreferred = this.shuffleArraySeeded(orderedNonPreferred, variation.seededRandom);
            }
          }
          
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
              // Relaxed faculty constraints to allow full scheduling
              const effectiveMaxDailyHours = Math.max(faculty.preferences.maxDailyHours, 6); // Allow at least 6 hours per day
              const effectiveMaxWeeklyLoad = Math.max(faculty.maxWeeklyLoad, 30); // Allow at least 30 hours per week
              
              if (
                subject.type === 'Theory' &&
                (theorySessionsScheduledToday >= effectiveMaxDailyHours ||
                theorySessionsScheduledThisWeek >= effectiveMaxWeeklyLoad)
              ) {
                if (subject.id === 'U24MA302' && timeSlot.day === 'Friday') {
                  console.log(`Faculty ${faculty.name} unavailable: dailyHours=${theorySessionsScheduledToday}/${effectiveMaxDailyHours}, weeklyHours=${theorySessionsScheduledThisWeek}/${effectiveMaxWeeklyLoad}`);
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

    // Final scheduling summary with detailed breakdown
    console.log('=== DETAILED TIMETABLE GENERATION SUMMARY ===');
    console.log(`Total entries scheduled: ${entries.length}`);
    
    // Group entries by subject and batch for detailed analysis
    const entryGroups = {};
    entries.forEach(entry => {
      const key = `${entry.subject.code}-${entry.batch.name}`;
      if (!entryGroups[key]) {
        entryGroups[key] = {
          subject: entry.subject,
          batch: entry.batch,
          entries: []
        };
      }
      entryGroups[key].entries.push(entry);
    });
    
    console.log('\n📊 SCHEDULED SUBJECTS BREAKDOWN:');
    Object.values(entryGroups).forEach((group: any) => {
      const { subject, batch, entries: groupEntries } = group;
      const timeSlots = groupEntries.map(e => `${e.timeSlot.day} P${e.timeSlot.period}`).join(', ');
      console.log(`  ${subject.code} (${subject.type}) for ${batch.name}:`);
      console.log(`    📅 Scheduled: ${groupEntries.length} periods (${timeSlots})`);
      console.log(`    🎯 Expected: ${subject.sessionsPerWeek} sessions × ${subject.continuousHours || 1} hours = ${subject.sessionsPerWeek * (subject.continuousHours || 1)} periods`);
      
      // Check if lab sessions are continuous
      if (subject.type === 'Lab' && groupEntries.length > 1) {
        const sortedEntries = groupEntries.sort((a, b) => {
          if (a.timeSlot.day !== b.timeSlot.day) return 0;
          return a.timeSlot.period - b.timeSlot.period;
        });
        let isContinuous = true;
        for (let i = 1; i < sortedEntries.length; i++) {
          if (sortedEntries[i].timeSlot.day === sortedEntries[i-1].timeSlot.day) {
            if (sortedEntries[i].timeSlot.period !== sortedEntries[i-1].timeSlot.period + 1) {
              isContinuous = false;
              break;
            }
          }
        }
        console.log(`    🧪 Lab continuity: ${isContinuous ? '✅ CONTINUOUS' : '❌ SPLIT'}`);
      }
    });
    
    // Check which subjects were scheduled
    const scheduledSubjects = [...new Set(entries.map(e => e.subject.code))];
    const allRequiredSubjects = [...new Set(this.batches.flatMap(b => 
      b.mandatorySubjects && b.mandatorySubjects.length > 0 ? b.mandatorySubjects : this.subjects.map(s => s.id)
    ))];
    
    console.log(`\n📋 Scheduled subjects: ${scheduledSubjects.join(', ')}`);
    console.log(`📋 Required subjects: ${allRequiredSubjects.join(', ')}`);
    
    const missingSubjects = allRequiredSubjects.filter(s => !scheduledSubjects.includes(s));
    if (missingSubjects.length > 0) {
      console.error(`❌ MISSING SUBJECTS: ${missingSubjects.join(', ')}`);
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
    
    // Calculate final expected vs scheduled comparison
    let finalExpectedClasses = 0;
    this.batches.forEach(batch => {
      const batchSubjects = batch.mandatorySubjects && batch.mandatorySubjects.length > 0 
        ? batch.mandatorySubjects.map(id => this.subjects.find(s => s.id === id)).filter(Boolean)
        : this.subjects;
      
      batchSubjects.forEach(subject => {
        finalExpectedClasses += subject.sessionsPerWeek;
      });
    });

    // Final scheduling summary
    console.log(`\n🎯🎯🎯 FINAL SCHEDULING RESULTS 🎯🎯🎯:`);
    console.log(`   Expected classes: ${finalExpectedClasses}`);
    console.log(`   Scheduled classes: ${entries.length}`);
    console.log(`   Success rate: ${((entries.length / finalExpectedClasses) * 100).toFixed(1)}%`);
    
    if (entries.length < finalExpectedClasses) {
      console.error(`❌ MISSING ${finalExpectedClasses - entries.length} CLASSES!`);
      console.error(`💡 Possible reasons: Faculty conflicts, Room conflicts, Time slot limitations, Subject-Faculty mismatches`);
      
      // Analyze what's missing
      const scheduledBySubject = new Map();
      entries.forEach(e => {
        const key = `${e.batch.id}-${e.subject.id}`;
        scheduledBySubject.set(key, (scheduledBySubject.get(key) || 0) + 1);
      });
      
      console.error(`📊 DETAILED ANALYSIS:`);
      this.batches.forEach(batch => {
        const batchSubjects = batch.mandatorySubjects && batch.mandatorySubjects.length > 0
          ? batch.mandatorySubjects.map(id => this.subjects.find(s => s.id === id)).filter(Boolean)
          : this.subjects;
        
        batchSubjects.forEach(subject => {
          const key = `${batch.id}-${subject.id}`;
          const scheduled = scheduledBySubject.get(key) || 0;
          const expected = subject.sessionsPerWeek;
          if (scheduled < expected) {
            console.error(`   ${batch.name} - ${subject.code}: ${scheduled}/${expected} (missing ${expected - scheduled})`);
          }
        });
      });
    }
    
    console.log('🎯🎯🎯 END SUMMARY 🎯🎯🎯');

    // Ensure unique id for each timetable
    const uniqueSuffix = Math.random().toString(36).substring(2, 10);
    return {
      id: `timetable-${Date.now()}-${uniqueSuffix}`,
      name: `Generated Timetable ${new Date().toLocaleDateString()}`,
      entries,
      conflicts,
      score: this.calculateScore(entries),
      generatedAt: new Date().toISOString(),
      status: 'Draft',
      batchIds: this.batches.map(b => b.id)
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

  // Multi-class generation with staff conflict prevention
  public generateMultiClassTimetable(batchIds: string[], settings: OptimizationSettings, savedTimetables: GeneratedTimetable[] = []): GeneratedTimetable {
    const originalBatches = [...this.batches];
    
    // Filter batches to only include requested ones
    this.batches = this.batches.filter(batch => batchIds.includes(batch.id));
    
    if (this.batches.length === 0) {
      throw new Error('No valid batches found for the provided batch IDs');
    }

    // Create pre-occupied slots from saved timetables to prevent staff conflicts
    // EXCLUDE timetables for the same batches being regenerated
    const preOccupiedSlots = this.extractPreOccupiedSlots(savedTimetables, batchIds);
    
    console.log(`Generating timetable for ${this.batches.length} batches with ${preOccupiedSlots.length} pre-occupied slots`);
    
    // Generate timetable with conflict prevention
    const result = this.generateTimetableWithConflictPrevention(settings, preOccupiedSlots);
    
    // Add batch IDs to the result
    result.batchIds = batchIds;
    
    // Restore original batches
    this.batches = originalBatches;
    
    return result;
  }

  private extractPreOccupiedSlots(savedTimetables: GeneratedTimetable[], currentBatchIds?: string[]): TimetableEntry[] {
    const preOccupied: TimetableEntry[] = [];
    
    for (const timetable of savedTimetables) {
      // SKIP timetables that contain any of the batches currently being regenerated
      if (currentBatchIds && timetable.batchIds) {
        const hasOverlappingBatches = timetable.batchIds.some(batchId => currentBatchIds.includes(batchId));
        if (hasOverlappingBatches) {
          console.log(`⏭️ SKIPPING saved timetable "${timetable.name}" - contains batch being regenerated (${timetable.batchIds.join(', ')})`);
          continue;
        }
      }
      
      // Block slots from timetables for different classes only
      preOccupied.push(...timetable.entries);
      console.log(`📋 Blocking ${timetable.entries.length} slots from saved timetable: ${timetable.name} (batches: ${timetable.batchIds?.join(', ') || 'unknown'})`);
    }
    
    console.log(`🚫 Total ${preOccupied.length} pre-occupied slots from ${savedTimetables.length} saved timetables will be blocked for new generation`);
    console.log(`✅ Same-class exclusion: ${currentBatchIds?.length || 0} batch(es) being regenerated will NOT be blocked`);
    return preOccupied;
  }

  private generateTimetableWithConflictPrevention(settings: OptimizationSettings, preOccupiedSlots: TimetableEntry[]): GeneratedTimetable {
    // Calculate expected total classes for these batches
    let expectedClasses = 0;
    this.batches.forEach(batch => {
      const batchSubjects = batch.mandatorySubjects && batch.mandatorySubjects.length > 0 
        ? batch.mandatorySubjects.map(id => this.subjects.find(s => s.id === id)).filter(Boolean)
        : this.subjects;
      
      console.log(`🎯 Batch ${batch.name} subjects: ${batchSubjects.map(s => s.code).join(', ')}`);
      batchSubjects.forEach(subject => {
        console.log(`   ${subject.code}: ${subject.sessionsPerWeek} sessions/week`);
        expectedClasses += subject.sessionsPerWeek;
      });
    });
    console.log(`📈 Expected total classes for selected batches: ${expectedClasses}`);
    
    // Check if faculty constraints need relaxation
    const totalFacultyDailyCapacity = this.faculty.reduce((total, f) => total + (f.preferences.maxDailyHours * 5), 0);
    const avgClassesPerDay = expectedClasses / 5;
    console.log(`🏫 Faculty daily capacity analysis:`);
    console.log(`   Total faculty daily capacity: ${totalFacultyDailyCapacity} hours/week`);
    console.log(`   Required avg classes per day: ${avgClassesPerDay.toFixed(1)}`);
    if (avgClassesPerDay > 4) {
      console.log(`⚠️  CONSTRAINT RELAXATION ACTIVE: Faculty constraints relaxed to ensure full scheduling`);
    }

    // Retry mechanism to ensure we get all expected classes
    const maxAttempts = 10;
    const targetClassCount = expectedClasses;
    const minAcceptableCount = Math.floor(expectedClasses * 0.85); // Accept 85% as minimum
    let bestResult: { entries: TimetableEntry[], conflicts: Conflict[], score: number } | null = null;
    
    console.log(`🎯 TARGET: ${targetClassCount} classes (minimum acceptable: ${minAcceptableCount})`);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`\n🔄 ATTEMPT ${attempt}/${maxAttempts} - Trying to schedule ${targetClassCount} classes...`);
      
      const entries: TimetableEntry[] = [];
      const conflicts: Conflict[] = [];
      const timeSlots = this.generateTimeSlots();

      // Add variation based on settings and attempt number
      const seedValue = settings.maxIterations + settings.timeLimit + 
        Object.values(settings.priorityWeights).reduce((sum, weight) => sum + weight * 1000, 0) + 
        (attempt * 12345); // Different seed per attempt
      
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
        startPeriodOffset: Math.floor(seededRandom() * 3) + 1,
        prioritizeEarlierSlots: seededRandom() > 0.5,
        seededRandom: seededRandom
      };

      // Schedule with conflict prevention
      this.scheduleWithStaffConflictPrevention(entries, conflicts, timeSlots, variation, preOccupiedSlots, settings);
      
      const score = this.calculateScore(entries);
      console.log(`📊 Attempt ${attempt} result: ${entries.length}/${targetClassCount} classes (${((entries.length/targetClassCount)*100).toFixed(1)}%)`);
      
        // Show detailed analysis for each attempt to identify bottlenecks
        if (entries.length < targetClassCount) {
          console.log(`\n🔍 DETAILED ANALYSIS FOR ATTEMPT ${attempt}:`);
          
          // Analyze what's missing
          const scheduledBySubject = new Map();
          const scheduledByType = { Theory: 0, Lab: 0 };
          
          entries.forEach(e => {
            const key = `${e.batch.id}-${e.subject.id}`;
            scheduledBySubject.set(key, (scheduledBySubject.get(key) || 0) + 1);
            scheduledByType[e.subject.type] = (scheduledByType[e.subject.type] || 0) + 1;
          });
          
          console.log(`📊 Current scheduling: ${scheduledByType.Theory} Theory + ${scheduledByType.Lab} Lab = ${entries.length} total`);
          
          this.batches.forEach(batch => {
            const batchSubjects = batch.mandatorySubjects && batch.mandatorySubjects.length > 0
              ? batch.mandatorySubjects.map(id => this.subjects.find(s => s.id === id)).filter(Boolean)
              : this.subjects;
            
            console.log(`\n📚 ${batch.name} analysis:`);
            let missingLabs = 0, missingTheory = 0;
            
            batchSubjects.forEach(subject => {
              const key = `${batch.id}-${subject.id}`;
              const scheduled = scheduledBySubject.get(key) || 0;
              const expected = subject.sessionsPerWeek;
              const missing = expected - scheduled;
              const status = scheduled >= expected ? '✅' : `❌ (missing ${missing})`;
              
              if (missing > 0) {
                if (subject.type === 'Lab') missingLabs += missing;
                else missingTheory += missing;
              }
              
              console.log(`   ${subject.code} (${subject.type}): ${scheduled}/${expected} ${status}`);
            });
            
            if (missingLabs > 0 || missingTheory > 0) {
              console.log(`   📉 Missing: ${missingTheory} Theory + ${missingLabs} Lab sessions`);
            }
          });
        }      // Check if this is our best result so far
      if (!bestResult || entries.length > bestResult.entries.length || 
          (entries.length === bestResult.entries.length && score > bestResult.score)) {
        bestResult = { entries: [...entries], conflicts: [...conflicts], score };
        console.log(`✨ New best result: ${entries.length} classes!`);
      }
      
      // If we achieved the target, use this result
      if (entries.length >= targetClassCount) {
        console.log(`🎉 SUCCESS! Achieved target ${targetClassCount} classes on attempt ${attempt}`);
        bestResult = { entries, conflicts, score };
        break;
      }
      
      // If we got close enough and this is a later attempt, consider accepting
      if (attempt >= 5 && entries.length >= minAcceptableCount) {
        console.log(`✅ ACCEPTABLE! Got ${entries.length}/${targetClassCount} classes (${((entries.length/targetClassCount)*100).toFixed(1)}%) on attempt ${attempt}`);
        if (!bestResult || entries.length > bestResult.entries.length) {
          bestResult = { entries, conflicts, score };
        }
      }
    }

    // Use the best result we found
    const finalEntries = bestResult?.entries || [];
    const finalConflicts = bestResult?.conflicts || [];

    console.log(`\n🏆 FINAL RESULT: Using best attempt with ${finalEntries.length}/${targetClassCount} classes`);

    const uniqueSuffix = Math.random().toString(36).substring(2, 10);
    return {
      id: `multi-timetable-${Date.now()}-${uniqueSuffix}`,
      name: `Multi-Class Timetable ${new Date().toLocaleDateString()}`,
      entries: finalEntries,
      conflicts: finalConflicts,
      score: bestResult?.score || 0,
      generatedAt: new Date().toISOString(),
      status: 'Draft',
      batchIds: this.batches.map(b => b.id)
    };
  }

  private scheduleWithStaffConflictPrevention(
    entries: TimetableEntry[], 
    conflicts: Conflict[], 
    timeSlots: TimeSlot[], 
    variation: any, 
    preOccupiedSlots: TimetableEntry[],
    settings: OptimizationSettings
  ) {
    // Helper function to check if a faculty/room/time slot is occupied by saved timetables
    const isSlotOccupied = (facultyId: string, roomId: string, day: string, period: number): boolean => {
      const conflict = preOccupiedSlots.find(slot => 
        (slot.faculty.id === facultyId || slot.room.id === roomId) &&
        slot.timeSlot.day === day && 
        slot.timeSlot.period === period
      );
      
      if (conflict) {
        console.log(`🚫 Conflict detected: ${day} P${period} - Faculty: ${facultyId === conflict.faculty.id ? 'OCCUPIED by ' + conflict.faculty.name : 'Free'}, Room: ${roomId === conflict.room.id ? 'OCCUPIED by ' + conflict.subject.code : 'Free'}`);
        return true;
      }
      
      return false;
    };

    // Use the same scheduling logic as the original method but with conflict prevention
    this.subjects.forEach(subject => {
      if (subject.type !== 'Lab') {
        if (!subject.continuousHours || subject.continuousHours <= 1) {
          subject.sessionsPerWeek = subject.weeklyHours;
        }
      }
    });

    // Schedule labs first (same as original but with conflict prevention)
    const labSubjectStartPeriods = new Map<string, number>();
    let globalLabStartPeriod = variation.startPeriodOffset;
    
    for (const batch of variation.batchOrder) {
      const subjectIds = batch.mandatorySubjects && batch.mandatorySubjects.length > 0
        ? batch.mandatorySubjects
        : variation.subjectOrder.map(s => s.id);
        
      for (const subjectId of subjectIds) {
        const subject = this.subjects.find(s => s.id === subjectId);
        if (!subject || subject.type !== 'Lab') continue;
        
        const alreadyScheduledLabBlocks = entries.filter(e =>
          e.batch.id === batch.id &&
          e.subject.id === subjectId &&
          e.subject.type === 'Lab'
        ).length;
        
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
        
        // Schedule lab with conflict prevention
        this.scheduleLabWithConflictPrevention(
          entries, conflicts, batch, subject, timeSlots, variation, 
          isSlotOccupied, labSubjectStartPeriods, globalLabStartPeriod
        );
      }
    }

    // Schedule theory subjects with conflict prevention
    for (const batch of variation.batchOrder) {
      const subjectIds = batch.mandatorySubjects && batch.mandatorySubjects.length > 0
        ? batch.mandatorySubjects
        : variation.subjectOrder.map(s => s.id);
      
      const sortedSubjectIds = subjectIds.sort((a, b) => {
        const subjectA = this.subjects.find(s => s.id === a);
        const subjectB = this.subjects.find(s => s.id === b);
        
        if (!subjectA || !subjectB) return 0;
        if (subjectA.type === 'Lab' && subjectB.type !== 'Lab') return 1;
        if (subjectA.type !== 'Lab' && subjectB.type === 'Lab') return -1;
        
        const continuousA = (subjectA.continuousHours || 1) > 1;
        const continuousB = (subjectB.continuousHours || 1) > 1;
        
        if (continuousA && !continuousB) return -1;
        if (!continuousA && continuousB) return 1;
        
        return 0;
      });
      
      for (const subjectId of sortedSubjectIds) {
        const subject = this.subjects.find(s => s.id === subjectId);
        if (!subject || subject.type === 'Lab') continue;
        
        this.scheduleTheorySubjectWithConflictPrevention(
          entries, conflicts, batch, subject, timeSlots, variation, isSlotOccupied
        );
      }
    }
  }

  private scheduleLabWithConflictPrevention(
    entries: TimetableEntry[],
    conflicts: Conflict[],
    batch: StudentBatch,
    subject: Subject,
    timeSlots: TimeSlot[],
    variation: any,
    isSlotOccupied: (facultyId: string, roomId: string, day: string, period: number) => boolean,
    labSubjectStartPeriods: Map<string, number>,
    globalLabStartPeriod: number
  ) {
    if (!labSubjectStartPeriods.has(subject.id)) {
      labSubjectStartPeriods.set(subject.id, globalLabStartPeriod);
    }
    
    const eligibleFaculty = variation.facultyOrder.filter(f => f.eligibleSubjects.includes(subject.id));
    const suitableRooms = variation.roomOrder.filter(r => r.capacity >= batch.size);
    let labBlocksScheduled = 0;

    for (const day of variation.workingDaysOrder) {
      if (labBlocksScheduled >= subject.sessionsPerWeek) break;
      
      const batchHasLabForSubjectOnDay = entries.some(e =>
        e.batch.id === batch.id &&
        e.timeSlot.day === day &&
        e.subject.type === 'Lab' &&
        e.subject.id === subject.id
      );
      if (batchHasLabForSubjectOnDay) continue;
      
      // Relaxed constraint: Allow multiple labs per day if needed
      const batchLabsOnDay = entries.filter(e =>
        e.batch.id === batch.id &&
        e.timeSlot.day === day &&
        e.subject.type === 'Lab'
      ).length;
      
      const maxLabsPerDay = 2; // Allow up to 2 labs per day
      if (batchLabsOnDay >= maxLabsPerDay) {
        console.log(`⏭️ Lab scheduling: Skipping ${day} for ${subject.code}: already has ${batchLabsOnDay} labs`);
        continue;
      }

      let scheduled = false;
      for (const faculty of eligibleFaculty) {
        for (const room of suitableRooms) {
          // Check if we can schedule this lab block without conflicts with saved timetables
          let canScheduleBlock = true;
          const candidateSlots = [];
          
          for (let period = 1; period <= this.institution.periodsPerDay - subject.weeklyHours + 1; period++) {
            if (isSlotOccupied(faculty.id, room.id, day, period)) {
              continue; // Skip this starting period due to conflict
            }
            
            // Check if entire block is free from conflicts
            let blockFree = true;
            const blockSlots = [];
            for (let j = 0; j < subject.weeklyHours; j++) {
              if (isSlotOccupied(faculty.id, room.id, day, period + j)) {
                blockFree = false;
                break;
              }
              const timeSlot = timeSlots.find(ts => ts.day === day && ts.period === period + j);
              if (timeSlot) {
                blockSlots.push(timeSlot);
              }
            }
            
            if (blockFree && blockSlots.length === subject.weeklyHours) {
              candidateSlots.push(...blockSlots);
              break;
            }
          }
          
          if (candidateSlots.length === subject.weeklyHours) {
            // Schedule the lab block
            for (const timeSlot of candidateSlots) {
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
                canScheduleBlock = false;
                break;
              }
            }
            
            if (canScheduleBlock) {
              scheduled = true;
              labBlocksScheduled++;
              break;
            }
          }
        }
        if (scheduled) break;
      }
      if (scheduled) break;
    }
  }

  private scheduleTheorySubjectWithConflictPrevention(
    entries: TimetableEntry[],
    conflicts: Conflict[],
    batch: StudentBatch,
    subject: Subject,
    timeSlots: TimeSlot[],
    variation: any,
    isSlotOccupied: (facultyId: string, roomId: string, day: string, period: number) => boolean
  ) {
    const eligibleFaculty = variation.facultyOrder.filter(f => f.eligibleSubjects.includes(subject.id));
    const suitableRooms = variation.roomOrder.filter(r => r.capacity >= batch.size);
    let totalSessionsScheduled = 0;
    
    for (let session = 0; session < subject.sessionsPerWeek; session++) {
      let scheduled = false;
      
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
        
      for (const day of availableDays) {
        for (const faculty of eligibleFaculty) {
          for (const room of suitableRooms) {
            for (let period = 1; period <= this.institution.periodsPerDay; period++) {
              // Check conflict with saved timetables
              if (isSlotOccupied(faculty.id, room.id, day, period)) {
                continue;
              }
              
              const timeSlot = timeSlots.find(ts => ts.day === day && ts.period === period);
              if (!timeSlot) continue;
              
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
                totalSessionsScheduled++;
                scheduled = true;
                break;
              } else {
                conflicts.push(...entryConflicts);
              }
            }
            if (scheduled) break;
          }
          if (scheduled) break;
        }
        if (scheduled) break;
      }
      if (scheduled) break;
    }
  }

  // Save timetable functionality
  public static saveTimetable(timetable: GeneratedTimetable): void {
    const savedTimetables = TimetableEngine.getSavedTimetables();
    
    // Mark as saved
    timetable.isSaved = true;
    timetable.status = 'Approved';
    
    // Remove any existing timetables for the same batches (replace, don't accumulate)
    if (timetable.batchIds && timetable.batchIds.length > 0) {
      const removedTimetables = [];
      for (let i = savedTimetables.length - 1; i >= 0; i--) {
        const savedTimetable = savedTimetables[i];
        if (savedTimetable.batchIds && savedTimetable.id !== timetable.id) {
          // Check if there's any overlap in batch IDs
          const hasOverlap = savedTimetable.batchIds.some(batchId => timetable.batchIds!.includes(batchId));
          if (hasOverlap) {
            removedTimetables.push(savedTimetables.splice(i, 1)[0]);
          }
        }
      }
      
      if (removedTimetables.length > 0) {
        console.log(`🔄 Replaced ${removedTimetables.length} existing timetable(s) for the same batch(es): ${removedTimetables.map(t => t.name).join(', ')}`);
      }
    }
    
    // Check for exact duplicate by ID
    const existingIndex = savedTimetables.findIndex(t => t.id === timetable.id);
    if (existingIndex >= 0) {
      savedTimetables[existingIndex] = timetable;
    } else {
      savedTimetables.push(timetable);
    }
    
    const registry: SavedTimetableRegistry = {
      savedTimetables,
      lastUpdated: new Date().toISOString()
    };
    
    localStorage.setItem('savedTimetables', JSON.stringify(registry));
    console.log(`Saved timetable: ${timetable.name} for batches: ${timetable.batchIds?.join(', ') || 'Unknown'}`);
  }

  public static getSavedTimetables(): GeneratedTimetable[] {
    try {
      const saved = localStorage.getItem('savedTimetables');
      if (saved) {
        const registry: SavedTimetableRegistry = JSON.parse(saved);
        return registry.savedTimetables || [];
      }
    } catch (error) {
      console.error('Error loading saved timetables:', error);
    }
    return [];
  }

  public static removeSavedTimetable(timetableId: string): void {
    const savedTimetables = TimetableEngine.getSavedTimetables();
    const filtered = savedTimetables.filter(t => t.id !== timetableId);
    
    const registry: SavedTimetableRegistry = {
      savedTimetables: filtered,
      lastUpdated: new Date().toISOString()
    };
    
    localStorage.setItem('savedTimetables', JSON.stringify(registry));
    console.log(`Removed saved timetable: ${timetableId}`);
  }
}