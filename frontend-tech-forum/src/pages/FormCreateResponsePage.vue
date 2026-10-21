<script setup lang="ts">
import type { Thread, ApplicationError } from '@/types';
import { api } from '@/api';
import { isApplicationError } from '@/composables/useApplicationError';
import { PhPencil } from '@phosphor-icons/vue';
import { isAxiosError } from 'axios';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '@/stores/userStore';

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const idThread = route.params.id

const thread = ref<Thread>({} as Thread)
const content = ref<string>('')

const threadRoute = computed(() => {
  if (userStore.role.toLocaleLowerCase() === "admin") {
    return `/admin/thread/${idThread}`
  }
  return `/thread/${idThread}`
})

const loading = ref(false)
const exception = ref<ApplicationError>()

const inputEnter = computed<boolean>(() => { return content.value !== ""})

function handleError(e: any) {
  if (isAxiosError(e) && isApplicationError(e.response?.data)) {
    exception.value = e.response?.data
  } else {
    console.log(e)
  }
}

onMounted(async () => {
  try {
    loading.value = true

    const { data: threadData } = (await api.get(`/threads/${idThread}`)).data

    thread.value = threadData
  } catch (e) {
    handleError(e)
  } finally {
    loading.value = false
  }
})

async function handleCreate(e: Event) {
  e.preventDefault()

    try {
      exception.value = undefined;
      if (!inputEnter.value) {
        return
      }
      const formData = new FormData();
      formData.append("data", JSON.stringify({
        "content": content.value,
        "author": userStore.id,
        "thread": idThread
      }))

      loading.value = true

      await api.post(`/responses/`, formData, {
        headers: {
          Authorization: `Bearer ${userStore.jwt}`
        }
      })

      router.push(threadRoute.value)
    } catch (e) {
      if (isAxiosError(e) && isApplicationError(e.response?.data)) {
        exception.value = e.response?.data
      }
    } finally {
      loading.value = false
    }
}
</script>

<template>
  <main class="row justify-content-center">
    <div v-if="exception" class="alert alert-danger mt-3" role="alert">
      {{ exception.error.message }}
    </div>
    <div v-if="loading" class="vh-80 d-flex justify-content-center align-items-center">
      <div class="spinner-border text-dark" role="status">
        <span class="sr-only"></span>
      </div>
    </div>
    <form v-else @submit.prevent="handleCreate" class="p-0 mt-3 col-12 col-lg-8 bg-light-subtle shadow top-rouded">
      <div class="bg-dark text-light p-3 text-center top-rouded">
        <h4 class="m-0 p-0">
          <div class="text-break">
            <PhPencil class="me-2" />
            Create - Response to <strong class="font-ubuntu">{{ thread.title }}</strong>
          </div>
        </h4>
      </div>
      <div class="p-3">
        <div class="form-group vh-50">
          <label for="content">Content</label>
          <textarea v-model="content" class="form-control h-90" id="content" rows="3"></textarea>
        </div>
        <div class="text-center mt-4">
          <button :disabled="!inputEnter" class="btn btn-primary">
            Create
          </button>
        </div>
      </div>
    </form>
  </main>
</template>

<style scoped>
button {
  transition: opacity 0.5s;
}
</style>
