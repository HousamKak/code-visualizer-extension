Awesome foundation. Below is a drop-in upgrade you can use right away:

# 1) Rock-solid AI prompts (copy-paste ready)

Use a single, reusable **system** prompt for all providers + a short **diagram-type addendum** + your **user code**. The system prompt enforces strict output and self-linting; the addendum gives type-specific rules.

## 1.1 System prompt (strict, provider-agnostic)

```
You are a Mermaid specialist. Produce a SINGLE Mermaid diagram only.

OUTPUT CONTRACT (must follow EXACTLY):
- First line is the correct Mermaid header for the requested type.
- No code fences, no Markdown, no explanations, no JSON, no extra text.
- Use only ASCII.
- Keep node/participant identifiers: [A–Z][a–z][0–9]_ (underscores allowed; no spaces or hyphens).
- Labels must be <= 40 chars, no quotes/backticks.
- If unsure, choose the simplest valid construct rather than inventing syntax.

SELF-LINT BEFORE ANSWERING (mandatory fixes):
- For sequence: no 'return' lines; arrows only '->' or '->>'; alt/else/end are balanced; message lines match:
  ^\s*[A-Za-z0-9_]+\s*->>?\s*[A-Za-z0-9_]+\s*:\s+\S
- For flowchart: header 'flowchart TD' (or the requested dir). Every referenced node exists.
- For class: header 'classDiagram'. Close every 'class { ... }'. Valid relationships only: --|>, ..|>, *--, o--, -->.
- Strip any accidental Markdown or commentary.
If any rule is violated, repair it BEFORE you output.
```

## 1.2 Addendum per diagram type

Pick the one you need and append it after the system prompt.

**Sequence**

```
sequenceDiagram
Rules:
- Declare participants you use: 'participant Name'
- Arrows: '->' (sync) or '->>' (async) only
- Control blocks: 'alt ...', 'else ...', 'end' (balanced)
- Optional: 'Note over A,B: ...', 'activate A', 'deactivate A'
- Never write 'return'
Focus: main call chain, major branches, error paths.
```

**Flowchart**

```
flowchart TD
Rules:
- Node decl: A[Text], B{Cond?}, C((Circle)), D[[Subproc]]
- Edges: A --> B, with optional label: A -- label --> B
- Every referenced node must be declared
- Prefer TD unless specified otherwise
Focus: decisions, loops, termination.
```

**Class**

```
classDiagram
Rules:
- class Foo { +pub():void -priv:int }
- Relationships: A <|-- B (inherit), A ..|> I (implements), A *-- B (composition), A o-- B (aggregation), A --> B (assoc)
- Multiplicity optional: "1" --> "many"
- Close every class block
Focus: public API, key fields/relations only.
```

**State**

```
stateDiagram-v2
Rules:
- [*] --> Idle  ; Idle --> Active: event
- Use alnum+underscore state names; include initial [*]
- Show main transitions and guards
```

**ER**

```
erDiagram
Rules:
- ENTITY { type field PK/FK markers optional }
- Relationships: A ||--o{ B : has ; ||, o|, }| for cardinality
- Keep names alnum+underscore
```

*(Add similar short addenda for journey/gitGraph/mindmap/timeline/quadrant/sankey/block if you use them.)*

## 1.3 User/content prompt template

```
Goal: Generate a <DIAGRAM_TYPE> diagram for this <LANGUAGE> code. Capture the main flow/relations accurately and concisely.

Constraints:
- Follow the OUTPUT CONTRACT and the <DIAGRAM_TYPE> rules from the system prompt.

Code:
<BEGIN>
{{code}}
<END>
```

> Wire this up in `AIProviderService.buildBody()` by composing:
>
> 1. system: the block in **1.1**
> 2. user: the **1.2** addendum for the chosen type + **1.3** template with injected code/language

---

# 2) Provider tweaks (small but high-impact)

