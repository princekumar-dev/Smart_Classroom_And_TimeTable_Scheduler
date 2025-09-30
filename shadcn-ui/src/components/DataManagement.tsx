import { useState, useEffect, useCallback, memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import { useForm } from 'react-hook-form';
import { Users, BookOpen, MapPin, GraduationCap, Plus, Save, CheckCircle, Edit, Trash2, AlertCircle } from 'lucide-react';
import { Subject, Faculty, Room, StudentBatch, Institution } from '@/types/timetable';

interface DataManagementProps {
  onComplete: () => void;
}

export default function DataManagement({ onComplete }: DataManagementProps) {
  // Helper function to generate subject ID based on code and type
  const generateSubjectId = (code: string, type: string): string => {
    if (!code) return '';
    return type === 'Theory' ? code : `${code}-${type}`;
  };

  // State management
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [batches, setBatches] = useState<StudentBatch[]>([]);
  const [saved, setSaved] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  
  // Modal states
  const [isSubjectDialogOpen, setIsSubjectDialogOpen] = useState(false);
  const [isFacultyDialogOpen, setIsFacultyDialogOpen] = useState(false);
  const [isRoomDialogOpen, setIsRoomDialogOpen] = useState(false);
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Real-time auto-save function
  const autoSaveData = useCallback(() => {
    if (autoSave && subjects.length > 0) {
      localStorage.setItem('subjects', JSON.stringify(subjects));
      localStorage.setItem('faculty', JSON.stringify(faculty));
      localStorage.setItem('rooms', JSON.stringify(rooms));
      localStorage.setItem('batches', JSON.stringify(batches));
      
      // Clear stored timetables when data changes so new ones get generated with updated parameters
      localStorage.removeItem('generatedTimetables');
      
      // Dispatch custom event for real-time updates
      window.dispatchEvent(new CustomEvent('dataUpdated', {
        detail: { subjects, faculty, rooms, batches }
      }));
    }
  }, [subjects, faculty, rooms, batches, autoSave]);

  // Auto-save whenever data changes
  useEffect(() => {
    const timeoutId = setTimeout(autoSaveData, 500); // Debounce auto-save
    return () => clearTimeout(timeoutId);
  }, [autoSaveData]);

  // Helper function to migrate faculty eligibleSubjects from codes to IDs
  const migrateFacultyEligibleSubjects = (faculty: Faculty[], subjects: Subject[]): Faculty[] => {
    return faculty.map(f => {
      // If eligibleSubjects contains subject IDs (contains hyphens for lab subjects), no migration needed
      const hasSubjectIds = f.eligibleSubjects.some(id => subjects.find(s => s.id === id));
      if (hasSubjectIds) return f;
      
      // Migrate from codes to IDs
      const migratedEligibleSubjects = f.eligibleSubjects
        .flatMap(code => {
          // Find all subjects with this code (both theory and lab variants)
          return subjects.filter(s => s.code === code).map(s => s.id);
        })
        .filter(id => id); // Remove any undefined values
      
      return {
        ...f,
        eligibleSubjects: migratedEligibleSubjects
      };
    });
  };

  // Load saved data and setup from localStorage on mount
  useEffect(() => {
    const savedSubjects = localStorage.getItem('subjects');
    const savedFaculty = localStorage.getItem('faculty');
    const savedRooms = localStorage.getItem('rooms');
    const savedBatches = localStorage.getItem('batches');
    
    let loadedSubjects: Subject[] = [];
    let loadedFaculty: Faculty[] = [];
    
    if (savedSubjects) {
      loadedSubjects = JSON.parse(savedSubjects);
      setSubjects(loadedSubjects);
    }
    
    if (savedFaculty) {
      const rawFaculty = JSON.parse(savedFaculty);
      // Migrate faculty eligibleSubjects if needed
      loadedFaculty = migrateFacultyEligibleSubjects(rawFaculty, loadedSubjects);
      setFaculty(loadedFaculty);
      
      // If migration occurred, save the updated faculty data
      if (JSON.stringify(rawFaculty) !== JSON.stringify(loadedFaculty)) {
        localStorage.setItem('faculty', JSON.stringify(loadedFaculty));
        console.log('✅ Faculty eligible subjects migrated from codes to IDs');
      }
    }
    
    if (savedRooms) setRooms(JSON.parse(savedRooms));
    if (savedBatches) setBatches(JSON.parse(savedBatches));
    
    const savedInstitution = localStorage.getItem('institution');
    if (savedInstitution) {
      // setInstitution(JSON.parse(savedInstitution)); // Uncomment if you have institution state
    }
  }, []);

  // Auto-assign all available subjects to all batches whenever subjects change
  useEffect(() => {
    if (subjects.length > 0) {
      setBatches(prevBatches => 
        prevBatches.map(batch => ({
          ...batch,
          subjectIds: subjects.map(subject => subject.id)
        }))
      );
    }
  }, [subjects]);

  // Update faculty eligible subjects when subjects change (to handle ID updates)
  useEffect(() => {
    if (subjects.length > 0 && faculty.length > 0) {
      const updatedFaculty = migrateFacultyEligibleSubjects(faculty, subjects);
      if (JSON.stringify(faculty) !== JSON.stringify(updatedFaculty)) {
        setFaculty(updatedFaculty);
        console.log('✅ Faculty eligible subjects synchronized with subject changes');
      }
    }
  }, [subjects]);

  // Optimized click handlers - immediate state updates
  const openSubjectModal = useCallback(() => {
    setEditingItem(null);
    setIsSubjectDialogOpen(true);
  }, []);

  const openFacultyModal = useCallback(() => {
    setEditingItem(null);
    setIsFacultyDialogOpen(true);
  }, []);

  const openRoomModal = useCallback(() => {
    setEditingItem(null);
    setIsRoomDialogOpen(true);
  }, []);

  const openBatchModal = useCallback(() => {
    setEditingItem(null);
    setIsBatchDialogOpen(true);
  }, []);

  // Validation functions
  const validateSubject = (subject: Subject): string[] => {
    const errors: string[] = [];
    if (!subject.name.trim()) errors.push('Subject name is required');
    if (!subject.code.trim()) errors.push('Subject code is required');
    if (subject.credits <= 0) errors.push('Credits must be greater than 0');
    if (subject.weeklyHours <= 0) errors.push('Weekly hours must be greater than 0');
    if (subject.sessionsPerWeek <= 0) errors.push('Sessions per week must be greater than 0');
    if (subject.sessionDuration <= 0) errors.push('Session duration must be greater than 0');
    if (subject.continuousHours <= 0) errors.push('Continuous hours must be greater than 0');
    
    // Logic validation
    if (subject.continuousHours > subject.weeklyHours) {
      errors.push('Continuous hours cannot exceed weekly hours');
    }
    
    // Scheduling logic validation
    const expectedDurationPerSession = (subject.weeklyHours / subject.sessionsPerWeek) * 60;
    if (Math.abs(subject.sessionDuration - expectedDurationPerSession) > 10) {
      errors.push(`Session duration (${subject.sessionDuration}min) doesn't match expected duration (${expectedDurationPerSession}min) for ${subject.weeklyHours} hours in ${subject.sessionsPerWeek} session(s)`);
    }
    
    return errors;
  };

  const validateFaculty = (faculty: Faculty): string[] => {
    const errors: string[] = [];
    if (!faculty.name.trim()) errors.push('Faculty name is required');
    if (!faculty.id.trim()) errors.push('Faculty ID is required');
    if (faculty.maxWeeklyLoad <= 0) errors.push('Max weekly load must be greater than 0');
    if (faculty.preferences.maxDailyHours <= 0) errors.push('Max daily hours must be greater than 0');
    return errors;
  };

  const validateRoom = (room: Room): string[] => {
    const errors: string[] = [];
    if (!room.name.trim()) errors.push('Room name is required');
    if (!room.type.trim()) errors.push('Room type is required');
    if (room.capacity <= 0) errors.push('Room capacity must be greater than 0');
    if (!room.location.trim()) errors.push('Room location is required');
    return errors;
  };

  const validateBatch = (batch: StudentBatch): string[] => {
    const errors: string[] = [];
    if (!batch.name.trim()) errors.push('Batch name is required');
    if (!batch.department.trim()) errors.push('Department is required');
    if (batch.year <= 0) errors.push('Year must be greater than 0');
    if (batch.size <= 0) errors.push('Batch size must be greater than 0');
    return errors;
  };

  // Get real-time institution configuration
  const getInstitutionConfig = () => {
    const savedInstitution = localStorage.getItem('institution');
    return savedInstitution ? JSON.parse(savedInstitution) : {
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      periodsPerDay: 8,
      periodTimings: Array.from({length: 8}, (_, i) => ({
        period: i + 1,
        startTime: `${8 + i}:30`,
        endTime: `${9 + i}:20`
      })),
      breaks: []
    };
  };

  // Enhanced validation with real-time institution awareness
  const validateSubjectWithContext = (subject: Subject): string[] => {
    const errors: string[] = [];
    const institutionConfig = getInstitutionConfig();
    
    // Basic validation
    if (!subject.name.trim()) errors.push('Subject name is required');
    if (!subject.code.trim()) errors.push('Subject code is required');
    if (subject.credits <= 0) errors.push('Credits must be greater than 0');
    if (subject.weeklyHours <= 0) errors.push('Weekly hours must be greater than 0');
    if (subject.sessionsPerWeek <= 0) errors.push('Sessions per week must be greater than 0');
    if (subject.sessionDuration <= 0) errors.push('Session duration must be greater than 0');
    if (subject.continuousHours <= 0) errors.push('Continuous hours must be greater than 0');
    
    // Institution-aware validation
    if (subject.continuousHours > institutionConfig.periodsPerDay) {
      errors.push(`Continuous hours (${subject.continuousHours}) cannot exceed daily periods (${institutionConfig.periodsPerDay})`);
    }
    
    if (subject.weeklyHours > institutionConfig.periodsPerDay * institutionConfig.workingDays.length) {
      const maxWeeklyPeriods = institutionConfig.periodsPerDay * institutionConfig.workingDays.length;
      errors.push(`Weekly hours (${subject.weeklyHours}) exceeds maximum weekly periods (${maxWeeklyPeriods})`);
    }
    
    // Lab-specific validation
    if (subject.type === 'Lab') {
      if (subject.weeklyHours < 2) {
        errors.push('Lab subjects should have at least 2 weekly hours for proper continuous scheduling');
      }
      if (subject.sessionsPerWeek > 2) {
        errors.push('Labs typically should not have more than 2 sessions per week');
      }
    }
    
    // Logic validation
    if (subject.continuousHours > subject.weeklyHours) {
      errors.push('Continuous hours cannot exceed weekly hours');
    }
    
    // Check for duplicate codes
    const existingSubject = subjects.find(s => s.code === subject.code && s.id !== subject.id);
    if (existingSubject) {
      errors.push(`Subject code '${subject.code}' is already in use`);
    }
    
    // Session duration validation with real-time calculation
    const expectedDurationPerSession = (subject.weeklyHours / subject.sessionsPerWeek) * 50;
    const tolerance = subject.type === 'Lab' ? 20 : 10; // More tolerance for labs
    if (Math.abs(subject.sessionDuration - expectedDurationPerSession) > tolerance) {
      errors.push(`Session duration (${subject.sessionDuration}min) doesn't match expected duration (${expectedDurationPerSession.toFixed(0)}min) for ${subject.weeklyHours} hours in ${subject.sessionsPerWeek} session(s)`);
    }
    
    return errors;
  };

  // Enhanced data modification functions with validation
  const addSubject = (newSubject: Partial<Subject>) => {
    const subject: Subject = {
      id: newSubject.id || `NEW${subjects.length + 1}`,
      name: newSubject.name || '',
      code: newSubject.code || '',
      type: newSubject.type || 'Theory',
      credits: newSubject.credits || 0,
      weeklyHours: newSubject.weeklyHours || 0,
      sessionsPerWeek: newSubject.sessionsPerWeek || 0,
      sessionDuration: newSubject.sessionDuration || 50,
      preferredTimeSlots: newSubject.preferredTimeSlots || [],
      continuousHours: newSubject.continuousHours || 1,
      equipmentRequired: newSubject.equipmentRequired || []
    };
    
    const validationErrors = validateSubjectWithContext(subject);
    if (validationErrors.length === 0) {
      setSubjects(prev => [...prev, subject]);
      setIsSubjectDialogOpen(false);
      setEditingItem(null);
    } else {
      setErrors(validationErrors);
    }
  };

  const updateSubject = (index: number, updatedSubject: Partial<Subject>) => {
    setSubjects(prev => prev.map((subject, i) => 
      i === index ? { ...subject, ...updatedSubject } : subject
    ));
  };

  const deleteSubject = (index: number) => {
    setSubjects(prev => prev.filter((_, i) => i !== index));
  };

  // Subject Dialog Form Component
  const SubjectDialog = () => {
    const [formData, setFormData] = useState<Partial<Subject>>(
      editingItem || {
        name: '',
        code: '',
        type: 'Theory',
        credits: 0,
        weeklyHours: 0,
        sessionsPerWeek: 0,
        sessionDuration: 50,
        preferredTimeSlots: [],
        continuousHours: 1,
        equipmentRequired: []
      }
    );

    const [localErrors, setLocalErrors] = useState<string[]>([]);
    const [realTimeValidation, setRealTimeValidation] = useState<string[]>([]);
    const [institutionConfig, setInstitutionConfig] = useState(getInstitutionConfig());

    useEffect(() => {
      if (editingItem) {
        setFormData(editingItem);
      }
    }, [editingItem]);
    
    // Real-time validation whenever form data changes
    useEffect(() => {
      if (formData.name || formData.code || formData.weeklyHours || formData.sessionsPerWeek) {
        const tempSubject = {
          ...formData,
          id: 'temp-validation-id'
        } as Subject;
        
        const errors = validateSubjectWithContext(tempSubject);
        setRealTimeValidation(errors);
      } else {
        setRealTimeValidation([]);
      }
    }, [formData]);

    // Update institution config when component mounts
    useEffect(() => {
      const config = getInstitutionConfig();
      setInstitutionConfig(config);
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      // Validate form
      const subject: Subject = {
        id: generateSubjectId(formData.code || '', formData.type || 'Theory'),
        name: formData.name || '',
        code: formData.code || '',
        type: formData.type || 'Theory',
        credits: formData.credits || 0,
        weeklyHours: formData.weeklyHours || 0,
        sessionsPerWeek: formData.sessionsPerWeek || 0,
        sessionDuration: formData.sessionDuration || 50,
        preferredTimeSlots: formData.preferredTimeSlots || [],
        continuousHours: formData.continuousHours || 1,
        equipmentRequired: formData.equipmentRequired || []
      };
      
      const validationErrors = validateSubject(subject);
      setLocalErrors(validationErrors);
      
      if (validationErrors.length === 0) {
        if (editingItem) {
          const index = subjects.findIndex(s => s.id === editingItem.id);
          if (index >= 0) {
            updateSubject(index, subject);
          }
        } else {
          setSubjects(prev => [...prev, subject]);
        }
        setIsSubjectDialogOpen(false);
        setEditingItem(null);
        setFormData({
          name: '',
          code: '',
          type: 'Theory',
          credits: 0,
          weeklyHours: 0,
          sessionsPerWeek: 0,
          sessionDuration: 50,
          preferredTimeSlots: [],
          continuousHours: 1,
          equipmentRequired: []
        });
        setLocalErrors([]);
      }
    };

    // Smart auto-completion based on existing subjects
    const getCodeSuggestions = () => {
      const existingCodes = subjects.map(s => s.code);
      const suggestions = [];
      
      // Extract common patterns
      const patterns = existingCodes.map(code => {
        const match = code.match(/([A-Z]+)(\d+)([A-Z]+)(\d+)/);
        return match ? { prefix: match[1], year: match[2], dept: match[3], num: match[4] } : null;
      }).filter(Boolean);
      
      // Generate suggestions based on patterns
      if (patterns.length > 0) {
        const commonPrefix = patterns[0]?.prefix || 'U';
        const commonYear = patterns[0]?.year || '24';
        const commonDept = patterns[0]?.dept || 'CS';
        
        suggestions.push(`${commonPrefix}${commonYear}${commonDept}3XX`);
        suggestions.push(`${commonPrefix}${commonYear}${commonDept}4XX`);
      }
      
      return suggestions;
    };

    // Dynamic field adaptation based on institution configuration
    const getMaxSessionsPerWeek = () => institutionConfig.workingDays.length;
    const getMaxContinuousHours = () => Math.floor(institutionConfig.periodsPerDay * 0.8); // 80% of daily periods
    const getRecommendedSessionDuration = (weeklyHours: number, sessions: number) => {
      const baseMinutes = (weeklyHours / sessions) * 50; // 50 min per period
      return Math.round(baseMinutes / 10) * 10; // Round to nearest 10 minutes
    };

    // Auto-suggest values when certain fields change
    const handleFieldChange = (field: string, value: any) => {
      const newFormData = { ...formData, [field]: value };
      
      // Auto-adjust dependent fields
      if (field === 'weeklyHours' || field === 'sessionsPerWeek') {
        if (newFormData.weeklyHours > 0 && newFormData.sessionsPerWeek > 0) {
          newFormData.sessionDuration = getRecommendedSessionDuration(
            newFormData.weeklyHours, 
            newFormData.sessionsPerWeek
          );
          
          // Auto-adjust continuous hours for labs
          if (newFormData.type === 'Lab' && newFormData.sessionsPerWeek === 1) {
            newFormData.continuousHours = Math.min(newFormData.weeklyHours, getMaxContinuousHours());
          }
        }
      }
      
      // Auto-suggest preferred time slots based on type
      if (field === 'type') {
        if (value === 'Lab') {
          newFormData.preferredTimeSlots = ['Morning'];
          // Ensure labs have proper configuration
          if (newFormData.weeklyHours < 2) {
            newFormData.weeklyHours = 2;
            newFormData.continuousHours = 2;
            newFormData.sessionDuration = getRecommendedSessionDuration(2, newFormData.sessionsPerWeek || 1);
          }
        } else if (value === 'Theory') {
          newFormData.preferredTimeSlots = ['Morning'];
        }
      }
      
      setFormData(newFormData);
    };

    // Enhanced templates with dynamic adaptation
    const applyTemplate = (template: string) => {
      const maxContinuous = getMaxContinuousHours();
      
      switch (template) {
        case 'single-theory':
          setFormData(prev => ({
            ...prev,
            weeklyHours: 1,
            sessionsPerWeek: 1,
            sessionDuration: 50,
            continuousHours: 1,
            type: 'Theory'
          }));
          break;
        case 'double-theory':
          setFormData(prev => ({
            ...prev,
            weeklyHours: 2,
            sessionsPerWeek: 1,
            sessionDuration: 100,
            continuousHours: 2,
            type: 'Theory'
          }));
          break;
        case 'quad-theory':
          setFormData(prev => ({
            ...prev,
            weeklyHours: 4,
            sessionsPerWeek: 1,
            sessionDuration: 240,
            continuousHours: 4,
            type: 'Theory'
          }));
          break;
        case 'standard-lab':
          setFormData(prev => ({
            ...prev,
            weeklyHours: Math.min(2, maxContinuous),
            sessionsPerWeek: 1,
            sessionDuration: getRecommendedSessionDuration(2, 1),
            continuousHours: Math.min(2, maxContinuous),
            type: 'Lab',
            preferredTimeSlots: ['Morning'] // Labs prefer morning slots
          }));
          break;
        case 'extended-lab':
          setFormData(prev => ({
            ...prev,
            weeklyHours: Math.min(3, maxContinuous),
            sessionsPerWeek: 1,
            sessionDuration: getRecommendedSessionDuration(3, 1),
            continuousHours: Math.min(3, maxContinuous),
            type: 'Lab',
            preferredTimeSlots: ['Morning']
          }));
          break;
        case 'adaptive-lab':
          // New adaptive template based on institution config
          const adaptiveHours = Math.min(Math.max(2, Math.floor(maxContinuous * 0.75)), maxContinuous);
          setFormData(prev => ({
            ...prev,
            weeklyHours: adaptiveHours,
            sessionsPerWeek: 1,
            sessionDuration: getRecommendedSessionDuration(adaptiveHours, 1),
            continuousHours: adaptiveHours,
            type: 'Lab',
            preferredTimeSlots: ['Morning']
          }));
          break;
        case 'distributed-theory':
          setFormData(prev => ({
            ...prev,
            weeklyHours: 3,
            sessionsPerWeek: 3,
            sessionDuration: 50,
            continuousHours: 1,
            type: 'Theory'
          }));
          break;
      }
    };

    const handleClose = () => {
      setIsSubjectDialogOpen(false);
      setEditingItem(null);
      setLocalErrors([]);
      setFormData({
        name: '',
        code: '',
        type: 'Theory',
        credits: 0,
        weeklyHours: 0,
        sessionsPerWeek: 0,
        sessionDuration: 50,
        preferredTimeSlots: [],
        continuousHours: 1,
        equipmentRequired: []
      });
    };

    return (
      <Dialog open={isSubjectDialogOpen} onOpenChange={setIsSubjectDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Subject' : 'Add New Subject'}</DialogTitle>
            <DialogDescription>
              Enter subject details or use a quick template. All scheduling parameters are customizable.
            </DialogDescription>
          </DialogHeader>

          {!editingItem && (
            <div className="p-3 bg-gray-50 border rounded">
              <Label className="text-sm font-medium">Quick Templates:</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button type="button" size="sm" variant="outline" onClick={() => applyTemplate('single-theory')}>
                  1-Hour Theory
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => applyTemplate('double-theory')}>
                  2-Hour Block
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => applyTemplate('quad-theory')}>
                  4-Hour Block
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => applyTemplate('standard-lab')}>
                  Standard Lab
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => applyTemplate('extended-lab')}>
                  Extended Lab
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => applyTemplate('adaptive-lab')} className="bg-green-50 border-green-300">
                  🎯 Smart Lab
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => applyTemplate('distributed-theory')}>
                  Distributed (3×1hr)
                </Button>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Subject Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Data Structures"
                  value={formData.name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Subject Code *</Label>
                <Input
                  id="code"
                  placeholder="e.g., U24CS302"
                  value={formData.code || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select 
                  value={formData.type || 'Theory'} 
                  onValueChange={(value) => handleFieldChange('type', value as 'Theory' | 'Lab' | 'Tutorial')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Theory">Theory</SelectItem>
                    <SelectItem value="Lab">Lab</SelectItem>
                    <SelectItem value="Tutorial">Tutorial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="credits">Credits *</Label>
                <Input
                  id="credits"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.credits || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, credits: Number(e.target.value) }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weeklyHours">Weekly Hours *</Label>
                <Input
                  id="weeklyHours"
                  type="number"
                  min="0"
                  max={institutionConfig.periodsPerDay * institutionConfig.workingDays.length}
                  placeholder="0"
                  value={formData.weeklyHours || ''}
                  onChange={(e) => handleFieldChange('weeklyHours', Number(e.target.value))}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Max: {institutionConfig.periodsPerDay * institutionConfig.workingDays.length} periods/week ({institutionConfig.workingDays.length} days × {institutionConfig.periodsPerDay} periods)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sessionsPerWeek">Sessions Per Week *</Label>
                <Input
                  id="sessionsPerWeek"
                  type="number"
                  min="0"
                  max={getMaxSessionsPerWeek()}
                  placeholder="0"
                  value={formData.sessionsPerWeek || ''}
                  onChange={(e) => handleFieldChange('sessionsPerWeek', Number(e.target.value))}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Max: {getMaxSessionsPerWeek()} sessions (limited by {institutionConfig.workingDays.length} working days)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sessionDuration">Session Duration (minutes)</Label>
                <Input
                  id="sessionDuration"
                  type="number"
                  min="1"
                  placeholder="50"
                  value={formData.sessionDuration || 50}
                  onChange={(e) => setFormData(prev => ({ ...prev, sessionDuration: Number(e.target.value) }))}
                />
                <p className="text-xs text-muted-foreground">
                  Duration of each session (50min = 1 period, 100min = 2 periods)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="continuousHours">Continuous Hours *</Label>
                <Input
                  id="continuousHours"
                  type="number"
                  min="1"
                  max={getMaxContinuousHours()}
                  placeholder="1"
                  value={formData.continuousHours || 1}
                  onChange={(e) => handleFieldChange('continuousHours', Number(e.target.value))}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Max: {getMaxContinuousHours()} periods (recommended limit for {institutionConfig.periodsPerDay} daily periods)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredTimeSlots">Preferred Time Slots</Label>
                <Select 
                  value={formData.preferredTimeSlots?.[0] || 'Morning'} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, preferredTimeSlots: [value] }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select preferred time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Morning">Morning</SelectItem>
                    <SelectItem value="Afternoon">Afternoon</SelectItem>
                    <SelectItem value="Evening">Evening</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Preferred scheduling time (Morning = P1-P4, Afternoon = P5-P8)
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="equipment">Equipment Required (comma-separated)</Label>
              <Textarea
                id="equipment"
                placeholder="e.g., Projector, Whiteboard, Computers"
                value={formData.equipmentRequired?.join(', ') || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  equipmentRequired: e.target.value.split(',').map(item => item.trim()).filter(item => item.length > 0)
                }))}
              />
            </div>

            {formData.code && (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-sm text-blue-800 mb-2">
                    <strong>Generated ID:</strong> {generateSubjectId(formData.code, formData.type || 'Theory')}
                  </p>
                  <div className="text-xs text-blue-700">
                    <strong>📅 Real-Time Scheduling Preview:</strong>
                    <ul className="ml-4 mt-1 space-y-1">
                      <li>• <strong>Total Weekly Load:</strong> {formData.weeklyHours || 0} hours ({formData.weeklyHours || 0} periods)</li>
                      <li>• <strong>Session Frequency:</strong> {formData.sessionsPerWeek || 0} session(s) per week</li>
                      <li>• <strong>Session Duration:</strong> {formData.sessionDuration || 50} minutes ({Math.ceil((formData.sessionDuration || 50) / 50)} period(s))</li>
                      <li>• <strong>Continuous Block:</strong> {formData.continuousHours || 1} consecutive period(s)</li>
                      <li>• <strong>Time Preference:</strong> {formData.preferredTimeSlots?.[0] || 'Morning'}</li>
                      <li>• <strong>Institution Compatibility:</strong> 
                        <span className={formData.continuousHours <= institutionConfig.periodsPerDay ? "text-green-700" : "text-red-700"}>
                          {formData.continuousHours <= institutionConfig.periodsPerDay ? 
                            `✓ Fits in daily schedule (${institutionConfig.periodsPerDay} periods/day)` : 
                            `⚠ Exceeds daily periods (${institutionConfig.periodsPerDay} available)`
                          }
                        </span>
                      </li>
                      <li>• <strong>Timetable Appearance:</strong> 
                        {formData.type === 'Lab' ? (
                          <span className="text-purple-700">
                            🧪 Lab: {formData.weeklyHours >= 2 ? 
                              `${formData.weeklyHours}-hour continuous block` : 
                              '⚠ Will be auto-corrected to 2+ hour block'
                            }
                          </span>
                        ) : formData.sessionsPerWeek === 1 ? (
                          <span className="text-green-700">
                            📚 Single {formData.continuousHours || 1}-hour block per week
                          </span>
                        ) : (
                          <span className="text-orange-700">
                            📝 {formData.sessionsPerWeek || 0} separate {(formData.weeklyHours || 0) / (formData.sessionsPerWeek || 1)}-hour sessions per week
                          </span>
                        )}
                      </li>
                      {formData.weeklyHours > 0 && formData.sessionsPerWeek > 0 && (
                        <li>• <strong>Weekly Distribution:</strong> 
                          <span className="text-gray-700">
                            {Array.from({length: Math.min(formData.sessionsPerWeek, institutionConfig.workingDays.length)}, (_, i) => 
                              `${institutionConfig.workingDays[i] || `Day ${i+1}`}: ${formData.continuousHours || 1}h block`
                            ).join(', ')}
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Real-time validation feedback */}
                {realTimeValidation.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                    <div className="flex items-center gap-2 text-amber-800 font-medium mb-2">
                      <AlertCircle className="w-4 h-4" />
                      ⚡ Real-Time Validation:
                    </div>
                    <ul className="text-amber-700 text-xs ml-4 space-y-1 list-disc">
                      {realTimeValidation.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Smart suggestions based on form data */}
                {formData.type && formData.weeklyHours > 0 && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded">
                    <div className="flex items-center gap-2 text-green-800 font-medium mb-2">
                      <CheckCircle className="w-4 h-4" />
                      💡 Smart Suggestions:
                    </div>
                    <ul className="text-green-700 text-xs ml-4 space-y-1 list-disc">
                      {formData.type === 'Lab' && formData.weeklyHours < 2 && (
                        <li>Consider increasing weekly hours to 2-3 for proper lab sessions</li>
                      )}
                      {formData.type === 'Theory' && formData.weeklyHours > 4 && (
                        <li>Consider splitting into multiple sessions for better student engagement</li>
                      )}
                      {formData.sessionsPerWeek > institutionConfig.workingDays.length && (
                        <li>Sessions per week exceeds working days - some days will have multiple sessions</li>
                      )}
                      {formData.continuousHours > 3 && (
                        <li>Long continuous blocks may need breaks - check institution break configuration</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {localErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <div className="flex items-center gap-2 text-red-800 font-medium">
                  <AlertCircle className="w-4 h-4" />
                  Validation Errors:
                </div>
                <ul className="text-red-700 text-sm mt-1 ml-6 list-disc">
                  {localErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit">
                {editingItem ? 'Update Subject' : 'Add Subject'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  };

  // Enhanced Faculty Dialog Component with simplified initial state
  const FacultyDialog = () => {
    const [facultyFormData, setFacultyFormData] = useState<Partial<Faculty>>(() => ({
      name: '',
      eligibleSubjects: [],
      maxWeeklyLoad: 20,
      availability: [],
      unavailableSlots: [],
      preferences: {
        preferredDays: [],
        preferredTimeSlots: [],
        noBackToBack: false,
        maxDailyHours: 4
      },
      leaveFrequency: 0.05,
      preferredRooms: []
    }));
    const [facultyErrors, setFacultyErrors] = useState<string[]>([]);

    useEffect(() => {
      if (editingItem && isFacultyDialogOpen) {
        setFacultyFormData({
          name: editingItem.name || '',
          eligibleSubjects: editingItem.eligibleSubjects || [],
          maxWeeklyLoad: editingItem.maxWeeklyLoad || 20,
          availability: editingItem.availability || [],
          unavailableSlots: editingItem.unavailableSlots || [],
          preferences: {
            preferredDays: editingItem.preferences?.preferredDays || [],
            preferredTimeSlots: editingItem.preferences?.preferredTimeSlots || [],
            noBackToBack: editingItem.preferences?.noBackToBack || false,
            maxDailyHours: editingItem.preferences?.maxDailyHours || 4
          },
          leaveFrequency: editingItem.leaveFrequency || 0.05,
          preferredRooms: editingItem.preferredRooms || []
        });
      } else if (!editingItem && isFacultyDialogOpen) {
        setFacultyFormData({
          name: '',
          eligibleSubjects: [],
          maxWeeklyLoad: 20,
          availability: [],
          unavailableSlots: [],
          preferences: {
            preferredDays: [],
            preferredTimeSlots: [],
            noBackToBack: false,
            maxDailyHours: 4
          },
          leaveFrequency: 0.05,
          preferredRooms: []
        });
      }
    }, [editingItem, isFacultyDialogOpen]);

    const validateFaculty = (faculty: Partial<Faculty>): string[] => {
      const errors: string[] = [];
      
      if (!faculty.name?.trim()) {
        errors.push('Faculty name is required');
      }
      
      if (!faculty.eligibleSubjects?.length) {
        errors.push('At least one eligible subject must be selected');
      }
      
      if (!faculty.maxWeeklyLoad || faculty.maxWeeklyLoad < 1) {
        errors.push('Maximum weekly load must be at least 1 hour');
      }
      
      if (faculty.preferences?.maxDailyHours && faculty.preferences.maxDailyHours > 8) {
        errors.push('Maximum daily hours cannot exceed 8');
      }
      
      if (faculty.leaveFrequency && (faculty.leaveFrequency < 0 || faculty.leaveFrequency > 1)) {
        errors.push('Leave frequency must be between 0 and 1 (0% - 100%)');
      }
      
      return errors;
    };

    const handleFacultySubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      const errors = validateFaculty(facultyFormData);
      setFacultyErrors(errors);
      
      if (errors.length > 0) return;

      const facultyData: Faculty = {
        id: editingItem?.id || `F${faculty.length + 1}`,
        name: facultyFormData.name || '',
        eligibleSubjects: facultyFormData.eligibleSubjects || [],
        maxWeeklyLoad: facultyFormData.maxWeeklyLoad || 20,
        availability: facultyFormData.availability || [],
        unavailableSlots: facultyFormData.unavailableSlots || [],
        preferences: {
          preferredDays: facultyFormData.preferences?.preferredDays || [],
          preferredTimeSlots: facultyFormData.preferences?.preferredTimeSlots || [],
          noBackToBack: facultyFormData.preferences?.noBackToBack || false,
          maxDailyHours: facultyFormData.preferences?.maxDailyHours || 4
        },
        leaveFrequency: facultyFormData.leaveFrequency || 0.05,
        preferredRooms: facultyFormData.preferredRooms || []
      };

      if (editingItem) {
        setFaculty(prev => prev.map(f => f.id === editingItem.id ? facultyData : f));
      } else {
        setFaculty(prev => [...prev, facultyData]);
      }

      setIsFacultyDialogOpen(false);
      setEditingItem(null);
    };

    const workingDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const timeSlots = ['Morning', 'Afternoon'];

    return (
      <Dialog open={isFacultyDialogOpen} onOpenChange={setIsFacultyDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Faculty' : 'Add New Faculty'}</DialogTitle>
            <DialogDescription>
              Configure faculty member details, teaching preferences, and scheduling constraints.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleFacultySubmit} className="space-y-4">
            {facultyErrors.length > 0 && (
              <Alert variant="destructive">
                <ul className="space-y-1">
                  {facultyErrors.map((error, idx) => (
                    <li key={idx}>• {error}</li>
                  ))}
                </ul>
              </Alert>
            )}

            {/* Basic Information */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Basic Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="facultyName">Faculty Name *</Label>
                  <Input
                    id="facultyName"
                    placeholder="e.g., Dr. John Smith"
                    value={facultyFormData.name || ''}
                    onChange={(e) => setFacultyFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxWeeklyLoad">Max Weekly Load (hours) *</Label>
                  <Input
                    id="maxWeeklyLoad"
                    type="number"
                    min="1"
                    max="40"
                    placeholder="20"
                    value={facultyFormData.maxWeeklyLoad || ''}
                    onChange={(e) => setFacultyFormData(prev => ({ ...prev, maxWeeklyLoad: Number(e.target.value) }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Eligible Subjects *</Label>
                <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto border rounded p-2">
                  {subjects.filter(s => s.code).map(subject => (
                    <label key={subject.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={facultyFormData.eligibleSubjects?.includes(subject.id) || false}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setFacultyFormData(prev => ({
                            ...prev,
                            eligibleSubjects: checked
                              ? [...(prev.eligibleSubjects || []), subject.id]
                              : (prev.eligibleSubjects || []).filter(id => id !== subject.id)
                          }));
                        }}
                      />
                      <span className="text-sm">{subject.code} {subject.type === 'Lab' ? '(Lab)' : ''}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Teaching Preferences */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Teaching Preferences</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Preferred Days</Label>
                  <div className="space-y-2">
                    {workingDays.map(day => (
                      <label key={day} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={facultyFormData.preferences?.preferredDays?.includes(day) || false}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setFacultyFormData(prev => ({
                              ...prev,
                              preferences: {
                                ...prev.preferences,
                                preferredDays: checked
                                  ? [...(prev.preferences?.preferredDays || []), day]
                                  : (prev.preferences?.preferredDays || []).filter(d => d !== day)
                              }
                            }));
                          }}
                        />
                        <span>{day}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Preferred Time Slots</Label>
                  <div className="space-y-2">
                    {timeSlots.map(slot => (
                      <label key={slot} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={facultyFormData.preferences?.preferredTimeSlots?.includes(slot) || false}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setFacultyFormData(prev => ({
                              ...prev,
                              preferences: {
                                ...prev.preferences,
                                preferredTimeSlots: checked
                                  ? [...(prev.preferences?.preferredTimeSlots || []), slot]
                                  : (prev.preferences?.preferredTimeSlots || []).filter(s => s !== slot)
                              }
                            }));
                          }}
                        />
                        <span>{slot}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxDailyHours">Max Daily Hours</Label>
                  <Input
                    id="maxDailyHours"
                    type="number"
                    min="1"
                    max="8"
                    placeholder="4"
                    value={facultyFormData.preferences?.maxDailyHours || ''}
                    onChange={(e) => setFacultyFormData(prev => ({
                      ...prev,
                      preferences: {
                        ...prev.preferences,
                        maxDailyHours: Number(e.target.value)
                      }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leaveFrequency">Leave Frequency (%)</Label>
                  <Input
                    id="leaveFrequency"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="5"
                    value={((facultyFormData.leaveFrequency || 0) * 100).toString()}
                    onChange={(e) => setFacultyFormData(prev => ({
                      ...prev,
                      leaveFrequency: Number(e.target.value) / 100
                    }))}
                  />
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <input
                    type="checkbox"
                    id="noBackToBack"
                    checked={facultyFormData.preferences?.noBackToBack || false}
                    onChange={(e) => setFacultyFormData(prev => ({
                      ...prev,
                      preferences: {
                        ...prev.preferences,
                        noBackToBack: e.target.checked
                      }
                    }))}
                  />
                  <Label htmlFor="noBackToBack">No Back-to-Back Classes</Label>
                </div>
              </div>
            </div>

            {/* Preferred Rooms */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Preferred Rooms</h3>
              <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto border rounded p-2">
                {rooms.filter(r => r.name).map(room => (
                  <label key={room.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={facultyFormData.preferredRooms?.includes(room.id) || false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFacultyFormData(prev => ({
                          ...prev,
                          preferredRooms: checked
                            ? [...(prev.preferredRooms || []), room.id]
                            : (prev.preferredRooms || []).filter(id => id !== room.id)
                        }));
                      }}
                    />
                    <span className="text-sm">{room.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Faculty Scheduling Preview */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded">
              <h4 className="font-semibold mb-2">Faculty Configuration Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Teaching Load:</strong> {facultyFormData.maxWeeklyLoad || 20} hours/week
                </div>
                <div>
                  <strong>Daily Limit:</strong> {facultyFormData.preferences?.maxDailyHours || 4} hours/day
                </div>
                <div>
                  <strong>Eligible Subjects:</strong> {facultyFormData.eligibleSubjects?.length || 0} subjects
                </div>
                <div>
                  <strong>Preferred Rooms:</strong> {facultyFormData.preferredRooms?.length || 0} rooms
                </div>
                <div>
                  <strong>Leave Rate:</strong> {((facultyFormData.leaveFrequency || 0) * 100).toFixed(1)}%
                </div>
                <div>
                  <strong>Back-to-Back:</strong> {facultyFormData.preferences?.noBackToBack ? 'Avoided' : 'Allowed'}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFacultyDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingItem ? 'Update Faculty' : 'Add Faculty'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  };

  // Enhanced Room Dialog Component with all critical parameters
  const RoomDialog = () => {
    const [roomFormData, setRoomFormData] = useState<Partial<Room>>({
      name: '',
      type: 'Classroom',
      capacity: 50,
      equipment: [],
      availability: [],
      location: ''
    });

    const equipmentOptions = ['Projector', 'Whiteboard', 'Audio System', 'Computer Lab', 'Internet Access', 'AC', 'Microphone', 'Smart Board', 'Lab Equipment'];

    useEffect(() => {
      if (editingItem && isRoomDialogOpen) {
        setRoomFormData(editingItem);
      } else if (!editingItem && isRoomDialogOpen) {
        setRoomFormData({
          name: '',
          type: 'Classroom',
          capacity: 50,
          equipment: [],
          availability: [],
          location: ''
        });
      }
    }, [editingItem, isRoomDialogOpen]);

    const handleRoomSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      const roomData: Room = {
        id: editingItem?.id || `R${rooms.length + 1}`,
        name: roomFormData.name || '',
        type: roomFormData.type || 'Classroom',
        capacity: roomFormData.capacity || 50,
        equipment: roomFormData.equipment || [],
        availability: roomFormData.availability || [],
        location: roomFormData.location || ''
      };

      if (editingItem) {
        setRooms(prev => prev.map(r => r.id === editingItem.id ? roomData : r));
      } else {
        setRooms(prev => [...prev, roomData]);
      }

      setIsRoomDialogOpen(false);
      setEditingItem(null);
    };

    return (
      <Dialog open={isRoomDialogOpen} onOpenChange={setIsRoomDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Room' : 'Add New Room'}</DialogTitle>
            <DialogDescription>
              Configure room details, equipment, and availability.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRoomSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="roomName">Room Name *</Label>
                <Input
                  id="roomName"
                  placeholder="e.g., AD-B, Computer Lab 1"
                  value={roomFormData.name || ''}
                  onChange={(e) => setRoomFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="e.g., Civil Block, Main Building"
                  value={roomFormData.location || ''}
                  onChange={(e) => setRoomFormData(prev => ({ ...prev, location: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="roomType">Room Type</Label>
                <Select 
                  value={roomFormData.type || 'Classroom'} 
                  onValueChange={(value) => setRoomFormData(prev => ({ ...prev, type: value as Room['type'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Classroom">Classroom</SelectItem>
                    <SelectItem value="Lab">Lab</SelectItem>
                    <SelectItem value="Seminar Hall">Seminar Hall</SelectItem>
                    <SelectItem value="Auditorium">Auditorium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  placeholder="50"
                  value={roomFormData.capacity || ''}
                  onChange={(e) => setRoomFormData(prev => ({ ...prev, capacity: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Equipment Available</Label>
              <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto border rounded p-2">
                {equipmentOptions.map(equipment => (
                  <label key={equipment} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={roomFormData.equipment?.includes(equipment) || false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setRoomFormData(prev => ({
                          ...prev,
                          equipment: checked
                            ? [...(prev.equipment || []), equipment]
                            : (prev.equipment || []).filter(eq => eq !== equipment)
                        }));
                      }}
                    />
                    <span className="text-sm">{equipment}</span>
                  </label>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsRoomDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingItem ? 'Update Room' : 'Add Room'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  };

  // Enhanced Batch Dialog Component with all critical parameters
  const BatchDialog = () => {
    const [batchFormData, setBatchFormData] = useState<Partial<StudentBatch>>({
      name: '',
      department: '',
      year: 1,
      section: '',
      size: 60,
      mandatorySubjects: [],
      electiveGroups: [],
      maxDailyClasses: 8,
      specialRequirements: []
    });

    const specialRequirementOptions = ['Lab Access Required', 'Computer Access', 'AI/ML Lab Access', 'Internet Required', 'Special Software', 'Hardware Access'];

    useEffect(() => {
      if (editingItem && isBatchDialogOpen) {
        setBatchFormData(editingItem);
      } else if (!editingItem && isBatchDialogOpen) {
        setBatchFormData({
          name: '',
          department: '',
          year: 1,
          section: '',
          size: 60,
          mandatorySubjects: [],
          electiveGroups: [],
          maxDailyClasses: 8,
          specialRequirements: []
        });
      }
    }, [editingItem, isBatchDialogOpen]);

    const handleBatchSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      const batchData: StudentBatch = {
        id: editingItem?.id || `B${batches.length + 1}`,
        name: batchFormData.name || '',
        department: batchFormData.department || '',
        year: batchFormData.year || 1,
        section: batchFormData.section || '',
        size: batchFormData.size || 60,
        mandatorySubjects: batchFormData.mandatorySubjects || [],
        electiveGroups: batchFormData.electiveGroups || [],
        maxDailyClasses: batchFormData.maxDailyClasses || 8,
        specialRequirements: batchFormData.specialRequirements || []
      };

      if (editingItem) {
        setBatches(prev => prev.map(b => b.id === editingItem.id ? batchData : b));
      } else {
        setBatches(prev => [...prev, batchData]);
      }

      setIsBatchDialogOpen(false);
      setEditingItem(null);
    };

    return (
      <Dialog open={isBatchDialogOpen} onOpenChange={setIsBatchDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Batch' : 'Add New Batch'}</DialogTitle>
            <DialogDescription>
              Configure student batch details, subjects, and requirements.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleBatchSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="batchName">Batch Name *</Label>
                <Input
                  id="batchName"
                  placeholder="e.g., AIDS-B 2024-25"
                  value={batchFormData.name || ''}
                  onChange={(e) => setBatchFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  placeholder="e.g., Computer Science"
                  value={batchFormData.department || ''}
                  onChange={(e) => setBatchFormData(prev => ({ ...prev, department: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="section">Section</Label>
                <Input
                  id="section"
                  placeholder="e.g., A, B"
                  value={batchFormData.section || ''}
                  onChange={(e) => setBatchFormData(prev => ({ ...prev, section: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  min="1"
                  max="4"
                  value={batchFormData.year || ''}
                  onChange={(e) => setBatchFormData(prev => ({ ...prev, year: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="size">Batch Size</Label>
                <Input
                  id="size"
                  type="number"
                  min="1"
                  placeholder="60"
                  value={batchFormData.size || ''}
                  onChange={(e) => setBatchFormData(prev => ({ ...prev, size: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxDailyClasses">Max Daily Classes</Label>
                <Input
                  id="maxDailyClasses"
                  type="number"
                  min="1"
                  max="10"
                  placeholder="8"
                  value={batchFormData.maxDailyClasses || ''}
                  onChange={(e) => setBatchFormData(prev => ({ ...prev, maxDailyClasses: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Mandatory Subjects</Label>
              <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto border rounded p-2">
                {subjects.filter(s => s.code).map(subject => (
                  <label key={subject.code} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={batchFormData.mandatorySubjects?.includes(subject.id) || false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setBatchFormData(prev => ({
                          ...prev,
                          mandatorySubjects: checked
                            ? [...(prev.mandatorySubjects || []), subject.id]
                            : (prev.mandatorySubjects || []).filter(id => id !== subject.id)
                        }));
                      }}
                    />
                    <span className="text-sm">{subject.code}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Special Requirements</Label>
              <div className="grid grid-cols-3 gap-2 border rounded p-2">
                {specialRequirementOptions.map(requirement => (
                  <label key={requirement} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={batchFormData.specialRequirements?.includes(requirement) || false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setBatchFormData(prev => ({
                          ...prev,
                          specialRequirements: checked
                            ? [...(prev.specialRequirements || []), requirement]
                            : (prev.specialRequirements || []).filter(req => req !== requirement)
                        }));
                      }}
                    />
                    <span className="text-sm">{requirement}</span>
                  </label>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsBatchDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingItem ? 'Update Batch' : 'Add Batch'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  };

  // Sample data for demonstration - Updated with actual curriculum data
  const sampleSubjects: Subject[] = [
    {
      id: 'U24MA302',
      code: 'U24MA302',
      name: 'Discrete Mathematics',
      type: 'Theory',
      credits: 5,
      weeklyHours: 5,
      sessionsPerWeek: 5,
      sessionDuration: 50,
      preferredTimeSlots: ['Morning'],
      continuousHours: 1,
      equipmentRequired: ['Projector', 'Whiteboard']
    },
    {
      id: 'U24AD301',
      code: 'U24AD301',
      name: 'Fundamentals of Data Science and Analytics',
      type: 'Theory',
      credits: 4,
      weeklyHours: 4,
      sessionsPerWeek: 4,
      sessionDuration: 50,
      preferredTimeSlots: ['Morning'],
      continuousHours: 1,
      equipmentRequired: ['Projector', 'Computer']
    },
    {
      id: 'U24AD302',
      code: 'U24AD302',
      name: 'OOPS and Data Structures',
      type: 'Theory',
      credits: 4,
      weeklyHours: 4,
      sessionsPerWeek: 4,
      sessionDuration: 50,
      preferredTimeSlots: ['Morning'],
      continuousHours: 1,
      equipmentRequired: ['Projector', 'Computer']
    },
    {
      id: 'U24AD303',
      code: 'U24AD303',
      name: 'Database Design and Management',
      type: 'Theory',
      credits: 3,
      weeklyHours: 3,
      sessionsPerWeek: 3,
      sessionDuration: 50,
      preferredTimeSlots: ['Morning', 'Afternoon'],
      continuousHours: 1,
      equipmentRequired: ['Projector', 'Computer']
    },
    {
      id: 'U24EC310',
      code: 'U24EC310',
      name: 'Digital Principles and Computer Organization',
      type: 'Theory',
      credits: 3,
      weeklyHours: 3,
      sessionsPerWeek: 3,
      sessionDuration: 50,
      preferredTimeSlots: ['Afternoon'],
      continuousHours: 1,
      equipmentRequired: ['Projector', 'Digital Trainer Kit']
    },
    {
      id: 'U24MC313',
      code: 'U24MC313',
      name: 'Foreign Language (Japanese)-FL',
      type: 'Theory',
      credits: 1,
      weeklyHours: 1,
      sessionsPerWeek: 1,
      sessionDuration: 50,
      preferredTimeSlots: ['Afternoon'],
      continuousHours: 1,
      equipmentRequired: ['Projector', 'Audio System']
    },
    {
      id: 'U24AD304-Lab',
      code: 'U24AD304',
      name: 'Data Science and Analytics Laboratory',
      type: 'Lab',
      credits: 2,
      weeklyHours: 3,
      sessionsPerWeek: 1,
      sessionDuration: 180,
      preferredTimeSlots: ['Morning'],
      continuousHours: 3,
      equipmentRequired: ['Computers', 'Python Software', 'R Software', 'Projector']
    },
    {
      id: 'U24AD302-Lab',
      code: 'U24AD302',
      name: 'OOPS and Data Structures Lab',
      type: 'Lab',
      credits: 2,
      weeklyHours: 2,
      sessionsPerWeek: 1,
      sessionDuration: 120,
      preferredTimeSlots: ['Afternoon'],
      continuousHours: 2,
      equipmentRequired: ['Computers', 'Java IDE', 'C++ IDE', 'Projector']
    },
    {
      id: 'U24AD303-Lab',
      code: 'U24AD303',
      name: 'Database Design and Management Lab',
      type: 'Lab',
      credits: 2,
      weeklyHours: 2,
      sessionsPerWeek: 1,
      sessionDuration: 120,
      preferredTimeSlots: ['Afternoon'],
      continuousHours: 2,
      equipmentRequired: ['Computers', 'MySQL', 'Oracle', 'Projector']
    },
    {
      id: 'U24EC310-Lab',
      code: 'U24EC310',
      name: 'Digital Principles and Computer Organization Lab',
      type: 'Lab',
      credits: 2,
      weeklyHours: 2,
      sessionsPerWeek: 1,
      sessionDuration: 120,
      preferredTimeSlots: ['Afternoon'],
      continuousHours: 2,
      equipmentRequired: ['Digital Trainer Kits', 'Logic Gates', 'Multimeter', 'Oscilloscope']
    },
    {
      id: 'U24TP310',
      code: 'U24TP310',
      name: 'General Aptitude & Logical Reasoning-GALR',
      type: 'Theory',
      credits: 1,
      weeklyHours: 2,
      sessionsPerWeek: 1,
      sessionDuration: 120,
      preferredTimeSlots: ['Afternoon'],
      continuousHours: 2,
      equipmentRequired: ['Projector', 'Whiteboard']
    },
    {
      id: 'U24ED311',
      code: 'U24ED311',
      name: 'Innovation Tool Kits',
      type: 'Theory',
      credits: 1,
      weeklyHours: 3,
      sessionsPerWeek: 1,
      sessionDuration: 180,
      preferredTimeSlots: ['Morning', 'Afternoon'],
      continuousHours: 3,
      equipmentRequired: ['Projector', 'Innovation Tools', 'Whiteboard']
    },
    {
      id: 'U24RM317',
      code: 'U24RM317',
      name: 'Research Overview',
      type: 'Theory',
      credits: 1,
      weeklyHours: 1,
      sessionsPerWeek: 1,
      sessionDuration: 50,
      preferredTimeSlots: ['Afternoon'],
      continuousHours: 1,
      equipmentRequired: ['Projector', 'Research Papers']
    }
  ];

  const sampleFaculty: Faculty[] = [
    {
      id: 'F001',
      name: 'Mrs. Adaline Joy',
      eligibleSubjects: ['U24MA302'],
      maxWeeklyLoad: 20,
      availability: [],
      unavailableSlots: [],
      preferences: {
        preferredDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        preferredTimeSlots: ['Morning'],
        noBackToBack: false,
        maxDailyHours: 4
      },
      leaveFrequency: 0.1,
      preferredRooms: ['AD-B', 'ADA']
    },
    {
      id: 'F002',
      name: 'Mrs. T.Ani Bernish',
      eligibleSubjects: ['U24AD301', 'U24AD304-Lab'],
      maxWeeklyLoad: 22,
      availability: [],
      unavailableSlots: [],
      preferences: {
        preferredDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        preferredTimeSlots: ['Morning'],
        noBackToBack: false,
        maxDailyHours: 5
      },
      leaveFrequency: 0.08,
      preferredRooms: ['AD-B', 'ADA']
    },
    {
      id: 'F003',
      name: 'Mrs. Valentina',
      eligibleSubjects: ['U24AD302', 'U24AD302-Lab'],
      maxWeeklyLoad: 24,
      availability: [],
      unavailableSlots: [],
      preferences: {
        preferredDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        preferredTimeSlots: ['Morning', 'Afternoon'],
        noBackToBack: false,
        maxDailyHours: 5
      },
      leaveFrequency: 0.06,
      preferredRooms: ['AD-B', 'ADA']
    },
    {
      id: 'F004',
      name: 'Mrs. Pavithra',
      eligibleSubjects: ['U24AD303', 'U24AD303-Lab'],
      maxWeeklyLoad: 21,
      availability: [],
      unavailableSlots: [],
      preferences: {
        preferredDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        preferredTimeSlots: ['Morning', 'Afternoon'],
        noBackToBack: false,
        maxDailyHours: 4
      },
      leaveFrequency: 0.07,
      preferredRooms: ['AD-B', 'ADA']
    },
    {
      id: 'F005',
      name: 'Mrs. Sasikala',
      eligibleSubjects: ['U24EC310', 'U24EC310-Lab'],
      maxWeeklyLoad: 21,
      availability: [],
      unavailableSlots: [],
      preferences: {
        preferredDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        preferredTimeSlots: ['Afternoon'],
        noBackToBack: false,
        maxDailyHours: 4
      },
      leaveFrequency: 0.09,
      preferredRooms: ['AD-B', 'ADA']
    },
    {
      id: 'F006',
      name: 'ABK',
      eligibleSubjects: ['U24MC313'],
      maxWeeklyLoad: 12,
      availability: [],
      unavailableSlots: [],
      preferences: {
        preferredDays: ['Tuesday', 'Thursday'],
        preferredTimeSlots: ['Afternoon'],
        noBackToBack: true,
        maxDailyHours: 3
      },
      leaveFrequency: 0.05,
      preferredRooms: ['AD-B', 'ADA']
    },
    {
      id: 'F007',
      name: 'Ms. Yogitha',
      eligibleSubjects: ['U24TP310', 'U24RM317'],
      maxWeeklyLoad: 18,
      availability: [],
      unavailableSlots: [],
      preferences: {
        preferredDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        preferredTimeSlots: ['Afternoon'],
        noBackToBack: true,
        maxDailyHours: 4
      },
      leaveFrequency: 0.08,
      preferredRooms: ['AD-B', 'ADA']
    },
    {
      id: 'F009',
      name: 'Dr. Ramasubramanian',
      eligibleSubjects: ['U24ED311'],
      maxWeeklyLoad: 15,
      availability: [],
      unavailableSlots: [],
      preferences: {
        preferredDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        preferredTimeSlots: ['Morning', 'Afternoon'],
        noBackToBack: false,
        maxDailyHours: 4
      },
      leaveFrequency: 0.05,
      preferredRooms: ['AD-B', 'ADA']
    }
  ];

  const sampleRooms: Room[] = [
    {
      id: 'AD-B',
      name: 'AD-B',
      type: 'Classroom',
      capacity: 68,
      equipment: ['Projector', 'Whiteboard', 'Audio System'],
      availability: [],
      location: 'Civil Block'
    },
    {
      id: 'AD-A',
      name: 'AD-A',
      type: 'Classroom',
      capacity: 68,
      equipment: ['Projector', 'Whiteboard', 'Audio System'],
      availability: [],
      location: 'Civil Block'
    }
  ];

  // Sample batches - Only one batch to prevent duplicate faculty loading
  // Add more batches if you need timetables for multiple sections
  const sampleBatches: StudentBatch[] = [
    {
      id: 'AIDS-B-2024-25',
      name: 'AIDS-B 2024-25',
      department: 'Artificial Intelligence And Data Science',
      year: 2,
      section: 'B',
      size: 68,
      mandatorySubjects: [
        'U24MA302', 'U24AD301', 'U24AD302', 'U24AD303', 'U24EC310', 'U24MC313',
        'U24AD304-Lab', 'U24AD302-Lab', 'U24AD303-Lab', 'U24EC310-Lab',
        'U24TP310', 'U24ED311', 'U24RM317'
      ],
      electiveGroups: [],
      maxDailyClasses: 8,
      specialRequirements: ['Lab Access Required', 'Computer Access', 'AI/ML Lab Access']
    }
  ];

  const sampleInstitution = {
    id: 'MSCE',
    name: 'Meenakshi Sundararajan College of Engineering',
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    periodsPerDay: 8,
    periodTimings: [
      { period: 1, startTime: '08:30', endTime: '09:20' },
      { period: 2, startTime: '09:20', endTime: '10:10' },
      { period: 3, startTime: '10:10', endTime: '11:00' },
      { period: 4, startTime: '11:20', endTime: '12:10' },
      { period: 5, startTime: '12:10', endTime: '13:00' },
      { period: 6, startTime: '13:40', endTime: '14:30' },
      { period: 7, startTime: '14:30', endTime: '15:20' },
      { period: 8, startTime: '15:20', endTime: '16:30' }
    ],
    breaks: [
      { name: 'Tea Break', startTime: '11:00', endTime: '11:20' },
      { name: 'Lunch Break', startTime: '13:00', endTime: '13:40' }
    ],
    semesterStart: '2025-07-21',
    semesterEnd: '2025-12-28',
    holidays: []
  };

  const loadSampleData = () => {
    setSubjects(sampleSubjects);
    setFaculty(sampleFaculty);
    setRooms(sampleRooms);
    setBatches(sampleBatches);
    
    // Also load the institution setup
    localStorage.setItem('institution', JSON.stringify(sampleInstitution));
    
    // Clear any existing timetables when loading fresh sample data
    localStorage.removeItem('generatedTimetables');
    localStorage.removeItem('savedTimetables');
    localStorage.removeItem('savedTimetableRegistry');
    
    // Calculate expected total classes for verification
    const totalExpectedClasses = sampleSubjects.reduce((total, subject) => {
      return total + (subject.sessionsPerWeek || 0);
    }, 0);
    
    console.log(`📚 Sample data loaded:`);
    console.log(`   Subjects: ${sampleSubjects.length}`);
    console.log(`   Faculty: ${sampleFaculty.length}`);
    console.log(`   Rooms: ${sampleRooms.length}`);
    console.log(`   Batches: ${sampleBatches.length}`);
    console.log(`   Expected classes per batch: ${totalExpectedClasses}`);
    console.log(`   Expected total classes: ${totalExpectedClasses * sampleBatches.length}`);
  };

  const handleSave = () => {
    // Validate all data before saving
    const allErrors: string[] = [];
    
    subjects.forEach((subject, index) => {
      const subjectErrors = validateSubject(subject);
      if (subjectErrors.length > 0) {
        allErrors.push(`Subject ${index + 1}: ${subjectErrors.join(', ')}`);
      }
    });
    
    faculty.forEach((member, index) => {
      const facultyErrors = validateFaculty(member);
      if (facultyErrors.length > 0) {
        allErrors.push(`Faculty ${index + 1}: ${facultyErrors.join(', ')}`);
      }
    });
    
    rooms.forEach((room, index) => {
      const roomErrors = validateRoom(room);
      if (roomErrors.length > 0) {
        allErrors.push(`Room ${index + 1}: ${roomErrors.join(', ')}`);
      }
    });
    
    batches.forEach((batch, index) => {
      const batchErrors = validateBatch(batch);
      if (batchErrors.length > 0) {
        allErrors.push(`Batch ${index + 1}: ${batchErrors.join(', ')}`);
      }
    });
    
    if (allErrors.length > 0) {
      setErrors(allErrors);
      return;
    }
    
    // Clear errors and save
    setErrors([]);
    localStorage.setItem('subjects', JSON.stringify(subjects));
    localStorage.setItem('faculty', JSON.stringify(faculty));
    localStorage.setItem('rooms', JSON.stringify(rooms));
    localStorage.setItem('batches', JSON.stringify(batches));
    setSaved(true);
    
    // Dispatch event for real-time updates
    window.dispatchEvent(new CustomEvent('dataUpdated', {
      detail: { subjects, faculty, rooms, batches }
    }));
    
    setTimeout(() => {
      onComplete();
    }, 1000);
  };

  // Clear stored timetables to force regeneration
  const clearStoredTimetables = () => {
    // Clear all timetable-related storage
    localStorage.removeItem('generatedTimetables');
    localStorage.removeItem('savedTimetables');
    localStorage.removeItem('savedTimetableRegistry');
    
    console.log('🧹 Cleared all stored timetable data:');
    console.log('   - Generated timetables');
    console.log('   - Saved timetables');
    console.log('   - Timetable registry');
    console.log('✨ Ready for fresh timetable generation!');
    
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    
    // Dispatch events to update all components
    window.dispatchEvent(new CustomEvent('timetablesCleared'));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Data Management</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox 
              id="auto-save" 
              checked={autoSave} 
              onCheckedChange={(checked) => setAutoSave(checked === true)}
            />
            <Label htmlFor="auto-save" className="text-sm">Auto-save</Label>
          </div>
          <Button onClick={loadSampleData} variant="outline">
            Load Sample Data
          </Button>
          <Button onClick={clearStoredTimetables} variant="outline" className="bg-orange-50 border-orange-200 text-orange-700">
            Clear Old Timetables
          </Button>
        </div>
      </div>

      <Tabs defaultValue="subjects" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="subjects" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Subjects ({subjects.length})
          </TabsTrigger>
          <TabsTrigger value="faculty" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Faculty ({faculty.length})
          </TabsTrigger>
          <TabsTrigger value="rooms" className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Rooms ({rooms.length})
          </TabsTrigger>
          <TabsTrigger value="batches" className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4" />
            Batches ({batches.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subjects" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="mb-2">Subjects & Courses</CardTitle>
                  <CardDescription>Manage academic subjects and their requirements</CardDescription>
                </div>
                <Button size="sm" onClick={openSubjectModal}>
                  <Plus className="w-4 h-4 mr-1" /> Add Subject
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {subjects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No subjects added yet. Click "Load Sample Data" to get started.
                </div>
              ) : (
                <div className="space-y-4">
                  {subjects.map((subject, idx) => (
                    <div key={subject.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-col gap-1">
                            <input
                              className="font-semibold border rounded px-2 py-1 w-full"
                              value={subject.name}
                              placeholder="Subject Name"
                              title="Enter the full name of the subject (e.g., Data Structures)"
                              onChange={e => {
                                const val = e.target.value;
                                setSubjects(prev => prev.map((s, i) => i === idx ? { ...s, name: val } : s));
                              }}
                            />
                            <small className="text-muted-foreground">Full name of the subject</small>
                          </div>
                          <div className="flex flex-col gap-1">
                            <input
                              className="text-sm border rounded px-2 py-1 w-full"
                              value={subject.code}
                              placeholder="Code"
                              title="Enter the subject code (e.g., U24AD302)"
                              onChange={e => {
                                const val = e.target.value;
                                setSubjects(prev => prev.map((s, i) => i === idx ? { 
                                  ...s, 
                                  code: val,
                                  id: generateSubjectId(val, s.type)
                                } : s));
                              }}
                            />
                            <small className="text-muted-foreground">Unique code for the subject</small>
                          </div>
                          <div className="flex flex-col gap-1">
                            <select
                              className="border rounded px-2 py-1"
                              value={subject.type}
                              title="Select the type of subject (Theory, Lab, Tutorial, Seminar)"
                              onChange={e => {
                                const val = e.target.value as 'Theory' | 'Lab' | 'Tutorial' | 'Seminar';
                                setSubjects(prev => prev.map((s, i) => i === idx ? { ...s, type: val } : s));
                              }}
                            >
                              <option value="Theory">Theory</option>
                              <option value="Lab">Lab</option>
                              <option value="Tutorial">Tutorial</option>
                              <option value="Seminar">Seminar</option>
                            </select>
                            <small className="text-muted-foreground">Type of subject</small>
                          </div>
                          <div className="flex flex-col gap-1">
                            <input
                              type="number"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              className="border rounded px-2 py-1 w-20"
                              value={subject.credits === 0 ? '' : subject.credits}
                              placeholder="Credits"
                              title="Enter the number of credits for the subject"
                              onChange={e => {
                                const val = Number(e.target.value);
                                setSubjects(prev => prev.map((s, i) => i === idx ? { ...s, credits: val } : s));
                              }}
                            />
                            <small className="text-muted-foreground">Number of credits</small>
                          </div>
                          <div className="flex flex-col gap-1">
                            <input
                              type="number"
                              className="border rounded px-2 py-1 w-32"
                              value={subject.weeklyHours === 0 ? '' : subject.weeklyHours}
                              placeholder="Hours/week"
                              title="Enter the total weekly hours for the subject"
                              onChange={e => {
                                const val = Number(e.target.value);
                                setSubjects(prev => prev.map((s, i) => i === idx ? { ...s, weeklyHours: val } : s));
                              }}
                            />
                            <small className="text-muted-foreground">Total weekly hours</small>
                          </div>
                          
                          {/* Scheduling Parameters Display */}
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div className="flex flex-col gap-1">
                              <span className="text-muted-foreground">Sessions/Week:</span>
                              <span className="font-medium">{subject.sessionsPerWeek || 1}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-muted-foreground">Duration:</span>
                              <span className="font-medium">{subject.sessionDuration || 50} min</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-muted-foreground">Continuous:</span>
                              <span className="font-medium">{subject.continuousHours || 1}h</span>
                            </div>
                          </div>
                          
                          {/* Enhanced Subject Configuration Button */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingItem(subject);
                              setIsSubjectDialogOpen(true);
                            }}
                            className="w-fit"
                          >
                            Configure Scheduling
                          </Button>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => {
                          setSubjects(prev => prev.filter((_, i) => i !== idx));
                        }}>Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faculty" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="mb-2">Faculty Members</CardTitle>
                  <CardDescription>Manage faculty information and teaching preferences</CardDescription>
                </div>
                <Button size="sm" onClick={openFacultyModal}>
                  <Plus className="w-4 h-4 mr-1" /> Add Faculty
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {faculty.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No faculty members added yet. Click "Load Sample Data" to get started.
                </div>
              ) : (
                <div className="space-y-4">
                  {faculty.map((member, idx) => (
                    <div key={member.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-col gap-1">
                            <input
                              className="font-semibold border rounded px-2 py-1 w-full"
                              value={member.name}
                              placeholder="Faculty Name"
                              title="Enter the full name of the faculty member"
                              onChange={e => {
                                const val = e.target.value;
                                setFaculty(prev => prev.map((f, i) => i === idx ? { ...f, name: val } : f));
                              }}
                            />
                            <small className="text-muted-foreground">Full name of the faculty member</small>
                          </div>
                          <div className="flex flex-col gap-1">
                            <input
                              className="text-sm border rounded px-2 py-1 w-full"
                              value={member.id}
                              placeholder="ID"
                              title="Enter a unique faculty ID (e.g., F001)"
                              onChange={e => {
                                const val = e.target.value;
                                setFaculty(prev => prev.map((f, i) => i === idx ? { ...f, id: val } : f));
                              }}
                            />
                            <small className="text-muted-foreground">Unique faculty ID</small>
                          </div>
                          <div className="flex flex-col gap-1">
                            <input
                              type="number"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              className="border rounded px-2 py-1 w-34"
                              value={member.maxWeeklyLoad === 0 ? '' : member.maxWeeklyLoad}
                              placeholder="Max Weekly Load"
                              title="Enter the maximum weekly teaching load for this faculty member"
                              onChange={e => {
                                const val = Number(e.target.value);
                                setFaculty(prev => prev.map((f, i) => i === idx ? { ...f, maxWeeklyLoad: val } : f));
                              }}
                            />
                            <small className="text-muted-foreground">Maximum weekly teaching load</small>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="font-medium">Eligible Subjects</label>
                            <div className="flex flex-wrap gap-2">
                              {subjects.filter(subj => subj.code).map(subj => (
                                <label key={subj.code} className="flex items-center gap-1">
                                  <input
                                    type="checkbox"
                                    checked={member.eligibleSubjects.includes(subj.code)}
                                    onChange={e => {
                                      const checked = e.target.checked;
                                      setFaculty(prev => prev.map((f, i) => {
                                        if (i !== idx) return f;
                                        const newEligible = checked
                                          ? [...f.eligibleSubjects, subj.code]
                                          : f.eligibleSubjects.filter(code => code !== subj.code);
                                        return { ...f, eligibleSubjects: newEligible };
                                      }));
                                    }}
                                  />
                                  <span className="text-xs">{subj.code}</span>
                                </label>
                              ))}
                            </div>
                            <small className="text-muted-foreground">Select subjects this faculty can teach</small>
                          </div>

                          <div className="flex flex-col gap-1 mt-2">
                            <label className="font-medium">Preferred Rooms</label>
                            <div className="flex flex-wrap gap-2">
                              {rooms.filter(room => room.id && room.name).map(room => (
                                <label key={room.id} className="flex items-center gap-1">
                                  <input
                                    type="checkbox"
                                    checked={member.preferredRooms && member.preferredRooms.includes(room.id)}
                                    onChange={e => {
                                      const checked = e.target.checked;
                                      setFaculty(prev => prev.map((f, i) => {
                                        if (i !== idx) return f;
                                        const newPreferred = checked
                                          ? [...(f.preferredRooms || []), room.id]
                                          : (f.preferredRooms || []).filter(id => id !== room.id);
                                        return { ...f, preferredRooms: newPreferred };
                                      }));
                                    }}
                                  />
                                  <span className="text-xs">{room.name}</span>
                                </label>
                              ))}
                            </div>
                            <small className="text-muted-foreground">Select rooms this faculty prefers</small>
                          </div>
                          
                          {/* Faculty Constraints Display */}
                          <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                            <div className="flex flex-col gap-1">
                              <span className="text-muted-foreground">Max Daily Hours:</span>
                              <span className="font-medium">{member.preferences?.maxDailyHours || 4}h</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-muted-foreground">Leave Frequency:</span>
                              <span className="font-medium">{((member.leaveFrequency || 0) * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                          
                          {/* Enhanced Faculty Configuration Button */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingItem(member);
                              setIsFacultyDialogOpen(true);
                            }}
                            className="w-fit mt-2"
                          >
                            Configure Faculty Details
                          </Button>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => {
                              setEditingItem(member);
                              setIsFacultyDialogOpen(true);
                            }}
                          >
                            Edit Details
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => {
                            setFaculty(prev => prev.filter((_, i) => i !== idx));
                          }}>Delete</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rooms" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="mb-2">Rooms & Resources</CardTitle>
                  <CardDescription>Manage classroom and laboratory resources</CardDescription>
                </div>
                <Button size="sm" onClick={openRoomModal}>
                  <Plus className="w-4 h-4 mr-1" /> Add Room
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {rooms.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No rooms added yet. Click "Load Sample Data" to get started.
                </div>
              ) : (
                <div className="space-y-4">
                  {rooms.map((room, idx) => (
                    <div key={room.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-col gap-1">
                            <input
                              className="font-semibold border rounded px-2 py-1 w-full"
                              value={room.name}
                              placeholder="Room Name"
                              title="Enter the name of the room or lab"
                              onChange={e => {
                                const val = e.target.value;
                                setRooms(prev => prev.map((r, i) => i === idx ? { ...r, name: val } : r));
                              }}
                            />
                            <small className="text-muted-foreground">Name of the room or lab</small>
                          </div>
                          <div className="flex flex-col gap-1">
                            <input
                              className="text-sm border rounded px-2 py-1 w-full"
                              value={room.location}
                              placeholder="Location"
                              title="Enter the location (e.g., Block A)"
                              onChange={e => {
                                const val = e.target.value;
                                setRooms(prev => prev.map((r, i) => i === idx ? { ...r, location: val } : r));
                              }}
                            />
                            <small className="text-muted-foreground">Location of the room</small>
                          </div>
                          <div className="flex flex-col gap-1">
                            <select
                              className="border rounded px-2 py-1"
                              value={room.type}
                              title="Select the type of room (Classroom, Lab, Seminar Hall, Auditorium)"
                              onChange={e => {
                                const val = e.target.value as 'Classroom' | 'Lab' | 'Seminar Hall' | 'Auditorium';
                                setRooms(prev => prev.map((r, i) => i === idx ? { ...r, type: val } : r));
                              }}
                            >
                              <option value="Classroom">Classroom</option>
                              <option value="Lab">Lab</option>
                              <option value="Seminar Hall">Seminar Hall</option>
                              <option value="Auditorium">Auditorium</option>
                            </select>
                            <small className="text-muted-foreground">Type of room</small>
                          </div>
                          <div className="flex flex-col gap-1">
                            <input
                              type="number"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              className="border rounded px-2 py-1 w-24"
                              value={room.capacity === 0 ? '' : room.capacity}
                              placeholder="Capacity"
                              title="Enter the seating or equipment capacity of the room"
                              onChange={e => {
                                const val = Number(e.target.value);
                                setRooms(prev => prev.map((r, i) => i === idx ? { ...r, capacity: val } : r));
                              }}
                            />
                            <small className="text-muted-foreground">Room capacity</small>
                          </div>
                          
                          {/* Room Parameters Display */}
                          <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                            <div className="flex flex-col gap-1">
                              <span className="text-muted-foreground">Equipment:</span>
                              <span className="font-medium">{room.equipment?.length || 0} items</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-muted-foreground">Availability:</span>
                              <span className="font-medium">{room.availability?.length || 0} slots</span>
                            </div>
                          </div>
                          
                          {/* Enhanced Room Configuration Button */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingItem(room);
                              setIsRoomDialogOpen(true);
                            }}
                            className="w-fit mt-2"
                          >
                            Configure Room Details
                          </Button>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => {
                              setEditingItem(room);
                              setIsRoomDialogOpen(true);
                            }}
                          >
                            Edit Details
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => {
                            setRooms(prev => prev.filter((_, i) => i !== idx));
                          }}>Delete</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batches" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="mb-2">Student Batches</CardTitle>
                  <CardDescription>Manage student groups and their course requirements</CardDescription>
                </div>
                <Button size="sm" onClick={openBatchModal}>
                  <Plus className="w-4 h-4 mr-1" /> Add Batch
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {batches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No student batches added yet. Click "Load Sample Data" to get started.
                </div>
              ) : (
                <div className="space-y-4">
                  {batches.map((batch, idx) => (
                    <div key={batch.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-col gap-1">
                            <input
                              className="font-semibold border rounded px-2 py-1 w-full"
                              value={batch.name}
                              placeholder="Batch Name"
                              title="Enter the name of the batch (e.g., CSE 2nd Year A)"
                              onChange={e => {
                                const val = e.target.value;
                                setBatches(prev => prev.map((b, i) => i === idx ? { ...b, name: val } : b));
                              }}
                            />
                            <small className="text-muted-foreground">Name of the student batch</small>
                          </div>
                            <div className="flex flex-col gap-1">
                              <label className="font-medium">Assigned Classroom</label>
                              <select
                                className="border rounded px-2 py-1 w-full"
                                value={batch.assignedRoomId || ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  setBatches(prev => prev.map((b, i) => i === idx ? { ...b, assignedRoomId: val } : b));
                                }}
                              >
                                <option value="">Select a room</option>
                                {rooms.map(room => (
                                  <option key={room.id} value={room.id}>{room.name} ({room.type}, {room.location})</option>
                                ))}
                              </select>
                              <small className="text-muted-foreground">Link this batch to a room for default allocation (Classroom, Lab, etc.)</small>
                            </div>
                          <div className="flex flex-col gap-1">
                            <input
                              className="text-sm border rounded px-2 py-1 w-full"
                              value={batch.department}
                              placeholder="Department"
                              title="Enter the department (e.g., Computer Science)"
                              onChange={e => {
                                const val = e.target.value;
                                setBatches(prev => prev.map((b, i) => i === idx ? { ...b, department: val } : b));
                              }}
                            />
                            <small className="text-muted-foreground">Department of the batch</small>
                          </div>
                          <div className="flex flex-col gap-1">
                            <input
                              type="number"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              className="border rounded px-2 py-1 w-16"
                              value={batch.year === 0 ? '' : batch.year}
                              placeholder="Year"
                              title="Enter the year of study (e.g., 2 for 2nd year)"
                              onChange={e => {
                                const val = Number(e.target.value);
                                setBatches(prev => prev.map((b, i) => i === idx ? { ...b, year: val } : b));
                              }}
                            />
                            <small className="text-muted-foreground">Year of study</small>
                          </div>
                          <div className="flex flex-col gap-1">
                            <input
                              className="border rounded px-2 py-1 w-12"
                              value={batch.section}
                              placeholder="Section"
                              title="Enter the section (e.g., A, B)"
                              onChange={e => {
                                const val = e.target.value;
                                setBatches(prev => prev.map((b, i) => i === idx ? { ...b, section: val } : b));
                              }}
                            />
                            <small className="text-muted-foreground">Section of the batch</small>
                          </div>
                          <div className="flex flex-col gap-1">
                            <input
                              type="number"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              className="border rounded px-2 py-1 w-32"
                              value={batch.size === 0 ? '' : batch.size}
                              placeholder="Size"
                              title="Enter the number of students in the batch"
                              onChange={e => {
                                const val = Number(e.target.value);
                                setBatches(prev => prev.map((b, i) => i === idx ? { ...b, size: val } : b));
                              }}
                            />
                            <small className="text-muted-foreground">Number of students</small>
                          </div>
                          
                          {/* Batch Parameters Display */}
                          <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                            <div className="flex flex-col gap-1">
                              <span className="text-muted-foreground">Mandatory Subjects:</span>
                              <span className="font-medium">{batch.mandatorySubjects?.length || 0} subjects</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-muted-foreground">Max Daily Classes:</span>
                              <span className="font-medium">{batch.maxDailyClasses || 8} classes</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-muted-foreground">Elective Groups:</span>
                              <span className="font-medium">{batch.electiveGroups?.length || 0} groups</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-muted-foreground">Special Requirements:</span>
                              <span className="font-medium">{batch.specialRequirements?.length || 0} items</span>
                            </div>
                          </div>
                          
                          {/* Enhanced Batch Configuration Button */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingItem(batch);
                              setIsBatchDialogOpen(true);
                            }}
                            className="w-fit mt-2"
                          >
                            Configure Batch Details
                          </Button>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => {
                              setEditingItem(batch);
                              setIsBatchDialogOpen(true);
                            }}
                          >
                            Edit Details
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => {
                            setBatches(prev => prev.filter((_, i) => i !== idx));
                          }}>Delete</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <Card>
        <CardContent className="pt-6">
          {errors.length > 0 && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded p-3">
              <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
                <AlertCircle className="w-4 h-4" />
                Please fix the following errors before saving:
              </div>
              <ul className="text-red-700 text-sm ml-6 list-disc">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Data Status</h3>
              <p className="text-sm text-muted-foreground">
                {saved ? 'All data saved successfully!' : 'Save your data to proceed with optimization'}
                {autoSave && !saved && ' (Auto-save enabled)'}
              </p>
            </div>
            <Button 
              onClick={handleSave} 
              disabled={subjects.length === 0 || (saved && errors.length === 0)} 
              className="min-w-32"
            >
              {saved && errors.length === 0 ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Data
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal Dialogs - Render only when needed */}
      {isSubjectDialogOpen && <SubjectDialog />}
      {isFacultyDialogOpen && <FacultyDialog />}
      {isRoomDialogOpen && <RoomDialog />}
      {isBatchDialogOpen && <BatchDialog />}
    </div>
  );
}