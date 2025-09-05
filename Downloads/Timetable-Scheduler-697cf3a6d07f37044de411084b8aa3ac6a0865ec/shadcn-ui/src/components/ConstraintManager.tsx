import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Shield, Target, Save, CheckCircle } from 'lucide-react';
import { HardConstraint, SoftConstraint } from '@/types/timetable';

export default function ConstraintManager() {
  const [hardConstraints, setHardConstraints] = useState<HardConstraint[]>([]);
  const [softConstraints, setSoftConstraints] = useState<SoftConstraint[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Initialize with default constraints
    setHardConstraints([
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
    ]);

    setSoftConstraints([
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
        description: 'Schedule labs and practicals in morning slots when possible',
        weight: 6,
        enabled: true
      },
      {
        id: 'faculty-load-balance',
        name: 'Faculty Load Balance',
        description: 'Balance teaching loads fairly across faculty members',
        weight: 7,
        enabled: true
      },
      {
        id: 'avoid-last-period',
        name: 'Avoid Last Period',
        description: 'Minimize classes scheduled in the last period of the day',
        weight: 5,
        enabled: true
      }
    ]);
  }, []);

  const toggleHardConstraint = (id: string) => {
    setHardConstraints(prev => 
      prev.map(constraint => 
        constraint.id === id 
          ? { ...constraint, enabled: !constraint.enabled }
          : constraint
      )
    );
  };

  const toggleSoftConstraint = (id: string) => {
    setSoftConstraints(prev => 
      prev.map(constraint => 
        constraint.id === id 
          ? { ...constraint, enabled: !constraint.enabled }
          : constraint
      )
    );
  };

  const updateSoftConstraintWeight = (id: string, weight: number) => {
    setSoftConstraints(prev => 
      prev.map(constraint => 
        constraint.id === id 
          ? { ...constraint, weight }
          : constraint
      )
    );
  };

  const handleSave = () => {
    localStorage.setItem('hardConstraints', JSON.stringify(hardConstraints));
    localStorage.setItem('softConstraints', JSON.stringify(softConstraints));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const getWeightColor = (weight: number) => {
    if (weight >= 8) return 'bg-red-500';
    if (weight >= 6) return 'bg-orange-500';
    if (weight >= 4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getWeightLabel = (weight: number) => {
    if (weight >= 8) return 'Critical';
    if (weight >= 6) return 'High';
    if (weight >= 4) return 'Medium';
    return 'Low';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <AlertCircle className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold">Constraint Management</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hard Constraints */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-500" />
              Hard Constraints
            </CardTitle>
            <CardDescription>
              These constraints must be satisfied. Violations will prevent timetable generation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hardConstraints.map((constraint) => (
              <div key={constraint.id} className="flex items-start justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{constraint.name}</h4>
                    <Badge variant={constraint.enabled ? "default" : "secondary"}>
                      {constraint.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{constraint.description}</p>
                </div>
                <Switch
                  checked={constraint.enabled}
                  onCheckedChange={() => toggleHardConstraint(constraint.id)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Soft Constraints */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-500" />
              Soft Constraints (Optimization Goals)
            </CardTitle>
            <CardDescription>
              These constraints improve timetable quality. Higher weights mean higher priority.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {softConstraints.map((constraint) => (
              <div key={constraint.id} className="p-3 border rounded-lg space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{constraint.name}</h4>
                      <Badge 
                        variant="outline" 
                        className={`${getWeightColor(constraint.weight)} text-white border-0`}
                      >
                        {getWeightLabel(constraint.weight)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{constraint.description}</p>
                  </div>
                  <Switch
                    checked={constraint.enabled}
                    onCheckedChange={() => toggleSoftConstraint(constraint.id)}
                  />
                </div>
                
                {constraint.enabled && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Priority Weight</Label>
                      <span className="text-sm font-medium">{constraint.weight}/10</span>
                    </div>
                    <Slider
                      value={[constraint.weight]}
                      onValueChange={(value) => updateSoftConstraintWeight(constraint.id, value[0])}
                      max={10}
                      min={1}
                      step={1}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Summary and Save */}
      <Card>
        <CardHeader>
          <CardTitle>Constraint Summary</CardTitle>
          <CardDescription>Review your constraint configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {hardConstraints.filter(c => c.enabled).length}
              </div>
              <div className="text-sm text-red-600">Hard Constraints Active</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {softConstraints.filter(c => c.enabled).length}
              </div>
              <div className="text-sm text-blue-600">Soft Constraints Active</div>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Configuration Status</h3>
              <p className="text-sm text-muted-foreground">
                {saved ? 'Constraints saved successfully!' : 'Save your constraint configuration'}
              </p>
            </div>
            <Button onClick={handleSave} className="min-w-32">
              {saved ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Constraints
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}