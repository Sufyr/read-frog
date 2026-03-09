import type { RichTextEditorAdapter, RichTextTranslationSource } from "../types"
import type { LexicalRichTextSnapshot } from "./bridge"
import {
  requestLexicalMainWorldApplyRichText,
  requestLexicalMainWorldRichTextSnapshot,
} from "./bridge"
import { getLexicalRootElement } from "./rich-text"

interface LexicalEditorContext {
  rootElement: HTMLElement
}

interface LexicalTranslationSource extends RichTextTranslationSource {
  snapshot: LexicalRichTextSnapshot
}

function resolveLexicalContext(element: HTMLElement): LexicalEditorContext | null {
  const rootElement = getLexicalRootElement(element)
  if (!rootElement) {
    return null
  }

  return { rootElement }
}

async function getLexicalTranslationSource(
  context: LexicalEditorContext,
): Promise<LexicalTranslationSource | null> {
  const snapshot = await requestLexicalMainWorldRichTextSnapshot(context.rootElement)
  if (!snapshot) {
    return null
  }

  return {
    text: snapshot.plainText,
    richTextInput: snapshot.html,
    snapshot,
  }
}

async function getLexicalComparableText(context: LexicalEditorContext): Promise<string> {
  const snapshot = await requestLexicalMainWorldRichTextSnapshot(context.rootElement)
  return snapshot?.plainText ?? ""
}

async function applyLexicalTranslatedText(
  context: LexicalEditorContext,
  translatedText: string,
  source: LexicalTranslationSource,
): Promise<boolean> {
  const applied = await requestLexicalMainWorldApplyRichText(
    context.rootElement,
    source.snapshot,
    translatedText,
  )

  if (applied) {
    context.rootElement.dispatchEvent(new Event("input", { bubbles: true }))
  }

  return applied
}

export const lexicalEditorAdapter: RichTextEditorAdapter<LexicalEditorContext, LexicalTranslationSource> = {
  name: "lexical",
  applyTranslatedText: applyLexicalTranslatedText,
  getComparableText: getLexicalComparableText,
  getSource: getLexicalTranslationSource,
  resolveContext: resolveLexicalContext,
}
