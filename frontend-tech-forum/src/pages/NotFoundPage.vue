<script setup lang="ts">
    import { useRoute } from 'vue-router';
    import { PhWarning } from '@phosphor-icons/vue';

    const route = useRoute()

</script>

<template>
    <div class="alert alert-warning mt-2 d-flex align-items-center" role="alert">
        <PhWarning :size="32"/>
        <div class="ms-3">
            O endpoint <strong class="fw-bold">"{{ route.fullPath }}"</strong> não existe
        </div>
    </div>
</template>
