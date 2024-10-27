import { z, defineCollection } from "astro:content";

const blog = defineCollection({
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional(),
      summary: z.string().optional(),
      date: z
        .date()
        .or(z.string().transform((str) => new Date(`${str}T12:00:00Z`))),
      isDraft: z.boolean().optional(),
      image: image().optional(),
      tags: z.array(z.string()).optional(),
    }),
});

export const collections = { blog };
