import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./components/Sidebar', () => () => null);
jest.mock('./pages/Dashboard', () => () => null);
jest.mock('./pages/LabsData', () => () => null);
jest.mock('./pages/StudentData', () => () => null);
jest.mock('./pages/Departments', () => () => null);
jest.mock('./pages/Courses', () => () => null);
jest.mock('./pages/VacantLabs', () => () => null);
jest.mock('./pages/AllottedLabs', () => () => null);
jest.mock('./pages/Booking', () => () => null);
jest.mock('lucide-react', () => ({ CalendarDays: () => null }), { virtual: true });

jest.mock('react-router-dom', () => {
  const React = jest.requireActual('react');
  return {
    BrowserRouter: ({ children }) => React.createElement(React.Fragment, null, children),
    Routes: () => null,
    Route: () => null,
    Navigate: () => null,
    NavLink: ({ to, children }) => React.createElement('a', { href: to }, children),
  };
}, { virtual: true });

test('renders the lab operations app shell', () => {
  render(<App />);
  expect(screen.getByText('ACADEMIC SERVICES')).toBeInTheDocument();
  expect(screen.getByText('Lab operations')).toBeInTheDocument();
});
