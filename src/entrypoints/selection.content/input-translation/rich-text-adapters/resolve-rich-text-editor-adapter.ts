import { lexicalEditorAdapter } from "./lexical/adapter"
import { createRichTextEditorResolver } from "./types"

export const resolveRichTextEditorAdapter = createRichTextEditorResolver([
  lexicalEditorAdapter,
])
