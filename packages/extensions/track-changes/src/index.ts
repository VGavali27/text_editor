import { Extension, Mark, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Fragment, Slice } from '@tiptap/pm/model'
import type { Mark as PMMark, Node as PMNode } from '@tiptap/pm/model'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { ChangeSet } from 'prosemirror-changeset'
import type { TextEditorExtension, TiptapEditor, ToolbarItem } from '@editor/plugin-api'

/** Attributes recorded on every tracked insertion / deletion. */
export interface TrackChangeAttrs {
  /** Who made the change. */
  author: string | null
  /** Unix epoch (ms) when the change was made. */
  date: number | null
  /** Optional comment thread this change is attached to. */
  commentId: string | null
}

export interface TrackChangesOptions {
  /** Author recorded on tracked changes. Defaults to `null` (unknown). */
  author?: string
  /** Start with tracking switched on. Defaults to `false`. */
  enabled?: boolean
  /** Clock used to timestamp changes. Defaults to `Date.now`. */
  now?: () => number
  /** Toolbar label for the tracking toggle. Defaults to `Track`. */
  label?: string
}

/** Plugin key holding the boolean "tracking enabled" flag. */
export const trackChangesKey = new PluginKey<boolean>('trackChanges')

const APPLIED_META = 'trackChangesApplied'

/**
 * Set by the accept/reject review commands so their deletions are not
 * themselves recorded as new tracked changes.
 */
const REVIEW_META = 'trackChangesReview'

/* ------------------------------------------------------------------ *
 * Schema marks
 * ------------------------------------------------------------------ */

function renderData(key: string, value: unknown): Record<string, string> {
  return value == null ? {} : { [key]: String(value) }
}

/** Shared attribute set for the insertion / deletion marks. */
function changeAttributes() {
  return {
    author: {
      default: null,
      parseHTML: (element: HTMLElement) => element.getAttribute('data-author'),
      renderHTML: (attributes: Record<string, unknown>) =>
        renderData('data-author', attributes.author),
    },
    date: {
      default: null,
      parseHTML: (element: HTMLElement) => {
        const raw = element.getAttribute('data-date')
        return raw == null || raw === '' ? null : Number(raw)
      },
      renderHTML: (attributes: Record<string, unknown>) =>
        renderData('data-date', attributes.date),
    },
    commentId: {
      default: null,
      parseHTML: (element: HTMLElement) => element.getAttribute('data-comment-id'),
      renderHTML: (attributes: Record<string, unknown>) =>
        renderData('data-comment-id', attributes.commentId),
    },
  }
}

/**
 * `insertion` mark — text added while tracking was on. Renders as a highlighted
 * span; carries author / date / optional comment id.
 */
export const InsertionMark = Mark.create({
  name: 'insertion',
  inclusive: false,
  excludes: 'deletion',
  addAttributes: changeAttributes,
  parseHTML() {
    return [{ tag: 'span[data-insertion]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-insertion': '', class: 'editor-insertion' }),
      0,
    ]
  },
})

/**
 * `deletion` mark — text removed while tracking was on. The text is *kept* in
 * the document (struck through) until the change is accepted.
 */
export const DeletionMark = Mark.create({
  name: 'deletion',
  inclusive: false,
  excludes: 'insertion',
  addAttributes: changeAttributes,
  parseHTML() {
    return [{ tag: 'span[data-deletion]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-deletion': '', class: 'editor-deletion' }),
      0,
    ]
  },
})

/* ------------------------------------------------------------------ *
 * Fragment / slice helpers
 * ------------------------------------------------------------------ */

function addMarkToFragment(fragment: Fragment, mark: PMMark): Fragment {
  const nodes: PMNode[] = []
  fragment.forEach((child) => {
    if (child.isText) {
      nodes.push(child.mark(child.marks.concat(mark)))
    } else if (child.isLeaf) {
      const marks = child.marks.concat(mark)
      nodes.push(child.isInline && child.type.allowsMarks(marks) ? child.mark(marks) : child)
    } else {
      nodes.push(child.copy(addMarkToFragment(child.content, mark)))
    }
  })
  return Fragment.fromArray(nodes)
}

