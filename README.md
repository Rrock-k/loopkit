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
<script src="https://cdn.jsdelivr.net/npm/@rrock-k/loopkit@0.4.7/dist/loopkit.js"></script>
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

## DOM Inspector

В `0.4.7` Mark up может выбирать не только `data-loop-id`, но и обычные DOM-элементы. Если стабильного `data-loop-id` нет, target сохраняется как `dom-generated`.

`+ Comment` не создаёт anchor. Он сохраняет точку клика и несколько кратких `approximateTargets[]`, которые помечены как approximate / not anchored.

Видимые DOM-элементы имеют приоритет над `::before` / `::after`; для явного выбора pseudo-element можно удерживать Alt/Option.

## Collapsed inertia snap

Перетаскивание свернутого LoopKit учитывает короткую инерцию: если отпустить сразу после движения, snap считается от projected point. Если остановиться и подождать, инерция затухает и работает ближайшая точка.

Target-zone подсветка итоговой позиции перескакивает между snap-точками.

## Keyboard isolation

Textarea внутри LoopKit изолирует keydown: пробел, backspace, delete и стрелки не уходят в основную презентацию.

## Структура

```text
src/loopkit.js              source runtime
scripts/build.mjs           generates dist/loopkit.js CDN entrypoint
scripts/validate.mjs        validates LoopKit artifacts
scripts/build-standalone.mjs
examples/basic.html
dist/loopkit.js             generated CDN/package entrypoint
package.json
LICENSE
```

`src/*` — source of truth. `dist/*` публикуется в npm package и используется CDN.

## Dist workflow

`Build dist` workflow запускается на push, если изменились:

```text
src/**
scripts/build.mjs
package.json
.github/workflows/build-dist.yml
```

Он выполняет `npm run build`. Если `dist/loopkit.js` изменился, workflow сам коммитит его обратно в ту же ветку:

```text
build: update dist [skip ci]
```

Чтобы не было бесконечного CI-loop, job не запускается от `github-actions[bot]`, а commit содержит `[skip ci]`.

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
