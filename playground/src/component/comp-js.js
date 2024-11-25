import { defineComponent, h } from 'vue';

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
    return () => {

      return h('div',  [
        h('div', 'Fast to js - h 2 parameter'),
        h('div', { color: 'red' }, 'Fast to js - h 3 parameter' ),
        h('div', { class: 'blue' }, [
            h('div', 'Fast to js - children1'),
            h('div', 'Fast to js - children2'),
        ]),
      ])
    }
  }
})
