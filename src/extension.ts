// src/extension.ts – tidied 29 Jun 2025
// ------------------------------------------------------------
// • Uses VS Code's built‑in fetch (Node 20 runtime)
// • Reads API token from Secret Storage, falls back to setting
// • Generates a flowchart‑TD Mermaid diagram for the hovered/selected
//   function and shows it either in the hover or a side‑panel.
// • Minimal validation/cleanup – removes quotes from labels so the
//   diagram always parses.
// ------------------------------------------------------------

import * as vscode from 'vscode';
import * as crypto from 'crypto';

//----------------------------------
// Types & constants
//----------------------------------
interface Cache { [hash: string]: string; }
const SUPPORTED_LANGS = ['javascript', 'typescript', 'python', 'java', 'csharp'];
type LangId = 'javascript' | 'typescript' | 'python' | 'java' | 'csharp';

//----------------------------------
// Extension entry‑points
//----------------------------------
export function activate(ctx: vscode.ExtensionContext) {
  new CodeVisualizer(ctx).register();
}

export function deactivate() {/* nothing to tidy up */}

//----------------------------------
// Main class
//----------------------------------
class CodeVisualizer {
  private readonly cache: Cache = Object.create(null);
  private readonly out = vscode.window.createOutputChannel('Code Visualizer');
  private readonly secrets = this.ctx.secrets;

  constructor(private readonly ctx: vscode.ExtensionContext) {}

  // ---- registration -------------------------------------------------------
  register() {
    const { subscriptions } = this.ctx;

    // Hover provider
    subscriptions.push(
      vscode.languages.registerHoverProvider(SUPPORTED_LANGS, {
        provideHover: (d, p) => this.provideHover(d, p),
      }),
    );

    // Commands
    subscriptions.push(
      vscode.commands.registerCommand('codeVisualizer.showDiagram', () => this.showDiagram()),
      vscode.commands.registerCommand('codeVisualizer.showDiagramPanel', () => this.showDiagramPanel()),
      vscode.commands.registerCommand('codeVisualizer.storeApiToken', () => this.storeToken()),
    );

    this.out.appendLine('Code Visualizer activated');
  }

  // ---- hover logic --------------------------------------------------------
  private async provideHover(doc: vscode.TextDocument, pos: vscode.Position) {
    const cfg = vscode.workspace.getConfiguration('codeVisualizer');
    if (!cfg.get('enableHover', true)) return;

    const fn = this.extractFunction(doc, pos);
    if (!fn || fn.length > cfg.get('maxFunctionSize', 2000)) return;

    const key = this.hash(fn);
    if (this.cache[key]) {
      return new vscode.Hover(new vscode.MarkdownString(`\`\`\`mermaid\n${this.cache[key]}\n\`\`\``, true));
    }

    // async generation – show placeholder
    void this.generateDiagram(fn, key);
    return new vscode.Hover(new vscode.MarkdownString('🔄 Generating diagram… hover again in a second'));
  }

  // ---- commands -----------------------------------------------------------
  private async showDiagram() {
    const ed = vscode.window.activeTextEditor;
    if (!ed) return;
    const sel = ed.selection;
    const code = sel.isEmpty ? this.extractFunction(ed.document, sel.active) : ed.document.getText(sel);
    if (code) this.showDiagramPanel(code);
  }

  private async showDiagramPanel(code?: string) {
    if (!code) {
      const ed = vscode.window.activeTextEditor;
      if (!ed) return;
      code = this.extractFunction(ed.document, ed.selection.active) ?? undefined;
      if (!code) return;
    }

    const panel = vscode.window.createWebviewPanel('codeDiag', 'Code Diagram', vscode.ViewColumn.Beside, {
      enableScripts: true,
      retainContextWhenHidden: true,
    });
    panel.webview.html = this.loadingHtml();

    try {
      const mermaid = await this.getDiagram(code);
      panel.webview.html = this.diagramHtml(mermaid, code);
    } catch (e: any) {
      panel.webview.html = this.errorHtml(e.message ?? String(e));
    }
  }

  private async storeToken() {
    const token = await vscode.window.showInputBox({ prompt: 'GitHub / OpenAI token', password: true });
    if (token) {
      await this.secrets.store('codeVisualizer.apiToken', token);
      vscode.window.showInformationMessage('Token stored securely');
    }
  }

  // ---- generation & cache -------------------------------------------------
  private async generateDiagram(code: string, key: string) {
    try {
      const mermaid = await this.getDiagram(code);
      this.cache[key] = mermaid;
      vscode.window.showInformationMessage('Diagram ready – hover again', 'Open Panel').then((a) => {
        if (a) this.showDiagramPanel(code);
      });
    } catch (e: any) {
      this.out.appendLine('Generation error: ' + e);
      vscode.window.showErrorMessage('Diagram generation failed: ' + e.message);
    }
  }

