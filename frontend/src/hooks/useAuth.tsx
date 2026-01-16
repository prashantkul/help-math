import { useState, useEffect, createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { apiClient } from '../api/client';
import type { Teacher, Student } from '../types';

interface TeacherAuthContextType {
  teacher: Teacher | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

interface StudentAuthContextType {
  student: Student | null;
  className: string | null;
  isLoading: boolean;
  join: (classCode: string, passcode: string) => Promise<{ success: boolean; error?: string; student?: Student }>;
  logout: () => void;
}

const TeacherAuthContext = createContext<TeacherAuthContextType | null>(null);
const StudentAuthContext = createContext<StudentAuthContextType | null>(null);

export function useTeacherAuth() {
  const context = useContext(TeacherAuthContext);
  if (!context) {
    throw new Error('useTeacherAuth must be used within a TeacherAuthProvider');
  }
  return context;
}

export function useStudentAuth() {
  const context = useContext(StudentAuthContext);
  if (!context) {
    throw new Error('useStudentAuth must be used within a StudentAuthProvider');
  }
  return context;
}

export function TeacherAuthProvider({ children }: { children: ReactNode }) {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('teacher_token');
    const savedTeacher = localStorage.getItem('teacher_data');
    if (token && savedTeacher) {
      try {
        setTeacher(JSON.parse(savedTeacher));
      } catch {
        localStorage.removeItem('teacher_token');
        localStorage.removeItem('teacher_data');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const result = await apiClient.loginTeacher(email, password);
    if (result.data?.teacher) {
      setTeacher(result.data.teacher);
      localStorage.setItem('teacher_data', JSON.stringify(result.data.teacher));
      return { success: true };
    }
    return { success: false, error: result.error || 'Login failed' };
  };

  const register = async (email: string, password: string, name: string) => {
    const result = await apiClient.registerTeacher(email, password, name);
    if (result.data?.teacher) {
      setTeacher(result.data.teacher);
      localStorage.setItem('teacher_data', JSON.stringify(result.data.teacher));
      return { success: true };
    }
    return { success: false, error: result.error || 'Registration failed' };
  };

  const logout = () => {
    apiClient.clearTeacherToken();
    localStorage.removeItem('teacher_data');
    setTeacher(null);
  };

  return (
    <TeacherAuthContext.Provider value={{ teacher, isLoading, login, register, logout }}>
      {children}
    </TeacherAuthContext.Provider>
  );
}

export function StudentAuthProvider({ children }: { children: ReactNode }) {
  const [student, setStudent] = useState<Student | null>(null);
  const [className, setClassName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('student_token');
    const savedStudent = localStorage.getItem('student_data');
    const savedClassName = localStorage.getItem('class_name');
    if (token && savedStudent) {
      try {
        setStudent(JSON.parse(savedStudent));
        setClassName(savedClassName);
      } catch {
        localStorage.removeItem('student_token');
        localStorage.removeItem('student_data');
        localStorage.removeItem('class_name');
      }
    }
    setIsLoading(false);
  }, []);

  const join = async (classCode: string, passcode: string) => {
    const result = await apiClient.joinClass(classCode, passcode);
    if (result.data?.student) {
      setStudent(result.data.student);
      setClassName(result.data.class_name);
      localStorage.setItem('student_data', JSON.stringify(result.data.student));
      localStorage.setItem('class_name', result.data.class_name);
      return { success: true, student: result.data.student };
    }
    return { success: false, error: result.error || 'Failed to join class' };
  };

  const logout = () => {
    apiClient.clearStudentToken();
    localStorage.removeItem('student_data');
    localStorage.removeItem('class_name');
    setStudent(null);
    setClassName(null);
  };

  return (
    <StudentAuthContext.Provider value={{ student, className, isLoading, join, logout }}>
      {children}
    </StudentAuthContext.Provider>
  );
}

export { TeacherAuthContext, StudentAuthContext };
