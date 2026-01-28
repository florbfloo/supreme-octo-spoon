import { describe, it, expect } from 'vitest';
import { parseWikiLinks } from './wiki';

describe('parseWikiLinks', () => {
	it('should parse a single wiki link', () => {
		const text = 'Check out [Documentation]';
		const result = parseWikiLinks(text, (title) => `<link>${title}</link>`);
		expect(result).toBe('Check out <link>Documentation</link>');
	});

	it('should parse multiple wiki links', () => {
		const text = 'See [Documentation] and [Projects] for more info';
		const result = parseWikiLinks(text, (title) => `[${title}]`);
		expect(result).toBe('See [Documentation] and [Projects] for more info');
	});

	it('should handle wiki links with spaces', () => {
		const text = 'Visit [My Page Title]';
		const result = parseWikiLinks(text, (title) => `LINK:${title}`);
		expect(result).toBe('Visit LINK:My Page Title');
	});

	it('should trim whitespace around link titles', () => {
		const text = 'Check [ Documentation ]';
		const result = parseWikiLinks(text, (title) => `<link>${title}</link>`);
		expect(result).toBe('Check <link>Documentation</link>');
	});

	it('should handle nested brackets', () => {
		const text = 'Text with [Link One] and [Link Two]';
		const result = parseWikiLinks(text, (title) => `{${title}}`);
		expect(result).toBe('Text with {Link One} and {Link Two}');
	});

	it('should not match unclosed brackets', () => {
		const text = 'Text with [unclosed bracket';
		const result = parseWikiLinks(text, (title) => `<link>${title}</link>`);
		expect(result).toBe('Text with [unclosed bracket');
	});

	it('should handle empty brackets', () => {
		const text = 'Text with []';
		const result = parseWikiLinks(text, (title) => `<link>${title}</link>`);
		// Empty brackets won't match the regex pattern
		expect(result).toBe('Text with []');
	});

	it('should handle special characters in link titles', () => {
		const text = "Check [O'Brien's Page]";
		const result = parseWikiLinks(text, (title) => `LINK:${title}`);
		expect(result).toBe("Check LINK:O'Brien's Page");
	});

	it('should preserve text outside links', () => {
		const text = 'Start [Link] middle [Another] end';
		const result = parseWikiLinks(text, (title) => `<${title}>`);
		expect(result).toBe('Start <Link> middle <Another> end');
	});

	it('should handle callback that returns different formats', () => {
		const text = 'Links: [Page1] [Page2]';
		const result = parseWikiLinks(text, (title) => {
			return title === 'Page1' ? 'FIRST' : 'SECOND';
		});
		expect(result).toBe('Links: FIRST SECOND');
	});
});
