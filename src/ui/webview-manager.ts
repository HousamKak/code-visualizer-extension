import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DiagramType, FunctionInfo, DiagramVersion } from '../types';
import { generateNonce } from '../utils/helpers';
import { IWebviewManager } from '../interfaces/webview-manager.interface';

export class WebviewManager implements IWebviewManager {
  private currentPanel: vscode.WebviewPanel | undefined;

  constructor(private context: vscode.ExtensionContext) {}

  createDiagramPanel(
    diagram: string,
    diagramType: DiagramType,
    functionInfo: FunctionInfo,
    explanation?: string,
    versions?: DiagramVersion[]
  ): vscode.WebviewPanel {
    // Close existing panel
    if (this.currentPanel) {
      this.currentPanel.dispose();
    }

    // Create new panel
    this.currentPanel = vscode.window.createWebviewPanel(
      'codeVisualizerDiagram',
      `${functionInfo.name}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'media')
        ]
      }
    );

    // Set webview content
    this.currentPanel.webview.html = this.generateWebviewContent(
      diagram,
      diagramType,
      functionInfo,
      'dark',
      explanation,
      versions
    );

    // Handle messages from webview
    this.currentPanel.webview.onDidReceiveMessage(
      message => this.handleWebviewMessage(message),
      undefined,
      []
    );

    // Handle panel disposal
    this.currentPanel.onDidDispose(() => {
      this.currentPanel = undefined;
    });

    return this.currentPanel;
  }

  updateDiagram(diagram: string, diagramType: DiagramType, explanation?: string): void {
    if (this.currentPanel && this.currentPanel.webview) {
      this.currentPanel.webview.postMessage({
        command: 'updateDiagram',
        diagram,
        diagramType,
        explanation
      });
    }
  }

  closePanel(): void {
    if (this.currentPanel) {
      this.currentPanel.dispose();
      this.currentPanel = undefined;
    }
  }

  isPanelOpen(): boolean {
    return this.currentPanel !== undefined;
  }

  getCurrentPanel(): vscode.WebviewPanel | undefined {
    return this.currentPanel;
  }

  generateWebviewContent(
    diagram: string,
    diagramType: DiagramType,
    functionInfo: FunctionInfo,
    theme: string = 'dark',
    explanation?: string,
    versions?: DiagramVersion[]
  ): string {
    const nonce = generateNonce();
    const mermaidPath = this.context.asAbsolutePath('media/mermaid.min.js');
    const mermaidUri = this.currentPanel?.webview.asWebviewUri(vscode.Uri.file(mermaidPath));

    const versionCount = versions?.length || 0;
    const hasVersions = versionCount > 0;
    const versionsJson = JSON.stringify(versions || []);
    // Proper escaping order: backslashes first, then backticks and dollars
    const escapedDiagram = diagram.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');

    // Format explanation with proper HTML structure and advanced formatting
    const formatExplanation = (text: string): string => {
      if (!text || text === 'No explanation available.') {
        return '<p class="no-explanation">No explanation available.</p>';
      }

      // Step 1: Convert inline code (backticks) to <code> tags
      let html = text.replace(/`([^`]+)`/g, '<code>$1</code>');

      // Step 2: Highlight important technical terms (database operations, async/await, etc.)
      const technicalTerms = [
        'async', 'await', 'Promise', 'callback', 'database', 'SQL', 'query',
        'transaction', 'API', 'HTTP', 'REST', 'GraphQL', 'cache', 'Redis',
        'MongoDB', 'PostgreSQL', 'MySQL', 'authentication', 'authorization',
        'JWT', 'OAuth', 'validation', 'sanitization', 'encryption', 'hash',
        'middleware', 'route', 'endpoint', 'request', 'response', 'error handling',
        'try-catch', 'throw', 'catch', 'finally', 'null', 'undefined'
      ];

      technicalTerms.forEach(term => {
        // Only highlight if not already inside code tags
        const regex = new RegExp('\\b(' + term + ')\\b(?![^<]*<\\/code>)', 'gi');
        html = html.replace(regex, '<span class="highlight-tech">$1</span>');
      });

      // Step 3: Convert markdown-style bold to section headers
      html = html.replace(/\*\*(.+?):\*\*/g, '<h3>$1</h3>');

      // Step 4: Convert paragraphs first (split on double newlines)
      const parts = html.split(/\n\n+/);
      html = parts.map(para => {
        para = para.trim();
        if (!para) return '';

        // Check if this part contains bullet points
        if (para.includes('\n- ') || para.startsWith('- ')) {
          // Convert bullet list
          const items = para.split(/\n/).map(line => {
            line = line.trim();
            if (line.startsWith('- ')) {
              return '<li>' + line.substring(2) + '</li>';
            }
            return line;
          }).filter(l => l.startsWith('<li>'));

          return '<ul>' + items.join('') + '</ul>';
        }

        // Skip if already wrapped in structural elements
        if (para.startsWith('<h3>') || para.startsWith('<ul>') || para.startsWith('<div>')) {
          return para;
        }

        // Wrap in paragraph tag
        return '<p>' + para + '</p>';
      }).filter(p => p).join('\n');

      // Step 6: Add section wrappers with specific styling
      html = html.replace(/<h3>Overview<\/h3>/g, '<div class="section overview"><h3>📋 Overview</h3>');
      html = html.replace(/<h3>Key Logic<\/h3>/g, '</div><div class="section key-logic"><h3>🔑 Key Logic</h3>');
      html = html.replace(/<h3>Complexity<\/h3>/g, '</div><div class="section complexity"><h3>📊 Complexity</h3>');
      html = html.replace(/<h3>Technical Details<\/h3>/g, '</div><div class="section technical"><h3>⚙️ Technical Details</h3>');
      html = html.replace(/<h3>Recommendations<\/h3>/g, '</div><div class="section recommendations"><h3>💡 Recommendations</h3>');

      // Step 7: Add emphasis to important phrases
      html = html.replace(/\b(IMPORTANT|WARNING|NOTE|TIP|CAUTION)\b/g, '<span class="emphasis-$1">$1</span>');

      // Close last section
      if (html.includes('<div class="section')) {
        html += '</div>';
      }

      return html;
    };

    const displayExplanation = formatExplanation(explanation || '');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net; style-src 'unsafe-inline' https://cdn.jsdelivr.net; worker-src blob:; img-src data: 'self'; font-src https://cdn.jsdelivr.net;">
    <title>${functionInfo.name}</title>
    <link rel="stylesheet" data-name="vs/editor/editor.main" href="https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/editor/editor.main.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
            color: var(--vscode-foreground, #cccccc);
            background: var(--vscode-editor-background, #1e1e1e);
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        /* Header - Minimal 40px */
        .header {
            height: 40px;
            border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
            display: flex;
            align-items: center;
            padding: 0 12px;
            gap: 12px;
            background: var(--vscode-titleBar-activeBackground, #3c3c3c);
            flex-shrink: 0;
        }

        .header-title {
            font-weight: 600;
            font-size: 13px;
        }

        .header-meta {
            font-size: 11px;
            opacity: 0.7;
        }

        /* Main Layout - Two Column */
        .main {
            flex: 1;
            display: flex;
            overflow: hidden;
        }

        /* Diagram Area - 70% */
        .diagram-area {
            flex: 0 0 70%;
            display: flex;
            flex-direction: column;
            border-right: 1px solid var(--vscode-panel-border, #3c3c3c);
            overflow: hidden;
        }

        #diagram {
            flex: 1;
            overflow: hidden;
            position: relative;
            background: var(--vscode-editor-background, #1e1e1e);
        }

        #diagram-wrapper {
            width: 100%;
            height: 100%;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            cursor: grab;
            user-select: none;
        }

        #diagram-wrapper.panning {
            cursor: grabbing;
        }

        #diagram-content {
            transform-origin: center center;
            transition: transform 0.1s ease;
            position: relative;
        }

        #diagram-content svg {
            max-width: none;
            height: auto;
            display: block;
            pointer-events: none;
        }

        /* Ensure arrow markers are visible in sequence diagrams */
        #diagram-content svg marker {
            overflow: visible;
        }

        #diagram-content svg marker path {
            fill: var(--vscode-foreground, #cccccc);
            stroke: var(--vscode-foreground, #cccccc);
        }

        /* Fix for sequence diagram arrows */
        #diagram-content svg .messageLine0,
        #diagram-content svg .messageLine1 {
            stroke: var(--vscode-foreground, #cccccc);
            marker-end: url(#arrowhead);
        }

        #diagram-content svg defs marker polygon,
        #diagram-content svg defs marker path {
            fill: var(--vscode-foreground, #cccccc) !important;
            stroke: var(--vscode-foreground, #cccccc) !important;
        }

        .zoom-controls {
            position: absolute;
            top: 10px;
            right: 10px;
            display: flex;
            gap: 4px;
            background: var(--vscode-editor-background, #1e1e1e);
            border: 1px solid var(--vscode-panel-border, #3c3c3c);
            border-radius: 4px;
            padding: 4px;
            z-index: 10;
        }

        .zoom-btn {
            width: 28px;
            height: 28px;
            border: none;
            background: var(--vscode-button-secondaryBackground, #3a3d41);
            color: var(--vscode-button-secondaryForeground, #cccccc);
            cursor: pointer;
            border-radius: 2px;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .zoom-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground, #45494e);
        }

        .zoom-level {
            padding: 0 8px;
            display: flex;
            align-items: center;
            font-size: 11px;
            color: var(--vscode-foreground, #cccccc);
        }

        /* Sidebar - 30% */
        .sidebar {
            flex: 0 0 30%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        /* Tabs */
        .tabs {
            display: flex;
            border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
            background: var(--vscode-editorGroupHeader-tabsBackground, #252526);
            flex-shrink: 0;
        }

        .tab {
            padding: 8px 16px;
            cursor: pointer;
            border: none;
            background: transparent;
            color: var(--vscode-tab-inactiveForeground, #969696);
            font-size: 12px;
            border-bottom: 2px solid transparent;
            transition: all 0.2s;
        }

        .tab:hover {
            background: var(--vscode-tab-hoverBackground, #2a2d2e);
        }

        .tab.active {
            color: var(--vscode-tab-activeForeground, #ffffff);
            border-bottom-color: var(--vscode-focusBorder, #007acc);
            background: var(--vscode-tab-activeBackground, #1e1e1e);
        }

        .tab-content {
            flex: 1;
            overflow: auto;
            display: none;
        }

        .tab-content.active {
            display: flex;
            flex-direction: column;
        }

        /* Explanation Panel */
        #tab-explanation {
            padding: 0;
            line-height: 1.6;
            font-size: 13px;
        }

        #explanation {
            color: var(--vscode-foreground, #cccccc);
        }

        #explanation .section {
            padding: 16px;
            border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
            transition: background 0.2s ease;
        }

        #explanation .section:last-child {
            border-bottom: none;
        }

        #explanation .section.overview {
            background: var(--vscode-textBlockQuote-background, rgba(127, 127, 127, 0.1));
            border-left: 3px solid var(--vscode-descriptionForeground, #717171);
        }

        #explanation .section.key-logic {
            background: rgba(255, 193, 7, 0.05);
            border-left: 3px solid rgba(255, 193, 7, 0.5);
        }

        #explanation .section.complexity {
            background: rgba(156, 39, 176, 0.05);
            border-left: 3px solid rgba(156, 39, 176, 0.5);
        }

        #explanation .section.technical {
            background: rgba(33, 150, 243, 0.05);
            border-left: 3px solid rgba(33, 150, 243, 0.5);
        }

        #explanation .section.recommendations {
            background: var(--vscode-inputValidation-infoBackground, rgba(75, 166, 251, 0.1));
            border-left: 3px solid var(--vscode-textLink-foreground, #3794ff);
        }

        #explanation h3 {
            font-size: 12px;
            font-weight: 600;
            margin: 0 0 12px 0;
            color: var(--vscode-textLink-foreground, #3794ff);
            text-transform: uppercase;
            letter-spacing: 0.8px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        #explanation .key-logic h3 {
            color: rgba(255, 193, 7, 0.9);
        }

        #explanation .complexity h3 {
            color: rgba(186, 104, 200, 0.9);
        }

        #explanation .technical h3 {
            color: rgba(100, 181, 246, 0.9);
        }

        #explanation .recommendations h3 {
            color: var(--vscode-textLink-activeForeground, #4daafc);
        }

        #explanation p {
            margin: 0 0 12px 0;
            line-height: 1.8;
            color: var(--vscode-foreground, #cccccc);
        }

        #explanation ul {
            margin: 10px 0;
            padding-left: 20px;
            list-style: none;
        }

        #explanation ul li {
            margin-bottom: 10px;
            padding-left: 14px;
            position: relative;
            line-height: 1.7;
        }

        #explanation ul li:before {
            content: "▸";
            position: absolute;
            left: 0;
            color: var(--vscode-textLink-foreground, #3794ff);
            font-weight: bold;
        }

        #explanation .key-logic ul li:before {
            content: "→";
            color: rgba(255, 193, 7, 0.8);
        }

        #explanation .recommendations ul li:before {
            content: "✓";
            color: var(--vscode-debugIcon-startForeground, #89d185);
            font-weight: bold;
        }

        /* Inline code styling */
        #explanation code {
            background: var(--vscode-textCodeBlock-background, rgba(30, 30, 30, 0.6));
            border: 1px solid var(--vscode-panel-border, rgba(60, 60, 60, 0.5));
            padding: 2px 7px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family, 'Consolas', 'Monaco', monospace);
            font-size: 11.5px;
            color: var(--vscode-textPreformat-foreground, #d7ba7d);
            font-weight: 500;
            white-space: nowrap;
        }

        /* Technical term highlighting */
        #explanation .highlight-tech {
            color: var(--vscode-symbolIcon-functionForeground, #dcdcaa);
            font-weight: 500;
            padding: 0 2px;
        }

        /* Emphasis styling for IMPORTANT, WARNING, etc. */
        #explanation [class^="emphasis-"] {
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            letter-spacing: 0.5px;
        }

        #explanation .emphasis-IMPORTANT {
            background: rgba(244, 67, 54, 0.15);
            color: var(--vscode-errorForeground, #f44336);
        }

        #explanation .emphasis-WARNING {
            background: rgba(255, 152, 0, 0.15);
            color: var(--vscode-editorWarning-foreground, #ff9800);
        }

        #explanation .emphasis-NOTE,
        #explanation .emphasis-TIP {
            background: rgba(33, 150, 243, 0.15);
            color: var(--vscode-textLink-foreground, #2196f3);
        }

        #explanation .emphasis-CAUTION {
            background: rgba(255, 193, 7, 0.15);
            color: #ffc107;
        }

        #explanation .no-explanation {
            padding: 16px;
            text-align: center;
            opacity: 0.6;
            font-style: italic;
        }

        /* Editor Panel */
        #tab-editor {
            position: relative;
        }

