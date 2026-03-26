import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  window.localStorage.clear();
});

test('renders secure login gate for unauthenticated user', () => {
  render(<App />);
  expect(screen.getByText(/AEVUM Command/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
});
