# Timetable Optimization Platform - MVP Todo

## Core Files to Create (Max 8 files limit)

### 1. **src/pages/Index.tsx** - Main Dashboard
- Landing page with navigation to different modules
- Quick stats and overview cards
- Navigation to setup, optimization, and results

### 2. **src/components/InstitutionSetup.tsx** - Institution Configuration
- Basic institution details form
- Academic calendar setup
- Working days and periods configuration

### 3. **src/components/DataManagement.tsx** - Academic Data Entry
- Tabbed interface for:
  - Faculty management (add/edit faculty with subjects and availability)
  - Course management (subjects with requirements)
  - Room management (capacity, type, equipment)
  - Student batch management

### 4. **src/components/ConstraintManager.tsx** - Constraint Configuration
- Hard constraints checklist
- Soft constraints with weight sliders
- Constraint validation rules

### 5. **src/components/TimetableOptimizer.tsx** - Optimization Engine
- Input validation and conflict detection
- Mock optimization algorithm (simplified for MVP)
- Progress indicator and results display

### 6. **src/components/TimetableViewer.tsx** - Results Display
- Grid-based timetable visualization
- Faculty, room, and batch views
- Export and approval options

### 7. **src/lib/timetableEngine.ts** - Core Logic
- Data structures for academic entities
- Constraint checking functions
- Basic optimization algorithms (greedy approach for MVP)

### 8. **src/types/timetable.ts** - Type Definitions
- TypeScript interfaces for all data structures
- Faculty, Course, Room, Batch, Constraint types

## Implementation Strategy
1. Start with type definitions and data structures
2. Build basic UI components with mock data
3. Implement simple constraint checking
4. Create basic optimization algorithm
5. Connect UI to logic layer
6. Add data persistence (localStorage for MVP)

## MVP Scope (Simplified)
- Single department/semester focus
- Basic constraint handling
- Simple greedy optimization
- Local storage for data persistence
- Basic conflict detection and resolution suggestions