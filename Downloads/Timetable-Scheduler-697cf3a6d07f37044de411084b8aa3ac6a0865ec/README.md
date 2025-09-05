# Timetable Optimization Platform

## Overview
This web application provides an intelligent platform for academic timetable generation and management. It uses constraint-based optimization to create high-quality schedules for institutions, supporting features like data management, conflict resolution, and export options.

## Features
- **Institution Setup:** Configure institution details, working days, periods, breaks, and semester dates.
- **Data Management:** Add and manage subjects, faculty, rooms, and student batches/classes.
- **Constraint Manager:** Set hard and soft constraints for timetable generation (e.g., no double booking, room capacity).
- **Timetable Optimizer:** Select a class/batch and generate optimized timetables using advanced algorithms.
- **Timetable Viewer:** View, approve, publish, and export generated timetables as PDF or Excel.
- **Export Options:** Download timetables in PDF and Excel formats for sharing and record-keeping.

## Technology Stack
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui components
- **Icons:** lucide-react
- **PDF/Excel Export:** jspdf, jspdf-autotable, xlsx
- **State Management:** React hooks, localStorage

## Folder Structure
```
workspace/
  shadcn-ui/
    src/
      components/        # Main React components
      pages/             # Page-level components
      types/             # TypeScript types
      lib/               # Timetable engine logic
    public/              # Static assets
    index.html           # Main HTML entry point
    package.json         # Project dependencies and scripts
clone/
  index.html             # Static HTML clone
  style.css              # Static CSS
  main.js                # Static JS
```

## How to Run
1. Install dependencies:
   ```sh
   pnpm install
   ```
2. Start the development server:
   ```sh
   cd workspace/shadcn-ui
   pnpm dev
   ```
3. Open your browser at [http://localhost:5173/](http://localhost:5173/) (or the port shown in the terminal).

## How to Use
1. Complete Institution Setup and Data Management.
2. Set constraints in the Constraint Manager.
3. Select a class/batch in the Timetable Optimizer and generate timetables.
4. View, approve, publish, and export timetables in the Timetable Viewer.

## Static Clone
A static HTML/CSS/JS clone is available in the `clone` folder for UI preview purposes. It does not include full app logic or data handling.

## Author
Created by MGX. For questions or support, contact the project maintainer.
