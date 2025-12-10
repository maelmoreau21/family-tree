// https://maelmoreau21.github.io/family-tree/ v1.6.0 Copyright 2025 undefined
import * as d3 from 'd3';
import { extent } from 'd3-array';
import { tree, hierarchy } from 'd3-hierarchy';

function userIcon() {
    return (`
    <g data-icon="user">
      ${bgCircle()}
      <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z" />
    </g>
  `);
}
function userEditIcon() {
    return (`
    <g data-icon="user-edit">
      ${bgCircle()}
      <path d="M21.7,13.35L20.7,14.35L18.65,12.3L19.65,11.3C19.86,11.09 20.21,11.09 20.42,11.3L21.7,12.58C21.91,
      12.79 21.91,13.14 21.7,13.35M12,18.94L18.06,12.88L20.11,14.93L14.06,21H12V18.94M12,14C7.58,14 4,15.79 4,
      18V20H10V18.11L14,14.11C13.34,14.03 12.67,14 12,14M12,4A4,4 0 0,0 8,8A4,4 0 0,0 12,12A4,4 0 0,0 16,8A4,4 0 0,0 12,4Z" />
    </g>
  `);
}
function userPlusIcon() {
    return (`
    <g data-icon="user-plus">
      ${bgCircle()}
      <path d="M15,14C12.33,14 7,15.33 7,18V20H23V18C23,15.33 17.67,14 15,14M6,10V7H4V10H1V12H4V15H6V12H9V10M15,12A4,4 0 0,0 19,8A4,4 0 0,0 15,4A4,4 0 0,0 11,8A4,4 0 0,0 15,12Z" />
    </g>
  `);
}
function userPlusCloseIcon() {
    return (`
    <g data-icon="user-plus-close">
      ${bgCircle()}
      <path d="M15,14C12.33,14 7,15.33 7,18V20H23V18C23,15.33 17.67,14 15,14M6,10V7H4V10H1V12H4V15H6V12H9V10M15,12A4,4 0 0,0 19,8A4,4 0 0,0 15,4A4,4 0 0,0 11,8A4,4 0 0,0 15,12Z" />
      <line x1="3" y1="3" x2="24" y2="24" stroke="currentColor" stroke-width="2" />
    </g>
  `);
}
function plusIcon() {
    return (`
    <g data-icon="plus">
      ${bgCircle()}
      <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
    </g>
  `);
}
function pencilIcon() {
    return (`
    <g data-icon="pencil">
      ${bgCircle()}
      <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" />
    </g>
  `);
}
function pencilOffIcon() {
    return (`
    <g data-icon="pencil-off">
      ${bgCircle()}
      <path d="M18.66,2C18.4,2 18.16,2.09 17.97,2.28L16.13,4.13L19.88,7.88L21.72,6.03C22.11,5.64 22.11,5 21.72,4.63L19.38,2.28C19.18,2.09 18.91,2 18.66,2M3.28,4L2,5.28L8.5,11.75L4,16.25V20H7.75L12.25,15.5L18.72,22L20,20.72L13.5,14.25L9.75,10.5L3.28,4M15.06,5.19L11.03,9.22L14.78,12.97L18.81,8.94L15.06,5.19Z" />
    </g>
  `);
}
function trashIcon() {
    return (`
    <g data-icon="trash">
      ${bgCircle()}
      <path d="M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19M8,9H16V19H8V9M15.5,4L14.5,3H9.5L8.5,4H5V6H19V4H15.5Z" />
    </g>
  `);
}
function historyBackIcon() {
    return (`
    <g data-icon="history-back">
      ${bgCircle()}
      <path d="M20 13.5C20 17.09 17.09 20 13.5 20H6V18H13.5C16 18 18 16 18 13.5S16 9 13.5 9H7.83L10.91 12.09L9.5 13.5L4 8L9.5 2.5L10.92 3.91L7.83 7H13.5C17.09 7 20 9.91 20 13.5Z" />
    </g>
  `);
}
function historyForwardIcon() {
    return (`
    <g data-icon="history-forward">
      ${bgCircle()}
      <path d="M10.5 18H18V20H10.5C6.91 20 4 17.09 4 13.5S6.91 7 10.5 7H16.17L13.08 3.91L14.5 2.5L20 8L14.5 13.5L13.09 12.09L16.17 9H10.5C8 9 6 11 6 13.5S8 18 10.5 18Z" />
    </g>
  `);
}
function personIcon() {
    return (`
    <g data-icon="person">
      <path d="M256 288c79.5 0 144-64.5 144-144S335.5 0 256 0 112 
        64.5 112 144s64.5 144 144 144zm128 32h-55.1c-22.2 10.2-46.9 16-72.9 16s-50.6-5.8-72.9-16H128C57.3 320 0 377.3 
        0 448v16c0 26.5 21.5 48 48 48h416c26.5 0 48-21.5 48-48v-16c0-70.7-57.3-128-128-128z" />
    </g>
  `);
}
function miniTreeIcon() {
    return (`
    <g transform="translate(31,25)" data-icon="mini-tree">
      <rect x="-31" y="-25" width="72" height="15" fill="rgba(0,0,0,0)"></rect>
      <g>
        <rect x="-31" y="-25" width="72" height="15" fill="rgba(0,0,0,0)"></rect>
        <line y2="-17.5" stroke="#fff" />
        <line x1="-20" x2="20" y1="-17.5" y2="-17.5" stroke="#fff" />
        <rect x="-31" y="-25" width="25" height="15" rx="5" ry="5" class="card-male" />
        <rect x="6" y="-25" width="25" height="15" rx="5" ry="5" class="card-female" />
      </g>
    </g>
  `);
}
function toggleIconOn() {
    return (`
    <g data-icon="toggle-on">
      ${bgCircle()}
      <circle class="f3-small-circle" r="4" cx="18" cy="12" />
      <path d="M17,7H7A5,5 0 0,0 2,12A5,5 0 0,0 7,17H17A5,5 0 0,0 22,12A5,5 0 0,0 17,7M17,15A3,3 0 0,1 14,12A3,3 0 0,1 17,9A3,3 0 0,1 20,12A3,3 0 0,1 17,15Z" />
    </g>
  `);
}
function toggleIconOff() {
    return (`
    <g data-icon="toggle-off">
      ${bgCircle()}
      <circle class="f3-small-circle" r="4" cx="6" cy="12" />
      <path d="M17,7H7A5,5 0 0,0 2,12A5,5 0 0,0 7,17H17A5,5 0 0,0 22,12A5,5 0 0,0 17,7M7,15A3,3 0 0,1 4,12A3,3 0 0,1 7,9A3,3 0 0,1 10,12A3,3 0 0,1 7,15Z" />
    </g>
  `);
}
function chevronDownIcon() {
    return (`
    <g data-icon="chevron-down">
      ${bgCircle()}
      <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" />
    </g>
  `);
}
function chevronUpIcon() {
    return (`
    <g data-icon="chevron-up">
      ${bgCircle()}
      <path d="M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z" />
    </g>
  `);
}
function linkOffIcon() {
    return (`
    <g data-icon="link-off">
      ${bgCircle()}
      <path d="M17,7H13V8.9H17C18.71,8.9 20.1,10.29 20.1,12C20.1,13.43 19.12,14.63 17.79,15L19.25,16.44C20.88,15.61 22,13.95 
      22,12A5,5 0 0,0 17,7M16,11H13.81L15.81,13H16V11M2,4.27L5.11,7.38C3.29,8.12 2,9.91 2,12A5,5 0 0,0 7,17H11V15.1H7C5.29,15.1 
      3.9,13.71 3.9,12C3.9,10.41 5.11,9.1 6.66,8.93L8.73,11H8V13H10.73L13,15.27V17H14.73L18.74,21L20,19.74L3.27,3L2,4.27Z" />
    </g>
  `);
}
function infoIcon() {
    return (`
    <g data-icon="info">
      ${bgCircle()}
      <path d="M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />
    </g>
  `);
}
function userSvgIcon() { return svgWrapper(userIcon()); }
function userEditSvgIcon() { return svgWrapper(userEditIcon()); }
function userPlusSvgIcon() { return svgWrapper(userPlusIcon()); }
function userPlusCloseSvgIcon() { return svgWrapper(userPlusCloseIcon()); }
function plusSvgIcon() { return svgWrapper(plusIcon()); }
function pencilSvgIcon() { return svgWrapper(pencilIcon()); }
function pencilOffSvgIcon() { return svgWrapper(pencilOffIcon()); }
function trashSvgIcon() { return svgWrapper(trashIcon()); }
function historyBackSvgIcon() { return svgWrapper(historyBackIcon()); }
function historyForwardSvgIcon() { return svgWrapper(historyForwardIcon()); }
function personSvgIcon() { return svgWrapper(personIcon(), '0 0 512 512'); }
function miniTreeSvgIcon() { return svgWrapper(miniTreeIcon(), '0 0 72 25'); }
function toggleSvgIconOn() { return svgWrapper(toggleIconOn()); }
function toggleSvgIconOff() { return svgWrapper(toggleIconOff()); }
function chevronDownSvgIcon() { return svgWrapper(chevronDownIcon()); }
function chevronUpSvgIcon() { return svgWrapper(chevronUpIcon()); }
function linkOffSvgIcon() { return svgWrapper(linkOffIcon()); }
function infoSvgIcon() { return svgWrapper(infoIcon()); }
function svgWrapper(icon, viewBox = '0 0 24 24') {
    const match = icon.match(/data-icon="([^"]+)"/);
    const dataIcon = match ? `data-icon="${match[1]}"` : '';
    return (`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" style="fill: currentColor" ${dataIcon}>
      ${icon}
    </svg>
  `);
}
function bgCircle() {
    return (`
  `);
}

var icons = /*#__PURE__*/Object.freeze({
  __proto__: null,
  chevronDownIcon: chevronDownIcon,
  chevronDownSvgIcon: chevronDownSvgIcon,
  chevronUpIcon: chevronUpIcon,
  chevronUpSvgIcon: chevronUpSvgIcon,
  historyBackIcon: historyBackIcon,
  historyBackSvgIcon: historyBackSvgIcon,
  historyForwardIcon: historyForwardIcon,
  historyForwardSvgIcon: historyForwardSvgIcon,
  infoIcon: infoIcon,
  infoSvgIcon: infoSvgIcon,
  linkOffIcon: linkOffIcon,
  linkOffSvgIcon: linkOffSvgIcon,
  miniTreeIcon: miniTreeIcon,
  miniTreeSvgIcon: miniTreeSvgIcon,
  pencilIcon: pencilIcon,
  pencilOffIcon: pencilOffIcon,
  pencilOffSvgIcon: pencilOffSvgIcon,
  pencilSvgIcon: pencilSvgIcon,
  personIcon: personIcon,
  personSvgIcon: personSvgIcon,
  plusIcon: plusIcon,
  plusSvgIcon: plusSvgIcon,
  toggleIconOff: toggleIconOff,
  toggleIconOn: toggleIconOn,
  toggleSvgIconOff: toggleSvgIconOff,
  toggleSvgIconOn: toggleSvgIconOn,
  trashIcon: trashIcon,
  trashSvgIcon: trashSvgIcon,
  userEditIcon: userEditIcon,
  userEditSvgIcon: userEditSvgIcon,
  userIcon: userIcon,
  userPlusCloseIcon: userPlusCloseIcon,
  userPlusCloseSvgIcon: userPlusCloseSvgIcon,
  userPlusIcon: userPlusIcon,
  userPlusSvgIcon: userPlusSvgIcon,
  userSvgIcon: userSvgIcon
});

function escapeHtml(input) {
    if (input === null || input === undefined)
        return '';
    const s = String(input);
    return s.replace(/[&<>"'`]/g, (c) => {
        switch (c) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#39;';
            case '`': return '&#96;';
            default: return c;
        }
    });
}
function isSafeImageSrc(url) {
    if (!url)
        return false;
    try {
        const s = String(url).trim();
        if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:'))
            return true;
        if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s))
            return true;
        return false;
    }
    catch (_a) {
        return false;
    }
}

const UNSAFE_ELEMENT_NAMES = new Set(["SCRIPT", "OBJECT", "EMBED", "APPLET"]);
const URL_ATTRIBUTES = new Set(["href", "src", "xlink:href", "action", "formaction"]);
function isEnvironmentDomCapable() {
    return typeof document !== "undefined" && typeof document.createElement === "function";
}
function isSafeUrl(value, attrName) {
    const trimmed = value.trim();
    if (!trimmed)
        return true;
    const lower = trimmed.toLowerCase();
    if (lower.startsWith("javascript:"))
        return false;
    if (lower.startsWith("data:")) {
        return attrName === "src" || attrName === "xlink:href";
    }
    if (/^[a-z][a-z0-9+.+-]*:/.test(trimmed)) {
        return lower.startsWith("http:") || lower.startsWith("https:") || lower.startsWith("mailto:") || lower.startsWith("tel:");
    }
    return true;
}
function sanitiseNode(node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node;
        const tagName = element.tagName.toUpperCase();
        if (UNSAFE_ELEMENT_NAMES.has(tagName)) {
            element.remove();
            return;
        }
        Array.from(element.attributes).forEach(attr => {
            const name = attr.name;
            const normalized = name.toLowerCase();
            const value = attr.value;
            if (normalized.startsWith("on")) {
                element.removeAttribute(name);
                return;
            }
            if (normalized === "style") {
                const lowerValue = value.toLowerCase();
                if (lowerValue.includes("expression(") || lowerValue.includes("javascript:")) {
                    element.removeAttribute(name);
                    return;
                }
            }
            if (URL_ATTRIBUTES.has(normalized)) {
                if (!isSafeUrl(value, normalized)) {
                    element.removeAttribute(name);
                }
            }
        });
    }
    let child = node.firstChild;
    while (child) {
        const next = child.nextSibling;
        sanitiseNode(child);
        child = next;
    }
}
function createHtmlFragment(html) {
    const template = document.createElement("template");
    template.innerHTML = html;
    sanitiseNode(template.content);
    return template.content;
}
function applySanitisedHtml(target, html, context) {
    if (!isEnvironmentDomCapable()) {
        target.innerHTML = html;
        return;
    }
    const fragment = target instanceof SVGElement
        ? createSvgFragment(html)
        : createHtmlFragment(html);
    const nodes = Array.from(fragment.childNodes);
    target.replaceChildren(...nodes);
    if (nodes.length === 0 && html && context && typeof console !== "undefined" && typeof console.warn === "function") {
        console.warn(`Safe HTML sanitisation removed all content for ${context}. Input may contain unsupported markup.`);
    }
}
function createSvgFragment(html) {
    if (typeof DOMParser === "undefined") {
        return createHtmlFragment(html);
    }
    const parser = new DOMParser();
    const wrapped = `<svg xmlns="http://www.w3.org/2000/svg">${html}</svg>`;
    const doc = parser.parseFromString(wrapped, "image/svg+xml");
    const fragment = document.createDocumentFragment();
    const svgRoot = doc.documentElement;
    Array.from(svgRoot.childNodes).forEach(child => {
        const imported = document.importNode(child, true);
        fragment.appendChild(imported);
    });
    sanitiseNode(fragment);
    return fragment;
}
function setElementHtml(target, html, context) {
    if (!target)
        return;
    applySanitisedHtml(target, html, context);
}
function clearElement(target) {
    if (!target)
        return;
    if (!isEnvironmentDomCapable()) {
        target.innerHTML = "";
        return;
    }
    target.replaceChildren();
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function updateSelectionHtml(selection, html, context) {
    if (!selection)
        return;
    selection.each(function updateSafeHtml() {
        applySanitisedHtml(this, html, context);
    });
}

function CardHtml$2(props) {
    const cardInner = props.style === 'default' ? cardInnerDefault
        : props.style === 'imageCircleRect' ? cardInnerImageCircleRect
            : props.style === 'imageCircle' ? cardInnerImageCircle
                : props.style === 'imageRect' ? cardInnerImageRect
                    : props.style === 'rect' ? cardInnerRect
                        : cardInnerDefault;
    return function (d) {
        setElementHtml(this, (`
    <div class="card ${getClassList(d).join(' ')}" data-id="${d.tid}" style="transform: translate(-50%, -50%); pointer-events: auto;">
      ${props.mini_tree ? getMiniTree(d) : ''}
      ${(props.cardInnerHtmlCreator && !d.data._new_rel_data) ? escapeHtml(props.cardInnerHtmlCreator(d)) : cardInner(d)}
    </div>
    `), 'CardHtml template');
        const hostSelection = d3.select(this);
        const cardSelection = hostSelection.select('.card');
        const cardNode = cardSelection.node();
        cardNode.addEventListener('click', (e) => props.onCardClick(e, d));
        if (!d.data.to_add && !d.data._new_rel_data && !d.all_rels_displayed) {
            cardNode.classList.add('card-has-hidden-relatives');
        }
        else {
            cardNode.classList.remove('card-has-hidden-relatives');
        }
        const miniTreeNode = this.querySelector('.mini-tree');
        if (miniTreeNode) {
            miniTreeNode.setAttribute('role', 'button');
            miniTreeNode.setAttribute('tabindex', '0');
            miniTreeNode.setAttribute('aria-label', 'Autres proches masqués – cliquer pour centrer');
            miniTreeNode.setAttribute('title', 'Autres proches masqués – cliquer pour centrer');
            miniTreeNode.dataset.hiddenRelatives = 'true';
            miniTreeNode.addEventListener('click', event => {
                event.stopPropagation();
                if (props.onMiniTreeClick)
                    props.onMiniTreeClick(event, d);
            });
            miniTreeNode.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    if (props.onMiniTreeClick)
                        props.onMiniTreeClick(event, d);
                }
            });
        }
        if (props.onCardUpdate)
            props.onCardUpdate.call(this, d);
        if (props.onCardMouseenter) {
            cardSelection.on('mouseenter', function (event, datum) {
                props.onCardMouseenter(event, datum);
            });
        }
        if (props.onCardMouseleave) {
            cardSelection.on('mouseleave', function (event, datum) {
                props.onCardMouseleave(event, datum);
            });
        }
        if (d.duplicate)
            handleCardDuplicateHover(this, d);
        if (location.origin.includes('localhost')) {
            d.__node = this.querySelector('.card');
            const labelValue = d.data.data['first name'];
            d.__label = typeof labelValue === 'string' ? labelValue : undefined;
            if (d.data.to_add) {
                const spouse = d.spouse || d.coparent || null;
                if (spouse) {
                    const spouseName = spouse.data.data['first name'];
                    if (typeof spouseName === 'string') {
                        cardSelection.attr('data-to-add', spouseName);
                    }
                }
            }
        }
    };
    function getCardInnerImageCircle(d) {
        return (`
    <div class="card-inner card-image-circle" ${getCardStyle()}>
  ${getCardImageMarkup(d)}
      <div class="card-label">${textDisplay(d)}</div>
      ${d.duplicate ? getCardDuplicateTag(d) : ''}
    </div>
    `);
    }
    function getCardInnerImageRect(d) {
        return (`
    <div class="card-inner card-image-rect" ${getCardStyle()}>
  ${getCardImageMarkup(d)}
      <div class="card-label">${textDisplay(d)}</div>
      ${d.duplicate ? getCardDuplicateTag(d) : ''}
    </div>
    `);
    }
    function getCardInnerRect(d) {
        return (`
    <div class="card-inner card-rect" ${getCardStyle()}>
      ${textDisplay(d)}
      ${d.duplicate ? getCardDuplicateTag(d) : ''}
    </div>
    `);
    }
    function textDisplay(d) {
        if (d.data._new_rel_data)
            return newRelDataDisplay(d);
        if (d.data.to_add)
            return `<div>${escapeHtml(props.empty_card_label || 'À AJOUTER')}</div>`;
        if (d.data.unknown)
            return `<div>${escapeHtml(props.unknown_card_label || 'INCONNU')}</div>`;
        const baseRows = props.card_display.map(display => `<div>${escapeHtml(display(d.data))}</div>`).join('');
        return baseRows;
    }
    function newRelDataDisplay(d) {
        const relData = d.data._new_rel_data;
        if (!relData)
            return '';
        const attr_list = [];
        attr_list.push(`data-rel-type="${relData.rel_type}"`);
        if (['son', 'daughter'].includes(relData.rel_type) && relData.other_parent_id)
            attr_list.push(`data-other-parent-id="${relData.other_parent_id}"`);
        const rawLabel = relData.label || '';
        const sanitized = sanitizeLabel(rawLabel);
        return `<div ${attr_list.join(' ')}>${escapeHtml(sanitized)}</div>`;
    }
    function getMiniTree(d) {
        if (!props.mini_tree)
            return '';
        if (d.data.to_add)
            return '';
        if (d.data._new_rel_data)
            return '';
        if (d.all_rels_displayed)
            return '';
        return `<div class="mini-tree">${miniTreeSvgIcon()}</div>`;
    }
    function cardInnerImageCircleRect(d) {
        return d.data.data[props.cardImageField] ? cardInnerImageCircle(d) : cardInnerRect(d);
    }
    function cardInnerDefault(d) {
        return getCardInnerImageRect(d);
    }
    function cardInnerImageCircle(d) {
        return getCardInnerImageCircle(d);
    }
    function cardInnerImageRect(d) {
        return getCardInnerImageRect(d);
    }
    function cardInnerRect(d) {
        return getCardInnerRect(d);
    }
    function getClassList(d) {
        const class_list = [];
        if (d.data.data.gender === 'M')
            class_list.push('card-male');
        else if (d.data.data.gender === 'F')
            class_list.push('card-female');
        else
            class_list.push('card-genderless');
        class_list.push(`card-depth-${d.is_ancestry ? -d.depth : d.depth}`);
        if (d.data.main)
            class_list.push('card-main');
        if (d.data._new_rel_data)
            class_list.push('card-new-rel');
        if (d.data.to_add)
            class_list.push('card-to-add');
        if (d.data.unknown)
            class_list.push('card-unknown');
        return class_list;
    }
    function getCardStyle() {
        let style = 'style="';
        if (props.card_dim.w || props.card_dim.h) {
            style += `width: ${props.card_dim.w}px; min-height: ${props.card_dim.h}px;`;
            if (props.card_dim.height_auto)
                style += 'height: auto;';
            else
                style += `height: ${props.card_dim.h}px;`;
        }
        else {
            return '';
        }
        style += '"';
        return style;
    }
    function getCardImageStyle() {
        let style = 'style="position: relative;';
        if (props.card_dim.img_w || props.card_dim.img_h || props.card_dim.img_x || props.card_dim.img_y) {
            style += `width: ${props.card_dim.img_w}px; height: ${props.card_dim.img_h}px;`;
            style += `left: ${props.card_dim.img_x}px; top: ${props.card_dim.img_y}px;`;
        }
        else {
            return '';
        }
        style += '"';
        return style;
    }
    function noImageIcon(d) {
        if (d.data._new_rel_data)
            return `<div class="person-icon" ${getCardImageStyle()}>${plusSvgIcon()}</div>`;
        return `<div class="person-icon" ${getCardImageStyle()}>${props.defaultPersonIcon ? props.defaultPersonIcon(d) : personSvgIcon()}</div>`;
    }
    function getCardDuplicateTag(d) {
        return `<div class="f3-card-duplicate-tag">x${d.duplicate}</div>`;
    }
    function sanitizeLabel(label) {
        if (!label)
            return '';
        return label
            .replace(/\s*\([^)]*\)/g, ' ')
            .replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g, ' ')
            .replace(/\b\d{4}\b/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }
    function handleCardDuplicateHover(node, d) {
        d3.select(node).on('mouseenter', () => {
            d3.select(node.closest('.cards_view')).selectAll('.card_cont').select('.card').classed('f3-card-duplicate-hover', function (d0) { return d0.data.id === d.data.id; });
        });
        d3.select(node).on('mouseleave', () => {
            d3.select(node.closest('.cards_view')).selectAll('.card_cont').select('.card').classed('f3-card-duplicate-hover', false);
        });
    }
    function getCardImageMarkup(d) {
        const imageValue = d.data.data[props.cardImageField];
        const imageSrc = typeof imageValue === 'string' ? imageValue : undefined;
        if (imageSrc && isSafeImageSrc(imageSrc)) {
            return `<img loading="lazy" decoding="async" src="${escapeHtml(imageSrc)}" ${getCardImageStyle()}>`;
        }
        return noImageIcon(d);
    }
}

function processCardDisplay(card_display) {
    const card_display_arr = [];
    const normalizeValue = (value) => {
        if (value === null || value === undefined)
            return "";
        return String(value);
    };
    if (Array.isArray(card_display)) {
        card_display.forEach(d => {
            if (typeof d === 'function') {
                card_display_arr.push(d);
            }
            else if (typeof d === 'string') {
                card_display_arr.push((d1) => normalizeValue(d1.data[d]));
            }
            else if (Array.isArray(d)) {
                card_display_arr.push((d1) => d.map(key => normalizeValue(d1.data[key])).join(' ').trim());
            }
        });
    }
    else if (typeof card_display === 'function') {
        card_display_arr.push(card_display);
    }
    else if (typeof card_display === 'string') {
        card_display_arr.push((d1) => normalizeValue(d1.data[card_display]));
    }
    return card_display_arr;
}

function pathToMain(cards, links, datum, main_datum) {
    const is_ancestry = datum.is_ancestry;
    const links_data = links.data();
    const links_node_to_main = [];
    const cards_node_to_main = [];
    if (is_ancestry) {
        const links_to_main = [];
        let parent = datum;
        let itteration1 = 0;
        while (parent !== main_datum && itteration1 < 100) {
            itteration1++; // to prevent infinite loop
            const spouse_link = links_data.find(d => d.spouse === true && (d.source === parent || d.target === parent));
            if (spouse_link) {
                const child_links = links_data.filter(d => Array.isArray(d.target) && d.target.includes(spouse_link.source) && d.target.includes(spouse_link.target));
                const child_link = getChildLinkFromAncestrySide(child_links, main_datum);
                if (!child_link)
                    break;
                links_to_main.push(spouse_link);
                links_to_main.push(child_link);
                parent = child_link.source;
            }
            else {
                const child_links = links_data.filter(d => Array.isArray(d.target) && d.target.includes(parent));
                const child_link = getChildLinkFromAncestrySide(child_links, main_datum);
                if (!child_link)
                    break;
                links_to_main.push(child_link);
                parent = child_link.source;
            }
        }
        links.each(function (d) {
            if (links_to_main.includes(d)) {
                links_node_to_main.push({ link: d, node: this });
            }
        });
        const cards_to_main = getCardsToMain(datum, links_to_main);
        cards.each(function (d) {
            if (cards_to_main.includes(d)) {
                cards_node_to_main.push({ card: d, node: this });
            }
        });
    }
    else if (datum.spouse && datum.spouse.data === main_datum.data) {
        links.each(function (d) {
            if (d.target === datum)
                links_node_to_main.push({ link: d, node: this });
        });
        const cards_to_main = [main_datum, datum];
        cards.each(function (d) {
            if (cards_to_main.includes(d)) {
                cards_node_to_main.push({ card: d, node: this });
            }
        });
    }
    else if (datum.sibling) {
        links.each(function (d) {
            if (!Array.isArray(datum.parents))
                throw new Error('datum.parents is not an array');
            if (d.source === datum)
                links_node_to_main.push({ link: d, node: this });
            if (d.source === main_datum && Array.isArray(d.target) && d.target.length === 2)
                links_node_to_main.push({ link: d, node: this });
            if (datum.parents.includes(d.source) && !Array.isArray(d.target) && datum.parents.includes(d.target))
                links_node_to_main.push({ link: d, node: this });
        });
        const cards_to_main = [main_datum, datum, ...(datum.parents || [])];
        cards.each(function (d) {
            if (cards_to_main.includes(d)) {
                cards_node_to_main.push({ card: d, node: this });
            }
        });
    }
    else {
        const links_to_main = [];
        let child = datum;
        let itteration1 = 0;
        while (child !== main_datum && itteration1 < 100) {
            itteration1++; // to prevent infinite loop
            const child_link = links_data.find(d => d.target === child && Array.isArray(d.source));
            if (child_link) {
                const spouse_link = links_data.find(d => {
                    if (d.spouse !== true)
                        return false;
                    if (Array.isArray(d.source) || Array.isArray(d.target))
                        return false;
                    const spousePair = [d.source, d.target];
                    return sameArray(spousePair, child_link.source);
                });
                links_to_main.push(child_link);
                links_to_main.push(spouse_link);
                if (spouse_link)
                    child = spouse_link.source;
                else
                    child = child_link.source[0];
            }
            else {
                const spouse_link = links_data.find(d => d.target === child && !Array.isArray(d.source)); // spouse link
                if (!spouse_link)
                    break;
                links_to_main.push(spouse_link);
                child = spouse_link.source;
            }
        }
        links.each(function (d) {
            if (links_to_main.includes(d)) {
                links_node_to_main.push({ link: d, node: this });
            }
        });
        const cards_to_main = getCardsToMain(main_datum, links_to_main);
        cards.each(function (d) {
            if (cards_to_main.includes(d)) {
                cards_node_to_main.push({ card: d, node: this });
            }
        });
    }
    return { cards_node_to_main, links_node_to_main };
    function sameArray(arr1, arr2) {
        return arr1.every(d1 => arr2.some(d2 => d1 === d2));
    }
    function getCardsToMain(first_parent, links_to_main) {
        const all_cards = links_to_main.filter(d => d).reduce((acc, d) => {
            if (Array.isArray(d.target))
                acc.push(...d.target);
            else
                acc.push(d.target);
            if (Array.isArray(d.source))
                acc.push(...d.source);
            else
                acc.push(d.source);
            return acc;
        }, []);
        const cards_to_main = [main_datum, datum];
        getChildren(first_parent);
        return cards_to_main;
        function getChildren(d) {
            if (d.data.rels.children) {
                d.data.rels.children.forEach(child_id => {
                    const child = all_cards.find(d0 => d0.data.id === child_id);
                    if (child) {
                        cards_to_main.push(child);
                        getChildren(child);
                    }
                });
            }
        }
    }
    function getChildLinkFromAncestrySide(child_links, main_datum) {
        if (child_links.length === 0)
            return null;
        else if (child_links.length === 1)
            return child_links[0];
        else {
            return child_links.find(d => d.source === main_datum);
        }
    }
}

