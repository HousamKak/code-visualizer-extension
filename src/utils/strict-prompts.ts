import { DiagramType } from '../types';

/**
 * Strict system prompt for all AI providers (STRICT.md section 1.1)
 * Enforces zero-tolerance syntax compliance and requires structured output
 */
export const strictSystemPrompt = `!!STRICT!!

You are a code analysis and visualization expert. You will produce BOTH a Mermaid diagram and a function explanation.

OUTPUT CONTRACT (must follow EXACTLY):
1. First, output a section marked "EXPLANATION:" containing a clear explanation of the function
2. Then output a section marked "DIAGRAM:" containing ONLY the Mermaid diagram

FORMAT:
EXPLANATION:
**Overview:**
[1-2 sentence summary of what this function does. Use inline code with backticks for function names, variables, and parameters.]

**Key Logic:**
- [Main steps or decision points - use inline code for technical terms]
- [Important flows or conditions - highlight async/await, database operations]
- [Error handling approach - mention try-catch blocks if present]

**Complexity:**
[Brief assessment: Simple/Moderate/Complex and why. Mention cyclomatic complexity factors.]

**Technical Details:**
- [Database operations, API calls, etc. - use inline code for method names and endpoints]
- [Transaction handling - highlight promise chains or async patterns]
- [Edge cases or special conditions - use code formatting for null/undefined checks]

**Recommendations:**
- [Potential improvements - be specific with code examples in backticks]
- [Best practices to follow - use IMPORTANT, NOTE, or TIP prefixes when applicable]
- [Common pitfalls to avoid - use WARNING or CAUTION for critical issues]

FORMATTING GUIDELINES FOR EXPLANATION:
- Use backticks \`like this\` for all code references: function names, variables, parameters, types
- Use IMPORTANT/WARNING/NOTE/TIP/CAUTION keywords for emphasis where appropriate
- Keep technical terms consistent (async, await, Promise, callback, database, API, etc.)
- Be concise but informative - each bullet should add value
- Focus on the "why" and "what could go wrong", not just the "what"

DIAGRAM:
[Mermaid diagram only - no code fences, no markdown, no extra text]

DIAGRAM SYNTAX RULES (must follow EXACTLY):
- First line is the correct Mermaid header for the requested type.
- Use only ASCII.
- Keep node/participant identifiers: [A–Z][a–z][0–9]_ (underscores allowed; no spaces or hyphens).
- Labels must be <= 40 chars, no quotes/backticks.
- If unsure, choose the simplest valid construct rather than inventing syntax.

SELF-LINT BEFORE ANSWERING (mandatory fixes):
- For sequence: no 'return' lines; arrows only '->' or '->>'; alt/else/end are balanced; message lines match:
  ^\\s*[A-Za-z0-9_]+\\s*->>?\\s*[A-Za-z0-9_]+\\s*:\\s+\\S
- For flowchart: header 'flowchart TD' (or the requested dir). Every referenced node exists.
- For class: header 'classDiagram'. Close every 'class { ... }'. Valid relationships only: --|>, ..|>, *--, o--, -->.
- Strip any accidental Markdown or commentary from diagram section.
If any rule is violated, repair it BEFORE you output.`;

/**
 * Diagram-specific addenda for system prompts (STRICT.md section 1.2)
 */
