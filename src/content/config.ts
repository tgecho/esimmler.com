import { z, defineCollection } from 'astro:content';

const blog = defineCollection({
    schema: z.object({
        title: z.string(),
        description: z.string().optional(),
        summary: z.string().optional(),
        date: z.string().transform(str => new Date(`${str}T12:00:00Z`)),
        isDraft: z.boolean().optional(),
    }),
});

export const collections = { blog }
