// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import {
  installLexicalWriteBridge,
  requestLexicalMainWorldApplyRichText,
  requestLexicalMainWorldRichTextSnapshot,
  requestLexicalMainWorldWrite,
} from "../rich-text-adapters/lexical/bridge"

describe("lexical bridge", () => {
  it("should write text through installed lexical main-world bridge", async () => {
    document.body.innerHTML = `
      <div data-lexical-editor="true" contenteditable="true">
        <p><span data-lexical-text="true">旧文本</span></p>
      </div>
    `

    const root = document.querySelector("[data-lexical-editor='true']") as HTMLDivElement & {
      __lexicalEditor?: {
        parseEditorState: (value: string) => unknown
        setEditorState: (state: unknown) => void
      }
    }

    const parsedState = { ok: true }
    const parseEditorState = (value: string) => ({ ...parsedState, value })
    let appliedState: unknown
    root.__lexicalEditor = {
      parseEditorState,
      setEditorState: (state: unknown) => {
        appliedState = state
      },
    }

    installLexicalWriteBridge(window)
    const result = await requestLexicalMainWorldWrite(root, "桥接新文本", window)

    expect(result).toBe(true)
    expect(appliedState).toEqual({
      ok: true,
      value: JSON.stringify({
        root: {
          children: [
            {
              children: [
                {
                  detail: 0,
                  format: 0,
                  mode: "normal",
                  style: "",
                  text: "桥接新文本",
                  type: "text",
                  version: 1,
                },
              ],
              direction: null,
              format: "",
              indent: 0,
              type: "paragraph",
              version: 1,
            },
          ],
          direction: null,
          format: "",
          indent: 0,
          type: "root",
          version: 1,
        },
      }),
    })
  })

  it("should snapshot and re-apply lexical rich text without losing formatting", async () => {
    document.body.innerHTML = `
      <div data-lexical-editor="true" contenteditable="true">
        <p><strong><span data-lexical-text="true">Hello</span></strong> <a href="https://example.com"><span data-lexical-text="true">world</span></a></p>
      </div>
    `

    const serializedState = {
      root: {
        children: [
          {
            children: [
              {
                detail: 0,
                format: 1,
                mode: "normal",
                style: "",
                text: "Hello",
                type: "text",
                version: 1,
              },
              {
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                text: " ",
                type: "text",
                version: 1,
              },
              {
                children: [
                  {
                    detail: 0,
                    format: 0,
                    mode: "normal",
                    style: "",
                    text: "world",
                    type: "text",
                    version: 1,
                  },
                ],
                rel: null,
                target: null,
                title: null,
                type: "link",
                url: "https://example.com",
                version: 1,
              },
            ],
            direction: null,
            format: "",
            indent: 0,
            type: "paragraph",
            version: 1,
          },
        ],
        direction: null,
        format: "",
        indent: 0,
        type: "root",
        version: 1,
      },
    }

    const root = document.querySelector("[data-lexical-editor='true']") as HTMLDivElement & {
      __lexicalEditor?: {
        getEditorState: () => { toJSON: () => unknown }
        parseEditorState: (value: string) => unknown
        setEditorState: (state: unknown) => void
      }
    }

    const parseEditorState = (value: string) => ({ ok: true, value })
    let appliedState: unknown
    root.__lexicalEditor = {
      getEditorState: () => ({
        toJSON: () => JSON.parse(JSON.stringify(serializedState)),
      }),
      parseEditorState,
      setEditorState: (state: unknown) => {
        appliedState = state
      },
    }

    installLexicalWriteBridge(window)

    const snapshot = await requestLexicalMainWorldRichTextSnapshot(root, window)

    expect(snapshot).toEqual({
      html: `<p><strong><span data-read-frog-lexical-text-path="0.0">Hello</span></strong><span data-read-frog-lexical-text-path="0.1"> </span><a href="https://example.com"><span data-read-frog-lexical-text-path="0.2.0">world</span></a></p>`,
      plainText: "Hello world\n",
      serializedState: JSON.stringify(serializedState),
      textNodePaths: ["0.0", "0.1", "0.2.0"],
    })

    const translatedHtml = `<p><strong><span data-read-frog-lexical-text-path="0.0">Bonjour</span></strong><span data-read-frog-lexical-text-path="0.1"> </span><a href="https://example.com"><span data-read-frog-lexical-text-path="0.2.0">monde</span></a></p>`

    const result = await requestLexicalMainWorldApplyRichText(root, snapshot!, translatedHtml, window)

    expect(result).toBe(true)
    expect(appliedState).toEqual({
      ok: true,
      value: JSON.stringify({
        root: {
          children: [
            {
              children: [
                {
                  detail: 0,
                  format: 1,
                  mode: "normal",
                  style: "",
                  text: "Bonjour",
                  type: "text",
                  version: 1,
                },
                {
                  detail: 0,
                  format: 0,
                  mode: "normal",
                  style: "",
                  text: " ",
                  type: "text",
                  version: 1,
                },
                {
                  children: [
                    {
                      detail: 0,
                      format: 0,
                      mode: "normal",
                      style: "",
                      text: "monde",
                      type: "text",
                      version: 1,
                    },
                  ],
                  rel: null,
                  target: null,
                  title: null,
                  type: "link",
                  url: "https://example.com",
                  version: 1,
                },
              ],
              direction: null,
              format: "",
              indent: 0,
              type: "paragraph",
              version: 1,
            },
          ],
          direction: null,
          format: "",
          indent: 0,
          type: "root",
          version: 1,
        },
      }),
    })
  })
})