  private async getDiagram(code: string): Promise<string> {
    const token = await this.getToken();
    if (!token) throw new Error('API token missing (run "Code Visualizer: Store API Token")');

    const prompt = `Generate a Mermaid flowchart (flowchart TD) for this code.\n` +
                   `Rules: no quotes in labels, keep labels short (<15 chars).\n\n\`\`\`\n${code}\n\`\`\``;

    const res = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Return ONLY a valid Mermaid flowchart. No quotes inside labels.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 800,
        temperature: 0,
      }),
    });

    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const txt: any = await res.json();
    const out = txt.choices?.[0]?.message?.content ?? '';

    const match = out.match(/flowchart[\s\S]*/i);
    if (!match) throw new Error('No Mermaid found');

    return this.cleanMermaid(match[0]);
  }

  private cleanMermaid(text: string) {
    return text
      .replace(/"([^"\n]+)"/g, ': $1') // strip quotes inside labels
      .replace(/<br\s*\/?>(\s*)/gi, ' ') // no HTML
      .replace(/\s+$/gm, '')               // trim line ends
      .trim();
  }

  // ---- token helpers ------------------------------------------------------
  private async getToken() {
    return (
      (await this.secrets.get('codeVisualizer.apiToken')) ||
      vscode.workspace.getConfiguration('codeVisualizer').get<string>('apiToken')
    );
  }

  // ---- function extraction (quick & simple) -------------------------------
  private extractFunction(doc: vscode.TextDocument, pos: vscode.Position) {
    const src = doc.getText();
    const off = doc.offsetAt(pos);

    switch (doc.languageId as LangId) {
      case 'python':
        return this.extractPy(src, off);
      case 'csharp':
        return this.extractCs(src, off);
      default:
        return this.extractByBraces(src, off);
    }
  }

  private extractPy(src: string, off: number) {
    const lines = src.split(/\n/);
    let acc = 0, row = 0;
    while (row < lines.length && acc + lines[row].length + 1 <= off) { acc += lines[row].length + 1; row++; }
    while (row >= 0 && !/^\s*def\s+/.test(lines[row])) row--;
    if (row < 0) return null;
    const indent = lines[row].match(/^\s*/)?.[0].length ?? 0;
    let end = row + 1;
    while (end < lines.length && (lines[end].trim() === '' || (lines[end].match(/^\s*/)?.[0].length ?? 0) > indent)) end++;
    return lines.slice(row, end).join('\n');
  }

  private extractCs(src: string, off: number) {
    const rx = /[\w<>]+\s+\w+\s*\([^)]*\)\s*\{/g;
    for (let m; (m = rx.exec(src)); ) {
      const start = m.index;
      const end = this.matchingBrace(src, src.indexOf('{', start));
      if (off >= start && off <= end) return src.slice(start, end + 1);
    }
    return null;
  }

  private extractByBraces(src: string, off: number) {
    const open = src.lastIndexOf('{', off);
    if (open === -1) return null;
    const close = this.matchingBrace(src, open);
    return src.slice(open, close + 1);
  }

  private matchingBrace(src: string, start: number) {
    let depth = 1;
    for (let i = start + 1; i < src.length; i++) {
      if (src[i] === '{') depth++; else if (src[i] === '}' && --depth === 0) return i;
    }
    return start;
  }

  // ---- utils --------------------------------------------------------------
  private hash(str: string) { return crypto.createHash('sha1').update(str).digest('hex'); }

  // ---- HTML helpers -------------------------------------------------------
  private loadingHtml() {
    return '<html><body style="display:flex;font-family:var(--vscode-font-family);align-items:center;justify-content:center;height:100vh;">🔄 Generating…</body></html>';
  }

  private errorHtml(msg: string) {
    return `<html><body style="font-family:var(--vscode-font-family);padding:1rem;color:var(--vscode-errorForeground);">❌ ${this.escape(msg)}</body></html>`;
  }

  private diagramHtml(mermaid: string, code: string) {
    const esc = (s: string) => this.escape(s);
    return `<!doctype html><html><head><script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script></head><body style="font-family:var(--vscode-font-family);padding:1rem;color:var(--vscode-foreground);background:var(--vscode-editor-background);">
      <h2>🔍 Code Diagram</h2>
      <div class="mermaid">${esc(mermaid)}</div>
      <details style="margin-top:1rem;"><summary>Original Code</summary><pre style="background:var(--vscode-textCodeBlock-background);padding:1rem;border-radius:4px;overflow-x:auto;">${esc(code)}</pre></details>
      <details><summary>Mermaid Source</summary><pre style="background:var(--vscode-textCodeBlock-background);padding:1rem;border-radius:4px;overflow-x:auto;">${esc(mermaid)}</pre></details>
      <script>mermaid.initialize({startOnLoad:true,theme:document.body.classList.contains('vscode-light')?'default':'dark'});
      </script>
    </body></html>`;
  }

  private escape(text: string) {
    return text.replace(/[&<>"']/g, (ch) => {
      const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      };
      return map[ch] || ch;
    });
  }
}