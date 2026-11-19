// Public fictional pilot data, for local regression only; never a live model response.
import {readFileSync} from 'node:fs'
export function workingReportFixture(){
 const template=JSON.parse(readFileSync(new URL('../../assets/templates/working-report/template.json',import.meta.url),'utf8'))
 const diagrams=[
  {kind:'kpi',items:[{label:'Доступность',value:99,unit:'%'},{label:'Обращения',value:42,unit:'шт.'}]},
  {kind:'comparison',criteria:['Контроль данных','Срок запуска'],items:[{label:'Локальный',values:['Полный','Неизвестно']},{label:'Облачный',values:['Ограниченный','Быстро']}]},
  {kind:'chart',chart:{kind:'column',categories:['Подразделение А','Подразделение Б'],series:[{name:'Заявки',values:[17,9]}]}},
  {kind:'process',ordered:true,items:[{label:'Получить заявку'},{label:'Проверить комплектность'},{label:'Передать исполнителю'}]},
  {kind:'kpi',items:[{label:'Обращения, решённые при первом контакте',value:84,unit:'%'},{label:'Среднее время ответа',value:12,unit:'мин'}]},
  {kind:'comparison',criteria:['Доступ к данным','Подготовка','Сопровождение'],items:[{label:'Собственная система',values:['Внутренний','Нужна настройка','Своя команда']},{label:'Облачный сервис',values:['По договору','Готовый сервис','Поставщик']},{label:'Гибридная схема',values:['Раздельный','Неизвестно','Совместно']}]}
 ]
 const titles=['Показатели пилота','Варианты размещения','Обращения по подразделениям','Обработка заявки','Качество поддержки','Подходы к сопровождению']
 const source='Источник: учебные данные пилота'
 const plan=diagrams.map((d,i)=>({id:'pilot-'+i,variantId:template.style.layouts[i%3].id,intent:titles[i],structure:d.kind,values:{heading:titles[i],body:d.kind==='chart'?'Заявки\nПодразделение А\nПодразделение Б\n17\n9':d.items.flatMap(item=>[item.label,...(item.values??[]).filter(v=>v!==null),...(item.value!==undefined?[item.value+' '+item.unit]:[])]).concat(d.criteria??[]).join('\n'),source},sources:['fixture:pilot-'+i],visual:{slotId:'body',diagram:{version:2,...d}}}))
 return {template,plan}
}
