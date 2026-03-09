interface LexicalEditorLike {
  getEditorState?: () => {
    toJSON?: () => unknown
  }
  parseEditorState?: (serializedState: string) => unknown
  setEditorState?: (editorState: unknown) => void
  focus?: () => void
}

interface LexicalSerializedNode {
  type: string
  children?: LexicalSerializedNode[]
  text?: string
  format?: number | string
  style?: string
  listType?: string
  tag?: string
  url?: string
  [key: string]: unknown
}

interface LexicalTextNodeState extends LexicalSerializedNode {
  detail: number
  format: number
  mode: "normal"
  style: string
  text: string
  type: "text"
  version: 1
}

interface LexicalParagraphState extends LexicalSerializedNode {
  children: LexicalTextNodeState[]
  direction: null
  format: ""
  indent: 0
  type: "paragraph"
  version: 1
}

interface LexicalRootState {
  root: {
    children: LexicalSerializedNode[]
    direction: null
    format: ""
    indent: 0
    type: "root"
    version: 1
  }
}

export interface LexicalRichTextSnapshotData {
  html: string
  plainText: string
  serializedState: string
  textNodePaths: string[]
}

const LEXICAL_TEXT_PATH_ATTR = "data-read-frog-lexical-text-path"

// Lexical stores text styles in a bitmask number, not separate booleans.
const TEXT_FORMAT_BOLD = 1
const TEXT_FORMAT_ITALIC = 2
const TEXT_FORMAT_STRIKETHROUGH = 4
const TEXT_FORMAT_UNDERLINE = 8
const TEXT_FORMAT_CODE = 16
const TEXT_FORMAT_SUBSCRIPT = 32
const TEXT_FORMAT_SUPERSCRIPT = 64

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isLexicalRootState(value: unknown): value is LexicalRootState {
  return isRecord(value) && isRecord(value.root) && Array.isArray(value.root.children)
}

function getLexicalEditor(element: HTMLElement | null): LexicalEditorLike | null {
  const lexicalEditor = (element as HTMLElement & { __lexicalEditor?: LexicalEditorLike } | null)?.__lexicalEditor
  if (!lexicalEditor) {
    return null
  }
  return lexicalEditor
}

function getLexicalSerializedState(rootElement: HTMLElement): LexicalRootState | null {
  const lexicalEditor = getLexicalEditor(rootElement)
  const editorState = lexicalEditor?.getEditorState?.()
  const serializedState = editorState?.toJSON?.()
  return isLexicalRootState(serializedState) ? serializedState : null
}

function createLexicalTextNodeState(text: string): LexicalTextNodeState {
  return {
    detail: 0,
    format: 0,
    mode: "normal",
    style: "",
    text,
    type: "text",
    version: 1,
  }
}

