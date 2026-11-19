// Public source materials and human-written rubrics. Never shown as answers to the model.
import {generationFixture} from './generation.mjs'
import {normalizeSceneTemplate} from '../../skills/dsh-ppt/scripts/deck-template-scene.mjs'
const scenarios=[
 {id:'unordered',instruction:'Один слайд с равноправными принципами. Порядок, этапы и связи не заданы.',facts:['Прозрачность','Надёжность','Доступность'],allowed:['list','cards']},
 {id:'process',instruction:'Один слайд: обязательные этапы выполняются последовательно в указанном порядке.',facts:['Получить заявку','Проверить комплектность','Передать исполнителю'],allowed:['process'],diagram:{kind:'process',ordered:true,items:[{label:'Получить заявку'},{label:'Проверить комплектность'},{label:'Передать исполнителю'}]}},
 {id:'timeline',instruction:'Один слайд с календарными вехами; порядок соответствует датам.',facts:['2026-02','Начало пилота','2026-05','Проверка результатов'],allowed:['timeline'],diagram:{kind:'timeline',ordered:true,items:[{label:'Начало пилота',date:'2026-02'},{label:'Проверка результатов',date:'2026-05'}]}},
 {id:'cycle',instruction:'Один слайд: после третьего этапа возвращаемся к первому, цикл повторяется.',facts:['Наблюдать','Проверять','Корректировать'],allowed:['cycle'],diagram:{kind:'cycle',repeats:true,items:[{label:'Наблюдать'},{label:'Проверять'},{label:'Корректировать'}]}},
 {id:'comparison',instruction:'Один слайд: сравнить варианты по общим критериям. Неизвестный срок оставить неизвестным.',facts:['Локальный','Облачный','Контроль данных','Срок запуска','Полный','Ограниченный','Неизвестно','Быстро'],allowed:['comparison'],diagram:{kind:'comparison',criteria:['Контроль данных','Срок запуска'],items:[{label:'Локальный',values:['Полный','Неизвестно']},{label:'Облачный',values:['Ограниченный','Быстро']}]}},
 {id:'kpi',instruction:'Один слайд с двумя показателями; изменения к прошлому периоду не указаны.',facts:['Доступность','99','%','Обращения','42','шт.'],allowed:['kpi'],diagram:{kind:'kpi',items:[{label:'Доступность',value:99,unit:'%'},{label:'Обращения',value:42,unit:'шт.'}]}},
 {id:'categories',instruction:'Один слайд с нативной количественной диаграммой: категории независимы, не части целого, порядка времени нет.',facts:['Подразделение А','Подразделение Б','Заявки','17','9'],allowed:['chart'],diagram:{kind:'chart',chart:{kind:'bar',categories:['Подразделение А','Подразделение Б'],series:[{name:'Заявки',values:[17,9]}]}},chartKinds:['bar','column']},
 {id:'quote',instruction:'Один слайд: цитата с указанным автором.',facts:['Измеряйте результат, а не занятость.','Автор учебного примера'],allowed:['quote'],diagram:{kind:'quote',items:[{label:'Измеряйте результат, а не занятость.',source:'Автор учебного примера'}]}},
 {id:'identifiers',instruction:'Один слайд: числа являются кодами проектов, количественных показателей нет. Не превращать их в данные графика.',facts:['Проект 2026','Проект 104','Проект 87'],allowed:['list','cards']},
]
export function generationEvaluationCases(){const cases=scenarios.map((s,i)=>{
 const {plan:_,...input}=generationFixture(3,1)
 input.id='generation-evaluation-v2';input.name='Оценка генерации v2 — 3 варианта'
 input.style.theme='swiss';input.style.brand={backgroundColor:'#FFFFFF',textColor:'#242424',primaryColor:'#7C3AED'}
 input.style.layouts.forEach((l,n)=>{l.backgroundColor='#FFFFFF';l.elements[0].frame={x:500000+n*100000,y:800000+n*200000,w:8500000-n*300000,h:5000000-n*200000};l.elements[0].textStyle={size:20,fontFamily:'Liberation Sans',color:'#242424'}})
 const template=normalizeSceneTemplate(input),sourceId='material:'+s.id
 const body=s.facts.join('\n'),row={id:'slide-'+s.id,variantId:template.style.layouts[i%3].id,intent:s.instruction,structure:s.allowed[0],values:{body},sources:[sourceId],...(s.diagram?{visual:{slotId:'body',diagram:{version:2,...structuredClone(s.diagram)}}}:{})}
 const data=s.diagram?structuredClone(s.diagram.kind==='chart'?s.diagram.chart:s.diagram):undefined
 if(data){delete data.kind;delete data.ordered;delete data.repeats}
 return {id:s.id,template,material:{id:sourceId,instruction:s.instruction,facts:s.facts,...(data?{data}:{})},rubric:{slideCount:1,allowedStructures:s.allowed,requiredFacts:s.facts,...(s.diagram&&s.diagram.kind!=='chart'?{semantic:structuredClone(s.diagram)}:{}),...(s.chartKinds?{chartKinds:s.chartKinds,chart:s.diagram.chart}:{})},referencePlan:[row]}
});cases.push({id:'mixed-deck',template:structuredClone(cases[0].template),material:{id:'material:mixed-deck',instruction:'Создай колоду из 9 содержательных слайдов в порядке разделов. Обложку не добавляй. Выбирай представление по смыслу каждого раздела, используй доступные структурно разные варианты шаблона. Не придумывай факты ради разнообразия.',sections:cases.map(c=>structuredClone(c.material))},rubric:{slideCount:cases.length,slides:cases.map(c=>({sourceId:c.material.id,...structuredClone(c.rubric)})),requireRhythm:true},referencePlan:cases.flatMap(c=>structuredClone(c.referencePlan))});return cases}
