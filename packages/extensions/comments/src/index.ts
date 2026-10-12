import { Extension, Mark, mergeAttributes } from '@tiptap/core'
import type { Schema } from '@tiptap/pm/model'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'
import type { TextEditor } from '@editor/core'
import type { TextEditorExtension, TiptapEditor, ToolbarItem } from '@editor/plugin-api'

/* ------------------------------------------------------------------ *
 * Data model (stored separately from the document)
 * ------------------------------------------------------------------ */

export type CommentStatus = 'open' | 'resolved'

export interface CommentReply {
  id: string
  author: string
  date: number
  body: string
}

export interface CommentThread {
  id: string
  author: string
  date: number
  body: string
  replies: CommentReply[]
  status: CommentStatus
}

export interface CommentsOptions {
  /** Author recorded on new comments / replies. Defaults to `Unknown`. */
  author?: string
  /** Clock used to timestamp comments. Defaults to `Date.now`. */
  now?: () => number
  /** Id generator for threads / replies. Defaults to a random id. */
  createId?: () => string
  /** Restore a previously persisted set of threads. */
  threads?: CommentThread[]
  /** Called whenever threads change (add / reply / resolve / remove). */
  onChange?: (threads: CommentThread[]) => void
  /**
   * Ask the host for a comment body for the current selection. Return `null`
   * to cancel. May be async (e.g. a dialog). Defaults to `window.prompt`.
   */
  onRequestComment?: (selectedText: string) => string | null | Promise<string | null>
  /** Toolbar label. Defaults to `Comment`. */
  label?: string
}

export interface CommentsStorage {
  threads: CommentThread[]
  listeners: Set<() => void>
  emit: () => void
}

const MAX_ID_LENGTH = 40

function randomId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function cloneThread(thread: CommentThread): CommentThread {
  return { ...thread, replies: thread.replies.map((reply) => ({ ...reply })) }
}

function createStorage(initial: CommentThread[]): CommentsStorage {
  const storage: CommentsStorage = {
    threads: initial.map(cloneThread),
    listeners: new Set(),
    emit() {
      for (const listener of storage.listeners) listener()
    },
  }
  return storage
}

/** Either the public editor wrapper or the underlying engine. */
export type CommentEditor = TextEditor | TiptapEditor

/** Resolve the underlying engine from either the wrapper or the engine itself. */
export function getEngine(editor: CommentEditor): TiptapEditor {
  return 'engine' in editor ? (editor as TextEditor).engine : (editor as TiptapEditor)
}

/** Read the live comment storage off an editor. */
export function getCommentsStorage(editor: CommentEditor): CommentsStorage {
  return (getEngine(editor).storage as Record<string, unknown>).comments as CommentsStorage
}

/** Current comment threads (live array — copy before persisting). */
export function getCommentThreads(editor: CommentEditor): CommentThread[] {
  return getCommentsStorage(editor).threads
}

/** Subscribe to comment-thread changes. Returns an unsubscribe function. */
export function subscribeComments(editor: CommentEditor, listener: () => void): () => void {
  const storage = getCommentsStorage(editor)
  storage.listeners.add(listener)
  return () => storage.listeners.delete(listener)
}

/* ------------------------------------------------------------------ *
 * Comment mark
 * ------------------------------------------------------------------ */

/**
 * `comment` mark — tags a range with a thread id. The thread itself lives in
 * the extension storage (and can be persisted independently of the document).
 */
export const CommentMark = Mark.create({
  name: 'comment',
  inclusive: false,
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-comment-id'),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.id == null ? {} : { 'data-comment-id': String(attributes.id) },
      },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-comment]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-comment': '', class: 'editor-comment' }),
      0,
    ]
  },
})

/* ------------------------------------------------------------------ *
 * Range helpers
 * ------------------------------------------------------------------ */

interface Run {
  from: number
  to: number
  attrs: Record<string, unknown>
}

function sameAttrs(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) if (a[key] !== b[key]) return false
  return true
}

/** Contiguous runs carrying `markType` (with attrs) inside `[from, to)`. */
function markRuns(doc: PMNode, from: number, to: number, markTypeName: string): Run[] {
  const runs: Run[] = []
  let open: Run | null = null
  doc.nodesBetween(from, to, (node, pos) => {
    const mark = node.isInline ? node.marks.find((m) => m.type.name === markTypeName) : undefined
    if (mark) {
      const nodeFrom = Math.max(pos, from)
      const nodeTo = Math.min(pos + node.nodeSize, to)
      if (open && open.to === nodeFrom && sameAttrs(open.attrs, mark.attrs as Record<string, unknown>)) {
        open.to = nodeTo
      } else {
        if (open) runs.push(open)
        open = { from: nodeFrom, to: nodeTo, attrs: mark.attrs as Record<string, unknown> }
      }
    } else if (open) {
      runs.push(open)
      open = null
    }
  })
  if (open) runs.push(open)
  return runs
}

/** Ranges of the document tagged with a given comment thread id. */
export function getCommentRanges(doc: PMNode, id: string): { from: number; to: number }[] {
  return markRuns(doc, 0, doc.content.size, 'comment')
    .filter((run) => run.attrs.id === id)
    .map((run) => ({ from: run.from, to: run.to }))
}

/** Every comment thread id currently present in the document, in order. */
export function getCommentIds(doc: PMNode): string[] {
  const ids: string[] = []
  for (const run of markRuns(doc, 0, doc.content.size, 'comment')) {
    const id = run.attrs.id
    if (typeof id === 'string' && !ids.includes(id)) ids.push(id)
  }
  return ids
}

