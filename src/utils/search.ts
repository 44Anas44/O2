/** Texte comparable : sans accents, sans majuscules, espaces nettoyés. */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * Recherche tolérante (accents et majuscules ignorés). Chaque mot saisi doit se
 * retrouver dans le nom ou la catégorie : « para 500 » trouve « Paracétamol 500 mg ».
 * Les noms qui COMMENCENT par la saisie sont classés en premier.
 */
export function filterBySearch<T>(
items: T[],
query: string,
name: (item: T) => string,
extra: (item: T) => string = () => '')
: T[] {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  const byName = (a: T, b: T) => name(a).localeCompare(name(b), 'fr');
  if (tokens.length === 0) return [...items].sort(byName);

  const scored: {item: T;score: number;}[] = [];
  for (const item of items) {
    const title = normalize(name(item));
    const haystack = `${title} ${normalize(extra(item))}`;
    if (!tokens.every((token) => haystack.includes(token))) continue;
    const score = title.startsWith(tokens[0]) ? 0 : title.split(/[\s\-/]+/).some((word) => word.startsWith(tokens[0])) ? 1 : 2;
    scored.push({ item, score });
  }
  return scored.sort((a, b) => a.score - b.score || byName(a.item, b.item)).map((entry) => entry.item);
}
