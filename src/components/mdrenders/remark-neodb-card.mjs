import { visit } from 'unist-util-visit';
import { toHtml } from 'hast-util-to-html';
import { h } from 'hastscript';

// 获取接口数据
async function fetchResource(resourceType, resourceId) {
  const apiUrl = `https://neodb.social/api/${resourceType}/${resourceId}`;
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch resource');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching resource:', error);
    return null;
  }
}

export default function fetchAndInjectContent() {
  return async (tree) => {
    const promises = [];

    visit(tree, 'text', (node) => {
      // 匹配格式：++资源类型/资源ID|评分|评论++
      // |评分 和 |评论 都是可选，且评分可以是 emoji 或数字等任意文本
      const match = node.value.match(/\+\+(.*?)\/(.*?)(\|(.*?))?(\|(.*?))?\+\+/);
      if (match) {
        const resourceType = match[1];
        const resourceId = match[2];
        const ratingRaw = match[4] || '';  // 评分（emoji等）
        const commentRaw = match[6] || ''; // 评论内容

        const promise = fetchResource(resourceType, resourceId).then((data) => {
          if (data) {
            const MAX_LENGTH = 100;

            // 如果评论输入了，用评论，否则用接口brief
            const briefText = commentRaw
              ? commentRaw
              : data.brief
              ? (data.brief.length > MAX_LENGTH ? data.brief.slice(0, MAX_LENGTH) + '...' : data.brief)
              : '';

            const ratingText = ratingRaw.trim();

            // 生成卡片html结构
            const cardElement = h('div.db-card-wrapper', [
              h('div.db-card', [
                h(
                  'a.db-card-subject',
                  {
                    href: `https://neodb.social/${resourceType}/${resourceId}`,
                    target: '_blank',
                    rel: 'noreferrer',
                    style: 'text-decoration: none; display: flex; align-items: flex-start;',
                  },
                  [
                    h('div.db-card-post', [
                      h('img', {
                        loading: 'lazy',
                        decoding: 'async',
                        referrerPolicy: 'no-referrer',
                        src: data.cover_image_url,
                      }),
                    ]),
                    h('div.db-card-content', [
                      h('div.db-card-title', data.title),
                      // 仅当评分非空时显示评分
                      ...(ratingText
                        ? [h('div.rating', [h('span', ratingText)])]
                        : []),
                      h('div.db-card-abstract', briefText),
                    ]),
                  ]
                ),
              ]),
            ]);

            node.type = 'html';
            node.value = toHtml(cardElement);
          } else {
            node.type = 'html';
            node.value =
              '<p style="text-align: center;"><small>Failed to fetch resource data.</small></p>';
          }
        });

        promises.push(promise);
      }
    });

    await Promise.all(promises);
  };
}