/** Link tracked insertion/deletion marks inside a range to a comment thread. */
function linkChangesToComment(
  tr: Transaction,
  from: number,
  to: number,
  commentId: string,
  schema: Schema,
): void {
  for (const name of ['insertion', 'deletion']) {
    const type = schema.marks[name]
    if (!type) continue
    for (const run of markRuns(tr.doc, from, to, name)) {
      tr.removeMark(run.from, run.to, type)
      tr.addMark(run.from, run.to, type.create({ ...run.attrs, commentId }))
    }
  }
}

/* ------------------------------------------------------------------ *
 * Commands
 * ------------------------------------------------------------------ */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    comments: {
      /** Tag the current selection with a new comment thread. */
      addComment: (body: string) => ReturnType
      /** Remove a thread and its document mark. */
      removeComment: (id: string) => ReturnType
      /** Mark a thread resolved. */
      resolveComment: (id: string) => ReturnType
      /** Re-open a resolved thread. */
      reopenComment: (id: string) => ReturnType
      /** Append a reply to a thread. */
      replyToComment: (id: string, body: string) => ReturnType
    }
  }
}

function defaultRequestComment(selectedText: string): string | null {
  if (typeof window === 'undefined' || typeof window.prompt !== 'function') return null
  const preview = selectedText.length > MAX_ID_LENGTH ? `${selectedText.slice(0, MAX_ID_LENGTH)}…` : selectedText
  return window.prompt(`Comment on “${preview}”`)
}

/* ------------------------------------------------------------------ *
 * Extension factory
 * ------------------------------------------------------------------ */

/**
 * Comment threads anchored to document ranges. The thread data is stored
 * separately from the document (see {@link getCommentThreads}); the document
 * only carries a `comment` mark with the thread id. Opt-in.
 */
export function Comments(options: CommentsOptions = {}): TextEditorExtension {
  const author = options.author ?? 'Unknown'
  const now = options.now ?? (() => Date.now())
  const createId = options.createId ?? randomId
  const request = options.onRequestComment ?? defaultRequestComment

  const items: ToolbarItem[] = [
    {
      name: 'addComment',
      label: options.label ?? 'Comment',
      group: 'review',
      isActive: (editor) => editor.isActive('comment'),
      isEnabled: (editor) => !editor.state.selection.empty,
      run: (editor) => {
        const { from, to } = editor.state.selection
        const selectedText = editor.state.doc.textBetween(from, to, ' ')
        void (async () => {
          const body = await request(selectedText)
          if (body == null || !body.trim()) return
          editor.commands.addComment(body.trim())
        })()
      },
    },
  ]

  const plugin = Extension.create({
    name: 'comments',
    addStorage() {
      return createStorage(options.threads ?? [])
    },
    addCommands() {
      const notify = (editor: TiptapEditor): void => {
        const storage = getCommentsStorage(editor)
        storage.emit()
        options.onChange?.(storage.threads.map(cloneThread))
      }

      return {
        addComment:
          (body: string) =>
          ({ state, tr, editor, dispatch }) => {
            const { from, to } = state.selection
            if (from === to) return false
            const commentType = state.schema.marks.comment
            if (!commentType) return false

            const id = createId()
            tr.addMark(from, to, commentType.create({ id }))
            linkChangesToComment(tr, from, to, id, state.schema)

            if (dispatch) {
              const storage = getCommentsStorage(editor)
              storage.threads.push({
                id,
                author,
                date: now(),
                body,
                replies: [],
                status: 'open',
              })
              notify(editor)
            }
            return true
          },

        removeComment:
          (id: string) =>
          ({ state, tr, editor, dispatch }) => {
            const commentType = state.schema.marks.comment
            if (!commentType) return false
            const ranges = markRuns(state.doc, 0, state.doc.content.size, 'comment').filter(
              (run) => run.attrs.id === id,
            )
            for (const range of ranges) tr.removeMark(range.from, range.to, commentType)
            if (dispatch) {
              const storage = getCommentsStorage(editor)
              storage.threads = storage.threads.filter((thread) => thread.id !== id)
              notify(editor)
            }
            return ranges.length > 0
          },

        resolveComment:
          (id: string) =>
          ({ editor, dispatch }) => {
            const storage = getCommentsStorage(editor)
            const thread = storage.threads.find((item) => item.id === id)
            if (!thread || thread.status === 'resolved') return false
            if (dispatch) {
              thread.status = 'resolved'
              notify(editor)
            }
            return true
          },

        reopenComment:
          (id: string) =>
          ({ editor, dispatch }) => {
            const storage = getCommentsStorage(editor)
            const thread = storage.threads.find((item) => item.id === id)
            if (!thread || thread.status === 'open') return false
            if (dispatch) {
              thread.status = 'open'
              notify(editor)
            }
            return true
          },

        replyToComment:
          (id: string, body: string) =>
          ({ editor, dispatch }) => {
            const storage = getCommentsStorage(editor)
            const thread = storage.threads.find((item) => item.id === id)
            if (!thread) return false
            if (dispatch) {
              thread.replies.push({ id: createId(), author, date: now(), body })
              notify(editor)
            }
            return true
          },
      }
    },
  })

  return {
    name: 'comments',
    tiptap: [CommentMark, plugin],
    toolbarItems: items,
  }
}

export { createCommentPanel } from './panel'
export type { CommentPanel, CommentPanelOptions } from './panel'
