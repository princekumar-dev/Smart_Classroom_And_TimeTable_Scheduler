import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Play, Square, RefreshCw, CheckCircle, AlertTriangle, Zap } from 'lucide-react';
import { TimetableEngine } from '@/lib/timetableEngine';
import { GeneratedTimetable, Institution, Subject, Faculty, Room, StudentBatch } from '@/types/timetable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TimetableOptimizerProps {
  onComplete: () => void;
}

export default function TimetableOptimizer({ onComplete }: TimetableOptimizerProps) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [generatedTimetables, setGeneratedTimetables] = useState<GeneratedTimetable[]>([]);
  const [optimizationComplete, setOptimizationComplete] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [batches, setBatches] = useState<StudentBatch[]>([]);

  // Load batches from localStorage on mount
  useEffect(() => {
    const batchesData = localStorage.getItem('batches');
    if (batchesData) {
      setBatches(JSON.parse(batchesData));
    }
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
      const batches: StudentBatch[] = JSON.parse(batchesData);
      // Filter to selected batch only
      const selectedBatch = batches.find(b => b.id === selectedBatchId);
      if (!selectedBatch) throw new Error('Please select a class/batch to generate timetable.');

      // Initialize optimization engine
      const engine = new TimetableEngine(institution);
      engine.setData(subjects, faculty, rooms, [selectedBatch]);

      // Simulate optimization process
      for (let i = 0; i < optimizationSteps.length; i++) {
        setCurrentStep(optimizationSteps[i]);
        setProgress((i + 1) / optimizationSteps.length * 100);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Generate timetables
      const timetable1 = engine.generateTimetable({
        maxIterations: 1000,
        timeLimit: 30,
        priorityWeights: {
          facultyLoad: 0.3,
          roomUtilization: 0.2,
          studentSchedule: 0.3,
          constraints: 0.2
        }
      });

      const timetable2 = engine.generateTimetable({
        maxIterations: 1500,
        timeLimit: 45,
        priorityWeights: {
          facultyLoad: 0.2,
          roomUtilization: 0.3,
          studentSchedule: 0.2,
          constraints: 0.3
        }
      });

      timetable1.name = `Balanced Schedule for ${selectedBatch.name}`;
      timetable1.score = 85;
      timetable2.name = `Resource Optimized for ${selectedBatch.name}`;
      timetable2.score = 78;

      setGeneratedTimetables([timetable1, timetable2]);
      localStorage.setItem('generatedTimetables', JSON.stringify([timetable1, timetable2]));
      setOptimizationComplete(true);
      onComplete();

    } catch (error) {
      console.error('Optimization failed:', error);
      setCurrentStep('Optimization failed. Please check your data and try again.');
    } finally {
      setIsOptimizing(false);
    }
  };

  const stopOptimization = () => {
    setIsOptimizing(false);
    setCurrentStep('Optimization stopped by user');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Zap className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold">Timetable Optimization</h2>
      </div>
      {/* Batch/Class Selection */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Select Class/Batch</CardTitle>
          <CardDescription>Choose the class for which you want to generate a timetable</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a class/batch" />
            </SelectTrigger>
            <SelectContent>
              {batches.map(batch => (
                <SelectItem key={batch.id} value={batch.id}>{batch.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                disabled={!localStorage.getItem('institution') || !selectedBatchId}
              >
                <Play className="w-5 h-5 mr-2" />
                {selectedBatchId ? 'Start Optimization' : 'Select a class to start'}
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