const MIN = 60000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function hhmm(d) {
  return d.toTimeString().slice(0, 5);
}

export function clockTime(iso) {
  const d = iso instanceof Date ? iso : new Date(iso);
  return isNaN(d) ? '' : d.toTimeString().slice(0, 8);
}

// "just now" / "3 minutes ago" / "yesterday 18:22" / "12 Mar 09:41"
export function relativeTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const now = new Date();
  const delta = now - d;
  if (delta < 45000) return 'just now';
  if (delta < HOUR) {
    const mins = Math.round(delta / MIN);
    return mins + (mins === 1 ? ' minute ago' : ' minutes ago');
  }
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d >= startOfToday) {
    const hrs = Math.round(delta / HOUR);
    return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
  }
  const startOfYesterday = new Date(startOfToday.getTime() - DAY);
  if (d >= startOfYesterday) return 'yesterday ' + hhmm(d);
  if (delta < 7 * DAY) {
    return d.toLocaleDateString(undefined, { weekday: 'long' }) + ' ' + hhmm(d);
  }
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' ' + hhmm(d);
}

export function fullTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleString();
}