function addMarkToSlice(slice: Slice, mark: PMMark): Slice {
  return new Slice(addMarkToFragment(slice.content, mark), slice.openStart, slice.openEnd)
}

/* ------------------------------------------------------------------ *
 * Tracking core
 * ------------------------------------------------------------------ */

/**
 * Turn a batch of user transactions into a single appended transaction that
 * replays deletions as `deletion`-marked text and tags inserted text with the
 * `insertion` mark. Returns `null` when there is nothing to track.
 */
function buildTrackedTransaction(
  txs: readonly Transaction[],
  newState: EditorState,
  attrs: TrackChangeAttrs,
): Transaction | null {
  const insertionType = newState.schema.marks.insertion
  const deletionType = newState.schema.marks.deletion
  if (!insertionType || !deletionType) return null

  const baseDoc = txs[0].before
  let set = ChangeSet.create(baseDoc)
  for (const tr of txs) {
    set = set.addSteps(tr.doc, tr.mapping.maps, null)
  }
  if (!set.changes.length) return null

  const tr = newState.tr
  const insertionMark = insertionType.create({ ...attrs })
  const deletionMark = deletionType.create({ ...attrs })

  // Process from the end so earlier positions stay valid as we mutate.
  const changes = [...set.changes].sort((a, b) => b.fromB - a.fromB)
  let changed = false

  for (const change of changes) {
    const deletedSize = change.toA - change.fromA
    const insertedSize = change.toB - change.fromB

    if (deletedSize > 0) {
      const slice = baseDoc.slice(change.fromA, change.toA)
      tr.replaceRange(change.fromB, change.fromB, addMarkToSlice(slice, deletionMark))
      changed = true
    }

    if (insertedSize > 0) {
      const offset = deletedSize > 0 ? deletedSize : 0
      tr.addMark(change.fromB + offset, change.toB + offset, insertionMark)
      changed = true
    }
  }

  if (!changed) return null
  return tr.setMeta(APPLIED_META, true)
}

/* ------------------------------------------------------------------ *
 * Query helpers
 * ------------------------------------------------------------------ */

export interface TrackedChange {
  type: 'insertion' | 'deletion'
  from: number
  to: number
  text: string
  attrs: TrackChangeAttrs
}

interface Range {
  from: number
  to: number
}

function isTrackedMark(mark: PMMark): boolean {
  return mark.type.name === 'insertion' || mark.type.name === 'deletion'
}

/** Whether the document contains any tracked insertions or deletions. */
export function hasTrackedChanges(doc: PMNode): boolean {
  let found = false
  doc.descendants((node) => {
    if (found) return false
    if (node.isInline && node.marks.some(isTrackedMark)) found = true
    return !found
  })
  return found
}

/** Count of tracked changes in the document (one per marked run). */
export function countTrackedChanges(doc: PMNode): number {
  return collectTrackedChanges(doc).length
}

/** Collect every tracked insertion / deletion run, in document order. */
export function collectTrackedChanges(doc: PMNode): TrackedChange[] {
  const out: TrackedChange[] = []
  doc.descendants((node, pos) => {
    if (!node.isInline) return
    for (const mark of node.marks) {
      if (!isTrackedMark(mark)) continue
      out.push({
        type: mark.type.name === 'insertion' ? 'insertion' : 'deletion',
        from: pos,
        to: pos + node.nodeSize,
        text: node.text ?? '',
        attrs: {
          author: (mark.attrs.author as string | null) ?? null,
          date: (mark.attrs.date as number | null) ?? null,
          commentId: (mark.attrs.commentId as string | null) ?? null,
        },
      })
    }
  })
  return out
}

