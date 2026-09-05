/**
 * Makes a DOM element inline-editable (contenteditable) and calls
 * onCommit(newText) whenever the text changes and loses focus.
 */
export function makeEditable(el, onCommit) {
  el.classList.add('editable-text');
  el.contentEditable = 'true';
  el.spellcheck = false;

  el.addEventListener('blur', () => {
    onCommit(el.textContent.trim());
  });

  // Prevent Enter from inserting a newline in single-line fields
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !el.classList.contains('multiline')) {
      e.preventDefault();
      el.blur();
    }
  });
}

/**
 * Wraps a section with a hide/show eye-toggle button.
 * Toggling adds a class that blurs the content with a smooth transition.
 * Returns the wrapper element (insert this instead of the raw content).
 */
export function makeHideable(contentEl, label = 'Details') {
  const wrapper = document.createElement('div');
  wrapper.className = 'hideable-wrapper';

  const toggle = document.createElement('button');
  toggle.className = 'hide-toggle-btn';
  toggle.textContent = `🙈 Hide ${label}`;
  toggle.title = `Hide/show ${label}`;

  const content = document.createElement('div');
  content.className = 'hideable-content';
  content.appendChild(contentEl);

  toggle.addEventListener('click', () => {
    const isHidden = content.classList.toggle('is-blurred');
    toggle.textContent = isHidden ? `👁️ Show ${label}` : `🙈 Hide ${label}`;
  });

  wrapper.appendChild(toggle);
  wrapper.appendChild(content);
  return wrapper;
}