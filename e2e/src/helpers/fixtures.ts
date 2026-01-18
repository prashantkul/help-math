/**
 * E2E Test Fixtures
 * Generates unique test data for each test run
 */

const timestamp = Date.now();
let counter = 0;

function unique(): string {
  return `${timestamp}-${++counter}`;
}

export function generateTeacher() {
  const id = unique();
  return {
    email: `teacher-${id}@e2e-test.com`,
    password: 'TestPassword123!',
    name: `E2E Teacher ${id}`,
  };
}

export function generateClassName(): string {
  return `E2E Test Class ${unique()}`;
}

export function generateModuleName(): string {
  return `E2E Module ${unique()}`;
}

export function generateLessonName(): string {
  return `E2E Lesson ${unique()}`;
}

export const sampleProblems = [
  {
    text: 'Maria has 5 apples. She gives 2 to her friend. How many apples does Maria have left?',
    expectedAnswer: 3,
    skill: 'subtraction',
  },
  {
    text: 'Tom has 3 toy cars. He gets 4 more toy cars for his birthday. How many toy cars does Tom have now?',
    expectedAnswer: 7,
    skill: 'addition',
  },
  {
    text: 'Sara has 8 stickers. She gives 3 to her sister. How many stickers does Sara have left?',
    expectedAnswer: 5,
    skill: 'subtraction',
  },
  {
    text: 'Jake has 6 marbles. His friend gives him 2 more marbles. How many marbles does Jake have in total?',
    expectedAnswer: 8,
    skill: 'addition',
  },
];

export function getRandomProblem() {
  return sampleProblems[Math.floor(Math.random() * sampleProblems.length)];
}
