export const days = ['월','화','수','목','금','토','일'];
export const goals = ['체지방 감량','근육 증가','체중 유지','체력 향상'];
export const exercises = [
  ['벤치프레스','상체','헬스장'], ['랫풀다운','상체','헬스장'], ['덤벨 숄더프레스','상체','헬스장'],
  ['시티드 로우','상체','헬스장'], ['레그프레스','하체·코어','헬스장'], ['레그 컬','하체·코어','헬스장'],
  ['스쿼트','하체·코어','헬스장'], ['푸시업','상체','홈트레이닝'], ['밴드 로우','상체','홈트레이닝'],
  ['벽 푸시업','상체','홈트레이닝'], ['밴드 풀어파트','상체','홈트레이닝'], ['맨몸 스쿼트','하체·코어','홈트레이닝'],
  ['런지','하체·코어','홈트레이닝'], ['글루트 브리지','하체·코어','홈트레이닝'],
  ['데드 버그','하체·코어','공통'], ['버드독','하체·코어','공통'], ['밴드 컬','상체','공통']
];

// Approximate values per 100 g of prepared food: carbs, protein, fat, and KRW.
export const foods = [
  ['현미밥','탄수화물',26,3,1,450], ['찐 고구마','탄수화물',26,2,0.2,650],
  ['오트밀','탄수화물',12,2.5,1.5,430,'귀리 글루텐'], ['잡곡밥','탄수화물',28,3,1,480],
  ['닭가슴살','단백질',0,31,3.6,1350,'닭 가금류'], ['두부','단백질',2,9,5,620,'대두 콩'],
  ['삶은 달걀','단백질',1,13,11,750,'계란 난류 달걀'], ['연어 구이','단백질',0,22,12,3800,'생선 어류 연어'],
  ['돼지 안심','단백질',0,26,4,1650,'돼지고기'], ['렌틸콩','단백질',20,9,0.4,520,'콩'],
  ['브로콜리','채소',7,2.8,0.4,900], ['당근','채소',10,1,0.2,420],
  ['양배추','채소',6,1.3,0.1,390], ['시금치','채소',4,3,0.4,880],
  ['올리브유','지방',0,0,100,1900], ['아보카도','지방',9,2,15,2100]
];

const schedules = {2:[0,3],3:[0,2,4],4:[0,1,3,5],5:[0,1,2,4,5],6:[0,1,2,3,4,5]};

export function workoutPlan(profile, rotation = 0) {
  const training = schedules[profile.frequency];
  const available = exercises.filter(([name,,place]) =>
    (place === '공통' || place === profile.place) && !profile.avoid.includes(name));
  const groups = ['상체','하체·코어'];
  if (groups.some(group => !available.some(([,area]) => area === group))) {
    throw new Error('상체와 하체 운동을 각각 한 종목 이상 남겨 주세요.');
  }
  return days.map((_, day) => {
    const slot = training.indexOf(day);
    if (slot < 0) return {title:'회복 및 휴식', minutes:0, items:[]};
    const group = groups[(slot + rotation) % 2];
    const pool = available.filter(([,area]) => area === group);
    const ordered = pool.slice().sort(([a],[b]) => Number(profile.prefer.includes(b)) - Number(profile.prefer.includes(a)));
    const sets = profile.age < 18 || profile.level === '초보자' ? 2 : profile.level === '상급자' ? 4 : 3;
    const reps = profile.goal === goals[1] ? 10 : profile.goal === goals[3] ? 15 : 12;
    const rest = reps === 10 ? 90 : 60;
    const minutesPerExercise = Math.ceil((sets * (reps * 3 + 30) + (sets - 1) * rest) / 60);
    const count = Math.min(pool.length, 5, Math.floor((profile.duration - 8) / minutesPerExercise));
    return {
      title:group, minutes:8 + count * minutesPerExercise,
      items:ordered.slice(0,count).map(([name]) => ({name,sets,reps,rest}))
    };
  });
}

