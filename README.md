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
<script src="https://cdn.jsdelivr.net/npm/@rrock-k/loopkit@0.4.9/dist/loopkit.js"></script>
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

## Runtime modes

```text
Mark up    — точная привязка к элементу
+ Comment  — свободный pin в точке клика, без визуальной привязки
Tweaks     — request-only: попросить агента добавить tweak-контролы
Copy       — экспортировать feedback bundle для AI
```

## Forms / structured state

LoopKit также умеет собирать простые формы как обычные события feedback bundle.

```html
<form data-loop-form="karta.intro.answer" data-loop-title="Intro answer">
  <label>
    Answer
    <textarea data-loop-field="answer" data-loop-label="Answer"></textarea>
  </label>
  <button type="button" data-loop-submit>Submit</button>
</form>
```

После submit в общий bundle попадает `form.submit` рядом с `comment.pin`, `markup.comment` и `tweak.request`.

Событие содержит:

```text
formId
formTitle
formPrompt
fields
fieldLabels
fieldValuesText
fieldsMeta
```

Это generic primitive. Он не привязан к обучению: подходит для уроков, архитектурных решений, ресерча, чеклистов и любых HTML-форм.

## DOM Inspector

В `0.4.7` Mark up может выбирать не только `data-loop-id`, но и обычные DOM-элементы. Если стабильного `data-loop-id` нет, target сохраняется как `dom-generated`.

`+ Comment` не создаёт anchor. Он сохраняет точку клика и несколько кратких `approximateTargets[]`, которые помечены как approximate / not anchored.

Видимые DOM-элементы имеют приоритет над `::before` / `::after`; для явного выбора pseudo-element можно удерживать Alt/Option.

## Collapsed inertia snap

Перетаскивание свернутого LoopKit учитывает короткую инерцию: если отпустить сразу после движения, snap считается от projected point. Если остановиться и подождать, инерция затухает и работает ближайшая точка.

Target-zone подсветка итоговой позиции перескакивает между snap-точками.

## Keyboard isolation
