<script setup lang="ts">
import { api } from '@/api';
import { useUploadFile } from '@/composables/useUploadURL';
import { useUserStore } from '@/stores/userStore';
import { PhUser, PhCrown } from '@phosphor-icons/vue';
import { computed, ref } from 'vue';
import type { ApplicationError } from '@/types';
import { isApplicationError } from '@/composables/useApplicationError';
import { isAxiosError } from 'axios';

const userStore = useUserStore()
const perfilImageUpdate = ref<File>()
const exception = ref<ApplicationError>()
const usernameUpdate = ref(userStore.username)
const inputEnter = computed(() => perfilImageUpdate.value !== undefined || usernameUpdate.value !== userStore.username)
const loading = ref(false)

const userImage = computed(() => {
    if (userStore.image) {
        return useUploadFile(userStore.image)
    } else {
        return '../../public/Logo_Tech_Forum.svg'
    }
})

function handleImageChange(event: Event) {
    const inputEvent = event as InputEvent
    const inputPerfilImg = inputEvent.target as HTMLInputElement
    console.log(inputPerfilImg.files?.item(0))
    perfilImageUpdate.value = inputPerfilImg.files?.item(0) as File
}

async function getCurrentUserImageId() {
    const { data } = await api.get('/users/me', {
        headers: {
            Authorization: `Bearer ${userStore.jwt}`
        },
        params: {
            populate: 'image'
        }
    })

    return data?.image?.id
}

async function handleUserPerfilUpdate() {
    try {
        exception.value = undefined;

        // Se a entrada não foi mudada
        if(!inputEnter.value) {
            return
        }

        loading.value = true

        if (perfilImageUpdate.value) {
            const oldImageId = await getCurrentUserImageId()
            const formDataUploadImage = new FormData()
            const formDataUpdateUserImage = new FormData()

            formDataUploadImage.append("files", perfilImageUpdate.value as File);

            // Fazer upload da nova imagem do usuário
            const { data } = await api.post("/upload", formDataUploadImage, {
                headers: {
                    Authorization: `Bearer ${userStore.jwt}`
                }
            })

            // Deletar imagem antiga do usuário
            if (oldImageId) {
                await api.delete(`/upload/files/${oldImageId}`, {
                    headers: {
                        Authorization: `Bearer ${userStore.jwt}`
                    }
                })
            }

            formDataUpdateUserImage.append("image", data[0].id)

            // Fazer update da nova imagem do usuario
            await api.put(`/users/${userStore.id}`, formDataUpdateUserImage, {
                headers: {
                    Authorization: `Bearer ${userStore.jwt}`
                }
            });

            userStore.changeImage(data[0].url)
        }

        if(usernameUpdate.value !== userStore.username) {
            const formDataUpdateUsername = new FormData()
            formDataUpdateUsername.append("username", usernameUpdate.value)

            // Fazer update do nome de usuário
            await api.put(`/users/${userStore.id}`, formDataUpdateUsername, {
                headers: {
                    Authorization: `Bearer ${userStore.jwt}`
                }
            });

            userStore.changeUsername(usernameUpdate.value)
        }
    } catch(e) {
        if (isAxiosError(e) && isApplicationError(e.response?.data)) {
            exception.value = e.response?.data
        }
    } finally {
        loading.value = false
    }
}
</script>

<template>
    <div v-if="loading" class="vh-80 d-flex justify-content-center align-items-center">
        <div class="spinner-border text-dark" role="status">
            <span class="sr-only"></span>
        </div>
    </div>
    <div v-else :class="{ 'mt-5': !exception }" class="row p-3 p-xl-0 justify-content-around">
        <div v-if="exception" class="alert alert-danger mt-3" role="alert">
            {{ exception.error.message }}
        </div>
        <div class="col-12 p-0 col-lg-4 d-flex flex-column justify-content-center align-items-center">
            <div id="user-img" class="border border-2 rounded-circle bg-light overflow-hidden">
                <img :src="userImage" class="w-100 h-100" alt="User Image">
            </div>
            <div>
                <div id="username" class="text-center mt-4 h3 text-break">
                    <div v-if="userStore.role.toLocaleLowerCase() === 'admin'"
                        class="display-6 border-bottom pb-3 mb-3 text-warning">
                        Administrator
                        <PhCrown />
                    </div>
                    {{ userStore.username }}
                </div>
            </div>
        </div>
        <hr class="d-block mt-4 d-xl-none mt-xl-0">
        <form @submit.prevent="handleUserPerfilUpdate" class="col-12 col-xl-6 d-flex align-items-center">
            <fieldset class="w-100">
                <legend class="text-center border-bottom pb-3"> Perfil
                    <PhUser />
                </legend>
                <div class="mb-3">
                    <label for="email" class="form-label">Email</label>
                    <input disabled type="text" id="email" class="form-control" placeholder="email"
                        :value="userStore.email">
                </div>
                <div class="mb-3">
                    <label for="username" class="form-label">Username</label>
                    <input required v-model="usernameUpdate" type="text" id="username" class="form-control"
                        placeholder="username">
                </div>
                <div class="mb-3">
                    <label for="input-perfil-img" class="form-label">Perfil Image</label>
                    <input id="input-perfil-img" @change="handleImageChange" class="form-control form-control-sm" type="file" accept=".jpeg, .jpg, .png">
                </div>
                <div class="text-center">
                    <!-- Estou usando opacidade para colocar uma transição bonitinha -->
                    <button :class="inputEnter ? 'opacity-1' : 'opacity-0'"
                        class="btn btn-primary ps-5 pe-5 opacity-transition" type="submit">Save</button>
                </div>
            </fieldset>
        </form>
    </div>
</template>

<style scoped>
#user-img {
    width: 300px;
    height: 300px;
}

.opacity-transition {
    transition: opacity 0.5s;
}

.opacity-0 {
    opacity: 0;
}

.opacity-1 {
    opacity: 1;
}

.vh-80 {
    height: 80vh;
}
</style>