export function nutritionGoal(profile, active) {
  if (profile.age < 18) return null;
  const offset = {남성:5,여성:-161}[profile.sex] ?? -78;
  const base = profile.bmr || 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + offset;
  const change = profile.goal === goals[0] ? -150 : profile.goal === goals[1] ? 150 : 0;
  const kcal = Math.round(Math.max(1500, base * (active ? 1.45 : 1.32) + change) / 10) * 10;
  return {kcal,carb:Math.round(kcal * .5 / 4),protein:Math.round(kcal * .22 / 4),fat:Math.round(kcal * .28 / 9)};
}

export function nutrition(food, grams) {
  const {carb, protein, fat, kcal} = food;
  const factor = grams / 100;
  return {carb:carb*factor,protein:protein*factor,fat:fat*factor,kcal:kcal*factor};
}

export function sumNutrition(items) {
  return items.reduce((sum, item) => ({
    kcal:sum.kcal+item.kcal,carb:sum.carb+item.carb,protein:sum.protein+item.protein,fat:sum.fat+item.fat
  }), {kcal:0,carb:0,protein:0,fat:0});
}

export function mealPlan(profile, workouts, preferences) {
  const exclusions = preferences.exclude.normalize('NFKC').toLowerCase().split(/[\s,;\/·，()]+/).filter(Boolean);
  const pool = foods.filter(([name,,,,,,aliases='']) =>
    !exclusions.some(term => name.toLowerCase().includes(term) || aliases.includes(term)));
  const kinds = ['탄수화물','단백질','채소','지방'];
  if (kinds.some(kind => !pool.some(([,category]) => category === kind))) {
    throw new Error('제외 조건을 적용하면 모든 식품군을 구성할 수 없습니다.');
  }
  const choose = (kind, index, economical) => {
    const options = pool.filter(([,category]) => category === kind);
    if (economical) return options.sort((a,b) => a[5] - b[5])[0];
    const preferred = options.filter(([name]) => preferences.prefer.includes(name));
    const candidates = preferred.length && index % 3 !== 2 ? preferred : options;
    return candidates[index % candidates.length];
  };
  const buildDay = (workout, day, economical) => {
    const target = nutritionGoal(profile, workout.items.length > 0);
    const labels = {2:['첫 식사','두 번째 식사'],3:['아침','점심','저녁'],4:['아침','점심','간식','저녁'],5:['아침','오전 간식','점심','오후 간식','저녁'],6:['아침','오전 간식','점심','오후 간식','저녁','저녁 간식']};
    const meals = labels[preferences.count].map((title, index) => {
      const portions = [160,110,100,12];
      const size = /간식/.test(title) ? .56 : 1;
      const standard = target ? target.kcal / 2100 : 1;
      const foods = kinds.map((kind,k) => {
        const [name,,carb,protein,fat,price] = choose(kind,day+index+k,economical);
        const grams = Math.round(portions[k] * standard * size * 3 / preferences.count);
        return {name,grams,carb,protein,fat,kcal:4*(carb+protein)+9*fat,price};
      });
      return {title,foods};
    });
    const all = meals.flatMap(meal => meal.foods);
    if (target) {
      const total = all.reduce((sum,food) => sum+food.kcal*food.grams/100,0);
      all.forEach(food => {food.grams = Math.max(1,Math.round(food.grams * target.kcal / total));});
    }
    const cost = Math.ceil(all.reduce((sum,food) => sum+food.grams*food.price/100,0));
    return {target,meals,cost};
  };
  return workouts.map((workout, day) => {
    const plan = buildDay(workout,day,false);
    if (plan.cost <= preferences.budget) return plan;
    const economical = buildDay(workout,day,true);
    if (economical.cost <= preferences.budget) return economical;
    throw new Error('예산 범위에 맞는 식단을 구성하지 못했습니다. 하루 식비를 조정해 주세요.');
  });
}

export function dateKey(day, now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() - (date.getDay() + 6) % 7 + day);
  return [date.getFullYear(),date.getMonth()+1,date.getDate()].join('-');
}