        #monaco-container {
            flex: 1;
            width: 100%;
            height: 100%;
        }

        /* Toolbar - 40px */
        .toolbar {
            height: 40px;
            border-top: 1px solid var(--vscode-panel-border, #3c3c3c);
            display: flex;
            align-items: center;
            padding: 0 12px;
            gap: 8px;
            background: var(--vscode-statusBar-background, #007acc);
            flex-shrink: 0;
        }

        .btn {
            padding: 4px 12px;
            border: 1px solid transparent;
            background: var(--vscode-button-background, #0e639c);
            color: var(--vscode-button-foreground, #ffffff);
            cursor: pointer;
            font-size: 11px;
            border-radius: 2px;
            transition: background 0.2s;
        }

        .btn:hover {
            background: var(--vscode-button-hoverBackground, #1177bb);
        }

        .btn:active {
            transform: translateY(1px);
        }

        .btn-secondary {
            background: var(--vscode-button-secondaryBackground, #3a3d41);
            color: var(--vscode-button-secondaryForeground, #cccccc);
        }

        .btn-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground, #45494e);
        }

        .spacer {
            flex: 1;
        }

        .version-nav {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 11px;
            color: var(--vscode-foreground, #cccccc);
        }

        .version-btn {
            padding: 2px 8px;
            font-size: 11px;
            min-width: 28px;
        }

        .version-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .loading {
            opacity: 0.6;
            font-size: 13px;
        }

        .error {
            color: var(--vscode-errorForeground, #f48771);
            padding: 16px;
        }
    </style>
</head>
<body>
    <!-- Header -->
    <div class="header">
        <span class="header-title">${functionInfo.name}</span>
        <span class="header-meta">${functionInfo.language} • ${diagramType} • Line ${functionInfo.startLine}</span>
    </div>

    <!-- Main Content -->
    <div class="main">
        <!-- Diagram Area -->
        <div class="diagram-area">
            <div id="diagram">
                <div class="zoom-controls">
                    <button class="zoom-btn" id="zoom-out" title="Zoom Out (-)">−</button>
                    <span class="zoom-level" id="zoom-level">100%</span>
                    <button class="zoom-btn" id="zoom-in" title="Zoom In (+)">+</button>
                    <button class="zoom-btn" id="zoom-reset" title="Reset (0)">⟲</button>
                </div>
                <div id="diagram-wrapper">
                    <div id="diagram-content">
                        <div class="loading">Rendering diagram...</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Sidebar -->
        <div class="sidebar">
            <div class="tabs">
                <button class="tab active" data-tab="explanation">Explanation</button>
                <button class="tab" data-tab="editor">Mermaid Editor</button>
            </div>

            <div class="tab-content active" id="tab-explanation">
                <div id="explanation">${displayExplanation}</div>
            </div>

            <div class="tab-content" id="tab-editor">
                <div id="monaco-container"></div>
            </div>
        </div>
    </div>

    <!-- Toolbar -->
    <div class="toolbar">
        ${hasVersions ? `
        <div class="version-nav">
            <button class="btn btn-secondary version-btn" id="prev-version" title="Previous version">◀</button>
            <span id="version-info">v1 of ${versionCount}</span>
            <button class="btn btn-secondary version-btn" id="next-version" title="Next version">▶</button>
        </div>
        ` : ''}
        <div class="spacer"></div>
        <button class="btn btn-secondary" id="save-edit" title="Save current diagram as new version">Save Edit</button>
        <button class="btn btn-secondary" id="regenerate" title="Regenerate diagram with AI">Regenerate</button>
        <button class="btn btn-secondary" id="export" title="Export as SVG">Export SVG</button>
    </div>

    <script src="${mermaidUri}" nonce="${nonce}"></script>
    <script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js" nonce="${nonce}"></script>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let currentDiagram = \`${escapedDiagram}\`;
        let currentVersionIndex = 0;
        let versions = ${versionsJson};
        let monacoEditor = null;
        let mermaidReady = false;

        console.log('[WEBVIEW] Initializing...');
        console.log('[WEBVIEW] Diagram length:', currentDiagram.length);
        console.log('[WEBVIEW] Diagram preview:', currentDiagram.substring(0, 100));

        // Wait for mermaid to load
        function waitForMermaid() {
            return new Promise((resolve) => {
                if (typeof mermaid !== 'undefined') {
                    resolve();
                } else {
                    setTimeout(() => waitForMermaid().then(resolve), 100);
                }
            });
        }

        // Initialize and render
        waitForMermaid().then(() => {
            console.log('[WEBVIEW] Mermaid loaded');

            // Initialize Mermaid
            mermaid.initialize({
                startOnLoad: false,
                theme: 'dark',
                securityLevel: 'loose',
                flowchart: {
                    useMaxWidth: true,
                    htmlLabels: true,
                    curve: 'basis'
                },
                sequence: {
                    useMaxWidth: true,
                    wrap: true,
                    diagramMarginX: 50,
                    diagramMarginY: 10,
                    actorMargin: 50,
                    width: 150,
                    height: 65,
                    boxMargin: 10,
                    boxTextMargin: 5,
                    noteMargin: 10,
                    messageMargin: 35,
                    mirrorActors: true,
                    bottomMarginAdj: 1,
                    useMaxWidth: true,
                    rightAngles: false,
                    showSequenceNumbers: false
                },
                class: { useMaxWidth: true },
                state: { useMaxWidth: true },
                er: { useMaxWidth: true },
                journey: { useMaxWidth: true }
            });

            mermaidReady = true;

            // Initial render
            renderDiagram(currentDiagram);
        }).catch(err => {
            console.error('[WEBVIEW] Failed to load mermaid:', err);
            document.getElementById('diagram').innerHTML = '<div class="error">Failed to load Mermaid library</div>';
        });

        // Zoom and pan state
        let zoomLevel = 1.0;
        const zoomStep = 0.2;
        const minZoom = 0.2;
        const maxZoom = 3.0;
        let panX = 0;
        let panY = 0;
        let isPanning = false;
        let startX = 0;
        let startY = 0;

        function updateTransform() {
            const content = document.getElementById('diagram-content');
            if (content) {
                content.style.transform = \`translate(\${panX}px, \${panY}px) scale(\${zoomLevel})\`;
                document.getElementById('zoom-level').textContent = Math.round(zoomLevel * 100) + '%';
            }
        }

        function zoomIn() {
            if (zoomLevel < maxZoom) {
                zoomLevel = Math.min(maxZoom, zoomLevel + zoomStep);
                updateTransform();
            }
        }

        function zoomOut() {
            if (zoomLevel > minZoom) {
                zoomLevel = Math.max(minZoom, zoomLevel - zoomStep);
                updateTransform();
            }
        }

        function resetZoom() {
            zoomLevel = 1.0;
            panX = 0;
            panY = 0;
            updateTransform();
        }

        // Pan functionality
        const wrapper = document.getElementById('diagram-wrapper');

        wrapper.addEventListener('mousedown', (e) => {
            isPanning = true;
            startX = e.clientX - panX;
            startY = e.clientY - panY;
            wrapper.classList.add('panning');
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isPanning) return;
            panX = e.clientX - startX;
            panY = e.clientY - startY;
            updateTransform();
        });

        document.addEventListener('mouseup', () => {
            if (isPanning) {
                isPanning = false;
                wrapper.classList.remove('panning');
            }
        });

        // Render diagram
        async function renderDiagram(diagramText) {
            if (!mermaidReady) {
                console.log('[WEBVIEW] Mermaid not ready yet');
                return;
            }

            const contentEl = document.getElementById('diagram-content');
            try {
                console.log('[WEBVIEW] Rendering diagram, length:', diagramText.length);
                const id = 'diagram-' + Date.now();
                const result = await mermaid.render(id, diagramText);
                contentEl.innerHTML = result.svg;
                console.log('[WEBVIEW] Diagram rendered successfully');

                // Fix arrow markers for sequence diagrams
                fixArrowMarkers();

                // Reset zoom when new diagram loads
                resetZoom();
            } catch (error) {
                contentEl.innerHTML = '<div class="error">Error rendering diagram: ' + error.message + '</div>';
                console.error('[WEBVIEW] Mermaid error:', error);
            }
        }

        // Fix arrow markers visibility issue in VS Code webviews
        function fixArrowMarkers() {
            const svg = document.querySelector('#diagram-content svg');
            if (!svg) return;

            // Check if markers exist in defs
            let defs = svg.querySelector('defs');
            if (!defs) {
                defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                svg.insertBefore(defs, svg.firstChild);
            }

            // Ensure arrowhead marker exists
            if (!defs.querySelector('#arrowhead')) {
                const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
                marker.setAttribute('id', 'arrowhead');
                marker.setAttribute('refX', '9');
                marker.setAttribute('refY', '5');
                marker.setAttribute('markerUnits', 'userSpaceOnUse');
                marker.setAttribute('markerWidth', '12');
                marker.setAttribute('markerHeight', '12');
                marker.setAttribute('orient', 'auto');

                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
                path.setAttribute('fill', '#cccccc');
                path.setAttribute('stroke', '#cccccc');

                marker.appendChild(path);
                defs.appendChild(marker);
            }

            // Ensure all lines have marker-end attribute
            const lines = svg.querySelectorAll('.messageLine0, .messageLine1, line[class*="message"]');
            lines.forEach(line => {
                if (!line.hasAttribute('marker-end')) {
                    line.setAttribute('marker-end', 'url(#arrowhead)');
                }
            });
        }

        // Initialize Monaco Editor
        require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });
        require(['vs/editor/editor.main'], function() {
            monacoEditor = monaco.editor.create(document.getElementById('monaco-container'), {
                value: currentDiagram,
                language: 'plaintext',
                theme: 'vs-dark',
                minimap: { enabled: false },
                fontSize: 12,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: 'on'
            });

            // Live preview on edit
            monacoEditor.onDidChangeModelContent(() => {
                currentDiagram = monacoEditor.getValue();
                renderDiagram(currentDiagram);
            });
        });

        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById('tab-' + tab.dataset.tab).classList.add('active');

                // Trigger layout refresh for Monaco
                if (tab.dataset.tab === 'editor' && monacoEditor) {
                    setTimeout(() => monacoEditor.layout(), 0);
                }
            });
        });

        // Save edit
        document.getElementById('save-edit').addEventListener('click', () => {
            vscode.postMessage({
                command: 'saveEdit',
                diagram: currentDiagram,
                functionName: '${functionInfo.name}'
            });
        });

        // Regenerate
        document.getElementById('regenerate').addEventListener('click', () => {
            vscode.postMessage({
                command: 'regenerate',
                functionName: '${functionInfo.name}'
            });
        });

        // Export
        document.getElementById('export').addEventListener('click', () => {
            const svg = document.querySelector('#diagram svg');
            if (svg) {
                const svgData = new XMLSerializer().serializeToString(svg);
                const blob = new Blob([svgData], {type: 'image/svg+xml'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = '${functionInfo.name}-diagram.svg';
                a.click();
                URL.revokeObjectURL(url);
            }
        });

        // Version navigation
        const prevBtn = document.getElementById('prev-version');
        const nextBtn = document.getElementById('next-version');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentVersionIndex < versions.length - 1) {
                    currentVersionIndex++;
                    loadVersion(currentVersionIndex);
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (currentVersionIndex > 0) {
                    currentVersionIndex--;
                    loadVersion(currentVersionIndex);
                }
            });
        }

        function loadVersion(index) {
            const version = versions[index];
            if (version) {
                currentDiagram = version.diagram;
                if (monacoEditor) {
                    monacoEditor.setValue(currentDiagram);
                }
                renderDiagram(currentDiagram);
                document.getElementById('version-info').textContent = \`v\${versions.length - index} of \${versions.length}\`;

                // Update button states
                if (prevBtn) prevBtn.disabled = index >= versions.length - 1;
                if (nextBtn) nextBtn.disabled = index <= 0;
            }
        }

        // Zoom controls
        document.getElementById('zoom-in').addEventListener('click', zoomIn);
        document.getElementById('zoom-out').addEventListener('click', zoomOut);
        document.getElementById('zoom-reset').addEventListener('click', resetZoom);

        // Keyboard shortcuts for zoom
        document.addEventListener('keydown', (e) => {
            if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                zoomIn();
            } else if (e.key === '-' || e.key === '_') {
                e.preventDefault();
                zoomOut();
            } else if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                resetZoom();
            }
        });

        // Mouse wheel zoom (direct zoom without Ctrl)
        wrapper.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.deltaY < 0) {
                zoomIn();
            } else {
                zoomOut();
            }
        }, { passive: false });

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'updateDiagram':
                    currentDiagram = message.diagram;
                    if (monacoEditor) {
                        monacoEditor.setValue(currentDiagram);
                    }
                    renderDiagram(currentDiagram);
                    break;
            }
        });
    </script>
</body>
</html>`;
  }

  handleWebviewMessage(message: any): void {
    console.log('[WebviewManager] Received message:', message.command);

    switch (message.command) {
      case 'saveEdit':
        vscode.window.showInformationMessage(`Diagram edit saved! ${message.diagram.length} chars`);
        // TODO: In future, save to cache as new version
        break;

      case 'regenerate':
        vscode.window.showInformationMessage('Regenerate feature coming soon! Please use the command palette.');
        // TODO: Trigger regeneration through extension
        break;

      default:
        console.log('[WebviewManager] Unknown command:', message.command);
    }
  }

  async exportDiagram(format: 'png' | 'svg' | 'pdf', path: string): Promise<void> {
    throw new Error('Export functionality not implemented');
  }

  dispose(): void {
    if (this.currentPanel) {
      this.currentPanel.dispose();
    }
  }
}