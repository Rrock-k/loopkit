(function(){
  'use strict';

  const VERSION = '0.1.0-forms';
  const FORM = '[data-loop-form]';
  const FIELD = '[data-loop-field]';
  const SUBMIT = '[data-loop-submit]';

  if (window.LoopKitForms && window.LoopKitForms.__installed) return;

  const ready = (fn) => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  };

  ready(() => waitForLoopKit(bindForms));

  function waitForLoopKit(fn, tries = 80) {
    if (window.LoopKit && window.LoopKit.__installed) return fn();
    if (tries <= 0) return;
    setTimeout(() => waitForLoopKit(fn, tries - 1), 50);
  }

  function bindForms() {
    document.querySelectorAll(FORM).forEach(bindForm);
    document.addEventListener('submit', onNativeSubmit, true);

    window.LoopKitForms = {
      __installed: true,
      version: VERSION,
      bind: bindForms,
      collect: collectForm,
      submit: submitForm
    };

    if (window.LoopKit) {
      window.LoopKit.forms = window.LoopKitForms;
    }
  }

  function bindForm(form) {
    if (!form || form.dataset.loopFormBound === '1') return;
    form.dataset.loopFormBound = '1';
    form.querySelectorAll(SUBMIT).forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        submitForm(form, button);
      });
    });
  }

  function onNativeSubmit(event) {
    const form = event.target.closest?.(FORM);
    if (!form) return;
    event.preventDefault();
    submitForm(form, event.submitter || null);
  }

  function submitForm(form, submitter = null) {
    const data = collectForm(form);
    const event = {
      type: 'form.submit',
      message: data.formTitle || data.formId,
      formId: data.formId,
      formTitle: data.formTitle,
      formPrompt: data.formPrompt,
      fields: data.fields,
      fieldLabels: data.fieldLabels,
      fieldValuesText: data.fieldValuesText,
      fieldsMeta: data.fieldsMeta,
      source: {
        url: location.href,
        hash: location.hash || null
      }
    };

    window.LoopKit.saveEvent(event);
    form.dataset.loopSubmittedAt = new Date().toISOString();
    if (submitter) flashSubmitter(submitter);
    document.dispatchEvent(new CustomEvent('loopkit:form-submit', { detail: event }));
    return event;
  }

  function collectForm(form) {
    const formId = form.dataset.loopForm || form.id || `form.${hash(pathOf(form))}`;
    const formTitle = form.dataset.loopTitle
      || form.dataset.loopFormTitle
      || form.querySelector('[data-loop-form-title]')?.textContent?.trim()
      || form.querySelector('h1,h2,h3,legend')?.textContent?.trim()
      || formId;
    const formPrompt = form.dataset.loopPrompt
      || form.querySelector('[data-loop-prompt]')?.textContent?.trim()
      || '';

    const fields = {};
    const fieldLabels = {};
    const fieldValuesText = {};
    const fieldsMeta = {};
    const seen = new Set();

    form.querySelectorAll(FIELD).forEach((field) => {
      const name = field.dataset.loopField || field.name || field.id;
      if (!name || seen.has(name)) return;
      seen.add(name);

      const group = Array.from(form.querySelectorAll(`${FIELD}[data-loop-field="${escapeCss(name)}"],${FIELD}[name="${escapeCss(name)}"]`));
      const value = valueOf(field, group);
      const valueText = valueTextOf(field, group, value);
      const label = labelOf(field, name);

      fields[name] = value;
      fieldLabels[name] = label;
      fieldValuesText[name] = valueText;
      fieldsMeta[name] = metaOf(field, group, label);
    });

    return {
      formId,
      formTitle,
      formPrompt,
      fields,
      fieldLabels,
      fieldValuesText,
      fieldsMeta
    };
  }

  function valueOf(field, group) {
    const type = fieldType(field);
    if (type === 'checkbox') return group.filter((item) => item.checked).map((item) => item.value);
    if (type === 'radio') return group.find((item) => item.checked)?.value || '';
    if (field.tagName === 'SELECT' && field.multiple) return Array.from(field.selectedOptions).map((option) => option.value);
    return field.value ?? '';
  }

  function valueTextOf(field, group, value) {
    const type = fieldType(field);
    if (type === 'checkbox') {
      return group.filter((item) => item.checked).map((item) => optionLabel(item));
    }
    if (type === 'radio') return optionLabel(group.find((item) => item.checked)) || '';
    if (field.tagName === 'SELECT') {
      if (field.multiple) return Array.from(field.selectedOptions).map((option) => option.textContent.trim());
      return field.selectedOptions?.[0]?.textContent?.trim() || String(value ?? '');
    }
    return String(value ?? '');
  }

  function metaOf(field, group, label) {
    const type = fieldType(field);
    const meta = { name: field.dataset.loopField || field.name || field.id, label, type };
    if (type === 'checkbox' || type === 'radio') {
      meta.options = group.map((item) => ({ value: item.value, label: optionLabel(item) }));
    } else if (field.tagName === 'SELECT') {
      meta.options = Array.from(field.options).map((option) => ({ value: option.value, label: option.textContent.trim() }));
      meta.multiple = !!field.multiple;
    }
    return meta;
  }

  function fieldType(field) {
    if (!field) return 'text';
    if (field.tagName === 'TEXTAREA') return 'textarea';
    if (field.tagName === 'SELECT') return 'select';
    return (field.type || field.tagName || 'text').toLowerCase();
  }

  function labelOf(field, fallback) {
    return field.dataset.loopLabel
      || field.getAttribute('aria-label')
      || field.closest('label')?.querySelector('[data-loop-label]')?.textContent?.trim()
      || field.closest('[data-loop-field-wrap]')?.querySelector('[data-loop-label]')?.textContent?.trim()
      || field.closest('label')?.textContent?.replace(field.value || '', '')?.trim()
      || fallback;
  }

  function optionLabel(item) {
    if (!item) return '';
    return item.dataset.loopValueLabel
      || item.closest('label')?.querySelector('[data-loop-option-label]')?.textContent?.trim()
      || item.closest('label')?.textContent?.trim()
      || item.getAttribute('aria-label')
      || item.value;
  }

  function pathOf(el) {
    const parts = [];
    let n = el;
    while (n && n.nodeType === 1 && n !== document.documentElement) {
      let part = n.tagName.toLowerCase();
      if (n.id) { part += `#${n.id}`; parts.unshift(part); break; }
      const parent = n.parentElement;
      if (parent) {
        const same = Array.from(parent.children).filter((child) => child.tagName === n.tagName);
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(n) + 1})`;
      }
      parts.unshift(part);
      n = parent;
    }
    return parts.join(' > ');
  }

  function hash(value) {
    let h = 2166136261;
    const text = String(value || '');
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function escapeCss(value) {
    return window.CSS?.escape ? CSS.escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function flashSubmitter(button) {
    const previous = button.textContent;
    button.textContent = button.dataset.loopSubmitSavedText || 'Saved';
    button.disabled = true;
    setTimeout(() => {
      button.textContent = previous;
      button.disabled = false;
    }, 900);
  }
})();
