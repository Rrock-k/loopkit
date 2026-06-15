let slides = [];
const artifactId = 'karta-polaka-clean-course';
const artifactVersion = 'v11-slide-transition-body-fill';
const deck = document.getElementById('deck');
const slideNav = document.getElementById('slideNav');
const dots = document.getElementById('dots');
const progress = document.getElementById('progress');
const crumb = document.getElementById('crumb');
const app = document.getElementById('app');
const mobileNavQuery = window.matchMedia('(max-width: 760px)');
let current = 0;
let renderedSlideIndex = null;
let userChangedNav = false;

const storage = (() => {
  try {
    const key = '__kp_storage_test__';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return localStorage;
  } catch {
    const memory = new Map();
    return {
      getItem: (key) => memory.has(key) ? memory.get(key) : null,
      setItem: (key, value) => memory.set(key, String(value)),
      removeItem: (key) => memory.delete(key)
    };
  }
})();

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function toast(message) {
  const element = document.getElementById('toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => element.classList.remove('show'), 1500);
}

function isPolish(text) {
  const value = String(text || '').toLowerCase();
  return /[ąćęłńóśźż]/i.test(value) || /\b(nazywam|pochodzę|pochodze|skąd|skad|gdzie|pani|proszę|prosze|urodziłam|urodzilam|mieszkam|język|jezyk|polsk|gruzj|babcia|była|byla|polką|polka|chcę|chce|chciałabym|chcialabym|interesuje|trochę|troche|sobie|kilka|zdań|zdan)\b/.test(value);
}

function speakButton(text, cls = '') {
  return `<button class="speak ${esc(cls)}" type="button" data-speak-pl="${esc(text)}" aria-label="Озвучить польскую фразу">▶</button>`;
}

function inlineSpeakText(text, textClass = '', buttonClass = '') {
  const value = String(text || '');
  const classAttr = textClass ? ` class="${esc(textClass)}"` : '';
  if (!isPolish(value)) return `<span${classAttr}>${esc(value)}</span>`;
  const match = value.match(/^(.*\s)(\S+)$/u);
  const button = speakButton(value, buttonClass);
  if (!match) return `<span${classAttr}><span class="keep-inline">${esc(value)}${button}</span></span>`;
  return `<span${classAttr}>${esc(match[1])}<span class="keep-inline">${esc(match[2])}${button}</span></span>`;
}

function chip(kind) {
  if (kind === 'task') return '<span class="chip task">task</span>';
  if (kind === 'system') return '<span class="chip next">next</span>';
  return '';
}

function shell(slide, body, cls = '') {
  return `<article class="slide" data-loop-id="slide.${esc(slide.id)}" data-loop-title="${esc(slide.nav)}">
    <div class="slide-card ${cls}">
      <div class="kicker">${esc(slide.k || '')}</div>
      <div class="slide-body">${body}</div>
      <div class="slide-foot"><span class="slide-index"></span><span>←/→ · Space · swipe</span></div>
    </div>
  </article>`;
}

function renderForm(slide, area = false) {
  const fieldId = `${slide.formId}-answer`;
  const control = area
    ? `<textarea id="${esc(fieldId)}" class="textarea" data-loop-field="answer" data-loop-label="${esc(slide.label)}" placeholder="${esc(slide.placeholder)}" required></textarea>`
    : `<input id="${esc(fieldId)}" class="input" data-loop-field="answer" data-loop-label="${esc(slide.label)}" placeholder="${esc(slide.placeholder)}" required>`;
  return shell(slide, `<form class="form ${area ? 'form-area' : ''}" data-loop-form="${esc(slide.formId)}" data-loop-title="${esc(slide.formTitle)}" data-loop-prompt="${esc(slide.prompt)}">
    <h2>${esc(slide.title)}</h2>
    <div class="field-prompt"><label class="field-label" for="${esc(fieldId)}">${inlineSpeakText(slide.label, '', 'small')}</label></div>
    ${control}
    <div class="actions"><button class="btn primary" type="button" data-loop-submit>Продолжить →</button></div>
  </form>`, 'narrow');
}

function renderChoice(slide) {
  return shell(slide, `<form class="form" data-loop-form="${esc(slide.formId)}" data-loop-title="${esc(slide.formTitle)}" data-loop-prompt="${esc(slide.prompt)}">
    <h2>${esc(slide.title)}</h2>
    <div class="choices">
      ${slide.options.map((option, index) => `<div class="choice-row"><label class="choice" for="${esc(slide.formId)}-${index}">
        <input id="${esc(slide.formId)}-${index}" type="radio" name="${esc(slide.field)}" value="${esc(option[0])}" data-loop-field="${esc(slide.field)}" data-loop-label="${esc(slide.title)}" data-loop-value-label="${esc(option[1])}" required>
        <span class="choice-text">${inlineSpeakText(option[1], '', 'small')}</span>
      </label></div>`).join('')}
    </div>
    <div class="actions"><button class="btn primary" type="button" data-loop-submit>Продолжить →</button></div>
  </form>`, 'narrow');
}

function renderSlide(slide) {
  if (slide.type === 'title') return shell(slide, `<div class="stack"><h1>${esc(slide.title)}</h1><p>${esc(slide.text)}</p></div>`);
  if (slide.type === 'phrase') return shell(slide, `<div class="center"><div><div class="phrase-line">${inlineSpeakText(slide.title, 'big')}</div><div class="sub">${esc(slide.text)}</div></div></div>`, 'narrow');
  if (slide.type === 'cards') return shell(slide, `<div class="stack"><h2>${esc(slide.title)}</h2><div class="grid2">${slide.cards.map(card => `<div class="tile"><b>${esc(card[0])}</b><span>${inlineSpeakText(String(card[1]).replace(/\.\.\.$/, ''), '', 'small')}</span></div>`).join('')}</div></div>`, 'wide');
  if (slide.type === 'rule') return shell(slide, `<div class="stack"><h2>${inlineSpeakText(slide.title, '', 'small')} <span class="help" tabindex="0" data-tip="${esc(slide.tip || slide.text)}">?</span></h2><div class="rule"><b>Смысл</b><span>${esc(slide.text)}</span></div></div>`, 'narrow');
  if (slide.type === 'spoiler') return shell(slide, `<div class="stack"><h2>${esc(slide.title)}</h2><div class="rule"><b>Коротко</b><span>${esc(slide.text)}</span></div></div>`, 'narrow');
  if (slide.type === 'modal') return shell(slide, `<div class="stack"><h2>${esc(slide.title)}</h2><p>${esc(slide.text)}</p><button class="btn primary" data-open-modal type="button">Открыть текст</button></div>`, 'narrow');
  if (slide.type === 'export') return shell(slide, `<div class="stack"><h2>${esc(slide.title)}</h2><p>${esc(slide.text)}</p><div class="actions"><button class="btn primary" type="button" id="copyLoopKitBundle">Скопировать результат</button></div><div class="rule"><b>Что дальше?</b><span>Вставь результат в чат. Я проверю ответы и предложу следующий маленький шаг.</span></div></div>`, 'narrow');
  if (slide.type === 'formText') return renderForm(slide, false);
  if (slide.type === 'formTextArea') return renderForm(slide, true);
  if (slide.type === 'formChoice') return renderChoice(slide);
  return shell(slide, `<div class="stack"><h2>${esc(slide.title)}</h2></div>`);
}

function formKey(form) { return `${artifactId}:${artifactVersion}:draft:${form.dataset.loopForm}`; }
function collectFormValues(form) {
  const values = {};
  form.querySelectorAll('[data-loop-field]').forEach((field) => {
    const name = field.dataset.loopField;
    if (!name) return;
    if (field.type === 'radio') {
      if (field.checked) values[name] = field.value;
      else if (!(name in values)) values[name] = '';
    } else values[name] = field.value || '';
  });
  return values;
}
function formHasAnyValue(form) { return Object.values(collectFormValues(form)).some(value => String(value || '').trim()); }
function saveFormDraft(form) { storage.setItem(formKey(form), JSON.stringify(collectFormValues(form))); }
function restoreFormDraft(form) {
  const raw = storage.getItem(formKey(form));
  if (!raw) return;
  let values;
  try { values = JSON.parse(raw); } catch { return; }
  form.querySelectorAll('[data-loop-field]').forEach((field) => {
    const name = field.dataset.loopField;
    if (!name || !(name in values)) return;
    if (field.type === 'radio') field.checked = field.value === values[name];
    else field.value = values[name] || '';
  });
}
function activeForm() { return deck.querySelector('.slide.active [data-loop-form]'); }
function saveActiveFormBeforeLeaving() { const form = activeForm(); if (form) saveFormDraft(form); }

function updateSlideOverflow() {
  requestAnimationFrame(() => {
    const card = deck.querySelector('.slide.active .slide-card');
    if (!card) return;
    const body = card.querySelector('.slide-body');
    card.classList.remove('has-overflow');
    requestAnimationFrame(() => card.classList.toggle('has-overflow', body.scrollHeight > body.clientHeight + 3));
  });
}

function go(index, persist = true) {
  const next = Math.max(0, Math.min(slides.length - 1, index));
  const previous = renderedSlideIndex;
  const changed = previous !== null && previous !== next;
  const direction = previous === null || next >= previous ? 1 : -1;
  current = next;
  if (persist) storage.setItem(`${artifactId}:${artifactVersion}:slide`, String(current));

  const slideElements = [...deck.querySelectorAll('.slide')];
  slideElements.forEach((element, idx) => {
    element.classList.remove('enter-from-right', 'enter-from-left', 'exit-to-left', 'exit-to-right', 'exiting');
    if (idx === current) {
      element.classList.add('active');
      if (changed) {
        element.classList.add(direction > 0 ? 'enter-from-right' : 'enter-from-left');
        requestAnimationFrame(() => element.classList.remove('enter-from-right', 'enter-from-left'));
      }
      return;
    }
    if (changed && idx === previous) {
      element.classList.remove('active');
      element.classList.add('exiting', direction > 0 ? 'exit-to-left' : 'exit-to-right');
      setTimeout(() => element.classList.remove('exiting', 'exit-to-left', 'exit-to-right'), 320);
      return;
    }
    element.classList.remove('active');
  });

  slideNav.querySelectorAll('[data-jump]').forEach((element, idx) => element.classList.toggle('active', idx === current));
  dots.querySelectorAll('.dotstep').forEach((element, idx) => {
    element.classList.toggle('active', idx === current);
    element.classList.toggle('done', idx < current);
  });
  progress.style.width = `${Math.round(((current + 1) / slides.length) * 100)}%`;
  crumb.textContent = slides[current].nav;
  renderedSlideIndex = current;
  updateSlideOverflow();
}

function navigateTo(index) {
  if (index === current) return;
  saveActiveFormBeforeLeaving();
  go(index);
}

function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
  return Promise.resolve();
}

