<template lang="pug">
div(style="width: 100vw; height: 100vh")
  #global
  .reveal
    .slides
</template>

<script lang="ts">
import { Vue, Component } from 'nuxt-property-decorator'
import { RevealMd } from '~/assets/reveal'

@Component
export default class RevealView extends Vue {
  mounted() {
    window.revealMd = new RevealMd(process.env.PLACEHOLDER || '')
  }
}
</script>

<style lang="scss">
.stack.present {
  display: flex !important;
  justify-content: center;
  align-items: center;

  > .present {
    top: unset !important;
    max-height: 90%;
    overflow: scroll;
  }
}
</style>
