**简体中文** · [English](README.en.md)

# PPT

**给出材料，拿到可以交付的演示文稿。**

[![npm](https://img.shields.io/npm/v/dsh-ppt)](https://www.npmjs.com/package/dsh-ppt) [![downloads](https://raw.githubusercontent.com/STARDUSTLC666/dsh-suite/npm-downloads/assets/dsh-ppt-downloads.svg)](https://www.npmjs.com/package/dsh-ppt) [![total downloads](https://raw.githubusercontent.com/STARDUSTLC666/dsh-suite/npm-downloads/assets/dsh-ppt-total-downloads.svg)](https://www.npmjs.com/package/dsh-ppt)

**[安装使用](#安装) · [使用流程](#开始使用) · [完整说明](https://github.com/STARDUSTLC666/dsh-ppt/blob/master/docs/REFERENCE.zh.md)**

<picture>
  <source media="(prefers-color-scheme: dark) and (max-width: 640px)" srcset="https://raw.githubusercontent.com/STARDUSTLC666/dsh-ppt/master/docs/assets/intro/workflow-zh-mobile-dark.svg">
  <source media="(max-width: 640px)" srcset="https://raw.githubusercontent.com/STARDUSTLC666/dsh-ppt/master/docs/assets/intro/workflow-zh-mobile-light.svg">
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/STARDUSTLC666/dsh-ppt/master/docs/assets/intro/workflow-zh-dark.svg">
  <img src="https://raw.githubusercontent.com/STARDUSTLC666/dsh-ppt/master/docs/assets/intro/workflow-zh-light.svg" alt="给出材料，拿到可以交付的演示文稿。 · 流程示意" width="100%">
</picture>

## Форк с русской локалью

Это форк [STARDUSTLC666/dsh-ppt](https://github.com/STARDUSTLC666/dsh-ppt) с русским интерфейсом рабочего стола (раздел настроек «Презентации»). При языке хоста `ru` клиентский UI берёт строки из `templates/client-ru.js` (ключ — китайский оригинал); непереведённые строки показываются по-английски, содержимое слайдов и язык плеера дек не меняются. Версии форка: `<версия апстрима>-ru.N`, теги `v<версия апстрима>-ru.N`. Выбор ИИ-модели в рабочем столе (репетиция, визуальная проверка, авто-фикс слайдов) — каскад «кнопка → активные провайдеры → модели»: UI читает RPC-каталог хоста `llm.models` (личные группы резолвятся по cookie), серверный листинг `coach-options`/`visual-options` остаётся для совместимости. Личные модели видны и в генерации: обработчик маршрута определяет владельца по cookie и, если харнес предоставляет `listModelsForOwner`/`listProvidersForOwner`, берёт модели из личной плоскости, а репетиция и визуальная проверка вызывают `streamForOwner(owner, options)`; на старом харнесе — общий список и общий `llm.stream`, как в апстриме.

Новые презентации в DSH выдаются как **HTML, PDF и PPTX**. Если PDF-движок недоступен или экспорт не удался, выдаются HTML/PPTX с объяснением причины. JSON проекта хранится постоянно в `$DSH_HOME/plugins/dsh-ppt/projects`, чтобы работали редактирование и отмена изменений; по умолчанию он не включается в выдачу и ZIP. PNG, PDF рендера, manifest и receipt хранятся в `$DSH_HOME/plugins/dsh-ppt/tmp`. Рендер целиком удаляется после **90 дней без использования**; просмотр страницы и проверка receipt обновляют этот срок. Очистка запускается при старте плагина и перед новым рендерингом. Выданные файлы, постоянные JSON и старые проекты не очищаются и не переносятся.

При наличии ID сессии в DSH выдача по умолчанию сохраняется в `<cwd>/dsh-ppt/session-<hash>`, а рендеры — в `$DSH_HOME/plugins/dsh-ppt/tmp/session-<hash>/render-<UUID>`. Разные чаты с общей рабочей папкой получают разные каталоги; повторное открытие того же чата использует тот же каталог. Отдельный явно заданный `outputDir` сохраняет прежнее поведение. Без ID сессии (включая CLI) действуют прежние пути. Это разделение хранения, а не контроль доступа. Старые файлы не переносятся. Плашки файлов под ответом и общий ZIP рабочей папки формирует DSH: они должны выбирать файлы текущей сессии, а не всё содержимое общей папки.


С версии `0.20.6-ru.19` для обычных табличных презентаций доступен `ppt_create.tableSpec`: источники, заголовки и строки без координат на выбранном библиотечном шаблоне schema 3. При разрешённом разбиении движок сам переносит строки и повторяет заголовки. Экспериментальный `ppt_generation` для этого не нужен. [Контракт и ограничения](skills/dsh-ppt/references/table-create.md).

С версии `0.20.6-ru.25` поле `ppt_create.visualSpec` поддерживает обычную компактную генерацию карточек, диаграмм и таблиц, в том числе смешанной колоды в порядке slides, на согласованном schema 3 шаблоне. Координаты и перенос рассчитывает движок; прежний tableSpec остаётся отдельным совместимым входом. Серверный пример карточек/column на ru.24 принят; смешанный пример ru.25 на public:dkp также проверен и принят пользователем. [Контракт и пример](skills/dsh-ppt/references/visual-create.md).

Как забрать изменения апстрима:

```bash
git remote add upstream https://github.com/STARDUSTLC666/dsh-ppt.git   # один раз
git fetch upstream
git checkout ru-locale            # рабочая ветка форка
git merge upstream/master
pnpm install && pnpm build        # пересобрать lib/ (tsc + клиент + updates-клиент)
node --test "test/*.test.mjs"     # тесты; client-locale проверяет цепочку ru → en → zh
```

После мержа: новые zh-строки апстрима доперевести в `templates/client-ru.js` (терминология — в шапке файла; найти новые ключи можно, сравнив EN-словарь `templates/client.js` со словарём RU), затем закоммитить и поставить тег `vX.Y.Z-ru.N`. Пока строка не переведена — она показывается по-английски, ничего не ломается.

## 功能

- 生成 HTML 放映、可编辑 PPTX 与工程包。
- 按需编辑文字、图片与页序，支持撤销。
- 可选数字溯源、现场推演、AI 预审与答辩演练。

<details>
<summary>查看实际示例</summary>

![workbench example](https://raw.githubusercontent.com/STARDUSTLC666/dsh-ppt/master/docs/assets/intro/screen-zh.webp)

图片来自验证环境的真实界面或示例 PPTX 渲染，使用示例数据。

</details>

## 安装

在 DSH 桌面版「插件」面板安装 `dsh-ppt`。已配置命令行时也可使用：

```bash
dsh plugin --profile desktop add dsh-ppt
```

网页版把 `desktop` 改为 `web`；安装后重启对应的 DSH。宿主要求以包声明 `>=0.2.2-rc.3` 为准。

## 开始使用

1. 在目标工作区提供材料、用途、听众和页数，例如“做成可交付的演示文稿，生成 HTML、PPTX 和工程文件”。
2. 从左侧栏打开“演示文稿”，在工程库搜索或选择生成的项目。
3. 选择页面编辑文字、图片或顺序，保存后核对预览；需要时渲染当前 PPTX 检查实际画面。
4. 按需要主动开启 AI 预审、模拟答辩或看图修复；直接下载成品不要求这些步骤。
5. 下载“分享成品包”交付，或下载“完整工程包”保留编辑能力；在目标播放器或 Office 中再核对一次。

可以这样说：

> 根据这些材料制作演示文稿，提供 HTML、可编辑 PPTX 和工程包，先确认听众与页数。

## 开始前要知道

可直接下载成品；AI 预审与演练按需开启。Office 修改不会自动同步回工程。

配置、完整工具与排错见[详细使用说明](https://github.com/STARDUSTLC666/dsh-ppt/blob/master/docs/REFERENCE.zh.md)。

## 插件更新

在工作台或原生插件详情页底部检查更新。默认自动检查，**默认不自动安装**；是否安装、何时重启由你决定。Suite 管理的组件随整包更新。[查看更新规则](https://github.com/STARDUSTLC666/dsh-ppt/blob/master/docs/REFERENCE.zh.md)。

## 文档

- [详细使用、配置与边界](https://github.com/STARDUSTLC666/dsh-ppt/blob/master/docs/REFERENCE.zh.md)
- [更新记录](https://github.com/STARDUSTLC666/dsh-ppt/blob/master/CHANGELOG.md)
- [验证范围与历史](https://github.com/STARDUSTLC666/dsh-ppt/blob/master/docs/VALIDATION.md)

## 反馈与贡献

如果插件帮到了你，欢迎 Star，让更多人发现它。问题和建议请提交 [Issues](https://github.com/STARDUSTLC666/dsh-ppt/issues)，也欢迎代码与文档 [PR](https://github.com/STARDUSTLC666/dsh-ppt/pulls)。反馈时附上版本与复现步骤，并移除凭据。

## License

[MIT](https://github.com/STARDUSTLC666/dsh-ppt/blob/master/LICENSE)

<a id="依赖与配置"></a>
