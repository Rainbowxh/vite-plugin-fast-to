
const compTsx = () => {

  function _createVNode() {
    console.log(arguments)
  }

  _createVNode(1, null, null);

  return <div class='class-tsx'>Fast to tsx</div>
}
export default compTsx
