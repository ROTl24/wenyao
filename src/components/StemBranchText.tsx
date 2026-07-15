import { elementOfStemBranch } from '../lib/divination';

interface Props {
  value: string;
}

export function StemBranchText({ value }: Props) {
  return <>{Array.from(value).map((symbol, index) => {
    const element = elementOfStemBranch(symbol);
    return element
      ? <span className="stem-branch-symbol" data-element={element} key={`${symbol}-${index}`}>{symbol}</span>
      : <span key={`${symbol}-${index}`}>{symbol}</span>;
  })}</>;
}
