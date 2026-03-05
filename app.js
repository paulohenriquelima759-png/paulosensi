const lista=document.getElementById("lista")
const buscar=document.getElementById("buscar")

function criarCard(c){

return`

<div class="card">

<h2>${c.nome}</h2>

<p>Geral: ${c.geral}</p>
<p>Red Dot: ${c.red}</p>
<p>DPI: ${c.dpi}</p>

<button onclick="copiar('${c.nome}')">
Copiar Sensibilidade
</button>

</div>

`

}

function render(){

lista.innerHTML=""

celulares.forEach(c=>{

lista.innerHTML+=criarCard(c)

})

}

function copiar(nome){

alert("Sensibilidade copiada para "+nome)

}

render()

buscar.addEventListener("input",e=>{

let texto=e.target.value.toLowerCase()

lista.innerHTML=""

celulares

.filter(c=>c.nome.toLowerCase().includes(texto))

.forEach(c=>{

lista.innerHTML+=criarCard(c)

})

})
