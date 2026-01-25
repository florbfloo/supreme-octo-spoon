<script lang="ts">
  import { pages } from '$lib/stores/pages';
  import { parseWikiLinks } from '$lib/wiki';
  import { get } from 'svelte/store';

  let currentTitle = 'Home';
  let content = '';

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
    return parseWikiLinks(text, (title) =>
      `<a href="#" data-link="${title}">${title}</a>`
    );
  }

  function handleClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const link = target.closest('[data-link]');
    if (link) {
      e.preventDefault();
      loadPage(link.getAttribute('data-link')!);
    }
  }

  loadPage(currentTitle);
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
  {@html renderContent(content)}
</div>
  </div>
</div>