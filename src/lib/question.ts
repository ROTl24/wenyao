export const QUESTION_LENGTH = {
  min: 3,
  max: 500,
} as const;

export function isValidQuestion(question: string): boolean {
  const length = question.trim().length;
  return length >= QUESTION_LENGTH.min && length <= QUESTION_LENGTH.max;
}
