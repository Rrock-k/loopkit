# LoopKit

LoopKit — это маленький JS-runtime и протокол для HTML-артефактов, которые нужно итеративно улучшать с помощью AI.

Главная задача: пользователь открывает HTML, кликает конкретный элемент, оставляет фидбэк, экспортирует feedback bundle и отдаёт его любому AI-агенту для следующей версии.

```text
HTML v1
→ feedback внутри интерфейса
→ export bundle
→ AI делает HTML v2
→ bundle v1 считается использованным
```

LoopKit не является баг-трекером, Webflow-клоном или системой вечной истории. В v0 фидбэк живёт одну итерацию. Между версиями сохраняются только устойчивые решения в `DECISIONS`.

## Подключение

### npm CDN

После публикации пакета:

```html
<script src="https://cdn.jsdelivr.net/npm/@rrock-k/loopkit@0.4.0/dist/loopkit.js"></script>
```

Для артефактов лучше фиксировать версию. `@latest` удобно только для быстрых экспериментов.

### GitHub CDN

Для теста конкретного коммита:

```html
<script src="https://cdn.jsdelivr.net/gh/Rrock-k/loopkit@<commit>/dist/loopkit.js"></script>
```

### Local dev

```html
<script src="../dist/loopkit.js"></script>
```

Перед локальной проверкой:

```bash
npm run build
```

### Standalone share version

Удобно, когда нужен один файл. Runtime вшивается внутрь HTML build-скриптом.

```bash
npm run standalone -- examples/basic.html examples/basic.standalone.html
```

Для пользователя это всё равно один HTML-файл. Standalone-файл генерируется командой, а не хранится как основной исходник.

## Минимальный артефакт

```html
<script type="application/loopkit+json" id="loopkit-meta">
{
  "artifactId": "my-artifact",
  "artifactVersion": "v1",
  "title": "My Artifact"
}
</script>

<script type="text/plain" id="loopkit-decisions">
DECISIONS:
- один самодостаточный HTML
- минималистичный интерфейс
- фидбэк живёт одну итерацию
</script>

<button
  data-loop-id="start.play-button"
  data-loop-kind="button"
  data-loop-title="Play button"
>
  Play
</button>

<script src="https://cdn.jsdelivr.net/npm/@rrock-k/loopkit@0.4.0/dist/loopkit.js"></script>
```

## Runtime modes

```text
Mark up   — клик по элементу и комментарий к нему
Comments  — свободный pin-комментарий на экране
Tweaks    — request-only: попросить агента добавить tweak-контролы в следующей версии
Copy      — экспортировать feedback bundle для AI
```

## DOM Inspector

В `0.4.0` Mark up может выбирать не только `data-loop-id`, но и обычные DOM-элементы. Если стабильного `data-loop-id` нет, target сохраняется как `dom-generated` с selector/tag/classes/text/rect. Видимые DOM-элементы имеют приоритет над `::before` / `::after`; для явного выбора pseudo-element можно удерживать Alt/Option.

## UI v0

Runtime рендерит минималистичную floating-панель поверх артефакта. UI должен быть тихим: без тяжёлых зависимостей, без AI-glow, без лишних статусов. Панель можно скрыть, а при активном режиме LoopKit перехватывает клавиши, чтобы они не конфликтовали с самим артефактом.

## Структура

```text
src/loopkit.js              source entrypoint
scripts/build.mjs           builds dist/loopkit.js
scripts/validate.mjs        validates LoopKit artifacts
scripts/build-standalone.mjs
examples/basic.html
dist/loopkit.js             generated package runtime
dist/chunks/*               runtime chunks used by the loader
package.json
LICENSE
```

`src/*` — source of truth. `dist/*` публикуется в npm package и используется CDN.

## Команды

```bash
npm run build
npm run check
npm test
npm run pack:dry
npm run validate -- examples/basic.html
npm run standalone -- examples/basic.html examples/basic.standalone.html
```

## npm publish

Пакет готовится как public scoped package:

```text
@rrock-k/loopkit
```

Релизный flow:

```bash
npm version patch
git push
git push --tags
```

Тег `v*` запускает `.github/workflows/publish.yml`, который собирает пакет, проверяет его и выполняет `npm publish --access public --provenance`.

Для автоматической публикации нужно включить Trusted Publisher в npm package settings:

```text
Owner: Rrock-k
Repository: loopkit
Workflow filename: publish.yml
```

## Главные правила

1. Важные элементы получают `data-loop-id`.
2. Feedback bundle валиден только для версии, из которой он экспортирован.
3. Агент обязан обработать каждый пункт bundle.
4. Старый feedback не переносится в новую версию.
5. Между версиями живут только `DECISIONS`.
6. Supabase/API — опциональный транспорт, не ядро LoopKit.
