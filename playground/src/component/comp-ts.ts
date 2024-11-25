import { defineComponent, h, VNode } from 'vue';

export default defineComponent({
  name: 'CompJs',
  props: {
    msg: {
      type: String,
      default: 'Hello World',
    },
  },
  setup(props) {
    // const { msg } = toRefs(props);
    const msg = props.msg;
    return (): VNode  => h('div', 'Fast to ts file')
  }
})