export const diagramAddenda: Record<DiagramType, string> = {
  'sequence': `sequenceDiagram
Rules:
- Declare participants you use: 'participant Name'
- Arrows: '->' (sync) or '->>' (async) only
- Control blocks: 'alt ...', 'else ...', 'end' (balanced)
- Optional: 'Note over A,B: ...', 'activate A', 'deactivate A'
- Never write 'return'
Focus: main call chain, major branches, error paths.`,

  'flowchart': `flowchart TD
Rules:
- Node decl: A[Text], B{Cond?}, C((Circle)), D[[Subproc]]
- Edges: A --> B, with optional label: A -- label --> B
- Every referenced node must be declared
- Prefer TD unless specified otherwise
Focus: decisions, loops, termination.`,

  'classDiagram': `classDiagram
Rules:
- class Foo { +pub():void -priv:int }
- Relationships: A <|-- B (inherit), A ..|> I (implements), A *-- B (composition), A o-- B (aggregation), A --> B (assoc)
- Multiplicity optional: "1" --> "many"
- Close every class block
Focus: public API, key fields/relations only.`,

  'stateDiagram': `stateDiagram-v2
Rules:
- [*] --> Idle  ; Idle --> Active: event
- Use alnum+underscore state names; include initial [*]
- Show main transitions and guards`,

  'erDiagram': `erDiagram
Rules:
- ENTITY { type field PK/FK markers optional }
- Relationships: A ||--o{ B : has ; ||, o|, }| for cardinality
- Keep names alnum+underscore`,

  'journey': `journey
Rules:
- title Journey Title
- section Section Name
- Task Name: Score: Actor1, Actor2
- Use descriptive task names
- Include emotional scores (1-5)`,

  'gitGraph': `gitGraph
Rules:
- commit id: "commit message"
- branch feature
- checkout feature
- merge main
- Use descriptive commit messages`,

  'mindmap': `mindmap
Rules:
- root((Central Idea))
- Use parentheses for hierarchy
- Keep labels concise
- Show logical relationships`,

  'timeline': `timeline
Rules:
- title Timeline Title
- section Period
- Event: Description
- Use chronological order
- Include key milestones`,

  'quadrantChart': `quadrantChart
Rules:
- title Chart Title
- x-axis Low --> High
- y-axis Low --> High
- quadrant-1 Label
- Item: [x, y]
- Position items accurately`,

  'sankey': `sankey-beta
Rules:
- Source,Target,Value
- Use meaningful node names
- Show flow proportions
- Label all connections`,

  'block': `block-beta
Rules:
- columns auto-fit
- block:name
- Use descriptive block names
- Show component relationships`
};

/**
 * Build user prompt template (STRICT.md section 1.3)
 */
export function buildUserPrompt(diagramType: DiagramType, language: string, code: string): string {
  return `Goal: Generate both an explanation and a ${diagramType} diagram for this ${language} code. Capture the main flow/relations accurately and concisely.

Constraints:
- Follow the OUTPUT CONTRACT and the ${diagramType} rules from the system prompt.
- Provide BOTH explanation and diagram in the specified format.

Code:
<BEGIN>
${code}
<END>`;
}

/**
 * Parse structured AI response containing both explanation and diagram
 * @param response - Raw AI response
 * @returns Object with explanation and diagram, or throws if parsing fails
 */
export function parseStructuredResponse(response: string): { explanation: string; diagram: string } {
  // Try to extract explanation and diagram sections
  const explanationMatch = response.match(/EXPLANATION:\s*([\s\S]*?)(?=DIAGRAM:|$)/i);
  const diagramMatch = response.match(/DIAGRAM:\s*([\s\S]*?)$/i);

  let explanation = '';
  let diagram = '';

  if (explanationMatch && explanationMatch[1]) {
    explanation = explanationMatch[1].trim();
  }

  if (diagramMatch && diagramMatch[1]) {
    diagram = diagramMatch[1].trim();
  }

  // Fallback: If sections not clearly marked, try to split intelligently
  if (!explanation || !diagram) {
    // Look for common diagram starting patterns
    const diagramPatterns = [
      /^(flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gitGraph|mindmap|timeline|quadrantChart|sankey-beta|block-beta)/m
    ];

    for (const pattern of diagramPatterns) {
      const match = response.match(pattern);
      if (match) {
        const splitIndex = match.index!;
        explanation = response.substring(0, splitIndex).trim();
        diagram = response.substring(splitIndex).trim();
        break;
      }
    }
  }

  // If still no diagram found, assume entire response is diagram (backward compatibility)
  if (!diagram) {
    diagram = response.trim();
    explanation = '';
  }

  // Clean up explanation (remove markdown code fences if present)
  explanation = explanation.replace(/```[\s\S]*?```/g, '').trim();

  // Clean up diagram (remove code fences if present)
  diagram = diagram.replace(/^```(?:mermaid)?\s*/gm, '').replace(/```\s*$/gm, '').trim();

  return { explanation, diagram };
}