// Controlled public demo materials. Never derived from private attachments.
import {PNG} from 'pngjs'

const ref=['material']
const items=labels=>labels.map((label,i)=>({id:'item-'+(i+1),label}))
export function compactTemplates(){
  return ['light','dark','decor','portrait'].map(key=>{
    const page=key==='portrait'?{width:7559675,height:10691813}:{width:12192000,height:6858000}
    const dark=key==='dark',color=dark?'#FFFFFF':'#202020',background=dark?'#121826':'#FFFFFF'
    const text=(id,y,h,size)=>({id,role:'content',type:'text',frame:{x:500000,y,w:page.width-1000000,h},textStyle:{fontFamily:'Arial',size,color},paragraphs:[{runs:[{text:'Образец оформления'}]}]})
    const manifest={schemaVersion:3,id:'compact-'+key,name:'Compact '+key,revision:1,createdAt:'2026-11-20T00:00:00Z',updatedAt:'2026-11-20T00:00:00Z',style:{pageSize:page,brand:{primaryColor:'#2864B4'},layouts:['cover','content','closing'].map(purpose=>({id:purpose,name:purpose,purpose,backgroundColor:background,slots:[],elements:[
      {id:'stripe',role:'decor',type:'shape',preset:'rect',frame:{x:0,y:0,w:100000,h:page.height},fill:{color:'#2864B4'}},
      ...(key==='decor'?[{id:'right-panel',role:'decor',type:'shape',preset:'rect',frame:{x:page.width-2400000,y:1100000,w:2200000,h:5000000},fill:{color:'#DCE8F5'}},{id:'corner',role:'decor',type:'shape',preset:'ellipse',frame:{x:page.width-1700000,y:200000,w:1000000,h:600000},fill:{color:'#2864B4'}}]:[]),
      text('sample-title',250000,650000,30),text('sample-body',1400000,page.height-2000000,18)
    ]}))},assetMap:{}}
    return {key,manifest,assets:{},report:{objects:[],warnings:[]}}
  })
}
export function compactCases(){
  const definitions=[
    ['process','Порядок обработки','Процесс строго последовательно: Приём → Проверка → Архив. Других шагов нет.',{type:'process',ordered:true,items:items(['Приём','Проверка','Архив'])}],
    ['cards','Принципы сервиса','Три равноправных принципа: Прозрачность, Надёжность, Доступность. Это не этапы и не рейтинг.',{type:'cards',items:items(['Прозрачность','Надёжность','Доступность'])}],
    ['chart','Заявки по командам','Количество заявок: Север — 17, Юг — 9. Единица: заявки. Серия: Заявки. Это независимые категории, не доли целого и не временной ряд.',{type:'chart',kind:'column',unit:'заявки',categories:['Север','Юг'],series:[{name:'Заявки',values:[17,9]}]}],
    ['timeline','Календарь проекта','Реальные в рамках демонстрации даты: 2026-01-15 — Старт; 2026-03-10 — Пилот; 2026-06-01 — Выпуск. Порядок хронологический.',{type:'timeline',ordered:true,items:items(['Старт','Пилот','Выпуск']).map((i,k)=>({...i,date:['2026-01-15','2026-03-10','2026-06-01'][k]}))}],
    ['comparison','Сравнение вариантов','Общие критерии: Статус, Охват. Альфа: Готов, Полный. Бета: статус неизвестен, охват Частичный. Неизвестное не означает ноль.',{type:'comparison',criteria:['Статус','Охват'],items:items(['Альфа','Бета']).map((i,k)=>({...i,values:k?[null,'Частичный']:['Готов','Полный']}))}],
    ['big_number','Выпуск видео','Создано 30 видео. Пояснение: Создано видео. Единица: видео. Данных о росте или процентах нет.',{type:'big_number',items:[{id:'videos',label:'Создано видео',value:30,unit:'видео'}]}],
    ['table','Реестр проектов','Таблица с колонками Проект, Статус: Аватар — Готов; Ассистент — В работе. Сохранить соответствие строк и столбцов.',{type:'table',headers:['Проект','Статус'],rows:[['Аватар','Готов'],['Ассистент','В работе']]}],
    ['image','Исходная иллюстрация','Использовать только assetId: sample-image. Alt: Два цветовых поля. Подпись: Контрольная иллюстрация. Не искать и не генерировать изображение.',{type:'image',assetId:'sample-image',alt:'Два цветовых поля',caption:'Контрольная иллюстрация'}],
    ['long-ru','Подробный русский материал','', {type:'cards',items:['Согласование','Проверка','Передача'].map((label,i)=>({id:'long-'+i,label,detail:[
      'Команда согласует состав материалов с владельцем процесса, фиксирует обязательные сведения и сохраняет исходные формулировки ограничений. Решения передаются ответственному редактору вместе с контекстом обсуждения.',
      'Редактор проверяет соответствие описаний исходным материалам, уточняет неоднозначные термины и отдельно отмечает отсутствующие подтверждения. Неизвестные сведения не заменяются предположениями.',
      'После проверки команда передаёт согласованный пакет получателю, сохраняет пояснения к существенным фактам и перечисляет вопросы, для которых требуется дополнительный ответ владельца процесса.'
    ][i]}))}],
    ['incomplete','Неполные сведения','Общие критерии: Срок, Бюджет. Альфа: срок Июнь, бюджет неизвестен. Бета: срок неизвестен, бюджет неизвестен. Все неизвестные значения сохранить явно; не оценивать их.',{type:'comparison',criteria:['Срок','Бюджет'],items:items(['Альфа','Бета']).map((i,k)=>({...i,values:k?[null,null]:['Июнь',null]}))}],
    ['invalid-chart','Ошибочная рекомендация диаграммы','Север — 17 заявок, Юг — 9 заявок. В черновике ошибочно предложена круговая диаграмма: данные не являются долями целого. Использовать сравнение категорий столбцами, единица заявки, серия Заявки. Значения не нормализовать.',{type:'chart',kind:'column',unit:'заявки',categories:['Север','Юг'],series:[{name:'Заявки',values:[17,9]}]}],
    ['overload','Полный реестр','', {type:'table',headers:['Проект','Статус'],rows:Array.from({length:30},(_,i)=>['Проект '+String(i+1).padStart(2,'0'),i%2?'В работе':'Готов'])}]
  ]
  return definitions.map(([id,title,material,visual])=>{
    if(id==='long-ru')material=visual.items.map(i=>i.label+': '+i.detail).join('\n')+'\nВсе предложения обязательны; сокращение и пересказ не разрешены.'
    if(id==='overload')material='Реестр с колонками Проект, Статус:\n'+visual.rows.map(r=>r.join(' — ')).join('\n')+'\nВсе строки обязательны. Разрешено увеличить число слайдов, повторяя заголовки колонок.'
    const sources=[{id:'material',text:material,synthetic:true}]
    const literals=visual.type==='table'?[...visual.headers,...visual.rows.flat().filter(v=>v!==null)]:visual.type==='chart'?[...visual.categories,visual.unit,...visual.series.flatMap(s=>s.values.map(String))]:visual.type==='image'?[visual.caption]:[...(visual.criteria??[]),...visual.items.flatMap(i=>[i.label,i.detail,i.date,i.value===undefined?undefined:String(i.value),i.unit,...(i.values??[])].filter(v=>v!==undefined&&v!==null))]
    const assets={}
    if(id==='image'){
      const png=new PNG({width:32,height:16});for(let i=0;i<32*16;i++)png.data.set(i%32<16?[40,100,180,255]:[220,100,40,255],i*4)
      assets['sample-image']={mime:'image/png',width:32,height:16,data:'data:image/png;base64,'+PNG.sync.write(png).toString('base64')}
    }
    return {id,title,instruction:'Подготовить редактируемую презентацию для проектной команды. Представление: '+visual.type+'. Сохранить приведённые названия, значения, единицы и формулировки дословно. '+(id==='overload'||id==='long-ru'?'Разрешено увеличить число слайдов.':'Один содержательный слайд.'),
      brief:{version:1,goal:'Объяснить '+title,audience:'Проектная команда',lang:'ru',allowMoreSlides:['long-ru','overload'].includes(id),slideCount:1,attachments:[],requiredFacts:[...new Set(literals)]},
      context:{sources},assets,dataMode:'demo',rubric:{visual:{...visual,sourceRefs:ref},requiredTexts:[...new Set(literals)],private:false}}
  })
}