* **Always send a system message** (even for providers that don’t require one; they all accept role “system” now).
* **Lower temperature**: 0.1–0.2 improves determinism for syntax.
* **Max tokens**: 1.5–2x your largest expected diagram.
* **Guard rails**: prepend `"!!STRICT!!"` to the system content to avoid model “chatty” spillover.
* **Latency fallback order**: openai → github → anthropic → local. (Keep your current fallback, but note OpenAI/GitHub tend to output cleaner Mermaid.)

Example (OpenAI and GitHub):

```ts
const system = STRICT_SYSTEM_PROMPT;    // from 1.1
const addendum = DIAGRAM_ADDENDA[diagramType]; // from 1.2
const user = buildUserPrompt(diagramType, language, code); // from 1.3

messages: [
  { role: 'system', content: system },
  { role: 'user', content: addendum + '\n\n' + user }
],
temperature: 0.2
```

---

# 3) Parser & validator hardening (concrete fixes)

You already did a lot right. The biggest current landmines:

### 3.1 Critical bug: you reject the valid `->>` arrow

In `performFinalSyntaxCheck()` you have:

```ts
if (diagram.match(/-> >|->>/)) {
  throw new Error('Diagram contains invalid arrow syntax');
}
```

`->>` **is valid** for async. Fix:

```ts
// Reject only spaced/broken arrows or long dashes:
const invalidArrow = /(->\s+>|-\s+>)|(-->|-->>)/;
if (invalidArrow.test(diagram)) {
  throw new Error('Diagram contains invalid arrow syntax');
}
```

### 3.2 Ensure participants are declared (sequence)

Add auto-declarations for any participant identifiers seen in messages:

```ts
// In SequenceParser.fixSequenceSyntax(), after you normalized messages:
const participants = new Set<string>();
for (const l of fixedLines) {
  const m = l.match(/^\s*([A-Za-z0-9_]+)\s*->>?\s*([A-Za-z0-9_]+)/);
  if (m) { participants.add(m[1]); participants.add(m[2]); }
}
// Prepend participant lines if missing
const headerIdx = fixedLines.findIndex(l => l.trim() === 'sequenceDiagram');
const already = new Set(
  fixedLines.filter(l => l.trim().startsWith('participant '))
            .map(l => l.trim().split(/\s+/)[1])
);
const toDeclare = [...participants].filter(p => !already.has(p));
const decls = toDeclare.map(p => `    participant ${p}`);
fixedLines.splice(headerIdx + 1, 0, ...decls);
```

### 3.3 Flowchart: auto-declare nodes & keep edges

Your current `FlowchartParser` may drop edges if nodes weren’t declared. Mermaid permits implicit nodes, but if you want declarations, auto-create them:

```ts
// After collecting connections:
const missing = [...nodeIdsFromEdges].filter(id => !nodeIds.has(id));
const decls = missing.map(id => `    ${id}[${id}]`);
if (!lines.some(l => l.trim().startsWith('flowchart '))) {
  fixedLines.unshift('flowchart TD');
}
fixedLines.splice(1, 0, ...decls); // insert after header
// Keep all edges as-is (normalized): A --> B, A -- label --> B
```

Also normalize labeled edges:

```ts
connection.replace(/--\s*([^>-][^>]*)\s*-->/, '-- $1 -->');
```

### 3.4 Class: robust relationship normalization & class closures

Replace the ad-hoc relationship replacements with a single regex map:

```ts
const REL = [
  { re: /:\s*Inherits?$/i, repl: ' --|> ' },
  { re: /:\s*Implements?$/i, repl: ' ..|> ' },
  { re: /:\s*Extends?$/i, repl: ' --|> ' },
  { re: /:\s*Uses?$/i, repl: ' --> ' },
];

let s = line;
for (const {re, repl} of REL) s = s.replace(re, repl);
s = s.replace(/\s*-->\s*/g, ' --> ');

// Ensure any class referenced in a relationship is declared at least once:
const names = [...s.matchAll(/\b([A-Za-z0-9_]+)\s*(?:--\|>|\. \.\|>|[*o-]{2}|-->)\s*([A-Za-z0-9_]+)/g)]
  .flatMap(m => [m[1], m[2]]);
for (const name of names) if (!declared.has(name)) {
  prelude.push(`class ${name}`);
  declared.add(name);
}
```

