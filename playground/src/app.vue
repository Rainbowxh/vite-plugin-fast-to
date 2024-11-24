<template>
  <div>
    <comp-vue></comp-vue>
    <div style="height: 20px;"></div>

    <comp-js></comp-js>
    <div style="height: 20px;"></div>

    <comp-ts></comp-ts>
    <div style="height: 20px;"></div>

    <comp-jsx></comp-jsx>
    <div style="height: 20px;"></div>

    <comp-tsx></comp-tsx>

  </div>
</template>

<script setup lang="ts">
import compVue from "./component/comp-vue.vue";
//@ts-ignore
import compJs from "./component/comp-js.js";
//@ts-ignore
import compTs from "./component/comp-ts.ts";

//@ts-ignore
import compJsx from "./component/comp-jsx.jsx";

//@ts-ignore
import compTsx from './component/comp-tsx.tsx'

</script>

<style scoped>

</style>
