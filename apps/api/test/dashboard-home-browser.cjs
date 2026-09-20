// Local UI fixtures only; never writes production data.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.WEB_TEST_URL || 'http://127.0.0.1:4320';
if (!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw Error('Local web only');
const exam = { id:'ent',slug:'ent',name:{ru:'ЕНТ',kk:'ҰБТ'} };
const finished = { id:'finished',status:'completed',rawScore:88,maxScore:140,score:63,startedAt:'2026-09-19T10:00:00Z',examType:exam };
const cases = [
  {name:'new',kind:'start',href:'/dashboard/exams/ent'},
  {name:'active',kind:'continue',href:'/exam/older-active',mistakes:12},
  {name:'mistakes',kind:'mistakes',href:'/dashboard/mistakes',mistakes:12},
  {name:'exhausted',kind:'access',href:'/dashboard/billing?reason=no_access',denied:'TOTAL_LIMIT_EXHAUSTED'},
  {name:'daily',kind:'daily-limit',href:'/dashboard/history',denied:'DAILY_LIMIT_REACHED'},
  {name:'failure',kind:'history',href:'/dashboard/history',failure:true},
];
(async()=>{
 const browser = await chromium.launch({headless:true});
 try {
  for (const locale of ['ru','kk']) for (const scenario of cases) {
   const context=await browser.newContext({viewport:{width:390,height:844}});
   await context.addInitScript(lang=>{localStorage.setItem('accessToken','local-dashboard-fixture');localStorage.setItem('mytest-locale',lang);localStorage.setItem('mytest-theme','light');},locale);
   const page=await context.newPage(), errors=[];
   let failing=Boolean(scenario.failure), goalLookups=0;
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/api/v1/**',async route=>{
    const url=new URL(route.request().url()), path=url.pathname;
    const respond=data=>route.fulfill({json:data});
    if(path.endsWith('/users/me')) return respond({id:'fixture-user',firstName:'Аружан',preferredLanguage:locale,isChannelMember:true,hasActiveSubscription:false,currentTariff:{name:{ru:'Стартовый',kk:'Бастапқы'},isPaid:false},trialStatus:{ent:{freeRemaining:1}},accessByExam:[{examSlug:'ent',hasAccess:!scenario.denied,reasonCode:scenario.denied ?? null,total:{isUnlimited:false,remaining:scenario.denied ? 0:1,limit:1},daily:{isUnlimited:false,remaining:scenario.denied ? 0:3,limit:3}}]});
    if(path.endsWith('/users/me/stats')) return failing ? route.fulfill({status:503,json:{message:'Fixture failure'}}) : respond({completedTests:scenario.name==='new'?0:4,averageScore:63,weeklyStreak:scenario.name==='new'?0:2,byExamType:scenario.name==='new'?[]:[{examSlug:'ent',bestScore:63,bestRawScore:88,bestMaxScore:140},{examSlug:'other',bestScore:100,bestRawScore:10,bestMaxScore:10}]});
    if(path.endsWith('/tests/sessions')) {
     if(url.searchParams.get('status')) return failing ? route.fulfill({status:503,json:{message:'Fixture failure'}}) : respond({items:scenario.name==='active' ? [{...finished,id:'older-active',status:'in_progress'}]:[]});
     return respond({items:scenario.name==='new'?[]:[finished,{...finished,id:'abandoned',status:'abandoned'}]});
    }
    if(path.endsWith('/tests/mistakes/summary')) return respond({openTotal:scenario.mistakes ?? 0,scoreImpact:{available:false}});
    if(path.endsWith('/exams/types')) return respond([exam]);
    if(path.endsWith('/admission/goal')) return respond({goal: scenario.name==='mistakes' ? {universityName:'Университет',programName:'Информатика',programCode:'B057',requiredScore:110} : null});
    if(path.endsWith('/admission/universities') || path.endsWith('/admission/cycles')) {goalLookups++;return respond([]);}
    return respond({});
   });
   await page.goto(`${base}/dashboard?lang=${locale}`);
   const hero=page.getByTestId('dashboard-next-step');
   const action=hero.locator('[data-action]');
   await action.waitFor();
   assert.equal(await action.getAttribute('data-action'),scenario.kind);
   assert.equal(await action.getAttribute('href'),scenario.href);
   assert.equal(await hero.locator('[data-action]').count(),1);
   assert.equal(await hero.locator('dl dd').nth(1).innerText(),scenario.denied?'0':'1','Today is capped by total remaining');
   assert.equal(goalLookups,0,'Goal catalogs load only on demand');
   if(scenario.name!=='new' && !scenario.failure) {
    assert.equal(await page.getByText('88/140',{exact:true}).count(),2,'ENT best is not mixed with other exam scales');
    assert.equal(await page.locator('a[href="/exam/abandoned/review"]').count(),0);
   }
   if(scenario.failure) {
    await page.getByRole('alert').filter({hasText:locale==='ru'?'Часть данных':'Кейбір деректер'}).waitFor();
    failing=false;
    await page.getByRole('button',{name:locale==='ru'?'Повторить загрузку':'Қайта жүктеу',exact:true}).click();
    await page.locator('[data-action="start"]').waitFor();
   }
   if(scenario.name==='new' || scenario.name==='mistakes') {
    for(const width of [320,390,1280]) {
     await page.setViewportSize({width,height:900});
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Overflow ${scenario.name}/${locale}/${width}`);
    }
    await page.screenshot({path:`/tmp/dashboard-${scenario.name}-${locale}.png`,fullPage:true,animations:'disabled'});
    await page.evaluate(()=>document.documentElement.classList.add('dark'));
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:`/tmp/dashboard-${scenario.name}-${locale}-mobile-dark.png`,fullPage:true,animations:'disabled'});
    if(scenario.name==='new') {
     await page.getByRole('button',{name:locale==='ru'?'Выбрать цель':'Мақсатты таңдау',exact:true}).click();
     await page.getByRole('dialog').waitFor();
     await page.keyboard.press('Escape');
     assert.ok(goalLookups>0);
    }
   }
   assert.deepEqual(errors,[]);
   console.log('DASHBOARD_UI_OK',locale,scenario.name);
   await context.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
