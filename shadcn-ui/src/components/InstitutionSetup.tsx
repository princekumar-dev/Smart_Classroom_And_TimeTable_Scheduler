import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Save, CheckCircle, Plus, Minus } from 'lucide-react';
import { Institution } from '@/types/timetable';

interface InstitutionSetupProps {
  onComplete: () => void;
}

export default function InstitutionSetup({ onComplete }: InstitutionSetupProps) {

  useEffect(() => {
    const savedInstitution = localStorage.getItem('institution');
    if (savedInstitution) {
      setInstitution(JSON.parse(savedInstitution));
    }
  }, []);
  const [institution, setInstitution] = useState<Partial<Institution>>({
    name: '',
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    periodsPerDay: 6,
    periodTimings: [
      { period: 1, startTime: '09:00', endTime: '10:00' },
      { period: 2, startTime: '10:00', endTime: '11:00' },
      { period: 3, startTime: '11:15', endTime: '12:15' },
      { period: 4, startTime: '12:15', endTime: '13:15' },
      { period: 5, startTime: '14:00', endTime: '15:00' },
      { period: 6, startTime: '15:00', endTime: '16:00' }
    ],
    breaks: [
      { name: 'Tea Break', startTime: '11:00', endTime: '11:15' },
      { name: 'Lunch Break', startTime: '13:15', endTime: '14:00' }
    ],
    semesterStart: '',
    semesterEnd: '',
    holidays: []
  });

  const [saved, setSaved] = useState(false);

  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const handleDayToggle = (day: string, checked: boolean) => {
    setInstitution(prev => ({
      ...prev,
      workingDays: checked 
        ? [...(prev.workingDays || []), day]
        : (prev.workingDays || []).filter(d => d !== day)
    }));
  };

  const handlePeriodChange = (index: number, field: 'startTime' | 'endTime', value: string) => {
    setInstitution(prev => ({
      ...prev,
      periodTimings: prev.periodTimings?.map((period, i) => 
        i === index ? { ...period, [field]: value } : period
      )
    }));
  };

  const addPeriod = () => {
    const newPeriod = institution.periodsPerDay! + 1;
    setInstitution(prev => ({
      ...prev,
      periodsPerDay: newPeriod,
      periodTimings: [
        ...(prev.periodTimings || []),
        { period: newPeriod, startTime: '16:00', endTime: '17:00' }
      ]
    }));
  };

  const removePeriod = () => {
    if (institution.periodsPerDay! > 1) {
      setInstitution(prev => ({
        ...prev,
        periodsPerDay: prev.periodsPerDay! - 1,
        periodTimings: prev.periodTimings?.slice(0, -1)
      }));
    }
  };

  const handleSave = () => {
    localStorage.setItem('institution', JSON.stringify(institution));
    setSaved(true);
    setTimeout(() => {
      onComplete();
    }, 1000);
  };

    // Make break times editable
    const handleBreakChange = (index: number, field: 'name' | 'startTime' | 'endTime', value: string) => {
      setInstitution(prev => ({
        ...prev,
        breaks: prev.breaks?.map((breakTime, i) =>
          i === index ? { ...breakTime, [field]: value } : breakTime
        )
      }));
    };

      // Add and remove break functions
      const addBreak = () => {
        setInstitution(prev => ({
          ...prev,
          breaks: [
            ...(prev.breaks || []),
            { name: 'New Break', startTime: '10:00', endTime: '10:15' }
          ]
        }));
      };

      const removeBreak = () => {
        if ((institution.breaks?.length || 0) > 0) {
          setInstitution(prev => ({
            ...prev,
            breaks: prev.breaks?.slice(0, -1)
          }));
        }
      };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold">Institution Setup</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Configure your institution's basic details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="institution-name">Institution Name</Label>
              <Input
                id="institution-name"
                placeholder="Enter institution name"
                value={institution.name || ''}
                onChange={(e) => setInstitution(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="semester-start">Semester Start</Label>
                <Input
                  id="semester-start"
                  type="date"
                  value={institution.semesterStart || ''}
                  onChange={(e) => setInstitution(prev => ({ ...prev, semesterStart: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="semester-end">Semester End</Label>
                <Input
                  id="semester-end"
                  type="date"
                  value={institution.semesterEnd || ''}
                  onChange={(e) => setInstitution(prev => ({ ...prev, semesterEnd: e.target.value }))}
                />
              </div>
            </div>

            <Separator />

            <div>
              <Label>Working Days</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {weekDays.map(day => (
                  <div key={day} className="flex items-center space-x-2">
                    <Checkbox
                      id={day}
                      checked={institution.workingDays?.includes(day)}
                      onCheckedChange={(checked) => handleDayToggle(day, checked as boolean)}
                    />
                    <Label htmlFor={day} className="text-sm">{day}</Label>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Period Timings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Period Timings
            </CardTitle>
            <CardDescription>Configure class periods and break times</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Periods per Day: {institution.periodsPerDay}</Label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={removePeriod}>
                  <Minus className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={addPeriod}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {institution.periodTimings?.map((period, index) => (
                <div key={period.period} className="grid grid-cols-3 gap-2 items-center">
                  <Badge variant="outline" className="justify-center">
                    Period {period.period}
                  </Badge>
                  <Input
                    type="time"
                    value={period.startTime}
                    onChange={(e) => handlePeriodChange(index, 'startTime', e.target.value)}
                  />
                  <Input
                    type="time"
                    value={period.endTime}
                    onChange={(e) => handlePeriodChange(index, 'endTime', e.target.value)}
                  />
                </div>
              ))}
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Break Times</Label>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={removeBreak}>
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={addBreak}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2 mt-2">
                {institution.breaks?.map((breakTime, index) => (
                  <div key={index} className="grid grid-cols-3 gap-2 items-center text-sm">
                    <Input
                      type="text"
                      value={breakTime.name}
                      onChange={e => handleBreakChange(index, 'name', e.target.value)}
                      className="font-medium"
                    />
                    <Input
                      type="time"
                      value={breakTime.startTime}
                      onChange={e => handleBreakChange(index, 'startTime', e.target.value)}
                    />
                    <Input
                      type="time"
                      value={breakTime.endTime}
                      onChange={e => handleBreakChange(index, 'endTime', e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Configuration Status</h3>
              <p className="text-sm text-muted-foreground">
                {saved ? 'Configuration saved successfully!' : 'Save your configuration to proceed'}
              </p>
            </div>
            <Button onClick={handleSave} disabled={!institution.name || saved} className="min-w-32">
              {saved ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Setup
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}