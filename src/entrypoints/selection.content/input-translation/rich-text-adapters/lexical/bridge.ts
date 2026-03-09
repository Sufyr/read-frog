import type { LexicalRichTextSnapshotData } from "./rich-text"
import { generateUUIDv4 } from "@/utils/crypto-polyfill"
import {
  applyRichTextWithLexicalEditor,
  createLexicalRichTextSnapshot,
  getLexicalRootElement,
  writeTextWithLexicalEditor,
} from "./rich-text"

interface LexicalWriteRequestDetail {
  requestId: string
  text: string
}

interface LexicalReadRichTextRequestDetail {
  requestId: string
}

interface LexicalApplyRichTextRequestDetail {
  requestId: string
  serializedState: string
  translatedHtml: string
  textNodePaths: string[]
}

type LexicalMainWorldRequestDetail
  = | ({ kind: "writeText" } & LexicalWriteRequestDetail)
    | ({ kind: "readRichText" } & LexicalReadRichTextRequestDetail)
    | ({ kind: "applyRichText" } & LexicalApplyRichTextRequestDetail)

type LexicalBooleanRequestDetail
  = | { kind: "writeText", text: string }
    | {
      kind: "applyRichText"
      serializedState: string
      translatedHtml: string
      textNodePaths: string[]
    }

interface LexicalBooleanResultDetail {
  requestId: string
  success?: boolean
}

interface LexicalRichTextSnapshotResultDetail extends LexicalRichTextSnapshotData {
  requestId: string
}

const LEXICAL_MAIN_WORLD_REQUEST_EVENT = "read-frog:lexical-main-request"
const LEXICAL_MAIN_WORLD_RESULT_EVENT = "read-frog:lexical-main-result"
const LEXICAL_REQUEST_ATTR = "data-read-frog-lexical-request"

export interface LexicalRichTextSnapshot extends LexicalRichTextSnapshotData {}

function createRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return generateUUIDv4()
}

function getRequestRootElement(windowObject: Window, requestId: string): HTMLElement | null {
  const requestElement = windowObject.document.querySelector(`[${LEXICAL_REQUEST_ATTR}="${requestId}"]`)
  return requestElement instanceof HTMLElement ? getLexicalRootElement(requestElement) : null
}

function dispatchLexicalBooleanResult(windowObject: Window, detail: LexicalBooleanResultDetail): void {
  windowObject.dispatchEvent(new CustomEvent<LexicalBooleanResultDetail>(LEXICAL_MAIN_WORLD_RESULT_EVENT, { detail }))
}

function dispatchLexicalRichTextSnapshotResult(windowObject: Window, detail: LexicalRichTextSnapshotResultDetail): void {
  windowObject.dispatchEvent(new CustomEvent<LexicalRichTextSnapshotResultDetail>(LEXICAL_MAIN_WORLD_RESULT_EVENT, { detail }))
}

export function installLexicalWriteBridge(windowObject: Window = window): void {
  const key = "__READ_FROG_LEXICAL_WRITE_BRIDGE_INSTALLED__"
  const bridgeWindow = windowObject as Window & Record<string, unknown>
  if (bridgeWindow[key]) {
    return
  }
  bridgeWindow[key] = true

  windowObject.addEventListener(LEXICAL_MAIN_WORLD_REQUEST_EVENT, (event: Event) => {
    const customEvent = event as CustomEvent<LexicalMainWorldRequestDetail>
    const request = customEvent.detail
    const requestId = request?.requestId
    if (!requestId) {
      return
    }

    const rootElement = getRequestRootElement(windowObject, requestId)

    if (request.kind === "writeText") {
      const success = rootElement ? writeTextWithLexicalEditor(rootElement, request.text) : false
      dispatchLexicalBooleanResult(windowObject, { requestId, success })
      return
    }

    if (request.kind === "readRichText") {
      const snapshot = rootElement ? createLexicalRichTextSnapshot(rootElement) : null
      if (!snapshot) {
        dispatchLexicalRichTextSnapshotResult(windowObject, {
          requestId,
          html: "",
          plainText: "",
          serializedState: "",
          textNodePaths: [],
        })
        return
      }

      dispatchLexicalRichTextSnapshotResult(windowObject, { requestId, ...snapshot })
      return
    }

    const success = rootElement
      ? applyRichTextWithLexicalEditor(
          rootElement,
          request.serializedState,
          request.translatedHtml,
          request.textNodePaths,
          windowObject,
        )
      : false
    dispatchLexicalBooleanResult(windowObject, { requestId, success })
  })
}

