<template lang="pug">
.editor(style="width: 100vw; height: 100vh; display: grid;" :style="{'grid-template-columns': hasPreview ? '1fr 1fr' : '1fr'}")
  .editor-col(@scroll="onScroll")
    .title-nav
      div(style="margin-right: 1em;")
        span(v-if="isLoading || title") {{title}}
        span(v-else style="color: red;") {{noTitle}}
      div(style="flex-grow: 1;")
      el-button.is-warning(@click="hasPreview = !hasPreview") {{hasPreview ? 'Hide' : 'Show'}} Preview
      el-button.is-success(:disabled="!title || !isEdited" @click="save") Save
    codemirror(v-model="markdown" ref="codemirror" @input="onCmCodeChange")
  .preview-col(v-if="hasPreview")
    RevealPreview(v-if="type === 'reveal'" :id="id" :markdown="markdown" :cursor="cursor")
    EditorPreview(v-else :title="title" :id="id" :markdown="markdown" :scrollSize="scrollSize"
      @excerpt="excerptHtml = $event" @remaining="remainingHtml = $event"
    )
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'nuxt-property-decorator'
import dayjs from 'dayjs'
import Slugify from 'seo-friendly-slugify'
import Ajv from 'ajv'
import yaml from 'js-yaml'
import Swal from 'sweetalert2'
import {} from 'codemirror'
import {} from '@nuxtjs/axios'
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

const ajv = new Ajv()

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
  guid = ''
  markdown = ''
  isDraft = false

  hasPreview = true
  excerptHtml = ''
  remainingHtml = ''
  isLoading = false
  isEdited = false
  cursor = 0

  title = ''
  type = ''
  scrollSize = 0

  readonly noTitle = 'Title must not be empty'
  readonly slugify = new Slugify()
  readonly matter = new Matter()

  get id() {
    return normalizeArray(this.$route.query.id)
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

            const { filename, url } = await fetch(
              `/api/media/upload?slug=${encodeURIComponent(this.id)}`,
              {
                method: 'POST',
                body: formData
              }
            ).then((r) => r.json())
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

  getAndValidateHeader(requiredNeeded = true) {
    const { header } = this.matter.parse(this.markdown)

    this.title = header.title
    this.type = header.type || ''

    let valid = true

    if (header.date) {
      let d = dayjs(header.date)
      valid = d.isValid()
      if (!valid) {
        // console.error(`Invalid Date: ${header.date}`)
        return
      }

      if (header.date instanceof Date) {
        d = d.add(new Date().getTimezoneOffset(), 'minute')
      }

      header.date = d.toISOString()
    }

    if (requiredNeeded && !header.title) {
      // console.error('Title is required')
      return
    }

    const validator = ajv.compile({
      type: 'object',
      properties: {
        title: { type: ['string', 'null'] },
        slug: { type: ['string', 'null'] },
        date: { type: ['string', 'null'] },
        tag: { type: 'array', items: { type: ['string', 'null'] } },
        image: { type: ['string', 'null'] },
        category: { type: ['string', 'null'] },
        type: { type: ['string', 'null'] }
      }
    })
    valid = !!validator(header)

    if (!valid) {
      // for (const e of validator.errors || []) {
      //   console.error(e)
      // }

      return null
    }

    return header as {
      title: string
      slug?: string
      date?: string
      tag?: string[]
      image?: string
      category?: string
    }
  }

  @Watch('$route.query.id')
  async load() {
    this.isLoading = true

    this.guid = Math.random()
      .toString(36)
      .substr(2)

    if (this.id) {
      const r = await fetch(
        `/api/post?slug=${encodeURIComponent(this.id)}`
      ).then((r) => r.json())

      if (r) {
        const { title, date, tag, id, slug, raw } = r

        const { header: rawHeader, content } = this.matter.parse(raw)
        Object.assign(rawHeader, {
          title,
          slug: slug || id,
          date: date ? dayjs(date).format('YYYY-MM-DD HH:mm Z') : undefined,
          tag: (tag || []).sort(stringSorter)
        })

        this.markdown = this.matter.stringify(content, rawHeader)
        this.title = rawHeader.title

        setTimeout(() => {
          this.isEdited = false
        }, 100)
      }
    }

    this.isLoading = false
  }

  async save() {
    if (!this.canSave) {
      return
    }

    const header = this.getAndValidateHeader()

    if (!header) {
      return
    }

    const content = {
      type: this.type,
      tag: header.tag || [],
      category: header.category,
      title: this.title,
      slug: header.slug,
      date: header.date,
      excerpt: this.excerptHtml,
      remaining: this.remainingHtml,
      raw: this.markdown,
      header
    }

    if (!this.id) {
      /**
       * Create a post
       */
      const r = await this.$axios.$put('/api/post/', {
        ...content,
        slug: header.slug || this.generateSlug()
      })

      this.$router.push({
        query: {
          id: r.id
        }
      })
    } else {
      await this.$axios.patch('/api/post/', {
        id: this.id,
        update: content
      })
    }

    Swal.fire({
      toast: true,
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
    this.getAndValidateHeader(false)
  }

  generateSlug() {
    return this.title
      ? `${(() => {
          const s = this.slugify.slugify(this.title)
          return s ? `${s}-` : ''
        })()}${this.guid}`
      : ''
  }

  onScroll(evt: any) {
    this.scrollSize =
      evt.target.scrollTop / (evt.target.scrollHeight - evt.target.clientHeight)
    this.$forceUpdate()
  }
}
</script>

<style lang="scss">
.header-buttons {
  margin-bottom: 0 !important;

  .button {
    margin-bottom: 0 !important;
  }
}

.editor {
  .title-nav {
    display: flex;
    padding: 10px;
    background-color: #ffeaa7;
    align-items: center;
  }

  .editor-col,
  .preview-col {
    height: calc(100vh - 60px);
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
