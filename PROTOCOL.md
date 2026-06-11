# LoopKit Protocol v0

LoopKit Protocol описывает, как создавать HTML-артефакты, которые умеют собирать фидбэк прямо внутри интерфейса и передавать его AI для следующей итерации.

## 1. Главный цикл

```text
HTML v1
→ пользователь оставляет фидбэк внутри HTML
→ экспортирует feedback bundle
→ AI делает HTML v2
→ bundle v1 считается использованным
```

## 2. Артефакт

Минимальный LoopKit-артефакт содержит:

- metadata;
- `DECISIONS`;
- `data-loop-id` на важных элементах;
- подключённый `loopkit.js` или встроенный runtime;
- возможность экспортировать feedback bundle.

## 3. Metadata

```html
<script type="application/loopkit+json" id="loopkit-meta">
{
  "artifactId": "my-artifact",
  "artifactVersion": "v1",
  "title": "My artifact"
}
</script>
```

Допускаются snake_case алиасы: `artifact_id`, `artifact_version`.

## 4. DECISIONS

`DECISIONS` — короткий список постоянных решений, которые переживают версии.

```html
<script type="text/plain" id="loopkit-decisions">
DECISIONS:
- Фидбэк одноразовый.
- Не добавлять звук.
- UI минималистичный.
</script>
```

Это не changelog и не история комментариев.

## 5. Anchors

Важные элементы получают смысловые якоря:

```html
<section data-loop-id="hero" data-loop-kind="section" data-loop-title="Hero section"></section>
<button data-loop-id="hero.cta" data-loop-kind="button" data-loop-title="Hero CTA"></button>
```

`data-loop-id` должен быть уникальным внутри текущей версии артефакта.

## 6. Runtime modes

- `Mark up` — выбрать элемент и оставить комментарий к нему;
- `Comments` — оставить свободный pin-комментарий;
- `Tweaks` — попросить добавить tweak-контролы в следующей версии;
- `Copy bundle` — экспортировать feedback bundle.

## 7. Feedback bundle

Feedback bundle — переносимый пакет фидбэка для AI.

Он валиден только для той версии, из которой был экспортирован.

Минимальная форма item:

```json
{
  "type": "markup.comment",
  "target": {
    "id": "hero.cta",
    "title": "Hero CTA"
  },
  "message": "Кнопка слишком незаметная"
}
```

## 8. Single-use rule

Фидбэк живёт одну итерацию.

После выпуска новой версии старый bundle считается использованным и не переносится дальше.

Если проблема осталась, пользователь оставит новый фидбэк уже на новой версии.

## 9. Agent obligations

Агент обязан:

1. проверить версию bundle;
2. прочитать `DECISIONS`;
3. ответить на каждый feedback item;
4. не решать конфликты молча;
5. создать новую версию;
6. не переносить старый bundle автоматически.

## 10. Linked и standalone

Это не два режима продукта, а два способа доставки одного runtime.

```text
Linked:     artifact.html + loopkit.js
Standalone: artifact.standalone.html, где loopkit.js встроен inline
```

Для разработки удобнее linked. Для передачи файла кому угодно удобнее standalone.
