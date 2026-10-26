// Public profile and pinned repositories: https://github.com/CallMeGreg
// Public content snapshot; no authenticated API calls in the browser.
export const profile = {
  name: 'Greg Mohler',
  handle: 'CallMeGreg',
  role: 'Sr Solution Architect',
  company: 'GitHub',
  url: 'https://github.com/CallMeGreg',
  avatar: '/images/greg-mohler.png',
  blog: 'https://github.blog/author/callmegreg/',
};

export const repositories = [
  {
    name: 'agentic-alert-triage',
    description: 'Security alerts. Meet your AI teammate.',
    detail: 'Agentic triage for security alert dismissal requests.',
    url: 'https://github.com/CallMeGreg/agentic-alert-triage',
    language: 'JavaScript',
    category: 'Security + AI',
    icon: 'shield',
  },
  {
    name: 'gh-language',
    description: 'Understand the languages your enterprise uses.',
    detail: 'Language insights across GitHub enterprises and organizations.',
    url: 'https://github.com/CallMeGreg/gh-language',
    language: 'Go',
    category: 'Developer tooling',
    icon: 'terminal',
  },
];

// Contribution links listed in https://github.com/CallMeGreg/CallMeGreg
export const architecture = [
  { title: 'NIST SSDF implementation', area: 'Secure development', path: 'scenarios/nist-ssdf-implementation' },
  { title: 'Prioritizing security alerts', area: 'Application security', path: 'application-security/recommendations/prioritizing-alerts' },
  { title: 'Securing GitHub Actions', area: 'Application security', path: 'application-security/recommendations/actions-security' },
  { title: 'Enforcing GHAS at scale', area: 'Application security', path: 'application-security/recommendations/enforce-ghas-at-scale' },
  { title: 'Adopting Copilot at scale', area: 'Developer productivity', path: 'productivity/recommendations/adopting-copilot-at-scale' },
].map((article) => ({ ...article, url: `https://learn.github.com/well-architected/${article.path}` }));

// Authorship verified on https://github.blog/author/callmegreg/
export const articles = [
  {
    title: 'Staying evergreen',
    description: 'Automating secure access and repo hygiene.',
    fullTitle: 'Staying evergreen: How we automated secure access and repo hygiene in a shared org',
    category: 'Platform security',
    url: 'https://github.blog/engineering/platform-security/staying-evergreen-how-we-automated-secure-access-and-repo-hygiene-in-a-shared-org/',
    icon: 'branches',
  },
  {
    title: 'Not just for developers',
    description: 'Copilot for product and security teams.',
    fullTitle: 'Not just for developers: How product and security teams can use GitHub Copilot',
    category: 'GitHub Copilot',
    url: 'https://github.blog/ai-and-ml/github-copilot/not-just-for-developers-how-product-and-security-teams-can-use-github-copilot/',
    icon: 'spark',
  },
];

export const applets = [
  { name: 'My Hour', description: 'Your playlist. One minute at a time.', category: 'Music', path: '/my-hour', image: '/images/my-hour.png', color: '#a4edba' },
  { name: 'DropKit', description: 'Build your next DJ set.', category: 'Music', path: '/dropkit', image: '/images/dropkit.png', color: '#c7a6ff' },
  { name: 'Wubdle', description: 'A daily dose of music discovery.', category: 'Game', path: '/wubdle', image: '/images/wubdle.svg', color: '#a3d9ec' },
  { name: 'Jeopardy!', description: 'Your friends. Your game show.', category: 'Game', path: '/jeopardy', image: '/images/jeopardy.svg', color: '#c1b1fa' },
  { name: 'Team Generator', description: 'Less picking. More playing.', category: 'Tool', path: '/team-generator', image: '/images/vs_picture.jpeg', color: '#f6b497' },
  { name: 'Unmatched Matchup', description: 'Set the stage for your next duel.', category: 'Tool', path: '/unmatched-matchup', image: '/images/unmatched-cover.png', color: '#e0bd88' },
  { name: 'Coin Chaser', description: 'A little platforming adventure.', category: 'Game', path: '/godot-game', image: '/images/coin-chase.png', color: '#abd38e' },
  { name: 'The House Always Wins', description: 'Step inside. Try your luck.', category: 'Game', path: '/house-always-wins', image: '/images/house-always-wins.png', color: '#ed6840' },
];

// App Store listings and icons verified through Apple's public lookup API.
export const mobileApps = [
  { name: 'Trading Up', description: 'Rip packs. Build your collection.', url: 'https://apps.apple.com/us/app/trading-up-tcg/id6792863289', icon: '/images/trading-up.jpg' },
  { name: 'XP Waste', description: 'Train skills. Chase level 99.', url: 'https://apps.apple.com/us/app/xp-waste/id6798515534', icon: '/images/xp-waste.jpg' },
];
