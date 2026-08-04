// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://agentmove.zalize.com',
  integrations: [
    starlight({
      title: 'AgentMove',
      description:
        'Move your AI agent between clients — config, MCP servers, skills, memory, persona. Any direction.',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/wookat/agentmove' },
      ],
      editLink: { baseUrl: 'https://github.com/wookat/agentmove/edit/main/website/' },
      sidebar: [
        {
          label: 'Getting started',
          items: [
            { label: 'Introduction', slug: 'docs/introduction' },
            { label: 'Quick start', slug: 'docs/quick-start' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Commands', slug: 'docs/commands' },
            { label: 'Supported clients', slug: 'docs/clients' },
            { label: 'The bundle format', slug: 'docs/bundle' },
            { label: 'Loss reporting & safety', slug: 'docs/safety' },
            { label: 'Limitations (honest edition)', slug: 'docs/limitations' },
          ],
        },
      ],
    }),
  ],
});
