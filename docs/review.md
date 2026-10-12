# Review: track changes & comments

Both review features are **opt-in** and independent. They can be used together
(commenting on a tracked change links the two) or separately.

## Track changes

Word-style suggestion mode. While tracking is on, every edit is recorded as a
mark with an author and timestamp so it can be reviewed later.

```ts
import { TrackChanges } from '@editor/extension-track-changes'

TrackChanges({ author: 'Alice', enabled: false, now: () => Date.now() })
```

| Option | Default | Meaning |
|---|---|---|
| `author` | `null` | Author recorded on new changes |
| `enabled` | `false` | Start with tracking on |
| `now` | `Date.now` | Clock used to timestamp changes |
| `label` | `'Track'` | Toolbar label for the toggle |

### Model

- **`insertion` mark** — text typed while tracking is on. Rendered highlighted.
- **`deletion` mark** — text deleted while tracking is on. The text is **kept**
  (struck through) until the deletion is accepted.

Both marks carry `author`, `date` and `commentId`.

### Commands

| Command | Effect |
|---|---|
| `setTrackChanges(enabled)` | Turn tracking on/off |
| `acceptChanges()` | Accept everything in the selection (or the document) |
| `rejectChanges()` | Reject everything in the selection (or the document) |
| `acceptInsertions()` / `rejectInsertions()` | Keep / remove inserted text |
| `acceptDeletions()` / `rejectDeletions()` | Remove / restore deleted text |

### Helpers

`collectTrackedChanges(doc)`, `countTrackedChanges(doc)`,
`hasTrackedChanges(doc)`. Also exported: `InsertionMark`, `DeletionMark`,
`trackChangesKey` (a `PluginKey<boolean>` holding the on/off flag).

### How it works

An `appendTransaction` plugin builds a `ChangeSet` from each user transaction
(`ChangeSet.create(oldDoc).addSteps(...)`), replays deletions as
`deletion`-marked slices, and tags inserted ranges with the `insertion` mark.
The plugin skips its own appended transactions (ProseMirror's
`appendedTransaction` meta plus a private marker), and review commands set a
`REVIEW_META` flag so accepting/rejecting is not itself recorded. Changes are
applied end-to-start so positions stay valid as replayed deletions grow the
document.

## Comments

Comment threads anchored to document ranges. The **thread data lives outside the
document** (author, body, replies, status); the document only carries a
`comment` mark with the thread id.

```ts
import { Comments, createCommentPanel } from '@editor/extension-comments'
import '@editor/extension-comments/styles.css'

const editor = new TextEditor({
  element,
  extensions: [
    Comments({
      author: 'Bob',
      threads: persistedThreads,               // restore
      onChange: (threads) => persist(threads), // save
      onRequestComment: async (selectedText) => await myCommentDialog(selectedText),
    }),
  ],
})

const panel = createCommentPanel(editor, sidebarElement, {
  onRequestReply: async (thread) => await myReplyDialog(thread),
})
```

| Option | Default | Meaning |
|---|---|---|
| `author` | `'Unknown'` | Author recorded on new comments / replies |
| `now` | `Date.now` | Clock used to timestamp comments |
| `createId` | random | Id generator for threads / replies |
| `threads` | `[]` | Restore previously persisted threads |
| `onChange` | — | Called whenever threads change |
| `onRequestComment` | `window.prompt` | Ask the host for a body; `null` cancels |
| `label` | `'Comment'` | Toolbar label |

### Commands

`addComment(body)` (tags the current selection), `removeComment(id)`,
`resolveComment(id)`, `reopenComment(id)`, `replyToComment(id, body)`.

### Helpers

`getCommentThreads(editor)`, `subscribeComments(editor, listener)`,
`getCommentRanges(doc, id)`, `getCommentIds(doc)`, `getCommentsStorage(editor)`,
`getEngine(editor)`.

The panel and helpers accept **either** the public `TextEditor` or the raw
engine (`getEngine()`).

### Linking comments to tracked changes

Adding a comment over a tracked change stamps the thread id onto the
`insertion`/`deletion` marks (`commentId`). Because ProseMirror keeps same-type
marks with different attributes, linking does `removeMark` then `addMark` to
replace the mark rather than merge it.

## Accessibility

- The comment panel is a labelled `role="region"` with `aria-live="polite"` so
  thread changes are announced.
- Each per-thread control has a unique accessible name (e.g. *"Resolve — comment
  by Alice"*), and *Show in document* is a real button, so the panel is fully
  keyboard-operable.
- The track-change toolbar items are standard `aria-pressed` toggle buttons
  rendered by `@editor/ui`.

## Data persistence

Threads serialize to plain JSON and can be stored anywhere; the document HTML
already carries the `data-comment` / `data-comment-id` attributes, so a saved
document plus its thread list round-trips. The sanitizer allowlist includes the
review `data-*` attributes (inert when the extensions are off).