/** Contiguous ranges carrying `markType` within `[from, to)`. */
function markedRanges(doc: PMNode, from: number, to: number, markType: PMMark['type']): Range[] {
  const ranges: Range[] = []
  let open: Range | null = null
  doc.nodesBetween(from, to, (node, pos) => {
    const marked = node.isInline && node.marks.some((mark) => mark.type === markType)
    if (marked) {
      const nodeFrom = Math.max(pos, from)
      const nodeTo = Math.min(pos + node.nodeSize, to)
      if (open && open.to === nodeFrom) open.to = nodeTo
      else {
        if (open) ranges.push(open)
        open = { from: nodeFrom, to: nodeTo }
      }
    } else if (open) {
      ranges.push(open)
      open = null
    }
  })
  if (open) ranges.push(open)
  return ranges
}

function targetRange(state: EditorState): Range {
  const { selection } = state
  return selection.empty
    ? { from: 0, to: state.doc.content.size }
    : { from: selection.from, to: selection.to }
}

function deleteRanges(tr: Transaction, ranges: Range[]): void {
  const ordered = [...ranges].sort((a, b) => b.from - a.from)
  for (const range of ordered) tr.delete(range.from, range.to)
}

/* ------------------------------------------------------------------ *
 * Commands
 * ------------------------------------------------------------------ */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    trackChanges: {
      /** Turn change tracking on or off. */
      setTrackChanges: (enabled: boolean) => ReturnType
      /** Accept every change in the selection (or whole document). */
      acceptChanges: () => ReturnType
      /** Reject every change in the selection (or whole document). */
      rejectChanges: () => ReturnType
      /** Accept insertions (keep text, drop the mark). */
      acceptInsertions: () => ReturnType
      /** Reject insertions (remove the text). */
      rejectInsertions: () => ReturnType
      /** Accept deletions (remove the text). */
      acceptDeletions: () => ReturnType
      /** Reject deletions (restore text, drop the mark). */
      rejectDeletions: () => ReturnType
    }
  }
}

/* ------------------------------------------------------------------ *
 * Extension factory
 * ------------------------------------------------------------------ */

/**
 * Microsoft-Word-style suggestion mode. When enabled, every edit is recorded
 * as an `insertion` (highlighted) or `deletion` (struck-through, text kept)
 * mark carrying an author + timestamp, so changes can be reviewed and
 * accepted / rejected later. Opt-in — nothing is added unless this extension
 * is in the extension array.
 */
