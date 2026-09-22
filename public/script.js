let carrinho = [];
let totalVenda = 0;

// 1. Busca os produtos no banco de dados assim que a tela abre
document.addEventListener("DOMContentLoaded", carregarProdutos);

async function carregarProdutos() {
    try {
        const resposta = await fetch('/api/produtos');
        const produtos = await resposta.json();
        
        const select = document.getElementById("produtoSelect");
        
        // Limpa a lista atual
        select.innerHTML = '<option value="">Selecione um produto...</option>';
        
        // Preenche com os produtos reais e o saldo atual
        produtos.forEach(prod => {
            const option = document.createElement("option");
            option.value = prod.id;
            option.setAttribute("data-preco", prod.preco_venda);
            option.setAttribute("data-estoque", prod.saldo_atual);
            
            // Exibe Nome, Preço e Estoque Disponível
            option.innerText = `${prod.nome} (Estoque: ${prod.saldo_atual} ${prod.unidade}) - R$ ${prod.preco_venda.toFixed(2).replace('.', ',')}`;
            select.appendChild(option);
        });
    } catch (erro) {
        console.error("Erro ao buscar produtos no servidor:", erro);
        alert("Erro ao carregar a lista de produtos.");
    }
}

// 2. Adiciona item no carrinho
function adicionarAoCarrinho() {
    const select = document.getElementById("produtoSelect");
    const quantidadeInput = document.getElementById("quantidade");
    
    const idProduto = select.value;
    const selectedOption = select.options[select.selectedIndex];

    if (!idProduto) {
        alert("Por favor, selecione um produto!");
        return;
    }

    const nomeProduto = selectedOption.text.split(" (Estoque:")[0];
    const preco = parseFloat(selectedOption.getAttribute("data-preco"));
    const estoqueDisponivel = parseFloat(selectedOption.getAttribute("data-estoque"));
    const quantidade = parseFloat(quantidadeInput.value);

    if (isNaN(quantidade) || quantidade <= 0) {
        alert("A quantidade precisa ser maior que zero!");
        return;
    }

    // Verifica se já existe o mesmo produto no carrinho para somar a quantidade
    const itemExistente = carrinho.find(item => item.produto_id == idProduto);
    const qtdTotalDesejada = (itemExistente ? itemExistente.qtd : 0) + quantidade;

    // Validação de limite de estoque
    if (qtdTotalDesejada > estoqueDisponivel) {
        alert(`Estoque insuficiente! Disponível: ${estoqueDisponivel}`);
        return;
    }

    if (itemExistente) {
        itemExistente.qtd = qtdTotalDesejada;
        itemExistente.subtotal = itemExistente.qtd * itemExistente.preco;
    } else {
        const subtotal = preco * quantidade;
        carrinho.push({
            produto_id: Number(idProduto),
            nome: nomeProduto,
            qtd: quantidade,          // Compatível com o campo da API e do Banco
            preco: preco,             // Compatível com o campo da API e do Banco
            desconto: 0,
            subtotal: subtotal
        });
    }

    atualizarTela();
    
    // Reseta os campos do formulário
    quantidadeInput.value = 1;
    select.value = "";
}

// 3. Atualiza o visual da tabela e os totais
function atualizarTela() {
    const tbody = document.getElementById("listaCarrinho");
    tbody.innerHTML = ""; 
    totalVenda = 0;

    carrinho.forEach((item, index) => {
        totalVenda += item.subtotal;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${item.nome}</td>
            <td>R$ ${item.preco.toFixed(2).replace('.', ',')}</td>
            <td>${item.qtd}</td>
            <td>R$ ${item.subtotal.toFixed(2).replace('.', ',')}</td>
            <td>
                <button type="button" onclick="removerDoCarrinho(${index})" style="color: red; cursor: pointer;">❌</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById("qtdItens").innerText = carrinho.length;
    document.getElementById("valorTotal").innerText = totalVenda.toFixed(2).replace('.', ',');
}

// 4. Remove um item individual do carrinho
function removerDoCarrinho(index) {
    carrinho.splice(index, 1);
    atualizarTela();
}

// 5. Finaliza a venda enviando para o Servidor
async function finalizarVenda() {
    if (carrinho.length === 0) {
        alert("O carrinho está vazio!");
        return;
    }

    const formaPagamentoSelect = document.getElementById("formaPagamento");
    const formaPagamento = formaPagamentoSelect ? formaPagamentoSelect.value : 'dinheiro';

    if (!formaPagamento) {
        alert("Selecione uma forma de pagamento!");
        return;
    }

    const dadosVenda = {
        subtotal: totalVenda,
        desconto: 0,
        total: totalVenda,
        forma_pagamento: formaPagamento,
        itens: carrinho
    };

    try {
        const resposta = await fetch('/api/vendas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosVenda)
        });

        const resultado = await resposta.json();

        if (resposta.ok) {
            alert(`✅ Venda #${resultado.venda_id} finalizada com sucesso!`);
            carrinho = []; 
            atualizarTela(); 
            carregarProdutos(); // Recarrega os produtos para atualizar o saldo do estoque no select
        } else {
            alert(`❌ Erro: ${resultado.erro || "Erro ao registrar a venda."}`);
        }
    } catch (erro) {
        alert("❌ Erro ao conectar com o servidor.");
        console.error(erro);
    }
}