<script setup>
import { RouterLink } from 'vue-router';
import { useRouter } from 'vue-router';
import { PhUser, PhHouseSimple, PhSignOut, PhUsers } from '@phosphor-icons/vue';
import { useUserStore } from '@/stores/userStore'
import { computed } from 'vue';

const router = useRouter()

const userStore = useUserStore()
const homeRoute = computed(() => {
    if(userStore?.role?.toLowerCase() === "admin") {
        return "/admin"
    } else {
        return "/"
    }
})
</script>

<template>
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
        <div class="container">
            <a class="navbar-brand" @click="router.push(homeRoute)">
                <img class="me-3 img-link" src="../assets/Icon_Tech_Forum.svg" alt="">
                <span class="lexend-font border-start ps-3 link">Tech Forum</span>
            </a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"
                aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto nav-underline">
                    <li v-if="userStore?.role?.toLocaleLowerCase() === 'admin'" class="nav-item link">
                        <RouterLink class="lexend-font nav-link" :to="'/admin/users'">
                            Users
                            <PhUsers weight="fill" />
                        </RouterLink>
                    </li>
                    <li class="nav-item link">
                        <RouterLink class="lexend-font nav-link" :to="homeRoute">
                            Home
                            <PhHouseSimple weight="fill" />
                        </RouterLink>
                    </li>
                    <li v-if="!userStore.isAuthenticated" class="nav-item">
                        <RouterLink class="lexend-font nav-link" to="/login">
                            Login
                            <PhUser weight="fill" />
                        </RouterLink>
                    </li>
                    <template v-else>
                        <li class="nav-item">
                            <RouterLink to="/user/me" class="lexend-font nav-link">
                                Perfil
                                <PhUser weight="fill" />
                            </RouterLink>
                        </li>
                        <li @click="userStore.logout()" class="nav-item">
                            <RouterLink to="/login" class="lexend-font nav-link">
                                Logout
                                <PhSignOut />
                            </RouterLink>
                        </li>
                    </template >
                </ul>
            </div>
        </div>
    </nav>
</template>

<style scoped>
.link {
    color: white;
    transition: color 0.2s;
    cursor: pointer;
}

.link:hover {
    color: rgb(213, 213, 213);
}

.img-link {
    transition: filter 0.4s;
    cursor: pointer;
}

.img-link:hover {
    filter: saturate(0);
}
</style>