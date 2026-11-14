const LINK_FIELDS = new Set(['source', 'factSource', 'link', 'page', 'url']);

/** Collect unique, safe source links from the data files loaded by the game. */
export function collectSourceLinks(gameData) {
  const links = new Map();
  const visit = (value, field = '') => {
    if (typeof value === 'string') {
      if (!LINK_FIELDS.has(field) || !/^https?:\/\//i.test(value)) return;
      try {
        const url = new URL(value);
        if (url.username || url.password) return;
        for (const name of [...url.searchParams.keys()]) {
          if (/^(?:api[_-]?)?key$|^(?:access[_-]?)?token$/i.test(name)) url.searchParams.delete(name);
        }
        url.hash = '';
        const safeUrl = url.toString();
        links.set(safeUrl, safeUrl);
      } catch {
        // Malformed external links do not belong in the credits screen.
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item, field);
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) visit(child, key);
    }
  };
  visit(gameData);
  return [...links.values()].sort((a, b) => a.localeCompare(b));
}

/** A short, readable label which keeps the full URL available as the clickable target. */
export function sourceLabel(value) {
  try {
    const url = new URL(value);
    const path = url.pathname === '/' ? '' : url.pathname;
    return `${url.hostname}${path}`;
  } catch {
    return value;
  }
}
