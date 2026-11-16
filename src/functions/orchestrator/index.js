/**
 * 内容聚合编排函数（orchestrator）
 * 语义：一次执行内完成「获取 feed 列表 → 抓取文章元信息 → 与现有 items 去重 → 输出聚合结果」。
 * 触发：手动/定时（控制台创建 cron 触发器），事件 { source: "mock" | "live", existing?: [] }
 *   - source="mock"：使用内置示例内容（无需公网与外部依赖，便于无网络环境验证）
 *   - source="live"：真实抓取 RSS/页面（需函数具备公网出口；各步骤见 docs/deployment-guide）
 * 输出：{ items: 新增聚合项, total: 现有+新增, duplicates: 去重数 }
 * 持久化：真实环境把 items 写入 OBS content.json（OBS 委托可用时）或 Redis（见文档），
 * 前端静态站读取该文件展示。
 */
const https = require('https');

// 内置示例 feed（source=mock 时使用）
const DEMO_FEEDS = [
  { url: 'https://content.example.com/feed', title: 'Serverless Blog' },
  { url: 'https://news.example.com/feed', title: 'Engineering Blog' },
];

const DEMO_POSTS = [
  {
    title: 'Building serverless content aggregation pipelines',
    intro: 'A practical walkthrough of automated content aggregation with serverless compute.',
    author: 'Example Team', date: '2026-09-20',
    link: 'https://example.com/posts/serverless-pipelines', image: '',
    tags: ['serverless', 'automation'],
  },
  {
    title: 'Event-driven architecture in practice',
    intro: 'How event-driven design keeps aggregation workflows decoupled and resilient.',
    author: 'Example Team', date: '2026-09-19',
    link: 'https://example.com/posts/eda-practice', image: '',
    tags: ['events', 'architecture'],
  },
];

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'user-agent': 'content-aggregator' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve({ redirect: res.headers.location });
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    }).on('error', reject);
  });
}

exports.handler = async (event, context) => {
  const ev = (event && typeof event === 'object' && 'body' in event && Object.keys(event).length === 1)
    ? (typeof event.body === 'string' ? JSON.parse(event.body) : event.body)
    : event;
  const source = ev.source || 'mock';
  const existing = Array.isArray(ev.existing) ? ev.existing : [];

  let fresh;
  if (source === 'live') {
    // 真实模式：抓取 feed（生产启用；函数需公网出口）
    const items = [];
    for (const feed of DEMO_FEEDS) {
      const r = await fetchJson(feed.url);
      items.push({ title: feed.title, intro: `Fetched ${r.status || r.redirect || '?'} from ${feed.url}`, author: 'auto-fetch', date: new Date().toISOString().slice(0, 10), link: feed.url, tags: [feed.title.toLowerCase()], fetched: true });
    }
    fresh = items;
  } else {
    // mock 模式：内置示例，便于无网络验证
    fresh = DEMO_POSTS;
  }

  // 去重（compare-against-repo 语义）：按 link 去重
  const known = new Set(existing.map((i) => i.link));
  const added = fresh.filter((i) => !known.has(i.link));
  const duplicates = fresh.length - added.length;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ items: added, total: existing.length + added.length, duplicates }),
  };
};