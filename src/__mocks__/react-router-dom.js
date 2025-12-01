const React = require('react');

module.exports = {
  BrowserRouter: ({ children }) => React.createElement('div', null, children),
  MemoryRouter: ({ children }) => React.createElement('div', null, children),
  Routes: ({ children }) => React.createElement('div', null, children),
  Route: ({ element }) => element,
  Link: ({ to, children, ...props }) => React.createElement('a', { href: to, ...props }, children),
  NavLink: ({ to, children, ...props }) => React.createElement('a', { href: to, ...props }, children),
  Navigate: ({ to }) => React.createElement('div', null, `Navigate to ${to}`),
  useNavigate: () => jest.fn(),
  useParams: () => ({}),
  useLocation: () => ({ pathname: '/', search: '', hash: '' }),
  useSearchParams: () => [new URLSearchParams(), jest.fn()],
  useMatch: () => null,
};
