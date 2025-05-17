import { visit } from 'unist-util-visit';
import { toHtml } from 'hast-util-to-html';
import { h } from 'hastscript';

async function fetchResource(resourceType, resourceId) {
  const apiUrl = `https://neodb.social/api/${resourceType}/${resourceId}`;
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error('Failed to fetch resource');
    return await response.json();
  } catch (error) {
    console.error('Error fetching resource:', error);
    return null;
  }
}

export default function fetchAndInjectContent() {
  return async (tree) => {
    const promises = [];

    visit(tree, 'text', (node, index, parent) => {
      // 解析格式 ++resourceType/resourceId|rating|comment++
      // rating 和 comment 都可选，comment 可能有空格或中文
      const regex = /\+\+(\w+)\/([^|+]+)(\|([^|+]*))?(\|([^+]*))?\+\+/g;

      let lastIndex = 0;
      const newChildren = [];

      let match;
      while ((match = regex.exec(node.value)) !== null) {
        const [fullMatch, resourceType, resourceId] = match;
        // match[4] 是第一个可选参数 rating
        const ratingRaw = match[4] || '';
        // match[6] 是第二个可选参数 comment
        const commentRaw = match[6] || '';

        // 先放入匹配前的纯文本
        if (match.index > lastIndex) {
          newChildren.push({
            type: 'text',
            value: node.value.slice(lastIndex, match.index),
          });
        }

        const promiseIndex = newChildren.length;
        // 先放空占位，之后填充异步请求的内容
        newChildren.push({ type: 'text', value: '' });

        const promise = fetchResource(resourceType, resourceId).then((data) => {
          let html = '';
          if (data) {
            const MAX_LENGTH = 100;

            // briefText 如果没传 comment，就用 data.brief，否则用 commentRaw
            const briefText = commentRaw
              ? commentRaw
              : data.brief
              ? (data.brief.length > MAX_LENGTH ? data.brief.slice(0, MAX_LENGTH) + '...' : data.brief)
              : '';

            // 验证评分是否是有效数字
            const rating = ratingRaw.trim();
            const isRatingNumber =
              rating !== '' && !isNaN(Number(rating)) && Number(rating) > 0;

            const ratingText = isRatingNumber ? rating : '';

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
                      // 评分单独显示，如果有评分才显示，否则空
                      h(
                        'div.rating',
                        ratingText ? [` rate: ${ratingText} / 10`] : ['']
                      ),
                      h('div.db-card-abstract', briefText),
                    ]),
                  ]
                ),
              ]),
            ]);

            html = toHtml(cardElement);
          } else {
            html = '<p style="text-align: center;"><small>Failed to fetch resource data.</small></p>';
          }

          newChildren.splice(promiseIndex, 1, {
            type: 'html',
            value: html,
          });
        });

        promises.push(promise);
        lastIndex = match.index + fullMatch.length;
      }

      if (lastIndex < node.value.length) {
        newChildren.push({
          type: 'text',
          value: node.value.slice(lastIndex),
        });
      }

      if (newChildren.length > 0) {
        parent.children.splice(index, 1, ...newChildren);
      }
    });

    await Promise.all(promises);
  };
}