Also ensure every opened `class X {` eventually gets a `}`; if EOF hits while `inClassDefinition`, append `}`.

### 3.5 ParserFactory: honor optional sentinels (future-proof)

If you later wrap model output with markers, prefer the inner content:

````ts
protected removeCodeBlocks(diagram: string): string {
  const between = diagram.match(/<<MERMAID_START>>\s*([\s\S]*?)\s*<<MERMAID_END>>/);
  const core = between ? between[1] : diagram;
  return core.replace(/```mermaid\n?/gi, '').replace(/```\n?/gi, '');
}
````

(You don’t have to emit markers now; this just lets you adopt them later without code changes.)

### 3.6 MermaidSyntaxValidator: add flowchart & class validators

```ts
static validateFlowchart(diagram: string): ValidationResult {
  const lines = diagram.split('\n');
  const errors: ValidationError[] = [];
  const nodes = new Set<string>();

  let hasHeader = /^flowchart\s+(TD|LR|BT|RL)/m.test(diagram);
  if (!hasHeader) errors.push({ line: 1, message: 'Missing flowchart header', originalText: '', suggestion: 'Add "flowchart TD"', severity: 'error' });

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line || line.startsWith('flowchart')) return;

    // node decl
    const nd = line.match(/^([A-Za-z0-9_]+)\s*(\[[^\]]+\]|\{[^}]+\}|\(\([^)]+\)\)|\[\[[^\]]+\]\])/);
    if (nd) nodes.add(nd[1]);

    // edge
    const ed = line.match(/^([A-Za-z0-9_]+)\s*--(?:\s*([^>]+)\s*)?-->\s*([A-Za-z0-9_]+)/);
    if (ed) {
      const [, a,, b] = ed;
      if (!/^[A-Za-z0-9_]+$/.test(a) || !/^[A-Za-z0-9_]+$/.test(b)) {
        errors.push({ line: idx+1, message: 'Invalid node id in edge', originalText: raw, severity: 'error' });
      }
    }
  });

  return { isValid: errors.length === 0, errors, warnings: [] };
}

static validateClass(diagram: string): ValidationResult {
  const errors: ValidationError[] = [];
  if (!/^classDiagram/m.test(diagram)) {
    errors.push({ line: 1, message: 'Missing classDiagram header', originalText: '', suggestion: 'Add "classDiagram"', severity: 'error' });
  }
  // Basic relationship sanity
  const badRel = diagram.match(/-->|--\|>|\.\.\|>|[*o]-{2}/g) === null;
  // (You can add deeper checks as needed)
  return { isValid: errors.length === 0 && !badRel, errors, warnings: [] };
}

static validateDiagram(diagram: string, type: string): ValidationResult {
  switch (type) {
    case 'sequence': return this.validateSequenceDiagram(diagram);
    case 'flowchart': return this.validateFlowchart(diagram);
    case 'classDiagram': return this.validateClass(diagram);
    default: return { isValid: true, errors: [], warnings: [] };
  }
}
```

### 3.7 Final sanitizer (tiny but useful)

* Trim trailing spaces, collapse triple blank lines to one.
* Remove invisible Unicode (zero-width spaces) that sometimes sneak in:

```ts
cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, '');
```

---

# 4) Make prompts & parsers work together

