# Библиотека шаблонов dsh-ppt

Шаблон = **стиль** (тема, палитра, шрифты, логотип, футер, фоны страниц) +
**каркас страниц** (плейсхолдеры «Заполнить: …») + необязательные
**слайды-образцы**. Дека, созданная из шаблона, остаётся обычным
редактируемым проектом dsh-ppt; незаполненные места дают `template-unfilled`
и статус черновика в `ppt_check`.

## Скоупы и права

| Ключ | Где лежит | Кто видит | Кто управляет |
|---|---|---|---|
| `builtin:<id>` | пакет плагина (`assets/templates/`) | все | никого (read-only) |
| `public:<id>` | `$DSH_HOME/plugins/dsh-ppt/templates/public/` | все | админ |
| `user:<id>` | `$DSH_HOME/plugins/dsh-ppt/templates/users/<логин>/` | только владелец | владелец |

**Админ** (модель плагина auto-memory): авторитетный ответ `webAuth` хоста
(флаг `admin` в cookie-идентичности для панели, `isAdmin` для инструментов);
если хост недоступен — запасной список `admins` в конфиге плагина
(сравнение trim, регистрозависимое). Сессия без owner (локальная/CLI) —
админ; делегированная сессия (fork/fleet) — никогда не админ; всё
сомнительное — не админ (fail-closed). Публикация личного шаблона в общие и
импорт в общие — только админ (`owner` — чей шаблон публикуется).

## Формат bundle

`dsh-ppt-template v1` = ZIP:

```
template.json    # манифест (schemaVersion 1, ≤ 1 MiB)
assets/*         # PNG/JPEG: логотип, фоны (≤ 5 MiB каждый, ≤ 8 MiB суммарно)
README.txt
```

Принимается и голый `template.json`. Защита: whitelist имён файлов, mime
png/jpeg, лимит распаковки 16 MiB, без `..`/симлинк.

## Инструменты

### Создание презентации из шаблона

```
ppt_create { title, templateId: "builtin:corporate-report", lang: "ru" }
```

`templateSamples: false` — без слайдов-образцов. Сценарные `template`
(weekly/defense/project/pitch) работают как раньше.

### Шаблон из примера PPTX / из проекта

```
ppt_template { operation: "create-from-pptx", pptxPath, newTemplateId, name }
ppt_template { operation: "create-from-project", deckPath, newTemplateId, name }
```

Из PPTX извлекается стиль (палитра темы, шрифты, фоны мастеров/макетов,
логотип-эвристика по маленьким картинкам мастера) и каркас заголовков.
Геометрия слайдов не копируется — новые деки рендерит движок dsh-ppt.
В отчёте (`report`) перечислено, что извлечено и предупреждения (нет логотипа,
нестандартный шрифт).

### Импорт / экспорт

```
ppt_template { operation: "import", path | data, scope: "user" | "public" }
ppt_template { operation: "export", templateId, outputDir }
```

`scope: "public"` — только админ. Панель: вкладка «Шаблоны» → «Импорт
шаблона» (файл до 16 MiB), кнопка «Экспорт» на карточке (скачивание ZIP).

### Редизайн существующего проекта

```
ppt_template { operation: "apply-to-project", deckPath, templateId | bundlePath,
               expectedRevision, saveAs }
```

Меняется только оформление (theme, brand, фоны по типам страниц
cover/section/content/closing); текст и порядок страниц не трогаются.
По умолчанию правка in-place и попадает в историю undo; `saveAs: true` —
отдельная копия. В манифест проекта пишется происхождение
`template: {id, revision}`, видимое в `ppt_check`.

Панель: кнопка «Редизайн шаблоном» в инспекторе открытого проекта.

### Прочее

```
ppt_template { operation: "list" | "get" | "save" | "delete" | "publish" }
```

## CLI (автономный skill)

```
node build-deck.mjs --title "Отчёт" --template-file corp.zip            # создать из шаблона
node build-deck.mjs --restyle deck.json --template-file corp.zip        # редизайн
node build-deck.mjs --create-template-from-pptx example.pptx \
  --template-id corp --template-name "Corp" --save-template .           # pptx → шаблон
node build-deck.mjs --create-template-from-deck deck.json \
  --template-id corp --template-name "Corp" --save-template .           # проект → шаблон
node build-deck.mjs --export-template public:corp --to ./out            # выгрузка (DSH-библиотека)
```

`--template-key <scope:id>` вместо `--template-file` берёт шаблон из
библиотеки DSH (`DSH_HOME`, для личных — `DSH_USER`).

## Фоны страниц

Фоны из шаблона применяются по типу страницы: в HTML — CSS-слой
(`data-bgt`), в PPTX — `setSlideBackgroundImage`. Дека без фонов полностью
работоспособна; неподдерживаемый формат собирается без фона с предупреждением.
Движковые ограничения: `style.backgrounds` задаётся только через шаблон.

## Ограничения v1

- Точная геометрия слайдов из PPTX не воспроизводится (только стиль+каркас);
- Пересборка структуры существующего дека по каркасу шаблона (restructure) —
  вне v1;
- Импорт шаблонов по URL и облачный каталог отсутствуют — только файлы;
- Синхронизация библиотеки между машинами — вручную экспортом bundle.
