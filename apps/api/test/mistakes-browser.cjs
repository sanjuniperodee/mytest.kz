// Local browser fixtures: no real users, production requests or database writes.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.WEB_TEST_URL || 'http://127.0.0.1:4320';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Local web only');
const exams = [
  {examTypeId:'ent',examName:{ru:'ЕНТ',kk:'ҰБТ'},count:71},
  {examTypeId:'other',examName:{ru:'Другой экзамен',kk:'Басқа емтихан'},count:2},
];
const subjects = [
  {examTypeId:'ent',examName:exams[0].examName,subjectId:'math',subjectName:{ru:'Математика',kk:'Математика'},count:50},
  ...Array.from({length:6},(_,i)=>({examTypeId:'ent',examName:exams[0].examName,subjectId:`subject-${i}`,subjectName:{ru:`Предмет с длинным названием ${i}`,kk:`Ұзын атауы бар пән ${i}`},count:i+1})),
  {examTypeId:'other',examName:exams[1].examName,subjectId:'other-math',subjectName:{ru:'Другой предмет',kk:'Басқа пән'},count:2},
];
const summary = {openTotal:73,openByExam:exams,openBySubject:subjects,scoreImpact:{available:false},recentRecoveries:[{questionId:'q',sessionId:'past',subjectName:subjects[0].subjectName,examName:exams[0].examName,recoveredAt:'2026-09-20T06:00:00Z'}]};
(async()=>{
  const browser = await chromium.launch({headless:true});
  try {
    for (const locale of ['ru','kk']) for (const scenario of ['paid','free','empty','failure','expired']) {
      const context = await browser.newContext({viewport:{width:390,height:844}});
      await context.addInitScript(lang=>{localStorage.setItem('accessToken','local-mistakes-fixture');localStorage.setItem('mytest-locale',lang);localStorage.setItem('mytest-theme','light');},locale);
      const page = await context.newPage(), errors=[], requests=[];
      let failing=scenario==='failure', releasePractice;
      const pendingPractice = new Promise(resolve=>{releasePractice=resolve;});
      page.on('pageerror',err=>errors.push(err.message));
      await page.route('**/api/v1/**',async route=>{
        const path=new URL(route.request().url()).pathname;
        if(path.endsWith('/users/me')) return route.fulfill({json:{id:'fixture',firstName:'Аружан',preferredLanguage:locale,isChannelMember:true,hasActiveSubscription:['paid','expired'].includes(scenario),currentTariff:{isPaid:['paid','expired'].includes(scenario)}}});
        if(path.endsWith('/tests/mistakes/summary')) return failing ? route.fulfill({status:503,json:{message:'Fixture unavailable'}}) : route.fulfill({json:scenario==='empty'?{...summary,openTotal:0,openByExam:[],openBySubject:[],recentRecoveries:[]}:summary});
        if(path.endsWith('/tests/mistakes/practice')) {
          requests.push(route.request().postDataJSON());
          if(scenario==='expired') return route.fulfill({status:403,json:{message:'PREMIUM_REQUIRED'}});
          if(requests.length===1) {await pendingPractice;return route.fulfill({status:503,json:{message:'Fixture unavailable'}});}
          if(requests.length===2) return route.fulfill({status:400,json:{message:'NO_OPEN_MISTAKES_FOR_SUBJECT'}});
          return route.fulfill({json:{id:'local-practice'}});
        }
        if(path.endsWith('/exams/types')) return route.fulfill({json:[]});
        if(path.includes('/billing/tariffs')) return route.fulfill({json:[]});
        return route.fulfill({json:{}});
      });
      await page.goto(`${base}/dashboard/mistakes?lang=${locale}`);
      if(scenario==='failure') {
        await page.getByRole('alert').filter({hasText:locale==='ru'?'Не удалось обновить':'Қателерді жаңарту'}).waitFor();
        assert.equal(await page.getByTestId('mistakes-empty').count(),0,'Loading failure is not zero mistakes');
        failing=false;
        await page.getByRole('button',{name:locale==='ru'?'Повторить загрузку':'Қайта жүктеу',exact:true}).click();
      }
      if(scenario==='empty') {
        await page.getByTestId('mistakes-empty').waitFor();
        assert.equal(await page.locator('a[href*="reason=mistakes_practice"]').count(),0,'No upsell for empty state');
      } else {
        await page.getByTestId('mistakes-next-step').waitFor();
        const list=page.getByTestId('mistakes-subjects');
        assert.equal(await list.locator('li').count(),8,'All subjects visible, not just top six');
        assert.equal(await list.locator('a').first().getAttribute('href'),'/dashboard/mistakes/subjects/math?examTypeId=ent');
        await page.getByLabel(locale==='ru'?'Фильтр по экзамену':'Емтихан бойынша сүзгі').selectOption('other');
        assert.equal(await list.locator('li').count(),1);
        await page.getByLabel(locale==='ru'?'Фильтр по экзамену':'Емтихан бойынша сүзгі').selectOption('all');
      }
      for(const width of [320,390,1280]) {
        await page.setViewportSize({width,height:900});
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Page overflow: ${locale}/${scenario}/${width}`);
      }
      if(scenario==='paid' || scenario==='free') {
        await page.screenshot({path:`/tmp/mistakes-${scenario}-${locale}-desktop.png`,fullPage:true,animations:'disabled'});
        await page.evaluate(()=>document.documentElement.classList.add('dark'));
        await page.setViewportSize({width:390,height:844});
        await page.screenshot({path:`/tmp/mistakes-${scenario}-${locale}-mobile-dark.png`,fullPage:true,animations:'disabled'});
      }
      if(scenario==='paid') {
        const trigger=page.getByTestId('mistakes-subjects').getByRole('button').first();
        await trigger.click();
        let dialog=page.getByRole('dialog');
        await dialog.waitFor();
        assert.equal(await dialog.getByLabel(locale==='ru'?'Предмет':'Пән',{exact:true}).inputValue(),'math');
        await page.keyboard.press('Escape');
        await dialog.waitFor({state:'detached'});
        assert.equal(await trigger.evaluate(element=>element===document.activeElement),true,'Focus returns to the launching row');
        await trigger.click();
        dialog=page.getByRole('dialog');
        await dialog.waitFor();
        for(const width of [320,390,1280]) {
          await page.setViewportSize({width,height:568});
          const bounds=await dialog.boundingBox();
          assert.ok(bounds.x>=0 && bounds.x+bounds.width<=width+1,'Dialog fits viewport');
          assert.equal(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth),true,'Dialog has no horizontal overflow');
        }
        await page.setViewportSize({width:390,height:844});
        await dialog.evaluate(async element=>{await Promise.all(element.getAnimations().map(animation=>animation.finished.catch(()=>{})));});
        assert.equal(await dialog.evaluate(element=>getComputedStyle(element).opacity),'1','Dialog animation completes at full opacity');
        await page.screenshot({path:`/tmp/mistakes-dialog-${locale}.png`,animations:'disabled'});
        const range=dialog.getByRole('slider');
        assert.equal(await range.getAttribute('max'),'40','API question cap');
        await dialog.getByLabel(locale==='ru'?'Экзамен':'Емтихан',{exact:true}).selectOption('other');
        assert.equal(await dialog.getByLabel(locale==='ru'?'Предмет':'Пән',{exact:true}).inputValue(),'all','Exam switch resets subject');
        assert.equal(await range.inputValue(),'2','Requested count cannot exceed known mistakes');
        await dialog.getByLabel(locale==='ru'?'Предмет':'Пән',{exact:true}).selectOption('other-math');
        await dialog.getByLabel(locale==='ru'?'Язык вопросов':'Сұрақтар тілі').selectOption(locale==='ru'?'kk':'ru');
        await dialog.getByLabel(locale==='ru'?'Время, мин':'Уақыт, мин').selectOption('10');
        const submit=dialog.locator('button[type="submit"]');
        await submit.click();
        await page.waitForFunction(()=>document.querySelector('form[aria-busy="true"]'));
        await dialog.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
        await page.keyboard.press('Escape');
        assert.equal(await dialog.count(),1,'Cannot dismiss a pending create request');
        releasePractice();
        await dialog.getByRole('alert').waitFor();
        assert.equal(requests.length,1,'Double submission is blocked');
        assert.deepEqual(requests[0],{language:locale==='ru'?'kk':'ru',examTypeId:'other',subjectId:'other-math',limit:2,durationMins:10});
        assert.equal(await dialog.getByLabel(locale==='ru'?'Время, мин':'Уақыт, мин').inputValue(),'10','Retry preserves settings');
        await submit.click();
        await dialog.getByRole('alert').filter({hasText:locale==='ru'?'нет доступных вопросов':'қолжетімді сұрақтар жоқ'}).waitFor();
        assert.equal(requests.length,2);
        await dialog.getByLabel(locale==='ru'?'Предмет':'Пән',{exact:true}).selectOption('all');
        await submit.click();
        await page.waitForURL('**/exam/local-practice');
        assert.equal(requests.length,3);
        assert.equal(requests[2].subjectId,undefined,'All subjects omits subjectId');
        assert.equal(requests[2].examTypeId,'other','All subjects still scopes one exam');
      } else if(scenario==='expired') {
        await page.getByTestId('mistakes-subjects').getByRole('button').first().click();
        await page.getByRole('dialog').locator('button[type="submit"]').click();
        await page.waitForURL('**/dashboard/billing?reason=mistakes_practice');
        assert.equal(requests.length,1,'Server access decision wins over cached user hint');
      } else {
        assert.equal(await page.getByTestId('mistakes-subjects').getByRole('button').count(),0,'No premium practice controls without paid access');
        assert.equal(requests.length,0);
      }
      assert.deepEqual(errors,[]);
      console.log('MISTAKES_UI_OK',locale,scenario);
      await context.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
