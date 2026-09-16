let carrinho = [];
let totalVenda = 0;

// 1.  Busca os produtos no banco de dados assim que a tela abre
document.addEventListener("DOMContentLoaded", carregarProdutos);

async function carregarProdutos() {
    try {
        const resposta = await fetch('/api/produtos');
        const produtos = await resposta.json();
        
        const select = document.getElementById("produtoSelecionado");
        
        // Limpa a lista atual (tira os produtos falsos)
        select.innerHTML = '<option value="">Selecione um produto...</option>';
        
        // Preenche com os produtos reais do banco
        produtos.forEach(prod => {
            const option = document.createElement("option");
            option.value = prod.id;
            option.setAttribute("data-preco", prod.preco_venda);
            // Formata o nome e o preço bonitinho
            option.innerText = `${prod.nome} - R$ ${prod.preco_venda.toFixed(2).replace('.', ',')}`;
            select.appendChild(option);
        });
    } catch (erro) {
        console.error("Erro ao buscar produtos no servidor:", erro);
        alert("Erro ao carregar a lista de produtos.");
    }
}

// 2. Adiciona item na tabela
function adicionarAoCarrinho() {
    const select = document.getElementById("produtoSelecionado");
    const quantidadeInput = document.getElementById("quantidade");
    
    const idProduto = select.value;
    const nomeProduto = select.options[select.selectedIndex].text.split(" - ")[0];
    const preco = parseFloat(select.options[select.selectedIndex].getAttribute("data-preco"));
    const quantidade = parseInt(quantidadeInput.value);

    if (!idProduto) {
        alert("Por favor, selecione um produto!");
        return;
    }
    if (quantidade <= 0 || isNaN(quantidade)) {
        alert("A quantidade precisa ser maior que zero!");
        return;
    }

    const subtotal = preco * quantidade;

    carrinho.push({
        produto_id: idProduto,
        nome: nomeProduto,
        quantidade: quantidade,
        preco_unitario: preco,
        subtotal: subtotal
    });

    atualizarTela();
    
    quantidadeInput.value = 1;
    select.value = "";
}

// 3. Atualiza o visual da tabela e totais
function atualizarTela() {
    const tbody = document.getElementById("lista-carrinho");
    tbody.innerHTML = ""; 
    totalVenda = 0;

    carrinho.forEach(item => {
        totalVenda += item.subtotal;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${item.nome}</td>
            <td>${item.quantidade}</td>
            <td>R$ ${item.preco_unitario.toFixed(2).replace('.', ',')}</td>
            <td>R$ ${item.subtotal.toFixed(2).replace('.', ',')}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById("qtd-itens").innerText = carrinho.length;
    document.getElementById("valor-total").innerText = totalVenda.toFixed(2).replace('.', ',');
}

// 4. Finaliza a venda enviando pro Servidor
async function finalizarVenda() {
    if (carrinho.length === 0) {
        alert("O carrinho está vazio!");
        return;
    }

    const formaPagamento = document.getElementById("formaPagamento").value;

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

        if (resposta.ok) {
            alert("✅ Venda finalizada com sucesso!");
            carrinho = []; 
            atualizarTela(); 
        } else {
            alert("Erro ao registrar a venda.");
        }
    } catch (erro) {
        alert("Erro ao conectar com o servidor.");
        console.error(erro);
    }
}