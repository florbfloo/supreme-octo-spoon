import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type WikiPage = {
  title: string;
  content: string;
};

const BACKUP_KEY = 'wiki-pages-backups';
const MAX_BACKUPS = 20;

function createBackup(data: Record<string, WikiPage>) {
  if (!browser) return;
  
  const backups = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]');
  backups.push({
    timestamp: Date.now(),
    data
  });
  
  // Keep only the last MAX_BACKUPS backups
  if (backups.length > MAX_BACKUPS) {
    backups.shift();
  }
  
  localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
}

export function getBackups() {
  if (!browser) return [];
  return JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]');
}

export function restoreBackup(timestamp: number) {
  if (!browser) return;
  const backups = getBackups();
  const backup = backups.find((b: any) => b.timestamp === timestamp);
  if (backup) {
    pages.set(backup.data);
  }
}

export function exportData() {
  if (!browser) return '';
  const data = localStorage.getItem('wiki-pages');
  return data || '{}';
}

export function importData(jsonString: string) {
  try {
    const data = JSON.parse(jsonString);
    if (typeof data === 'object' && data !== null) {
      pages.set(data);
      return true;
    }
  } catch (e) {
    console.error('Failed to import data:', e);
  }
  return false;
}

const stored = browser ? localStorage.getItem('wiki-pages') : null;

const initialPages: Record<string, WikiPage> =
  stored ? JSON.parse(stored) : {
    'Home': { title: 'Home', content: 'Welcome! Try adding links like [[Documentation]] or [[Projects]]' },
  };

export const pages = writable<Record<string, WikiPage>>(initialPages);

pages.subscribe((value) => {
  if (browser) {
    localStorage.setItem('wiki-pages', JSON.stringify(value));
    createBackup(value);
  }
});