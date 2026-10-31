// Tiny DOM helper: h('div.card#main', { onclick }, 'text', child, [more])

export function h(tag, ...rest) {
  const [, name = 'div', extra = ''] = /^([a-z0-9-]*)(.*)$/i.exec(tag);
  const el = document.createElement(name || 'div');
  for (const m of extra.matchAll(/([.#])([^.#]+)/g)) {
    if (m[1] === '.') el.classList.add(m[2]); else el.id = m[2];
  }
  for (const r of rest) add(el, r);
  return el;
}

function add(el, r) {
  if (r === null || r === undefined || r === false) return;
  if (Array.isArray(r)) { r.forEach(x => add(el, x)); return; }
  if (r instanceof Node) { el.appendChild(r); return; }
  if (typeof r === 'object') {
    for (const [k, v] of Object.entries(r)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    return;
  }
  el.appendChild(document.createTextNode(String(r)));
}

/** Replaces the children of an element. */
export function mount(el, ...children) {
  el.replaceChildren();
  for (const c of children) add(el, c);
  return el;
}

let toastTimer = null;
/** Short message at the bottom of the screen. */
export function toast(msg, kind = 'info') {
  let el = document.getElementById('toast');
  if (!el) { el = h('div#toast', { role: 'status', 'aria-live': 'polite' }); document.body.appendChild(el); }
  el.textContent = msg;
  el.className = `show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 3500);
}