function CardHtmlWrapper(cont, store) { return new CardHtml$1(cont, store); }
let CardHtml$1 = class CardHtml {
    constructor(cont, store) {
        this.cont = cont;
        this.svg = this.cont.querySelector('svg.main_svg');
        this.store = store;
        this.card_display = [(d) => `${d.data["first name"]} ${d.data["last name"]}`];
        this.cardImageField = 'avatar';
        this.onCardClick = this.onCardClickDefault.bind(this);
        this.onMiniTreeClick = this.onMiniTreeClickDefault.bind(this);
        this.style = 'default';
        this.mini_tree = false;
        this.card_dim = {};
        return this;
    }
    static normalizeDimKey(key) {
        const aliases = {
            width: 'w',
            height: 'h',
            img_width: 'img_w',
            img_height: 'img_h'
        };
        const normalized = aliases[key] || key;
        if (['w', 'h', 'text_x', 'text_y', 'img_w', 'img_h', 'img_x', 'img_y'].includes(normalized)) {
            return normalized;
        }
        if (normalized === 'height_auto')
            return 'height_auto';
        return null;
    }
    getCard() {
        return CardHtml$2({
            store: this.store,
            card_display: this.card_display,
            cardImageField: this.cardImageField,
            defaultPersonIcon: this.defaultPersonIcon,
            onCardClick: this.onCardClick,
            onMiniTreeClick: this.onMiniTreeClick,
            style: this.style,
            mini_tree: this.mini_tree,
            onCardUpdate: this.onCardUpdate,
            card_dim: this.card_dim,
            empty_card_label: this.store.state.single_parent_empty_card_label || '',
            unknown_card_label: this.store.state.unknown_card_label || '',
            cardInnerHtmlCreator: this.cardInnerHtmlCreator,
            onCardMouseenter: this.onCardMouseenter ? this.onCardMouseenter.bind(this) : undefined,
            onCardMouseleave: this.onCardMouseleave ? this.onCardMouseleave.bind(this) : undefined
        });
    }
    setCardDisplay(card_display) {
        this.card_display = processCardDisplay(card_display);
        return this;
    }
    setCardImageField(cardImageField) {
        this.cardImageField = cardImageField;
        return this;
    }
    setDefaultPersonIcon(defaultPersonIcon) {
        this.defaultPersonIcon = defaultPersonIcon;
        return this;
    }
    setOnCardClick(onCardClick) {
        this.onCardClick = onCardClick;
        return this;
    }
    setOnMiniTreeClick(onMiniTreeClick) {
        this.onMiniTreeClick = onMiniTreeClick;
        return this;
    }
    onCardClickDefault(_event, d) {
        this.store.updateMainId(d.data.id);
        this.store.updateTree({});
    }
    onMiniTreeClickDefault(_event, d) {
        this.store.updateMainId(d.data.id);
        this.store.updateTree({ tree_position: 'main_to_middle' });
    }
    setStyle(style) {
        this.style = style;
        return this;
    }
    setMiniTree(mini_tree) {
        this.mini_tree = mini_tree;
        return this;
    }
    setOnCardUpdate(onCardUpdate) {
        this.onCardUpdate = onCardUpdate;
        return this;
    }
    setCardDim(card_dim) {
        if (!card_dim || typeof card_dim !== 'object') {
            console.error('card_dim must be an object');
            return this;
        }
        Object.entries(card_dim).forEach(([rawKey, val]) => {
            const key = CardHtml.normalizeDimKey(rawKey);
            if (!key)
                return;
            if (key === 'height_auto') {
                if (typeof val !== 'boolean') {
                    console.error(`card_dim.${rawKey} must be a boolean`);
                    return;
                }
                this.card_dim.height_auto = val;
            }
            else {
                if (typeof val !== 'number') {
                    console.error(`card_dim.${rawKey} must be a number`);
                    return;
                }
                this.card_dim[key] = val;
            }
        });
        return this;
    }
    resetCardDim() {
        this.card_dim = {};
        return this;
    }
    setCardInnerHtmlCreator(cardInnerHtmlCreator) {
        this.cardInnerHtmlCreator = cardInnerHtmlCreator;
        return this;
    }
    setOnHoverPathToMain() {
        this.onCardMouseenter = this.onEnterPathToMain.bind(this);
        this.onCardMouseleave = this.onLeavePathToMain.bind(this);
        return this;
    }
    unsetOnHoverPathToMain() {
        this.onCardMouseenter = undefined;
        this.onCardMouseleave = undefined;
        return this;
    }
    onEnterPathToMain(_event, datum) {
        this.to_transition = datum.data.id;
        const main_datum = this.store.getTreeMainDatum();
        const cards = d3.select(this.cont).select('div.cards_view').selectAll('.card_cont');
        const links = d3.select(this.cont).select('svg.main_svg .links_view').selectAll('.link');
        const { cards_node_to_main, links_node_to_main } = pathToMain(cards, links, datum, main_datum);
        cards_node_to_main.forEach(d => {
            const delay = Math.abs(datum.depth - d.card.depth) * 200;
            d3.select(d.node.querySelector('div.card-inner'))
                .transition().duration(0).delay(delay)
                .on('end', () => this.to_transition === datum.data.id && d3.select(d.node.querySelector('div.card-inner')).classed('f3-path-to-main', true));
        });
        links_node_to_main.forEach(d => {
            const delay = Math.abs(datum.depth - d.link.depth) * 200;
            d3.select(d.node)
                .transition().duration(0).delay(delay)
                .on('end', () => this.to_transition === datum.data.id && d3.select(d.node).classed('f3-path-to-main', true));
        });
        return this;
    }
    onLeavePathToMain() {
        this.to_transition = false;
        d3.select(this.cont).select('div.cards_view').selectAll('div.card-inner').classed('f3-path-to-main', false);
        d3.select(this.cont).select('svg.main_svg .links_view').selectAll('.link').classed('f3-path-to-main', false);
        return this;
    }
};

function CardBody({ d, card_dim, card_display }) {
    return { template: (`
    <g class="card-body">
      <rect width="${card_dim.w}" height="${card_dim.h}" class="card-body-rect" />
      ${CardText({ d, card_dim, card_display }).template}
    </g>
  `)
    };
}
function CardBodyAddNewRel({ card_dim, label }) {
    return { template: (`
    <g class="card-body">
      <rect class="card-body-rect" width="${card_dim.w}" height="${card_dim.h}" />
      <text transform="translate(${card_dim.img_w + 5}, ${card_dim.h / 2})">
        <tspan font-size="18" dy="${8}" pointer-events="none">${escapeHtml(label)}</tspan>
      </text>
    </g>
  `)
    };
}
function CardText({ d, card_dim, card_display }) {
    return { template: (`
    <g>
      <g class="card-text" clip-path="url(#card_text_clip)">
        <g transform="translate(${card_dim.text_x}, ${card_dim.text_y})">
          <text>
            ${Array.isArray(card_display) ? card_display.map(cd => `<tspan x="${0}" dy="${14}">${escapeHtml(cd(d.data))}</tspan>`).join('\n') : escapeHtml(card_display(d.data))}
          </text>
        </g>
      </g>
      <rect width="${card_dim.w - 10}" height="${card_dim.h}" style="mask: url(#fade)" class="text-overflow-mask" /> 
    </g>
  `)
    };
}
function CardBodyOutline({ d, card_dim, is_new }) {
    return { template: (`
    <rect width="${card_dim.w}" height="${card_dim.h}" rx="4" ry="4" class="card-outline ${(d.data.main && !is_new) ? 'card-main-outline' : ''} ${is_new ? 'card-new-outline' : ''}" />
  `)
    };
}
function MiniTree({ card_dim }) {
    return ({ template: (`
    <g class="card_family_tree" style="cursor: pointer">
      <rect x="-31" y="-25" width="72" height="15" fill="rgba(0,0,0,0)"></rect>
      <g transform="translate(${card_dim.w * .8},6)scale(.9)">
        <rect x="-31" y="-25" width="72" height="15" fill="rgba(0,0,0,0)"></rect>
        <line y2="-17.5" stroke="#fff" />
        <line x1="-20" x2="20" y1="-17.5" y2="-17.5" stroke="#fff" />
        <rect x="-31" y="-25" width="25" height="15" rx="5" ry="5" class="card-male" />
        <rect x="6" y="-25" width="25" height="15" rx="5" ry="5" class="card-female" />
      </g>
    </g>
  `) });
}
function CardImage({ d, image, card_dim, maleIcon, femaleIcon }) {
    return ({ template: (`
    <g style="transform: translate(${card_dim.img_x}px,${card_dim.img_y}px);" class="card_image" clip-path="url(#card_image_clip)">
      ${image && isSafeImageSrc(image)
            ? `<image href="${escapeHtml(image)}" height="${card_dim.img_h}" width="${card_dim.img_w}" preserveAspectRatio="xMidYMin slice" />`
            : (d.data.data.gender === "F" && false) ? femaleIcon({ card_dim })
                : (d.data.data.gender === "M" && false) ? maleIcon({ card_dim })
                    : GenderlessIcon()}      
    </g>
  `) });
    function GenderlessIcon() {
        return (`
      <g class="genderless-icon">
        <rect height="${card_dim.img_h}" width="${card_dim.img_w}" fill="rgb(59, 85, 96)" />
        <g transform="scale(${card_dim.img_w * 0.001616})">
         <path transform="translate(50,40)" fill="lightgrey" d="M256 288c79.5 0 144-64.5 144-144S335.5 0 256 0 112 
            64.5 112 144s64.5 144 144 144zm128 32h-55.1c-22.2 10.2-46.9 16-72.9 16s-50.6-5.8-72.9-16H128C57.3 320 0 377.3 
            0 448v16c0 26.5 21.5 48 48 48h416c26.5 0 48-21.5 48-48v-16c0-70.7-57.3-128-128-128z" />
        </g>
      </g>
    `);
    }
}
function appendTemplate(template, parent, is_first) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", 'g');
    setElementHtml(g, template, 'CardSvg template fragment');
    if (is_first)
        parent.insertBefore(g, parent.firstChild);
    else
        parent.appendChild(g);
}

function cardChangeMain(store, { d }) {
    store.updateMainId(d.data.id);
    store.updateTree({});
    return true;
}

const CardElements = {
    miniTree,
    cardBody,
    cardImage
};
function miniTree(d, props) {
    if (d.data.to_add)
        return;
    const card_dim = props.card_dim;
    if (d.all_rels_displayed)
        return;
    const g = d3.create('svg:g');
    updateSelectionHtml(g, MiniTree({ card_dim }).template, 'CardSvg mini tree');
    g.on("click", function (e) {
        e.stopPropagation();
        if (props.onMiniTreeClick)
            props.onMiniTreeClick.call(this, e, d);
        else
            cardChangeMain(props.store, { d });
    });
    return g.node();
}
function cardBody(d, props) {
    const card_dim = props.card_dim;
    const g = d3.create('svg:g');
    updateSelectionHtml(g, CardBody({ d, card_dim, card_display: props.card_display }).template, 'CardSvg body');
    g.on("click", function (e) {
        e.stopPropagation();
        if (props.onCardClick)
            props.onCardClick.call(this, e, d);
        else
            cardChangeMain(props.store, { d });
    });
    return g.node();
}
function cardImage(d, props) {
    if (d.data.to_add)
        return;
    const card_dim = props.card_dim;
    const avatar = typeof d.data.data.avatar === "string" ? d.data.data.avatar : "";
    const g = d3.create('svg:g');
    updateSelectionHtml(g, CardImage({ d, image: avatar, card_dim, maleIcon: undefined, femaleIcon: undefined }).template, 'CardSvg image');
    return g.node();
}
function appendElement(el_maybe, parent, is_first = false) {
    if (!el_maybe)
        return;
    if (is_first)
        parent.insertBefore(el_maybe, parent.firstChild);
    else
        parent.appendChild(el_maybe);
}

function setupCardSvgDefs(svg, card_dim) {
    if (svg.querySelector("defs#f3CardDef"))
        return;
    const safeW = Number.isFinite(Number(card_dim.w)) ? Math.max(0, Math.floor(Number(card_dim.w))) : 0;
    const safeH = Number.isFinite(Number(card_dim.h)) ? Math.max(0, Math.floor(Number(card_dim.h))) : 0;
    const safeImgW = Number.isFinite(Number(card_dim.img_w)) ? Math.max(0, Math.floor(Number(card_dim.img_w))) : 0;
    const safeImgH = Number.isFinite(Number(card_dim.img_h)) ? Math.max(0, Math.floor(Number(card_dim.img_h))) : 0;
    const svgns = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(svgns, 'defs');
    defs.setAttribute('id', 'f3CardDef');
    const linear = document.createElementNS(svgns, 'linearGradient');
    linear.setAttribute('id', 'fadeGrad');
    const stop1 = document.createElementNS(svgns, 'stop');
    stop1.setAttribute('offset', '0.9');
    stop1.setAttribute('stop-color', 'white');
    stop1.setAttribute('stop-opacity', '0');
    const stop2 = document.createElementNS(svgns, 'stop');
    stop2.setAttribute('offset', '.91');
    stop2.setAttribute('stop-color', 'white');
    stop2.setAttribute('stop-opacity', '0.5');
    const stop3 = document.createElementNS(svgns, 'stop');
    stop3.setAttribute('offset', '1');
    stop3.setAttribute('stop-color', 'white');
    stop3.setAttribute('stop-opacity', '1');
    linear.appendChild(stop1);
    linear.appendChild(stop2);
    linear.appendChild(stop3);
    const mask = document.createElementNS(svgns, 'mask');
    mask.setAttribute('id', 'fade');
    mask.setAttribute('maskContentUnits', 'objectBoundingBox');
    const maskRect = document.createElementNS(svgns, 'rect');
    maskRect.setAttribute('width', '1');
    maskRect.setAttribute('height', '1');
    maskRect.setAttribute('fill', 'url(#fadeGrad)');
    mask.appendChild(maskRect);
    const clipCard = document.createElementNS(svgns, 'clipPath');
    clipCard.setAttribute('id', 'card_clip');
    const clipCardPath = document.createElementNS(svgns, 'path');
    clipCardPath.setAttribute('d', curvedRectPath({ w: safeW, h: safeH }, 5));
    clipCard.appendChild(clipCardPath);
    const clipText = document.createElementNS(svgns, 'clipPath');
    clipText.setAttribute('id', 'card_text_clip');
    const clipTextRect = document.createElementNS(svgns, 'rect');
    clipTextRect.setAttribute('width', String(Math.max(0, safeW - 10)));
    clipTextRect.setAttribute('height', String(safeH));
    clipText.appendChild(clipTextRect);
    const clipImage = document.createElementNS(svgns, 'clipPath');
    clipImage.setAttribute('id', 'card_image_clip');
    const clipImagePath = document.createElementNS(svgns, 'path');
    clipImagePath.setAttribute('d', `M0,0 Q 0,0 0,0 H${safeImgW} V${safeImgH} H0 Q 0,${safeImgH} 0,${safeImgH} z`);
    clipImage.appendChild(clipImagePath);
    const clipImageCurved = document.createElementNS(svgns, 'clipPath');
    clipImageCurved.setAttribute('id', 'card_image_clip_curved');
    const clipImageCurvedPath = document.createElementNS(svgns, 'path');
    clipImageCurvedPath.setAttribute('d', curvedRectPath({ w: safeImgW, h: safeImgH }, 5, ['rx', 'ry']));
    clipImageCurved.appendChild(clipImageCurvedPath);
    defs.appendChild(linear);
    defs.appendChild(mask);
    defs.appendChild(clipCard);
    defs.appendChild(clipText);
    defs.appendChild(clipImage);
    defs.appendChild(clipImageCurved);
    svg.insertBefore(defs, svg.firstChild);
    function curvedRectPath(dim, curve, no_curve_corners) {
        const { w, h } = dim, c = curve, ncc = no_curve_corners || [], ncc_check = (corner) => ncc.includes(corner), lx = ncc_check('lx') ? `M0,0` : `M0,${c} Q 0,0 5,0`, rx = ncc_check('rx') ? `H${w}` : `H${w - c} Q ${w},0 ${w},5`, ry = ncc_check('ry') ? `V${h}` : `V${h - c} Q ${w},${h} ${w - c},${h}`, ly = ncc_check('ly') ? `H0` : `H${c} Q 0,${h} 0,${h - c}`;
        return (`${lx} ${rx} ${ry} ${ly} z`);
    }
}
function updateCardSvgDefs(svg, card_dim) {
    if (svg.querySelector("defs#f3CardDef")) {
        svg.querySelector("defs#f3CardDef").remove();
    }
    setupCardSvgDefs(svg, card_dim);
}

function CardSvg$2(props) {
    props = setupProps(props);
    setupCardSvgDefs(props.svg, props.card_dim);
    return function (d) {
        var _a, _b;
        const gender_class = d.data.data.gender === 'M' ? 'card-male' : d.data.data.gender === 'F' ? 'card-female' : 'card-genderless';
        const card_dim = props.card_dim;
        const card = d3.create('svg:g').attr('class', `card ${gender_class}`).attr('transform', `translate(${[-card_dim.w / 2, -card_dim.h / 2]})`);
        card.append('g').attr('class', 'card-inner').attr('clip-path', 'url(#card_clip)');
        clearElement(this);
        this.appendChild(card.node());
        card.on("click", function (e) {
            e.stopPropagation();
            props.onCardClick.call(this, e, d);
        });
        if (d.data._new_rel_data) {
            appendTemplate(CardBodyOutline({ d, card_dim, is_new: Boolean(d.data.to_add) }).template, card.node(), true);
            const newRelLabel = (_b = (_a = d.data._new_rel_data) === null || _a === void 0 ? void 0 : _a.label) !== null && _b !== void 0 ? _b : '';
            appendTemplate(CardBodyAddNewRel({ card_dim, label: newRelLabel }).template, this.querySelector('.card-inner'), true);
            const editIcon = d3.select(this.querySelector('.card-inner'))
                .append('g')
                .attr('class', 'card-edit-icon')
                .attr('fill', 'currentColor')
                .attr('transform', `translate(-1,2)scale(${card_dim.img_h / 22})`);
            updateSelectionHtml(editIcon, plusIcon(), 'CardSvg add relative icon');
        }
        else {
            appendTemplate(CardBodyOutline({ d, card_dim, is_new: Boolean(d.data.to_add) }).template, card.node(), true);
            appendTemplate(CardBody({ d, card_dim, card_display: props.card_display }).template, this.querySelector('.card-inner'), false);
            if (props.img)
                appendElement(CardElements.cardImage(d, props), this.querySelector('.card'));
            if (props.mini_tree)
                appendElement(CardElements.miniTree(d, props), this.querySelector('.card'), true);
        }
        if (props.onCardUpdate)
            props.onCardUpdate.call(this, d);
    };
    function setupProps(props) {
        const defaultProps = {
            img: true,
            mini_tree: true,
            link_break: false,
            card_dim: { w: 220, h: 70, text_x: 75, text_y: 15, img_w: 60, img_h: 60, img_x: 5, img_y: 5 }
        };
        return Object.assign(Object.assign({}, defaultProps), props);
    }
}
function Card(props) {
    if (props.onCardClick === undefined)
        props.onCardClick = (_event, d) => {
            props.store.updateMainId(d.data.id);
            props.store.updateTree({});
        };
    return CardSvg$2(props);
}

function CardSvgWrapper(cont, store) { return new CardSvg$1(cont, store); }
let CardSvg$1 = class CardSvg {
    constructor(cont, store) {
        this.cont = cont;
        this.store = store;
        this.svg = this.cont.querySelector('svg.main_svg');
        this.card_dim = { w: 220, h: 70, text_x: 75, text_y: 15, img_w: 60, img_h: 60, img_x: 5, img_y: 5 };
        this.card_display = [];
        this.mini_tree = true;
        this.link_break = false;
        this.onCardClick = this.onCardClickDefault.bind(this);
        return this;
    }
    getCard() {
        return CardSvg$2({
            store: this.store,
            svg: this.svg,
            card_dim: this.card_dim,
            card_display: this.card_display,
            mini_tree: this.mini_tree,
            link_break: this.link_break,
            onCardClick: this.onCardClick,
            onCardUpdate: this.onCardUpdate
        });
    }
    setCardDisplay(card_display) {
        this.card_display = processCardDisplay(card_display);
        return this;
    }
    setCardDim(card_dim) {
        if (typeof card_dim !== 'object') {
            console.error('card_dim must be an object');
            return this;
        }
        for (let key in card_dim) {
            const val = card_dim[key];
            if (typeof val !== 'number' && typeof val !== 'boolean') {
                console.error(`card_dim.${key} must be a number or boolean`);
                return this;
            }
            if (key === 'width')
                key = 'w';
            if (key === 'height')
                key = 'h';
            if (key === 'img_width')
                key = 'img_w';
            if (key === 'img_height')
                key = 'img_h';
            if (key === 'img_x')
                key = 'img_x';
            if (key === 'img_y')
                key = 'img_y';
            this.card_dim[key] = val;
        }
        updateCardSvgDefs(this.svg, this.card_dim);
        return this;
    }
    setOnCardUpdate(onCardUpdate) {
        this.onCardUpdate = onCardUpdate;
        return this;
    }
    setMiniTree(mini_tree) {
        this.mini_tree = mini_tree;
        return this;
    }
    setLinkBreak(link_break) {
        this.link_break = link_break;
        return this;
    }
    onCardClickDefault(_event, d) {
        this.store.updateMainId(d.data.id);
        this.store.updateTree({});
    }
    setOnCardClick(onCardClick) {
        this.onCardClick = onCardClick;
        return this;
    }
};

const DEFAULT_TRANSITION_TIME = 2000;
const DEFAULT_EASING = d3.easeCubicInOut;
function getTransitionConfig(transition_time = DEFAULT_TRANSITION_TIME, delay = 0) {
    return {
        duration: transition_time,
        ease: DEFAULT_EASING,
        delay: delay,
    };
}
function applyTransition(selection, config) {
    return selection
        .transition()
        .duration(config.duration)
        .delay(config.delay || 0)
        .ease(config.ease);
}

function positionTree({ t, svg, transition_time = 2000 }) {
    const el_listener = getZoomListener(svg);
    const zoomObj = el_listener.__zoomObj;
    const sel = d3.select(el_listener);
    const delay = transition_time ? 100 : 0;
    const config = getTransitionConfig(transition_time !== null && transition_time !== void 0 ? transition_time : 0, delay);
    const tr = applyTransition(sel, config);
    const targetTransform = d3.zoomIdentity.scale(t.k).translate(t.x, t.y);
    zoomObj.transform(tr, targetTransform);
}
function treeFit({ svg, svg_dim, tree_dim, transition_time }) {
    const t = calculateTreeFit(svg_dim, tree_dim);
    positionTree({ t, svg, transition_time });
}
function calculateTreeFit(svg_dim, tree_dim) {
    const width_scale = tree_dim.width > 0 ? svg_dim.width / tree_dim.width : Infinity;
    const height_scale = tree_dim.height > 0 ? svg_dim.height / tree_dim.height : Infinity;
    let k = Math.min(width_scale, height_scale, 1);
    if (!Number.isFinite(k) || k <= 0)
        k = 1;
    const stabiliseRange = (min, max) => {
        if (!Number.isFinite(min) || !Number.isFinite(max)) {
            return { min: 0, max: 0 };
        }
        if (min > max) {
            const mid = (min + max) / 2;
            return { min: mid, max: mid };
        }
        return { min, max };
    };
    const withOverscroll = (desired, min, max, viewportSize) => {
        const overscroll = viewportSize * 0.25;
        if (desired < min) {
            return Math.max(desired, min - overscroll);
        }
        if (desired > max) {
            return Math.min(desired, max + overscroll);
        }
        return desired;
    };
    const txRange = stabiliseRange(-k * tree_dim.min_x, svg_dim.width - k * tree_dim.max_x);
    const desired_tx = svg_dim.width / 2 - k * tree_dim.center_x;
    const tx = withOverscroll(desired_tx, txRange.min, txRange.max, svg_dim.width);
    const tyRange = stabiliseRange(-k * tree_dim.min_y, svg_dim.height - k * tree_dim.max_y);
    const desired_ty = svg_dim.height / 2 - k * tree_dim.center_y;
    const ty = withOverscroll(desired_ty, tyRange.min, tyRange.max, svg_dim.height);
    const x = tx / k;
    const y = ty / k;
    return { k, x, y };
}
function cardToMiddle({ datum, svg, svg_dim, scale, transition_time }) {
    const k = scale || 1, x = svg_dim.width / 2 - datum.x * k, y = svg_dim.height / 2 - datum.y, t = { k, x: x / k, y: y / k };
    positionTree({ t, svg, transition_time });
}
function manualZoom({ amount, svg, transition_time = 500 }) {
    const el_listener = getZoomListener(svg);
    const zoomObj = el_listener.__zoomObj;
    if (!zoomObj)
        throw new Error('Zoom object not found');
    const sel = d3.select(el_listener);
    const delay = transition_time ? 100 : 0;
    const config = getTransitionConfig(transition_time !== null && transition_time !== void 0 ? transition_time : 0, delay);
    const tr = applyTransition(sel, config);
    zoomObj.scaleBy(tr, amount);
}
function getCurrentZoom(svg) {
    const el_listener = getZoomListener(svg);
    const currentTransform = d3.zoomTransform(el_listener);
    return currentTransform;
}
function zoomTo(svg, zoom_level) {
    const el_listener = getZoomListener(svg);
    const currentTransform = d3.zoomTransform(el_listener);
    manualZoom({ amount: zoom_level / currentTransform.k, svg });
}
function getZoomListener(svg) {
    const svgHost = svg;
    if (svgHost.__zoomObj)
        return svgHost;
    const parent = svg.parentNode;
    if (parent && parent instanceof Element) {
        const parentHost = parent;
        if (parentHost.__zoomObj) {
            return parentHost;
        }
    }
    throw new Error('Zoom object not found');
}
function setupZoom(el, props = {}) {
    const zoomableEl = el;
    if (zoomableEl.__zoom)
        return;
    const view = el.querySelector('.view');
    if (!view)
        throw new Error('Zoom view container not found');
    const zoomBehavior = d3.zoom().on("zoom", props.onZoom || zoomed);
    const sel = d3.select(el);
    zoomBehavior(sel);
    zoomableEl.__zoomObj = zoomBehavior;
    if (props.zoom_polite)
        zoomBehavior.filter(zoomFilter);
    function zoomed(e) {
        d3.select(view).attr("transform", e.transform.toString());
    }
    function zoomFilter(e) {
        if (e.type === "wheel" && !e.ctrlKey)
            return false;
        else if (e.touches && e.touches.length < 2)
            return false;
        else
            return true;
    }
}

function createSvg(cont, props = {}) {
    const svg_dim = cont.getBoundingClientRect();
    const svg_html = (`
    <svg class="main_svg">
      <rect width="${svg_dim.width}" height="${svg_dim.height}" fill="transparent" />
      <g class="view">
        <g class="links_view"></g>
        <g class="cards_view"></g>
      </g>
      <g style="transform: translate(100%, 100%)">
        <g class="fit_screen_icon cursor-pointer" style="transform: translate(-50px, -50px); display: none">
          <rect width="27" height="27" stroke-dasharray="${27 / 2}" stroke-dashoffset="${27 / 4}" 
            style="stroke:#fff;stroke-width:4px;fill:transparent;"/>
          <circle r="5" cx="${27 / 2}" cy="${27 / 2}" style="fill:#fff" />          
        </g>
      </g>
    </svg>
  `);
    const f3Canvas = getOrCreateF3Canvas(cont);
    const temp_div = d3.create('div').node();
    setElementHtml(temp_div, svg_html, 'SVG renderer template');
    const svg = temp_div.querySelector('svg');
    f3Canvas.appendChild(svg);
    cont.appendChild(f3Canvas);
    setupZoom(f3Canvas, props);
    return svg;
    function getOrCreateF3Canvas(cont) {
        let f3Canvas = cont.querySelector('#f3Canvas');
        if (!f3Canvas) {
            f3Canvas = d3.create('div').attr('id', 'f3Canvas').attr('style', 'position: relative; overflow: hidden; width: 100%; height: 100%;').node();
        }
        return f3Canvas;
    }
}

