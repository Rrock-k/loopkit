# LoopKit

LoopKit — это маленький runtime и протокол для HTML-артефактов, чтобы собирать точный фидбэк прямо внутри интерфейса и передавать его AI для следующей итерации.

Главный цикл:

```text
AI создаёт HTML v1
→ пользователь открывает HTML
→ кликает элементы и оставляет фидбэк
→ экспортирует feedback bundle
→ AI делает HTML v2
→ старый bundle считается использованным
```

LoopKit не является баг-трекером, Webflow-клоном или системой вечной истории. В v0 фидбэк живёт одну итерацию. Между версиями сохраняются только устойчивые решения в `DECISIONS`.

## Быстрый старт

Добавь metadata:

```html
<script type="application/loopkit+json">
{
  "artifact_id": "my-artifact",
  "artifact_version": "v1",
  "title": "My Artifact"
}
</script>
```

Добавь решения:

```html
<script type="text/plain" id="loopkit-decisions">
DECISIONS:
- один самодостаточный HTML
- минималистичный интерфейс
</script>
```

Разметь важные элементы:

```html
<button
  data-loop-id="start-screen.play-button"
  data-loop-kind="button"
  data-loop-title="Play button"
>
  Play
</button>
```

Подключи runtime:

```html
<script src="./loopkit.js"></script>
```

Открой HTML, нажми `Mark up`, кликни элемент, оставь комментарий, затем `Export` — bundle можно вставить в любой AI-чат вместе с текущим HTML.

## Структура репозитория

```text
README.md              объяснение для человека
AGENTS.md              инструкция для AI-агентов
PROTOCOL.md            правила совместимого артефакта
loopkit.js             runtime без зависимостей
examples/basic.html    минимальный пример
examples/node-backend-deck.html  пример на реальном слайддеке
scripts/validate.mjs   проверка совместимости HTML
package.json
LICENSE
```

## Команды

```bash
npm run validate -- examples/basic.html
npm run validate -- examples/node-backend-deck.html
```

## Главные правила

1. Артефакт должен быть понятен сам по себе.
2. Важные элементы получают `data-loop-id`.
3. Feedback bundle валиден только для той версии, из которой он экспортирован.
4. Агент обязан обработать каждый пункт bundle.
5. Старый feedback не переносится в новую версию.
6. Между версиями живут только `DECISIONS`.
