export interface RichTextTranslationSource {
  text: string
  richTextInput: string
}

export interface RichTextEditorAdapter<
  Context = unknown,
  Source extends RichTextTranslationSource = RichTextTranslationSource,
> {
  name: string
  applyTranslatedText: (context: Context, translatedText: string, source: Source) => Promise<boolean>
  getComparableText: (context: Context) => Promise<string>
  getSource: (context: Context) => Promise<Source | null>
  resolveContext: (element: HTMLElement) => Context | null
}

export interface ResolvedRichTextEditorAdapter {
  name: string
  applyTranslatedText: (translatedText: string, source: RichTextTranslationSource) => Promise<boolean>
  getComparableText: () => Promise<string>
  getSource: () => Promise<RichTextTranslationSource | null>
}

function resolveAdapter<Context, Source extends RichTextTranslationSource>(
  adapter: RichTextEditorAdapter<Context, Source>,
  element: HTMLElement,
): ResolvedRichTextEditorAdapter | null {
  const context = adapter.resolveContext(element)
  if (!context) {
    return null
  }

  return {
    name: adapter.name,
    applyTranslatedText: async (translatedText, source) =>
      await adapter.applyTranslatedText(context, translatedText, source as Source),
    getComparableText: async () => await adapter.getComparableText(context),
    getSource: async () => await adapter.getSource(context),
  }
}

export function createRichTextEditorResolver(
  adapters: RichTextEditorAdapter<any, any>[],
): (element: HTMLElement) => ResolvedRichTextEditorAdapter | null {
  return (element: HTMLElement) => {
    for (const adapter of adapters) {
      const resolved = resolveAdapter(adapter, element)
      if (resolved) {
        return resolved
      }
    }

    return null
  }
}
