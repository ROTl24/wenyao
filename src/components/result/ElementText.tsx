import type { Element } from '../../domain/liuyao';

const ELEMENT_CLASS: Readonly<Record<Element, string>> = {
  木: 'wood', 火: 'fire', 土: 'earth', 金: 'metal', 水: 'water',
};

export function ElementText({ value, element }: { value: string; element: Element }) {
  return (
    <span className={`element-text element-text--${ELEMENT_CLASS[element]}`} aria-label={`${value}，五行${element}`}>
      <span>{value}</span><small>{element}</small>
    </span>
  );
}
