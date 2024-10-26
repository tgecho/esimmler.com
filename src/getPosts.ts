type RawPost = {
  url: string;
  file: string;
  frontmatter: {
    title: string;
    date: string;
    slug?: string;
    description: string;
    summary: string;
    image?: string;
  };
  compiledContent(): string;
};
export type Post = {
  title: string;
  date: string;
  link: string;
  description?: string;
  summary?: string | undefined;
  content?: string | undefined;
  image?: string | undefined;
};

// .mdx posts do not have compiledContent (https://github.com/withastro/astro/issues/3072)
function compiledContent(post: RawPost): string | undefined {
  return post.file.endsWith(".mdx") ? undefined : post.compiledContent?.();
}

function postSummary(post: RawPost): string | undefined {
  if (post.frontmatter.summary) {
    return post.frontmatter.summary;
  }
  const content = compiledContent(post);
  const summaryMatch = content && /<!-- more -->/.exec(content);
  if (summaryMatch) {
    return content.slice(0, summaryMatch.index);
  }
  return undefined;
}

export function getRawPosts() {
  return Promise.all(
    Object.values(import.meta.glob("./posts/*.{md,mdx}")).map((item) => item()),
  );
}

export async function getPosts(): Promise<Post[]> {
  const posts = (await getRawPosts()) as RawPost[];

  posts.sort(
    (a, b) =>
      (new Date(b.frontmatter.date).valueOf() || Infinity) -
      (new Date(a.frontmatter.date).valueOf() || Infinity),
  );

  return posts
    .map((post) => {
      const link =
        post.frontmatter.slug || /\/([^\/]+)\.+\w+$/.exec(post.file)?.[1];
      if (!link) return;
      return {
        title: post.frontmatter.title,
        date: post.frontmatter.date,
        link,
        description: post.frontmatter.description,
        get summary() {
          return postSummary(post);
        },
        get content() {
          return compiledContent(post);
        },
        image: post.frontmatter.image,
      };
    })
    .filter(truthy);
}

function truthy<T>(t: T | undefined | null): t is T {
  return t !== undefined && t !== null;
}
