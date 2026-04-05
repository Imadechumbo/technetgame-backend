export const SOURCE_CATALOG = [
  {
    slug: 'steam-news',
    name: 'Steam News',
    kind: 'rss',
    url: 'https://store.steampowered.com/feeds/news.xml',
    siteUrl: 'https://store.steampowered.com/news/',
    category: 'valve',
    tags: ['steam', 'pc gaming', 'official'],
    language: 'en'
  },
  {
    slug: 'steam-blog',
    name: 'Steam News Collection',
    kind: 'rss',
    url: 'https://store.steampowered.com/feeds/news/collection/steam',
    siteUrl: 'https://store.steampowered.com/news/collection/steam/',
    category: 'valve',
    tags: ['steam', 'store', 'events'],
    language: 'en'
  },
  {
    slug: 'playstation-blog',
    name: 'PlayStation Blog',
    kind: 'rss',
    url: 'https://blog.playstation.com/feed/',
    siteUrl: 'https://blog.playstation.com/',
    category: 'sony',
    tags: ['sony', 'playstation', 'official'],
    language: 'en'
  },
  {
    slug: 'xbox-wire',
    name: 'Xbox Wire',
    kind: 'rss',
    url: 'https://news.xbox.com/en-us/feed/',
    siteUrl: 'https://news.xbox.com/en-us/',
    category: 'microsoft',
    tags: ['microsoft', 'xbox', 'official'],
    language: 'en'
  },
  {
    slug: 'xbox-wire-ptbr',
    name: 'Xbox Wire PT-BR',
    kind: 'rss',
    url: 'https://news.xbox.com/pt-br/feed/',
    siteUrl: 'https://news.xbox.com/pt-br/',
    category: 'microsoft',
    tags: ['microsoft', 'xbox', 'pt-br'],
    language: 'pt-br'
  },
  {
    slug: 'nintendo-news',
    name: 'Nintendo News',
    kind: 'rss',
    url: 'https://www.nintendo.co.jp/news/whatsnew.xml',
    siteUrl: 'https://www.nintendo.com/us/whatsnew/',
    category: 'nintendo',
    tags: ['nintendo', 'official'],
    language: 'ja'
  },
  {
    slug: 'nvidia-newsroom',
    name: 'NVIDIA Newsroom',
    kind: 'rss',
    url: 'https://nvidianews.nvidia.com/releases.xml',
    siteUrl: 'https://nvidianews.nvidia.com/',
    category: 'hardware',
    tags: ['nvidia', 'gpu', 'ai'],
    language: 'en'
  },
  {
    slug: 'amd-news',
    name: 'AMD News',
    kind: 'rss',
    url: 'https://www.amd.com/en/rss.xml',
    siteUrl: 'https://www.amd.com/en/newsroom.html',
    category: 'hardware',
    tags: ['amd', 'cpu', 'gpu'],
    language: 'en'
  },
  {
    slug: 'intel-newsroom',
    name: 'Intel Newsroom',
    kind: 'rss',
    url: 'https://www.intel.com/content/www/us/en/newsroom/rss-feed.html',
    siteUrl: 'https://www.intel.com/content/www/us/en/newsroom/home.html',
    category: 'hardware',
    tags: ['intel', 'chips', 'datacenter'],
    language: 'en'
  },
  {
    slug: 'google-blog',
    name: 'Google Blog',
    kind: 'rss',
    url: 'https://blog.google/rss/',
    siteUrl: 'https://blog.google/',
    category: 'technology',
    tags: ['google', 'android', 'ai'],
    language: 'en'
  },
  {
    slug: 'apple-newsroom',
    name: 'Apple Newsroom',
    kind: 'rss',
    url: 'https://www.apple.com/newsroom/rss-feed.rss',
    siteUrl: 'https://www.apple.com/newsroom/',
    category: 'technology',
    tags: ['apple', 'hardware', 'software'],
    language: 'en'
  },
  {
    slug: 'cisa-news',
    name: 'CISA News',
    kind: 'rss',
    url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml',
    siteUrl: 'https://www.cisa.gov/news-events/cybersecurity-advisories',
    category: 'security',
    tags: ['cisa', 'security', 'advisories'],
    language: 'en'
  },
  {
    slug: 'enisa-news',
    name: 'ENISA News',
    kind: 'rss',
    url: 'https://www.enisa.europa.eu/news/enisa-news/RSS',
    siteUrl: 'https://www.enisa.europa.eu/news',
    category: 'security',
    tags: ['enisa', 'security', 'eu'],
    language: 'en'
  }
];

export const CATEGORY_LABELS = {
  latest: 'Últimas',
  technology: 'Tecnologia',
  games: 'Games',
  valve: 'Valve / Steam',
  sony: 'Sony / PlayStation',
  microsoft: 'Microsoft / Xbox',
  nintendo: 'Nintendo',
  hardware: 'Hardware',
  security: 'Segurança',
  ai: 'IA & Dados'
};

export const HOMEPAGE_BUCKETS = [
  { slug: 'latest', title: 'Últimas notícias', mode: 'latest', limit: 36 },
  { slug: 'technology', title: 'Tecnologia', categories: ['technology', 'hardware'], limit: 24 },
  { slug: 'games', title: 'Games', categories: ['sony', 'microsoft', 'nintendo', 'valve'], limit: 24 },
  { slug: 'valve', title: 'Valve / Steam', categories: ['valve'], limit: 24 },
  { slug: 'security', title: 'Segurança', categories: ['security'], limit: 24 }
];
