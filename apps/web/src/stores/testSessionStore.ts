import { create } from 'zustand';

interface TestSessionState {
  currentQuestionIndex: number;
  selectedAnswers: Map<string, string[]>; // questionId -> selectedOptionIds
  flaggedQuestions: Set<string>;
  timeRemaining: number;
  isTimerRunning: boolean;

  // Actions
  setCurrentQuestion: (index: number) => void;
  selectAnswer: (questionId: string, optionId: string, isMultiple: boolean) => void;
  toggleFlag: (questionId: string) => void;
  setTimeRemaining: (seconds: number) => void;
  startTimer: () => void;
  stopTimer: () => void;
  tick: () => void;
  reset: () => void;
  getSelectedForQuestion: (questionId: string) => string[];
  isQuestionAnswered: (questionId: string) => boolean;
  isQuestionFlagged: (questionId: string) => boolean;
}

export const useTestSessionStore = create<TestSessionState>((set, get) => ({
  currentQuestionIndex: 0,
  selectedAnswers: new Map(),
  flaggedQuestions: new Set(),
  timeRemaining: 0,
  isTimerRunning: false,

  setCurrentQuestion: (index) => set({ currentQuestionIndex: index }),

  selectAnswer: (questionId, optionId, isMultiple) => {
    set((state) => {
      const answers = new Map(state.selectedAnswers);
      const current = answers.get(questionId) || [];

      if (isMultiple) {
        // Toggle the option
        const idx = current.indexOf(optionId);
        if (idx > -1) {
          answers.set(questionId, current.filter((id) => id !== optionId));
        } else {
          answers.set(questionId, [...current, optionId]);
        }
      } else {
        // Single choice: replace
        answers.set(questionId, [optionId]);
      }

      return { selectedAnswers: answers };
    });
  },

  toggleFlag: (questionId) => {
    set((state) => {
      const flagged = new Set(state.flaggedQuestions);
      if (flagged.has(questionId)) {
        flagged.delete(questionId);
      } else {
        flagged.add(questionId);
      }
      return { flaggedQuestions: flagged };
    });
  },

  setTimeRemaining: (seconds) => set({ timeRemaining: seconds }),

  startTimer: () => set({ isTimerRunning: true }),

  stopTimer: () => set({ isTimerRunning: false }),

  tick: () => {
    set((state) => {
      if (!state.isTimerRunning || state.timeRemaining <= 0) return state;
      return { timeRemaining: state.timeRemaining - 1 };
    });
  },

  reset: () =>
    set({
      currentQuestionIndex: 0,
      selectedAnswers: new Map(),
      flaggedQuestions: new Set(),
      timeRemaining: 0,
      isTimerRunning: false,
    }),

  getSelectedForQuestion: (questionId) => {
    return get().selectedAnswers.get(questionId) || [];
  },

  isQuestionAnswered: (questionId) => {
    const answers = get().selectedAnswers.get(questionId);
    return !!answers && answers.length > 0;
  },

  isQuestionFlagged: (questionId) => {
    return get().flaggedQuestions.has(questionId);
  },
}));
