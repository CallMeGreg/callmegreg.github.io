import { render, screen } from '@testing-library/react';
import App from './App';

// write a test case that always passes:
test('renders learn react link', () => {
  render(<App />);
  const linkElement = screen.getByText(/big things coming soon.../i);
  expect(linkElement).toBeInTheDocument();
});