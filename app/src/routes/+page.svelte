<script lang="ts">
  import { pages } from '$lib/stores/pages';
  import { parseWikiLinks } from '$lib/wiki';
  import { getBackups, restoreBackup, exportData, importData } from '$lib/stores/pages';
  import { get, derived, writable } from 'svelte/store';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import TreeNode from '$lib/TreeNode.svelte';

  let currentTitle = 'Home';
  let content = '';
  let backups = getBackups();
  let showBackups = false;
  let importInput: HTMLInputElement;
  const expandedNodesStore = writable(new Set<string>());
  let sidebarWidth = 220;
  let isResizing = false;
  let expandedNodes: Set<string>;
  
  // Subscribe to the store
  $: expandedNodes = $expandedNodesStore;
  
  // Sanitize mode variables
  let isSanitizing = false;
  let sanitizeConflicts: Array<{ pageName: string; sources: string[] }> = [];
  let currentConflictIndex = 0;
  let conflictResolutions: Record<string, string> = {};

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
      isPage: false,
      children: new Map()
    };

    // Add links from Home
    const homePage = $pages['Home'];
    if (homePage) {
      const linkRegex = /\[\[([^\]]+)\]\]/g;
      let match;
      while ((match = linkRegex.exec(homePage.content)) !== null) {
        const linkTitle = match[1].trim();
        if (!root.children.has(linkTitle)) {
          const node: TreeNode = {
            name: linkTitle,
            path: 'Home/' + linkTitle,
            isPage: !!$pages[linkTitle],
            children: new Map()
          };
          root.children.set(linkTitle, node);
          addChildrenToNode(node, linkTitle, new Set(['Home', linkTitle]));
        }
      }
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
            path: node.path + '/' + linkTitle,
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
    expandedNodesStore.update(set => {
      if (set.has(path)) {
        set.delete(path);
      } else {
        set.add(path);
      }
      return set;
    });
  }

  const pageTreeStore = derived(pages, $pages => buildPageTree());
  let pageTree: TreeNode;
  $: pageTree = $pageTreeStore;

  $: expandedNodesStore.update(set => {
    const existing = new Set<string>();
    const collect = (node: TreeNode) => {
      existing.add(node.path);
      for (const child of node.children.values()) {
        collect(child);
      }
    };
    collect(pageTree);
    return new Set([...set].filter(p => existing.has(p)));
  });

  function startResize(e: MouseEvent) {
    isResizing = true;
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResize);
  }

  function resize(e: MouseEvent) {
    if (isResizing) {
      const newWidth = e.clientX;
      if (newWidth > 100 && newWidth < window.innerWidth - 200) {
        sidebarWidth = newWidth;
      }
    }
  }

  function stopResize() {
    isResizing = false;
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', stopResize);
  }

  function loadPage(title: string) {
    currentTitle = title;
    const page = get(pages)[title];
    content = page?.content ?? '';
  }

  function savePage() {
    pages.update((p) => {
      return {
        ...p,
        [currentTitle]: {
          title: currentTitle,
          content
        }
      };
    });
  }

  function getSourceLinkedPages(): Set<string> {
    const sourceLinks = new Set<string>();
    
    Object.values($pages).forEach((page) => {
      const linkRegex = /\[\[([^\]]+)\]\]/g;
      let match;
      while ((match = linkRegex.exec(page.content)) !== null) {
        sourceLinks.add(match[1].trim());
      }
    });
    
    return sourceLinks;
  }

  function renderContent(text: string) {
    const sourceLinkedPages = getSourceLinkedPages();
    
    // First, handle source links (explicit [[...]] format)
    let result = parseWikiLinks(text, (title) => {
      const trimmedTitle = title.trim();
      return `<a href="#" data-link="${trimmedTitle}" class="source-link">${trimmedTitle}</a>`;
    });
    
    // Then, handle proxy links (page names without brackets that have source links)
    sourceLinkedPages.forEach((pageName) => {
      if (!pageName) return;
      
      // Find words that match page names but aren't already in links
      const escapedPageName = pageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match the page name but only if it's not inside an <a> tag or [[...]]
      const regex = new RegExp(`(?<!\\[\\[)(?<![>\\w])\\b${escapedPageName}\\b(?!\\]\\])(?![^<]*</)`, 'g');
      
      result = result.replace(regex, `<a href="#" data-link="${pageName}" class="proxy-link">${pageName}</a>`);
    });
    
    return result;
  }

  function handleClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const link = target.closest('[data-link]');
    if (link) {
      // Prevent loading page if textarea is focused to avoid interrupting typing
      if (document.activeElement?.tagName === 'TEXTAREA') return;
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
    if (browser) {
      const saved = localStorage.getItem('expandedNodes');
      if (saved) {
        try {
          expandedNodesStore.set(new Set(JSON.parse(saved)));
        } catch (e) {
          expandedNodesStore.set(new Set(['Home']));
        }
      } else {
        expandedNodesStore.set(new Set(['Home']));
      }
    }
  });

  $: if (browser) localStorage.setItem('expandedNodes', JSON.stringify(Array.from($expandedNodesStore)));

  $: renderedContent = renderContent(content);

  function findConflicts(): Array<{ pageName: string; sources: string[] }> {
    const sourceMap: Record<string, string[]> = {};
    const allPages = get(pages);
    
    // Find all source links and track which pages have them
    Object.entries(allPages).forEach(([pageName, page]) => {
      const linkRegex = /\[\[([^\]]+)\]\]/g;
      let match;
      
      while ((match = linkRegex.exec(page.content)) !== null) {
        const linkedPageName = match[1].trim();
        if (!sourceMap[linkedPageName]) {
          sourceMap[linkedPageName] = [];
        }
        sourceMap[linkedPageName].push(pageName);
      }
    });
    
    // Return only pages with multiple sources
    return Object.entries(sourceMap)
      .filter(([_, sources]) => sources.length > 1)
      .map(([pageName, sources]) => ({ pageName, sources: Array.from(new Set(sources)) }));
  }

  function startSanitize() {
    const conflicts = findConflicts();
    if (conflicts.length === 0) {
      alert('No conflicts found. Your wiki is clean!');
      return;
    }
    
    sanitizeConflicts = conflicts;
    currentConflictIndex = 0;
    conflictResolutions = {};
    isSanitizing = true;
  }

  function goToSource(pageName: string) {
    loadPage(pageName);
  }

  function resolveConflict(chosenSource: string) {
    const conflict = sanitizeConflicts[currentConflictIndex];
    conflictResolutions[conflict.pageName] = chosenSource;
    
    // Move to next conflict or finish
    if (currentConflictIndex < sanitizeConflicts.length - 1) {
      currentConflictIndex++;
    } else {
      applySanitization();
    }
  }

  function applySanitization() {
    const allPages = get(pages);
    
    // For each conflict, remove [[ ]] from non-chosen sources
    Object.entries(conflictResolutions).forEach(([pageName, chosenSource]) => {
      const conflict = sanitizeConflicts.find(c => c.pageName === pageName);
      if (!conflict) return;
      
      // Update each source page
      conflict.sources.forEach((sourcePage) => {
        if (sourcePage !== chosenSource) {
          // Remove [[ ]] from this source page
          allPages[sourcePage].content = allPages[sourcePage].content.replace(
            new RegExp(`\\[\\[${pageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\]`, 'g'),
            pageName
          );
        }
      });
    });
    
    // Update all pages at once
    pages.set(allPages);
    
    // Exit sanitize mode
    isSanitizing = false;
    sanitizeConflicts = [];
    currentConflictIndex = 0;
    conflictResolutions = {};
    
    alert('Sanitization complete!');
  }

  function cancelSanitize() {
    isSanitizing = false;
    sanitizeConflicts = [];
    currentConflictIndex = 0;
    conflictResolutions = {};
  }