function htmlContSetup(cont) {
    const getSvgView = () => cont.querySelector('svg .view');
    const getHtmlView = () => cont.querySelector('#htmlSvg .cards_view');
    createSvg(cont, { onZoom: onZoomSetup(getSvgView, getHtmlView) });
    createHtmlSvg(cont);
    return {
        svg: cont.querySelector('svg.main_svg'),
        svgView: cont.querySelector('svg .view'),
        htmlSvg: cont.querySelector('#htmlSvg'),
        htmlView: cont.querySelector('#htmlSvg .cards_view')
    };
}
function createHtmlSvg(cont) {
    const f3Canvas = d3.select(cont).select('#f3Canvas');
    const cardHtml = f3Canvas.append('div').attr('id', 'htmlSvg')
        .attr('style', 'position: absolute; width: 100%; height: 100%; z-index: 2; top: 0; left: 0');
    cardHtml.append('div').attr('class', 'cards_view').style('transform-origin', '0 0');
    return cardHtml.node();
}
function onZoomSetup(getSvgView, getHtmlView) {
    return function onZoom(e) {
        const t = e.transform;
        d3.select(getSvgView()).style('transform', `translate(${t.x}px, ${t.y}px) scale(${t.k}) `);
        d3.select(getHtmlView()).style('transform', `translate(${t.x}px, ${t.y}px) scale(${t.k}) `);
    };
}

var htmlHandlers = /*#__PURE__*/Object.freeze({
  __proto__: null,
  createHtmlSvg: createHtmlSvg,
  default: htmlContSetup,
  onZoomSetup: onZoomSetup
});

