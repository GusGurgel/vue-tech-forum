<script setup lang="ts">
import type { ThreadSet, ApplicationError } from '@/types';
import { api } from '@/api';
import { isApplicationError } from '@/composables/useApplicationError';
import { useUserStore } from '@/stores/userStore';
import { PhPencil } from '@phosphor-icons/vue';
import { isAxiosError } from 'axios';
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute()

const idThread = ref(route.params.id)
const title = ref<string>('');
const oldTitle = ref<string>('');
const isFixed = ref<boolean>(false);
const oldIsFixed = ref<boolean>(false);
const threadSetId = ref<number>();
const oldThreadSetId = ref<number>();
const threadSets = ref<ThreadSet[]>([] as ThreadSet[]);

const userStore = useUserStore()
const loading = ref(false)
const exception = ref<ApplicationError>()

const inputEnter = computed<boolean>(() => {
  if(
    title.value === oldTitle.value &&
    isFixed.value === oldIsFixed.value &&
    threadSetId.value === oldThreadSetId.value
  ) {
    return false
  }
  return true
})

function handleError(e: any) {
  if (isAxiosError(e) && isApplicationError(e.response?.data)) {
    exception.value = e.response?.data
  } else {
    console.log(e)
  }
}

onMounted(async () => {
  try{
    loading.value = true

    const { data: threadData } = (await api.get(`/threads/${idThread.value}`, {
      params: {
        populate: "thread_set"
      }
    })).data

    const { data: threadSetData } = (await api.get(`/thread-sets/`)).data

    threadSets.value = threadSetData

    title.value = threadData.title
    oldTitle.value = threadData.title
    isFixed.value = threadData.isFixed
    oldIsFixed.value = threadData.isFixed
    threadSetId.value = threadData.thread_set.id
    oldThreadSetId.value = threadData.thread_set.id
  } catch (e) {
    handleError(e)
  } finally {
    loading.value = false
  }
})

async function handleUpdate(e: Event) {
  e.preventDefault()

  try {
    exception.value = undefined;
    if (!inputEnter.value) {
      return
    }
    const formData = new FormData();
    formData.append("data", JSON.stringify({
      "title": title.value.trim(),
      "thread_set": threadSetId.value,
      "isFixed": isFixed.value
    }))

    loading.value = true

    const { data: threadData } = (await api.put(`/threads/${idThread.value}`, formData, {
      headers: {
        Authorization: `Bearer ${userStore.jwt}`
      }
    })).data

    title.value = threadData.title
    oldTitle.value = threadData.title
    isFixed.value = threadData.isFixed
    oldIsFixed.value = threadData.isFixed
    threadSetId.value = threadData.thread_set.id
    oldThreadSetId.value = threadData.thread_set.id
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
    <form v-else @submit.prevent="handleUpdate" class="p-0 mt-3 col-12 col-lg-6 bg-light-subtle shadow top-rouded">
      <div class="bg-dark text-light p-3 text-center top-rouded">
        <h4 class="m-0 p-0">
          <div class="d-flex align-items-center justify-content-center">
            Edit - Thread
            <PhPencil class="ms-2" />
          </div>
        </h4>
      </div>
      <div class="p-3">
        <div class="form-group mt-1">
          <label for="title">Title</label>
          <input v-model="title" type="text" id="title" class="form-control">
        </div>
        <div class="form-group mt-3">
          <label for="thread-set">ThreadSet</label>
          <select v-model="threadSetId" id="thread-set" class="form-select" aria-label="Default select example">
            <option v-for="threadSet in threadSets" :key="threadSet.id" :value="threadSet.id">
              {{ threadSet.name }}
            </option>
          </select>
        </div>
        <div class="form-check mt-3 form-switch">
          <input v-model="isFixed" class="form-check-input" type="checkbox" id="is-fixed">
          <label class="form-check-label" for="is-fixed">IsFixed</label>
        </div>
        <div class="text-center mt-3">
          <button :disabled="!inputEnter" class="btn btn-primary">
            Update
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