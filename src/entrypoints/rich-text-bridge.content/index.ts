import { defineContentScript } from "#imports"
import { installLexicalWriteBridge } from "@/entrypoints/selection.content/input-translation/rich-text-adapters/lexical/bridge"

export default defineContentScript({
  matches: ["*://*/*"],
  world: "MAIN",
  runAt: "document_start",
  main() {
    installLexicalWriteBridge()
  },
})
