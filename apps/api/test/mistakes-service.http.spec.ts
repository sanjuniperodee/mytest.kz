import { MistakesService } from '../src/modules/tests/mistakes.service';

describe('MistakesService', () => {
  it('filters open mistake question ids by exam and subject', () => {
    const service = new MistakesService({} as any);
    const latest = [
      {
        questionId: 'q-1',
        isCorrect: false,
        examTypeId: 'exam-ent',
        subjectId: 'math',
      },
      {
        questionId: 'q-2',
        isCorrect: false,
        examTypeId: 'exam-ent',
        subjectId: 'physics',
      },
      {
        questionId: 'q-3',
        isCorrect: true,
        examTypeId: 'exam-ent',
        subjectId: 'math',
      },
      {
        questionId: 'q-4',
        isCorrect: false,
        examTypeId: 'exam-nuet',
        subjectId: 'math',
      },
    ];

    expect(service.getOpenMistakeQuestionIds(latest, 'exam-ent', 'math')).toEqual([
      'q-1',
    ]);
  });
});
