import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue'
import type { PropType, Ref, ShallowRef } from 'vue'
import { TextEditor } from '@editor/core'
import type { TextEditorExtension, TextEditorOptions } from '@editor/plugin-api'

export type EditorOptions = Omit<TextEditorOptions, 'element'>

export interface UseEditorResult {
  /** The editor instance, or `null` before mount / after unmount. */
  editor: ShallowRef<TextEditor | null>
  /** Attach this ref to the element the editor should mount into. */
  containerRef: Ref<HTMLElement | null>
}

/**
 * Create a {@link TextEditor} bound to a ref'd element. Creates on mount and
 * destroys on unmount. Only the setup-time options are used.
 */
export function useEditor(options: EditorOptions = {}): UseEditorResult {
  const containerRef = ref<HTMLElement | null>(null)
  const editor = shallowRef<TextEditor | null>(null)

  onMounted(() => {
    if (!containerRef.value) return
    editor.value = new TextEditor({ ...options, element: containerRef.value })
  })

  onBeforeUnmount(() => {
    editor.value?.destroy()
    editor.value = null
  })

  return { editor, containerRef }
}

export interface EditorProps {
  content?: string
  editable?: boolean
  extensions?: TextEditorExtension[]
}

/**
 * Declarative editor component.
 *
 * ```vue
 * <script setup lang="ts">
 * import { Editor } from '@editor/adapter-vue'
 * import { Styling } from '@editor/extension-styling'
 * </script>
 *
 * <template>
 *   <Editor :extensions="[Styling()]" @change="html = $event" />
 * </template>
 * ```
 */
export const Editor = defineComponent({
  name: 'TextEditor',
  inheritAttrs: false,
  props: {
    content: { type: String, default: '' },
    editable: { type: Boolean, default: true },
    extensions: {
      type: Array as PropType<TextEditorExtension[]>,
      default: () => [],
    },
  },
  emits: ['change', 'focus', 'blur', 'ready'],
  setup(props, { attrs, emit }) {
    const { editor, containerRef } = useEditor({
      content: props.content,
      editable: props.editable,
      extensions: props.extensions,
      onChange: (html) => emit('change', html),
      onFocus: () => emit('focus'),
      onBlur: () => emit('blur'),
    })

    watch(editor, (instance) => {
      if (instance) emit('ready', instance)
    })

    return () => h('div', { ...attrs, ref: containerRef })
  },
})
