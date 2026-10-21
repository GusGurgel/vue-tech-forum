<script setup lang="ts">
import { formatDate } from "@/composables/useFormatDate";
import { useUploadFile } from "@/composables/useUploadURL";
import type { User } from "@/types/index.js"
import { computed } from "vue";
const props = defineProps<{
  user: User,
}>()

const userImage = computed<string>(() => {
  if (props.user?.image?.url) {
    return useUploadFile(props.user.image.url)
  }
  return '../../public/Logo_Tech_Forum.svg'
})
</script>

<template>
  <article class="col-12 p-0 border-bottom justify-content-center" :class="{ 'bg-danger': user.blocked }">
    <div class="row m-0">
      <div class="d-none d-lg-block col-12 col-lg-2 d-flex justify-content-center align-items-center">
        <img class="d-block img-size" :src="userImage" :alt="`${user.username} perfil image`">
      </div>
      <div class="d-lg-block text-wrap col-8 col-lg-4 d-flex flex-column align-content-center justify-content-center">
        <div>
          Email: <strong class="font-ubuntu">{{ user.email }}</strong>
        </div>
        <div>
          Username: <strong class="font-ubuntu">{{ user.username }}</strong>
        </div>
        <div>
          Role: <strong :class="user.role.name.toLocaleLowerCase() === 'admin' ? 'text-warning' : ''"
            class="font-ubuntu">{{ user.role.name }}</strong>
        </div>
      </div>
      <div class="d-none d-lg-block col-3 text-center">
        {{ user.createdAt ? formatDate(user.createdAt) : '?' }}
      </div>
      <div class="d-lg-block p-0 col-4 col-lg-3 d-flex align-items-center">
        <div class="form-check form-switch d-flex justify-content-center">
          <input @change="(event) => $emit('handleBanChange', user.id, event)" :disabled="user.role.name.toLocaleLowerCase() === 'admin'"
            class="form-check-input" type="checkbox" id="banned" :checked="user.blocked">
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.img-size {
  width: 110px;
  height: 110px;
}
</style>