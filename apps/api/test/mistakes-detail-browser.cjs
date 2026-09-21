// Local browser fixtures; no production requests or persistent data writes.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.WEB_TEST_URL || 'http://127.0.0.1:4320';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw Error('Local web only');
const name={ru:'Математика',kk:'Математика'}, themeName={ru:'Дроби и преобразования выражений',kk:'Бөлшектер мен өрнектерді түрлендіру'};
const subject={examTypeId:'ent',examName:{ru:'ЕНТ',kk:'ҰБТ'},subjectId:'math',subjectName:name,openTotal:8,activeOpenTotal:5,topics:[
  {topicId:'fractions',topicName:themeName,openCount:5,activeOpenCount:5},
  {topicId:'archived',topicName:{ru:'Архивная тема',kk:'Мұрағаттағы тақырып'},openCount:3,activeOpenCount:0},
]};
const map={...subject,openTotal:8,activeOpenTotal:5,themes:[{themeId:'theme',key:'fractions',name:themeName,openCount:5,activeOpenCount:3}],reviewThemes:[{themeId:'closed',key:'closed',name:{ru:'Исправленная тема',kk:'Түзетілген тақырып'}}],otherOpenCount:3,otherActiveOpenCount:2,classifiedCount:5,unclassifiedCount:3,pending:false,generationAvailable:true};
function makeLesson(lang){return {lessonId:'lesson',lessonKind:'theme',examTypeId:'ent',subjectId:'math',topicId:'theme',subjectName:'Математика',topicName:themeName[lang],title:themeName[lang],studentGoal:lang==='ru'?'Сравнивать дроби':'Бөлшектерді салыстыру',whyItMatters:'',cached:true,model:'fixture',pages:[],sections:[{title:lang==='ru'?'Правило':'Ереже',content:'1/2 = 2/4'}],formulas:[],visualizations:[],workedExamples:[],practice:[{prompt:lang==='ru'?'Сколько будет 1/2 + 1/2?':'1/2 + 1/2 қанша болады?',options:['1','2'],answer:'Ответ: 1',explanation:'Одна целая часть.'}],commonTraps:[],checklist:[],miniTest:[]};}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  for(const language of ['ru','kk']) for(const scenario of ['paid','free','failure','resolved','disabled']) {
   const context=await browser.newContext({viewport:{width:390,height:844}});
   await context.addInitScript(lang=>{localStorage.setItem('accessToken','local-detail-fixture');localStorage.setItem('mytest-locale',lang);localStorage.setItem('mytest-theme','light');},language);
   const page=await context.newPage(), errors=[], practice=[];
   let failing=scenario==='failure', prepareCalls=0, lessonCalls=0, noteCalls=0, subjectQuery=false;
   const theme={...subject,themeId:'theme',themeName,openCount:scenario==='resolved'?0:5,activeOpenCount:scenario==='resolved'?0:3,resolvedCount:scenario==='resolved'?5:1,generationAvailable:scenario!=='disabled',lesson:['resolved','disabled'].includes(scenario)?makeLesson(language):null};
   page.on('pageerror',err=>errors.push(err.message));
   await page.route('**/api/v1/**',async route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname;
    const respond=json=>route.fulfill({json});
    if(path.endsWith('/users/me')) return respond({id:'fixture',firstName:'Аружан',preferredLanguage:language,isChannelMember:true,hasActiveSubscription:scenario!=='free'});
    if(path.endsWith('/tests/mistakes/subjects/math')) {subjectQuery=url.searchParams.get('examTypeId')==='ent';return failing?route.fulfill({status:503,json:{message:'Fixture error'}}):respond(subject);}
    if(path.endsWith('/study-map/overview')) return respond({...map,generationAvailable:scenario!=='disabled'});
    if(path.endsWith('/study-map/prepare')) {prepareCalls++;return prepareCalls===1?route.fulfill({status:429,json:{message:'AI_DAILY_LIMIT'}}):respond({...map,unclassifiedCount:0});}
    if(path.endsWith('/ai/mistakes/themes/theme')) return respond(theme);
    if(path.endsWith('/theme-lesson')) {lessonCalls++;assert.equal(request.postDataJSON().language,language);return lessonCalls===1?route.fulfill({status:503,json:{message:'AI_BUSY'}}):respond(makeLesson(language));}
    if(path.endsWith('/theme-lesson/lesson/note')) {noteCalls++;return noteCalls===1?route.fulfill({status:503,json:{message:'Fixture error'}}):respond({id:'note'});}
    if(path.endsWith('/tests/mistakes/practice')) {practice.push(request.postDataJSON());return route.fulfill({status:503,json:{message:'Fixture error'}});}
    if(path.endsWith('/exams/types')) return respond([]);
    return respond({});
   });
   await page.goto(`${base}/dashboard/mistakes/subjects/math?examTypeId=ent&lang=${language}`);
   if(scenario==='failure') {
    const alert=page.getByRole('alert').filter({hasText:language==='ru'?'Не удалось загрузить':'Пәнді жүктеу'});
    await alert.waitFor();failing=false;
    await alert.getByRole('button').click();
   }
   await page.getByTestId('subject-next-step').waitFor();
   assert.ok(subjectQuery,'Subject request preserves exam scope');
   assert.equal(prepareCalls,0,'Viewing a subject never prepares AI themes');
   assert.equal(lessonCalls,0);
   if(scenario==='free') {
    assert.equal(await page.getByTestId('study-themes').count(),0);
    assert.equal(await page.getByTestId('subject-topics').getByRole('button').count(),0);
   } else {
    await page.getByTestId('study-themes').getByRole('link').first().waitFor();
    assert.equal(await page.getByTestId('subject-topics').getByRole('button').last().isDisabled(),true,'Archived topic is not trainable');
   }
   for(const width of [320,390,1280]) {await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Subject overflow ${language}/${width}`);}
   if(scenario==='paid') {
    await page.screenshot({path:`/tmp/mistakes-subject-${language}.png`,fullPage:true,animations:'disabled'});
    await page.getByTestId('subject-next-step').getByRole('button').first().click();
    let dialog=page.getByRole('dialog');await dialog.waitFor();
    assert.equal(await dialog.locator('#practice-subject').count(),0,'Scoped practice cannot silently change subject');
    assert.equal(await dialog.getByRole('slider').getAttribute('max'),'5');
    await dialog.locator('button[type=submit]').click();await dialog.getByRole('alert').waitFor();
    assert.equal(practice[0].topicId,'fractions');assert.equal(practice[0].subjectId,'math');
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
    await page.getByRole('button',{name:language==='ru'?'Тренировать эти вопросы':'Осы сұрақтармен жаттығу',exact:true}).click();
    dialog=page.getByRole('dialog');await dialog.locator('button[type=submit]').click();await dialog.getByRole('alert').waitFor();
    assert.equal(practice[1].unclassifiedOnly,true);assert.equal(practice[1].themeId,undefined);assert.equal(practice[1].limit,2);
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
    const prepare=page.getByRole('button',{name:language==='ru'?'Подготовить темы с AI':'AI арқылы тақырыптарды дайындау',exact:true});
    await prepare.click();await page.getByTestId('study-themes').getByRole('alert').waitFor();
    await prepare.click();await prepare.waitFor({state:'detached'});assert.equal(prepareCalls,2);
   }
   if(scenario!=='free') {
    await page.getByTestId('study-themes').locator('a[href="/dashboard/mistakes/themes/theme"]').click();
    await page.getByTestId('theme-summary').waitFor();
    assert.equal(lessonCalls,0,'Opening theme reads saved content without generation');
    if(scenario==='paid' || scenario==='failure') {
     const prepare=page.getByRole('button',{name:language==='ru'?'Подготовить урок':'Сабақты дайындау',exact:true});
     await prepare.click();await page.getByRole('alert').filter({hasText:language==='ru'?'Не удалось подготовить':'Сабақты дайындау'}).waitFor();
     await prepare.click();await prepare.waitFor({state:'detached'});assert.equal(lessonCalls,2);
    }
    if(scenario==='resolved') assert.equal(await page.getByTestId('theme-summary').getByRole('button').isDisabled(),true);
    if(scenario==='disabled') assert.equal(await page.getByTestId('theme-summary').getByRole('button').isDisabled(),false,'AI outage does not block practice');
    const solution=page.locator('details').first();await solution.waitFor();
    assert.equal(await solution.getAttribute('open'),null,'Self-check answers initially hidden');
    await solution.locator('summary').click();assert.notEqual(await solution.getAttribute('open'),null);
    for(const width of [320,390,1280]) {await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Theme overflow ${language}/${width}`);}
    if(scenario==='paid') {
     await page.screenshot({path:`/tmp/mistakes-theme-${language}.png`,fullPage:true,animations:'disabled'});
     await page.evaluate(()=>document.documentElement.classList.add('dark'));await page.setViewportSize({width:390,height:844});
     await page.screenshot({path:`/tmp/mistakes-theme-${language}-dark.png`,fullPage:true,animations:'disabled'});
     await page.getByRole('button',{name:language==='ru'?'Сообщить об ошибке':'Қате туралы хабарлау',exact:true}).click();
     const dialog=page.getByRole('dialog');await dialog.getByRole('textbox').fill('В примере неверно указано условие задачи.');
     await dialog.locator('button[type=submit]').click();await dialog.getByRole('alert').waitFor();
     assert.equal(await dialog.getByRole('textbox').inputValue(),'В примере неверно указано условие задачи.');
     await dialog.locator('button[type=submit]').click();await dialog.waitFor({state:'detached'});assert.equal(noteCalls,2);
    }
   }
   assert.deepEqual(errors,[]);console.log('MISTAKES_DETAIL_OK',language,scenario);await context.close();
  }
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
