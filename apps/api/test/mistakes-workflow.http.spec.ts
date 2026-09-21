import { TestSessionService } from '../src/modules/tests/test-session.service';
import { MistakesService } from '../src/modules/tests/mistakes.service';
import { StudyThemeService } from '../src/modules/ai/study-theme.service';

describe('Mistakes practice scope (isolated persistence)', () => {
  function setup() {
    const rows = Array.from({length: 55}, (_, i) => ({
      questionId: `q${i}`, isCorrect: i === 54, examTypeId: 'exam',
      subjectId: i % 2 ? 'math' : 'history', topicId: 'topic',
    }));
    const prisma: any = {
      subjectStudyTheme: {findFirst: jest.fn().mockResolvedValue({id:'theme'})},
      questionThemeClassification: {findMany: jest.fn().mockResolvedValue([{questionId:'q3'}])},
      question: {findMany: jest.fn(async ({where}: any) => rows.filter(row => where.id.in.includes(row.questionId) && Number(row.questionId.slice(1)) >= 3).map(row => ({id:row.questionId,subjectId:row.subjectId,subject:{id:row.subjectId,name:{ru:row.subjectId},slug:row.subjectId,isMandatory:false}})))},
      visitEvent: {findFirst: jest.fn().mockResolvedValue(null)},
      testSession: {create: jest.fn(async ({data}: any) => ({...data,id:'session',score:null}))},
    };
    const mistakes = new MistakesService({} as any);
    jest.spyOn(mistakes,'getLatestOutcomes').mockResolvedValue(rows);
    const service = new TestSessionService(prisma,{} as any,{} as any,mistakes,{} as any);
    return {service,prisma,rows};
  }

  it('filters inactive questions before sampling, caps at 40, and creates contiguous subject sections', async () => {
    const {service,prisma} = setup();
    const result: any = await service.startRemediationSession('user','ru',{examTypeId:'exam',limit:200});
    expect(prisma.question.findMany.mock.calls[0][0].where.id.in).toHaveLength(54);
    expect(prisma.question.findMany.mock.calls[0][0].where.isActive).toBe(true);
    expect(result.totalQuestions).toBe(40);
    expect(new Set(result.metadata.questionOrder).size).toBe(40);
    expect(result.metadata.questionOrder).not.toContain('q54');
    const sections = result.metadata.sections;
    expect(sections).toHaveLength(2);
    expect(sections.reduce((sum: number, section: any) => sum + section.questionCount,0)).toBe(40);
    expect(result.metadata.remediationScope.unclassifiedOnly).toBe(false);
  });

  it('does not return an empty sample when archived questions precede active ones', async () => {
    const {service} = setup();
    const result: any = await service.startRemediationSession('user','ru',{examTypeId:'exam',limit:1});
    expect(result.totalQuestions).toBe(1);
  });

  it('unclassified practice excludes assigned questions instead of training the whole subject', async () => {
    const {service,prisma} = setup();
    const result: any = await service.startRemediationSession('user','kk',{examTypeId:'exam',subjectId:'math',unclassifiedOnly:true});
    expect(prisma.questionThemeClassification.findMany.mock.calls[0][0].where).toEqual({subjectId:'math',theme:{isActive:true}});
    expect(prisma.question.findMany.mock.calls[0][0].where.id.in).not.toContain('q3');
    expect(result.metadata.sections.map((section: any)=>section.subjectId)).toEqual(['math']);
    expect(result.metadata.remediationScope.unclassifiedOnly).toBe(true);
  });

  it('rejects ambiguous unclassified scopes and mismatched themes without creating sessions', async () => {
    const {service,prisma} = setup();
    await expect(service.startRemediationSession('user','ru',{unclassifiedOnly:true})).rejects.toThrow('INVALID_MISTAKES_SCOPE');
    await expect(service.startRemediationSession('user','ru',{subjectId:'math',topicId:'topic',unclassifiedOnly:true})).rejects.toThrow('INVALID_MISTAKES_SCOPE');
    prisma.subjectStudyTheme.findFirst.mockResolvedValue(null);
    await expect(service.startRemediationSession('user','ru',{examTypeId:'wrong',themeId:'theme'})).rejects.toThrow('INVALID_MISTAKES_SCOPE');
    expect(prisma.testSession.create).not.toHaveBeenCalled();
  });

  it('scopes topic and theme practice to the requested questions', async () => {
    const {service} = setup();
    const result: any = await service.startRemediationSession('user','ru',{subjectId:'math',topicId:'topic',themeId:'theme'});
    expect(result.metadata.questionOrder).toEqual(['q3']);
    expect(result.metadata.remediationScope.themeId).toBe('theme');
  });
});

