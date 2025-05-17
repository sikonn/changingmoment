import { visit } from 'unist-util-visit';
import { toHtml } from 'hast-util-to-html';
import { h } from 'hastscript';

// Function to fetch data from the API
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
      const match = node.value.match(/\+\+(.*?)\/(.*?)(\|(.*?))?\+\+/);
      if (match) {
        const resourceType = match[1];
        const resourceId = match[2];
        const customComment = match[4]; // |后面的自定义内容（可能包含评分和emoji）

        const promise = fetchResource(resourceType, resourceId).then((data) => {
          if (data) {
            const MAX_LENGTH = 100;

            const briefText = customComment
              ? customComment
              : data.brief
                ? (data.brief.length > MAX_LENGTH ? data.brief.slice(0, MAX_LENGTH) + '...' : data.brief)
                : '';

            const cardElement = h('div.db-card', [
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
                    customComment
                      ? h('div.rating', [h('span', customComment)]) // 显示自定义评分+emoji
                      : h('div.rating', [h('span', '')]), // 否则留空
                    h('div.db-card-abstract', briefText),
                  ]),
                ]
              ),
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