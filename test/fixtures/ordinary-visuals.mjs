// Public synthetic content, independent of user attachments.
export function ordinaryVisualSlides(){
  const sourceRefs=['material']
  return [
    {id:'process',title:'Порядок проверки',notes:'Порядок задан источником.',visual:{type:'process',sourceRefs,ordered:true,items:[
      {id:'prepare',label:'Подготовка',detail:'Собрать исходные материалы.'},
      {id:'check',label:'Проверка',detail:'Сверить значения и оговорки.'},
      {id:'approve',label:'Согласование',detail:'Зафиксировать подтверждённый результат.'}
    ]}},
    {id:'timeline',title:'Календарь работ',visual:{type:'timeline',sourceRefs,ordered:true,items:[
      {id:'start',label:'Начало',date:'2026-11-01',detail:'Исходные материалы получены.'},
      {id:'review',label:'Рассмотрение',date:'2026-11-15',detail:'Результат передан на проверку.'},
      {id:'finish',label:'Завершение',date:'2026-12',detail:'Плановый месяц, точный день неизвестен.'}
    ]}},
    {id:'comparison',title:'Сравнение вариантов',visual:{type:'comparison',sourceRefs,criteria:['Стоимость','Срок'],items:[
      {id:'a',label:'Вариант А',values:['50\u00a0000 ₽','10 дней'],detail:'Оценка по исходным условиям.'},
      {id:'b',label:'Вариант Б',values:[null,'15 дней'],detail:'Стоимость требует уточнения.'}
    ]}},
    {id:'numbers',title:'Объём работы',visual:{type:'big_number',sourceRefs,items:[
      {id:'done',label:'Проверено',value:30,unit:'проектов',detail:'Учтены только подтверждённые записи.'},
      {id:'pending',label:'Ожидает данных',value:0,unit:'проектов',detail:'Ноль указан явно; это не неизвестное значение.'}
    ]}}
  ]
}
