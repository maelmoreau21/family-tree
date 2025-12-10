declare module '*.esm.js' {
    const value: any;
    export = value;
}

declare module '../lib/family-tree.esm.js' {
    export function createStore(options: any): any;
    export function createChart(container: HTMLElement, store: any, view: any, svg: any): any;
    export function view(): any;
    export function svg(): any;
    // Add other exports as needed
}
