import type { CommentEditor } from './index'
import { getCommentRanges, getCommentThreads, getEngine, subscribeComments } from './index'
import type { CommentThread } from './index'

export interface CommentPanelOptions {
  /**
   * Ask the host for a reply body. Return `null` to cancel. May be async.
   * Defaults to `window.prompt`.
   */
  onRequestReply?: (thread: CommentThread) => string | null | Promise<string | null>
}

export interface CommentPanel {
  /** Re-render the panel. */
  refresh: () => void
  /** Detach listeners and remove the panel from the DOM. */
  destroy: () => void
}

function defaultRequestReply(thread: CommentThread): string | null {
  if (typeof window === 'undefined' || typeof window.prompt !== 'function') return null
  return window.prompt(`Reply to ${thread.author}`)
}

function formatDate(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString()
  } catch {
    return ''
  }
}

/**
 * Render the comment threads into a side panel. Threads are anchored to their
 * document ranges: clicking one selects it, and resolve / reopen / delete
 * delegate to the {@link Comments} commands.
 */
export function createCommentPanel(
  editor: CommentEditor,
  element: HTMLElement,
  options: CommentPanelOptions = {},
): CommentPanel {
  const engine = getEngine(editor)
  const doc = element.ownerDocument ?? document
  const requestReply = options.onRequestReply ?? defaultRequestReply

  const root = doc.createElement('div')
  root.className = 'editor-comments'

  const selectThread = (thread: CommentThread): void => {
    const ranges = getCommentRanges(engine.state.doc, thread.id)
    if (ranges.length) engine.chain().focus().setTextSelection(ranges[0]!).run()
  }

  const button = (label: string, onClick: () => void, extraClass = ''): HTMLButtonElement => {
    const node = doc.createElement('button')
    node.type = 'button'
    node.className = `editor-comments__action ${extraClass}`.trim()
    node.textContent = label
    node.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      onClick()
    })
    return node
  }

  const renderThread = (thread: CommentThread): HTMLLIElement => {
    const item = doc.createElement('li')
    item.className = 'editor-comments__thread'
    item.dataset.status = thread.status

    const header = doc.createElement('div')
    header.className = 'editor-comments__header'

    const author = doc.createElement('span')
    author.className = 'editor-comments__author'
    author.textContent = thread.author

    const date = doc.createElement('time')
    date.className = 'editor-comments__date'
    date.textContent = formatDate(thread.date)

    header.append(author, date)

    const body = doc.createElement('p')
    body.className = 'editor-comments__body'
    body.textContent = thread.body
    body.addEventListener('click', () => selectThread(thread))

    item.append(header, body)

    for (const reply of thread.replies) {
      const replyNode = doc.createElement('div')
      replyNode.className = 'editor-comments__reply'
      const replyMeta = doc.createElement('span')
      replyMeta.className = 'editor-comments__author'
      replyMeta.textContent = reply.author
      const replyBody = doc.createElement('p')
      replyBody.className = 'editor-comments__body'
      replyBody.textContent = reply.body
      replyNode.append(replyMeta, replyBody)
      item.appendChild(replyNode)
    }

    const actions = doc.createElement('div')
    actions.className = 'editor-comments__actions'
    actions.append(
      button('Reply', () => {
        void (async () => {
          const value = await requestReply(thread)
          if (value == null || !value.trim()) return
          engine.commands.replyToComment(thread.id, value.trim())
        })()
      }),
      thread.status === 'open'
        ? button('Resolve', () => engine.commands.resolveComment(thread.id))
        : button('Reopen', () => engine.commands.reopenComment(thread.id)),
      button('Delete', () => engine.commands.removeComment(thread.id), 'editor-comments__action--danger'),
    )
    item.appendChild(actions)

    return item
  }

  const refresh = (): void => {
    root.textContent = ''

    const heading = doc.createElement('h3')
    heading.className = 'editor-comments__heading'
    heading.textContent = 'Comments'
    root.appendChild(heading)

    const threads = [...getCommentThreads(engine)].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'open' ? -1 : 1
      return a.date - b.date
    })

    if (!threads.length) {
      const empty = doc.createElement('p')
      empty.className = 'editor-comments__empty'
      empty.textContent = 'No comments yet.'
      root.appendChild(empty)
    } else {
      const list = doc.createElement('ul')
      list.className = 'editor-comments__list'
      for (const thread of threads) list.appendChild(renderThread(thread))
      root.appendChild(list)
    }
  }

  const unsubscribe = subscribeComments(engine, refresh)
  const onUpdate = (): void => refresh()
  engine.on('selectionUpdate', onUpdate)
  engine.on('update', onUpdate)

  refresh()
  element.appendChild(root)

  return {
    refresh,
    destroy() {
      unsubscribe()
      engine.off('selectionUpdate', onUpdate)
      engine.off('update', onUpdate)
      root.remove()
    },
  }
}
