function PptGenerationSummary({report}) {
 if(!report)return null;
 const ru=languageOf()==='ru',m=report.metrics??{};
 const labels={'rhythm-variant-run':'Подряд повторяется один макет','rhythm-structure-run':'Подряд повторяется одна визуальная структура','rhythm-accent':'Акцентные слайды расположены слишком близко','rhythm-limited-variants':'Для этого содержимого мало подходящих вариантов','rhythm-variety':'Использовано мало разных структурных вариантов','rhythm-uniform-content':'Одна визуальная структура; другие допустимы только по смыслу материала','plan-fit-risk':'Есть риск переполнения: проверьте отрисовку'};
 return h('details',{className:'card'},h('summary',null,ru?'План и разнообразие колоды':'Deck plan and variety'),
  report.stale?h('p',{role:'status'},ru?'После правок отчёт относится к исходному плану. Проверьте текущее содержимое отдельно.':'After edits, this report describes the original plan. Review the current content separately.'):null,
  h('p',null,(ru?'Содержательных слайдов: ':'Content slides: ')+(m.contentSlides??0)+(ru?' · вариантов: ':' · variants: ')+(m.variants??0)+(ru?' · структур: ':' · structures: ')+(m.structures??0)),
  h('p',null,(ru?'Использованные варианты: ':'Used variants: ')+(report.usedVariants??[]).join(', ')),
  h('p',null,(ru?'Представления: ':'Representations: ')+(report.usedStructures??[]).join(', ')),
  h('p',null,(ru?'Не использованы в этой колоде: ':'Unused in this deck: ')+((report.unusedVariants??[]).join(', ')||'—')),
  ...(report.diagnostics??[]).map((d,i)=>h('p',{key:i,role:'status'},d.slideId+(d.slotId?' / '+d.slotId:'')+': '+(ru?(labels[d.code]??d.message):d.message)))
 );
}
