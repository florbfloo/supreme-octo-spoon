<script lang="ts">
  import { pages } from '$lib/stores/pages';
  import { parseWikiLinks } from '$lib/wiki';
  import { getBackups, restoreBackup, exportData, importData } from '$lib/stores/pages';
  import { get } from 'svelte/store';
  import { onMount } from 'svelte';

  let currentTitle = 'Home';
  let content = '';
  let backups = getBackups();
  let showBackups = false;
  let importInput: HTMLInputElement;

  function loadPage(title: string) {
    currentTitle = title;
    const page = get(pages)[title];
    content = page?.content ?? '';
  }

  function savePage() {
    pages.update((p) => {
      p[currentTitle] = {
        title: currentTitle,
        content
      };
      return p;
    });
  }

  function renderContent(text: string) {
    return parseWikiLinks(text, (title) => {
      const trimmedTitle = title.trim();
      return `<a href="#" data-link="${trimmedTitle}">${trimmedTitle}</a>`;
    });
  }

  function handleClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const link = target.closest('[data-link]');
    if (link) {
      e.preventDefault();
      loadPage(link.getAttribute('data-link')!);
    }
  }

  function handleExport() {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wiki-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (importData(content)) {
          alert('Data imported successfully!');
          backups = getBackups();
          // Reload the current page to update the textbox
          loadPage(currentTitle);
        } else {
          alert('Failed to import data. Invalid JSON file.');
        }
      };
      reader.readAsText(file);
    }
  }

  function handleRestoreBackup(timestamp: number) {
    if (confirm('Restore to this backup? Current changes will be lost.')) {
      restoreBackup(timestamp);
      backups = getBackups();
      // Reload current page
      if ($pages[currentTitle]) {
        loadPage(currentTitle);
      } else {
        loadPage('Home');
      }
    }
  }

  pages.subscribe(() => {
    if (!$pages[currentTitle]) {
      loadPage('Home');
    }
  });

  onMount(() => {
    loadPage(currentTitle);
  });

  $: renderedContent = renderContent(content);
</script>

<style>
  .container {
    display: grid;
    grid-template-columns: 220px 1fr;
    height: 100vh;
  }

  textarea {
    width: 100%;
    height: 200px;
  }

  .viewer a {
    color: blue;
    cursor: pointer;
    text-decoration: underline;
  }

  .controls {
    display: flex;
    gap: 8px;
    margin: 10px 0;
    flex-wrap: wrap;
  }

  button {
    padding: 6px 12px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }

  button:hover {
    background-color: #0056b3;
  }

  .backup-list {
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 10px;
    max-height: 200px;
    overflow-y: auto;
    margin-top: 10px;
  }

  .backup-item {
    padding: 8px;
    background-color: #f5f5f5;
    border-radius: 4px;
    margin-bottom: 5px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
  }

  .backup-item button {
    padding: 4px 8px;
    font-size: 12px;
  }

  input[type="file"] {
    display: none;
  }
</style>

<div class="container">
  <div>
    <h3>Pages</h3>
    {#each Object.keys($pages) as title}
      <div>
        <a href="#" on:click={(e) => { e.preventDefault(); loadPage(title); }}>{title}</a>
      </div>
    {/each}
  </div>

  <div>
    <h2>{currentTitle}</h2>

    <div class="controls">
      <button on:click={handleExport}>Export</button>
      <button on:click={() => importInput.click()}>Import</button>
      <button on:click={() => showBackups = !showBackups}>
        {showBackups ? 'Hide' : 'Show'} Backups ({backups.length})
      </button>
    </div>

    <input
      type="file"
      accept=".json"
      bind:this={importInput}
      on:change={handleImport}
    />

    {#if showBackups && backups.length > 0}
      <div class="backup-list">
        <strong>Recent Backups:</strong>
        {#each backups.slice().reverse() as backup (backup.timestamp)}
          <div class="backup-item">
            <span>{new Date(backup.timestamp).toLocaleString()}</span>
            <button on:click={() => handleRestoreBackup(backup.timestamp)}>
              Restore
            </button>
          </div>
        {/each}
      </div>
    {/if}

    <textarea
      bind:value={content}
      on:input={savePage}
      placeholder="Type here. Use [[Page Name]] to link."
    />

    <h3>Preview</h3>
    <div
  class="viewer"
  on:click={handleClick}
>
  {@html renderedContent}
</div>
  </div>
</div>