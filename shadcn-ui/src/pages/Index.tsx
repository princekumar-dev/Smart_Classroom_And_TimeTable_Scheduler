import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, 
  Users, 
  BookOpen, 
  MapPin, 
  Settings, 
  Play, 
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  Archive,
  AlertTriangle
} from 'lucide-react';
import InstitutionSetup from '@/components/InstitutionSetup';
import DataManagement from '@/components/DataManagement';
import ConstraintManager from '@/components/ConstraintManager';
import TimetableOptimizer from '@/components/TimetableOptimizer';
import TimetableViewer from '@/components/TimetableViewer';

export default function Index() {
  // Remove all saved setup and data
  const handleRemoveAllData = () => {
    localStorage.removeItem('institution');
    localStorage.removeItem('subjects');
    localStorage.removeItem('faculty');
    localStorage.removeItem('rooms');
    localStorage.removeItem('batches');
    window.location.reload();
  };
  const [activeTab, setActiveTab] = useState('dashboard');
  const [setupComplete, setSetupComplete] = useState(false);
  const [dataComplete, setDataComplete] = useState(false);
  const [optimizationComplete, setOptimizationComplete] = useState(false);

  // Real-time stats from localStorage
  const [facultyCount, setFacultyCount] = useState(0);
  const [subjectCount, setSubjectCount] = useState(0);
  const [roomCount, setRoomCount] = useState(0);
  const [batchCount, setBatchCount] = useState(0);
  
  // Real-time timetables from localStorage
  const [recentTimetables, setRecentTimetables] = useState<any[]>([]);
  const [savedTimetables, setSavedTimetables] = useState<any[]>([]);

  useEffect(() => {
    const updateStats = () => {
      const faculty = JSON.parse(localStorage.getItem('faculty') || '[]');
      setFacultyCount(faculty.length);
      const subjects = JSON.parse(localStorage.getItem('subjects') || '[]');
      setSubjectCount(subjects.length);
      const rooms = JSON.parse(localStorage.getItem('rooms') || '[]');
      setRoomCount(rooms.length);
      const batches = JSON.parse(localStorage.getItem('batches') || '[]');
      setBatchCount(batches.length);
      
      // Load recent timetables
      const timetables = JSON.parse(localStorage.getItem('generatedTimetables') || '[]');
      setRecentTimetables(timetables);
      
      // Load saved timetables
      try {
        const saved = localStorage.getItem('savedTimetableRegistry');
        if (saved) {
          const registry = JSON.parse(saved);
          setSavedTimetables(registry.timetables || []);
        }
      } catch (error) {
        console.error('Error loading saved timetables:', error);
        setSavedTimetables([]);
      }
    };

    // Initial load
    updateStats();

    // Listen for real-time data updates from DataManagement component
    const handleDataUpdate = () => {
      updateStats();
    };

    // Listen for timetable generation updates
    const handleTimetableUpdate = () => {
      const timetables = JSON.parse(localStorage.getItem('generatedTimetables') || '[]');
      setRecentTimetables(timetables);
    };

    // Listen for saved timetable updates
    const handleTimetableSaved = () => {
      try {
        const saved = localStorage.getItem('savedTimetableRegistry');
        if (saved) {
          const registry = JSON.parse(saved);
          setSavedTimetables(registry.timetables || []);
        }
      } catch (error) {
        console.error('Error loading saved timetables:', error);
      }
    };

    window.addEventListener('dataUpdated', handleDataUpdate);
    window.addEventListener('timetablesGenerated', handleTimetableUpdate);
    window.addEventListener('timetableSaved', handleTimetableSaved);
    
    // Also listen for storage changes (if data is modified elsewhere)
    window.addEventListener('storage', updateStats);

    return () => {
      window.removeEventListener('dataUpdated', handleDataUpdate);
      window.removeEventListener('timetablesGenerated', handleTimetableUpdate);
      window.removeEventListener('timetableSaved', handleTimetableSaved);
      window.removeEventListener('storage', updateStats);
    };
  }, [activeTab]);

  const stats = [
    { title: 'Total Faculty', value: facultyCount, icon: Users, color: 'bg-blue-500' },
    { title: 'Subjects', value: subjectCount, icon: BookOpen, color: 'bg-green-500' },
    { title: 'Rooms', value: roomCount, icon: MapPin, color: 'bg-purple-500' },
    { title: 'Batches', value: batchCount, icon: Users, color: 'bg-orange-500' }
  ];

  const workflowSteps = [
    { 
      id: 'setup', 
      title: 'Institution Setup', 
      description: 'Configure basic institution details and calendar',
      completed: setupComplete,
      tab: 'setup'
    },
    { 
      id: 'data', 
      title: 'Data Management', 
      description: 'Add faculty, subjects, rooms, and student batches',
      completed: dataComplete,
      tab: 'data'
    },
    { 
      id: 'constraints', 
      title: 'Constraint Configuration', 
      description: 'Set up scheduling rules and preferences',
      completed: false,
      tab: 'constraints'
    },
    { 
      id: 'optimize', 
      title: 'Generate Timetable', 
      description: 'Run optimization algorithm to create schedules',
      completed: optimizationComplete,
      tab: 'optimizer'
    },
    { 
      id: 'review', 
      title: 'Review & Publish', 
      description: 'Review generated timetables and publish approved version',
      completed: false,
      tab: 'viewer'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                Timetable Scheduler Platform
              </h1>
              <p className="text-lg text-muted-foreground">
                Intelligent academic scheduling with constraint-based optimization
              </p>
            </div>
            <Button variant="destructive" className="ml-4" onClick={handleRemoveAllData}>
              Remove All Data
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="setup" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Setup
            </TabsTrigger>
            <TabsTrigger value="data" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Data
            </TabsTrigger>
            <TabsTrigger value="constraints" className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Constraints
            </TabsTrigger>
            <TabsTrigger value="optimizer" className="flex items-center gap-2">
              <Play className="w-4 h-4" />
              Optimize
            </TabsTrigger>
            <TabsTrigger value="viewer" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Results
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map((stat, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                        <p className="text-3xl font-bold">{stat.value}</p>
                      </div>
                      <div className={`p-3 rounded-full ${stat.color} text-white`}>
                        <stat.icon className="w-6 h-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Workflow Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Workflow Progress
                </CardTitle>
                <CardDescription>
                  Follow these steps to generate your optimized timetable
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {workflowSteps.map((step, index) => (
                  <div key={step.id} className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex-shrink-0">
                      {step.completed ? (
                        <CheckCircle className="w-6 h-6 text-green-500" />
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-muted-foreground flex items-center justify-center">
                          <span className="text-sm font-medium">{index + 1}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{step.title}</h3>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {step.completed && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          Complete
                        </Badge>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setActiveTab(step.tab)}
                      >
                        {step.completed ? 'Review' : 'Start'}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Recent Saved Timetables */}
            {savedTimetables.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Archive className="w-5 h-5 text-green-600" />
                      <CardTitle>Recent Saved Timetables</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{savedTimetables.length} saved</Badge>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setActiveTab('viewer')}
                      >
                        View All
                      </Button>
                    </div>
                  </div>
                  <CardDescription>
                    Multi-class timetables ready for review and export
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {savedTimetables.slice(0, 6).map((timetable: any) => (
                      <Card key={timetable.id} className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-4" onClick={() => setActiveTab('viewer')}>
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-semibold text-sm truncate">{timetable.name}</h4>
                              <p className="text-xs text-muted-foreground">
                                {new Date(timetable.generatedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {timetable.score}%
                            </Badge>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="w-3 h-3" />
                              <span>{timetable.batchIds?.length || 0} batch(es)</span>
                              <Calendar className="w-3 h-3 ml-2" />
                              <span>{timetable.entries.length} classes</span>
                            </div>
                            {timetable.conflicts.length > 0 && (
                              <div className="flex items-center gap-1 text-xs text-orange-600">
                                <AlertTriangle className="w-3 h-3" />
                                <span>{timetable.conflicts.length} conflicts</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  
                  {savedTimetables.length > 6 && (
                    <div className="mt-4 text-center">
                      <Button 
                        variant="ghost" 
                        onClick={() => setActiveTab('viewer')}
                        className="text-sm"
                      >
                        View {savedTimetables.length - 6} more saved timetables...
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Timetables</CardTitle>
                  <CardDescription>View and manage your generated timetables</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentTimetables.length > 0 ? (
                      recentTimetables.slice(0, 3).map((timetable, index) => (
                        <div key={timetable.id} className="flex items-center justify-between p-3 rounded border">
                          <div>
                            <p className="font-medium">{timetable.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Generated {new Date(timetable.generatedAt).toLocaleDateString()}
                              {timetable.score && ` • ${timetable.score}% quality`}
                            </p>
                          </div>
                          <Badge variant={
                            timetable.status === 'Published' ? 'default' :
                            timetable.status === 'Approved' ? 'secondary' : 'outline'
                          }>
                            {timetable.status}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        <Calendar className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-sm">No timetables generated yet</p>
                        <p className="text-xs">Run optimization to create timetables</p>
                      </div>
                    )}
                    {recentTimetables.length > 3 && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full mt-2"
                        onClick={() => setActiveTab('results')}
                      >
                        View All ({recentTimetables.length})
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Status</CardTitle>
                  <CardDescription>Current system health and performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Optimization Engine</span>
                      <Badge className="bg-green-100 text-green-800">Online</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Database Connection</span>
                      <Badge className="bg-green-100 text-green-800">Connected</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Last Backup</span>
                      <span className="text-sm text-muted-foreground">2 hours ago</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="setup">
            <InstitutionSetup onComplete={() => setSetupComplete(true)} />
          </TabsContent>

          <TabsContent value="data">
            <DataManagement onComplete={() => setDataComplete(true)} />
          </TabsContent>

          <TabsContent value="constraints">
            <ConstraintManager />
          </TabsContent>

          <TabsContent value="optimizer">
            <TimetableOptimizer onComplete={() => setOptimizationComplete(true)} />
          </TabsContent>

          <TabsContent value="viewer">
            <TimetableViewer />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}