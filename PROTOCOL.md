# LoopKit Protocol v0

## 1. Назначение

LoopKit помогает передавать фидбэк по HTML-артефакту в AI не через расплывчатое описание, а через точные привязки к элементам.

```text
клик по элементу → комментарий → feedback bundle → AI-итерация
```

## 2. Минимальный совместимый артефакт

Артефакт должен содержать:

```text
metadata
DECISIONS
data-loop-id на важных элементах
LoopKit runtime
экспорт feedback bundle
```

## 3. Metadata

Формат:

```html
<script type="application/loopkit+json">
{
  "artifact_id": "example",
  "artifact_version": "v1",
  "title": "Example Artifact"
}
</script>
```

Обязательные поля:

```text
artifact_id
artifact_version
```

## 4. Anchors

Важные элементы получают смысловой якорь:

```html
<section data-loop-id="lesson.backpressure" data-loop-kind="section" data-loop-title="Backpressure">
```

Правила:

```text
ID должен быть уникален внутри версии.
ID должен описывать смысл элемента.
ID не обязан жить вечно между версиями.
Если элемент остался тем же, ID желательно сохранить.
```

## 5. Runtime modes

В v0 достаточно двух режимов:

```text
Mark up
Кликнуть конкретный элемент и оставить фидбэк к нему.

Comments
Оставить свободный комментарий на экране/области.
```

`Tweaks` и `Edit` не являются частью ядра v0.

## 6. Feedback bundle

Bundle — переносимый пакет фидбэка, который можно вставить в любой AI-чат.

Минимальная структура:

```json
{
  "protocol": "loopkit-feedback-bundle/v0",
  "artifact": {
    "id": "example",
    "version": "v1",
    "title": "Example Artifact"
  },
  "decisions": ["single self-contained HTML"],
  "items": [
    {
      "id": "fb_1",
      "type": "markup.comment",
      "target_id": "hero.title",
      "target_text": "Welcome",
      "message": "Сделай заголовок конкретнее"
    }
  ]
}
```

## 7. Single-use feedback rule

Feedback bundle валиден только для версии, из которой он экспортирован.

```text
bundle v1 применяется только к artifact v1
```

После создания следующей версии bundle считается использованным и не переносится дальше.

## 8. DECISIONS

`DECISIONS` — единственная долговременная память артефакта.

Туда пишутся только устойчивые решения:

```text
- один HTML-файл
- без звука
- стиль минималистичный
- аудитория: начинающие
```

Туда не пишутся обычные комментарии и мелкие правки.

## 9. Agent iteration rules

Агент обязан:

```text
1. Проверить версию bundle.
2. Прочитать DECISIONS.
3. Обработать каждый feedback item.
4. Явно сообщить результат по каждому пункту.
5. Спросить пользователя при конфликте.
6. Выпустить новую версию artifact_version.
7. Не переносить старый bundle дальше.
```

## 10. Validation checklist

Совместимый артефакт должен проходить проверки:

```text
есть loopkit metadata
есть artifact_id
есть artifact_version
есть хотя бы один data-loop-id
все data-loop-id уникальны
есть loopkit runtime или inline LoopKit
```
