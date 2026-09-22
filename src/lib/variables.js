// {{name}} and {{name|default value}}
// The name may not contain { } or |; the default may not contain { }.
export const VAR_RE = /\{\{\s*([^{}|]+?)\s*(?:\|([^{}]*?))?\s*\}\}/g;

export function parseVariables(text) {
  const seen = new Map();
  const re = new RegExp(VAR_RE.source, 'g');
  let m;
  while ((m = re.exec(String(text || '')))) {
    const name = m[1].trim();
    if (!name) continue;
    if (!seen.has(name)) seen.set(name, { name, def: m[2] == null ? '' : m[2] });
    else if (!seen.get(name).def && m[2]) seen.get(name).def = m[2];
  }
  return [...seen.values()];
}

export function fillVariables(text, values) {
  const re = new RegExp(VAR_RE.source, 'g');
  return String(text || '').replace(re, (whole, rawName, def) => {
    const name = String(rawName).trim();
    const v = values && Object.prototype.hasOwnProperty.call(values, name) ? values[name] : undefined;
    if (v !== undefined && v !== '') return v;
    return def == null ? '' : def;
  });
}
