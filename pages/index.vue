<template lang="pug">
.editor(style="width: 100vw; height: 100vh; display: grid;" :style="{'grid-template-columns': hasPreview ? '1fr 1fr' : '1fr'}")
  .editor-col(@scroll="onScroll")
    .title-nav
      div(style="margin-right: 1em;")
        span(v-if="isLoading || title") {{title}}
        span(v-else style="color: red;") {{noTitle}}
      div(style="flex-grow: 1;")
      button.is-warning(@click="hasPreview = !hasPreview") {{hasPreview ? 'Hide' : 'Show'}} Preview
      button.is-success(:disabled="!title || !isEdited" @click="save") Save
    codemirror(v-model="markdown" ref="codemirror" @input="onCmCodeChange")
  .preview-col(v-if="hasPreview")
    RevealPreview(v-if="type === 'reveal'" :markdown="markdown" :cursor="cursor")
    EditorPreview(v-else :title="title" :markdown="markdown" :scrollSize="scrollSize")
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'nuxt-property-decorator'
import dayjs from 'dayjs'
import yaml from 'js-yaml'
import Swal from 'sweetalert2'
import {} from 'codemirror'
import * as z from 'zod'
import { normalizeArray, stringSorter, Matter } from '~/assets/util'

declare global {
  namespace CodeMirror {
    interface Editor {
      on(
        type: 'paste',
        handler: (editor: CodeMirror.Editor, evt: ClipboardEvent) => void
      ): void
    }
  }
}

@Component<Editor>({
  beforeRouteLeave(_, __, next) {
    const msg = this.canSave ? 'Please save before leaving.' : null

    if (msg) {
      Swal.fire({
        text: msg,
        icon: 'warning',
        showCancelButton: true,
        cancelButtonColor: '#d33'
      })
        .then((r) => {
          r.value ? next() : next(false)
        })
        .catch(() => next(false))
    } else {
      next()
    }
  },
  components: {
    RevealPreview: () => import('../components/RevealPreview.vue'),
    EditorPreview: () => import('../components/EditorPreview.vue')
  }
})
export default class Editor extends Vue {
  guid = Math.random()
    .toString(36)
    .substr(2)

  markdown = ''

  hasPreview = true
  isLoading = false
  isEdited = false
  cursor = 0

  scrollSize = 0

  readonly noTitle = 'Title must not be empty'
  readonly matter = new Matter()

  get title() {
    return this.matter.header.title || ''
  }

  get type() {
    return this.matter.header.type || ''
  }

  get codemirror(): CodeMirror.Editor {
    return (this.$refs.codemirror as any).codemirror
  }

  get canSave() {
    return this.title && this.isEdited
  }

  created() {
    this.load()
  }

  mounted() {
    this.isEdited = false
    this.codemirror.setSize('100%', '100%')
    this.codemirror.addKeyMap({
      'Cmd-S': () => {
        this.save()
      },
      'Ctrl-S': () => {
        this.save()
      }
    })

    this.codemirror.on('cursorActivity', (instance) => {
      this.cursor = instance.getCursor().line
    })

    this.codemirror.on('paste', async (ins, evt) => {
      const { items } = evt.clipboardData || ({} as any)
      if (items) {
        for (const k of Object.keys(items)) {
          const item = items[k] as DataTransferItem
          if (item.kind === 'file') {
            evt.preventDefault()
            const blob = item.getAsFile()!
            const formData = new FormData()
            formData.append('file', blob)
            formData.append('type', 'admin')

            const cursor = ins.getCursor()

            const { filename, url } = await fetch('/api/media/upload', {
              method: 'POST',
              body: formData
            }).then((r) => r.json())
            ins.getDoc().replaceRange(`![${filename}](${url})`, cursor)
          } else if (item.type === 'text/plain') {
            const cursor = ins.getCursor()
            item.getAsString(async (str) => {
              if (/^https?:\/\//.test(str)) {
                const { getMetadata } = await import(
                  '../assets/make-html/metadata'
                )
                const meta = await getMetadata(str)
                ins
                  .getDoc()
                  .replaceRange(
                    '```yaml link\n' + yaml.safeDump(meta) + '```',
                    cursor,
                    {
                      line: cursor.line,
                      ch: cursor.ch + str.length
                    }
                  )
              }
            })
          }
        }
      }
    })

    window.onbeforeunload = (e: any) => {
      const msg = this.canSave ? 'Please save before leaving.' : null
      if (msg) {
        e.returnValue = msg
        return msg
      }
    }
  }

  beforeDestroy() {
    window.onbeforeunload = null
  }

  formatDate(d: Date) {
    return dayjs(d).format('YYYY-MM-DD HH:mm Z')
  }

  validateHeader(): boolean {
    const { header } = this.matter.parse(this.markdown)

    let valid = true

    if (header.date) {
      const d = dayjs(header.date)
      valid = d.isValid()
      if (!valid) {
        Swal.fire({
          toast: true,
          timer: 3000,
          text: `Invalid Date: ${header.date}`,
          position: 'top-end',
          showConfirmButton: false
        })
        return false
      }
    }

    if (!header.title) {
      Swal.fire({
        toast: true,
        timer: 3000,
        text: 'Title is required',
        position: 'top-end',
        showConfirmButton: false
      })
      return false
    }

    try {
      z.object({
        title: z.string(),
        date: z.string().optional(),
        tag: z.array(z.string()).optional(),
        image: z.string().optional(),
        type: z.string().optional()
      }).parse(header)
      return true
    } catch (e) {
      Swal.fire({
        toast: true,
        timer: 3000,
        text: e.message,
        position: 'top-end',
        showConfirmButton: false
      })
      return false
    }
  }

  async load() {
    this.isLoading = true

    this.guid = Math.random()
      .toString(36)
      .substr(2)

    const { data } = await fetch('/api/post').then((r) => r.json())

    this.markdown = data
    this.matter.parse(this.markdown)

    setTimeout(() => {
      this.isEdited = false
    }, 100)

    this.isLoading = false
  }

  async save() {
    if (!this.canSave) {
      return
    }

    if (!this.validateHeader()) {
      return
    }

    const r = await fetch('/api/post', {
      method: 'PUT',
      body: JSON.stringify({ data: this.markdown }),
      headers: {
        'Content-Type': 'application/json'
      }
    })

    Swal.fire({
      toast: true,
      timer: 3000,
      text: 'Saved',
      position: 'top-end',
      showConfirmButton: false
    })

    setTimeout(() => {
      this.isEdited = false
    }, 100)
  }

  onCmCodeChange() {
    this.isEdited = true
    this.matter.parse(this.markdown)
  }

  onScroll(evt: any) {
    this.scrollSize =
      evt.target.scrollTop / (evt.target.scrollHeight - evt.target.clientHeight)
    this.$forceUpdate()
  }
}
</script>

<style lang="scss" scoped>
.editor {
  .title-nav {
    display: flex;
    padding: 10px;
    background-color: #ffeaa7;
    align-items: center;
    font-family: sans-serif;

    button {
      font-size: 1em;
      background-color: white;
      border-radius: 5px;
      padding: 0.3em;
    }

    button + button {
      margin-left: 0.5em;
    }
  }

  .editor-col,
  .preview-col {
    height: 100vh;
    overflow-y: scroll;
    display: flex;
    flex-direction: column;
  }

  .vue-codemirror {
    flex-grow: 1;
  }
}

.CodeMirror-lines {
  padding-bottom: 100px;
}

.CodeMirror-line {
  word-break: break-all !important;
}
</style>
