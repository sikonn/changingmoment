import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional(),
      pubDate: z.date(),
      tags: z.array(z.string()).optional(),
      wordCount: z.number().optional(),
      readTime: z.number().optional(),
    }),
});

export const collections = {
  posts,
};