function createNewPerson({ data, rels }) {
    return {
        id: generateUUID(),
        data: data || {},
        rels: Object.assign({ parents: [], children: [], spouses: [] }, (rels || {}))
    };
}
// addNewPerson was an internal helper previously exported, but it's not used anywhere
// and can be removed safely to reduce dead code surface.
function generateUUID() {
    let d = new Date().getTime();
    let d2 = (performance && performance.now && (performance.now() * 1000)) || 0; //Time in microseconds since page-load or 0 if unsupported
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        let r = Math.random() * 16;
        if (d > 0) { //Use timestamp until depleted
            r = (d + r) % 16 | 0;
            d = Math.floor(d / 16);
        }
        else { //Use microseconds since page-load if supported
            r = (d2 + r) % 16 | 0;
            d2 = Math.floor(d2 / 16);
        }
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

const DATE_COLLAPSED_KEYWORDS = new Set([
    "birthday",
    "birthdate",
    "birth",
    "death",
    "deathdate",
    "burial",
    "burialdate",
    "baptism",
    "baptismdate",
    "uniondate",
    "marriagedate",
    "weddingdate",
    "divorcedate",
    "engagementdate",
    "anniversary",
    "anniversarydate"
]);
const DATE_TOKEN_KEYWORDS = new Set([
    "date",
    "birth",
    "birthday",
    "death",
    "burial",
    "baptism",
    "marriage",
    "wedding",
    "union",
    "divorce",
    "engagement",
    "anniversary",
    "naissance",
    "deces"
]);
const DATE_EXCLUDED_COLLAPSED = new Set([
    "update",
    "updatedate",
    "lastupdate",
    "birthplace",
    "deathplace",
    "unionplace",
    "marriageplace",
    "weddingplace",
    "baptismplace",
    "burialplace"
]);
function normalizeFieldId(fieldId) {
    return fieldId.split("__ref__")[0].trim();
}
function collapseLetters(value) {
    return value.toLowerCase().replace(/[^a-z]/g, "");
}
function tokenizeLetters(value) {
    return value
        .toLowerCase()
        .split(/[^a-z]+/g)
        .filter(Boolean);
}
function shouldNormalizeDateField(fieldId) {
    if (!fieldId || typeof fieldId !== "string")
        return false;
    const base = normalizeFieldId(fieldId);
    if (!base)
        return false;
    const normalized = base.toLowerCase();
    if (normalized.includes("place") || normalized.includes("location"))
        return false;
    const collapsed = collapseLetters(base);
    if (!collapsed)
        return false;
    if (DATE_EXCLUDED_COLLAPSED.has(collapsed))
        return false;
    if (DATE_COLLAPSED_KEYWORDS.has(collapsed))
        return true;
    if (collapsed.endsWith("date") && !DATE_EXCLUDED_COLLAPSED.has(collapsed))
        return true;
    const tokens = tokenizeLetters(base);
    if (!tokens.length)
        return false;
    for (const token of tokens) {
        if (DATE_TOKEN_KEYWORDS.has(token))
            return true;
    }
    return false;
}
const ALLOWED_DATE_CONTENT = /^[0-9xX./\-\s]+$/;
function sanitizeDateInput(raw) {
    let value = raw.trim();
    if (!value)
        return { approx: "", payload: "" };
    let approx = "";
    const prefix = value[0];
    if (prefix === "<" || prefix === ">") {
        approx = prefix;
        value = value.slice(1).trim();
    }
    if (!value)
        return { approx, payload: "" };
    value = value.replace(/\b(?:approx|approximativement|circa|vers|env\.?|environ|ca)\b/gi, " ");
    value = value.replace(/\?/g, "X");
    if (!ALLOWED_DATE_CONTENT.test(value)) {
        value = value.replace(/[^0-9xX./\-\s]/g, " ").trim();
    }
    return { approx, payload: value };
}
function isYearToken(token) {
    if (!token)
        return false;
    if (/^[xX]{3,4}$/.test(token))
        return true;
    return /^\d{3,4}$/.test(token);
}
function normalizeDayMonthToken(token) {
    if (!token)
        return "XX";
    if (/^[xX]{1,2}$/.test(token))
        return token.toUpperCase();
    if (/^\d{1,2}$/.test(token))
        return token.padStart(2, "0");
    if (/^\d{3,}$/.test(token))
        return token.slice(0, 2).padStart(2, "0");
    return token;
}
function normalizeYearToken(token) {
    if (!token)
        return "XXXX";
    if (/^[xX]{1,4}$/.test(token)) {
        const upper = token.toUpperCase();
        if (upper.length >= 4)
            return upper.slice(0, 4);
        return upper.padEnd(4, "X");
    }
    if (/^\d{4}$/.test(token))
        return token;
    if (/^\d{1,4}$/.test(token))
        return token.padStart(4, "0").slice(-4);
    return token;
}
function fillDateParts(tokens) {
    const clean = tokens.filter(Boolean);
    const result = ["", "", ""];
    if (clean.length === 0)
        return ["", "", ""];
    if (clean.length >= 3) {
        result[0] = clean[0];
        result[1] = clean[1];
        result[2] = clean[2];
        return result;
    }
    if (clean.length === 1) {
        if (isYearToken(clean[0])) {
            result[2] = clean[0];
        }
        else {
            result[0] = clean[0];
        }
        return result;
    }
    if (clean.length === 2) {
        const [first, second] = clean;
        if (isYearToken(second)) {
            result[1] = first;
            result[2] = second;
        }
        else if (isYearToken(first)) {
            result[2] = first;
        }
        else {
            result[0] = first;
            result[1] = second;
        }
        return result;
    }
    return result;
}
function normalizeDateValue(raw) {
    if (raw === null || raw === undefined)
        return "";
    const str = typeof raw === "string" ? raw : String(raw);
    const { approx, payload } = sanitizeDateInput(str);
    if (!payload)
        return approx;
    const parts = payload.split(/[.\-/\s]+/g).filter(Boolean).map(part => part.replace(/[^0-9xX]/g, ""));
    if (parts.length === 0)
        return approx ? approx + payload : payload;
    const [dayToken, monthToken, yearToken] = (() => {
        const filled = fillDateParts(parts);
        return [filled[0], filled[1], filled[2]];
    })();
    const day = normalizeDayMonthToken(dayToken);
    const month = normalizeDayMonthToken(monthToken);
    const year = normalizeYearToken(yearToken);
    return `${approx}${day || "XX"}.${month || "XX"}.${year || "XXXX"}`;
}
function normalizeDatumDateFields(datum) {
    if (!datum || !datum.data || typeof datum.data !== "object")
        return;
    Object.entries(datum.data).forEach(([key, value]) => {
        if (typeof value !== "string")
            return;
        if (!shouldNormalizeDateField(key))
            return;
        const normalized = normalizeDateValue(value);
        datum.data[key] = normalized;
    });
}

function getBaseOrigin() {
    if (typeof window !== 'undefined' && window.location && window.location.origin)
        return window.location.origin;
    return 'http://localhost';
}
function stripOriginIfSame(rawUrl) {
    if (rawUrl === null || rawUrl === undefined)
        return '';
    const s = String(rawUrl).trim();
    if (!s)
        return '';
    try {
        const base = getBaseOrigin();
        const parsed = new URL(s, base);
        if (parsed.origin === base) {
            return `${parsed.pathname}${parsed.search}${parsed.hash}`;
        }
        return parsed.toString();
    }
    catch (_err) {
        return s;
    }
}
function looksLikeHttpUrl(rawUrl) {
    if (!rawUrl)
        return false;
    const s = String(rawUrl).trim();
    return s.startsWith('http://') || s.startsWith('https://');
}

function submitFormData(datum, data_stash, form_data) {
    form_data.forEach((value, key) => {
        if (typeof value === "string" && shouldNormalizeDateField(key)) {
            datum.data[key] = normalizeDateValue(value);
        }
        else if (typeof value === 'string' && looksLikeHttpUrl(value)) {
            datum.data[key] = stripOriginIfSame(value);
        }
        else {
            datum.data[key] = value;
        }
    });
    syncRelReference(datum, data_stash);
    if (datum.to_add)
        delete datum.to_add;
    if (datum.unknown)
        delete datum.unknown;
}
function syncRelReference(datum, data_stash) {
    Object.keys(datum.data).forEach(k => {
        if (k.includes('__ref__')) {
            const rel_id = k.split('__ref__')[1];
            const rel = data_stash.find(d => d.id === rel_id);
            if (!rel)
                return;
            const ref_field_id = k.split('__ref__')[0] + '__ref__' + datum.id;
            rel.data[ref_field_id] = datum.data[k];
        }
    });
}
function onDeleteSyncRelReference(datum, data_stash) {
    Object.keys(datum.data).forEach(k => {
        if (k.includes('__ref__')) {
            const rel_id = k.split('__ref__')[1];
            const rel = data_stash.find(d => d.id === rel_id);
            if (!rel)
                return;
            const ref_field_id = k.split('__ref__')[0] + '__ref__' + datum.id;
            delete rel.data[ref_field_id];
        }
    });
}
function removeToAdd(datum, data_stash) {
    deletePerson(datum, data_stash, false);
    return false;
}
function deletePerson(datum, data_stash, clean_to_add = true) {
    executeDelete();
    if (clean_to_add)
        removeToAddFromData(data_stash);
    return { success: true };
    function executeDelete() {
        data_stash.forEach(d => {
            for (const k in d.rels) {
                if (!Object.prototype.hasOwnProperty.call(d.rels, k))
                    continue;
                const key = k;
                const relList = d.rels[key];
                if (Array.isArray(relList)) {
                    const idx = relList.indexOf(datum.id);
                    if (idx !== -1)
                        relList.splice(idx, 1);
                }
            }
        });
        onDeleteSyncRelReference(datum, data_stash);
        const index = data_stash.findIndex(d => d.id === datum.id);
        if (index !== -1)
            data_stash.splice(index, 1);
        if (data_stash.length === 0) {
            data_stash.push(createNewPerson({ data: { gender: 'M' } }));
        }
    }
}
function cleanupDataJson(data) {
    removeToAddFromData(data);
    data.forEach(d => {
        delete d.main;
        delete d._tgdp;
        delete d._tgdp_sp;
        delete d.__tgdp_sp;
    });
    data.forEach(d => {
        Object.keys(d).forEach(k => {
            if (k[0] === '_')
                console.error('key starts with _', k);
        });
    });
    return data;
}
function removeToAddFromData(data) {
    for (let i = data.length - 1; i >= 0; i--) {
        if (data[i].to_add)
            removeToAdd(data[i], data);
    }
}

function sortChildrenWithSpouses(children, datum, data) {
    if (!datum.rels.children)
        return;
    const spouses = datum.rels.spouses || [];
    return children.sort((a, b) => {
        const a_p2 = otherParent(a, datum, data);
        const b_p2 = otherParent(b, datum, data);
        const a_i = a_p2 ? spouses.indexOf(a_p2.id) : -1;
        const b_i = b_p2 ? spouses.indexOf(b_p2.id) : -1;
        if (datum.data.gender === "M")
            return a_i - b_i;
        else
            return b_i - a_i;
    });
}
function sortAddNewChildren(children) {
    return children.sort((a, b) => {
        const a_new = a._new_rel_data;
        const b_new = b._new_rel_data;
        if (a_new && !b_new)
            return 1;
        if (!a_new && b_new)
            return -1;
        return 0;
    });
}
function otherParent(d, p1, data) {
    return data.find(d0 => (d0.id !== p1.id) && (d.rels.parents.includes(d0.id)));
}
function calculateEnterAndExitPositions(d, entering, exiting) {
    d.exiting = exiting;
    if (entering) {
        if (d.depth === 0 && !d.spouse) {
            d._x = d.x;
            d._y = d.y;
        }
        else if (d.spouse) {
            d._x = d.spouse.x;
            d._y = d.spouse.y;
        }
        else if (d.is_ancestry) {
            if (!d.parent)
                throw new Error('no parent');
            d._x = d.parent.x;
            d._y = d.parent.y;
        }
        else {
            d._x = d.psx;
            d._y = d.psy;
        }
    }
    else if (exiting) {
        const x = d.x > 0 ? 1 : -1, y = d.y > 0 ? 1 : -1;
        {
            d._x = d.x + 400 * x;
            d._y = d.y + 400 * y;
        }
    }
}
function setupSiblings({ tree, data_stash, node_separation, sortChildrenFunction }) {
    const main = tree.find(d => d.data.main);
    if (!main)
        throw new Error('no main');
    const p1 = main.data.rels.parents[0];
    const p2 = main.data.rels.parents[1];
    const siblings = findSiblings(main);
    if (siblings.length > 0 && !main.parents)
        throw new Error('no parents');
    const siblings_added = addSiblingsToTree(main);
    positionSiblings(main);
    function findSiblings(main) {
        return data_stash.filter(d => {
            if (d.id === main.data.id)
                return false;
            if (p1 && d.rels.parents.includes(p1))
                return true;
            if (p2 && d.rels.parents.includes(p2))
                return true;
            return false;
        });
    }
    function addSiblingsToTree(main) {
        const siblings_added = [];
        for (let i = 0; i < siblings.length; i++) {
            const sib = {
                data: siblings[i],
                sibling: true,
                x: 0.0, // to be calculated in positionSiblings
                y: main.y,
                depth: main.depth - 1,
                parents: []
            };
            const p1 = main.parents.find(d => d.data.id === sib.data.rels.parents[0]);
            const p2 = main.parents.find(d => d.data.id === sib.data.rels.parents[1]);
            if (p1)
                sib.parents.push(p1);
            if (p2)
                sib.parents.push(p2);
            tree.push(sib);
            siblings_added.push(sib);
        }
        return siblings_added;
    }
    function positionSiblings(main) {
        var _a, _b;
        const sorted_siblings = [main, ...siblings_added];
        if (sortChildrenFunction)
            sorted_siblings.sort((a, b) => sortChildrenFunction(a.data, b.data));
        sorted_siblings.sort((a, b) => {
            const a_p1 = main.parents.find(d => d.data.id === a.data.rels.parents[0]);
            const a_p2 = main.parents.find(d => d.data.id === a.data.rels.parents[1]);
            const b_p1 = main.parents.find(d => d.data.id === b.data.rels.parents[0]);
            const b_p2 = main.parents.find(d => d.data.id === b.data.rels.parents[1]);
            if (!a_p2 && b_p2)
                return -1;
            if (a_p2 && !b_p2)
                return 1;
            if (!a_p1 && b_p1)
                return 1;
            if (a_p1 && !b_p1)
                return -1;
            return 0;
        });
        const main_x = main.x;
        const spouses_x = (main.spouses || []).map(d => d.x);
        const x_range = d3.extent([main_x, ...spouses_x]);
        const main_sorted_index = sorted_siblings.findIndex(d => d.data.id === main.data.id);
        for (let i = 0; i < sorted_siblings.length; i++) {
            if (i === main_sorted_index)
                continue;
            const sib = sorted_siblings[i];
            if (i < main_sorted_index) {
                sib.x = ((_a = x_range[0]) !== null && _a !== void 0 ? _a : 0) - node_separation * (main_sorted_index - i);
            }
            else {
                sib.x = ((_b = x_range[1]) !== null && _b !== void 0 ? _b : 0) + node_separation * (i - main_sorted_index);
            }
        }
    }
}
function handlePrivateCards({ tree, data_stash, private_cards_config }) {
    const private_persons = {};
    const condition = private_cards_config.condition;
    if (!condition)
        return console.error('private_cards_config.condition is not set');
    tree.forEach(d => {
        if (d.data._new_rel_data)
            return;
        const is_private = isPrivate(d.data.id);
        if (is_private)
            d.is_private = is_private;
        return;
    });
    function isPrivate(d_id) {
        const parents_and_spouses_checked = [];
        let is_private = false;
        checkParentsAndSpouses(d_id);
        private_persons[d_id] = is_private;
        return is_private;
        function checkParentsAndSpouses(d_id) {
            if (is_private)
                return;
            if (Object.prototype.hasOwnProperty.call(private_persons, d_id)) {
                is_private = private_persons[d_id];
                return is_private;
            }
            const d = data_stash.find(d0 => d0.id === d_id);
            if (!d)
                throw new Error('no d');
            if (d._new_rel_data)
                return;
            if (condition(d)) {
                is_private = true;
                return true;
            }
            const rels = d.rels;
            [...rels.parents, ...(rels.spouses || [])].forEach(d0_id => {
                if (!d0_id)
                    return;
                if (parents_and_spouses_checked.includes(d0_id))
                    return;
                parents_and_spouses_checked.push(d0_id);
                checkParentsAndSpouses(d0_id);
            });
        }
    }
}
function getMaxDepth(d_id, data_stash) {
    const datum = data_stash.find(d => d.id === d_id);
    if (!datum)
        throw new Error('no datum');
    const root_ancestry = d3.hierarchy(datum, d => hierarchyGetterParents(d));
    const root_progeny = d3.hierarchy(datum, d => hierarchyGetterChildren(d));
    return {
        ancestry: root_ancestry.height,
        progeny: root_progeny.height
    };
    function hierarchyGetterChildren(d) {
        return [...(d.rels.children || [])]
            .map(id => data_stash.find(d => d.id === id))
            .filter(d => d && !d._new_rel_data && !d.to_add);
    }
    function hierarchyGetterParents(d) {
        return d.rels.parents
            .filter(d => d)
            .map(id => data_stash.find(d => d.id === id))
            .filter(d => d && !d._new_rel_data && !d.to_add);
    }
}

function isAllRelativeDisplayed(d, data) {
    const r = d.data.rels;
    const all_rels = [...r.parents, ...(r.spouses || []), ...(r.children || [])].filter(v => v);
    return all_rels.every(rel_id => data.some(d => d.data.id === rel_id));
}
function calculateDelay(tree, d, transition_time) {
    const delay_level = transition_time * .4;
    const ancestry_levels = Math.max(...tree.data.map(d => d.is_ancestry ? d.depth : 0));
    let delay = d.depth * delay_level;
    if ((d.depth !== 0 || !!d.spouse) && !d.is_ancestry) {
        delay += (ancestry_levels) * delay_level; // after ancestry
        if (d.spouse)
            delay += delay_level; // spouse after bloodline
        delay += (d.depth) * delay_level; // double the delay for each level because of additional spouse delay
    }
    return delay;
}

function formatData(data) {
    data.forEach((d) => {
        if (!d.rels.parents)
            d.rels.parents = [];
        if (!d.rels.spouses)
            d.rels.spouses = [];
        if (!d.rels.children)
            d.rels.children = [];
        convertFatherMotherToParents(d);
        normalizeDatumDateFields(d);
    });
    return data;
    function convertFatherMotherToParents(d) {
        if (!d.rels.parents)
            d.rels.parents = [];
        if (d.rels.father)
            d.rels.parents.push(d.rels.father);
        if (d.rels.mother)
            d.rels.parents.push(d.rels.mother);
        delete d.rels.father;
        delete d.rels.mother;
    }
}
function formatDataForExport(data, legacy_format = false) {
    data.forEach(d => {
        var _a;
        if (legacy_format) {
            let father;
            let mother;
            (_a = d.rels.parents) === null || _a === void 0 ? void 0 : _a.forEach(parentId => {
                const parent = data.find(candidate => candidate.id === parentId);
                if (!parent)
                    throw new Error('Parent not found');
                const parentData = (typeof parent.data === 'object' && parent.data)
                    ? parent.data
                    : { gender: undefined };
                const gender = parentData.gender === 'M' || parentData.gender === 'F'
                    ? parentData.gender
                    : undefined;
                if (gender === 'M') {
                    if (!father)
                        father = parent.id;
                    else
                        mother = parent.id; // for same sex parents, set alternate parent to mother
                }
                else if (gender === 'F') {
                    if (!mother)
                        mother = parent.id;
                    else
                        father = parent.id; // for same sex parents, set alternate parent to father
                }
            });
            if (father)
                d.rels.father = father;
            if (mother)
                d.rels.mother = mother;
            delete d.rels.parents;
        }
        if (d.rels.parents && d.rels.parents.length === 0)
            delete d.rels.parents;
        if (d.rels.spouses && d.rels.spouses.length === 0)
            delete d.rels.spouses;
        if (d.rels.children && d.rels.children.length === 0)
            delete d.rels.children;
        normalizeDatumDateFields(d);
    });
    return data;
}

function calculateTree(data, { main_id = null, node_separation = 250, level_separation = 150, single_parent_empty_card = true, is_horizontal = false, one_level_rels = false, sortChildrenFunction = undefined, sortSpousesFunction = undefined, ancestry_depth = undefined, progeny_depth = undefined, show_siblings_of_main = false, modifyTreeHierarchy = undefined, private_cards_config = undefined, }) {
    if (!data || !data.length)
        throw new Error('No data');
    if (is_horizontal)
        [node_separation, level_separation] = [level_separation, node_separation];
    const data_stash = single_parent_empty_card ? createRelsToAdd(data) : data;
    if (!main_id || !data_stash.find(d => d.id === main_id))
        main_id = data_stash[0].id;
    const main = data_stash.find(d => d.id === main_id);
    if (!main)
        throw new Error('Main not found');
    const tree_children = calculateTreePositions(main, 'children', false);
    const tree_parents = calculateTreePositions(main, 'parents', true);
    data_stash.forEach(d => d.main = d === main);
    levelOutEachSide(tree_parents, tree_children);
    const tree$1 = mergeSides(tree_parents, tree_children);
    setupChildrenAndParents(tree$1);
    setupSpouses(tree$1, node_separation);
    if (show_siblings_of_main && !one_level_rels)
        setupSiblings({ tree: tree$1, data_stash, node_separation, sortChildrenFunction });
    setupProgenyParentsPos(tree$1);
    nodePositioning(tree$1);
    tree$1.forEach(d => d.all_rels_displayed = isAllRelativeDisplayed(d, tree$1));
    if (private_cards_config)
        handlePrivateCards({ tree: tree$1, data_stash, private_cards_config });
    setupTid(tree$1);
    const dim = calculateTreeDim(tree$1, node_separation, level_separation);
    return { data: tree$1, data_stash, dim, main_id: main.id, is_horizontal };
    function calculateTreePositions(datum, rt, is_ancestry) {
        const hierarchyGetter = rt === "children" ? hierarchyGetterChildren : hierarchyGetterParents;
        const d3_tree = tree().nodeSize([node_separation, level_separation]).separation(separation);
        const root = hierarchy(datum, hierarchyGetter);
        trimTree(root, is_ancestry);
        if (modifyTreeHierarchy)
            modifyTreeHierarchy(root, is_ancestry);
        d3_tree(root);
        const tree$1 = root.descendants();
        tree$1.forEach((d) => {
            if (d.x === undefined)
                d.x = 0;
            if (d.y === undefined)
                d.y = 0;
        });
        return tree$1;
        function separation(a, b) {
            let offset = 1;
            if (!is_ancestry) {
                if (!sameParent(a, b))
                    offset += .25;
                if (!one_level_rels) {
                    if (someSpouses(a, b))
                        offset += offsetOnPartners(a, b);
                }
                if (sameParent(a, b) && !sameBothParents(a, b))
                    offset += .125;
            }
            return offset;
        }
        function sameParent(a, b) { return a.parent == b.parent; }
        function sameBothParents(a, b) {
            const parentsA = [...a.data.rels.parents].sort();
            const parentsB = [...b.data.rels.parents].sort();
            return parentsA.length === parentsB.length && parentsA.every((p, i) => p === parentsB[i]);
        }
        function hasSpouses(d) { return d.data.rels.spouses && d.data.rels.spouses.length > 0; }
        function someSpouses(a, b) { return hasSpouses(a) || hasSpouses(b); }
        function hierarchyGetterChildren(d) {
            const children = [...(d.rels.children || [])]
                .map(id => data_stash.find(d0 => d0.id === id))
                .filter((x) => !!x);
            if (sortChildrenFunction)
                children.sort(sortChildrenFunction);
            sortAddNewChildren(children); // then put new children at the end
            if (sortSpousesFunction)
                sortSpousesFunction(d, data_stash);
            sortChildrenWithSpouses(children, d, data_stash); // then sort by order of spouses
            return children;
        }
        function hierarchyGetterParents(d) {
            const parents = [...d.rels.parents];
            const p1 = data_stash.find(d0 => d0.id === parents[0]);
            if (p1 && p1.data.gender === "F")
                parents.reverse();
            return parents
                .filter(id => !!id)
                .map(id => data_stash.find(d0 => d0.id === id))
                .filter((x) => !!x);
        }
        function offsetOnPartners(a, b) {
            return ((a.data.rels.spouses || []).length + (b.data.rels.spouses || []).length) * .5;
        }
    }
    function levelOutEachSide(parents, children) {
        const mid_diff = (parents[0].x - children[0].x) / 2;
        parents.forEach(d => d.x -= mid_diff);
        children.forEach(d => d.x += mid_diff);
    }
    function mergeSides(parents, children) {
        parents.forEach(d => { d.is_ancestry = true; });
        parents.forEach(d => d.depth === 1 ? d.parent = children[0] : null);
        return [...children, ...parents.slice(1)];
    }
    function nodePositioning(tree) {
        tree.forEach(d => {
            d.y *= (d.is_ancestry ? -1 : 1);
            if (is_horizontal) {
                const d_x = d.x;
                d.x = d.y;
                d.y = d_x;
            }
        });
    }
    function setupSpouses(tree, node_separation) {
        for (let i = tree.length; i--;) {
            const d = tree[i];
            if (!d.is_ancestry) {
                let spouses = d.data.rels.spouses || [];
                if (d._ignore_spouses)
                    spouses = spouses.filter(sp_id => !d._ignore_spouses.includes(sp_id));
                if (spouses.length > 0) {
                    if (one_level_rels && d.depth > 0)
                        continue;
                    const side = d.data.data.gender === "M" ? -1 : 1; // female on right
                    d.x += spouses.length / 2 * node_separation * side;
                    spouses.forEach((sp_id, i) => {
                        const spouse = {
                            data: data_stash.find(d0 => d0.id === sp_id),
                            added: true,
                            depth: d.depth,
                            spouse: d,
                            x: d.x - (node_separation * (i + 1)) * side,
                            y: d.y,
                            tid: `${d.data.id}-spouse-${i}`,
                        };
                        spouse.sx = i > 0 ? spouse.x : spouse.x + (node_separation / 2) * side;
                        spouse.sy = i > 0 ? spouse.y : spouse.y + (node_separation / 2) * side;
                        if (!d.spouses)
                            d.spouses = [];
                        d.spouses.push(spouse);
                        tree.push(spouse);
                    });
                }
            }
            if (d.parents && d.parents.length === 2) {
                const p1 = d.parents[0];
                const p2 = d.parents[1];
                const midd = p1.x - (p1.x - p2.x) / 2;
                const x = (d, sp) => midd + (node_separation / 2) * (d.x < sp.x ? 1 : -1);
                p2.x = x(p1, p2);
                p1.x = x(p2, p1);
            }
        }
    }
    function setupProgenyParentsPos(tree) {
        tree.forEach(d => {
            if (d.is_ancestry)
                return;
            if (d.depth === 0)
                return;
            if (d.added)
                return;
            if (d.sibling)
                return;
            const p1 = d.parent;
            const p2 = ((p1 === null || p1 === void 0 ? void 0 : p1.spouses) || []).find((d0) => d.data.rels.parents.includes(d0.data.id));
            if (p1 && p2) {
                if (!p1.added && !p2.added)
                    console.error('no added spouse', p1, p2);
                const added_spouse = p1.added ? p1 : p2;
                setupParentPos(d, added_spouse);
            }
            else if (p1 || p2) {
                const parent = p1 || p2;
                if (!parent)
                    throw new Error('no progeny parent');
                parent.sx = parent.x;
                parent.sy = parent.y;
                setupParentPos(d, parent);
            }
            function setupParentPos(d, p) {
                d.psx = !is_horizontal ? p.sx : p.y;
                d.psy = !is_horizontal ? p.y : p.sx;
            }
        });
    }
    function setupChildrenAndParents(tree) {
        tree.forEach(d0 => {
            delete d0.children;
            tree.forEach(d1 => {
                if (d1.parent === d0) {
                    if (d1.is_ancestry) {
                        if (!d0.parents)
                            d0.parents = [];
                        d0.parents.push(d1);
                    }
                    else {
                        if (!d0.children)
                            d0.children = [];
                        d0.children.push(d1);
                    }
                }
            });
            if (d0.parents && d0.parents.length === 2) {
                const p1 = d0.parents[0];
                const p2 = d0.parents[1];
                p1.coparent = p2;
                p2.coparent = p1;
            }
        });
    }
    function calculateTreeDim(tree, node_separation, level_separation) {
        if (is_horizontal)
            [node_separation, level_separation] = [level_separation, node_separation];
        const w_extent = extent(tree, (d) => d.x);
        const h_extent = extent(tree, (d) => d.y);
        if (w_extent[0] === undefined || w_extent[1] === undefined || h_extent[0] === undefined || h_extent[1] === undefined)
            throw new Error('No extent');
        const padding_x = node_separation / 2;
        const padding_y = level_separation / 2;
        const min_x = w_extent[0] - padding_x;
        const max_x = w_extent[1] + padding_x;
        const min_y = h_extent[0] - padding_y;
        const max_y = h_extent[1] + padding_y;
        const anchor = tree.find(d => !d.is_ancestry && !d.added && d.depth === 0) || tree[0];
        const center_x = anchor ? anchor.x : 0;
        const center_y = anchor ? anchor.y : 0;
        return {
            width: max_x - min_x,
            height: max_y - min_y,
            x_off: -min_x,
            y_off: -min_y,
            min_x,
            max_x,
            min_y,
            max_y,
            center_x,
            center_y,
            padding_x,
            padding_y
        };
    }
    function createRelsToAdd(data) {
        const to_add_spouses = [];
        for (let i = 0; i < data.length; i++) {
            const d = data[i];
            if (d.rels.children && d.rels.children.length > 0) {
                if (!d.rels.spouses)
                    d.rels.spouses = [];
                let to_add_spouse;
                d.rels.children.forEach(d0 => {
                    const child = data.find(d1 => d1.id === d0);
                    if (child.rels.parents.length === 2)
                        return;
                    if (!to_add_spouse) {
                        to_add_spouse = findOrCreateToAddSpouse(d);
                    }
                    if (!to_add_spouse.rels.children)
                        to_add_spouse.rels.children = [];
                    to_add_spouse.rels.children.push(child.id);
                    if (child.rels.parents.length !== 1)
                        throw new Error('child has more than 1 parent');
                    child.rels.parents.push(to_add_spouse.id);
                });
            }
        }
        to_add_spouses.forEach(d => data.push(d));
        return data;
        function findOrCreateToAddSpouse(d) {
            const spouses = (d.rels.spouses || []).map(sp_id => data.find(d0 => d0.id === sp_id)).filter(d => d !== undefined);
            return spouses.find(sp => sp.to_add) || createToAddSpouse(d);
        }
        function createToAddSpouse(d) {
            const spouse = createNewPerson({
                data: { gender: d.data.gender === "M" ? "F" : "M" },
                rels: { spouses: [d.id] }
            });
            spouse.to_add = true;
            to_add_spouses.push(spouse);
            if (!d.rels.spouses)
                d.rels.spouses = [];
            d.rels.spouses.push(spouse.id);
            return spouse;
        }
    }
    function trimTree(root, is_ancestry) {
        let max_depth = is_ancestry ? ancestry_depth : progeny_depth;
        if (one_level_rels)
            max_depth = 1;
        if (!max_depth && max_depth !== 0)
            return root;
        trimNode(root, 0);
        return root;
        function trimNode(node, depth) {
            if (depth === max_depth) {
                if (node.children)
                    delete node.children;
            }
            else if (node.children) {
                node.children.forEach(child => {
                    trimNode(child, depth + 1);
                });
            }
        }
    }
}
function setupTid(tree) {
    const ids = [];
    tree.forEach(d => {
        if (ids.includes(d.data.id)) {
            const duplicates = tree.filter(d0 => d0.data.id === d.data.id);
            duplicates.forEach((d0, i) => {
                d0.tid = `${d.data.id}--x${i + 1}`;
                d0.duplicate = duplicates.length;
                ids.push(d.data.id);
            });
        }
        else {
            d.tid = d.data.id;
            ids.push(d.data.id);
        }
    });
}
function CalculateTree(options) {
    return calculateTreeWithV1Data(options.data, options);
}
function calculateTreeWithV1Data(data, options) {
    const formatted_data = formatData(data);
    return calculateTree(formatted_data, options);
}

function createStore(initial_state) {
    let onUpdate;
    const state = Object.assign({ transition_time: 1000, link_style: 'legacy' }, initial_state);
    state.main_id_history = [];
    if (state.data) {
        checkIfFmFormat(state.data);
        formatData(state.data);
    }
    const store = {
        state,
        updateTree: (props) => {
            if (!state.data || state.data.length === 0)
                return;
            state.tree = calcTree();
            if (!state.main_id && state.tree)
                updateMainId(state.tree.main_id);
            if (onUpdate)
                onUpdate(props);
        },
        updateData: (data) => {
            checkIfFmFormat(data);
            formatData(data);
            state.data = data;
            validateMainId();
        },
        updateMainId,
        getMainId: () => state.main_id,
        getData: () => state.data,
        getTree: () => state.tree,
        setOnUpdate: (f) => onUpdate = f,
        getMainDatum,
        getDatum,
        getTreeMainDatum,
        getTreeDatum,
        getLastAvailableMainDatum,
        methods: {},
    };
    return store;
    function calcTree() {
        const args = {
            main_id: state.main_id,
        };
        if (state.node_separation !== undefined)
            args.node_separation = state.node_separation;
        if (state.level_separation !== undefined)
            args.level_separation = state.level_separation;
        if (state.single_parent_empty_card !== undefined)
            args.single_parent_empty_card = state.single_parent_empty_card;
        if (state.is_horizontal !== undefined)
            args.is_horizontal = state.is_horizontal;
        if (state.one_level_rels !== undefined)
            args.one_level_rels = state.one_level_rels;
        if (state.modifyTreeHierarchy !== undefined)
            args.modifyTreeHierarchy = state.modifyTreeHierarchy;
        if (state.sortChildrenFunction !== undefined)
            args.sortChildrenFunction = state.sortChildrenFunction;
        if (state.sortSpousesFunction !== undefined)
            args.sortSpousesFunction = state.sortSpousesFunction;
        if (state.ancestry_depth !== undefined)
            args.ancestry_depth = state.ancestry_depth;
        if (state.progeny_depth !== undefined)
            args.progeny_depth = state.progeny_depth;
        if (state.show_siblings_of_main !== undefined)
            args.show_siblings_of_main = state.show_siblings_of_main;
        if (state.private_cards_config !== undefined)
            args.private_cards_config = state.private_cards_config;
        return calculateTree(state.data, args);
    }
    function getMainDatum() {
        const datum = state.data.find(d => d.id === state.main_id);
        if (!datum)
            throw new Error("Main datum not found");
        return datum;
    }
    function getDatum(id) {
        const datum = state.data.find(d => d.id === id);
        if (!datum)
            return undefined;
        return datum;
    }
    function getTreeMainDatum() {
        if (!state.tree)
            throw new Error("No tree");
        const found = state.tree.data.find(d => d.data.id === state.main_id);
        if (!found)
            throw new Error("No tree main datum");
        return found;
    }
    function getTreeDatum(id) {
        if (!state.tree)
            throw new Error("No tree");
        const found = state.tree.data.find(d => d.data.id === id);
        if (!found)
            return undefined;
        return found;
    }
    function updateMainId(id) {
        if (id === state.main_id)
            return;
        state.main_id_history = state.main_id_history.filter(d => d !== id).slice(-10);
        state.main_id_history.push(id);
        state.main_id = id;
    }
    function validateMainId() {
        if (state.main_id) {
            const mainExists = state.data.find(d => d.id === state.main_id);
            if (!mainExists && state.data.length > 0) {
                updateMainId(state.data[0].id);
            }
        }
        else {
            if (state.data.length > 0) {
                updateMainId(state.data[0].id);
            }
        }
    }
    function getLastAvailableMainDatum() {
        let main_id = state.main_id_history.slice(0).reverse().find(id => getDatum(id));
        if (!main_id && state.data.length > 0)
            main_id = state.data[0].id;
        if (!main_id)
            throw new Error("No main id");
        if (main_id !== state.main_id)
            updateMainId(main_id);
        const main_datum = getDatum(main_id);
        if (!main_datum)
            throw new Error("Main datum not found");
        return main_datum;
    }
    function checkIfFmFormat(data) {
        if (state.legacy_format !== undefined)
            return; // already checked
        for (const d of data) {
            if (d.rels.father || d.rels.mother) {
                state.legacy_format = true;
                return;
            }
        }
        state.legacy_format = false;
    }
}

function createLinks(d, is_horizontal = false) {
    const links = [];
    if (d.spouses || d.coparent)
        handleSpouse(d);
    handleAncestrySide(d);
    handleProgenySide(d);
    return links;
    function handleAncestrySide(d) {
        if (!d.parents)
            return;
        const p1 = d.parents[0];
        const p2 = d.parents[1] || p1;
        const p = { x: getMid(p1, p2, 'x'), y: getMid(p1, p2, 'y') };
        links.push({
            d: Link(d, p),
            _d: () => {
                const _d = { x: d.x, y: d.y }, _p = { x: d.x, y: d.y };
                return Link(_d, _p);
            },
            curve: true,
            id: linkId(d, p1, p2),
            depth: d.depth + 1,
            is_ancestry: true,
            source: d,
            target: [p1, p2]
        });
    }
    function handleProgenySide(d) {
        if (!d.children || d.children.length === 0)
            return;
        const childCount = d.children.length;
        d.children.forEach((child) => {
            const partner = otherParent(child, d);
            const other_parent = partner || d;
            const coupleMidX = partner && typeof partner.x === 'number'
                ? (partner.x + d.x) / 2
                : d.x;
            const coupleMidY = partner && typeof partner.y === 'number'
                ? (partner.y + d.y) / 2
                : d.y;
            const anchorX = firstNumber(child.psx, partner === null || partner === void 0 ? void 0 : partner.sx, d.sx, coupleMidX, d.x);
            const anchorY = firstNumber(child.psy, partner === null || partner === void 0 ? void 0 : partner.sy, d.sy, coupleMidY, d.y);
            if (typeof anchorX !== 'number' || Number.isNaN(anchorX)) {
                throw new Error('Cannot resolve progeny link anchor X');
            }
            if (typeof anchorY !== 'number' || Number.isNaN(anchorY)) {
                throw new Error('Cannot resolve progeny link anchor Y');
            }
            const useSharedAnchor = childCount > 1 || Boolean(partner);
            const trunkX = useSharedAnchor ? anchorX : (typeof child.psx === 'number' ? child.psx : anchorX);
            const trunkY = useSharedAnchor ? anchorY : (typeof child.psy === 'number' ? child.psy : anchorY);
            const parent_pos = !is_horizontal
                ? { x: trunkX, y: d.y }
                : { x: d.x, y: trunkY };
            const child_pos = { x: child.x, y: child.y };
            links.push({
                d: Link(parent_pos, child_pos),
                _d: () => Link(parent_pos, { x: _or(parent_pos, 'x'), y: _or(parent_pos, 'y') }),
                curve: true,
                id: linkId(child, d, other_parent),
                depth: d.depth + 1,
                is_ancestry: false,
                source: [d, other_parent],
                target: child
            });
        });
    }
    function handleSpouse(d) {
        if (d.spouses) {
            d.spouses.forEach(spouse => links.push(createSpouseLink(d, spouse)));
        }
        else if (d.coparent) {
            links.push(createSpouseLink(d, d.coparent));
        }
        function createSpouseLink(d, spouse) {
            return {
                d: [[d.x, d.y], [spouse.x, spouse.y]],
                _d: () => [
                    d.is_ancestry ? [_or(d, 'x') - .0001, _or(d, 'y')] : [d.x, d.y],
                    d.is_ancestry ? [_or(spouse, 'x'), _or(spouse, 'y')] : [d.x - .0001, d.y]
                ],
                curve: false,
                id: linkId(d, spouse),
                depth: d.depth,
                spouse: true,
                is_ancestry: spouse.is_ancestry,
                source: d,
                target: spouse
            };
        }
    }
    function getMid(d1, d2, side, is_ = false) {
        if (is_)
            return _or(d1, side) - (_or(d1, side) - _or(d2, side)) / 2;
        else
            return d1[side] - (d1[side] - d2[side]) / 2;
    }
    function _or(d, side) {
        const n = Object.prototype.hasOwnProperty.call(d, `_${side}`) ? d[`_${side}`] : d[side];
        if (typeof n !== 'number')
            throw new Error(`${side} is not a number`);
        return n;
    }
    function Link(d, p) {
        return is_horizontal ? LinkHorizontal(d, p) : LinkVertical(d, p);
    }
    function LinkVertical(d, p) {
        const hy = (d.y + (p.y - d.y) / 2);
        return [
            [d.x, d.y],
            [d.x, hy],
            [d.x, hy],
            [p.x, hy],
            [p.x, hy],
            [p.x, p.y],
        ];
    }
    function LinkHorizontal(d, p) {
        const hx = (d.x + (p.x - d.x) / 2);
        return [
            [d.x, d.y],
            [hx, d.y],
            [hx, d.y],
            [hx, p.y],
            [hx, p.y],
            [p.x, p.y],
        ];
    }
    function linkId(...args) {
        return args.map(d => d.tid).sort().join(", ");
    }
    function otherParent(child, p1) {
        const p2 = (p1.spouses || []).find(d => child.data.rels.parents.includes(d.data.id));
        return p2;
    }
    function firstNumber(...values) {
        for (const value of values) {
            if (typeof value === 'number' && !Number.isNaN(value))
                return value;
        }
        return undefined;
    }
}

function updateLinks(svg, tree, props = {}) {
    var _a, _b;
    const links_data_dct = tree.data.reduce((acc, d) => {
        createLinks(d, tree.is_horizontal).forEach((l) => (acc[l.id] = l));
        return acc;
    }, {});
    const links_data = Object.values(links_data_dct);
    prepareAnimationMetadata(links_data, tree.is_horizontal);
    const linkStyle = (_a = props.link_style) !== null && _a !== void 0 ? _a : 'smooth';
    const baseDuration = Math.max(260, Math.round(((_b = props.transition_time) !== null && _b !== void 0 ? _b : 200) * 1.25));
    const updateDuration = Math.max(220, Math.round(baseDuration * 0.85));
    const exitDuration = Math.max(200, Math.round(baseDuration * 0.7));
    const siblingDelayStep = Math.min(140, Math.round(baseDuration * 0.18));
    const link = d3
        .select(svg)
        .select(".links_view")
        .selectAll("path.link")
        .data(links_data, (d) => d.id);
    if (props.transition_time === undefined)
        throw new Error("transition_time is undefined");
    const link_exit = link.exit();
    const link_enter = link.enter().append("path").attr("class", "link");
    const link_update = link_enter.merge(link);
    link_exit.each(linkExit);
    link_enter.each(linkEnter);
    link_update.each(linkUpdate);
    function linkEnter(d) {
        const path = d3.select(this)
            .attr("fill", "none")
            .attr("stroke", "#fff")
            .attr("stroke-width", 1)
            .style("opacity", 0)
            .attr("d", createPath(d, true, linkStyle, tree.is_horizontal));
        const meta = d.__animation;
        const extraDelay = meta ? meta.index * siblingDelayStep : 0;
        const baseDelay = props.transition_time ? 100 : 0;
        const delay = (props.initial ? calculateDelay(tree, d, props.transition_time) : 0) + extraDelay + baseDelay;
        const offset = computeEntryOffset(meta, tree.is_horizontal);
        if (offset) {
            path.attr("transform", `translate(${formatNumber(offset[0])},${formatNumber(offset[1])})`);
        }
        else {
            path.attr("transform", "translate(0,0)");
        }
        const config = getTransitionConfig(baseDuration, delay);
        applyTransition(path, config)
            .attr("d", createPath(d, false, linkStyle, tree.is_horizontal))
            .style("opacity", 1)
            .attr("transform", "translate(0,0)");
    }
    function linkUpdate(d) {
        const path = d3.select(this);
        const meta = d.__animation;
        const extraDelay = meta ? meta.index * Math.max(40, Math.round(siblingDelayStep * 0.6)) : 0;
        const baseDelay = props.transition_time ? 100 : 0;
        const delay = (props.initial ? calculateDelay(tree, d, props.transition_time) : 0) + extraDelay + baseDelay;
        path.interrupt().attr("transform", "translate(0,0)");
        const config = getTransitionConfig(updateDuration, delay);
        applyTransition(path, config)
            .attr("d", createPath(d, false, linkStyle, tree.is_horizontal))
            .style("opacity", 1);
    }
    function linkExit(d) {
        const path = d3.select(this);
        const meta = d === null || d === void 0 ? void 0 : d.__animation;
        const extraDelay = meta ? (meta.count - meta.index - 1) * Math.max(30, Math.round(siblingDelayStep * 0.35)) : 0;
        const config = getTransitionConfig(exitDuration, extraDelay);
        applyTransition(path, config)
            .attr("d", createPath(d, true, linkStyle, tree.is_horizontal))
            .style("opacity", 0)
            .attr("transform", "translate(0,0)")
            .on("end", () => path.remove());
    }
}
function prepareAnimationMetadata(links, isHorizontal) {
    const groups = new Map();
    links.forEach(link => {
        var _a, _b;
        const animated = link;
        animated.__animation = undefined;
        if (link.spouse || link.is_ancestry === true)
            return;
        if (!Array.isArray(link.source))
            return;
        const primaryParent = Array.isArray(link.source) ? link.source[0] : link.source;
        const parentData = primaryParent === null || primaryParent === void 0 ? void 0 : primaryParent.data;
        const parentId = (_b = (_a = parentData === null || parentData === void 0 ? void 0 : parentData.id) !== null && _a !== void 0 ? _a : primaryParent === null || primaryParent === void 0 ? void 0 : primaryParent.id) !== null && _b !== void 0 ? _b : primaryParent === null || primaryParent === void 0 ? void 0 : primaryParent.tid;
        const groupKey = parentId ? `child:${String(parentId)}` : `child:${link.id}`;
        if (!groups.has(groupKey))
            groups.set(groupKey, []);
        groups.get(groupKey).push(animated);
    });
    groups.forEach(group => {
        const sorted = group.slice().sort((a, b) => {
            var _a, _b, _c, _e;
            const sourceA = (Array.isArray(a.target) ? a.target[0] : a.target);
            const sourceB = (Array.isArray(b.target) ? b.target[0] : b.target);
            const posA = isHorizontal ? ((_a = sourceA === null || sourceA === void 0 ? void 0 : sourceA.y) !== null && _a !== void 0 ? _a : 0) : ((_b = sourceA === null || sourceA === void 0 ? void 0 : sourceA.x) !== null && _b !== void 0 ? _b : 0);
            const posB = isHorizontal ? ((_c = sourceB === null || sourceB === void 0 ? void 0 : sourceB.y) !== null && _c !== void 0 ? _c : 0) : ((_e = sourceB === null || sourceB === void 0 ? void 0 : sourceB.x) !== null && _e !== void 0 ? _e : 0);
            return posA - posB;
        });
        sorted.forEach((link, index) => {
            const offset = computeSiblingOffsetVector(index, sorted.length, isHorizontal);
            link.__animation = { index, count: sorted.length, offset };
        });
    });
}
function computeEntryOffset(meta, isHorizontal) {
    if (!(meta === null || meta === void 0 ? void 0 : meta.offset))
        return null;
    const easeFactor = isHorizontal ? 0.3 : 0.35;
    const dx = meta.offset.dx * easeFactor;
    const dy = meta.offset.dy * easeFactor;
    if (Math.abs(dx) < 0.25 && Math.abs(dy) < 0.25)
        return null;
    return [dx, dy];
}
function createPath(link, collapsed = false, style = "smooth", isHorizontal = false) {
    var _a, _b;
    const animated = link;
    const sourcePoints = (collapsed ? link._d() : link.d).map(([x, y]) => [x, y]);
    const isDescendantLink = link.is_ancestry === false && !link.spouse && Array.isArray(link.source);
    const deduped = dedupePoints(sourcePoints);
    const pointsWithOffset = applySiblingOffset(deduped, animated.__animation);
    const points = pointsWithOffset;
    const fallbackPoints = pointsWithOffset;
    if (points.length < 2) {
        return buildPolylinePath(fallbackPoints);
    }
    if (!link.curve) {
        return buildPolylinePath(fallbackPoints);
    }
    if (style === "legacy") {
        return buildLegacyCurve(fallbackPoints, isHorizontal);
    }
    if (style === "smooth") {
        const isAncestorLink = link.is_ancestry === true;
        const smoothCurve = (isAncestorLink || isDescendantLink)
            ? (isHorizontal ? d3.curveMonotoneX : d3.curveMonotoneY)
            : d3.curveBasis;
        const smoothLine = d3
            .line()
            .x((d) => d[0])
            .y((d) => d[1])
            .curve(smoothCurve);
        if (points && points.length >= 2) {
            const p0 = { x: points[0][0], y: points[0][1] };
            const p3 = { x: points[points.length - 1][0], y: points[points.length - 1][1] };
            if ((isAncestorLink || isDescendantLink) && !link.spouse) {
                const linkDirection = isAncestorLink
                    ? 'ancestor'
                    : isDescendantLink
                        ? 'descendant'
                        : 'other';
                const { d: pathStr } = cubicBezierPath(p0, p3, {
                    isHorizontal,
                    linkDirection
                });
                return pathStr;
            }
        }
        return (_a = smoothLine(points)) !== null && _a !== void 0 ? _a : buildPolylinePath(fallbackPoints);
    }
    const monotoneLine = d3
        .line()
        .x((d) => d[0])
        .y((d) => d[1])
        .curve(isHorizontal ? d3.curveMonotoneX : d3.curveMonotoneY);
    return (_b = monotoneLine(points)) !== null && _b !== void 0 ? _b : buildPolylinePath(fallbackPoints);
}
function cubicBezierPath(p0, p3, options = {}) {
    const { isHorizontal = false, linkDirection = 'other' } = options;
    const dx = p3.x - p0.x;
    const dy = p3.y - p0.y;
    if (linkDirection === 'ancestor' || linkDirection === 'descendant') {
        if (isHorizontal) {
            const axisSign = dx === 0 ? 1 : Math.sign(dx);
            const flow = clamp(Math.abs(dx) * 0.4, 18, 130);
            const c1 = { x: p0.x + flow * axisSign, y: p0.y };
            const c2 = { x: p3.x - flow * axisSign, y: p3.y };
            return {
                d: `M ${formatNumber(p0.x)},${formatNumber(p0.y)} C ${formatNumber(c1.x)},${formatNumber(c1.y)} ${formatNumber(c2.x)},${formatNumber(c2.y)} ${formatNumber(p3.x)},${formatNumber(p3.y)}`,
                controls: { c1, c2 }
            };
        }
        const axisSign = dy === 0 ? 1 : Math.sign(dy);
        const flow = clamp(Math.abs(dy) * 0.4, 20, 120);
        const c1 = { x: p0.x, y: p0.y + flow * axisSign };
        const c2 = { x: p3.x, y: p3.y - flow * axisSign };
        return {
            d: `M ${formatNumber(p0.x)},${formatNumber(p0.y)} C ${formatNumber(c1.x)},${formatNumber(c1.y)} ${formatNumber(c2.x)},${formatNumber(c2.y)} ${formatNumber(p3.x)},${formatNumber(p3.y)}`,
            controls: { c1, c2 }
        };
    }
    const span = Math.hypot(dx, dy) || 1;
    const base = Math.min(140, Math.max(24, span * 0.18));
    const c1 = { x: p0.x + dx * 0.35, y: p0.y + dy * 0.35 };
    const c2 = { x: p3.x - dx * 0.35, y: p3.y - dy * 0.35 };
    const adjustX = (-dy / span) * base * 0.25;
    const adjustY = (dx / span) * base * 0.25;
    const finalC1 = { x: c1.x + adjustX, y: c1.y + adjustY };
    const finalC2 = { x: c2.x + adjustX, y: c2.y + adjustY };
    return {
        d: `M ${formatNumber(p0.x)},${formatNumber(p0.y)} C ${formatNumber(finalC1.x)},${formatNumber(finalC1.y)} ${formatNumber(finalC2.x)},${formatNumber(finalC2.y)} ${formatNumber(p3.x)},${formatNumber(p3.y)}`,
        controls: { c1: finalC1, c2: finalC2 }
    };
}
function applySiblingOffset(points, meta) {
    if (!(meta === null || meta === void 0 ? void 0 : meta.offset))
        return points;
    const dx = clamp(meta.offset.dx, -18, 18);
    const dy = clamp(meta.offset.dy, -18, 18);
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01)
        return points;
    const totalSegments = points.length - 1;
    if (totalSegments <= 1)
        return points;
    const adjusted = points.map(([x, y]) => [x, y]);
    for (let i = 1; i < totalSegments; i++) {
        const t = i / totalSegments;
        const weight = Math.sin(Math.PI * t) * 0.6;
        if (!Number.isFinite(weight))
            continue;
        const prev = points[i - 1];
        const curr = points[i];
        const next = points[i + 1];
        const prevVec = [curr[0] - prev[0], curr[1] - prev[1]];
        const nextVec = [next[0] - curr[0], next[1] - curr[1]];
        const prevVertical = Math.abs(prevVec[0]) < 0.001;
        const prevHorizontal = Math.abs(prevVec[1]) < 0.001;
        const nextVertical = Math.abs(nextVec[0]) < 0.001;
        const nextHorizontal = Math.abs(nextVec[1]) < 0.001;
        const preserveX = prevVertical || nextVertical;
        const preserveY = prevHorizontal || nextHorizontal;
        if (Math.abs(dx) > 0.01 && !preserveX) {
            adjusted[i][0] += dx * weight;
        }
        if (Math.abs(dy) > 0.01 && !preserveY) {
            adjusted[i][1] += dy * weight;
        }
    }
    return adjusted;
}
function computeSiblingOffsetVector(index, count, isHorizontal) {
    if (count <= 1)
        return undefined;
    const center = (count - 1) / 2;
    const offsetIndex = index - center;
    if (Math.abs(offsetIndex) < 0.05)
        return undefined;
    const baseSpread = isHorizontal ? 10 : 12;
    const scale = Math.min(20, baseSpread + count);
    const displacement = clamp(offsetIndex * scale, -24, 24);
    return isHorizontal ? { dx: 0, dy: displacement } : { dx: displacement, dy: 0 };
}
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function buildPolylinePath(points) {
    const deduped = dedupePoints(points);
    if (!deduped.length)
        return "";
    return deduped
        .map(([x, y], index) => `${index === 0 ? "M" : "L"}${formatNumber(x)},${formatNumber(y)}`)
        .join(" ");
}
function dedupePoints(points) {
    if (points.length < 2)
        return points.slice();
    const deduped = [points[0]];
    for (let i = 1; i < points.length; i++) {
        const [x, y] = points[i];
        const [prevX, prevY] = deduped[deduped.length - 1];
        if (x === prevX && y === prevY)
            continue;
        deduped.push([x, y]);
    }
    return deduped;
}
function formatNumber(value) {
    if (!Number.isFinite(value))
        return "0";
    const fixed = Number(value.toFixed(3));
    return Number.isInteger(fixed) ? fixed.toString() : fixed.toString();
}
function buildLegacyCurve(points, isHorizontal) {
    const deduped = dedupePoints(points);
    if (deduped.length < 2)
        return buildPolylinePath(deduped);
    const pathParts = [];
    const start = deduped[0];
    pathParts.push(`M${formatNumber(start[0])},${formatNumber(start[1])}`);
    for (let i = 1; i < deduped.length; i++) {
        const current = deduped[i];
        const prev = deduped[i - 1];
        if (i === deduped.length - 1) {
            pathParts.push(`L${formatNumber(current[0])},${formatNumber(current[1])}`);
            continue;
        }
        const next = deduped[i + 1];
        const prevVec = [current[0] - prev[0], current[1] - prev[1]];
        const nextVec = [next[0] - current[0], next[1] - current[1]];
        const prevLength = Math.hypot(prevVec[0], prevVec[1]);
        const nextLength = Math.hypot(nextVec[0], nextVec[1]);
        if (prevLength === 0 || nextLength === 0) {
            pathParts.push(`L${formatNumber(current[0])},${formatNumber(current[1])}`);
            continue;
        }
        const cornerRadius = computeCornerRadius(prevLength, nextLength, isHorizontal);
        if (cornerRadius <= 0.5) {
            pathParts.push(`L${formatNumber(current[0])},${formatNumber(current[1])}`);
            continue;
        }
        const startCorner = [
            current[0] - (prevVec[0] / prevLength) * cornerRadius,
            current[1] - (prevVec[1] / prevLength) * cornerRadius
        ];
        const endCorner = [
            current[0] + (nextVec[0] / nextLength) * cornerRadius,
            current[1] + (nextVec[1] / nextLength) * cornerRadius
        ];
        pathParts.push(`L${formatNumber(startCorner[0])},${formatNumber(startCorner[1])}`);
        pathParts.push(`Q${formatNumber(current[0])},${formatNumber(current[1])} ${formatNumber(endCorner[0])},${formatNumber(endCorner[1])}`);
    }
    return pathParts.join(" ");
}
function computeCornerRadius(prevLength, nextLength, isHorizontal) {
    const minAvailable = Math.min(prevLength, nextLength);
    if (minAvailable <= 0.001)
        return 0;
    const minRadius = isHorizontal ? 16 : 20;
    const idealRadius = isHorizontal ? 32 : 40;
    const growthScale = isHorizontal ? 48 : 64;
    const maxGeometricRadius = Math.max(2, minAvailable / 2);
    const easedTarget = idealRadius * (1 - Math.exp(-minAvailable / growthScale));
    const clampedTarget = Math.max(minRadius, Math.min(easedTarget, idealRadius));
    return Math.min(clampedTarget, maxGeometricRadius);
}