describe('Study map and retained lesson access', () => {
  function setup() {
    const rows = [
      {questionId:'a',subjectId:'math',examTypeId:'exam',isCorrect:false},
      {questionId:'b',subjectId:'math',examTypeId:'exam',isCorrect:false},
      {questionId:'c',subjectId:'math',examTypeId:'exam',isCorrect:true},
    ];
    const theme = {id:'theme',key:'fractions',name:{ru:'Дроби',kk:'Бөлшектер'},subjectId:'math',examTypeId:'exam',subject:{name:{ru:'Математика'}},examType:{name:{ru:'ЕНТ'}}};
    const prisma: any = {
      subject: {findFirst:jest.fn().mockResolvedValue({id:'math',examTypeId:'exam',name:{ru:'Математика'},examType:{name:{ru:'ЕНТ'}}})},
      subjectStudyTheme: {findMany:jest.fn().mockResolvedValue([theme,{id:'closed',key:'closed',name:{ru:'Закрытая'}}]),findFirst:jest.fn().mockResolvedValue(theme)},
      questionThemeClassification: {findMany:jest.fn().mockResolvedValue([{questionId:'a',themeId:'theme'},{questionId:'b',themeId:'inactive-theme'},{questionId:'c',themeId:'closed'}])},
      question: {findMany:jest.fn(async ({where}: any) => where.id.in.map((id:string)=>({id,isActive:id!=='b'})))},
      subjectThemeLesson: {findUnique:jest.fn().mockResolvedValue({id:'lesson',result:{title:'Saved lesson'}})},
    };
    const mistakes: any = {getLatestOutcomes:jest.fn().mockResolvedValue(rows)};
    const ai: any = {generateLesson:jest.fn()};
    const quota: any = {reserve:jest.fn()};
    const model: any = {isEnabled:jest.fn().mockReturnValue(true),chatJson:jest.fn()};
    const service = new StudyThemeService(prisma,mistakes,ai,quota,model);
    return {service,prisma,mistakes,model,ai,quota};
  }

  it('GET never generates taxonomy/classification or consumes AI quota', async () => {
    const {service,model,quota} = setup();
    const result = await service.getStudyMap('user','math','exam');
    expect(model.chatJson).not.toHaveBeenCalled();
    expect(quota.reserve).not.toHaveBeenCalled();
    expect(result.themes[0].name).toEqual({ru:'Дроби',kk:'Бөлшектер'});
    expect(result.themes.reduce((sum,theme)=>sum+theme.openCount,0)+result.otherOpenCount).toBe(result.openTotal);
    expect(result.otherOpenCount).toBe(1);
    expect(result.otherActiveOpenCount).toBe(0);
    expect(result.reviewThemes.map(theme=>theme.themeId)).toEqual(['closed']);
  });

  it('existing maps remain readable when AI is disabled', async () => {
    const {service,model} = setup();model.isEnabled.mockReturnValue(false);
    const result = await service.getStudyMap('user','math');
    expect(result.themes).toHaveLength(1);
    expect(result.generationAvailable).toBe(false);
  });

  it('resolved themes retain cached lessons, even with AI disabled, with language-specific lookup', async () => {
    const {service,model,mistakes,prisma,ai} = setup();
    model.isEnabled.mockReturnValue(false);
    mistakes.getLatestOutcomes.mockResolvedValue([{questionId:'c',subjectId:'math',examTypeId:'exam',isCorrect:true}]);
    const detail = await service.getThemeDetail('user','theme','kk');
    expect(detail.openCount).toBe(0);expect(detail.resolvedCount).toBe(1);
    expect(prisma.subjectThemeLesson.findUnique.mock.calls[0][0].where.themeId_language_lessonVersion.language).toBe('kk');
    await expect(service.getThemeLesson('user','theme','kk')).resolves.toMatchObject({lessonId:'lesson',cached:true});
    expect(ai.generateLesson).not.toHaveBeenCalled();
  });

  it('unrelated users cannot read cached theme lessons', async () => {
    const {service,mistakes,prisma} = setup();mistakes.getLatestOutcomes.mockResolvedValue([]);
    await expect(service.getThemeDetail('other-user','theme','ru')).rejects.toThrow('THEME_NOT_FOUND');
    expect(prisma.subjectThemeLesson.findUnique).not.toHaveBeenCalled();
  });
});
