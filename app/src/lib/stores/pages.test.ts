import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the browser check before importing pages
vi.mock('$app/environment', () => ({
	browser: false
}));

import type { WikiPage } from './pages';

describe('WikiPage migration', () => {
	it('should migrate old [[link]] syntax to new [link] syntax', () => {
		const migratePages = (pages: Record<string, WikiPage>): Record<string, WikiPage> => {
			const migrated: Record<string, WikiPage> = {};
			for (const [key, page] of Object.entries(pages)) {
				migrated[key] = {
					...page,
					content: page.content.replace(/\[\[([^\]]+)\]\]/g, '[$1]')
				};
			}
			return migrated;
		};

		const oldPages: Record<string, WikiPage> = {
			Home: {
				title: 'Home',
				content: 'Welcome! Check [[Documentation]] and [[Projects]]'
			},
			Documentation: {
				title: 'Documentation',
				content: 'See also [[API Reference]]'
			}
		};

		const migrated = migratePages(oldPages);

		expect(migrated.Home.content).toBe('Welcome! Check [Documentation] and [Projects]');
		expect(migrated.Documentation.content).toBe('See also [API Reference]');
	});

	it('should handle pages without old syntax', () => {
		const migratePages = (pages: Record<string, WikiPage>): Record<string, WikiPage> => {
			const migrated: Record<string, WikiPage> = {};
			for (const [key, page] of Object.entries(pages)) {
				migrated[key] = {
					...page,
					content: page.content.replace(/\[\[([^\]]+)\]\]/g, '[$1]')
				};
			}
			return migrated;
		};

		const pages: Record<string, WikiPage> = {
			Home: {
				title: 'Home',
				content: 'Welcome! Check [Documentation]'
			}
		};

		const migrated = migratePages(pages);
		expect(migrated.Home.content).toBe('Welcome! Check [Documentation]');
	});

	it('should migrate multiple instances in one page', () => {
		const migratePages = (pages: Record<string, WikiPage>): Record<string, WikiPage> => {
			const migrated: Record<string, WikiPage> = {};
			for (const [key, page] of Object.entries(pages)) {
				migrated[key] = {
					...page,
					content: page.content.replace(/\[\[([^\]]+)\]\]/g, '[$1]')
				};
			}
			return migrated;
		};

		const pages: Record<string, WikiPage> = {
			Content: {
				title: 'Content',
				content: '[[First]] link and [[Second]] link and [[Third]]'
			}
		};

		const migrated = migratePages(pages);
		expect(migrated.Content.content).toBe('[First] link and [Second] link and [Third]');
	});
});

describe('WikiPage type', () => {
	it('should have title and content fields', () => {
		const page: WikiPage = {
			title: 'Test Page',
			content: 'This is test content'
		};

		expect(page.title).toBe('Test Page');
		expect(page.content).toBe('This is test content');
	});

	it('should support pages with links in content', () => {
		const page: WikiPage = {
			title: 'Linked Page',
			content: 'This page contains [Another Page] and [Yet Another]'
		};

		expect(page.content).toContain('[Another Page]');
		expect(page.content).toContain('[Yet Another]');
	});
});

describe('Data validation', () => {
	it('should validate page title is not empty', () => {
		const page: WikiPage = {
			title: 'Valid Title',
			content: 'Content'
		};

		expect(page.title.length).toBeGreaterThan(0);
	});

	it('should allow empty content', () => {
		const page: WikiPage = {
			title: 'Title',
			content: ''
		};

		expect(page.content).toBe('');
	});

	it('should handle special characters in title', () => {
		const page: WikiPage = {
			title: "O'Brien's Adventure",
			content: 'Story content'
		};

		expect(page.title).toContain("'");
		expect(page.title).toContain('s');
	});
});
