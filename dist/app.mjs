import {days,goals,exercises,foods,workoutPlan,mealPlan,nutrition,sumNutrition,dateKey} from './planner.mjs';

const $ = id => document.getElementById(id);
const main = $('main');
const dialog = $('dialog');
const storageKey = 'fitmate-ai-v1';
const empty = {profile:null,workouts:null,diet:null,preferences:null,records:{}};
let state = empty;
try {
  state = {...empty,...JSON.parse(localStorage.getItem(storageKey))};
} catch {
  $('toast').textContent = '저장된 정보를 불러오지 못했습니다.';
}
const today = () => (new Date().getDay()+6)%7;
let day = today();
let page = state.profile ? 'routine' : 'home';
let draft = state.profile || {};
let mealIndex = 0;
let generation;
let timer;
let toastTimeout;

const esc = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const format = (n, digits=0) => Number(n).toLocaleString('ko-KR',{maximumFractionDigits:digits});
const button = (label, action, cls='', value='') =>
  `<button type="button" class="${cls}" data-action="${action}" data-value="${esc(value)}">${label}</button>`;
const submit = (label, cls='primary', value='save') =>
  `<button class="${cls}" type="submit" value="${value}">${label}</button>`;
const num = (label,name,min,max,value='',step=1,required=true) =>
  `<label>${label}<input name="${name}" type="number" min="${min}" max="${max}" step="${step}" value="${esc(value)}" ${required?'required':''}></label>`;
const select = (label,name,options,value='') =>
  `<label>${label}<select name="${name}" required><option value="" disabled ${value===''?'selected':''}>선택해 주세요</option>${options.map(option =>
    `<option ${String(value)===String(option)?'selected':''}>${option}</option>`).join('')}</select></label>`;
const area = (label,name,max,value='',placeholder='') =>
  `<label>${label}<textarea name="${name}" maxlength="${max}" rows="2" placeholder="${esc(placeholder)}">${esc(value)}</textarea></label>`;
const checks = (label,name,options,selected=[]) =>
  `<fieldset><legend>${label}</legend><div class="checks">${options.map(option =>
    `<label><input type="checkbox" name="${name}" value="${option}" ${selected.includes(option)?'checked':''}>${option}</label>`).join('')}</div></fieldset>`;
const check = (label,name,value) =>
  `<label class="check"><input type="checkbox" name="${name}" ${value?'checked':''}>${label}</label>`;
const bar = (value, color='') =>
  `<div class="track ${color}" role="progressbar" aria-label="진행률" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100"><span style="--percent:${value}%"></span></div>`;
