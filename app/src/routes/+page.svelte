<script lang="ts">
  import { pages } from '$lib/stores/pages';
  import { parseWikiLinks } from '$lib/wiki';
  import { getBackups, restoreBackup, exportData, importData } from '$lib/stores/pages';
  import { get } from 'svelte/store';
  import { onMount } from 'svelte';
  import TreeNode from '$lib/TreeNode.svelte';

  let currentTitle = 'Home';
  let content = '';
  let backups = getBackups();
  let showBackups = false;
  let importInput: HTMLInputElement;
  let expandedNodes: Set<string> = new Set(['Home']);

  type TreeNode = {
    name: string;
    path: string;
    isPage: boolean;
    children: Map<string, TreeNode>;
  };

  function buildPageTree(): TreeNode {
    const root: TreeNode = {
      name: 'Home',
      path: 'Home',
      isPage: false,  // Changed to false so it shows as expandable folder
      children: new Map()
    };

    // Extract links from the Home page
    const homePage = $pages['Home'];
    if (homePage) {
      const linkRegex = /\[\[([^\]]+)\]\]/g;
      let match;
      const links = new Set<string>();
      
      while ((match = linkRegex.exec(homePage.content)) !== null) {
        links.add(match[1].trim());
      }

      // For each link, add it as a child and recursively add its children
      links.forEach((linkTitle) => {
        if (!root.children.has(linkTitle)) {
          const childNode: TreeNode = {
            name: linkTitle,
            path: linkTitle,
            isPage: !!$pages[linkTitle],
            children: new Map()
          };
          root.children.set(linkTitle, childNode);
          
          // Recursively add children from linked pages
          addChildrenToNode(childNode, linkTitle, new Set(['Home', linkTitle]));
        }
      });
    }

    return root;
  }

  function addChildrenToNode(node: TreeNode, pageName: string, visited: Set<string>) {
    const page = $pages[pageName];
    if (!page) return;

    const linkRegex = /\[\[([^\]]+)\]\]/g;
    let match;

    while ((match = linkRegex.exec(page.content)) !== null) {
      const linkTitle = match[1].trim();
      
      // Avoid circular references
      if (!visited.has(linkTitle) && linkTitle !== 'Home') {
        visited.add(linkTitle);
        
        if (!node.children.has(linkTitle)) {
          const childNode: TreeNode = {
            name: linkTitle,
            path: linkTitle,
            isPage: !!$pages[linkTitle],
            children: new Map()
          };
          node.children.set(linkTitle, childNode);
          
          // Recursively add children
          addChildrenToNode(childNode, linkTitle, new Set(visited));
        }
      }
    }
  }

  function toggleNode(path: string) {
    if (expandedNodes.has(path)) {
      expandedNodes.delete(path);
    } else {
      expandedNodes.add(path);
    }
    expandedNodes = expandedNodes;
  }

  $: pageTree = buildPageTree();

  function loadPage(title: string) {
    currentTitle = title;
    const page = get(pages)[title];
    content = page?.content ?? '';
  }

  function savePage() {
    // Auto-link existing page names
    const autoLinkedContent = autoLinkPages(content);
    
    pages.update((p) => {
      p[currentTitle] = {
        title: currentTitle,
        content: autoLinkedContent
      };
      return p;
    });
    
    // Update the content display to reflect auto-linked changes
    content = autoLinkedContent;
  }

  function autoLinkPages(text: string): string {
    const existingPages = Object.keys($pages);
    
    // Sort by length (longest first) to avoid partial matches
    existingPages.sort((a, b) => b.length - a.length);
    
    let result = text;
    
    existingPages.forEach((pageName) => {
      // Skip if the page name is empty
      if (!pageName) return;
      
      // Create a regex to find the page name not already in links
      // Match the page name but not if it's already wrapped in [[...]]
      const escapedPageName = pageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?<!\\[\\[)\\b${escapedPageName}\\b(?!\\]\\])`, 'g');
      
      result = result.replace(regex, `[[${pageName}]]`);
    });
    
    return result;
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

  .sidebar {
    overflow-y: auto;
    border-right: 1px solid #ddd;
    padding: 10px;
  }

  .tree-node {
    margin: 0;
    padding-left: 0;
    list-style: none;
  }

  .tree-item {
    padding: 4px 0;
    margin-left: 0;
  }

  /* Tree node styles from TreeNode component */
  :global(.tree-toggle) {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    margin-right: 4px;
    width: 20px;
    color: #666;
    font-size: 12px;
    display: inline-block;
  }

  :global(.tree-toggle:hover) {
    color: #000;
  }

  :global(.tree-label) {
    cursor: pointer;
    color: #0066cc;
    text-decoration: none;
    padding: 2px 4px;
    border-radius: 2px;
    display: inline-block;
  }

  :global(.tree-label:hover) {
    background-color: #f0f0f0;
    text-decoration: underline;
  }

  :global(.tree-folder) {
    font-weight: 500;
    color: #333;
    cursor: default;
  }

  :global(.tree-page) {
    color: #0066cc;
  }

  :global(.tree-children) {
    margin-left: 16px;
  }

  .main-content {
    padding: 10px;
    overflow-y: auto;
  }

  h3 {
    margin-top: 10px;
  }

</style>

<div class="container">
  <div class="sidebar">
    <h3>Pages</h3>
    <div class="tree-node">
      <div class="tree-item">
        <TreeNode {pageTree} {expandedNodes} {toggleNode} {loadPage} {currentTitle} node={pageTree} />
      </div>
    </div>
  </div>

  <div class="main-content">
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
    ></textarea>

    <h3>Preview</h3>
    <div
      class="viewer"
      on:click={handleClick}
      role="region"
      aria-label="Content preview"
    >
      {@html renderedContent}
    </div>
  </div>
</div>

