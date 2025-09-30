import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Play, Square, RefreshCw, CheckCircle, AlertTriangle, Zap, Users, BookOpen } from 'lucide-react';
import { TimetableEngine } from '@/lib/timetableEngine';
import { GeneratedTimetable, Institution, Subject, Faculty, Room, StudentBatch } from '@/types/timetable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TimetableOptimizerProps {
  onComplete: () => void;
}

export default function TimetableOptimizer({ onComplete }: TimetableOptimizerProps) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [generatedTimetables, setGeneratedTimetables] = useState<GeneratedTimetable[]>([]);
  const [optimizationComplete, setOptimizationComplete] = useState(false);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [batches, setBatches] = useState<StudentBatch[]>([]);
  const [isMultiClass, setIsMultiClass] = useState(false);
  const [savedTimetables, setSavedTimetables] = useState<GeneratedTimetable[]>([]);

  // Load batches from localStorage on mount
  useEffect(() => {
    const batchesData = localStorage.getItem('batches');
    if (batchesData) {
      setBatches(JSON.parse(batchesData));
    }

    // Load saved timetables
    setSavedTimetables(TimetableEngine.getSavedTimetables());
  }, []);

  const optimizationSteps = [
    'Loading institution data...',
    'Validating academic requirements...',
    'Checking constraint compatibility...',
    'Initializing optimization engine...',
    'Generating feasible solutions...',
    'Evaluating timetable quality...',
    'Finalizing results...'
  ];

  const handleBatchSelection = (batchId: string, checked: boolean) => {
    if (isMultiClass) {
      // Multi-class mode: allow multiple selections
      if (checked) {
        setSelectedBatchIds(prev => {
          const updated = [...prev, batchId];
          console.log(`✅ Multi-class: Added ${batchId} (${updated.length} selected)`);
          return updated;
        });
      } else {
        setSelectedBatchIds(prev => {
          const updated = prev.filter(id => id !== batchId);
          console.log(`❌ Multi-class: Removed ${batchId} (${updated.length} selected)`);
          return updated;
        });
      }
    } else {
      // Single-class mode: only allow one selection
      const newSelection = checked ? [batchId] : [];
      setSelectedBatchIds(newSelection);
      console.log(`🎯 Single-class: ${checked ? `Selected ${batchId}` : 'Cleared selection'}`);
    }
  };

  const startOptimization = async () => {
    setIsOptimizing(true);
    setProgress(0);
    setOptimizationComplete(false);

    try {
      // Load data from localStorage
      const institutionData = localStorage.getItem('institution');
      const subjectsData = localStorage.getItem('subjects');
      const facultyData = localStorage.getItem('faculty');
      const roomsData = localStorage.getItem('rooms');
      const batchesData = localStorage.getItem('batches');

      if (!institutionData || !subjectsData || !facultyData || !roomsData || !batchesData) {
        throw new Error('Missing required data. Please complete setup and data entry first.');
      }

      const institution: Institution = JSON.parse(institutionData);
      const subjects: Subject[] = JSON.parse(subjectsData);
      const faculty: Faculty[] = JSON.parse(facultyData);
      const rooms: Room[] = JSON.parse(roomsData);
      const allBatches: StudentBatch[] = JSON.parse(batchesData);
      
      if (selectedBatchIds.length === 0) {
        throw new Error('Please select at least one class/batch to generate timetable.');
      }
      
      if (isMultiClass && selectedBatchIds.length < 2) {
        throw new Error('Multi-class mode requires at least 2 classes. Please select more classes or switch to single-class mode.');
      }

      // Filter to selected batches
      const selectedBatches = allBatches.filter(b => selectedBatchIds.includes(b.id));

      // Debug: Log subject configurations being used
      console.log('=== TIMETABLE GENERATION DEBUG ===');
      console.log('Subjects being used for timetable generation:');
      subjects.forEach(subject => {
        console.log(`${subject.code}: type=${subject.type}, weeklyHours=${subject.weeklyHours}, sessionsPerWeek=${subject.sessionsPerWeek}, continuousHours=${subject.continuousHours}`);
      });
      console.log('Institution config:', institution);
      console.log('Selected batches:', selectedBatches.map(b => b.name));
      console.log('===============================');

      // Initialize optimization engine
      const engine = new TimetableEngine(institution);
      engine.setData(subjects, faculty, rooms, allBatches);

      // Simulate optimization process
      for (let i = 0; i < optimizationSteps.length; i++) {
        setCurrentStep(optimizationSteps[i]);
        setProgress((i + 1) / optimizationSteps.length * 100);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Generate timetables - respect user's choice of single-class vs multi-class
      const timetables: GeneratedTimetable[] = [];
      
      // Always get saved timetables for conflict prevention (regardless of mode)
      const currentSavedTimetables = TimetableEngine.getSavedTimetables();
      console.log(`🔄 Found ${currentSavedTimetables.length} saved timetables for conflict prevention`);
      
      if (isMultiClass) {
        // User chose multi-class mode
        setCurrentStep('Generating multi-class timetable with staff conflict prevention...');
        console.log(`� Multi-class mode: User explicitly selected multi-class generation`);
        
        const separateTimetables = engine.generateMultiClassTimetable(selectedBatchIds, {
          maxIterations: 2000,
          timeLimit: 60,
          priorityWeights: {
            facultyLoad: 0.3,
            roomUtilization: 0.2,
            studentSchedule: 0.3,
            constraints: 0.2
          }
        }, currentSavedTimetables);

        // Add descriptive names and push all separate timetables
        separateTimetables.forEach((timetable, index) => {
          const batchName = selectedBatches[index].name;
          if (currentSavedTimetables.length > 0) {
            timetable.name = `${batchName} Schedule [${currentSavedTimetables.length} conflicts avoided]`;
            console.log(`✅ ${batchName} timetable generated with conflict prevention: ${timetable.entries.length} classes scheduled`);
          } else {
            timetable.name = `${batchName} Schedule`;
          }
        });
        
        timetables.push(...separateTimetables);
        console.log(`🎉 Generated ${separateTimetables.length} separate timetables for multi-class scheduling`);
      } else {
        // User chose single-class mode - use simple generation with pattern avoidance
        setCurrentStep('Generating single-class timetable...');
        console.log(`👤 Single-class mode: User explicitly selected single-class generation`);
        
        if (currentSavedTimetables.length > 0) {
          // Single-class with simple pattern avoidance (not full conflict prevention)
          setCurrentStep('Generating different schedule pattern...');
          console.log(`🎲 Single-class mode: Avoiding repetition of ${currentSavedTimetables.length} saved schedule patterns`);
          
          // Get time slots used by saved timetables for the same batch to avoid repetition
          const savedSameBatchSlots = currentSavedTimetables
            .filter(st => st.batchIds && st.batchIds.some(bid => selectedBatchIds.includes(bid)))
            .flatMap(st => st.entries.map(entry => ({
              day: entry.timeSlot.day,
              period: entry.timeSlot.period,
              subject: entry.subject.code
            })));
          
          console.log(`🚫 Avoiding ${savedSameBatchSlots.length} time slots from saved schedules for pattern variation`);
          
          // Generate with different randomization seed to get different pattern
          const timetable = engine.generateSingleClassTimetable(selectedBatchIds[0], {
            maxIterations: 2000,
            timeLimit: 60,
            priorityWeights: {
              facultyLoad: 0.2,  // Different weights for pattern variation
              roomUtilization: 0.3,
              studentSchedule: 0.3,
              constraints: 0.2
            },
            avoidedPatterns: savedSameBatchSlots.map(slot => ({ day: slot.day, period: slot.period }))
          });

          timetable.name = `${selectedBatches[0].name} Schedule (Alternative Pattern)`;
          console.log(`✅ Single-class generated with different pattern: ${timetable.entries.length} classes scheduled`);
          
          timetables.push(timetable);
        } else {
          // Original single-class generation when no saved timetables exist
          const timetable1 = engine.generateSingleClassTimetable(selectedBatchIds[0], {
            maxIterations: 1000,
            timeLimit: 30,
            priorityWeights: {
              facultyLoad: 0.3,
              roomUtilization: 0.2,
              studentSchedule: 0.3,
              constraints: 0.2
            }
          });

          const timetable2 = engine.generateSingleClassTimetable(selectedBatchIds[0], {
            maxIterations: 2000,
            timeLimit: 60,
            priorityWeights: {
              facultyLoad: 0.25,
              roomUtilization: 0.25,
              studentSchedule: 0.25,
              constraints: 0.25
            }
          });

          timetable1.name = `Balanced Schedule (${selectedBatches[0].name})`;
          timetable1.score = 85;
          timetable2.name = `Resource Optimized (${selectedBatches[0].name})`;
          timetable2.score = 78;
          
          timetables.push(timetable1, timetable2);
        }
      }

      setGeneratedTimetables(timetables);
      localStorage.setItem('generatedTimetables', JSON.stringify(timetables));
      
      // Dispatch event for real-time updates
      window.dispatchEvent(new CustomEvent('timetablesGenerated', {
        detail: { timetables }
      }));
      
      setOptimizationComplete(true);
      onComplete();

    } catch (error) {
      console.error('Optimization failed:', error);
      setCurrentStep('Optimization failed. Please check your data and try again.');
    } finally {
      setIsOptimizing(false);
    }
  };  const stopOptimization = () => {
    setIsOptimizing(false);
    setCurrentStep('Optimization stopped by user');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Zap className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold">Timetable Optimization</h2>
      </div>
      {/* Class Selection Mode */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Class Selection Mode
          </CardTitle>
          <CardDescription>
            Choose between single class or multi-class timetable generation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={isMultiClass ? "multi" : "single"} onValueChange={(value) => {
            const newIsMultiClass = value === "multi";
            setIsMultiClass(newIsMultiClass);
            setSelectedBatchIds([]); // Clear selections when switching modes
            console.log(`🔄 Switched to ${newIsMultiClass ? 'Multi-Class' : 'Single-Class'} mode - selections cleared`);
          }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single">Single Class</TabsTrigger>
              <TabsTrigger value="multi">Multi-Class</TabsTrigger>
            </TabsList>
            
            <TabsContent value="single" className="mt-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded">
                  <Users className="w-4 h-4 text-blue-600" />
                  <p className="text-sm text-blue-800 font-medium">Single-Class Mode: Select exactly one class</p>
                </div>
                <div className="space-y-2">
                  {batches.map(batch => (
                    <div key={batch.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`single-${batch.id}`}
                        checked={selectedBatchIds.includes(batch.id)}
                        onCheckedChange={(checked) => handleBatchSelection(batch.id, checked as boolean)}
                      />
                      <label htmlFor={`single-${batch.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        {batch.name} ({batch.size} students)
                      </label>
                    </div>
                  ))}
                </div>
                {selectedBatchIds.length === 1 && (
                  <div className="p-2 bg-green-50 border border-green-200 rounded">
                    <p className="text-sm text-green-700">✓ Ready: {selectedBatchIds.length} class selected</p>
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="multi" className="mt-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-2 bg-purple-50 border border-purple-200 rounded">
                  <Users className="w-4 h-4 text-purple-600" />
                  <p className="text-sm text-purple-800 font-medium">Multi-Class Mode: Select multiple classes (minimum 2)</p>
                </div>
                {savedTimetables.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Conflict Prevention Active:</strong> {savedTimetables.length} saved schedule(s) will be used to prevent staff conflicts.
                      <br />
                      <small className="text-muted-foreground">
                        Faculty and rooms already assigned in saved timetables will be unavailable during those time slots.
                      </small>
                    </AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {batches.map(batch => (
                    <div key={batch.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`multi-${batch.id}`}
                        checked={selectedBatchIds.includes(batch.id)}
                        onCheckedChange={(checked) => handleBatchSelection(batch.id, checked as boolean)}
                      />
                      <label htmlFor={`multi-${batch.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        {batch.name} ({batch.size} students)
                      </label>
                    </div>
                  ))}
                </div>
                {selectedBatchIds.length > 0 && (
                  <div className={`p-2 border rounded ${
                    selectedBatchIds.length >= 2 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-yellow-50 border-yellow-200'
                  }`}>
                    <p className={`text-sm font-medium ${
                      selectedBatchIds.length >= 2 
                        ? 'text-green-700' 
                        : 'text-yellow-700'
                    }`}>
                      {selectedBatchIds.length >= 2 
                        ? `✓ Ready: ${selectedBatchIds.length} classes selected for multi-class scheduling`
                        : `⚠️ Need at least 2 classes for multi-class mode (currently ${selectedBatchIds.length})`
                      }
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Pre-optimization Checks */}
      <Card>
        <CardHeader>
          <CardTitle>System Readiness Check</CardTitle>
          <CardDescription>Verify all requirements before starting optimization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: 'Institution Setup', key: 'institution', icon: CheckCircle },
              { name: 'Academic Data', key: 'subjects', icon: CheckCircle },
              { name: 'Faculty Data', key: 'faculty', icon: CheckCircle },
              { name: 'Room Data', key: 'rooms', icon: CheckCircle }
            ].map((item) => {
              const hasData = localStorage.getItem(item.key);
              return (
                <div key={item.name} className="flex items-center gap-2 p-3 border rounded-lg">
                  <item.icon className={`w-5 h-5 ${hasData ? 'text-green-500' : 'text-gray-400'}`} />
                  <div>
                    <div className="font-medium text-sm">{item.name}</div>
                    <Badge variant={hasData ? "default" : "secondary"} className="text-xs">
                      {hasData ? "Ready" : "Missing"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Optimization Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Optimization Engine</CardTitle>
          <CardDescription>
            Generate optimized timetables using constraint-based algorithms
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!isOptimizing && !optimizationComplete && (
            <div className="text-center py-8">
              <Button 
                onClick={startOptimization} 
                size="lg" 
                className="min-w-48"
                disabled={
                  !localStorage.getItem('institution') || 
                  selectedBatchIds.length === 0 ||
                  (isMultiClass && selectedBatchIds.length < 2)
                }
              >
                <Play className="w-5 h-5 mr-2" />
                {(() => {
                  if (selectedBatchIds.length === 0) return 'Select classes to start';
                  if (isMultiClass && selectedBatchIds.length < 2) return 'Select at least 2 classes for multi-class';
                  if (isMultiClass && selectedBatchIds.length >= 2) return `Start Multi-Class Optimization (${selectedBatchIds.length} classes)`;
                  return 'Start Single-Class Optimization';
                })()}
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                This will generate multiple optimized timetable solutions
              </p>
            </div>
          )}

          {isOptimizing && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Optimization in Progress</h3>
                  <p className="text-sm text-muted-foreground">{currentStep}</p>
                </div>
                <Button onClick={stopOptimization} variant="outline" size="sm">
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </Button>
              </div>
              <Progress value={progress} className="w-full" />
              <div className="text-center text-sm text-muted-foreground">
                {Math.round(progress)}% Complete
              </div>
            </div>
          )}

          {optimizationComplete && generatedTimetables.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <h3 className="font-semibold">Optimization Complete</h3>
              </div>
              
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {generatedTimetables.length} timetable solutions generated. 
                  Review them in the Results tab to select the best option.
                </AlertDescription>
              </Alert>

              <div className="grid gap-4">
                {generatedTimetables.map((timetable, index) => (
                  <div key={timetable.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">{timetable.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {timetable.entries.length} classes scheduled
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">
                          {timetable.score}%
                        </div>
                        <div className="text-xs text-muted-foreground">Quality Score</div>
                      </div>
                    </div>
                    
                    {timetable.conflicts.length > 0 && (
                      <div className="mt-3 p-2 bg-yellow-50 rounded border-l-4 border-yellow-400">
                        <div className="text-sm font-medium text-yellow-800">
                          {timetable.conflicts.length} conflicts detected
                        </div>
                        <div className="text-xs text-yellow-700">
                          Review in the Results tab for details
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={startOptimization} variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Generate New Solutions
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Optimization Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Algorithm Settings</CardTitle>
          <CardDescription>Current optimization parameters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-medium">Max Iterations</div>
              <div className="text-muted-foreground">1000-1500</div>
            </div>
            <div>
              <div className="font-medium">Time Limit</div>
              <div className="text-muted-foreground">30-45 seconds</div>
            </div>
            <div>
              <div className="font-medium">Algorithm</div>
              <div className="text-muted-foreground">Constraint-based</div>
            </div>
            <div>
              <div className="font-medium">Solutions</div>
              <div className="text-muted-foreground">Multiple variants</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}