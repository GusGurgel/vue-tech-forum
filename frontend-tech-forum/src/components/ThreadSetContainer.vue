<script setup lang="ts">
import ThreadSetEntry from './ThreadSetEntry.vue';
import type { ThreadSet, Thread } from "@/types/index.js"
import { useRouter } from 'vue-router';
import { api } from '@/api';
import { onMounted, ref } from 'vue';
import { PhWarningOctagon, PhPlus, PhTrash } from '@phosphor-icons/vue';
import { isAxiosError } from 'axios';
import { isApplicationError } from '@/composables/useApplicationError';
import type { ApplicationError } from '@/types';
import { useUserStore } from '@/stores/userStore';
import BootstrapModal from '@/components/BootstrapModal.vue';

const props = defineProps<{ editButtons: boolean }>();

const threadSets = ref([] as ThreadSet[])

const bodyTextRemoveModal = ref<string>('')
const bodyComplementeTextRemoveModal = ref<string>('')
const toRemoveNameThreadSet = ref<string>('')
const toRemoveIdThreadSet = ref<number>()

const exception = ref<ApplicationError>()
const loading = ref(true)
const router = useRouter()
const userStore = useUserStore()

function handleError(e: any) {
  if (isAxiosError(e) && isApplicationError(e.response?.data)) {
    exception.value = e.response?.data
  } else {
    console.log(e)
  }
}

async function removeThreadSet() {
    const { data: childsThreadSets } = (await api.get('/threads', {
      params: {
        "filters[thread_set][id][$eq]": toRemoveIdThreadSet.value
      }
    })).data

    for (const thread of childsThreadSets) {
      await api.delete(`/threads/${thread.id}`, {
        headers: {
          Authorization: `Bearer ${userStore.jwt}`
        }
      })
    }

    await api.delete(`/thread-sets/${toRemoveIdThreadSet.value}`, {
      headers: {
        Authorization: `Bearer ${userStore.jwt}`
      }
    })
    threadSets.value = threadSets.value.filter(val => val.id !== toRemoveIdThreadSet.value)
}

async function handleRemove(idThreadSet: number, nameThreadSet: string) {
  try {
    exception.value = undefined
    loading.value = true
    toRemoveIdThreadSet.value = idThreadSet
    toRemoveNameThreadSet.value = nameThreadSet

    const { data: childsThreadSets } = (await api.get('/threads', {
      params: {
        "filters[thread_set][id][$eq]": idThreadSet
      }
    })).data

    let messageComplemente = ""

    if (childsThreadSets.length > 0) {
      messageComplemente = `\n\nThis Thread Set has ${childsThreadSets.length} Threads that will be removed with this action.`
    }

    bodyTextRemoveModal.value = `Confirm Thread Set "${toRemoveNameThreadSet.value}" deletion`;
    bodyComplementeTextRemoveModal.value = messageComplemente;
  } catch (e) {
    handleError(e)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    loading.value = true
    const { data: threadSetsData } = (await api.get("/thread-sets")).data

    for (const threadSet of threadSetsData) {

      // Pegar dados das threads contidas no threadset
      const { data: threads } = (await api.get('/threads', {
        params: {
          "filters[thread_set][id][$eq]": threadSet.id,
        }
      })).data

      // Pegar dados da última thread do threadset
      const { data: lastThreadData } = (await api.get('/threads', {
        params: {
          "filters[thread_set][id][$eq]": threadSet.id,
          "populate": "author",
          "sort": "createdAt:desc",
          "pagination[limit]": 1
        }
      })).data

      let lastThread : Thread | null = null

      if(lastThreadData.length > 0) {
        lastThreadData[0].createdAt = new Date(lastThreadData[0].createdAt)
        lastThread = lastThreadData[0]
      }

      threadSets.value.push({
        ...threadSet,
        threadCount: threads.length,
        lastThread
      })
    }
  } catch (e) {
    handleError(e)
  } finally {
    loading.value = false
  }
})

</script>

<template>
  <BootstrapModal :idModal="'remove-modal'" :labelModal="'modal'">
    <template v-slot:header>
      <h1 class="modal-title fs-5">Remove <strong>ThreadSet</strong> <PhTrash /> </h1>
      <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
    </template>
    <template v-slot:body>
      <div class="text-break">
        {{ bodyTextRemoveModal }}
        <div class="fw-bold mt-3">
          {{ bodyComplementeTextRemoveModal }}
        </div>
      </div>
    </template>
    <template v-slot:footer>
      <button type="button" class="btn btn-danger" data-bs-dismiss="modal">Cancel</button>
      <button type="button" class="btn btn-primary" data-bs-dismiss="modal" @click="removeThreadSet">Confirm</button>
    </template>
  </BootstrapModal>
  <div v-if="exception" class="alert alert-danger mt-2 d-flex align-items-center" role="alert">
    <PhWarningOctagon :size="32" />
    <div class="ms-3">
      Error trying to fetch <strong>Threads Set</strong>: {{ exception.error.message }}
    </div>
  </div>
  <div v-if="loading" class="vh-80 d-flex justify-content-center align-items-center">
    <div class="spinner-border text-dark" role="status">
      <span class="sr-only"></span>
    </div>
  </div>
  <main v-else class="bg-light-subtle shadow row m-0 mt-3">
    <div class="shadow bg-dark text-light p-0 py-2 text-center"
      :class="{ 'col-10 col-lg-4': editButtons, 'col-12 col-lg-5': !editButtons }">
      Name
    </div>
    <div class="shadow d-none d-lg-block col-2 bg-dark text-light p-0 py-2 text-center">
      Threads Created
    </div>
    <div class="shadow d-none d-lg-block bg-dark text-light p-0 py-2 text-center col-lg-5">
      Last Thread
    </div>
    <button v-if="editButtons" @click="router.push('/create/threadset')"
      class="btn btn-dark rounded-0 text-center col-2 col-lg-1 shadow">
      <PhPlus :size="20" />
    </button>
    <ThreadSetEntry v-for="threadSet in threadSets" :key="threadSet.id" :threadSet="{ ...threadSet }"
      :editButtons="props.editButtons" @handleRemove="handleRemove" />
  </main>
</template>