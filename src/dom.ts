// Fail loudly and namedly when required markup is missing, instead of letting a
// non-null assertion blow up cryptically deep inside an event handler.
export function requireElement<ElementType extends HTMLElement = HTMLElement>(
  id: string,
): ElementType {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Required DOM element #${id} not found`);
  return element as ElementType;
}