function fallbackBundle() {
  const items = [];
  deck.querySelectorAll('[data-loop-form]').forEach((form) => {
    const values = collectFormValues(form);
    if (!Object.values(values).some(value => String(value || '').trim())) return;
    items.push({type:'form.submit', formId:form.dataset.loopForm, title:form.dataset.loopTitle, prompt:form.dataset.loopPrompt, values});
  });
  return {artifactId, artifactVersion, exportedAt:new Date().toISOString(), items};
}

async function copyLoopKitBundle() {
  try {
    if (window.LoopKit?.copyBundle) await window.LoopKit.copyBundle();
    else await copyText(JSON.stringify(fallbackBundle(), null, 2));
    toast('Результат скопирован');
  } catch { toast('Не удалось скопировать'); }
}

function speakPolish(text, button) {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return toast('Озвучка недоступна');
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pl-PL';
  utterance.rate = 0.86;
  button?.setAttribute('aria-pressed', 'true');
  utterance.onend = utterance.onerror = () => button?.setAttribute('aria-pressed', 'false');
  speechSynthesis.speak(utterance);
}

function setupTooltips() {
  const tooltip = document.getElementById('helpTooltip');
  if (!tooltip) return;
  const hide = () => tooltip.classList.remove('show');
  const show = (trigger) => {
    tooltip.textContent = trigger.dataset.tip || '';
    tooltip.classList.add('show');
    const rect = trigger.getBoundingClientRect();
    tooltip.style.left = `${Math.min(Math.max(12, rect.left), window.innerWidth - 332)}px`;
    tooltip.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - 120)}px`;
  };
  deck.querySelectorAll('.help').forEach((trigger) => {
    trigger.addEventListener('mouseenter', () => show(trigger));
    trigger.addEventListener('mouseleave', hide);
    trigger.addEventListener('click', () => tooltip.classList.contains('show') ? hide() : show(trigger));
  });
}

function checkLoopKit() {
  const dot = document.getElementById('loopStatusDot');
  const text = document.getElementById('loopStatusText');
  const ok = !!(window.LoopKit?.copyBundle || window.LoopKitForms?.__installed);
  dot.className = `dot ${ok ? 'ok' : 'fail'}`;
  text.textContent = ok ? 'Сохранение: готово' : 'Сохранение: локально';
}

function syncResponsiveNav() {
  if (mobileNavQuery.matches) {
    if (!userChangedNav) app.classList.add('nav-collapsed');
  } else if (!userChangedNav) app.classList.remove('nav-collapsed');
}

async function boot() {
  const response = await fetch('./slides.json', {cache:'no-store'});
  if (!response.ok) throw new Error(`slides.json HTTP ${response.status}`);
  slides = await response.json();
  current = Number(storage.getItem(`${artifactId}:${artifactVersion}:slide`) || 0);
  if (!Number.isFinite(current)) current = 0;
  current = Math.max(0, Math.min(slides.length - 1, current));

  deck.innerHTML = slides.map(renderSlide).join('');
  deck.querySelectorAll('.slide-index').forEach((element, index) => element.textContent = `${String(index + 1).padStart(2,'0')} / ${String(slides.length).padStart(2,'0')}`);
  slideNav.innerHTML = slides.map((slide, index) => `<button type="button" data-jump="${index}"><span class="idx">${String(index + 1).padStart(2,'0')}</span><span>${esc(slide.nav)}</span>${chip(slide.kind)}</button>`).join('');
  dots.innerHTML = slides.map((_, index) => `<span class="dotstep" data-dot="${index}"></span>`).join('');
  deck.querySelectorAll('[data-loop-form]').forEach(restoreFormDraft);
  setupTooltips();
  syncResponsiveNav();
  go(current, false);
  setTimeout(checkLoopKit, 500);
  setTimeout(checkLoopKit, 1600);
}

slideNav.addEventListener('click', (event) => {
  const button = event.target.closest('[data-jump]');
  if (!button) return;
  navigateTo(Number(button.dataset.jump));
  if (mobileNavQuery.matches) app.classList.add('nav-collapsed');
});

document.getElementById('collapseSidebar').addEventListener('click', () => {
  userChangedNav = true;
  app.classList.toggle('nav-collapsed');
});

deck.addEventListener('input', (event) => {
  const form = event.target.closest?.('[data-loop-form]');
  if (form) saveFormDraft(form);
  updateSlideOverflow();
});
deck.addEventListener('change', (event) => {
  const form = event.target.closest?.('[data-loop-form]');
  if (form) saveFormDraft(form);
});

deck.addEventListener('click', (event) => {
  const speak = event.target.closest?.('[data-speak-pl]');
  if (speak) return speakPolish(speak.dataset.speakPl, speak);
  const openModal = event.target.closest?.('[data-open-modal]');
  if (openModal) return document.getElementById('modal').classList.add('show');
  const copy = event.target.closest?.('#copyLoopKitBundle');
  if (copy) return copyLoopKitBundle();
  const submit = event.target.closest?.('[data-loop-submit]');
  if (!submit) return;
  const form = submit.closest('[data-loop-form]');
  form.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
  if (!formHasAnyValue(form)) {
    const first = form.querySelector('[data-loop-field]');
    first?.classList?.add('invalid');
    toast('Сначала впиши ответ');
    first?.focus?.();
    return;
  }
  saveFormDraft(form);
  submit.disabled = true;
  const old = submit.textContent;
  submit.textContent = 'Сохранено';
  setTimeout(() => { submit.disabled = false; submit.textContent = old; navigateTo(current + 1); }, 220);
});

let touchStartX = 0, touchStartY = 0;
deck.addEventListener('touchstart', (event) => {
  const point = event.changedTouches[0];
  touchStartX = point.clientX;
  touchStartY = point.clientY;
}, {passive:true});
deck.addEventListener('touchend', (event) => {
  const point = event.changedTouches[0];
  const dx = point.clientX - touchStartX;
  const dy = point.clientY - touchStartY;
  if (Math.abs(dx) < 54 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
  navigateTo(dx < 0 ? current + 1 : current - 1);
}, {passive:true});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') return document.getElementById('modal').classList.remove('show');
  const target = event.target;
  const typing = target && (['INPUT','TEXTAREA','SELECT','BUTTON'].includes(target.tagName) || target.isContentEditable);
  if (typing) return;
  if (event.key === 'ArrowRight' || event.key === ' ') { event.preventDefault(); navigateTo(current + 1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); navigateTo(current - 1); }
});

document.getElementById('modal').addEventListener('click', (event) => {
  if (event.target.id === 'modal') event.currentTarget.classList.remove('show');
});
document.getElementById('closeModal').addEventListener('click', () => document.getElementById('modal').classList.remove('show'));
window.addEventListener('resize', () => { syncResponsiveNav(); updateSlideOverflow(); });
mobileNavQuery.addEventListener?.('change', () => { userChangedNav = false; syncResponsiveNav(); });
window.addEventListener('load', () => setTimeout(checkLoopKit, 500));

boot().catch((error) => {
  deck.innerHTML = `<article class="slide active"><div class="slide-card"><div class="kicker">ошибка</div><div class="slide-body"><div class="stack"><h2>Не удалось запустить курс</h2><p>${esc(error?.message || error)}</p></div></div><div class="slide-foot"><span>boot error</span></div></div></article>`;
});
