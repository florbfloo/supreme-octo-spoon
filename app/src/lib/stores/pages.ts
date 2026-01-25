import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type WikiPage = {
  title: string;
  content: string;
};

const stored = browser ? localStorage.getItem('wiki-pages') : null;

const initialPages: Record<string, WikiPage> =
  stored ? JSON.parse(stored) : {};

export const pages = writable<Record<string, WikiPage>>(initialPages);

pages.subscribe((value) => {
  if (browser) {
    localStorage.setItem('wiki-pages', JSON.stringify(value));
  }
});