* **Deterministic headers**: Your system/addendum puts the header on line 1; your `ensureHeader` keeps idempotency.
* **Identifiers**: Prompts ban spaces/hyphens; parsers still sanitize if they slip through.
* **No ‘return’**: Prompt forbids; sequence parser removes if present; validator errors if any remain.
* **Auto-declarations**: Sequence & flowchart create missing participants/nodes → prevents “dangling” edges.
* **Relationship normalization**: Class parser converts English labels to Mermaid relations.
* **Validator loop**: If `MermaidSyntaxValidator` reports hard errors, your `autoFix...` attempts repair, then re-validates.

---

# 5) Minimal code changes you should apply now

1. **Fix `performFinalSyntaxCheck`** invalid arrow logic (3.1).
2. **Add participant auto-declarations** in `SequenceParser` (3.2).
3. **Add node auto-declarations + keep edges** in `FlowchartParser` (3.3).
4. **Normalize relationships + ensure class closure** in `ClassParser` (3.4).
5. **Extend `MermaidSyntaxValidator`** for flowchart & class (3.6).
6. **Add zero-width char scrub** (3.7).
7. **Adopt the system/addendum prompts** in `AIProviderService` (1.1–1.3).

---

# 6) Example: updating `AIProviderService` prompt composition

```ts
// somewhere shared
const STRICT_SYSTEM_PROMPT = `<<same as §1.1>>`;
const DIAGRAM_ADDENDA: Record<DiagramType, string> = {
  sequence: `<<sequence addendum from §1.2>>`,
  flowchart: `<<flowchart addendum>>`,
  classDiagram: `<<class addendum>>`,
  stateDiagram: `<<state addendum>>`,
  erDiagram: `<<er addendum>>`,
  journey: `journey\nRules: keep to mermaid journey syntax...`
};

function buildUserPrompt(dt: DiagramType, lang: string, code: string) {
  return `Goal: Generate a ${dt} diagram for this ${lang} code.\n\nConstraints:\n- Follow the OUTPUT CONTRACT and ${dt} rules.\n\nCode:\n<BEGIN>\n${code}\n<END>`;
}

// In generateDiagram()
const system = STRICT_SYSTEM_PROMPT;
const addendum = DIAGRAM_ADDENDA[diagramType] ?? '';
const user = buildUserPrompt(diagramType as DiagramType, language, code);

messages: [
  { role: 'system', content: system },
  { role: 'user', content: addendum + '\n\n' + user }
],
temperature: 0.2
```

---

# 7) Quick regression tests (copy into your test runner)

**Sequence (should pass & auto-declare participants)**

Input (LLM output):

```
sequenceDiagram
Service->>DB: query
alt ok
DB -> Service: result
else fail
DB -> Service: error
end
return
```

Expected cleaned:

```
sequenceDiagram
    participant Service
    participant DB
    Service ->> DB: query
    alt ok
        DB -> Service: result
    else fail
        DB -> Service: error
    end
```

**Flowchart (should auto-declare nodes and keep edges)**

Input:

```
flowchart TD
A --> B
B -- yes --> C
B -- no --> D
```

Ensure nodes A,B,C,D exist after cleaning (declare missing with `[ID]` labels if needed).

**Class (normalize relations, close classes)**

Input:

```
classDiagram
class Foo
+run():void
class Bar {
  -x:int
}
Foo --> Bar : Uses
Baz : Implements
```

Expected: `Foo --> Bar` normalized; `Baz` declared; `Foo { ... }` properly closed.

---

# 8) Practical checklist (to avoid “mystery” render failures)

* Header is the very first non-blank line.
* No Markdown fences/backticks anywhere.
* Only ASCII; strip ZWSP/ZWJ.
* Sequence: only `->` / `->>`, no `return`, balanced blocks, valid message regex.
* Flowchart: all nodes declared or auto-declared; arrows `-->` only; labels use `-- label -->`.
* Class: close braces, valid relationships, declare names referenced only in relations.
* Keep identifiers alnum+underscore; if the LLM emits spaces/hyphens, sanitize to `_`.

---

If you want, I can turn the snippets above into exact diffs against your files.
