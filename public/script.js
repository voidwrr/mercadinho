let carrinho = [];
let totalVenda = 0;
let produtosCache = [];

// 1. Busca os produtos no banco de dados assim que a tela abre
document.addEventListener("DOMContentLoaded", () => {
    carregarProdutos();
    configurarEventosTeclado();
});

async function carregarProdutos() {
    try {
        const resposta = await fetch('/api/produtos');
        if (!resposta.ok) throw new Error('Falha ao carregar produtos');
        
        produtosCache = await resposta.json();
        const select = document.getElementById("produtoSelect");
        
        // Limpa a lista atual
        select.innerHTML = '<option value="">Selecione ou bip o produto...</option>';
        
        // Preenche com os produtos reais, código de barras e o saldo atual
        produtosCache.forEach(prod => {
            const option = document.createElement("option");
            option.value = prod.id;
            option.setAttribute("data-preco", prod.preco_venda);
            option.setAttribute("data-estoque", prod.saldo_atual);
            option.setAttribute("data-codigo", prod.codigo_barras || '');
            option.setAttribute("data-unidade", prod.unidade || 'un');
            
            const codigoTexto = prod.codigo_barras ? `[${prod.codigo_barras}] ` : '';
            const saldoTexto = `(Estoque: ${prod.saldo_atual} ${prod.unidade || 'un'})`;
            const precoTexto = `R$ ${Number(prod.preco_venda).toFixed(2).replace('.', ',')}`;
            
            option.innerText = `${codigoTexto}${prod.nome} ${saldoTexto} - ${precoTexto}`;
            select.appendChild(option);
        });
    } catch (erro) {
        console.error("Erro ao buscar produtos no servidor:", erro);
        alert("Erro ao carregar a lista de produtos.");
    }
}

// 2. Adiciona item no carrinho (Suporta seleção ou leitor de código de barras)
function adicionarAoCarrinho() {
    const select = document.getElementById("produtoSelect");
    const quantidadeInput = document.getElementById("quantidade");
    
    const idProduto = select.value;
    const selectedOption = select.options[select.selectedIndex];

    if (!idProduto) {
        alert("Por favor, selecione um produto!");
        return;
    }

    const preco = parseFloat(selectedOption.getAttribute("data-preco"));
    const estoqueDisponivel = parseFloat(selectedOption.getAttribute("data-estoque"));
    const unidade = selectedOption.getAttribute("data-unidade");
    const quantidade = parseFloat(quantidadeInput.value);

    // Tratamento para extrair apenas o nome limpo do produto
    const prodEncontrado = produtosCache.find(p => p.id == idProduto);
    const nomeProduto = prodEncontrado ? prodEncontrado.nome : selectedOption.text.split(" (Estoque:")[0];

    if (isNaN(quantidade) || quantidade <= 0) {
        alert("A quantidade precisa ser maior que zero!");
        return;
    }

    // Verifica se já existe o mesmo produto no carrinho para somar a quantidade
    const itemExistente = carrinho.find(item => item.produto_id == idProduto);
    const qtdTotalDesejada = (itemExistente ? itemExistente.qtd : 0) + quantidade;

    // Validação de limite de estoque
    if (qtdTotalDesejada > estoqueDisponivel) {
        alert(`Estoque insuficiente! Disponível: ${estoqueDisponivel} ${unidade}`);
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
            unidade: unidade,
            qtd: quantidade,
            preco: preco,
            desconto: 0,
            subtotal: subtotal
        });
    }

    atualizarTela();
    
    // Reseta os campos do formulário para a próxima leitura/digitação
    quantidadeInput.value = 1;
    select.value = "";
    select.focus();
}

// 3. Atualiza a exibição da tabela e o cálculo total
function atualizarTela() {
    const tbody = document.getElementById("listaCarrinho");
    if (!tbody) return;

    tbody.innerHTML = ""; 
    totalVenda = 0;

    carrinho.forEach((item, index) => {
        totalVenda += item.subtotal;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${item.nome}</strong></td>
            <td>R$ ${item.preco.toFixed(2).replace('.', ',')}</td>
            <td>${item.qtd} ${item.unidade}</td>
            <td><strong>R$ ${item.subtotal.toFixed(2).replace('.', ',')}</strong></td>
            <td>
                <button type="button" onclick="removerDoCarrinho(${index})" style="color: #ef4444; border: none; background: none; cursor: pointer; font-size: 16px;">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    const elQtd = document.getElementById("qtdItens");
    const elTotal = document.getElementById("valorTotal");

    if (elQtd) elQtd.innerText = carrinho.length;
    if (elTotal) elTotal.innerText = totalVenda.toFixed(2).replace('.', ',');
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
            carregarProdutos(); // Atualiza o saldo dos produtos no select
        } else {
            alert(`❌ Erro: ${resultado.erro || "Erro ao registrar a venda."}`);
        }
    } catch (erro) {
        alert("❌ Erro ao conectar com o servidor.");
        console.error(erro);
    }
}

// 6. Configuração de Atalhos e Leitor de Código de Barras
function configurarEventosTeclado() {
    const select = document.getElementById("produtoSelect");
    const quantidadeInput = document.getElementById("quantidade");

    if (quantidadeInput) {
        quantidadeInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                adicionarAoCarrinho();
            }
        });
    }

    // Atalhos globais
    document.addEventListener("keydown", (e) => {
        if (e.key === "F9") {
            e.preventDefault();
            finalizarVenda();
        }
    });
}