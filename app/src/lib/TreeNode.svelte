<script lang="ts">
  type TreeNodeType = {
    name: string;
    path: string;
    isPage: boolean;
    children: Map<string, TreeNodeType>;
  };

  export let node: TreeNodeType;
  export let expandedNodes: Set<string>;
  export let toggleNode: (path: string) => void;
  export let loadPage: (title: string) => void;
  export let currentTitle: string;

  $: hasChildren = node.children.size > 0;
  $: isExpanded = expandedNodes.has(node.path);
</script>

<div>
  {#if hasChildren}
    <button class="tree-toggle" on:click={() => toggleNode(node.path)}>
      {isExpanded ? '▼' : '▶'}
    </button>
    <span 
      class="tree-label tree-folder"
      on:click={() => { if (document.activeElement?.tagName !== 'TEXTAREA') loadPage(node.name); }}
      role="button"
      tabindex="0"
      on:keydown={(e) => e.key === 'Enter' && document.activeElement?.tagName !== 'TEXTAREA' && loadPage(node.name)}
    >
      {node.name}
    </span>
    {#if isExpanded}
      <div class="tree-children">
        {#each Array.from(node.children.values()) as child (child.path)}
          <div class="tree-item">
            <svelte:self
              node={child}
              {expandedNodes}
              {toggleNode}
              {loadPage}
              {currentTitle}
            />
          </div>
        {/each}
      </div>
    {/if}
  {:else}
    <div class="tree-leaf">
      <span class="tree-toggle-placeholder"></span>
      <span
        class="tree-label tree-folder"
        on:click={() => { if (document.activeElement?.tagName !== 'TEXTAREA') loadPage(node.name); }}
        role="button"
        tabindex="0"
        on:keydown={(e) => e.key === 'Enter' && document.activeElement?.tagName !== 'TEXTAREA' && loadPage(node.name)}
      >
        {node.name}
      </span>
    </div>
  {/if}
</div>

<style>
  .tree-toggle {
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

  .tree-toggle:hover {
    color: #000;
  }

  .tree-label {
    cursor: pointer;
    color: #0066cc;
    text-decoration: none;
    padding: 2px 4px;
    border-radius: 2px;
    display: inline-block;
  }

  .tree-label:hover {
    background-color: #f0f0f0;
    text-decoration: underline;
  }

  .tree-folder {
    font-weight: 500;
    color: #333;
    cursor: default;
  }

  .tree-page {
    color: #0066cc;
  }

  .tree-children {
    margin-left: 16px;
  }

  .tree-item {
    padding: 4px 0;
    display: flex;
    align-items: center;
  }

  .tree-leaf {
    display: flex;
    align-items: center;
  }

  .tree-toggle-placeholder {
    display: inline-block;
    width: 20px;
    margin-right: 4px;
  }
</style>