export function TrackChanges(options: TrackChangesOptions = {}): TextEditorExtension {
  const author = options.author ?? null
  const now = options.now ?? (() => Date.now())

  const items: ToolbarItem[] = [
    {
      name: 'trackChanges',
      label: options.label ?? 'Track',
      group: 'review',
      isActive: (editor) => trackChangesKey.getState(editor.state) === true,
      run: (editor) => {
        const enabled = trackChangesKey.getState(editor.state) === true
        editor.commands.setTrackChanges(!enabled)
      },
    },
    {
      name: 'acceptChanges',
      label: 'Accept',
      group: 'review',
      isActive: () => false,
      isEnabled: (editor) => hasTrackedChanges(editor.state.doc),
      run: (editor) => {
        editor.commands.acceptChanges()
      },
    },
    {
      name: 'rejectChanges',
      label: 'Reject',
      group: 'review',
      isActive: () => false,
      isEnabled: (editor) => hasTrackedChanges(editor.state.doc),
      run: (editor) => {
        editor.commands.rejectChanges()
      },
    },
  ]

  const plugin = Extension.create({
    name: 'trackChanges',
    addCommands() {
      const marksOf = (state: EditorState) => ({
        insertion: state.schema.marks.insertion,
        deletion: state.schema.marks.deletion,
      })

      return {
        setTrackChanges:
          (enabled: boolean) =>
          ({ tr }) => {
            tr.setMeta(trackChangesKey, enabled)
            return true
          },

        acceptInsertions:
          () =>
          ({ state, tr }) => {
            const { insertion } = marksOf(state)
            if (!insertion) return false
            const { from, to } = targetRange(state)
            const ranges = markedRanges(state.doc, from, to, insertion)
            if (!ranges.length) return false
            tr.setMeta(REVIEW_META, true)
            for (const range of ranges) tr.removeMark(range.from, range.to, insertion)
            return true
          },

        rejectInsertions:
          () =>
          ({ state, tr }) => {
            const { insertion } = marksOf(state)
            if (!insertion) return false
            const { from, to } = targetRange(state)
            const ranges = markedRanges(state.doc, from, to, insertion)
            if (!ranges.length) return false
            tr.setMeta(REVIEW_META, true)
            deleteRanges(tr, ranges)
            return true
          },

        acceptDeletions:
          () =>
          ({ state, tr }) => {
            const { deletion } = marksOf(state)
            if (!deletion) return false
            const { from, to } = targetRange(state)
            const ranges = markedRanges(state.doc, from, to, deletion)
            if (!ranges.length) return false
            tr.setMeta(REVIEW_META, true)
            deleteRanges(tr, ranges)
            return true
          },

        rejectDeletions:
          () =>
          ({ state, tr }) => {
            const { deletion } = marksOf(state)
            if (!deletion) return false
            const { from, to } = targetRange(state)
            const ranges = markedRanges(state.doc, from, to, deletion)
            if (!ranges.length) return false
            tr.setMeta(REVIEW_META, true)
            for (const range of ranges) tr.removeMark(range.from, range.to, deletion)
            return true
          },

        acceptChanges:
          () =>
          ({ state, tr }) => {
            const { insertion, deletion } = marksOf(state)
            if (!insertion || !deletion) return false
            const { from, to } = targetRange(state)
            const insertionRanges = markedRanges(state.doc, from, to, insertion)
            const deletionRanges = markedRanges(state.doc, from, to, deletion)
            if (!insertionRanges.length && !deletionRanges.length) return false
            tr.setMeta(REVIEW_META, true)
            for (const range of insertionRanges) tr.removeMark(range.from, range.to, insertion)
            deleteRanges(tr, deletionRanges)
            return true
          },

        rejectChanges:
          () =>
          ({ state, tr }) => {
            const { insertion, deletion } = marksOf(state)
            if (!insertion || !deletion) return false
            const { from, to } = targetRange(state)
            const insertionRanges = markedRanges(state.doc, from, to, insertion)
            const deletionRanges = markedRanges(state.doc, from, to, deletion)
            if (!insertionRanges.length && !deletionRanges.length) return false
            tr.setMeta(REVIEW_META, true)
            for (const range of deletionRanges) tr.removeMark(range.from, range.to, deletion)
            deleteRanges(tr, insertionRanges)
            return true
          },
      }
    },
    addProseMirrorPlugins() {
      return [
        new Plugin<boolean>({
          key: trackChangesKey,
          state: {
            init: () => options.enabled ?? false,
            apply: (tr, value) => {
              const meta = tr.getMeta(trackChangesKey)
              return typeof meta === 'boolean' ? meta : value
            },
          },
          appendTransaction: (transactions, _oldState, newState) => {
            if (!trackChangesKey.getState(newState)) return null
            const userTxs = transactions.filter(
              (tr) =>
                tr.docChanged &&
                !tr.getMeta('appendedTransaction') &&
                !tr.getMeta(APPLIED_META) &&
                !tr.getMeta(REVIEW_META),
            )
            if (!userTxs.length) return null
            return buildTrackedTransaction(userTxs, newState, {
              author,
              date: now(),
              commentId: null,
            })
          },
        }),
      ]
    },
  })

  return {
    name: 'trackChanges',
    tiptap: [InsertionMark, DeletionMark, plugin],
    toolbarItems: items,
  }
}