</script>

<style>
  .container {
    display: grid;
    grid-template-columns: var(--sidebar-width) 5px 1fr;
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

  .viewer a.source-link {
    color: #0066cc;
    font-weight: 500;
    text-decoration: underline;
    background-color: #f0f7ff;
    padding: 1px 3px;
    border-radius: 2px;
  }

  .viewer a.proxy-link {
    color: #0066cc;
    text-decoration: dotted underline;
    opacity: 0.8;
  }

  .viewer a.proxy-link:hover {
    opacity: 1;
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
    overflow-x: auto;
    border-right: 1px solid #ddd;
    padding: 10px;
  }

  .resizer {
    width: 5px;
    cursor: col-resize;
    background: #ddd;
  }

  .resizer:hover {
    background: #bbb;
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

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: white;
    border-radius: 8px;
    padding: 20px;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
  }

  .modal h3 {
    margin-top: 0;
    color: #333;
  }

  .conflict-item {
    padding: 12px;
    background-color: #f9f9f9;
    border-left: 4px solid #ff9800;
    margin-bottom: 10px;
    border-radius: 4px;
  }

  .source-option {
    display: flex;
    align-items: center;
    padding: 8px;
    margin: 8px 0;
    background-color: #f5f5f5;
    border-radius: 4px;
  }

  .source-option input[type="radio"] {
    margin-right: 10px;
    cursor: pointer;
  }

  .source-link-button {
    background: none;
    border: none;
    color: #0066cc;
    cursor: pointer;
    text-decoration: underline;
    padding: 0;
    margin: 0;
  }

  .source-link-button:hover {
    text-decoration: none;
  }

  .modal-buttons {
    display: flex;
    gap: 10px;
    margin-top: 20px;
    justify-content: flex-end;
  }

  .modal-buttons button {
    padding: 8px 16px;
  }

  textarea:disabled {
    background-color: #f5f5f5;
    color: #999;
    cursor: not-allowed;
  }


</style>

<div class="container" style="--sidebar-width: {sidebarWidth}px">
  <div class="sidebar">
    <h3>Pages</h3>
    <div class="tree-node">
      <div class="tree-item">
        <TreeNode node={pageTree} {expandedNodes} {toggleNode} {loadPage} {currentTitle} />
      </div>
    </div>
  </div>
  <div class="resizer" on:mousedown={startResize}></div>
  <div class="main-content">
    <h2>{currentTitle}</h2>

    <div class="controls">
      <button on:click={handleExport}>Export</button>
      <button on:click={() => importInput.click()}>Import</button>
      <button on:click={() => showBackups = !showBackups}>
        {showBackups ? 'Hide' : 'Show'} Backups ({backups.length})
      </button>
      <button on:click={startSanitize}>Sanitize</button>
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
      disabled={isSanitizing}
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

{#if isSanitizing && sanitizeConflicts.length > 0}
  <div class="modal-overlay">
    <div class="modal">
      <h3>Resolve Wiki Link Conflicts</h3>
      
      {#if currentConflictIndex < sanitizeConflicts.length}
        {@const conflict = sanitizeConflicts[currentConflictIndex]}
        
        <div class="conflict-item">
          <strong>Page "[[{conflict.pageName}]]" has multiple sources:</strong>
          <p>This page name is defined as a source link in {conflict.sources.length} places. Please choose which one to keep as the primary source:</p>
        </div>

        <div>
          {#each conflict.sources as source}
            <div class="source-option">
              <input
                type="radio"
                id="source-{source}"
                name="conflict-source-{currentConflictIndex}"
                value={source}
                checked={conflictResolutions[conflict.pageName] === source}
                on:change={() => conflictResolutions[conflict.pageName] = source}
              />
              <label for="source-{source}" style="margin: 0; flex: 1; cursor: pointer;">
                <button
                  class="source-link-button"
                  on:click={() => goToSource(source)}
                >
                  {source}
                </button>
              </label>
            </div>
          {/each}
        </div>

        <div class="modal-buttons">
          <button on:click={cancelSanitize}>Cancel</button>
          <button 
            on:click={() => resolveConflict(conflictResolutions[conflict.pageName])}
            disabled={!conflictResolutions[conflict.pageName]}
          >
            {currentConflictIndex < sanitizeConflicts.length - 1 ? 'Next' : 'Finish'}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