async function requestLexicalMainWorldBooleanResult(
  element: HTMLElement,
  detail: LexicalBooleanRequestDetail,
  windowObject: Window = window,
): Promise<boolean> {
  const requestId = createRequestId()

  return await new Promise<boolean>((resolve) => {
    let settled = false
    let timeoutId = 0

    function finish(success: boolean): void {
      if (settled) {
        return
      }
      settled = true
      windowObject.clearTimeout(timeoutId)
      cleanup()
      resolve(success)
    }

    function handleResult(event: Event): void {
      const customEvent = event as CustomEvent<LexicalBooleanResultDetail>
      if (customEvent.detail?.requestId !== requestId) {
        return
      }
      finish(Boolean(customEvent.detail.success))
    }

    function cleanup(): void {
      element.removeAttribute(LEXICAL_REQUEST_ATTR)
      windowObject.removeEventListener(LEXICAL_MAIN_WORLD_RESULT_EVENT, handleResult as EventListener)
    }

    timeoutId = windowObject.setTimeout(() => finish(false), 250)

    windowObject.addEventListener(LEXICAL_MAIN_WORLD_RESULT_EVENT, handleResult as EventListener)
    element.setAttribute(LEXICAL_REQUEST_ATTR, requestId)
    windowObject.dispatchEvent(new CustomEvent<LexicalMainWorldRequestDetail>(LEXICAL_MAIN_WORLD_REQUEST_EVENT, {
      detail: { requestId, ...detail } as LexicalMainWorldRequestDetail,
    }))
  })
}

async function requestLexicalMainWorldSnapshot(
  element: HTMLElement,
  windowObject: Window = window,
): Promise<LexicalRichTextSnapshotResultDetail | null> {
  const requestId = createRequestId()

  return await new Promise<LexicalRichTextSnapshotResultDetail | null>((resolve) => {
    let settled = false
    let timeoutId = 0

    function finish(detail: LexicalRichTextSnapshotResultDetail | null): void {
      if (settled) {
        return
      }
      settled = true
      windowObject.clearTimeout(timeoutId)
      cleanup()
      resolve(detail)
    }

    function handleResult(event: Event): void {
      const customEvent = event as CustomEvent<LexicalRichTextSnapshotResultDetail>
      if (customEvent.detail?.requestId !== requestId) {
        return
      }

      const detail = customEvent.detail
      if (!detail?.html || !detail.serializedState || !Array.isArray(detail.textNodePaths) || detail.textNodePaths.length === 0) {
        finish(null)
        return
      }

      finish(detail)
    }

    function cleanup(): void {
      element.removeAttribute(LEXICAL_REQUEST_ATTR)
      windowObject.removeEventListener(LEXICAL_MAIN_WORLD_RESULT_EVENT, handleResult as EventListener)
    }

    timeoutId = windowObject.setTimeout(() => finish(null), 250)

    windowObject.addEventListener(LEXICAL_MAIN_WORLD_RESULT_EVENT, handleResult as EventListener)
    element.setAttribute(LEXICAL_REQUEST_ATTR, requestId)
    windowObject.dispatchEvent(new CustomEvent<LexicalMainWorldRequestDetail>(LEXICAL_MAIN_WORLD_REQUEST_EVENT, {
      detail: { kind: "readRichText", requestId },
    }))
  })
}

export async function requestLexicalMainWorldWrite(element: HTMLElement, text: string, windowObject: Window = window): Promise<boolean> {
  return await requestLexicalMainWorldBooleanResult(element, { kind: "writeText", text }, windowObject)
}

export async function requestLexicalMainWorldRichTextSnapshot(
  element: HTMLElement,
  windowObject: Window = window,
): Promise<LexicalRichTextSnapshot | null> {
  const detail = await requestLexicalMainWorldSnapshot(element, windowObject)
  if (!detail) {
    return null
  }

  return {
    html: detail.html,
    plainText: detail.plainText,
    serializedState: detail.serializedState,
    textNodePaths: detail.textNodePaths,
  }
}

export async function requestLexicalMainWorldApplyRichText(
  element: HTMLElement,
  snapshot: LexicalRichTextSnapshot,
  translatedHtml: string,
  windowObject: Window = window,
): Promise<boolean> {
  return await requestLexicalMainWorldBooleanResult(
    element,
    {
      kind: "applyRichText",
      serializedState: snapshot.serializedState,
      translatedHtml,
      textNodePaths: snapshot.textNodePaths,
    },
    windowObject,
  )
}