function updateCardsSvg(svg, tree, Card, props = {}) {
    const card = d3
        .select(svg)
        .select(".cards_view")
        .selectAll("g.card_cont")
        .data(tree.data, d => d.data.id);
    const card_exit = card.exit();
    const card_enter = card.enter().append("g").attr("class", "card_cont");
    const card_update = card_enter.merge(card);
    card_exit.each(d => calculateEnterAndExitPositions(d, false, true));
    card_enter.each(d => calculateEnterAndExitPositions(d, true, false));
    card_exit.each(cardExit);
    card_enter.each(cardEnter);
    card_update.each(cardUpdate);
    function cardEnter(d) {
        d3.select(this)
            .attr("transform", `translate(${d._x}, ${d._y})`)
            .style("opacity", 0);
        Card.call(this, d);
    }
    function cardUpdate(d) {
        Card.call(this, d);
        const baseDelay = props.transition_time ? 100 : 0;
        const delay = (props.initial ? calculateDelay(tree, d, props.transition_time) : 0) + baseDelay;
        const config = getTransitionConfig(props.transition_time, delay);
        applyTransition(d3.select(this), config)
            .attr("transform", `translate(${d.x}, ${d.y})`)
            .style("opacity", 1);
    }
    function cardExit(d) {
        const tree_datum = d;
        const pos = tree_datum ? [tree_datum._x, tree_datum._y] : [0, 0];
        const g = d3.select(this);
        g.transition().duration(props.transition_time)
            .style("opacity", 0)
            .attr("transform", `translate(${pos[0]}, ${pos[1]})`)
            .on("end", () => g.remove());
    }
}

function updateCardsHtml(svg, tree, Card, props = {}) {
    const div = getHtmlDiv(svg);
    const card = d3.select(div).select(".cards_view").selectAll("div.card_cont").data(tree.data, d => d.tid);
    const card_exit = card.exit();
    const card_enter = card.enter().append("div").attr("class", "card_cont").style('pointer-events', 'none');
    const card_update = card_enter.merge(card);
    card_exit.each(d => calculateEnterAndExitPositions(d, false, true));
    card_enter.each(d => calculateEnterAndExitPositions(d, true, false));
    card_exit.each(cardExit);
    card_enter.each(cardEnter);
    card_update.each(cardUpdate);
    function cardEnter(d) {
        d3.select(this)
            .style('position', 'absolute')
            .style('top', '0').style('left', '0')
            .style("transform", `translate(${d._x}px, ${d._y}px)`)
            .style("opacity", 0);
        Card.call(this, d);
    }
    function cardUpdate(d) {
        Card.call(this, d);
        const baseDelay = props.transition_time ? 100 : 0;
        const delay = (props.initial ? calculateDelay(tree, d, props.transition_time) : 0) + baseDelay;
        const config = getTransitionConfig(props.transition_time, delay);
        applyTransition(d3.select(this), config)
            .style("transform", `translate(${d.x}px, ${d.y}px)`)
            .style("opacity", 1);
    }
    function cardExit(d) {
        const tree_datum = d;
        const pos = tree_datum ? [tree_datum._x, tree_datum._y] : [0, 0];
        const g = d3.select(this);
        g.transition().duration(props.transition_time)
            .style("opacity", 0)
            .style("transform", `translate(${pos[0]}px, ${pos[1]}px)`)
            .on("end", () => g.remove());
    }
    function getHtmlDiv(svg) {
        if (props.cardHtmlDiv)
            return props.cardHtmlDiv;
        const canvas = svg.closest('#f3Canvas');
        if (!canvas)
            throw new Error('canvas not found');
        const htmlSvg = canvas.querySelector('#htmlSvg');
        if (!htmlSvg)
            throw new Error('htmlSvg not found');
        return htmlSvg;
    }
}

function cardComponentSetup(cont) {
    const getSvgView = () => cont.querySelector('svg .view');
    const getHtmlSvg = () => cont.querySelector('#htmlSvg');
    const getHtmlView = () => cont.querySelector('#htmlSvg .cards_view');
    createSvg(cont, { onZoom: onZoomSetup(getSvgView, getHtmlView) });
    d3.select(getHtmlSvg()).append("div").attr("class", "cards_view_fake").style('display', 'none'); // important for handling data
    return setupReactiveTreeData(getHtmlSvg);
}
function setupReactiveTreeData(getHtmlSvg) {
    let tree_data = [];
    return function getReactiveTreeData(new_tree_data) {
        const tree_data_exit = getTreeDataExit(new_tree_data, tree_data);
        tree_data = [...new_tree_data, ...tree_data_exit];
        assignUniqueIdToTreeData(getCardsViewFake(getHtmlSvg), tree_data);
        return tree_data;
    };
    function assignUniqueIdToTreeData(div, tree_data) {
        const container = d3.select(div);
        const card = container.selectAll("div.card_cont_2fake").data(tree_data, d => d.data.id);
        const card_exit = card.exit();
        const card_enter = card
            .enter()
            .append("div")
            .attr("class", "card_cont_2fake")
            .style('display', 'none')
            .attr("data-id", () => Math.random().toString(36).slice(2));
        const card_update = card_enter.merge(card);
        card_exit.each(cardExit);
        card_enter.each(cardEnter);
        card_update.each(cardUpdate);
        function cardEnter(d) {
            d.unique_id = d3.select(this).attr("data-id");
        }
        function cardUpdate(d) {
            d.unique_id = d3.select(this).attr("data-id");
        }
        function cardExit(d) {
            if (!d)
                return;
            d.unique_id = d3.select(this).attr("data-id");
            d3.select(this).remove();
        }
    }
    function getTreeDataExit(new_tree_data, old_tree_data) {
        if (old_tree_data.length > 0) {
            return old_tree_data.filter(d => !new_tree_data.find(t => t.data.id === d.data.id));
        }
        else {
            return [];
        }
    }
}
function getCardsViewFake(getHtmlSvg) {
    return d3.select(getHtmlSvg()).select("div.cards_view_fake").node();
}
function setupHtmlSvg(getHtmlSvg) {
    d3.select(getHtmlSvg()).append("div").attr("class", "cards_view_fake").style('display', 'none'); // important for handling data
}
const _setupReactiveTreeData = setupReactiveTreeData;
function getUniqueId(d) {
    return d.unique_id;
}

function updateCardsComponent(svg, tree, Card, props = {}) {
    const div = props.cardHtmlDiv ? props.cardHtmlDiv : svg.closest('#f3Canvas').querySelector('#htmlSvg');
    const container = d3.select(getCardsViewFake(() => div));
    const card = container
        .selectAll("div.card_cont_fake")
        .data(tree.data, d => d.data.id);
    const card_exit = card.exit();
    const card_enter = card
        .enter()
        .append("div")
        .attr("class", "card_cont_fake")
        .style('display', 'none');
    const card_update = card_enter.merge(card);
    card_exit.each(d => calculateEnterAndExitPositions(d, false, true));
    card_enter.each(d => calculateEnterAndExitPositions(d, true, false));
    card_exit.each(cardExit);
    card_enter.each(cardEnter);
    card_update.each(cardUpdate);
    function cardEnter(d) {
        const card_element = d3.select(Card(d));
        card_element
            .style('position', 'absolute')
            .style('top', '0').style('left', '0').style("opacity", 0)
            .style("transform", `translate(${d._x}px, ${d._y}px)`);
    }
    function cardUpdate(d) {
        const card_element = d3.select(Card(d));
        const baseDelay = props.transition_time ? 100 : 0;
        const delay = (props.initial ? calculateDelay(tree, d, props.transition_time) : 0) + baseDelay;
        const config = getTransitionConfig(props.transition_time, delay);
        applyTransition(card_element, config)
            .style("transform", `translate(${d.x}px, ${d.y}px)`)
            .style("opacity", 1);
    }
    function cardExit(d) {
        const pos = [d._x, d._y];
        const card_element = d3.select(Card(d));
        const g = d3.select(this);
        card_element.transition().duration(props.transition_time).style("opacity", 0).style("transform", `translate(${pos[0]}px, ${pos[1]}px)`)
            .on("end", () => g.remove()); // remove the card_cont_fake
    }
}

function view (tree, svg, Card, props = {}) {
    const hasInitial = Object.prototype.hasOwnProperty.call(props, 'initial');
    const hasTransitionTime = Object.prototype.hasOwnProperty.call(props, 'transition_time');
    props.initial = hasInitial ? props.initial : !d3.select(svg.parentNode).select('.card_cont').node();
    props.transition_time = hasTransitionTime ? props.transition_time : 1000;
    if (props.cardComponent)
        updateCardsComponent(svg, tree, Card, props);
    else if (props.cardHtml)
        updateCardsHtml(svg, tree, Card, props);
    else
        updateCardsSvg(svg, tree, Card, props);
    updateLinks(svg, tree, props);
    const tree_position = props.tree_position || 'fit';
    if (props.initial)
        treeFit({ svg, svg_dim: svg.getBoundingClientRect(), tree_dim: tree.dim, transition_time: 0 });
    else if (tree_position === 'fit')
        treeFit({ svg, svg_dim: svg.getBoundingClientRect(), tree_dim: tree.dim, transition_time: props.transition_time });
    else if (tree_position === 'main_to_middle')
        cardToMiddle({ datum: tree.data[0], svg, svg_dim: svg.getBoundingClientRect(), scale: props.scale, transition_time: props.transition_time });
    else ;
    return true;
}

function handleLinkRel(updated_datum, link_rel_id, store_data) {
    const new_rel_id = updated_datum.id;
    store_data.forEach(d => {
        if (d.rels.parents.includes(new_rel_id)) {
            d.rels.parents[d.rels.parents.indexOf(new_rel_id)] = link_rel_id;
        }
        if (d.rels.spouses && d.rels.spouses.includes(new_rel_id)) {
            d.rels.spouses = d.rels.spouses.filter(id => id !== new_rel_id);
            if (!d.rels.spouses.includes(link_rel_id))
                d.rels.spouses.push(link_rel_id);
        }
        if (d.rels.children && d.rels.children.includes(new_rel_id)) {
            d.rels.children = d.rels.children.filter(id => id !== new_rel_id);
            if (!d.rels.children.includes(link_rel_id))
                d.rels.children.push(link_rel_id);
        }
    });
    const link_rel = store_data.find(d => d.id === link_rel_id);
    const new_rel = store_data.find(d => d.id === new_rel_id);
    if (!new_rel)
        throw new Error('New rel not found');
    if (!link_rel)
        throw new Error('Link rel not found');
    (new_rel.rels.children || []).forEach(child_id => {
        if (!link_rel.rels.children)
            link_rel.rels.children = [];
        if (!link_rel.rels.children.includes(child_id))
            link_rel.rels.children.push(child_id);
    });
    (new_rel.rels.spouses || []).forEach(spouse_id => {
        if (!link_rel.rels.spouses)
            link_rel.rels.spouses = [];
        if (!link_rel.rels.spouses.includes(spouse_id))
            link_rel.rels.spouses.push(spouse_id);
    });
    if (link_rel.rels.parents.length === 0) {
        link_rel.rels.parents = [...new_rel.rels.parents];
    }
    else {
        const link_rel_father = link_rel.rels.parents.find(id => { var _a; return ((_a = store_data.find(d => d.id === id)) === null || _a === void 0 ? void 0 : _a.data.gender) === "M"; });
        const link_rel_mother = link_rel.rels.parents.find(id => { var _a; return ((_a = store_data.find(d => d.id === id)) === null || _a === void 0 ? void 0 : _a.data.gender) === "F"; });
        const new_rel_father = new_rel.rels.parents.find(id => { var _a; return ((_a = store_data.find(d => d.id === id)) === null || _a === void 0 ? void 0 : _a.data.gender) === "M"; });
        const new_rel_mother = new_rel.rels.parents.find(id => { var _a; return ((_a = store_data.find(d => d.id === id)) === null || _a === void 0 ? void 0 : _a.data.gender) === "F"; });
        if (new_rel_father) {
            if (link_rel_father) {
                console.error('link rel already has father');
                link_rel.rels.parents[link_rel.rels.parents.indexOf(link_rel_father)] = new_rel_father;
            }
            else
                link_rel.rels.parents.push(new_rel_father);
        }
        if (new_rel_mother) {
            if (link_rel_mother) {
                console.error('link rel already has mother');
                link_rel.rels.parents[link_rel.rels.parents.indexOf(link_rel_mother)] = new_rel_mother;
            }
            else
                link_rel.rels.parents.push(new_rel_mother);
        }
    }
    store_data.splice(store_data.findIndex(d => d.id === new_rel_id), 1);
}
function getLinkRelOptions(datum, data) {
    var _a;
    const rel_datum = (_a = data.find(d => { var _a; return d.id === ((_a = datum._new_rel_data) === null || _a === void 0 ? void 0 : _a.rel_id); })) !== null && _a !== void 0 ? _a : null;
    const ancestry_ids = getAncestry(datum, data);
    const progeny_ids = getProgeny(datum, data);
    if (datum._new_rel_data && ['son', 'daughter'].includes(datum._new_rel_data.rel_type)) {
        if (!rel_datum)
            throw new Error('Rel datum not found');
        progeny_ids.push(...getProgeny(rel_datum, data));
    }
    return data.filter(d => d.id !== datum.id && d.id !== (rel_datum === null || rel_datum === void 0 ? void 0 : rel_datum.id) && !d._new_rel_data && !d.to_add && !d.unknown)
        .filter(d => !ancestry_ids.includes(d.id))
        .filter(d => !progeny_ids.includes(d.id))
        .filter(d => !(d.rels.spouses || []).includes(datum.id));
    function getAncestry(datum, data_stash) {
        const ancestry_ids = [];
        loopCheck(datum);
        return ancestry_ids;
        function loopCheck(d) {
            d.rels.parents.forEach(p_id => {
                if (p_id) {
                    ancestry_ids.push(p_id);
                    const parent = data_stash.find(d => d.id === p_id);
                    if (!parent)
                        throw new Error('Parent not found');
                    loopCheck(parent);
                }
            });
        }
    }
    function getProgeny(datum, data_stash) {
        const progeny_ids = [];
        loopCheck(datum);
        return progeny_ids;
        function loopCheck(d) {
            const children = d.rels.children ? [...d.rels.children] : [];
            children.forEach(c_id => {
                progeny_ids.push(c_id);
                const child = data_stash.find(d => d.id === c_id);
                if (!child)
                    throw new Error('Child not found');
                loopCheck(child);
            });
        }
    }
}

function formatPersonName(input) {
    var _a, _b, _c, _d;
    if (!input)
        return "";
    const asUnknown = input;
    const datum = (asUnknown && typeof asUnknown.data === "object")
        ? asUnknown
        : { id: (_a = asUnknown === null || asUnknown === void 0 ? void 0 : asUnknown.id) !== null && _a !== void 0 ? _a : "", data: (_b = asUnknown === null || asUnknown === void 0 ? void 0 : asUnknown.data) !== null && _b !== void 0 ? _b : {} };
    const rawFirst = (_c = datum.data) === null || _c === void 0 ? void 0 : _c["first name"];
    const rawLast = (_d = datum.data) === null || _d === void 0 ? void 0 : _d["last name"];
    const first = typeof rawFirst === "string" ? rawFirst.trim() : "";
    const last = typeof rawLast === "string" ? rawLast.trim() : "";
    const parts = [first, last].filter(Boolean);
    if (parts.length > 0)
        return parts.join(" ");
    const fallbackId = typeof datum.id === "string" && datum.id.trim().length > 0 ? datum.id.trim() : "";
    return fallbackId ? `Profil ${fallbackId}` : "Profil sans nom";
}

function formCreatorSetup({ datum, store, fields, postSubmitHandler, addRelative, removeRelative, deletePerson, onCancel, editFirst, link_existing_rel_config, onFormCreation, no_edit, onSubmit, onDelete, canEdit, canDelete, }) {
    const warnedRelReferenceGetRelLabel = new Set();
    let can_delete = canDelete ? canDelete(datum) : true;
    const can_edit = canEdit ? canEdit(datum) : true;
    if (!can_edit) {
        no_edit = true;
        can_delete = false;
    }
    let form_creator;
    const base_form_creator = {
        datum_id: datum.id,
        fields: [],
        onSubmit: submitFormChanges,
        onCancel: onCancel,
        onFormCreation: onFormCreation,
        no_edit: no_edit,
    };
    if (!datum._new_rel_data) {
        if (!addRelative)
            throw new Error('addRelative is required');
        if (!removeRelative)
            throw new Error('removeRelative is required');
        form_creator = Object.assign(Object.assign({}, base_form_creator), { onDelete: deletePersonWithPostSubmit, addRelative: () => addRelative.activate(datum), addRelativeCancel: () => addRelative.onCancel(), addRelativeActive: addRelative.is_active, removeRelative: () => removeRelative.activate(datum), removeRelativeCancel: () => removeRelative.onCancel(), removeRelativeActive: removeRelative.is_active, editable: false, can_delete: can_delete });
    }
    else {
        form_creator = Object.assign(Object.assign({}, base_form_creator), { title: datum._new_rel_data.label, new_rel: true, editable: true });
    }
    if (datum._new_rel_data || datum.to_add || datum.unknown) {
        if (link_existing_rel_config)
            form_creator.linkExistingRelative = createLinkExistingRelative(datum, store.getData(), link_existing_rel_config);
    }
    if (no_edit)
        form_creator.editable = false;
    else if (editFirst)
        form_creator.editable = true;
    const toInitialValue = (value) => {
        if (value === null || value === undefined)
            return '';
        return String(value);
    };
    const getLabel = (field) => ('label' in field && field.label) ? field.label : field.id;
    const getType = (field) => ('type' in field && field.type) ? field.type : 'text';
    function isRelReferenceCreator(f) {
        return typeof f.getRelLabel === 'function' || (('type' in f) && (f['type'] === 'rel_reference'));
    }
    fields.forEach(field => {
        if ('initial_value' in field) {
            form_creator.fields.push(field);
            return;
        }
        const type = getType(field);
        const label = getLabel(field);
        if (type === 'rel_reference') {
            const providedGetRelLabel = isRelReferenceCreator(field) && typeof field.getRelLabel === 'function'
                ? field.getRelLabel
                : undefined;
            const defaultGetRelLabel = (d) => {
                try {
                    if (d)
                        return formatPersonName(d);
                }
                catch (_a) {
                }
                return 'Profil sans nom';
            };
            const relField = {
                id: field.id,
                label,
                rel_type: ('rel_type' in field ? field.rel_type : 'spouse'),
                getRelLabel: providedGetRelLabel || defaultGetRelLabel,
            };
            if (!providedGetRelLabel) {
                const warnKey = field.id || '__rel_reference_missing_getRelLabel__';
                if (!warnedRelReferenceGetRelLabel.has(warnKey)) {
                    console.debug('rel_reference field creator did not provide getRelLabel — using default');
                    warnedRelReferenceGetRelLabel.add(warnKey);
                }
            }
            addRelReferenceField(relField);
            return;
        }
        if (type === 'select') {
            const selectCreator = {
                id: field.id,
                type: 'select',
                label,
                placeholder: 'placeholder' in field ? field.placeholder : undefined,
                options: 'options' in field ? field.options : undefined,
                optionCreator: 'optionCreator' in field ? field.optionCreator : undefined,
            };
            addSelectField(selectCreator);
            return;
        }
        form_creator.fields.push({
            id: field.id,
            type,
            label,
            initial_value: toInitialValue(datum.data[field.id])
        });
    });
    return form_creator;
    function addRelReferenceField(field) {
        if (!field.getRelLabel)
            console.error('getRelLabel is not set');
        if (field.rel_type === 'spouse') {
            (datum.rels.spouses || []).forEach(spouse_id => {
                const spouse = store.getDatum(spouse_id);
                if (!spouse)
                    throw new Error('Spouse not found');
                const marriage_date_id = `${field.id}__ref__${spouse_id}`;
                const relLabel = formatPersonName(spouse);
                const rel_reference_field = {
                    id: marriage_date_id,
                    type: 'rel_reference',
                    label: field.label,
                    rel_id: spouse_id,
                    rel_label: relLabel,
                    initial_value: toInitialValue(datum.data[marriage_date_id]),
                    rel_type: field.rel_type,
                };
                form_creator.fields.push(rel_reference_field);
            });
        }
    }
    function addSelectField(field) {
        if (!field.options && !field.optionCreator)
            return console.error('optionCreator or options is not set for field', field);
        const options = field.options || (field.optionCreator ? field.optionCreator(datum) : []);
        const select_field = {
            id: field.id,
            type: field.type,
            label: field.label,
            initial_value: toInitialValue(datum.data[field.id]),
            placeholder: field.placeholder,
            options,
        };
        form_creator.fields.push(select_field);
    }
    function createLinkExistingRelative(datum, data, link_existing_rel_config) {
        if (!link_existing_rel_config)
            throw new Error('link_existing_rel_config is required');
        const obj = {
            title: link_existing_rel_config.title,
            select_placeholder: link_existing_rel_config.select_placeholder,
            options: getLinkRelOptions(datum, data)
                .map((d) => ({ value: d.id, label: link_existing_rel_config.linkRelLabel(d) }))
                .sort((a, b) => {
                if (typeof a.label === 'string' && typeof b.label === 'string')
                    return a.label.localeCompare(b.label);
                else
                    return a.label < b.label ? -1 : 1;
            }),
            onSelect: submitLinkExistingRelative
        };
        return obj;
    }
    function submitFormChanges(e) {
        if (onSubmit) {
            onSubmit(e, datum, applyChanges, () => postSubmitHandler({}));
        }
        else {
            e.preventDefault();
            applyChanges();
            postSubmitHandler({});
        }
        function applyChanges() {
            const form_data = new FormData(e.target);
            submitFormData(datum, store.getData(), form_data);
        }
    }
    function submitLinkExistingRelative(e) {
        const link_rel_id = e.target.value;
        postSubmitHandler({ link_rel_id: link_rel_id });
    }
    function deletePersonWithPostSubmit() {
        if (onDelete) {
            onDelete(datum, () => deletePerson(), () => postSubmitHandler({ delete: true }));
        }
        else {
            deletePerson();
            postSubmitHandler({ delete: true });
        }
    }
}

function createHistory(store, getStoreDataCopy, onUpdate) {
    let history = [];
    let history_index = -1;
    return {
        changed,
        back,
        forward,
        canForward,
        canBack
    };
    function changed() {
        if (history_index < history.length - 1)
            history = history.slice(0, history_index + 1);
        const clean_data = getStoreDataCopy();
        clean_data.main_id = store.getMainId();
        history.push(clean_data);
        history_index++;
    }
    function back() {
        if (!canBack())
            return;
        history_index--;
        updateData(history[history_index]);
    }
    function forward() {
        if (!canForward())
            return;
        history_index++;
        updateData(history[history_index]);
    }
    function canForward() {
        return history_index < history.length - 1;
    }
    function canBack() {
        return history_index > 0;
    }
    function updateData(data) {
        const current_main_id = store.getMainId();
        data = JSON.parse(JSON.stringify(data));
        if (!data.find(d => d.id === current_main_id))
            store.updateMainId(data.main_id);
        store.updateData(data);
        onUpdate();
    }
}
function createHistoryControls(cont, history) {
    const history_controls = d3.select(cont).append("div").attr("class", "f3-history-controls");
    cont.insertBefore(history_controls.node(), cont.firstChild);
    const back_btn = history_controls.append("button").attr("class", "f3-back-button").on("click", () => {
        history.back();
        updateButtons();
    });
    const forward_btn = history_controls.append("button").attr("class", "f3-forward-button").on("click", () => {
        history.forward();
        updateButtons();
    });
    updateSelectionHtml(back_btn, historyBackSvgIcon(), 'History back icon');
    updateSelectionHtml(forward_btn, historyForwardSvgIcon(), 'History forward icon');
    return {
        back_btn: back_btn.node(),
        forward_btn: forward_btn.node(),
        updateButtons,
        destroy
    };
    function updateButtons() {
        back_btn.classed("disabled", !history.canBack());
        forward_btn.classed("disabled", !history.canForward());
        if (!history.canBack() && !history.canForward()) {
            history_controls.style("opacity", 0).style("pointer-events", "none");
        }
        else {
            history_controls.style("opacity", 1).style("pointer-events", "auto");
        }
    }
    function destroy() {
        d3.select(cont).select('.f3-history-controls').remove();
    }
}

const fr = {
    add: {
        father: 'Ajouter un père',
        mother: 'Ajouter une mère',
        spouse: 'Ajouter un conjoint',
        son: 'Ajouter un fils',
        daughter: 'Ajouter une fille'
    },
    form: {
        cancel: 'Annuler',
        save: 'Enregistrer'},
    union: {
        title: 'Unions et conjoints',
        unionWith: 'Union avec'
    }};

