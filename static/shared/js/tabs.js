/**
 * Initializes a tab system within a container.
 * @param {string|HTMLElement} containerSelector - The container element or selector.
 */
export function initTabs(containerSelector) {
  const container = typeof containerSelector === 'string' 
    ? document.querySelector(containerSelector) 
    : containerSelector;

  if (!container) return;

  const tabButtons = container.querySelectorAll(':scope > .tabs-nav > [data-tab], :scope > [data-tab]');
  
  if (tabButtons.length === 0) return;

  tabButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const targetName = button.dataset.tab;
      
      // Deactivate all buttons in this specific nav
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      // Find contents that are direct children or specifically marked for this container
      // We use :scope to avoid finding nested tab contents if possible, 
      // but standard querySelectorAll doesn't support :scope in all contexts easily without id.
      // So we just look for [data-tab-content] inside.
      // To support nested tabs, we should ideally only target direct children or specific IDs.
      // But for this simple implementation, let's assume unique names or careful structure.
      
      const contents = container.querySelectorAll(`[data-tab-content]`);
      contents.forEach(content => {
        // Only toggle if it matches the target
        if (content.dataset.tabContent === targetName) {
          content.classList.add('active');
        } else {
          // Only hide if it belongs to this level? 
          // If we have nested tabs, their content might have different names.
          // If we have sibling contents, they should be hidden.
          // We can check if the content is a direct child of the container or a content-wrapper?
          
          // Simple check: if the content's tab name matches ONE OF the buttons in this group, hide it.
          // This prevents hiding unrelated content.
          const isManagedByThisGroup = Array.from(tabButtons).some(btn => btn.dataset.tab === content.dataset.tabContent);
          if (isManagedByThisGroup) {
            content.classList.remove('active');
          }
        }
      });
    });
  });
  
  // Activate first tab if none active
  const activeBtn = Array.from(tabButtons).find(btn => btn.classList.contains('active'));
  if (!activeBtn && tabButtons.length > 0) {
      tabButtons[0].click();
  }
}
