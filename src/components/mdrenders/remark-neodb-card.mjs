import { visit } from 'unist-util-visit';
import { toHtml } from 'hast-util-to-html';
import { h } from 'hastscript';

const isDev = process.env.NODE_ENV !== 'production';

/** 带超时的 fetch，默认 8s；失败不抛错，返回 null */
async function fetchWithTimeout(input, { timeout = 8000, headers } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(input, { signal: controller.signal, headers });
    if (!res || !res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 获取资源（开发环境直接降级为 null；生产超时/错误返回 null） */
async function fetchResource(resourceType, resourceId) {
  if (isDev) return null; // dev 环境不联网，直接降级
  const apiUrl = `https://neodb.social/api/${resourceType}/${resourceId}`;
  return await fetchWithTimeout(apiUrl, { timeout: 8000 });
}

/** 渲染失败时的降级占位（普通链接） */
function renderFallback(resourceType, resourceId, text = '查看详情') {
  const url = `https://neodb.social/${resourceType}/${resourceId}`;
  const el = h('p', { style: 'text-align:center;' }, [
    h('small', [h('a', { href: url, target: '_blank', rel: 'noreferrer' }, text)])
  ]);
  return toHtml(el);
}

/** 渲染成功卡片 */
function renderCard(resourceType, resourceId, data, ratingText, commentRaw) {
  const MAX_LENGTH = 100;
  const briefText = (commentRaw?.trim())
    ? commentRaw.trim()
    : (data?.brief ? (data.brief.length > MAX_LENGTH ? data.brief.slice(0, MAX_LENGTH) + '...' : data.brief) : '');

  const cover = data?.cover_image_url || ''; // 可能为空
  const title = data?.title || `${resourceType}/${resourceId}`;
  const url = `https://neodb.social/${resourceType}/${resourceId}`;

  const cardElement = h('div.db-card-wrapper', [
    h('div.db-card', [
      h(
        'a.db-card-subject',
        {
          href: url,
          target: '_blank',
          rel: 'noreferrer',
          style: 'text-decoration:none;display:flex;align-items:flex-start;gap:.75rem;',
        },
        [
          h('div.db-card-post', [
            // 仅当有封面时渲染 img，避免空 src 报错
            ...(cover ? [h('img', {
              loading: 'lazy',
              decoding: 'async',
              referrerPolicy: 'no-referrer',
              src: cover,
              alt: title,
              style: 'width:80px;height:auto;object-fit:cover;border-radius:8px;'
            })] : [])
          ]),
          h('div.db-card-content', [
            h('div.db-card-title', title),
            ...(ratingText ? [h('div.rating', [h('span', ratingText.trim())])] : []),
            ...(briefText ? [h('div.db-card-abstract', briefText)] : []),
          ]),
        ]
      ),
    ]),
  ]);

  return toHtml(cardElement);
}

/**
 * 支持一段文本中出现多个模式：
 * 语法: ++资源类型/资源ID|评分|评论++
 * |评分 与 |评论 可选；评分可以是 emoji 或任意文本
 */
export default function neodbRemark() {
  return async (tree) => {
    const tasks = [];

    visit(tree, 'text', (node, index, parent) => {
      const src = node.value;
      // 全局匹配多个
      const re = /\+\+([^+\/\s]+)\/([^|+]+?)(?:\|([^|+]*))?(?:\|([^+]*))?\+\+/g;

      let lastIndex = 0;
      let match;
      const replacements = [];

      while ((match = re.exec(src)) !== null) {
        const [full, resourceType, resourceId, ratingRaw = '', commentRaw = ''] = match;
        const start = match.index;
        const end = start + full.length;

        // 累积：前置纯文本
        if (start > lastIndex) {
          replacements.push({ type: 'text', value: src.slice(lastIndex, start) });
        }

        // 占位一个 html 节点，后续异步填充
        const placeholder = { type: 'html', value: renderFallback(resourceType, resourceId) };
        replacements.push(placeholder);

        // 异步任务：获取数据后替换占位
        const task = (async () => {
          const data = await fetchResource(resourceType.trim(), resourceId.trim());
          placeholder.value = data
            ? renderCard(resourceType, resourceId, data, ratingRaw || '', commentRaw || '')
            : renderFallback(resourceType, resourceId, '打开 NeoDB');
        })();
        tasks.push(task);

        lastIndex = end;
      }

      if (replacements.length) {
        // 末尾遗留纯文本
        if (lastIndex < src.length) {
          replacements.push({ type: 'text', value: src.slice(lastIndex) });
        }
        // 用多个节点替换原来的 text 节点
        parent.children.splice(index, 1, ...replacements);
        // 调整 visitor 的游标（避免跳过节点）
        return index + replacements.length;
      }
    });

    // 更“韧性”的等待：任意失败也不抛错
    const settled = await Promise.allSettled(tasks);
    // 可选：统计一下失败但不刷屏
    // const fails = settled.filter(s => s.status === 'rejected').length;
  };
}