const percent = (value,max) => max ? Math.min(100,Math.round(value/max*100)) : 0;
const section = (title,description,action='') =>
  `<div class="row between"><div class="stack" style="gap:5px"><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
const record = () => state.records[dateKey(day)] || {};
const mealKey = (meal,index) => JSON.stringify([index,meal.foods.map(food=>food.name)]);
const mealRecord = (meal,index) => record().meals?.[mealKey(meal,index)];
const getMeals = () => state.diet?.[day]?.meals ?? [];
const dayWorkout = () => state.workouts[day];

function save(next, message) {
  localStorage.setItem(storageKey,JSON.stringify(next));
  state = next;
  if (message) notify(message);
}

function updateRecord(patch,message) {
  save({...state,records:{...state.records,[dateKey(day)]:{...record(),...patch}}},message);
}

function notify(message) {
  $('toast').textContent = message;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(()=> $('toast').textContent = '',3500);
}

function go(next) {
  if (timer) {clearInterval(timer);timer=null;}
  page=next;
  render();
  main.focus({preventScroll:true});
  window.scrollTo({top:0});
}

function week() {
  return `<div class="week" aria-label="요일 선택">${days.map((label,index)=>
    `<button data-action="day" data-value="${index}" aria-pressed="${index===day}"><strong>${label}</strong><small class="${state.workouts[index].items.length?'accent':''}">${index===today()?'오늘':state.workouts[index].items.length?'운동':'휴식'}</small></button>`).join('')}</div>`;
}

function stepper(label,name,min,max,value,step=1,increment=step) {
  return `<div><label for="${name}">${label}</label><div class="stepper">${button('−','step','ghost',-increment)}<input id="${name}" name="${name}" type="number" min="${min}" max="${max}" step="${step}" required value="${esc(value)}">${button('+','step','ghost',increment)}</div></div>`;
}

function home() {
  return `<div class="intro stack"><div class="hero stack"><span class="eyebrow">FITMATE AI</span><h1>운동과 식단,<br><span class="accent">AI와 함께</span> 관리하세요.</h1><p>신체 정보와 목표를 입력하면 나에게 맞는 7일 운동과 식단을 한곳에서 확인할 수 있어요.</p><div class="row">${button('시작하기 →','body','primary')}${button('예시 둘러보기','demo','ghost')}</div></div><div class="grid"><div class="card stack"><span class="eyebrow">✦ 운동</span><h3>주간 루틴</h3><p>운동 환경에 맞춰 운동일과 회복일을 배치합니다.</p></div><div class="card stack"><span class="eyebrow positive">◈ 식단</span><h3>맞춤 식단</h3><p>식비와 선호를 반영한 식단을 확인하고 섭취량을 기록합니다.</p></div></div></div>`;
}

function bodyForm() {
  return `<form class="onboarding stack" id="bodyForm"><div class="steps" aria-label="1 / 2 단계"><span class="active"></span><span></span></div><span class="eyebrow">1 / 2 · 신체 정보</span>${section('나의 신체 정보를 입력해 주세요.','정확한 운동 및 식단 추천을 위해 필요합니다.')}<div class="card grid">${select('성별','sex',['남성','여성','기타','응답하지 않음'],draft.sex)}${num('나이 (세)','age',14,100,draft.age)}${num('키 (cm)','height',100,230,draft.height,.1)}${num('체중 (kg)','weight',30,250,draft.weight,.1)}<span class="muted" id="bmi"></span><span class="muted" id="completion"></span></div><fieldset class="stack"><legend>인바디 · 선택</legend><p>인바디 정보 없이도 이용할 수 있습니다.</p><div class="grid">${num('체지방률 (%)','fat',3,60,draft.fat,.1,false)}${num('골격근량 (kg)','muscle',10,100,draft.muscle,.1,false)}${num('기초대사량 (kcal)','bmr',500,4000,draft.bmr,1,false)}<label>인바디 측정일<input type="date" name="measured" value="${esc(draft.measured)}"></label></div></fieldset><div class="actions">${button('이전','backBody')}${submit('다음 단계')}</div></form>`;
}

function workoutFields() {
  const names = exercises.map(([name])=>name);
  return `<div class="grid">${select('운동 목표','goal',goals,draft.goal)}${select('운동 경험','level',['초보자','중급자','상급자'],draft.level)}${select('주간 운동 횟수','frequency',[2,3,4,5,6],draft.frequency)}${select('운동 가능 시간 (분)','duration',[30,60,90,120],draft.duration)}${select('운동 장소','place',['헬스장','홈트레이닝'],draft.place)}</div>${checks('선호 운동 · 최대 10개','prefer',names,draft.prefer)}${checks('피하고 싶은 운동 · 최대 10개','avoid',names,draft.avoid)}${area('추가 요청','request',300,draft.request,'직접 입력한 요청은 참고 메모로 저장됩니다.')}`;
}

function goalForm() {
  return `<form class="onboarding stack" id="goalForm"><div class="steps" aria-label="2 / 2 단계"><span class="active"></span><span class="active"></span></div><span class="eyebrow">2 / 2 · 운동 목표</span>${section('어떤 몸을 만들고 싶으신가요?','운동 목표와 운동할 수 있는 환경을 설정하세요.')}<div class="card stack">${workoutFields()}</div><div class="actions">${button('이전','backGoal')}${submit('정보 저장 및 계획 생성')}</div></form>`;
}

function routine() {
  const workout=dayWorkout();
  const completed=workout.items.filter(item=>record().exercises?.[item.name]?.done).length;
  return `${section('나의 주간 운동 계획',`주 ${state.profile.frequency}회 · ${state.profile.place} · ${state.profile.goal}`,button('계획 수정','editRoutine','ghost'))}
    ${week()}<div class="hero stack"><div class="row between"><span class="pill">${days[day]}요일 · ${workout.items.length?'운동일':'휴식일'}</span><small>${day===today()?'오늘의 루틴':'선택한 루틴'}</small></div><h2>${workout.title}</h2><p>${workout.items.length?`약 ${workout.minutes}분 · ${workout.items.length}개 종목`:'다음 운동을 위해 회복하는 날입니다.'}</p>
    <div class="row">${workout.items.length?button(day===today()?'오늘 운동하기 →':'요일별 상세 보기 →','workout','primary'):''}${day!==today()?button('오늘 보기','today','ghost'):''}</div></div>
    ${workout.items.length?`<div class="card stack"><div class="row between"><h2>운동 목록</h2><span class="accent">${completed} / ${workout.items.length} 완료</span></div>${bar(percent(completed,workout.items.length))}${workout.items.map((item,index)=>`<div class="exercise line"><span class="index">${record().exercises?.[item.name]?.done?'✓':String(index+1).padStart(2,'0')}</span><div><h3>${item.name}</h3><small>${item.sets}세트 × ${item.reps}회 · 휴식 ${item.rest}초</small></div></div>`).join('')}</div>`:''}`;
}

function workoutDetail() {
  const workout=dayWorkout();
  return `${section('오늘의 운동',`${days[day]}요일 · ${workout.title}`,button('← 주간 루틴','routine','ghost'))}
    ${workout.items.length?`<form class="stack" id="workoutForm"><div class="hero row between"><div><span class="eyebrow">운동 타이머</span><div class="metric" id="timer">00:00</div></div>${button('운동 시작','timer','primary')}</div>${workout.items.map((item,index)=>{
      const log=record().exercises?.[item.name] || {};
      return `<section class="card stack"><div class="row between"><h2>${item.name}</h2><span class="pill">${item.sets}세트 × ${item.reps}회</span></div><small>세트 사이 ${item.rest}초 휴식</small>${check('운동 완료','done'+index,log.done)}<div class="grid three">${stepper('세트','sets'+index,0,20,log.sets??item.sets)}${stepper('반복','reps'+index,0,100,log.reps??item.reps)}${stepper('중량 (kg)','weight'+index,0,500,log.weight??0,.1,2.5)}</div>${area('운동 메모','memo'+index,200,log.memo)}</section>`;
    }).join('')}<div class="actions sticky">${submit('기록 저장','ghost')}${submit('운동 완료','success','complete')}</div></form>`:'<div class="card">휴식일입니다.</div>'}`;
}

function mealTotals(meal,log) {
  return sumNutrition([...meal.foods.map((food,index)=>nutrition(food,log?.grams[index]??food.grams)),
    {kcal:log?.extraCalories??0,carb:0,protein:0,fat:0}]);
}

function totalActual() {
  return sumNutrition(Object.entries(record().meals ?? {}).flatMap(([key, log]) => {
    if (log.totals) return [log.totals];
    // Earlier records stored amounts and food names without a nutrient snapshot.
    const [, names] = JSON.parse(key);
    const items = names.map((name, index) => {
      const [, , carb, protein, fat] = foods.find(food => food[0] === name);
      return nutrition({carb, protein, fat, kcal: 4 * (carb + protein) + 9 * fat}, log.grams[index]);
    });
    return [sumNutrition([...items, {kcal:log.extraCalories ?? 0, carb:0, protein:0, fat:0}])];
  }));
}

function macros(actual,target) {
  return `<div class="grid three">${[['탄수화물','carb',''],['단백질','protein','green'],['지방','fat','purple']].map(([label,key,color])=>
    `<div class="stack" style="gap:5px"><small>${label}</small><strong>${format(actual[key],1)} g</strong>${target?`<small>목표 ${target[key]} g</small>${bar(percent(actual[key],target[key]),color)}`:''}</div>`).join('')}</div>`;
}

function diet() {
  const plan=state.diet?.[day];
  const actual=totalActual();
  return `${section('나의 맞춤 식단','식사별 섭취량과 영양을 확인하세요.',button(plan?'식단 수정':'식단 생성','dietSettings','primary'))}${week()}
    ${plan?`<div class="hero stack"><div class="row between"><span class="pill">${days[day]}요일 식단</span><small>예상 식비 ${format(plan.cost)}원</small></div>${plan.target?`<div><small>하루 섭취 열량 목표 (추정)</small><div class="metric">${format(plan.target.kcal)} <small>kcal</small></div><p>기록 ${format(actual.kcal)} kcal · 목표 대비 ${format(actual.kcal-plan.target.kcal)} kcal</p></div>`:'<p>18세 미만은 칼로리 목표 없이 식단 구성과 섭취 기록을 확인할 수 있어요.</p>'}${macros(actual,plan.target)}</div>
    <div class="row between"><h2>식사 목록</h2><div class="row">${day>0?button('‹ 이전 날','day','ghost',day-1):''}${day<6?button('다음 날 ›','day','ghost',day+1):''}</div></div>
    ${plan.meals.map((meal,index)=>{const log=mealRecord(meal,index);return `<button class="meal card" data-action="meal" data-value="${index}"><span class="row between"><span><strong>${meal.title}</strong> ${log?.done?'<span class="positive">✓ 완료</span>':''}<br><small>${meal.foods.map(food=>food.name).join(' · ')}</small></span><span class="accent">${format(mealTotals(meal,log).kcal)} kcal ›</span></span></button>`;}).join('')}`:'<div class="card stack"><h2>식단을 만들어 보세요</h2><p>하루 식사 횟수, 예산, 제외할 식재료를 적용해 7일 식단을 구성합니다.</p></div>'}`;
}

function mealDetail() {
  const meal=getMeals()[mealIndex];
  const log=mealRecord(meal,mealIndex);
  return `${section('식사 상세 정보',`${days[day]}요일 · ${meal.title}`,button('← 맞춤 식단','diet','ghost'))}<form class="stack" id="mealForm">
    <div class="hero stack"><div class="row between"><h2>섭취 영양</h2><strong class="accent" id="mealCalories"></strong></div><div id="mealMacros"></div></div>
    ${meal.foods.map((food,index)=>`<section class="card stack"><div class="row between"><h3>${food.name}</h3><span class="pill">계획 ${food.grams} g · ${format(nutrition(food,food.grams).kcal)} kcal</span></div><small>${format(food.carb,1)} g 탄수화물 · ${format(food.protein,1)} g 단백질 · ${format(food.fat,1)} g 지방 / 100 g</small>${stepper('실제 섭취량 (g)','grams'+index,0,2000,log?.grams[index]??food.grams,1,10)}</section>`).join('')}
    <div class="card grid">${check('섭취 완료','done',log?.done)}<span></span><label>추가 음식<input name="extra" maxlength="50" value="${esc(log?.extra)}"></label>${num('추가 음식 칼로리','extraCalories',0,5000,log?.extraCalories??'',1,false)}</div><div class="actions sticky">${submit('섭취 기록 저장','ghost')}${submit('식사 완료','success','complete')}</div></form>`;
}

function dashboard() {
  const workout=dayWorkout();
  const meals=getMeals();
  const workoutDone=workout.items.filter(item=>record().exercises?.[item.name]?.done).length;
  const mealDone=meals.filter((meal,index)=>mealRecord(meal,index)?.done).length;
  const actual=totalActual();
  const target=state.diet?.[day]?.target;
  return `${section(day===today()?'오늘의 관리 현황':`${days[day]}요일 관리 현황`,'운동과 식사 기록을 한눈에 확인하세요.',day<6?button('다음 날 계획 보기','day','ghost',day+1):button('오늘 보기','today','ghost'))}${week()}
    <div class="hero stack"><span class="eyebrow">섭취 기록</span><div class="metric">${format(actual.kcal)} <small>kcal${target?' / '+format(target.kcal)+' kcal':''}</small></div>${macros(actual,target)}</div>
    <div class="grid mobile-stack"><div class="card stack"><div class="row between"><h2>운동</h2><span class="accent">${workoutDone} / ${workout.items.length}</span></div>${bar(percent(workoutDone,workout.items.length))}<p>${workout.items.length?`${workout.items.length-workoutDone}개 종목 미완료`:'휴식일'}</p>${button('운동 기록 확인',workout.items.length?'workout':'routine','ghost')}</div>
    <div class="card stack"><div class="row between"><h2>식단</h2><span class="positive">${mealDone} / ${meals.length}</span></div>${bar(percent(mealDone,meals.length),'green')}<p>${meals.length?`${meals.length-mealDone}개 식사 미완료`:'식사 계획이 없습니다.'}</p>${button('식단 기록 확인','diet','ghost')}</div></div>
    <form id="dayForm" class="card stack"><h2>하루 기록</h2><div class="grid">${check('운동 완료','workoutDone',record().workoutDone??(workout.items.length>0&&workoutDone===workout.items.length))}${check('식사 완료','mealsDone',record().mealsDone??(meals.length>0&&mealDone===meals.length))}</div>${area('하루 활동 및 식단 메모','memo',300,record().memo)}${submit('기록 저장')}</form>`;
}

function profile() {
  const p=state.profile;
  return `${section('내 정보','현재 운동과 식단 계획에 적용된 프로필을 확인하세요.',button('프로필 수정','editProfile','primary'))}<div class="grid three">${[['키',p.height,'cm'],['체중',p.weight,'kg'],['BMI',p.bmi,'']].map(([label,value,unit])=>`<div class="card"><small>${label}</small><div class="metric">${value} <small>${unit}</small></div></div>`).join('')}</div><div class="card stack"><h2>신체 및 운동 정보</h2><p>${p.sex} · ${p.age}세 · ${p.level} · ${p.place}</p><p>${p.goal} · 주 ${p.frequency}회 · 회당 ${p.duration}분</p>${p.fat||p.muscle||p.bmr||p.measured?`<p>${[p.fat&&'체지방률 '+p.fat+'%',p.muscle&&'골격근량 '+p.muscle+' kg',p.bmr&&'기초대사량 '+p.bmr+' kcal',p.measured].filter(Boolean).map(esc).join(' · ')}</p>`:''}<small>계획은 입력값과 내장 규칙으로 생성됩니다. 프로필과 기록은 현재 브라우저에 저장됩니다.</small></div>`;
}

function render() {
  const views={home,body:bodyForm,goal:goalForm,routine,workout:workoutDetail,diet,meal:mealDetail,dashboard,profile};
  const onboarding=['home','body','goal'].includes(page);
  const current={workout:'routine',meal:'diet'}[page]??page;
  $('sidebar').hidden=onboarding;
  $('profileBadge').innerHTML=onboarding?'':`<span class="pill">${state.profile.demo?'예시 프로필':state.profile.age+'세 · 내 프로필'}</span>`;
  $('sidebar').innerHTML=onboarding?'':`<nav class="nav" aria-label="주 메뉴">${[['routine','◫','주간 루틴'],['diet','◈','맞춤 식단'],['dashboard','▤','대시보드'],['profile','◉','내 정보']].map(([name,icon,label])=>`<button data-action="${name}" ${current===name?'aria-current="page"':''}><span aria-hidden="true">${icon}</span>${label}</button>`).join('')}</nav>`;
  main.className='stack';
  main.innerHTML=views[page]();
  if (page==='body') syncBody();
  if (page==='meal') syncMeal();
}

function syncBody() {
  const fields=$('bodyForm').elements;
  const valid=['sex','age','height','weight'].filter(name=>fields[name].validity.valid).length;
  $('completion').textContent=`입력 완료 ${valid*25}%`;
  $('bmi').textContent=fields.height.value&&fields.weight.value&&fields.height.validity.valid&&fields.weight.validity.valid
    ? 'BMI '+(fields.weight.value/(fields.height.value/100)**2).toFixed(1) : 'BMI —';
}

function syncMeal() {
  const meal=getMeals()[mealIndex];
  const fields=$('mealForm').elements;
  const totals=mealTotals(meal,{grams:meal.foods.map((_,i)=>Number(fields['grams'+i].value)),extraCalories:Number(fields.extraCalories.value)});
  $('mealCalories').textContent=format(totals.kcal)+' kcal';
  $('mealMacros').innerHTML=macros(totals);
}

function openDialog(title,contents) {
  dialog.innerHTML=`<div class="stack"><div class="row between"><h2 id="dialogTitle">${title}</h2>${button('닫기','close','ghost')}</div>${contents}</div>`;
  if (!dialog.open) dialog.showModal();
}

function settings() {
  const p=state.preferences??{count:3,budget:16000};
  openDialog('식단 설정',`<form class="stack" id="dietForm"><div class="grid">${select('하루 식사 횟수','count',[2,3,4,5,6],p.count)}${num('하루 식비 (원)','budget',1000,200000,p.budget)}</div>${checks('선호 음식','prefer',foods.map(([name])=>name),p.prefer)}${area('제외 음식 및 알레르기','exclude',300,p.exclude,'예: 달걀, 대두 (쉼표로 구분)')}<small>식재료 이름과 일치하는 항목을 제외합니다. 알레르기가 있다면 실제 제품의 원재료명과 교차 접촉 표시를 확인하세요.</small>${area('식단 요청사항','request',300,p.request,'직접 입력한 요청은 참고 메모로 저장됩니다.')}<p class="error" role="alert"></p>${submit('식단 생성')}</form>`);
}

function generate(profile, rotation) {
  const plan=workoutPlan(profile,rotation);
  let diet=null;
  if (state.preferences) diet=mealPlan(profile,plan,state.preferences);
  openDialog('맞춤 운동 루틴을 만들고 있습니다.',`<p role="status" id="generation">사용자 정보 분석 중</p><div id="generationBar">${bar(25)}</div>${button('취소','close','ghost')}`);
  let stage=0;
  generation=setInterval(()=>{
    stage++;
    if (stage<3) {
      $('generation').textContent=['','운동 부위 배분 중','운동 계획 생성 중'][stage];
      $('generationBar').innerHTML=bar(25+stage*25);
      return;
    }
    clearInterval(generation);
    generation=null;
    try {
      save({...state,profile,workouts:plan,diet,rotation},'주간 운동 계획을 만들었습니다.');
      dialog.close();
      go('routine');
    } catch {
      $('generation').textContent='운동 계획을 저장하지 못했습니다. 닫은 후 다시 시도해 주세요.';
    }
  },250);
}

dialog.addEventListener('close',()=>{
  if (generation) {clearInterval(generation);generation=null;}
});

document.addEventListener('click',event=>{
  if (event.target.closest('.brand')) {
    event.preventDefault();
    go(state.profile?'routine':'home');
    return;
  }
  const target=event.target.closest('[data-action]');
  if (!target) return;
  const {action,value}=target.dataset;
  try {
    switch(action) {
      case 'day': day=Number(value);render();main.querySelector('.week [aria-pressed="true"]')?.focus();break;
      case 'today': day=today();render();break;
      case 'backBody': go(state.profile?'profile':'home');break;
      case 'backGoal': go('body');break;
      case 'editProfile': draft={...state.profile,demo:false};go('body');break;
      case 'editRoutine': draft={...state.profile};go('goal');break;
      case 'dietSettings': settings();break;
      case 'close': dialog.close();break;
      case 'meal': mealIndex=Number(value);go('meal');break;
      case 'step': {
        const input=target.parentElement.querySelector('input');
        const next=Math.min(Number(input.max),Math.max(Number(input.min),Number(input.value)+Number(value)));
        input.value=Number(next.toFixed(1));
        input.dispatchEvent(new Event('input',{bubbles:true}));
        break;
      }
      case 'timer': {
        if (timer) {clearInterval(timer);timer=null;target.textContent='다시 시작';break;}
        const started=Date.now();
        target.textContent='타이머 정지';
        $('timer').textContent='00:00';
        timer=setInterval(()=>{
          const seconds=Math.floor((Date.now()-started)/1000);
          $('timer').textContent=[Math.floor(seconds/60),seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
        },200);
        break;
      }
      case 'demo': {
        const p={sex:'남성',age:24,height:183,weight:78,bmi:'23.3',fat:18,muscle:36,bmr:1800,goal:goals[0],level:'중급자',frequency:4,duration:60,place:'헬스장',prefer:[],avoid:[],demo:true};
        const preferences={count:4,budget:16000,prefer:[],exclude:'',request:''};
        const workouts=workoutPlan(p);
        save({...empty,profile:p,workouts,preferences,diet:mealPlan(p,workouts,preferences)});
        day=workouts[today()].items.length?today():workouts.findIndex(workout=>workout.items.length);
        go('routine');
        break;
      }
      default: go(action);
    }
  } catch(error) {
    notify(error.message);
  }
});

document.addEventListener('input',event=>{
  if (event.target.form?.id==='bodyForm') syncBody();
  if (event.target.form?.id==='mealForm') syncMeal();
  if (event.target.type==='checkbox' && ['prefer','avoid'].includes(event.target.name) && event.target.form?.id==='goalForm') {
    const selected=new FormData(event.target.form).getAll(event.target.name);
    if (selected.length>10) {event.target.checked=false;notify('같은 항목은 최대 10개까지 선택할 수 있습니다.');}
  }
});

document.addEventListener('submit',event=>{
  const form=event.target;
  event.preventDefault();
  const data=new FormData(form);
  const values=Object.fromEntries(data);
  const complete=event.submitter?.value==='complete';
  try {
    switch(form.id) {
      case 'bodyForm': {
        for(const key of ['age','height','weight','fat','muscle','bmr']) values[key]=values[key]===''?'':Number(values[key]);
        draft={...draft,...values,bmi:(values.weight/(values.height/100)**2).toFixed(1)};
        go('goal');
        break;
      }
      case 'goalForm': {
        const prefer=data.getAll('prefer');
        const avoid=data.getAll('avoid');
        if (prefer.some(name=>avoid.includes(name))) throw new Error('동일한 운동을 선호와 제외에 동시에 선택할 수 없습니다.');
        generate({...draft,...values,frequency:Number(values.frequency),duration:Number(values.duration),prefer,avoid},state.rotation??0);
        break;
      }
      case 'dietForm': {
        const preferences={...values,count:Number(values.count),budget:Number(values.budget),prefer:data.getAll('prefer')};
        const diet=mealPlan(state.profile,state.workouts,preferences);
        save({...state,preferences,diet},'주간 식단을 만들었습니다.');
        dialog.close();
        go('diet');
        break;
      }
      case 'workoutForm': {
        const exercises={...record().exercises};
        dayWorkout().items.forEach((item,i)=>{
          const sets=Number(values['sets'+i]);
          const reps=Number(values['reps'+i]);
          exercises[item.name]={done:(complete||data.has('done'+i))&&sets>0&&reps>0,sets,reps,weight:Number(values['weight'+i]),memo:values['memo'+i]};
        });
        updateRecord({exercises,workoutDone:dayWorkout().items.every(item=>exercises[item.name]?.done)},'운동 기록을 저장했습니다.');
        go('routine');
        break;
      }
      case 'mealForm': {
        if (Number(values.extraCalories)>0&&!values.extra.trim()) throw new Error('추가 음식 이름을 입력해 주세요.');
        const meal=getMeals()[mealIndex];
        const log={
          grams:meal.foods.map((_,i)=>Number(values['grams'+i])),done:complete||data.has('done'),extra:values.extra.trim(),extraCalories:Number(values.extraCalories)
        };
        const meals={...record().meals,[mealKey(meal,mealIndex)]:{...log,totals:mealTotals(meal,log)}};
        updateRecord({meals,mealsDone:getMeals().every((item,i)=>meals[mealKey(item,i)]?.done)},'식사 기록을 저장했습니다.');
        go('diet');
        break;
      }
      case 'dayForm':
        updateRecord({memo:values.memo,workoutDone:data.has('workoutDone'),mealsDone:data.has('mealsDone')},'하루 기록을 저장했습니다.');
        break;
    }
  } catch(error) {
    const message=form.querySelector('.error');
    if(message) message.textContent=error.message;
    else notify(error.message);
  }
});

render();