function getHtmlNew(form_creator) {
    return (` 
    <form id="familyForm" class="f3-form">
      ${closeBtn()}
      <h3 class="f3-form-title">${escapeHtml(form_creator.title)}</h3>

      ${fields(form_creator)}
      
      <div class="f3-form-buttons">
        <button type="button" class="f3-cancel-btn">${escapeHtml(fr.form.cancel)}</button>
        <button type="submit">${escapeHtml(fr.form.save)}</button>
      </div>

      ${form_creator.linkExistingRelative ? addLinkExistingRelative(form_creator) : ''}
    </form>
  `);
}
function getHtmlEdit(form_creator) {
    return (` 
    <form id="familyForm" class="f3-form ${form_creator.editable ? '' : 'non-editable'}">
      ${closeBtn()}
      
      <div class="tabs-nav" style="margin-top: 20px;">
        <button type="button" class="active" data-tab="details">Détails</button>
        <button type="button" data-tab="files">Fichiers</button>
      </div>

      <div class="tab-content active" data-tab-content="details">
        <div style="text-align: right; display: 'block'">
          ${!form_creator.no_edit ? addRelativeBtn(form_creator) : ''}
        </div>

        ${fields(form_creator)}
        
        <div class="f3-form-buttons">
          <button type="button" class="f3-cancel-btn">${escapeHtml(fr.form.cancel)}</button>
          <button type="submit">${escapeHtml(fr.form.save)}</button>
        </div>

        ${form_creator.linkExistingRelative ? addLinkExistingRelative(form_creator) : ''}

        <hr>
        ${deleteBtn(form_creator)}

        ${removeRelativeBtn(form_creator)}
      </div>

      <div class="tab-content" data-tab-content="files">
        <div class="f3-files-placeholder" style="padding: 1rem; text-align: center; color: #666;">
            <p>Documents liés à la personne (Bientôt disponible)</p>
        </div>
      </div>
    </form>
  `);
}
function deleteBtn(form_creator) {
    return (`
    <div>
      <button type="button" class="f3-delete-btn" ${form_creator.can_delete ? '' : 'disabled'}>
        Supprimer
      </button>
    </div>
  `);
}
function removeRelativeBtn(form_creator) {
    return (`
    <div>
      <button type="button" class="f3-remove-relative-btn${form_creator.removeRelativeActive ? ' active' : ''}">
        ${form_creator.removeRelativeActive ? 'Annuler la suppression du lien' : 'Supprimer le lien'}
      </button>
    </div>
  `);
}
function addRelativeBtn(form_creator) {
    return (`
    <span class="f3-add-relative-btn">
      ${form_creator.addRelativeActive ? userPlusCloseSvgIcon() : userPlusSvgIcon()}
    </span>
  `);
}
function fields(form_creator) {
    if (!form_creator.editable)
        return infoField();
    const unionFields = new Map();
    const orderedFields = [];
    form_creator.fields.forEach(field => {
        if (isUnionReferenceField(field)) {
            const unionField = field;
            const relId = unionField.rel_id;
            if (!relId)
                return;
            const bucket = unionFields.get(relId) || { relLabel: unionField.rel_label };
            const unionFieldType = getUnionFieldType(unionField.id);
            if (unionFieldType === 'date')
                bucket.dateField = unionField;
            else if (unionFieldType === 'place')
                bucket.placeField = unionField;
            else
                orderedFields.push(unionField);
            unionFields.set(relId, bucket);
            return;
        }
        orderedFields.push(field);
    });
    const unionSectionHtml = renderUnionSection(unionFields);
    let fields_html = '';
    orderedFields.forEach(field => {
        fields_html += renderFormField(field);
    });
    if (unionSectionHtml) {
        fields_html += unionSectionHtml;
    }
    return fields_html;
    function infoField() {
        let fields_html = '';
        form_creator.fields.forEach(field => {
            var _a;
            if (field.type === 'rel_reference') {
                const rf = field;
                if (!rf.initial_value)
                    return;
                const relLabelSanitized = sanitizeRelLabel(rf.rel_label);
                fields_html += `
          <div class="f3-info-field">
            <span class="f3-info-field-label">${rf.label} - <i>${relLabelSanitized}</i></span>
            <span class="f3-info-field-value">${rf.initial_value || ''}</span>
          </div>`;
            }
            else if (field.type === 'select') {
                const select_field = field;
                if (!field.initial_value)
                    return;
                fields_html += `
        <div class="f3-info-field">
          <span class="f3-info-field-label">${select_field.label}</span>
          <span class="f3-info-field-value">${((_a = select_field.options.find(option => option.value === select_field.initial_value)) === null || _a === void 0 ? void 0 : _a.label) || ''}</span>
        </div>`;
            }
            else {
                fields_html += `
        <div class="f3-info-field">
          <span class="f3-info-field-label">${field.label}</span>
          <span class="f3-info-field-value">${field.initial_value || ''}</span>
        </div>`;
            }
        });
        return fields_html;
    }
    function isUnionReferenceField(field) {
        if (!field || typeof field !== 'object')
            return false;
        const candidate = field;
        if (candidate.type !== 'rel_reference' || typeof candidate.id !== 'string')
            return false;
        return getUnionFieldType(candidate.id) !== null;
    }
    function renderFormField(field) {
        if (field.type === 'text') {
            return `
      <div class="f3-form-field">
        <label>${field.label}</label>
        <input type="${field.type}" 
          name="${field.id}" 
          value="${escapeHtml(field.initial_value || '')}"
          placeholder="${escapeHtml(field.label)}">
      </div>`;
        }
        if (field.type === 'textarea') {
            return `
      <div class="f3-form-field">
        <label>${field.label}</label>
        <textarea name="${field.id}" 
          placeholder="${escapeHtml(field.label)}">${escapeHtml(field.initial_value || '')}</textarea>
      </div>`;
        }
        if (field.type === 'select') {
            const select_field = field;
            return `
      <div class="f3-form-field">
        <label>${select_field.label}</label>
        <select name="${select_field.id}" value="${select_field.initial_value || ''}">
          <option value="">${escapeHtml(select_field.placeholder || `Sélectionnez ${select_field.label}`)}</option>
          ${select_field.options.map((option) => `<option ${option.value === select_field.initial_value ? 'selected' : ''} value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join('')}
        </select>
      </div>`;
        }
        if (field.type === 'rel_reference') {
            const rf = field;
            const relLabel = sanitizeRelLabel(rf.rel_label);
            return `
      <div class="f3-form-field">
        <label>${rf.label} - <i>${relLabel}</i></label>
        <input type="text" 
          name="${rf.id}" 
          value="${escapeHtml(rf.initial_value || '')}"
          placeholder="${escapeHtml(rf.label)}">
      </div>`;
        }
        return '';
    }
    function renderUnionSection(collection) {
        var _a, _b;
        if (!collection || collection.size === 0)
            return '';
        let html = `
    <section class="f3-union-section">
      <h4 class="f3-union-title">${(_b = (_a = fr.union) === null || _a === void 0 ? void 0 : _a.title) !== null && _b !== void 0 ? _b : 'Unions et conjoints'}</h4>`;
        let hasContent = false;
        collection.forEach(bucket => {
            var _a, _b;
            const heading = sanitizeRelLabel(bucket.relLabel || 'Conjoint');
            const dateField = bucket.dateField;
            const placeField = bucket.placeField;
            const dateHtml = renderUnionInput(dateField);
            const placeHtml = renderUnionInput(placeField);
            if (!dateHtml && !placeHtml)
                return;
            hasContent = true;
            html += `
      <div class="f3-union-entry">
        <p class="f3-union-entry-heading">${(_b = (_a = fr.union) === null || _a === void 0 ? void 0 : _a.unionWith) !== null && _b !== void 0 ? _b : 'Union avec'} <strong>${heading}</strong></p>
        <div class="f3-union-fields">
          ${dateHtml}
          ${placeHtml}
        </div>
      </div>`;
        });
        html += `
    </section>`;
        return hasContent ? html : '';
    }
    function renderUnionInput(field) {
        if (!field)
            return '';
        return `
          <div class="f3-form-field f3-union-field">
            <label>${field.label}</label>
            <input type="text" 
              name="${field.id}" 
              value="${field.initial_value || ''}"
              placeholder="${field.label}">
          </div>`;
    }
    function sanitizeRelLabel(label) {
        if (!label)
            return '';
        const cleaned = label
            .replace(/\s*\([^)]*\)/g, ' ')
            .replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g, ' ')
            .replace(/\b\d{4}\b/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();
        return cleaned;
    }
}
function getUnionFieldType(fieldId) {
    if (typeof fieldId !== 'string')
        return null;
    const delimiterIndex = fieldId.indexOf('__ref__');
    if (delimiterIndex === -1)
        return null;
    const prefix = fieldId.slice(0, delimiterIndex);
    const normalized = prefix
        .toLowerCase()
        .replace(/[^a-z]+/g, ' ')
        .trim();
    const cleaned = normalized.replace(/[^a-z]+/g, '');
    if (cleaned === 'uniondate' || (normalized.startsWith('union') && normalized.includes('date')))
        return 'date';
    if (cleaned === 'unionplace' || (normalized.startsWith('union') && normalized.includes('place')))
        return 'place';
    return null;
}
function addLinkExistingRelative(form_creator) {
    const link = form_creator.linkExistingRelative;
    const title = link && Object.prototype.hasOwnProperty.call(link, 'title') ? link.title : 'Profil déjà présent ?';
    const select_placeholder = link && Object.prototype.hasOwnProperty.call(link, 'select_placeholder') ? link.select_placeholder : 'Sélectionnez un profil';
    const options = link ? link.options : [];
    return (`
    <div>
      <hr>
      <div class="f3-link-existing-relative">
        <label>${title}</label>
        <select>
          <option value="">${select_placeholder}</option>
          ${options.map(option => `<option value="${option.value}">${option.label}</option>`).join('')}
        </select>
      </div>
    </div>
  `);
}
function closeBtn() {
    return (`
    <span class="f3-close-btn">
      ×
    </span>
  `);
}

/**
 * Initializes a tab system within a container.
 * @param {string|HTMLElement} containerSelector - The container element or selector.
 */
function initTabs(containerSelector) {
    const container = typeof containerSelector === 'string'
        ? document.querySelector(containerSelector)
        : containerSelector;
    if (!container)
        return;
    const tabButtons = container.querySelectorAll('.tabs-nav > [data-tab], [data-tab]');
    if (tabButtons.length === 0)
        return;
    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const targetName = button.dataset.tab;
            // Deactivate all buttons in this specific nav
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const contents = container.querySelectorAll(`[data-tab-content]`);
            contents.forEach(content => {
                if (content.dataset.tabContent === targetName) {
                    content.classList.add('active');
                }
                else {
                    // Simple check: if the content's tab name matches ONE OF the buttons in this group, hide it.
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

function createFormNew(form_creator, closeCallback) {
    return createForm(form_creator, closeCallback);
}
function createFormEdit(form_creator, closeCallback) {
    return createForm(form_creator, closeCallback);
}
function createForm(form_creator, closeCallback) {
    const is_new = isNewRelFormCreator(form_creator);
    const formContainer = document.createElement('div');
    reload();
    return formContainer;
    function reload() {
        const formHtml = is_new ? getHtmlNew(form_creator) : getHtmlEdit(form_creator);
        setElementHtml(formContainer, formHtml, 'Form renderer');
        initTabs(formContainer);
        setupEventListenersBase(formContainer, form_creator, closeCallback, reload);
        if (is_new)
            setupEventListenersNew(formContainer, form_creator);
        else
            setupEventListenersEdit(formContainer, form_creator, reload);
        if (form_creator.onFormCreation) {
            form_creator.onFormCreation({
                cont: formContainer,
                form_creator: form_creator
            });
        }
    }
    function isNewRelFormCreator(form_creator) {
        return 'new_rel' in form_creator;
    }
}
function setupEventListenersBase(formContainer, form_creator, closeCallback, reload) {
    const form = formContainer.querySelector('form');
    form.addEventListener('submit', form_creator.onSubmit);
    const cancel_btn = form.querySelector('.f3-cancel-btn');
    cancel_btn.addEventListener('click', onCancel);
    const close_btn = form.querySelector('.f3-close-btn');
    close_btn.addEventListener('click', closeCallback);
    function onCancel() {
        form_creator.editable = false;
        if (form_creator.onCancel)
            form_creator.onCancel();
        reload();
    }
}
function setupEventListenersNew(formContainer, form_creator) {
    const form = formContainer.querySelector('form');
    const link_existing_relative_select = form.querySelector('.f3-link-existing-relative select');
    if (link_existing_relative_select && form_creator.linkExistingRelative) {
        link_existing_relative_select.addEventListener('change', form_creator.linkExistingRelative.onSelect);
    }
}
function setupEventListenersEdit(formContainer, form_creator, reload) {
    const form = formContainer.querySelector('form');
    const edit_btn = form.querySelector('.f3-edit-btn');
    if (edit_btn)
        edit_btn.addEventListener('click', onEdit);
    const delete_btn = form.querySelector('.f3-delete-btn');
    if (delete_btn && form_creator.onDelete) {
        delete_btn.addEventListener('click', form_creator.onDelete);
    }
    const add_relative_btn = form.querySelector('.f3-add-relative-btn');
    if (add_relative_btn && form_creator.addRelative) {
        add_relative_btn.addEventListener('click', () => {
            if (form_creator.addRelativeActive)
                form_creator.addRelativeCancel();
            else
                form_creator.addRelative();
            form_creator.addRelativeActive = !form_creator.addRelativeActive;
            reload();
        });
    }
    const remove_relative_btn = form.querySelector('.f3-remove-relative-btn');
    if (remove_relative_btn && form_creator.removeRelative) {
        remove_relative_btn.addEventListener('click', () => {
            if (form_creator.removeRelativeActive)
                form_creator.removeRelativeCancel();
            else
                form_creator.removeRelative();
            form_creator.removeRelativeActive = !form_creator.removeRelativeActive;
            reload();
        });
    }
    const link_existing_relative_select = form.querySelector('.f3-link-existing-relative select');
    if (link_existing_relative_select && form_creator.linkExistingRelative) {
        link_existing_relative_select.addEventListener('change', form_creator.linkExistingRelative.onSelect);
    }
    function onEdit() {
        form_creator.editable = !form_creator.editable;
        reload();
    }
}

function updateGendersForNewRelatives(_updatedDatum, data) {
    data.forEach(d => {
        const rd = d._new_rel_data;
        if (!rd)
            return;
        if (rd.rel_type === 'spouse')
            d.data.gender = d.data.gender === 'M' ? 'F' : 'M';
    });
}
function cleanUp(data) {
    for (let i = data.length - 1; i >= 0; i--) {
        const d = data[i];
        if (d._new_rel_data) {
            data.forEach(d2 => {
                if (d2.rels.parents.includes(d.id))
                    d2.rels.parents.splice(d2.rels.parents.indexOf(d.id), 1);
                if (d2.rels.children && d2.rels.children.includes(d.id))
                    d2.rels.children.splice(d2.rels.children.indexOf(d.id), 1);
                if (d2.rels.spouses && d2.rels.spouses.includes(d.id))
                    d2.rels.spouses.splice(d2.rels.spouses.indexOf(d.id), 1);
            });
            data.splice(i, 1);
        }
    }
}
function addDatumRelsPlaceholders(datum, store_data, addRelLabels, canAdd) {
    let can_add = { parent: true, spouse: true, child: true };
    if (canAdd)
        can_add = Object.assign(can_add, canAdd(datum));
    if (!datum.rels.spouses)
        datum.rels.spouses = [];
    if (!datum.rels.children)
        datum.rels.children = [];
    if (can_add.parent)
        addParents();
    if (can_add.spouse) {
        addSpouseForSingleParentChildren();
        addSpouse();
    }
    if (can_add.child)
        addChildren();
    function addParents() {
        const parents = datum.rels.parents;
        const father = parents.find(d_id => { var _a; return ((_a = store_data.find(d => d.id === d_id)) === null || _a === void 0 ? void 0 : _a.data.gender) === "M"; });
        const mother = parents.find(d_id => { var _a; return ((_a = store_data.find(d => d.id === d_id)) === null || _a === void 0 ? void 0 : _a.data.gender) === "F"; });
        if (parents.length < 2 && !father) {
            const father = createNewPerson({ data: { gender: "M" }, rels: { children: [datum.id] } });
            father._new_rel_data = { rel_type: "father", label: addRelLabels.father, rel_id: datum.id };
            datum.rels.parents.push(father.id);
            store_data.push(father);
        }
        if (parents.length < 2 && !mother) {
            const mother = createNewPerson({ data: { gender: "F" }, rels: { children: [datum.id] } });
            mother._new_rel_data = { rel_type: "mother", label: addRelLabels.mother, rel_id: datum.id };
            datum.rels.parents.push(mother.id);
            store_data.push(mother);
        }
        const p1 = store_data.find(d => d.id === datum.rels.parents[0]);
        const p2 = store_data.find(d => d.id === datum.rels.parents[1]);
        if (!p1.rels.spouses)
            p1.rels.spouses = [];
        if (!p2.rels.spouses)
            p2.rels.spouses = [];
        if (!p1.rels.spouses.includes(p2.id))
            p1.rels.spouses.push(p2.id);
        if (!p2.rels.spouses.includes(p1.id))
            p2.rels.spouses.push(p1.id);
        if (!p1.rels.children)
            p1.rels.children = [];
        if (!p2.rels.children)
            p2.rels.children = [];
        if (!p1.rels.children.includes(datum.id))
            p1.rels.children.push(datum.id);
        if (!p2.rels.children.includes(datum.id))
            p2.rels.children.push(datum.id);
    }
    function addSpouseForSingleParentChildren() {
        if (!datum.rels.spouses)
            datum.rels.spouses = [];
        if (datum.rels.children) {
            let new_spouse;
            datum.rels.children.forEach(child_id => {
                const child = store_data.find(d => d.id === child_id);
                if (child.rels.parents.length === 1) {
                    const p1 = store_data.find(d => d.id === child.rels.parents[0]);
                    const new_spouse_gender = p1.data.gender === "M" ? "F" : "M";
                    if (!new_spouse)
                        new_spouse = createNewPerson({ data: { gender: new_spouse_gender }, rels: { spouses: [datum.id] } });
                    new_spouse._new_rel_data = { rel_type: "spouse", label: addRelLabels.spouse, rel_id: datum.id };
                    new_spouse.rels.children.push(child.id);
                    datum.rels.spouses.push(new_spouse.id);
                    child.rels.parents.push(new_spouse.id);
                    store_data.push(new_spouse);
                }
            });
        }
    }
    function addSpouse() {
        if (!datum.rels.spouses)
            datum.rels.spouses = [];
        const spouse_gender = datum.data.gender === "M" ? "F" : "M";
        const new_spouse = createNewPerson({ data: { gender: spouse_gender }, rels: { spouses: [datum.id] } });
        new_spouse._new_rel_data = { rel_type: "spouse", label: addRelLabels.spouse, rel_id: datum.id };
        datum.rels.spouses.push(new_spouse.id);
        store_data.push(new_spouse);
    }
    function addChildren() {
        if (!datum.rels.children)
            datum.rels.children = [];
        if (!datum.rels.spouses)
            datum.rels.spouses = [];
        datum.rels.spouses.forEach(spouse_id => {
            const spouse = store_data.find(d => d.id === spouse_id);
            if (!spouse.rels.children)
                spouse.rels.children = [];
            const new_son = createNewPerson({ data: { gender: "M" }, rels: { parents: [datum.id, spouse.id] } });
            new_son._new_rel_data = { rel_type: "son", label: addRelLabels.son, other_parent_id: spouse.id, rel_id: datum.id };
            spouse.rels.children.push(new_son.id);
            datum.rels.children.push(new_son.id);
            store_data.push(new_son);
            const new_daughter = createNewPerson({ data: { gender: "F" }, rels: { parents: [datum.id, spouse.id] } });
            new_daughter._new_rel_data = { rel_type: "daughter", label: addRelLabels.daughter, other_parent_id: spouse.id, rel_id: datum.id };
            spouse.rels.children.push(new_daughter.id);
            datum.rels.children.push(new_daughter.id);
            store_data.push(new_daughter);
        });
    }
    return store_data;
}

var addRelative = (store, onActivate, cancelCallback) => { return new AddRelative(store, onActivate, cancelCallback); };
class AddRelative {
    constructor(store, onActivate, cancelCallback) {
        this.store = store;
        this.onActivate = onActivate;
        this.cancelCallback = cancelCallback;
        this.datum = null;
        this.onChange = null;
        this.onCancel = null;
        this.is_active = false;
        this.addRelLabels = this.addRelLabelsDefault();
        return this;
    }
    activate(datum) {
        if (this.is_active)
            this.onCancel();
        this.onActivate();
        this.is_active = true;
        this.store.state.one_level_rels = true;
        const store = this.store;
        this.datum = datum;
        let gender_stash = this.datum.data.gender;
        addDatumRelsPlaceholders(datum, this.getStoreData(), this.addRelLabels, this.canAdd);
        store.updateTree({});
        this.onChange = onChange;
        this.onCancel = () => onCancel(this);
        function onChange(updated_datum, props) {
            if (updated_datum === null || updated_datum === void 0 ? void 0 : updated_datum._new_rel_data) {
                if (typeof (props === null || props === void 0 ? void 0 : props.link_rel_id) === 'string')
                    handleLinkRel(updated_datum, props.link_rel_id, store.getData());
                else
                    delete updated_datum._new_rel_data;
            }
            else if (updated_datum.id === datum.id) {
                if (updated_datum.data.gender !== gender_stash) {
                    gender_stash = updated_datum.data.gender;
                    updateGendersForNewRelatives(updated_datum, store.getData());
                }
            }
            else {
                console.error('Something went wrong');
            }
        }
        function onCancel(self) {
            if (!self.is_active)
                return;
            self.is_active = false;
            self.store.state.one_level_rels = false;
            self.cleanUp();
            self.cancelCallback(self.datum);
            self.datum = null;
            self.onChange = null;
            self.onCancel = null;
        }
    }
    setAddRelLabels(add_rel_labels) {
        if (typeof add_rel_labels !== 'object') {
            console.error('add_rel_labels must be an object');
            return;
        }
        for (const key in add_rel_labels) {
            const key_str = key;
            this.addRelLabels[key_str] = add_rel_labels[key_str];
        }
        return this;
    }
    setCanAdd(canAdd) {
        this.canAdd = canAdd;
        return this;
    }
    addRelLabelsDefault() {
        return fr.add;
    }
    getStoreData() {
        return this.store.getData();
    }
    cleanUp(data) {
        if (!data)
            data = this.store.getData();
        cleanUp(data);
        return data;
    }
}

var removeRelative = (store, onActivate, cancelCallback, modal) => { return new RemoveRelative(store, onActivate, cancelCallback, modal); };
class RemoveRelative {
    constructor(store, onActivate, cancelCallback, modal) {
        this.store = store;
        this.onActivate = onActivate;
        this.cancelCallback = cancelCallback;
        this.modal = modal;
        this.datum = null;
        this.onChange = null;
        this.onCancel = null;
        this.is_active = false;
        return this;
    }
    activate(datum) {
        if (this.is_active)
            this.onCancel();
        this.onActivate();
        this.is_active = true;
        this.store.state.one_level_rels = true;
        const store = this.store;
        store.updateTree({});
        this.datum = datum;
        this.onChange = onChange.bind(this);
        this.onCancel = onCancel.bind(this);
        function onChange(rel_tree_datum, onAccept) {
            const rel_type = findRelType(rel_tree_datum);
            const rels = datum.rels;
            if (rel_type === 'parent')
                handleParentRemoval.call(this);
            else if (rel_type === 'spouse')
                handleSpouseRemoval.call(this);
            else if (rel_type === 'children')
                handleChildrenRemoval.call(this);
            function handleParentRemoval() {
                const rel_id = rel_tree_datum.data.id;
                const parent = store.getDatum(rel_id);
                if (!parent)
                    throw new Error('Parent not found');
                if (!parent.rels.children)
                    throw new Error('Parent has no children');
                parent.rels.children = parent.rels.children.filter(id => id !== datum.id);
                rels.parents = rels.parents.filter(id => id !== rel_id);
                onAccept();
            }
            function handleSpouseRemoval() {
                const spouse = rel_tree_datum.data;
                if (checkIfChildrenWithSpouse())
                    openModal.call(this);
                else
                    remove.call(this, true);
                function checkIfChildrenWithSpouse() {
                    const children = spouse.rels.children || [];
                    return children.some(ch_id => {
                        const child = store.getDatum(ch_id);
                        if (!child)
                            throw new Error('Child not found');
                        if (child.rels.parents.includes(spouse.id))
                            return true;
                        return false;
                    });
                }
                function openModal() {
                    const current_gender_class = datum.data.gender === 'M' ? 'f3-male-bg' : datum.data.gender === 'F' ? 'f3-female-bg' : null;
                    const spouse_gender_class = spouse.data.gender === 'M' ? 'f3-male-bg' : spouse.data.gender === 'F' ? 'f3-female-bg' : null;
                    const div = d3.create('div');
                    updateSelectionHtml(div, `
            <p>Vous supprimez un lien de conjoint. Comme des enfants sont partagés, choisissez quel parent doit les conserver dans l'arbre.</p>
            <div class="f3-modal-options">
              <button data-option="assign-to-current" class="f3-btn ${current_gender_class}">Garder les enfants avec la personne actuelle</button>
              <button data-option="assign-to-spouse" class="f3-btn ${spouse_gender_class}">Garder les enfants avec le conjoint</button>
            </div>
          `, 'Remove relative confirmation');
                    div.selectAll('[data-option="assign-to-current"]').on('click', () => {
                        remove(true);
                        this.modal.close();
                    });
                    div.selectAll('[data-option="assign-to-spouse"]').on('click', () => {
                        remove(false);
                        this.modal.close();
                    });
                    this.modal.activate(div.node());
                }
                function remove(to_current) {
                    rel_tree_datum.data.rels.spouses = rel_tree_datum.data.rels.spouses.filter(id => id !== datum.id);
                    rels.spouses = rels.spouses.filter(id => id !== rel_tree_datum.data.id);
                    const childrens_parent = to_current ? datum : rel_tree_datum.data;
                    const other_parent = to_current ? rel_tree_datum.data : datum;
                    (rels.children || []).forEach(id => {
                        const child = store.getDatum(id);
                        if (!child)
                            throw new Error('Child not found');
                        if (child.rels.parents.includes(other_parent.id))
                            child.rels.parents = child.rels.parents.filter(id => id !== other_parent.id);
                    });
                    if (other_parent.rels.children) {
                        other_parent.rels.children = other_parent.rels.children.filter(ch_id => !(childrens_parent.rels.children || []).includes(ch_id));
                    }
                    onAccept();
                }
            }
            function handleChildrenRemoval() {
                if (!rels.children)
                    throw new Error('Children not found');
                rels.children = rels.children.filter(id => id !== rel_tree_datum.data.id);
                rel_tree_datum.data.rels.parents = rel_tree_datum.data.rels.parents.filter(id => id !== datum.id);
                onAccept();
            }
            function findRelType(d) {
                if (d.is_ancestry) {
                    if (datum.rels.parents.includes(d.data.id))
                        return 'parent';
                }
                else if (d.spouse) {
                    if (!datum.rels.spouses)
                        throw new Error('Spouses not found');
                    if (datum.rels.spouses.includes(d.data.id))
                        return 'spouse';
                }
                else {
                    if (!datum.rels.children)
                        throw new Error('Children not found');
                    if (datum.rels.children.includes(d.data.id))
                        return 'children';
                }
                return null;
            }
        }
        function onCancel() {
            if (!this.is_active)
                return;
            this.is_active = false;
            this.store.state.one_level_rels = false;
            if (!this.datum)
                throw new Error('Datum not found');
            this.cancelCallback(this.datum);
            this.datum = null;
            this.onChange = null;
            this.onCancel = null;
        }
    }
}

function modal (cont) { return new Modal(cont); }
class Modal {
    constructor(cont) {
        this.cont = cont;
        this.active = false;
        this.onClose = null;
        this.modal_cont = d3.select(this.cont).append('div').attr('class', 'f3-modal').node();
        d3.select(this.modal_cont).style('display', 'none');
        this.create();
    }
    create() {
        const modal = d3.select(this.modal_cont);
        updateSelectionHtml(modal, `
      <div class="f3-modal-content">
        <span class="f3-modal-close">&times;</span>
        <div class="f3-modal-content-inner"></div>
        <div class="f3-modal-content-bottom"></div>
      </div>
    `, 'Modal structure');
        modal.select('.f3-modal-close').on('click', () => {
            this.close();
        });
        modal.on('click', (event) => {
            if (event.target == modal.node()) {
                this.close();
            }
        });
    }
    activate(content, { boolean, onAccept, onCancel } = {}) {
        this.reset();
        const modal_content_inner = d3.select(this.modal_cont).select('.f3-modal-content-inner').node();
        if (typeof content === 'string') {
            modal_content_inner.textContent = content;
        }
        else {
            modal_content_inner.appendChild(content);
        }
        if (boolean) {
            if (!onAccept)
                throw new Error('onAccept is required');
            if (!onCancel)
                throw new Error('onCancel is required');
            const actions = d3.select(this.modal_cont).select('.f3-modal-content-bottom');
            updateSelectionHtml(actions, `
        <button class="f3-modal-accept f3-btn">Valider</button>
        <button class="f3-modal-cancel f3-btn">Annuler</button>
      `, 'Modal confirmation actions');
            d3.select(this.modal_cont).select('.f3-modal-accept').on('click', () => { onAccept(); this.reset(); this.close(); });
            d3.select(this.modal_cont).select('.f3-modal-cancel').on('click', () => { this.close(); });
            this.onClose = onCancel;
        }
        this.open();
    }
    reset() {
        this.onClose = null;
        clearElement(this.modal_cont.querySelector('.f3-modal-content-inner'));
        clearElement(this.modal_cont.querySelector('.f3-modal-content-bottom'));
    }
    open() {
        this.modal_cont.style.display = 'block';
        this.active = true;
    }
    close() {
        this.modal_cont.style.display = 'none';
        this.active = false;
        if (this.onClose)
            this.onClose();
    }
}

const FIELD_LABEL_MAP = {
    'first name': 'Prénom',
    'first names': 'Prénoms',
    'last name': 'Nom',
    'maiden name': 'Nom de naissance',
    'birthday': 'Date de naissance',
    'death': 'Date de décès',
    'gender': 'Genre',
    'birthplace': 'Lieu de naissance',
    'deathplace': 'Lieu de décès',
    'bio': 'Biographie',
    'metiers': 'Métiers',
    'nationality': 'Nationalité',
    'occupation': 'Profession',
    'avatar': 'Avatar',
    'union paragraph': 'Paragraphe d’union'
};
var editTree = (cont, store) => new EditTree(cont, store);
class EditTree {
    constructor(cont, store) {
        this.cont = cont;
        this.store = store;
        this.fields = [
            { type: 'text', label: 'Prénom', id: 'first name' },
            { type: 'text', label: 'Prénoms', id: 'first names' },
            { type: 'text', label: 'Nom', id: 'last name' },
            { type: 'text', label: 'Date de naissance', id: 'birthday' },
            { type: 'text', label: 'Avatar', id: 'avatar' }
        ];
        this.is_fixed = true;
        this.no_edit = false;
        this.onChange = null;
        this.editFirst = false;
        this.postSubmit = null;
        this.onFormCreation = null;
        this.createFormEdit = null;
        this.createFormNew = null;
        this.formCont = this.getFormContDefault();
        this.modal = this.setupModal();
        this.addRelativeInstance = this.setupAddRelative();
        this.removeRelativeInstance = this.setupRemoveRelative();
        this.history = this.createHistory();
        return this;
    }
    open(datum) {
        if (!datum.rels)
            datum = datum.data; // if TreeDatum is used, it will be converted to Datum. will be removed in a future version.
        const handleAddRelative = (self) => {
            if (datum._new_rel_data) {
                self.cardEditForm(datum);
            }
            else {
                self.addRelativeInstance.onCancel();
                self.cardEditForm(datum);
                self.store.updateMainId(datum.id);
                self.store.updateTree({});
            }
        };
        const handleRemoveRelative = (self, tree_datum) => {
            if (!tree_datum)
                throw new Error('Tree datum not found');
            if (!self.removeRelativeInstance.datum)
                throw new Error('Remove relative datum not found');
            if (!self.removeRelativeInstance.onCancel)
                throw new Error('Remove relative onCancel not found');
            if (!self.removeRelativeInstance.onChange)
                throw new Error('Remove relative onChange not found');
            if (datum.id === self.removeRelativeInstance.datum.id) {
                self.removeRelativeInstance.onCancel();
                self.cardEditForm(datum);
            }
            else {
                const onAccept = () => {
                    self.removeRelativeInstance.onCancel();
                    self.updateHistory();
                    self.store.updateTree({});
                };
                self.removeRelativeInstance.onChange(tree_datum, onAccept.bind(self));
            }
        };
        if (this.addRelativeInstance.is_active)
            handleAddRelative(this);
        else if (this.removeRelativeInstance.is_active)
            handleRemoveRelative(this, this.store.getTreeDatum(datum.id));
        else {
            this.cardEditForm(datum);
        }
    }
    setupAddRelative() {
        const onActivate = (self) => {
            if (self.removeRelativeInstance.is_active)
                self.removeRelativeInstance.onCancel();
        };
        const cancelCallback = (self, datum) => {
            self.store.updateMainId(datum.id);
            self.store.updateTree({});
            self.openFormWithId(datum.id);
        };
        return addRelative(this.store, () => onActivate(this), (datum) => cancelCallback(this, datum));
    }
    setupRemoveRelative() {
        const setClass = (cont, add) => {
            d3.select(cont).select('#f3Canvas').classed('f3-remove-relative-active', add);
        };
        const onActivate = function () {
            if (this.addRelativeInstance.is_active)
                this.addRelativeInstance.onCancel();
            setClass(this.cont, true);
        };
        const cancelCallback = function (datum) {
            setClass(this.cont, false);
            this.store.updateMainId(datum.id);
            this.store.updateTree({});
            this.openFormWithId(datum.id);
        };
        return removeRelative(this.store, onActivate.bind(this), cancelCallback.bind(this), this.modal);
    }
    createHistory() {
        const historyUpdateTree = function () {
            var _a, _b;
            if (this.addRelativeInstance.is_active)
                this.addRelativeInstance.onCancel();
            if (this.removeRelativeInstance.is_active)
                this.removeRelativeInstance.onCancel();
            this.store.updateTree({ initial: false });
            (_a = this.history) === null || _a === void 0 ? void 0 : _a.controls.updateButtons();
            this.openFormWithId((_b = this.store.getMainDatum()) === null || _b === void 0 ? void 0 : _b.id);
            if (this.onChange)
                this.onChange();
        };
        const history = createHistory(this.store, this._getStoreDataCopy.bind(this), historyUpdateTree.bind(this));
        const nav_cont = this.cont.querySelector('.f3-nav-cont');
        if (!nav_cont)
            throw new Error("Nav cont not found");
        const controls = createHistoryControls(nav_cont, history);
        history.changed();
        controls.updateButtons();
        return Object.assign(Object.assign({}, history), { controls });
    }
    openWithoutRelCancel(datum) {
        this.cardEditForm(datum);
    }
    getFormContDefault() {
        let form_cont = d3.select(this.cont).select('div.f3-form-cont').node();
        if (!form_cont)
            form_cont = d3.select(this.cont).append('div').classed('f3-form-cont', true).node();
        return {
            el: form_cont,
            populate(form_element) {
                clearElement(form_cont);
                form_cont.appendChild(form_element);
            },
            open() {
                d3.select(form_cont).classed('opened', true);
            },
            close() {
                d3.select(form_cont).classed('opened', false);
                clearElement(form_cont);
            },
        };
    }
    setFormCont(formCont) {
        this.formCont = formCont;
        return this;
    }
    cardEditForm(datum) {
        const props = {};
        const is_new_rel = datum === null || datum === void 0 ? void 0 : datum._new_rel_data;
        if (is_new_rel) {
            props.onCancel = () => this.addRelativeInstance.onCancel();
        }
        else {
            props.addRelative = this.addRelativeInstance;
            props.removeRelative = this.removeRelativeInstance;
            props.deletePerson = () => {
                deletePerson(datum, this.store.getData());
                this.openFormWithId(this.store.getLastAvailableMainDatum().id);
                this.store.updateTree({});
            };
        }
        const postSubmitHandler = (self, props) => {
            if (self.addRelativeInstance.is_active) {
                self.addRelativeInstance.onChange(datum, props);
                if (self.postSubmit)
                    self.postSubmit(datum, self.store.getData());
                const active_datum = self.addRelativeInstance.datum;
                if (!active_datum)
                    throw new Error('Active datum not found');
                self.store.updateMainId(active_datum.id);
                self.openWithoutRelCancel(active_datum);
            }
            else if ((datum.to_add || datum.unknown) && typeof (props === null || props === void 0 ? void 0 : props.link_rel_id) === 'string') {
                const linkRelId = props.link_rel_id;
                handleLinkRel(datum, linkRelId, self.store.getData());
                self.store.updateMainId(linkRelId);
                self.openFormWithId(linkRelId);
            }
            else if (!(props === null || props === void 0 ? void 0 : props.delete)) {
                if (self.postSubmit)
                    self.postSubmit(datum, self.store.getData());
                self.openFormWithId(datum.id);
            }
            if (!self.is_fixed)
                self.closeForm();
            self.store.updateTree({});
            self.updateHistory();
        };
        const form_creator = formCreatorSetup(Object.assign({ store: this.store, datum, postSubmitHandler: (props) => postSubmitHandler(this, props), fields: this.fields, onCancel: () => { }, editFirst: this.editFirst, no_edit: this.no_edit, link_existing_rel_config: this.link_existing_rel_config, onFormCreation: this.onFormCreation, onSubmit: this.onSubmit, onDelete: this.onDelete, canEdit: this.canEdit, canDelete: this.canDelete }, props));
        const form_cont = is_new_rel
            ? (this.createFormNew || createFormNew)(form_creator, this.closeForm.bind(this))
            : (this.createFormEdit || createFormEdit)(form_creator, this.closeForm.bind(this));
        this.formCont.populate(form_cont);
        this.openForm();
    }
    openForm() {
        this.formCont.open();
    }
    closeForm() {
        this.formCont.close();
        this.store.updateTree({});
    }
    fixed() {
        this.is_fixed = true;
        if (this.formCont.el)
            d3.select(this.formCont.el).style('position', 'relative');
        return this;
    }
    absolute() {
        this.is_fixed = false;
        if (this.formCont.el)
            d3.select(this.formCont.el).style('position', 'absolute');
        return this;
    }
    setCardClickOpen(card) {
        card.setOnCardClick((event, d) => {
            const mouseEvent = event;
            if (this.isAddingRelative()) {
                this.open(d.data);
            }
            else if (this.isRemovingRelative()) {
                this.open(d.data);
            }
            else {
                this.open(d.data);
                card.onCardClickDefault(mouseEvent, d);
            }
        });
        return this;
    }
    openFormWithId(d_id) {
        if (d_id) {
            const d = this.store.getDatum(d_id);
            if (!d)
                throw new Error('Datum not found');
            this.openWithoutRelCancel(d);
        }
        else {
            const d = this.store.getMainDatum();
            if (!d)
                throw new Error('Main datum not found');
            this.openWithoutRelCancel(d);
        }
    }
    setNoEdit() {
        this.no_edit = true;
        return this;
    }
    setEdit() {
        this.no_edit = false;
        return this;
    }
    setFields(fields) {
        const new_fields = [];
        if (!Array.isArray(fields)) {
            console.error('fields must be an array');
            return this;
        }
        for (const field of fields) {
            if (typeof field === 'string') {
                const id = field;
                const label = FIELD_LABEL_MAP[id] || field;
                new_fields.push({ type: 'text', label, id });
            }
            else if (typeof field === 'object' && field !== null) {
                if (!('id' in field) || typeof field.id !== 'string' || !field.id) {
                    console.error('fields must be an array of objects with id property');
                }
                else {
                    // Preserve RelReferenceFieldCreator and SelectFieldCreator with extra properties
                    const asAny = field;
                    if (Object.prototype.hasOwnProperty.call(asAny, 'getRelLabel') ||
                        Object.prototype.hasOwnProperty.call(asAny, 'options') ||
                        Object.prototype.hasOwnProperty.call(asAny, 'optionCreator')) {
                        new_fields.push(asAny);
                    }
                    else {
                        const fld = field;
                        const label = fld.label || FIELD_LABEL_MAP[fld.id] || fld.id;
                        const type = fld.type || 'text';
                        new_fields.push({ id: fld.id, label, type });
                    }
                }
            }
            else {
                console.error('fields must be an array of strings or objects');
            }
        }
        this.fields = new_fields;
        return this;
    }
    setOnChange(fn) {
        this.onChange = fn;
        return this;
    }
    setCanEdit(canEdit) {
        this.canEdit = canEdit;
        return this;
    }
    setCanDelete(canDelete) {
        this.canDelete = canDelete;
        return this;
    }
    setCanAdd(canAdd) {
        this.addRelativeInstance.setCanAdd(canAdd);
        return this;
    }
    addRelative(datum) {
        if (!datum)
            datum = this.store.getMainDatum();
        this.addRelativeInstance.activate(datum);
        return this;
    }
    setupModal() {
        return modal(this.cont);
    }
    setEditFirst(editFirst) {
        this.editFirst = editFirst;
        return this;
    }
    isAddingRelative() {
        return this.addRelativeInstance.is_active;
    }
    isRemovingRelative() {
        return this.removeRelativeInstance.is_active;
    }
    setAddRelLabels(add_rel_labels) {
        this.addRelativeInstance.setAddRelLabels(add_rel_labels);
        return this;
    }
    setLinkExistingRelConfig(link_existing_rel_config) {
        this.link_existing_rel_config = link_existing_rel_config;
        return this;
    }
    setOnFormCreation(onFormCreation) {
        this.onFormCreation = onFormCreation;
        return this;
    }
    setCreateFormEdit(createFormEdit) {
        this.createFormEdit = createFormEdit;
        return this;
    }
    setCreateFormNew(createFormNew) {
        this.createFormNew = createFormNew;
        return this;
    }
    _getStoreDataCopy() {
        let data = JSON.parse(JSON.stringify(this.store.getData())); // important to make a deep copy of the data
        if (this.addRelativeInstance.is_active)
            data = this.addRelativeInstance.cleanUp(data);
        data = cleanupDataJson(data);
        return data;
    }
    getStoreDataCopy() {
        return this.exportData();
    }
    exportData() {
        let data = this._getStoreDataCopy();
        data = formatDataForExport(data, this.store.state.legacy_format);
        return data;
    }
    getDataJson() {
        return JSON.stringify(this.exportData(), null, 2);
    }
    updateHistory() {
        const history = this.history;
        if (history) {
            history.changed();
            history.controls.updateButtons();
        }
        if (this.onChange)
            this.onChange();
    }
    setPostSubmit(postSubmit) {
        this.postSubmit = postSubmit;
        return this;
    }
    setOnSubmit(onSubmit) {
        this.onSubmit = onSubmit;
        return this;
    }
    setOnDelete(onDelete) {
        this.onDelete = onDelete;
        return this;
    }
    destroy() {
        if (this.history) {
            this.history.controls.destroy();
            this.history = null;
        }
        if (this.formCont.el)
            d3.select(this.formCont.el).remove();
        if (this.addRelativeInstance.onCancel)
            this.addRelativeInstance.onCancel();
        this.store.updateTree({});
        return this;
    }
}

function linkSpouseText(svg, tree, props) {
    const links_data = [];
    tree.data.forEach(d => {
        if (d.coparent && d.data.data.gender === 'F')
            links_data.push({ nodes: [d, d.coparent], id: `${d.data.id}--${d.coparent.data.id}` });
        if (d.spouses)
            d.spouses.forEach(sp => links_data.push({ nodes: [sp, d], id: `${sp.data.id}--${d.data.id}` }));
    });
    const link = d3.select(svg)
        .select(".links_view")
        .selectAll("g.link-text")
        .data(links_data, (d) => d.id);
    const link_exit = link.exit();
    const link_enter = link.enter().append("g").attr("class", "link-text");
    const link_update = link_enter.merge(link);
    const spouseLineX = (sp1, sp2) => {
        if (sp1.spouse && sp1.data.data.gender === 'F')
            return sp1.x - props.node_separation / 2;
        else if (sp2.spouse && sp2.data.data.gender === 'M')
            return sp2.x + props.node_separation / 2;
        else
            return Math.min(sp1.x, sp2.x) + props.node_separation / 2;
    };
    link_exit.each(linkExit);
    link_enter.each(linkEnter);
    link_update.each(linkUpdate);
    function linkEnter(d) {
        const [sp1, sp2] = d.nodes;
        const text_g = d3.select(this);
        text_g
            .attr('transform', `translate(${spouseLineX(sp1, sp2)}, ${sp1.y - 3})`)
            .style('opacity', 0);
        text_g.append("text").style('font-size', '12px').style('fill', '#fff').style('text-anchor', 'middle');
    }
    function linkUpdate(d) {
        const [sp1, sp2] = d.nodes;
        const text_g = d3.select(this);
        const delay = props.initial ? calculateDelay(tree, sp1, props.transition_time) : 0;
        text_g.select('text').text(props.linkSpouseText(sp1, sp2));
        text_g.transition('text').duration(props.transition_time).delay(delay)
            .attr('transform', `translate(${spouseLineX(sp1, sp2)}, ${sp1.y - 3})`);
        text_g.transition('text-op').duration(100).delay(delay + props.transition_time).style('opacity', 1);
    }
    function linkExit() {
        const text_g = d3.select(this);
        text_g.transition('text').duration(100).style('opacity', 0)
            .on("end", () => text_g.remove());
    }
}

function checkIfConnectedToFirstPerson(datum, data_stash, exclude_ids = []) {
    const first_person = data_stash[0];
    if (datum.id === first_person.id)
        return true;
    const rels_checked = [...exclude_ids];
    let connected = false;
    checkRels(datum);
    return connected;
    function checkRels(d0) {
        if (connected)
            return;
        const r = d0.rels;
        const r_ids = [...r.parents, ...(r.spouses || []), ...(r.children || [])].filter(r_id => !!r_id);
        r_ids.forEach(r_id => {
            if (rels_checked.includes(r_id))
                return;
            rels_checked.push(r_id);
            const person = data_stash.find(d => d.id === r_id);
            if (person.id === first_person.id)
                connected = true;
            else
                checkRels(person);
        });
    }
}

function autocomplete (cont, onSelect, config = {}) { return new Autocomplete(cont, onSelect, config); }
class Autocomplete {
    constructor(cont, onSelect, config = {}) {
        this.cont = cont;
        this.options = [];
        this.onSelect = onSelect;
        this.config = config;
        this.autocomplete_cont = d3.select(this.cont).append('div').attr('class', 'f3-autocomplete-cont').node();
        this.create();
    }
    create() {
        var _a;
        const containerSelection = d3.select(this.autocomplete_cont);
        containerSelection.selectAll('*').remove();
        const search_cont = containerSelection.append('div').attr('class', 'f3-autocomplete');
        const search_input_cont = search_cont.append('div').attr('class', 'f3-autocomplete-input-cont');
        const search_input = search_input_cont.append('input')
            .attr('type', 'text')
            .attr('placeholder', ((_a = this.config) === null || _a === void 0 ? void 0 : _a.placeholder) || 'Rechercher');
        const toggle = search_input_cont.append('span')
            .attr('class', 'f3-autocomplete-toggle');
        updateSelectionHtml(toggle, chevronDownSvgIcon(), 'Autocomplete toggle icon');
        const dropdown = search_cont.append('div')
            .attr('class', 'f3-autocomplete-items')
            .attr('tabindex', 0);
        const selectItem = (items, index) => {
            items.forEach(item => d3.select(item).classed("f3-selected", false));
            if (items[index]) {
                d3.select(items[index]).classed("f3-selected", true);
                items[index].scrollIntoView({ block: "nearest" });
            }
        };
        const updateDropdown = (filteredOptions) => {
            const items = dropdown
                .selectAll('div.f3-autocomplete-item')
                .data(filteredOptions, option => option.value);
            const merged = items
                .join('div')
                .attr('class', 'f3-autocomplete-item');
            merged
                .on('click', (_event, option) => {
                this.onSelect(option.value);
            })
                .each(function (option) {
                const node = this;
                clearElement(node);
                if (option.optionHtml) {
                    setElementHtml(node, option.optionHtml(option), 'Autocomplete option');
                }
                else {
                    const wrapper = document.createElement('div');
                    if (option.class)
                        wrapper.className = option.class;
                    setElementHtml(wrapper, option.label_html || escapeHtml(option.label), 'Autocomplete option label');
                    node.appendChild(wrapper);
                }
            });
        };
        const closeDropdown = () => {
            search_cont.classed("active", false);
            updateDropdown([]);
        };
        const updateOptions = () => {
            this.options = this.getOptions();
        };
        const activateDropdown = () => {
            search_cont.classed("active", true);
            const searchInputValue = (search_input.property("value") || "");
            const normalizedQuery = searchInputValue.trim().toLowerCase();
            const filteredOptions = this.options.filter(option => {
                if (!normalizedQuery)
                    return true;
                const target = (option.searchText || option.label || "").toLowerCase();
                return target.includes(normalizedQuery);
            });
            filteredOptions.forEach(option => {
                option.label_html = buildHighlightedLabel(option.label, normalizedQuery);
            });
            filteredOptions.sort((a, b) => a.label.localeCompare(b.label));
            updateDropdown(filteredOptions);
        };
        const handleArrowKeys = (event) => {
            const items = dropdown.selectAll("div.f3-autocomplete-item").nodes();
            const currentIndex = items.findIndex(item => d3.select(item).classed("f3-selected"));
            if (event.key === "ArrowDown") {
                event.preventDefault();
                const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
                selectItem(items, nextIndex);
            }
            else if (event.key === "ArrowUp") {
                event.preventDefault();
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
                selectItem(items, prevIndex);
            }
            else if (event.key === "Enter" && currentIndex !== -1) {
                event.preventDefault();
                const option = d3.select(items[currentIndex]).datum();
                if (option)
                    this.onSelect(option.value);
            }
        };
        search_cont.on("focusout", () => {
            setTimeout(() => {
                const searchContNode = search_cont.node();
                if (!searchContNode.contains(document.activeElement)) {
                    closeDropdown();
                }
            }, 200);
        });
        search_input
            .on("focus", () => {
            updateOptions();
            activateDropdown();
        })
            .on("input", () => activateDropdown())
            .on("keydown", (event) => handleArrowKeys(event));
        dropdown.on("wheel", (event) => event.stopPropagation());
        search_cont.select(".f3-autocomplete-toggle")
            .on("click", (event) => {
            event.stopPropagation();
            const isActive = search_cont.classed("active");
            search_cont.classed("active", !isActive);
            if (isActive) {
                closeDropdown();
            }
            else {
                const searchInputNode = search_input.node();
                searchInputNode.focus();
                activateDropdown();
            }
        });
    }
    setOptionsGetter(getOptions) {
        this.getOptions = getOptions;
        return this;
    }
    setOptionsGetterPerson(getData, getLabel) {
        this.getOptions = () => {
            const options = [];
            const data = getData();
            data.forEach(d => {
                if (d.to_add || d.unknown || d._new_rel_data)
                    return;
                if (options.find(d0 => d0.value === d.id))
                    return;
                options.push({
                    label: getLabel(d),
                    value: d.id,
                    optionHtml: optionHtml(d)
                });
            });
            return options;
        };
        return this;
        function optionHtml(d) {
            const link_off = !checkIfConnectedToFirstPerson(d, getData());
            return (option) => (`
        <div>
          <span style="float: left; width: 10px; height: 10px; margin-right: 10px;" class="f3-${getPersonGender(d)}-color">${personSvgIcon()}</span>
          <span>${option.label_html || escapeHtml(option.label)}</span>
          ${link_off ? `<span style="float: right; width: 10px; height: 10px; margin-left: 5px;" title="Ce profil n'est pas relié au profil principal">${linkOffSvgIcon()}</span>` : ''}
        </div>
      `);
        }
        function getPersonGender(d) {
            if (d.data.gender === "M")
                return "male";
            else if (d.data.gender === "F")
                return "female";
            else
                return "genderless";
        }
    }
    destroy() {
        this.autocomplete_cont.remove();
    }
}
function buildHighlightedLabel(label, normalizedQuery) {
    const safeLabel = escapeHtml(label);
    const trimmedQuery = normalizedQuery || '';
    if (!trimmedQuery)
        return safeLabel;
    const lowerLabel = label.toLowerCase();
    const index = lowerLabel.indexOf(trimmedQuery);
    if (index === -1)
        return safeLabel;
    const before = escapeHtml(label.slice(0, index));
    const match = escapeHtml(label.slice(index, index + trimmedQuery.length));
    const after = escapeHtml(label.slice(index + trimmedQuery.length));
    return `${before}<strong>${match}</strong>${after}`;
}

function calculateKinships(d_id, data_stash, kinship_info_config) {
    const main_datum = data_stash.find(d => d.id === d_id);
    const kinships = {};
    loopCheck(main_datum.id, 'self', 0);
    setupHalfKinships(kinships);
    if (kinship_info_config.show_in_law)
        setupInLawKinships(kinships, data_stash);
    setupKinshipsGender(kinships);
    return kinships;
    function loopCheck(d_id, kinship, depth, prev_rel_id = undefined) {
        if (!d_id)
            return;
        if (kinships[d_id])
            return;
        if (kinship)
            kinships[d_id] = kinship;
        const datum = data_stash.find(d => d.id === d_id);
        const rels = datum.rels;
        if (kinship === 'self') {
            rels.parents.forEach(p_id => loopCheck(p_id, 'parent', depth - 1, d_id));
            (rels.spouses || []).forEach(id => loopCheck(id, 'spouse', depth));
            (rels.children || []).forEach(id => loopCheck(id, 'child', depth + 1));
        }
        else if (kinship === 'parent') {
            rels.parents.forEach(p_id => loopCheck(p_id, 'grandparent', depth - 1, d_id));
            (rels.children || []).forEach(id => {
                if (prev_rel_id && prev_rel_id === id)
                    return;
                loopCheck(id, 'sibling', depth + 1);
            });
        }
        else if (kinship === 'spouse') ;
        else if (kinship === 'child') {
            (rels.children || []).forEach(id => loopCheck(id, 'grandchild', depth + 1));
        }
        else if (kinship === 'sibling') {
            (rels.children || []).forEach(id => loopCheck(id, 'nephew', depth + 1));
        }
        else if (kinship === 'grandparent') {
            if (!prev_rel_id)
                console.error(`${kinship} should have prev_rel_id`);
            rels.parents.forEach(p_id => loopCheck(p_id, 'great-grandparent', depth - 1, d_id));
            (rels.children || []).forEach(id => {
                if (prev_rel_id && prev_rel_id === id)
                    return;
                loopCheck(id, 'uncle', depth + 1);
            });
        }
        else if (kinship.includes('grandchild')) {
            (rels.children || []).forEach(id => loopCheck(id, getGreatKinship(kinship, depth + 1), depth + 1));
        }
        else if (kinship.includes('great-grandparent')) {
            if (!prev_rel_id)
                console.error(`${kinship} should have prev_rel_id`);
            rels.parents.forEach(p_id => loopCheck(p_id, getGreatKinship(kinship, depth - 1), depth - 1, d_id));
            (rels.children || []).forEach(id => {
                if (prev_rel_id && prev_rel_id === id)
                    return;
                const great_count = getGreatCount(depth + 1);
                if (great_count === 0)
                    loopCheck(id, 'granduncle', depth + 1);
                else if (great_count > 0)
                    loopCheck(id, getGreatKinship('granduncle', depth + 1), depth + 1);
                else
                    console.error(`${kinship} should have great_count > -1`);
            });
        }
        else if (kinship === 'nephew') {
            (rels.children || []).forEach(id => loopCheck(id, 'grandnephew', depth + 1));
        }
        else if (kinship.includes('grandnephew')) {
            (rels.children || []).forEach(id => loopCheck(id, getGreatKinship(kinship, depth + 1), depth + 1));
        }
        else if (kinship === 'uncle') {
            (rels.children || []).forEach(id => loopCheck(id, '1st Cousin', depth + 1));
        }
        else if (kinship === 'granduncle') {
            (rels.children || []).forEach(id => loopCheck(id, '1st Cousin 1x removed', depth + 1));
        }
        else if (kinship.includes('great-granduncle')) {
            const child_depth = depth + 1;
            const removed_count = Math.abs(child_depth);
            (rels.children || []).forEach(id => loopCheck(id, `1st Cousin ${removed_count}x removed`, child_depth));
        }
        else if (kinship.slice(4).startsWith('Cousin')) {
            (rels.children || []).forEach(id => {
                const child_depth = depth + 1;
                const removed_count = Math.abs(child_depth);
                const cousin_count = +kinship[0];
                if (child_depth === 0) {
                    loopCheck(id, `${getOrdinal(cousin_count + 1)} Cousin`, child_depth);
                }
                else if (child_depth < 0) {
                    loopCheck(id, `${getOrdinal(cousin_count + 1)} Cousin ${removed_count}x removed`, child_depth);
                }
                else if (child_depth > 0) {
                    loopCheck(id, `${getOrdinal(cousin_count)} Cousin ${removed_count}x removed`, child_depth);
                }
            });
        }
        else
            console.error(`${kinship} not found`);
    }
    function setupHalfKinships(kinships) {
        const half_kinships = [];
        Object.keys(kinships).forEach(d_id => {
            const kinship = kinships[d_id];
            if (kinship.includes('child'))
                return;
            if (kinship === 'spouse')
                return;
            const same_ancestors = findSameAncestor(main_datum.id, d_id, data_stash);
            if (!same_ancestors)
                return console.error(`${data_stash.find(d => d.id === d_id).data} not found in main_ancestry`);
            if (same_ancestors.is_half_kin)
                half_kinships.push(d_id);
        });
        half_kinships.forEach(d_id => {
            kinships[d_id] = `Half ${kinships[d_id]}`;
        });
    }
    function setupInLawKinships(kinships, data_stash) {
        Object.keys(kinships).forEach(d_id => {
            const kinship = kinships[d_id];
            const datum = data_stash.find(d => d.id === d_id);
            if (kinship === 'spouse') {
                const siblings = [];
                datum.rels.parents.forEach(p_id => (getD(p_id).rels.children || []).forEach(d_id => siblings.push(d_id)));
                siblings.forEach(sibling_id => { if (!kinships[sibling_id])
                    kinships[sibling_id] = 'sibling-in-law'; }); // gender label is added in setupKinshipsGender
            }
            if (kinship === 'sibling') {
                (datum.rels.spouses || []).forEach(spouse_id => {
                    if (!kinships[spouse_id])
                        kinships[spouse_id] = 'sibling-in-law';
                });
            }
            if (kinship === 'child') {
                (datum.rels.spouses || []).forEach(spouse_id => { if (!kinships[spouse_id])
                    kinships[spouse_id] = 'child-in-law'; }); // gender label is added in setupKinshipsGender
            }
            if (kinship === 'uncle') {
                (datum.rels.spouses || []).forEach(spouse_id => { if (!kinships[spouse_id])
                    kinships[spouse_id] = 'uncle-in-law'; }); // gender label is added in setupKinshipsGender
            }
            if (kinship.includes('Cousin')) {
                (datum.rels.spouses || []).forEach(spouse_id => { if (!kinships[spouse_id])
                    kinships[spouse_id] = `${kinship} in-law`; }); // gender label is added in setupKinshipsGender
            }
        });
    }
    function setupKinshipsGender(kinships) {
        Object.keys(kinships).forEach(d_id => {
            const kinship = kinships[d_id];
            const datum = data_stash.find(d => d.id === d_id);
            const gender = datum.data.gender;
            if (kinship.includes('parent')) {
                const rel_type_general = 'parent';
                const rel_type = gender === 'M' ? 'father' : gender === 'F' ? 'mother' : rel_type_general;
                kinships[d_id] = kinships[d_id].replace('parent', rel_type);
            }
            else if (kinship.includes('sibling')) {
                const rel_type_general = 'sibling';
                const rel_type = gender === 'M' ? 'brother' : gender === 'F' ? 'sister' : rel_type_general;
                kinships[d_id] = kinships[d_id].replace('sibling', rel_type);
            }
            else if (kinship.includes('child')) {
                const rel_type_general = 'child';
                const rel_type = gender === 'M' ? 'son' : gender === 'F' ? 'daughter' : rel_type_general;
                kinships[d_id] = kinships[d_id].replace('child', rel_type);
            }
            else if (kinship.includes('uncle')) {
                const rel_type_general = 'aunt/uncle';
                const rel_type = gender === 'M' ? 'uncle' : gender === 'F' ? 'aunt' : rel_type_general;
                kinships[d_id] = kinships[d_id].replace('uncle', rel_type);
            }
            else if (kinship.includes('nephew')) {
                const rel_type_general = 'neice/nephew';
                const rel_type = gender === 'M' ? 'nephew' : gender === 'F' ? 'niece' : rel_type_general;
                kinships[d_id] = kinships[d_id].replace('nephew', rel_type);
            }
        });
    }
    function getD(d_id) {
        return data_stash.find(d => d.id === d_id);
    }
}
function findSameAncestor(main_id, rel_id, data_stash) {
    const main_ancestry = getAncestry(main_id);
    let found;
    let is_ancestor;
    let is_half_kin;
    checkIfRel(rel_id);
    checkIfSpouse(rel_id);
    loopCheck(rel_id);
    if (!found)
        return null;
    return { found, is_ancestor, is_half_kin };
    function loopCheck(rel_id) {
        if (found)
            return;
        if (rel_id === main_id) {
            is_ancestor = true;
            found = rel_id;
            is_half_kin = false;
            return;
        }
        const d = data_stash.find(d => d.id === rel_id);
        const rels = d.rels;
        const parents = getParents(rels);
        const found_parent = main_ancestry.find(p => (p[0] && parents[0] && p[0] === parents[0]) || (p[1] && parents[1] && p[1] === parents[1]));
        if (found_parent) {
            found = parents.filter((p, i) => p === found_parent[i]);
            is_half_kin = checkIfHalfKin(parents, found_parent);
            return;
        }
        rels.parents.forEach(p_id => loopCheck(p_id));
    }
    function getAncestry(rel_id) {
        const ancestry = [];
        loopAdd(rel_id);
        return ancestry;
        function loopAdd(rel_id) {
            const d = data_stash.find(d => d.id === rel_id);
            const rels = d.rels;
            ancestry.push(getParents(rels));
            rels.parents.forEach(p_id => loopAdd(p_id));
        }
    }
    function getParents(rels) {
        return rels.parents;
    }
    function checkIfRel(rel_id) {
        const d = data_stash.find(d => d.id === rel_id);
        const found_parent = main_ancestry.find(p => p[0] === d.id || p[1] === d.id);
        if (found_parent) {
            is_ancestor = true;
            found = rel_id;
            is_half_kin = false;
        }
    }
    function checkIfSpouse(rel_id) {
        const main_datum = data_stash.find(d => d.id === main_id);
        if ((main_datum.rels.spouses || []).includes(rel_id)) {
            found = [main_id, rel_id];
        }
    }
    function checkIfHalfKin(ancestors1, ancestors2) {
        return ancestors1.some((p, i) => p !== ancestors2[i]) || ancestors2.some((p, i) => p !== ancestors1[i]);
    }
}
function getOrdinal(n) {
    const s = ['st', 'nd', 'rd'];
    return s[n - 1] ? n + s[n - 1] : n + 'th';
}
function getGreatCount(depth) {
    const depth_abs = Math.abs(depth);
    return depth_abs - 2;
}
function getGreatKinship(kinship, depth) {
    const great_count = getGreatCount(depth);
    if (kinship.includes('great-'))
        kinship = kinship.split('great-')[1];
    if (great_count === 1) {
        return `great-${kinship}`;
    }
    else if (great_count > 1) {
        return `${great_count}x-great-${kinship}`;
    }
    else {
        console.error(`${kinship} should have great_count > 1`);
        return kinship;
    }
}

function getKinshipsDataStash(main_id, rel_id, data_stash, kinships) {
    var _a;
    let in_law_id;
    const kinship = kinships[rel_id].toLowerCase();
    if (kinship.includes('in-law')) {
        in_law_id = rel_id;
        const datum = data_stash.find(d => d.id === in_law_id);
        if (kinship.includes('sister') || kinship.includes('brother')) {
            rel_id = main_id;
        }
        else {
            const spouseCandidate = (_a = datum.rels.spouses) === null || _a === void 0 ? void 0 : _a.find(d_id => kinships[d_id] && !kinships[d_id].includes('in-law'));
            if (spouseCandidate)
                rel_id = spouseCandidate;
        }
    }
    const same_ancestors = findSameAncestor(main_id, rel_id, data_stash);
    if (!same_ancestors)
        return console.error(`${rel_id} not found in main_ancestry`);
    const same_ancestor_id = same_ancestors.is_ancestor ? same_ancestors.found : same_ancestors.found[0];
    const same_ancestor = data_stash.find(d => d.id === same_ancestor_id);
    const root = d3.hierarchy(same_ancestor, hierarchyGetterChildren);
    const same_ancestor_progeny = root.descendants().map(d => d.data.id);
    const main_ancestry = getCleanAncestry(main_id, same_ancestor_progeny);
    const rel_ancestry = getCleanAncestry(rel_id, same_ancestor_progeny);
    loopClean(root);
    const kinship_data_stash = root.descendants().map(d => {
        const datum = {
            id: d.data.id,
            data: JSON.parse(JSON.stringify(d.data.data)),
            kinship: kinships[d.data.id],
            rels: {
                parents: [],
                spouses: [],
                children: []
            }
        };
        if (d.children && d.children.length > 0)
            datum.rels.children = d.children.map(c => c.data.id);
        return datum;
    });
    if (kinship_data_stash.length > 0 && !same_ancestors.is_ancestor && !same_ancestors.is_half_kin)
        addRootSpouse(kinship_data_stash);
    if (in_law_id)
        addInLawConnection(kinship_data_stash);
    return kinship_data_stash;
    function loopClean(tree_datum) {
        tree_datum.children = (tree_datum.children || []).filter(child => {
            if (main_ancestry.includes(child.data.id))
                return true;
            if (rel_ancestry.includes(child.data.id))
                return true;
            return false;
        });
        tree_datum.children.forEach(child => loopClean(child));
        if (tree_datum.children.length === 0)
            delete tree_datum.children;
    }
    function hierarchyGetterChildren(d) {
        const children = [...(d.rels.children || [])].map(id => data_stash.find(d => d.id === id)).filter(d => d);
        return children;
    }
    function getCleanAncestry(d_id, same_ancestor_progeny) {
        const ancestry = [d_id];
        loopAdd(d_id);
        return ancestry;
        function loopAdd(d_id) {
            const d = data_stash.find(d => d.id === d_id);
            const rels = d.rels;
            rels.parents.forEach(p_id => {
                if (same_ancestor_progeny.includes(p_id)) {
                    ancestry.push(p_id);
                    loopAdd(p_id);
                }
            });
        }
    }
    function addRootSpouse(kinship_data_stash) {
        const datum = kinship_data_stash[0];
        if (!same_ancestors)
            return console.error(`${rel_id} not found in main_ancestry`);
        const spouse_id = same_ancestor_id === same_ancestors.found[0] ? same_ancestors.found[1] : same_ancestors.found[0];
        datum.rels.spouses = [spouse_id];
        const spouse = data_stash.find(d => d.id === spouse_id);
        const spouse_datum = {
            id: spouse.id,
            data: JSON.parse(JSON.stringify(spouse.data)),
            kinship: kinships[spouse.id],
            rels: {
                spouses: [datum.id],
                children: datum.rels.children,
                parents: []
            }
        };
        kinship_data_stash.push(spouse_datum);
        (datum.rels.children || []).forEach(child_id => {
            const child = data_stash.find(d => d.id === child_id);
            const kinship_child = kinship_data_stash.find(d => d.id === child_id);
            kinship_child.rels.parents = [...child.rels.parents];
        });
    }
    function addInLawConnection(kinship_data_stash) {
        if (kinship.includes('sister') || kinship.includes('brother')) {
            addInLawSibling(kinship_data_stash);
        }
        else {
            addInLawSpouse(kinship_data_stash);
        }
    }
    function addInLawSpouse(kinship_data_stash) {
        const datum = kinship_data_stash.find(d => d.id === rel_id);
        const spouse_id = in_law_id;
        datum.rels.spouses = [spouse_id];
        const spouse = data_stash.find(d => d.id === spouse_id);
        const spouse_datum = {
            id: spouse.id,
            data: JSON.parse(JSON.stringify(spouse.data)),
            kinship: kinships[spouse.id],
            rels: {
                spouses: [datum.id],
                children: [],
                parents: []
            }
        };
        kinship_data_stash.push(spouse_datum);
    }
    function addInLawSibling(kinship_data_stash) {
        var _a;
        const datum = kinship_data_stash.find(d => d.id === rel_id);
        const in_law_datum = getD(in_law_id);
        kinship_data_stash.push({
            id: in_law_id,
            data: JSON.parse(JSON.stringify(in_law_datum.data)),
            kinship: kinships[in_law_id],
            rels: {
                spouses: [],
                children: [],
                parents: []
            }
        });
        const siblings = [];
        in_law_datum.rels.parents.forEach(p_id => (getD(p_id).rels.children || []).forEach(d_id => siblings.push(d_id)));
        const spouse_id = (_a = getD(rel_id).rels.spouses) === null || _a === void 0 ? void 0 : _a.find(d_id => siblings.includes(d_id));
        datum.rels.spouses = [spouse_id];
        const spouse = getD(spouse_id);
        const spouse_datum = {
            id: spouse.id,
            data: JSON.parse(JSON.stringify(spouse.data)),
            kinship: kinships[spouse.id],
            rels: {
                spouses: [datum.id],
                children: [],
                parents: []
            }
        };
        kinship_data_stash.push(spouse_datum);
        in_law_datum.rels.parents.forEach(p_id => {
            const parent = getD(p_id);
            const kinship_label = parent.data.gender === 'M' ? 'Father-in-law' : parent.data.gender === 'F' ? 'Mother-in-law' : 'Parent-in-law';
            const parent_datum = {
                id: parent.id,
                data: JSON.parse(JSON.stringify(parent.data)),
                kinship: kinship_label,
                rels: {
                    spouses: [],
                    children: [spouse_id, in_law_id],
                    parents: []
                }
            };
            const p2_id = in_law_datum.rels.parents.find(p_id => p_id !== p_id);
            if (p2_id)
                parent_datum.rels.parents.push(p2_id);
            kinship_data_stash.unshift(parent_datum);
        });
    }
    function getD(d_id) {
        return data_stash.find(d => d.id === d_id);
    }
}

function createChart(cont, data) {
    return new Chart(cont, data);
}
class Chart {
    constructor(cont, data) {
        this.getCard = null;
        this.transition_time = 2000;
        this.linkSpouseText = null;
        this.personSearch = null;
        this.is_card_html = false;
        this.beforeUpdate = null;
        this.afterUpdate = null;
        this.cont = setCont(cont);
        const { svg } = htmlContSetup(this.cont);
        this.svg = svg;
        createNavCont(this.cont);
        this.setFitToScreenButton();
        this.setThemeToggleButton();
        const main_id = data && data.length > 0 ? data[0].id : '';
        this.store = this.createStore(data, main_id);
        if (!this.store.state.link_style)
            this.store.state.link_style = 'legacy';
        this.linkStyle = this.store.state.link_style;
        this.setOnUpdate();
        this.editTreeInstance = null;
        return this;
    }
    createStore(data, main_id) {
        return createStore({
            data,
            main_id,
            node_separation: 250,
            level_separation: 150,
            single_parent_empty_card: true,
            is_horizontal: false,
        });
    }
    setOnUpdate() {
        this.store.setOnUpdate((props) => {
            if (this.beforeUpdate)
                this.beforeUpdate(props);
            props = Object.assign({
                transition_time: this.store.state.transition_time,
                link_style: this.store.state.link_style || this.linkStyle
            }, props || {});
            if (this.is_card_html)
                props = Object.assign({}, props || {}, { cardHtml: true });
            view(this.store.getTree(), this.svg, this.getCard(), props || {});
            if (this.linkSpouseText)
                linkSpouseText(this.svg, this.store.getTree(), Object.assign({}, props || {}, { linkSpouseText: this.linkSpouseText, node_separation: this.store.state.node_separation }));
            if (this.afterUpdate)
                this.afterUpdate(props);
        });
    }
    setLinkStyle(link_style) {
        this.linkStyle = link_style;
        this.store.state.link_style = link_style;
        return this;
    }
    updateTree(props = { initial: false }) {
        this.store.updateTree(props);
        return this;
    }
    updateData(data) {
        this.store.updateData(data);
        return this;
    }
    setCardYSpacing(card_y_spacing) {
        if (typeof card_y_spacing !== 'number') {
            console.error('card_y_spacing must be a number');
            return this;
        }
        this.store.state.level_separation = card_y_spacing;
        return this;
    }
    setCardXSpacing(card_x_spacing) {
        if (typeof card_x_spacing !== 'number') {
            console.error('card_x_spacing must be a number');
            return this;
        }
        this.store.state.node_separation = card_x_spacing;
        return this;
    }
    setOrientationVertical() {
        this.store.state.is_horizontal = false;
        return this;
    }
    setOrientationHorizontal() {
        this.store.state.is_horizontal = true;
        return this;
    }
    setShowSiblingsOfMain(show_siblings_of_main) {
        this.store.state.show_siblings_of_main = show_siblings_of_main;
        return this;
    }
    setModifyTreeHierarchy(modifyTreeHierarchy) {
        this.store.state.modifyTreeHierarchy = modifyTreeHierarchy;
        return this;
    }
    setPrivateCardsConfig(private_cards_config) {
        this.store.state.private_cards_config = private_cards_config;
        return this;
    }
    setLinkSpouseText(linkSpouseText) {
        this.linkSpouseText = linkSpouseText;
        return this;
    }
    setSingleParentEmptyCard(single_parent_empty_card, { label = 'Inconnu' } = {}) {
        this.store.state.single_parent_empty_card = single_parent_empty_card;
        this.store.state.single_parent_empty_card_label = label;
        if (this.editTreeInstance && this.editTreeInstance.addRelativeInstance.is_active)
            this.editTreeInstance.addRelativeInstance.onCancel();
        removeToAddFromData(this.store.getData() || []);
        return this;
    }
    setCard(card) {
        if (card === CardHtmlWrapper)
            return this.setCardHtml();
        else if (card === CardSvgWrapper)
            return this.setCardSvg();
        else
            throw new Error('Card must be an instance of cardHtml or cardSvg');
    }
    setCardHtml() {
        const htmlSvg = this.cont.querySelector('#htmlSvg');
        if (!htmlSvg)
            throw new Error('htmlSvg not found');
        this.is_card_html = true;
        clearElement(this.svg.querySelector('.cards_view'));
        htmlSvg.style.display = 'block';
        const card = CardHtmlWrapper(this.cont, this.store);
        this.getCard = () => card.getCard();
        return card;
    }
    setCardSvg() {
        const htmlSvg = this.cont.querySelector('#htmlSvg');
        if (!htmlSvg)
            throw new Error('htmlSvg not found');
        this.is_card_html = false;
        clearElement(this.svg.querySelector('.cards_view'));
        htmlSvg.style.display = 'none';
        const card = CardSvgWrapper(this.cont, this.store);
        this.getCard = () => card.getCard();
        return card;
    }
    setTransitionTime(transition_time) {
        this.store.state.transition_time = transition_time;
        return this;
    }
    setSortChildrenFunction(sortChildrenFunction) {
        this.store.state.sortChildrenFunction = sortChildrenFunction;
        return this;
    }
    setSortSpousesFunction(sortSpousesFunction) {
        this.store.state.sortSpousesFunction = sortSpousesFunction;
        return this;
    }
    setAncestryDepth(ancestry_depth) {
        if (typeof ancestry_depth === 'number' && Number.isFinite(ancestry_depth) && ancestry_depth >= 0) {
            this.store.state.ancestry_depth = ancestry_depth;
        }
        else {
            delete this.store.state.ancestry_depth;
        }
        return this;
    }
    setProgenyDepth(progeny_depth) {
        if (typeof progeny_depth === 'number' && Number.isFinite(progeny_depth) && progeny_depth >= 0) {
            this.store.state.progeny_depth = progeny_depth;
        }
        else {
            delete this.store.state.progeny_depth;
        }
        return this;
    }
    getMaxDepth(d_id) {
        return getMaxDepth(d_id, this.store.getData());
    }
    calculateKinships(d_id, config = {}) {
        return calculateKinships(d_id, this.store.getData(), config);
    }
    getKinshipsDataStash(main_id, rel_id) {
        return getKinshipsDataStash(main_id, rel_id, this.store.getData(), this.calculateKinships(main_id));
    }
    setDuplicateBranchToggle(_duplicateBranchToggle) {
        return this;
    }
    editTree() {
        return this.editTreeInstance = editTree(this.cont, this.store);
    }
    updateMain(d) {
        const datumId = resolveDatumId(d);
        this.store.updateMainId(datumId);
        this.store.updateTree({});
        return this;
    }
    updateMainId(id) {
        this.store.updateMainId(id);
        return this;
    }
    getMainDatum() {
        return this.store.getMainDatum();
    }
    setBeforeUpdate(fn) {
        this.beforeUpdate = fn;
        return this;
    }
    setAfterUpdate(fn) {
        this.afterUpdate = fn;
        return this;
    }
    setPersonDropdown(getLabel, { cont = this.cont.querySelector('.f3-nav-cont'), onSelect, placeholder = 'Rechercher' } = {}) {
        if (!onSelect)
            onSelect = onSelectDefault.bind(this);
        this.personSearch = autocomplete(cont, onSelect, { placeholder });
        this.personSearch.setOptionsGetterPerson(this.store.getData, getLabel);
        function onSelectDefault(d_id) {
            const datum = this.store.getDatum(d_id);
            if (!datum)
                throw new Error('Datum not found');
            if (this.editTreeInstance)
                this.editTreeInstance.open(datum);
            this.updateMainId(d_id);
            this.updateTree({ initial: false });
        }
        return this;
    }
    setFitToScreenButton({ cont = this.cont.querySelector('.f3-nav-cont'), label = 'Fit to Screen' } = {}) {
        d3.select(cont).append('button')
            .attr('class', 'f3-btn f3-fit-to-screen-btn')
            .style('margin-left', '10px')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('justify-content', 'center')
            .html(`
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9"></polyline>
          <polyline points="9 21 3 21 3 15"></polyline>
          <line x1="21" y1="3" x2="14" y2="10"></line>
          <line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
      `)
            .attr('title', label)
            .on('click', () => {
            const tree = this.store.getTree();
            if (!tree)
                return;
            treeFit({
                svg: this.svg,
                svg_dim: this.svg.getBoundingClientRect(),
                tree_dim: tree.dim,
                transition_time: this.store.state.transition_time
            });
        });
        return this;
    }
    toggleTheme() {
        const cont = d3.select(this.cont).select('.f3');
        const isLight = cont.classed('f3-light');
        cont.classed('f3-light', !isLight);
        return this;
    }
    setThemeToggleButton({ cont = this.cont.querySelector('.f3-nav-cont'), label = 'Toggle Theme' } = {}) {
        d3.select(cont).append('button')
            .attr('class', 'f3-btn f3-theme-toggle-btn')
            .style('margin-left', '10px')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('justify-content', 'center')
            .html(`
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      `)
            .attr('title', label)
            .on('click', () => {
            this.toggleTheme();
        });
        return this;
    }
    unSetPersonSearch() {
        if (this.personSearch) {
            this.personSearch.destroy();
            this.personSearch = null;
        }
        return this;
    }
}
function setCont(cont) {
    if (typeof cont === "string")
        cont = document.querySelector(cont);
    if (!cont)
        throw new Error('cont not found');
    return cont;
}
function createNavCont(cont) {
    d3.select(cont).append('div').attr('class', 'f3-nav-cont');
}
function resolveDatumId(d) {
    if (typeof d.id === 'string' && d.id)
        return d.id;
    const dataId = d.data.id;
    if (typeof dataId === 'string' && dataId)
        return dataId;
    throw new Error('Datum id must be a non-empty string');
}

var handlers = /*#__PURE__*/Object.freeze({
  __proto__: null,
  calculateDelay: calculateDelay,
  calculateTreeFit: calculateTreeFit,
  cardChangeMain: cardChangeMain,
  cardComponentSetup: cardComponentSetup,
  cardToMiddle: cardToMiddle,
  checkIfConnectedToFirstPerson: checkIfConnectedToFirstPerson,
  cleanupDataJson: cleanupDataJson,
  createFormEdit: createFormEdit,
  createFormNew: createFormNew,
  createHistory: createHistory,
  createHistoryControls: createHistoryControls,
  createNewPerson: createNewPerson,
  deletePerson: deletePerson,
  getCurrentZoom: getCurrentZoom,
  htmlContSetup: htmlContSetup,
  isAllRelativeDisplayed: isAllRelativeDisplayed,
  manualZoom: manualZoom,
  onDeleteSyncRelReference: onDeleteSyncRelReference,
  removeToAdd: removeToAdd,
  removeToAddFromData: removeToAddFromData,
  setupZoom: setupZoom,
  submitFormData: submitFormData,
  syncRelReference: syncRelReference,
  treeFit: treeFit,
  zoomTo: zoomTo
});

function createInfoPopup (cont, onClose) { return new InfoPopup(cont, onClose); }
class InfoPopup {
    constructor(cont, onClose) {
        this.cont = cont;
        this.active = false;
        this.onClose = onClose;
        this.popup_cont = d3.select(this.cont).append('div').attr('class', 'f3-popup').node();
        this.create();
    }
    create() {
        const popup = d3.select(this.popup_cont);
        updateSelectionHtml(popup, `
      <div class="f3-popup-content">
        <span class="f3-popup-close">&times;</span>
        <div class="f3-popup-content-inner"></div>
      </div>
    `, 'Info popup structure');
        popup.select('.f3-popup-close').on('click', () => {
            this.close();
        });
        popup.on('click', (event) => {
            if (event.target == popup.node()) {
                this.close();
            }
        });
    }
    activate(content) {
        const popup_content_inner = d3.select(this.popup_cont).select('.f3-popup-content-inner').node();
        if (content)
            popup_content_inner.appendChild(content);
        this.open();
    }
    open() {
        this.active = true;
    }
    close() {
        this.popup_cont.remove();
        this.active = false;
        if (this.onClose)
            this.onClose();
    }
}

function kinshipInfo(kinship_info_config, rel_id, data_stash) {
    const { self_id, getLabel, title } = kinship_info_config;
    const relationships = calculateKinships(self_id, data_stash, kinship_info_config);
    const relationship = relationships[rel_id];
    if (!relationship)
        return;
    let label = relationship;
    if (relationship === 'self')
        label = 'You';
    else
        label = capitalizeLabel(label);
    const safeTitle = escapeHtml(title);
    const safeLabel = escapeHtml(label);
    const html = (`
    <div class="f3-kinship-info">
      <div class="f3-info-field">
        <span class="f3-info-field-label">${safeTitle}</span>
        <span class="f3-info-field-value">
          <span>${safeLabel}</span>
          <span class="f3-kinship-info-icon">${infoSvgIcon()}</span>
        </span>
      </div>
    </div>
  `);
    const container = d3.create('div');
    updateSelectionHtml(container, html, 'Kinship info summary');
    const kinship_info_node = container.select('div').node();
    let popup = null;
    d3.select(kinship_info_node).select('.f3-kinship-info-icon').on('click', (e) => createPopup(e, kinship_info_node));
    return kinship_info_node;
    function createPopup(e, cont) {
        const width = 250;
        const height = 400;
        let left = e.clientX - width - 10;
        let top = e.clientY - height - 10;
        if (left + width > window.innerWidth) {
            left = window.innerWidth - width - 10;
        }
        if (top < 0) {
            top = 10;
        }
        if (popup && popup.active) {
            popup.close();
            popup = null;
            return;
        }
        popup = createInfoPopup(cont);
        d3.select(popup.popup_cont)
            .style('width', `${width}px`)
            .style('height', `${height}px`)
            .style('left', `${left}px`)
            .style('top', `${top}px`);
        const inner_cont = popup.popup_cont.querySelector('.f3-popup-content-inner');
        popup.activate();
        createSmallTree(self_id, rel_id, data_stash, relationships, inner_cont, getLabel);
    }
}
function createSmallTree(self_id, rel_id, data_stash, relationships, parent_cont, getLabel) {
    if (!d3.select(parent_cont).select('#SmallChart').node()) {
        d3.select(parent_cont).append('div').attr('id', 'SmallChart').attr('class', 'f3');
    }
    const small_chart = d3.select('#SmallChart');
    small_chart.selectAll('*').remove();
    const small_chart_data = getKinshipsDataStash(self_id, rel_id, data_stash, relationships);
    let kinship_label_toggle = true;
    const kinship_label_toggle_cont = small_chart.append('div');
    create(small_chart_data);
    function create(data) {
        const f3Chart = createChart('#SmallChart', data)
            .setTransitionTime(500)
            .setCardXSpacing(170)
            .setCardYSpacing(70)
            .setSingleParentEmptyCard(false);
        const f3Card = f3Chart.setCardHtml()
            .setStyle('rect')
            .setCardInnerHtmlCreator((d) => {
            return getCardInnerRect(d);
        })
            .setOnCardUpdate(function () {
            const card = d3.select(this).select('.card');
            card.classed('card-main', false);
        });
        f3Card.onCardClick = (() => { });
        f3Chart.updateTree({ initial: true });
        setTimeout(() => setupSameZoom(0.65), 100);
        createKinshipLabelToggle();
        function getCardInnerRect(d) {
            let label = d.data.kinship === 'self' ? 'You' : d.data.kinship;
            label = capitalizeLabel(label);
            if (!kinship_label_toggle)
                label = getLabel(d.data);
            const safeLabel = escapeHtml(label);
            return (`
        <div class="card-inner card-rect ${getCardClass()}">
          <div class="card-label">${safeLabel}</div>
        </div>
      `);
            function getCardClass() {
                if (d.data.kinship === 'self') {
                    return 'card-kinship-self' + (kinship_label_toggle ? '' : ' f3-real-label');
                }
                else if (d.data.id === rel_id) {
                    return 'card-kinship-rel';
                }
                else {
                    return 'card-kinship-default';
                }
            }
        }
        function createKinshipLabelToggle() {
            kinship_label_toggle_cont
                .classed('f3-kinship-labels-toggle', true);
            kinship_label_toggle_cont.append('label')
                .text('Kinship labels')
                .append('input')
                .attr('type', 'checkbox')
                .attr('checked', true)
                .on('change', () => {
                kinship_label_toggle = !kinship_label_toggle;
                f3Chart.updateTree({ initial: false, tree_position: 'inherit' });
            });
        }
        function setupSameZoom(zoom_level) {
            const svg = f3Chart.cont.querySelector('svg.main_svg');
            const current_zoom = getCurrentZoom(svg);
            if (current_zoom.k > zoom_level) {
                zoomTo(svg, zoom_level);
            }
        }
    }
}
function capitalizeLabel(label) {
    label = label[0].toUpperCase() + label.slice(1);
    if (label.includes('great-'))
        label = label.replace('great-', 'Great-');
    return label;
}

var elements = /*#__PURE__*/Object.freeze({
  __proto__: null,
  Card: Card,
  CardHtml: CardHtml$2,
  CardSvg: CardSvg$2,
  appendElement: appendElement,
  infoPopup: createInfoPopup,
  kinshipInfo: kinshipInfo
});

const CardSvg = CardSvgWrapper;
const CardHtml = CardHtmlWrapper;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const htmlHandlersWithDeprecated = Object.assign({}, htmlHandlers, { setupHtmlSvg, setupReactiveTreeData: _setupReactiveTreeData, getUniqueId });

var exports = /*#__PURE__*/Object.freeze({
  __proto__: null,
  AddRelative: AddRelative,
  CalculateTree: CalculateTree,
  Card: Card,
  CardHtml: CardHtml,
  CardHtmlClass: CardHtml$1,
  CardSvg: CardSvg,
  CardSvgClass: CardSvg$1,
  Chart: Chart,
  EditTree: EditTree,
  calculateTree: calculateTreeWithV1Data,
  cardHtml: CardHtmlWrapper,
  cardSvg: CardSvgWrapper,
  createChart: createChart,
  createStore: createStore,
  createSvg: createSvg,
  elements: elements,
  formatData: formatData,
  formatDataForExport: formatDataForExport,
  handlers: handlers,
  htmlHandlers: htmlHandlersWithDeprecated,
  icons: icons,
  view: view
});

export { AddRelative, CalculateTree, Card, CardHtml, CardHtml$1 as CardHtmlClass, CardSvg, CardSvg$1 as CardSvgClass, Chart, EditTree, calculateTreeWithV1Data as calculateTree, CardHtmlWrapper as cardHtml, CardSvgWrapper as cardSvg, createChart, createStore, createSvg, exports as default, elements, formatData, formatDataForExport, handlers, htmlHandlersWithDeprecated as htmlHandlers, icons, view };
