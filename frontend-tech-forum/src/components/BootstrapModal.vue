<script setup lang="ts">
defineProps<{idModal: string, labelModal: string}>()
</script>

<template>
  <div class="modal fade" :id="idModal" tabindex="-1" :aria-labelledby="labelModal" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <slot name="header"></slot>
        </div>
        <div class="modal-body">
          <slot name="body"></slot>
        </div>
        <div class="modal-footer">
          <slot name="footer"></slot>
        </div>
      </div>
    </div>
  </div>
</template>