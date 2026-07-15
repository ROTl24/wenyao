import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StemBranchText } from './StemBranchText';

describe('StemBranchText', () => {
  it('colors every structured stem and branch with its own element', () => {
    render(<StemBranchText value="乙未、辛酉" />);

    expect(screen.getByText('乙')).toHaveAttribute('data-element', '木');
    expect(screen.getByText('未')).toHaveAttribute('data-element', '土');
    expect(screen.getByText('辛')).toHaveAttribute('data-element', '金');
    expect(screen.getByText('酉')).toHaveAttribute('data-element', '金');
    expect(screen.getByText('、')).not.toHaveAttribute('data-element');
  });
});
