import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TeacherAuthProvider, StudentAuthProvider } from './hooks/useAuth';

// Pages
import Home from './pages/Home';
import TeacherLogin from './pages/teacher/TeacherLogin';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import ClassManagement from './pages/teacher/ClassManagement';
import ProblemManager from './pages/teacher/ProblemManager';
import ProblemPreview from './pages/teacher/ProblemPreview';
import CurriculumManager from './pages/teacher/CurriculumManager';
import Analytics from './pages/teacher/Analytics';
import StudentLogin from './pages/student/StudentLogin';
import StudentDashboard from './pages/student/StudentDashboard';
import ProblemSolver from './pages/student/ProblemSolver';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home/Landing */}
        <Route path="/" element={<Home />} />

        {/* Teacher Routes */}
        <Route
          path="/teacher/*"
          element={
            <TeacherAuthProvider>
              <Routes>
                <Route path="login" element={<TeacherLogin />} />
                <Route path="dashboard" element={<TeacherDashboard />} />
                <Route path="classes/:classId" element={<ClassManagement />} />
                <Route path="classes/:classId/curriculum" element={<CurriculumManager />} />
                <Route path="classes/:classId/problems" element={<ProblemManager />} />
                <Route path="lessons/:lessonId/problems" element={<ProblemManager />} />
                <Route path="problems/:problemId/preview" element={<ProblemPreview />} />
                <Route path="analytics/:classId" element={<Analytics />} />
                <Route path="*" element={<Navigate to="/teacher/login" replace />} />
              </Routes>
            </TeacherAuthProvider>
          }
        />

        {/* Student Routes */}
        <Route
          path="/student/*"
          element={
            <StudentAuthProvider>
              <Routes>
                <Route path="login" element={<StudentLogin />} />
                <Route path="dashboard" element={<StudentDashboard />} />
                <Route path="problem/:problemId" element={<ProblemSolver />} />
                <Route path="*" element={<Navigate to="/student/login" replace />} />
              </Routes>
            </StudentAuthProvider>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