function createLexicalEditorStateFromText(text: string): LexicalRootState {
  const lines = text.split(/\r?\n/)
  const paragraphs = (lines.length > 0 ? lines : [""]).map<LexicalParagraphState>(line => ({
    children: [createLexicalTextNodeState(line)],
    direction: null,
    format: "",
    indent: 0,
    type: "paragraph",
    version: 1,
  }))

  return {
    root: {
      children: paragraphs,
      direction: null,
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value).replaceAll("'", "&#39;")
}

function wrapTextWithFormatTags(text: string, format: number): string {
  let formattedText = text

  if (format & TEXT_FORMAT_CODE) {
    formattedText = `<code>${formattedText}</code>`
  }
  if (format & TEXT_FORMAT_BOLD) {
    formattedText = `<strong>${formattedText}</strong>`
  }
  if (format & TEXT_FORMAT_ITALIC) {
    formattedText = `<em>${formattedText}</em>`
  }
  if (format & TEXT_FORMAT_UNDERLINE) {
    formattedText = `<u>${formattedText}</u>`
  }
  if (format & TEXT_FORMAT_STRIKETHROUGH) {
    formattedText = `<s>${formattedText}</s>`
  }
  if (format & TEXT_FORMAT_SUBSCRIPT) {
    formattedText = `<sub>${formattedText}</sub>`
  }
  if (format & TEXT_FORMAT_SUPERSCRIPT) {
    formattedText = `<sup>${formattedText}</sup>`
  }

  return formattedText
}

function renderLexicalNodeHtml(node: LexicalSerializedNode, path: string, textNodePaths: string[]): string {
  if (node.type === "text") {
    const text = node.text ?? ""
    if (!text) {
      return ""
    }

    textNodePaths.push(path)
    const styleAttr = typeof node.style === "string" && node.style
      ? ` style="${escapeHtmlAttribute(node.style)}"`
      : ""
    const span = `<span ${LEXICAL_TEXT_PATH_ATTR}="${path}"${styleAttr}>${escapeHtml(text)}</span>`
    return wrapTextWithFormatTags(span, typeof node.format === "number" ? node.format : 0)
  }

  if (node.type === "linebreak") {
    return "<br />"
  }

  if (node.type === "tab") {
    return "&#9;"
  }

  const children = Array.isArray(node.children)
    ? node.children.map((child, index) => renderLexicalNodeHtml(child, `${path}.${index}`, textNodePaths)).join("")
    : ""

  if (node.type === "paragraph") {
    return `<p>${children}</p>`
  }

  if (node.type === "quote") {
    return `<blockquote>${children}</blockquote>`
  }

  if (node.type === "heading") {
    const tag = typeof node.tag === "string" && /^h[1-6]$/.test(node.tag) ? node.tag : "p"
    return `<${tag}>${children}</${tag}>`
  }

  if (node.type === "link" || node.type === "autolink") {
    const href = typeof node.url === "string" ? ` href="${escapeHtmlAttribute(node.url)}"` : ""
    return `<a${href}>${children}</a>`
  }

  if (node.type === "list") {
    const tag = node.listType === "number" ? "ol" : "ul"
    return `<${tag}>${children}</${tag}>`
  }

  if (node.type === "listitem") {
    return `<li>${children}</li>`
  }

  if (node.type === "code") {
    return `<pre><code>${children}</code></pre>`
  }

  return children
}

function collectLexicalPlainText(node: LexicalSerializedNode): string {
  if (node.type === "text") {
    return node.text ?? ""
  }

  if (node.type === "linebreak") {
    return "\n"
  }

  const childrenText = Array.isArray(node.children)
    ? node.children.map(collectLexicalPlainText).join("")
    : ""

  if (["paragraph", "quote", "heading", "listitem"].includes(node.type)) {
    return `${childrenText}\n`
  }

  return childrenText
}

function extractTranslatedTextMap(windowObject: Window, translatedHtml: string): Map<string, string> {
  const container = windowObject.document.createElement("template")
  container.innerHTML = translatedHtml

  const textMap = new Map<string, string>()
  const textElements = container.content.querySelectorAll(`[${LEXICAL_TEXT_PATH_ATTR}]`)

  for (const element of textElements) {
    const path = element.getAttribute(LEXICAL_TEXT_PATH_ATTR)
    if (!path) {
      continue
    }
    textMap.set(path, element.textContent ?? "")
  }

  return textMap
}

function applyTranslatedTextToLexicalNode(node: LexicalSerializedNode, path: string, textMap: Map<string, string>): void {
  if (node.type === "text") {
    const translatedText = textMap.get(path)
    if (translatedText !== undefined) {
      node.text = translatedText
    }
    return
  }

  if (!Array.isArray(node.children)) {
    return
  }

  for (const [index, child] of node.children.entries()) {
    applyTranslatedTextToLexicalNode(child, `${path}.${index}`, textMap)
  }
}

export function getLexicalRootElement(element: HTMLElement): HTMLElement | null {
  if (element.getAttribute("data-lexical-editor") === "true") {
    return element
  }

  const closestRoot = element.closest("[data-lexical-editor='true']")
  if (closestRoot instanceof HTMLElement) {
    return closestRoot
  }

  if (element.querySelector("[data-lexical-text='true']")) {
    return element
  }

  return null
}

export function createLexicalRichTextSnapshot(rootElement: HTMLElement): LexicalRichTextSnapshotData | null {
  const serializedState = getLexicalSerializedState(rootElement)
  if (!serializedState) {
    return null
  }

  const textNodePaths: string[] = []
  const html = serializedState.root.children
    .map((child, index) => renderLexicalNodeHtml(child, String(index), textNodePaths))
    .join("")

  if (textNodePaths.length === 0) {
    return null
  }

  const plainText = serializedState.root.children
    .map(collectLexicalPlainText)
    .join("")

  return {
    html,
    plainText,
    serializedState: JSON.stringify(serializedState),
    textNodePaths,
  }
}

export function writeTextWithLexicalEditor(rootElement: HTMLElement, text: string): boolean {
  const lexicalEditor = getLexicalEditor(rootElement)
  if (!lexicalEditor?.parseEditorState || !lexicalEditor?.setEditorState) {
    return false
  }

  const editorState = lexicalEditor.parseEditorState(JSON.stringify(createLexicalEditorStateFromText(text)))
  lexicalEditor.setEditorState(editorState)
  lexicalEditor.focus?.()
  return true
}

export function applyRichTextWithLexicalEditor(
  rootElement: HTMLElement,
  serializedState: string,
  translatedHtml: string,
  textNodePaths: string[],
  windowObject: Window,
): boolean {
  const lexicalEditor = getLexicalEditor(rootElement)
  if (!lexicalEditor?.parseEditorState || !lexicalEditor?.setEditorState) {
    return false
  }

  let parsedState: unknown
  try {
    parsedState = JSON.parse(serializedState)
  }
  catch {
    return false
  }

  if (!isLexicalRootState(parsedState)) {
    return false
  }

  const textMap = extractTranslatedTextMap(windowObject, translatedHtml)
  if (textNodePaths.some(path => !textMap.has(path))) {
    return false
  }

  for (const [index, child] of parsedState.root.children.entries()) {
    applyTranslatedTextToLexicalNode(child, String(index), textMap)
  }

  const editorState = lexicalEditor.parseEditorState(JSON.stringify(parsedState))
  lexicalEditor.setEditorState(editorState)
  lexicalEditor.focus?.()
  return true
}
