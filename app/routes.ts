import { index, layout, type RouteConfig, route } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  route('auth/github', 'routes/auth.github.tsx'),
  route('auth/github/callback', 'routes/auth.github.callback.tsx'),
  route('auth/sign-out', 'routes/auth.sign-out.tsx'),
  route('welcome', 'routes/welcome.tsx'),
  layout('routes/console-layout.tsx', [
    route('keys', 'routes/keys.tsx'),
    route('keys/hide-two-factor-notice', 'routes/keys.hide-two-factor-notice.tsx'),
    route('keys/:id', 'routes/key.tsx'),
    route('settings', 'routes/settings.tsx'),
    route('groups', 'routes/groups.tsx'),
    route('groups/new', 'routes/groups.new.tsx'),
    route('groups/:slug', 'routes/group.tsx'),
    route('map', 'routes/map.tsx'),
    route('guide', 'routes/guide.tsx'),
  ]),
  route('-/names/:name', 'routes/names.check.tsx'),
  // Only the person has a page. A group's address answers with its keys, to browsers as well.
  route(':name', 'routes/profile.tsx'),
] satisfies RouteConfig
