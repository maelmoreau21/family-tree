/**
 * Initializes a tab system within a container.
 * @param {string|HTMLElement} containerSelector - The container element or selector.
 */
export function initTabs(containerSelector: string | HTMLElement) {
    const container = typeof containerSelector === 'string'
        ? document.querySelector(containerSelector)
        : containerSelector;

    if (!container) return;

    const tabButtons = (container as HTMLElement).querySelectorAll('.tabs-nav > [data-tab], [data-tab]');

    if (tabButtons.length === 0) return;

    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const targetName = (button as HTMLElement).dataset.tab;

            // Deactivate all buttons in this specific nav
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const contents = (container as HTMLElement).querySelectorAll(`[data-tab-content]`);
            contents.forEach(content => {
                if ((content as HTMLElement).dataset.tabContent === targetName) {
                    content.classList.add('active');
                } else {
                    // Simple check: if the content's tab name matches ONE OF the buttons in this group, hide it.
                    const isManagedByThisGroup = Array.from(tabButtons).some(btn => (btn as HTMLElement).dataset.tab === (content as HTMLElement).dataset.tabContent);
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
        (tabButtons[0] as HTMLElement).click();
    }
}
