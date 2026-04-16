import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SearchableSelect from '../components/SearchableSelect';

const options = [
  { id: '1', name: 'Alice Johnson', company: 'Northwind' },
  { id: '2', name: 'Bob Smith', company: 'Contoso' },
  { id: '3', name: 'Carla Gomez', company: 'Fabrikam' },
];

describe('SearchableSelect', () => {
  it('renders the placeholder and lets the user select an option', () => {
    const onChange = vi.fn();

    render(
      <SearchableSelect
        options={options}
        value=""
        onChange={onChange}
        placeholder="Pick a lead"
      />
    );

    fireEvent.click(screen.getByText(/pick a lead/i));
    fireEvent.click(screen.getByText(/alice johnson/i));

    expect(onChange).toHaveBeenCalledWith('1');
  });

  it('filters options from the search input', () => {
    render(
      <SearchableSelect
        options={options}
        value=""
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText(/select an option/i));
    fireEvent.change(screen.getByPlaceholderText(/search leads/i), { target: { value: 'carla' } });

    expect(screen.getByText(/carla gomez/i)).toBeDefined();
    expect(screen.queryByText(/alice johnson/i)).toBeNull();
  });

  it('shows the add-new action when provided', () => {
    const onAddNew = vi.fn();

    render(
      <SearchableSelect
        options={options}
        value=""
        onChange={vi.fn()}
        onAddNew={onAddNew}
      />
    );

    fireEvent.click(screen.getByText(/select an option/i));
    fireEvent.click(screen.getByText(/add new lead/i));

    expect(onAddNew).toHaveBeenCalledTimes(1);
  });
});
