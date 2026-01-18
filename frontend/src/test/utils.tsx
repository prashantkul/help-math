import React, { ReactElement } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

// ============ CUSTOM RENDER WITH PROVIDERS ============

interface WrapperProps {
  children: React.ReactNode;
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[];
  useMemoryRouter?: boolean;
}

function createWrapper(options: CustomRenderOptions = {}) {
  const { initialEntries = ['/'], useMemoryRouter = false } = options;

  return function Wrapper({ children }: WrapperProps) {
    if (useMemoryRouter) {
      return (
        <MemoryRouter initialEntries={initialEntries}>
          {children}
        </MemoryRouter>
      );
    }
    return <BrowserRouter>{children}</BrowserRouter>;
  };
}

function customRender(
  ui: ReactElement,
  options: CustomRenderOptions = {}
): RenderResult & { user: ReturnType<typeof userEvent.setup> } {
  const user = userEvent.setup();
  const { initialEntries, useMemoryRouter, ...renderOptions } = options;

  return {
    user,
    ...render(ui, {
      wrapper: createWrapper({ initialEntries, useMemoryRouter }),
      ...renderOptions,
    }),
  };
}

// ============ ROUTER HELPERS ============

export function renderWithRouter(
  ui: ReactElement,
  { route = '/', ...options }: CustomRenderOptions & { route?: string } = {}
) {
  window.history.pushState({}, 'Test page', route);
  return customRender(ui, options);
}

export function renderWithMemoryRouter(
  ui: ReactElement,
  { initialEntries = ['/'], ...options }: CustomRenderOptions = {}
) {
  return customRender(ui, { initialEntries, useMemoryRouter: true, ...options });
}

// ============ AUTH HELPERS ============

export function setTeacherAuth(token: string = 'test-teacher-token') {
  localStorage.setItem('teacher_token', token);
}

export function setStudentAuth(token: string = 'test-student-token') {
  localStorage.setItem('student_token', token);
}

export function clearAuth() {
  localStorage.removeItem('teacher_token');
  localStorage.removeItem('student_token');
}

// ============ WAIT HELPERS ============

export function waitForLoadingToFinish() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function waitFor(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============ MOCK HELPERS ============

export function createMockFetch(responses: Record<string, unknown>) {
  return (url: string, options?: RequestInit) => {
    const path = url.replace(/^.*\/api/, '');
    const method = options?.method || 'GET';
    const key = `${method} ${path}`;

    if (responses[key]) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(responses[key]),
      } as Response);
    }

    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
    } as Response);
  };
}

// ============ ASSERTION HELPERS ============

export function expectToBeInDocument(element: HTMLElement | null) {
  expect(element).toBeInTheDocument();
}

export function expectNotToBeInDocument(element: HTMLElement | null) {
  expect(element).not.toBeInTheDocument();
}

// ============ FORM HELPERS ============

export async function fillInput(
  user: ReturnType<typeof userEvent.setup>,
  element: HTMLElement,
  value: string
) {
  await user.clear(element);
  await user.type(element, value);
}

export async function selectOption(
  user: ReturnType<typeof userEvent.setup>,
  element: HTMLElement,
  value: string
) {
  await user.selectOptions(element, value);
}

// ============ RE-EXPORT EVERYTHING ============

export * from '@testing-library/react';
export { userEvent };
export { customRender as render };
