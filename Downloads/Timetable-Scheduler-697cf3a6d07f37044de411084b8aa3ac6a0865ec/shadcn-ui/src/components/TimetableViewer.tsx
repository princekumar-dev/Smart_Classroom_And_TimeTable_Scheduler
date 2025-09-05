import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText, 
  Download, 
  Share, 
  CheckCircle, 
  AlertTriangle, 
  Calendar,
  Users,
  MapPin,
  Clock
} from 'lucide-react';
import { GeneratedTimetable, TimetableEntry } from '@/types/timetable';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function TimetableViewer() {
  const [timetables, setTimetables] = useState<GeneratedTimetable[]>([]);
  const [selectedTimetable, setSelectedTimetable] = useState<GeneratedTimetable | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    // Load generated timetables from localStorage
    const savedTimetables = localStorage.getItem('generatedTimetables');
    if (savedTimetables) {
      const parsed = JSON.parse(savedTimetables);
      setTimetables(parsed);
      if (parsed.length > 0) {
        setSelectedTimetable(parsed[0]);
      }
    }
  }, []);

  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const periods = [1, 2, 3, 4, 5, 6];

  const getTimetableGrid = (entries: TimetableEntry[]) => {
    const grid: { [key: string]: TimetableEntry } = {};
    entries.forEach(entry => {
      const key = `${entry.timeSlot.day}-${entry.timeSlot.period}`;
      grid[key] = entry;
    });
    return grid;
  };

  const getConflictSeverityColor = (severity: string) => {
    switch (severity) {
      case 'High': return 'bg-red-100 text-red-800 border-red-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const approveTimetable = (timetableId: string) => {
    const updatedTimetables = timetables.map(tt => 
      tt.id === timetableId 
        ? { ...tt, status: 'Approved' as const }
        : tt
    );
    setTimetables(updatedTimetables);
    localStorage.setItem('generatedTimetables', JSON.stringify(updatedTimetables));
  };

  const publishTimetable = (timetableId: string) => {
    const updatedTimetables = timetables.map(tt => 
      tt.id === timetableId 
        ? { ...tt, status: 'Published' as const }
        : tt
    );
    setTimetables(updatedTimetables);
    localStorage.setItem('generatedTimetables', JSON.stringify(updatedTimetables));
  };

  if (timetables.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-6">
          <FileText className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Timetable Results</h2>
        </div>
        
        <Card>
          <CardContent className="text-center py-12">
            <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Timetables Generated</h3>
            <p className="text-muted-foreground mb-4">
              Run the optimization process to generate timetable solutions
            </p>
            <Button variant="outline">Go to Optimizer</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Timetable Results</h2>
        </div>
        <div className="flex gap-2">
          <Select value={selectedTimetable?.id || ''} onValueChange={(value) => {
            const timetable = timetables.find(tt => tt.id === value);
            if (timetable) setSelectedTimetable(timetable);
          }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select timetable" />
            </SelectTrigger>
            <SelectContent>
              {timetables.map(tt => (
                <SelectItem key={tt.id} value={tt.id}>
                  {tt.name} ({tt.score}%)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedTimetable && (
        <div className="space-y-6">
          {/* Timetable Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{selectedTimetable.name}</CardTitle>
                  <CardDescription>
                    Generated on {new Date(selectedTimetable.generatedAt).toLocaleDateString()}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-lg px-3 py-1">
                    {selectedTimetable.score}% Quality
                  </Badge>
                  <Badge variant={
                    selectedTimetable.status === 'Published' ? 'default' :
                    selectedTimetable.status === 'Approved' ? 'secondary' : 'outline'
                  }>
                    {selectedTimetable.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {selectedTimetable.entries.length}
                  </div>
                  <div className="text-sm text-blue-600">Classes Scheduled</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {new Set(selectedTimetable.entries.map(e => e.faculty.id)).size}
                  </div>
                  <div className="text-sm text-green-600">Faculty Assigned</div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {new Set(selectedTimetable.entries.map(e => e.room.id)).size}
                  </div>
                  <div className="text-sm text-purple-600">Rooms Used</div>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {selectedTimetable.conflicts.length}
                  </div>
                  <div className="text-sm text-orange-600">Conflicts</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Conflicts Alert */}
          {selectedTimetable.conflicts.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This timetable has {selectedTimetable.conflicts.length} conflicts that need attention.
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="schedule" className="space-y-4">
            <TabsList>
              <TabsTrigger value="schedule">Schedule Grid</TabsTrigger>
              <TabsTrigger value="conflicts">Conflicts ({selectedTimetable.conflicts.length})</TabsTrigger>
              <TabsTrigger value="actions">Actions</TabsTrigger>
            </TabsList>

            <TabsContent value="schedule">
              <Card>
                <CardHeader>
                  <CardTitle>Weekly Schedule</CardTitle>
                  <CardDescription>Complete timetable view for all batches</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-200">
                      <thead>
                        <tr>
                          <th className="border border-gray-200 p-2 bg-gray-50">Time</th>
                          {weekDays.map(day => (
                            <th key={day} className="border border-gray-200 p-2 bg-gray-50 min-w-32">
                              {day}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {periods.map(period => (
                          <tr key={period}>
                            <td className="border border-gray-200 p-2 bg-gray-50 font-medium">
                              Period {period}
                            </td>
                            {weekDays.map(day => {
                              const grid = getTimetableGrid(selectedTimetable.entries);
                              const entry = grid[`${day}-${period}`];
                              return (
                                <td key={`${day}-${period}`} className="border border-gray-200 p-1">
                                  {entry ? (
                                    <div className="text-xs space-y-1">
                                      <div className="font-semibold text-blue-600">
                                        {entry.subject.code}
                                      </div>
                                      <div className="text-gray-600">
                                        {entry.faculty.name.split(' ').slice(-1)}
                                      </div>
                                      <div className="text-gray-500">
                                        {entry.room.name}
                                      </div>
                                      <div className="text-gray-500">
                                        {entry.batch.name}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-gray-400 text-xs">Free</div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="conflicts">
              <Card>
                <CardHeader>
                  <CardTitle>Conflicts & Issues</CardTitle>
                  <CardDescription>Review and resolve scheduling conflicts</CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedTimetable.conflicts.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-green-600 mb-2">No Conflicts!</h3>
                      <p className="text-muted-foreground">
                        This timetable has no scheduling conflicts
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedTimetable.conflicts.map((conflict, index) => (
                        <div key={conflict.id} className={`p-4 border rounded-lg ${getConflictSeverityColor(conflict.severity)}`}>
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-semibold">{conflict.type}</h4>
                              <p className="text-sm">{conflict.description}</p>
                            </div>
                            <Badge variant="outline">{conflict.severity}</Badge>
                          </div>
                          {conflict.suggestions.length > 0 && (
                            <div className="mt-3">
                              <div className="text-sm font-medium mb-1">Suggestions:</div>
                              <ul className="text-sm list-disc list-inside space-y-1">
                                {conflict.suggestions.map((suggestion, i) => (
                                  <li key={i}>{suggestion}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="actions">
              <Card>
                <CardHeader>
                  <CardTitle>Timetable Actions</CardTitle>
                  <CardDescription>Approve, publish, or export this timetable</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <h4 className="font-semibold">Workflow Actions</h4>
                      <div className="space-y-2">
                        <Button 
                          onClick={() => approveTimetable(selectedTimetable.id)}
                          disabled={selectedTimetable.status !== 'Draft'}
                          className="w-full"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve Timetable
                        </Button>
                        <Button 
                          onClick={() => publishTimetable(selectedTimetable.id)}
                          disabled={selectedTimetable.status !== 'Approved'}
                          className="w-full"
                        >
                          <Share className="w-4 h-4 mr-2" />
                          Publish to Website
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="font-semibold">Export Options</h4>
                      <div className="space-y-2">
                        <Button variant="outline" className="w-full" onClick={() => {
                          if (!selectedTimetable) return;
                          const doc = new jsPDF();
                          doc.text(selectedTimetable.name, 14, 16);
                          const tableHead = [['Day', 'Period', 'Subject', 'Faculty', 'Room', 'Batch']];
                          const tableBody = selectedTimetable.entries.map((entry) => [
                            entry.timeSlot.day,
                            entry.timeSlot.period,
                            entry.subject.code,
                            entry.faculty.name,
                            entry.room.name,
                            entry.batch.name,
                          ]);
                          autoTable(doc, {
                            head: tableHead,
                            body: tableBody,
                            startY: 22,
                          });
                          doc.save(`${selectedTimetable.name}.pdf`);
                        }}>
                          <Download className="w-4 h-4 mr-2" />
                          Export as PDF
                        </Button>
                        <Button variant="outline" className="w-full" onClick={() => {
                          if (!selectedTimetable) return;
                          const worksheetData = [
                            ['Day', 'Period', 'Subject', 'Faculty', 'Room', 'Batch'],
                            ...selectedTimetable.entries.map((entry) => [
                              entry.timeSlot.day,
                              entry.timeSlot.period,
                              entry.subject.code,
                              entry.faculty.name,
                              entry.room.name,
                              entry.batch.name,
                            ]),
                          ];
                          const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
                          const workbook = XLSX.utils.book_new();
                          XLSX.utils.book_append_sheet(workbook, worksheet, 'Timetable');
                          XLSX.writeFile(workbook, `${selectedTimetable.name}.xlsx`);
                        }}>
                          <Download className="w-4 h-4 mr-2" />
                          Export as Excel
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-semibold mb-2">Status History</h4>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>• Created: {new Date(selectedTimetable.generatedAt).toLocaleString()}</div>
                      <div>• Status: {selectedTimetable.status}</div>
                      <div>• Quality Score: {selectedTimetable.score}%</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}