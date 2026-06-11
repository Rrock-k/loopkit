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

### Linked source version

Удобно при разработке:

```html
<script src="./loopkit.js"></script>
```

### Standalone share version

Удобно, когда нужен один файл. `loopkit.js` вшивается внутрь HTML build-скриптом.

```bash
npm run standalone -- examples/basic.html examples/basic.standalone.html
```

Для пользователя это всё равно один HTML-файл.

## Минимальный артефакт

```html
<script type="application/loopkit+json">
{
  "artifact_id": "my-artifact",
  "artifact_version": "v1",
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

<script src="./loopkit.js"></script>
```

## Runtime modes

```text
Mark up   — клик по элементу с data-loop-id и комментарий к нему
Comments  — свободный pin-комментарий на экране
Tweaks    — запрос агенту добавить интерактивные твики
Copy      — экспорт feedback bundle для AI
```

## Структура v0

```text
README.md
AGENTS.md
PROTOCOL.md
loopkit.js
examples/basic.html
scripts/validate.mjs
scripts/build-standalone.mjs
package.json
LICENSE
```

## Команды

```bash
npm run validate -- examples/basic.html
npm run standalone -- examples/basic.html examples/basic.standalone.html
```

## Главные правила

1. Важные элементы получают `data-loop-id`.
2. Feedback bundle валиден только для версии, из которой он экспортирован.
3. Агент обязан обработать каждый пункт bundle.
4. Старый feedback не переносится в новую версию.
5. Между версиями живут только `DECISIONS`.
6. Supabase/API — опциональный транспорт, не ядро LoopKit.
