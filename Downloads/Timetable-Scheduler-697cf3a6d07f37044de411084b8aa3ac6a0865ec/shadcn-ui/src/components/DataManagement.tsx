import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Users, BookOpen, MapPin, GraduationCap, Plus, Save, CheckCircle } from 'lucide-react';
import { Subject, Faculty, Room, StudentBatch } from '@/types/timetable';

interface DataManagementProps {
  onComplete: () => void;
}

export default function DataManagement({ onComplete }: DataManagementProps) {
  // Load saved data and setup from localStorage on mount

  useEffect(() => {
    const savedSubjects = localStorage.getItem('subjects');
    const savedFaculty = localStorage.getItem('faculty');
    const savedRooms = localStorage.getItem('rooms');
    const savedBatches = localStorage.getItem('batches');
    if (savedSubjects) setSubjects(JSON.parse(savedSubjects));
    if (savedFaculty) setFaculty(JSON.parse(savedFaculty));
    if (savedRooms) setRooms(JSON.parse(savedRooms));
    if (savedBatches) setBatches(JSON.parse(savedBatches));
    // If you have institution/setup data, load it here as well
    const savedInstitution = localStorage.getItem('institution');
    if (savedInstitution) {
      // setInstitution(JSON.parse(savedInstitution)); // Uncomment if you have institution state
    }
  }, []);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [batches, setBatches] = useState<StudentBatch[]>([]);
  const [saved, setSaved] = useState(false);

  // Sample data for demonstration
  const sampleSubjects: Subject[] = [
    {
      id: 'CS101',
      code: 'CS101',
      name: 'Data Structures',
      type: 'Theory',
      credits: 3,
      weeklyHours: 3,
      sessionsPerWeek: 3,
      sessionDuration: 60,
      preferredTimeSlots: ['Morning'],
      continuousHours: 1,
      equipmentRequired: ['Projector']
    },
    {
      id: 'CS102',
      code: 'CS102',
      name: 'Programming Lab',
      type: 'Lab',
      credits: 2,
      weeklyHours: 4,
      sessionsPerWeek: 2,
      sessionDuration: 120,
      preferredTimeSlots: ['Morning'],
      continuousHours: 2,
      equipmentRequired: ['Computers', 'Projector']
    }
  ];

  const sampleFaculty: Faculty[] = [
    {
      id: 'F001',
      name: 'Dr. John Smith',
      eligibleSubjects: ['CS101', 'CS103'],
      maxWeeklyLoad: 18,
      availability: [],
      unavailableSlots: [],
      preferences: {
        preferredDays: ['Monday', 'Tuesday', 'Wednesday'],
        preferredTimeSlots: ['Morning'],
        noBackToBack: false,
        maxDailyHours: 6
      },
      leaveFrequency: 0.1
    },
    {
      id: 'F002',
      name: 'Prof. Sarah Johnson',
      eligibleSubjects: ['CS102', 'CS104'],
      maxWeeklyLoad: 16,
      availability: [],
      unavailableSlots: [],
      preferences: {
        preferredDays: ['Tuesday', 'Wednesday', 'Thursday'],
        preferredTimeSlots: ['Morning', 'Afternoon'],
        noBackToBack: true,
        maxDailyHours: 5
      },
      leaveFrequency: 0.05
    }
  ];

  const sampleRooms: Room[] = [
    {
      id: 'R101',
      name: 'Classroom 101',
      type: 'Classroom',
      capacity: 60,
      equipment: ['Projector', 'Whiteboard'],
      availability: [],
      location: 'Block A'
    },
    {
      id: 'L201',
      name: 'Computer Lab 1',
      type: 'Lab',
      capacity: 30,
      equipment: ['Computers', 'Projector', 'Air Conditioning'],
      availability: [],
      location: 'Block B'
    }
  ];

  const sampleBatches: StudentBatch[] = [
    {
      id: 'CSE2A',
      name: 'CSE 2nd Year A',
      department: 'Computer Science',
      year: 2,
      section: 'A',
      size: 45,
      mandatorySubjects: ['CS101', 'CS102'],
      electiveGroups: [],
      maxDailyClasses: 6,
      specialRequirements: []
    }
  ];

  const loadSampleData = () => {
    setSubjects(sampleSubjects);
    setFaculty(sampleFaculty);
    setRooms(sampleRooms);
    setBatches(sampleBatches);
  };

  const handleSave = () => {
    localStorage.setItem('subjects', JSON.stringify(subjects));
    localStorage.setItem('faculty', JSON.stringify(faculty));
    localStorage.setItem('rooms', JSON.stringify(rooms));
    localStorage.setItem('batches', JSON.stringify(batches));
    setSaved(true);
    setTimeout(() => {
      onComplete();
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Data Management</h2>
        </div>
        <Button onClick={loadSampleData} variant="outline">
          Load Sample Data
        </Button>
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
                  <CardTitle>Subjects & Courses</CardTitle>
                  <CardDescription>Manage academic subjects and their requirements</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => {
                  setSubjects(prev => [
                    ...prev,
                    {
                      id: `NEW${prev.length + 1}`,
                      code: '',
                      name: '',
                      type: 'Theory',
                      credits: 0,
                      weeklyHours: 0,
                      sessionsPerWeek: 0,
                      sessionDuration: 60,
                      preferredTimeSlots: [],
                      continuousHours: 1,
                      equipmentRequired: []
                    }
                  ])
                }}>
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
                              title="Enter the subject code (e.g., CS101)"
                              onChange={e => {
                                const val = e.target.value;
                                setSubjects(prev => prev.map((s, i) => i === idx ? { ...s, code: val } : s));
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
                              className="border rounded px-2 py-1 w-24"
                              value={subject.weeklyHours}
                              placeholder="Hours/week"
                              title="Enter the total weekly hours for the subject"
                              onChange={e => {
                                const val = Number(e.target.value);
                                setSubjects(prev => prev.map((s, i) => i === idx ? { ...s, weeklyHours: val } : s));
                              }}
                            />
                            <small className="text-muted-foreground">Total weekly hours</small>
                          </div>
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
                  <CardTitle>Faculty Members</CardTitle>
                  <CardDescription>Manage faculty information and teaching preferences</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => {
                  setFaculty(prev => [
                    ...prev,
                    {
                      id: `NEW${prev.length + 1}`,
                      name: '',
                      eligibleSubjects: [],
                      maxWeeklyLoad: 0,
                      availability: [],
                      unavailableSlots: [],
                      preferences: {
                        preferredDays: [],
                        preferredTimeSlots: [],
                        noBackToBack: false,
                        maxDailyHours: 0
                      },
                      leaveFrequency: 0
                    }
                  ])
                }}>
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
                              className="border rounded px-2 py-1 w-32"
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
                        </div>
                        <Button size="sm" variant="outline" onClick={() => {
                          setFaculty(prev => prev.filter((_, i) => i !== idx));
                        }}>Delete</Button>
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
                  <CardTitle>Rooms & Resources</CardTitle>
                  <CardDescription>Manage classroom and laboratory resources</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => {
                  setRooms(prev => [
                    ...prev,
                    {
                      id: `NEW${prev.length + 1}`,
                      name: '',
                      type: 'Classroom',
                      capacity: 0,
                      equipment: [],
                      availability: [],
                      location: ''
                    }
                  ])
                }}>
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
                        </div>
                        <Button size="sm" variant="outline" onClick={() => {
                          setRooms(prev => prev.filter((_, i) => i !== idx));
                        }}>Delete</Button>
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
                  <CardTitle>Student Batches</CardTitle>
                  <CardDescription>Manage student groups and their course requirements</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => {
                  setBatches(prev => [
                    ...prev,
                    {
                      id: `NEW${prev.length + 1}`,
                      name: '',
                      department: '',
                      year: 1,
                      section: '',
                      size: 0,
                      mandatorySubjects: [],
                      electiveGroups: [],
                      maxDailyClasses: 0,
                      specialRequirements: []
                    }
                  ])
                }}>
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
                              className="border rounded px-2 py-1 w-20"
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
                        </div>
                        <Button size="sm" variant="outline" onClick={() => {
                          setBatches(prev => prev.filter((_, i) => i !== idx));
                        }}>Delete</Button>
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
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Data Status</h3>
              <p className="text-sm text-muted-foreground">
                {saved ? 'All data saved successfully!' : 'Save your data to proceed with optimization'}
              </p>
            </div>
            <Button 
              onClick={handleSave} 
              disabled={subjects.length === 0 || saved} 
              className="min-w-32"
            >
              {saved ? (
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
    </div>
  );
}