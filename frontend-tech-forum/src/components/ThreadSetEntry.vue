<script setup lang="ts">
import type { ThreadSet } from "@/types/index.js"
import { useRouter } from "vue-router";
import { PhPencil, PhTrash } from "@phosphor-icons/vue";
import { computed, ref } from "vue";
import { limitString } from "@/composables/useLimiteString";
import { useUserStore } from "@/stores/userStore";
import { formatDate } from "@/composables/useFormatDate";

const props = defineProps<{
  threadSet: ThreadSet,
  editButtons: boolean
}>()
const router = useRouter()
const userStore = useUserStore()

const lastThreadTitle = ref<string>("")
const lastThreadAuthor = ref<string>("")
const lastThreadCreateAt = ref<string>("")
const stringLimit = 35

const threadSetRoute = computed<string>(() => {
  if(userStore.isAuthenticated && userStore.role.toLocaleLowerCase() === "admin") {
    return `admin/threadset/${props.threadSet.id}`
  }
  return `/threadset/${props.threadSet.id}`
})

if (props.threadSet.lastThread) {
  const { lastThread } = props.threadSet

  lastThreadTitle.value = limitString(lastThread.title, stringLimit)
  lastThreadAuthor.value = limitString(lastThread.author.username, stringLimit)
  lastThreadCreateAt.value = formatDate(new Date(lastThread.createdAt))
}

</script>

<template>
  <article @click="router.push(threadSetRoute)" class="row border-bottom gray-hover m-0 p-0">
    <div class="col-10 p-3" :class="{ 'col-lg-5': !editButtons, 'col-lg-4': editButtons }">
      <div class="text-primary h5">
        {{ threadSet.name }}
      </div>
      <div class="small">
        {{ threadSet.description }}
      </div>
    </div>
    <div class="d-none d-lg-block col-12 col-lg-2 p-3 text-center">
      {{ threadSet.threadCount }} Threads
    </div>
    <div class="d-none d-lg-block col-12 p-3 col-lg-5">
      <div v-if="lastThreadTitle !== ''">
        <div>
          Title: <strong class="ubuntu-font">{{ lastThreadTitle }}</strong>
        </div>
        <div>
          Author: <strong class="ubuntu-font">{{ lastThreadAuthor }}</strong>
        </div>
        <div>
          Date: <strong class="font-ubunut">{{ lastThreadCreateAt }}</strong>
        </div>
      </div>
      <div v-else>
        <strong class="ubuntu-font">No threads 😭</strong> 
      </div>
    </div>
    <div v-if="editButtons" class="text-center col-2 col-lg-1 d-flex align-items-center justify-content-center d-flex flex-column p-1">
      <button @click.stop="router.push(`/edit/threadset/${threadSet.id}`)" class="btn btn-primary mb-2">
        <PhPencil />
      </button>
      <button @click.stop="$emit('handleRemove', threadSet.id, threadSet.name)" class="btn btn-danger" data-bs-toggle="modal" data-bs-target="#remove-modal">
        <PhTrash />
      </button>
    </div>
  </article>
</template>

<style scoped>
.gray-hover:hover {
  background-color: #f0f0f0;
}
</style>